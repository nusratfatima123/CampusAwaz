-- ============================================================================
-- CampusAwaz — Sprint 1 initial migration
-- Foundation, Auth & Verification
-- Idempotent: safe to run multiple times.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. TABLES
-- ============================================================================

-- universities ---------------------------------------------------------------
create table if not exists public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text not null unique,
  country text not null default 'Pakistan',
  allowed_email_domains text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- profiles (extends supabase auth.users) ------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  university_id uuid references public.universities(id),
  affiliation_status text not null default 'unverified',
  student_type text,
  privacy_mode text not null default 'identified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Constrain enum-ish columns (added separately so re-runs don't fail).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_affiliation_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_affiliation_status_check
      check (affiliation_status in ('unverified','pending_email','pending_card','verified','rejected'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_student_type_check'
  ) then
    alter table public.profiles
      add constraint profiles_student_type_check
      check (student_type is null or student_type in ('current_student','graduate'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_privacy_mode_check'
  ) then
    alter table public.profiles
      add constraint profiles_privacy_mode_check
      check (privacy_mode in ('identified','confidential','anonymous'));
  end if;
end $$;

-- roles ----------------------------------------------------------------------
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text
);

-- user_roles (many-to-many) --------------------------------------------------
create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  university_id uuid references public.universities(id),
  primary key (user_id, role_id)
);

-- user_verification ----------------------------------------------------------
create table if not exists public.user_verification (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  method text not null,
  status text not null,
  email_used text,
  otp_hash text,
  otp_expires_at timestamptz,
  otp_attempts integer not null default 0,
  card_storage_path text,
  ocr_extracted jsonb,
  ocr_confidence numeric,
  needs_manual_review boolean not null default false,
  reviewer_notes text,
  verified_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now()
);

-- otp_attempts may not exist if an older version of this table was created.
alter table public.user_verification
  add column if not exists otp_attempts integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_verification_method_check'
  ) then
    alter table public.user_verification
      add constraint user_verification_method_check
      check (method in ('email_otp','student_card'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'user_verification_status_check'
  ) then
    alter table public.user_verification
      add constraint user_verification_status_check
      check (status in ('pending','verified','rejected','expired'));
  end if;
end $$;

create index if not exists user_verification_user_id_idx
  on public.user_verification(user_id);
create index if not exists user_verification_user_method_status_idx
  on public.user_verification(user_id, method, status);

-- audit_logs -----------------------------------------------------------------
create table if not exists public.audit_logs (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  event text not null,
  actor text,
  metadata jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_user_id_idx on public.audit_logs(user_id);
create index if not exists audit_logs_event_idx on public.audit_logs(event);

-- ============================================================================
-- 2. HELPER FUNCTIONS
-- ============================================================================

-- Returns true when the current user holds any staff/oversight role.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.name in ('admin','hod','proctor','female_focal_person','counselor')
  );
$$;

-- Keeps profiles.updated_at fresh.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- 3. TRIGGER: create profile + default student role on signup
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_role_id uuid;
  v_university_id uuid;
  v_student_type text;
begin
  -- Pull optional signup metadata supplied at registration time.
  begin
    v_university_id := nullif(new.raw_user_meta_data ->> 'university_id', '')::uuid;
  exception when others then
    v_university_id := null;
  end;

  v_student_type := nullif(new.raw_user_meta_data ->> 'student_type', '');
  if v_student_type not in ('current_student','graduate') then
    v_student_type := null;
  end if;

  insert into public.profiles (id, full_name, university_id, student_type)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    v_university_id,
    v_student_type
  )
  on conflict (id) do nothing;

  -- Assign the default 'student' role (or 'graduate' when declared).
  select id into v_student_role_id
  from public.roles
  where name = case when v_student_type = 'graduate' then 'graduate' else 'student' end;

  if v_student_role_id is not null then
    insert into public.user_roles (user_id, role_id, university_id)
    values (new.id, v_student_role_id, v_university_id)
    on conflict (user_id, role_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================

alter table public.universities       enable row level security;
alter table public.profiles           enable row level security;
alter table public.roles              enable row level security;
alter table public.user_roles         enable row level security;
alter table public.user_verification  enable row level security;
alter table public.audit_logs         enable row level security;

-- universities: public read of active rows -----------------------------------
drop policy if exists "universities_public_select" on public.universities;
create policy "universities_public_select"
  on public.universities for select
  using (is_active = true);

drop policy if exists "universities_service_all" on public.universities;
create policy "universities_service_all"
  on public.universities for all
  to service_role
  using (true) with check (true);

-- profiles: own row only -----------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_staff());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles_service_all" on public.profiles;
create policy "profiles_service_all"
  on public.profiles for all
  to service_role
  using (true) with check (true);

-- roles: authenticated read --------------------------------------------------
drop policy if exists "roles_authenticated_select" on public.roles;
create policy "roles_authenticated_select"
  on public.roles for select
  to authenticated
  using (true);

drop policy if exists "roles_service_all" on public.roles;
create policy "roles_service_all"
  on public.roles for all
  to service_role
  using (true) with check (true);

-- user_roles: own rows read; service_role writes -----------------------------
drop policy if exists "user_roles_select_own" on public.user_roles;
create policy "user_roles_select_own"
  on public.user_roles for select
  to authenticated
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists "user_roles_service_all" on public.user_roles;
create policy "user_roles_service_all"
  on public.user_roles for all
  to service_role
  using (true) with check (true);

-- user_verification: own rows read only; writes via service_role -------------
-- NOTE: otp_hash is never selected by the client code; reads are limited to
-- the owner so verification progress can be displayed.
drop policy if exists "user_verification_select_own" on public.user_verification;
create policy "user_verification_select_own"
  on public.user_verification for select
  to authenticated
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists "user_verification_service_all" on public.user_verification;
create policy "user_verification_service_all"
  on public.user_verification for all
  to service_role
  using (true) with check (true);

-- audit_logs: insert by authenticated + service_role; read by staff ----------
drop policy if exists "audit_logs_insert_authenticated" on public.audit_logs;
create policy "audit_logs_insert_authenticated"
  on public.audit_logs for insert
  to authenticated
  with check (user_id is null or user_id = auth.uid());

drop policy if exists "audit_logs_select_staff" on public.audit_logs;
create policy "audit_logs_select_staff"
  on public.audit_logs for select
  to authenticated
  using (public.is_staff());

drop policy if exists "audit_logs_service_all" on public.audit_logs;
create policy "audit_logs_service_all"
  on public.audit_logs for all
  to service_role
  using (true) with check (true);

-- ============================================================================
-- 5. STORAGE: private bucket for student cards
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('student-cards', 'student-cards', false)
on conflict (id) do nothing;

-- Owners may read their own uploaded cards (path prefix = user id).
drop policy if exists "student_cards_select_own" on storage.objects;
create policy "student_cards_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'student-cards'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Uploads happen through the API route with the service role, but allow the
-- owner-prefixed path for signed/direct uploads too.
drop policy if exists "student_cards_insert_own" on storage.objects;
create policy "student_cards_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'student-cards'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- 6. SEED DATA
-- ============================================================================

insert into public.roles (name, description) values
  ('student',             'Currently enrolled university student'),
  ('graduate',            'Graduated student / alumni'),
  ('admin',               'University administrator with full oversight'),
  ('hod',                 'Head of Department'),
  ('proctor',             'Proctor / discipline office'),
  ('female_focal_person', 'Female Focal Person for harassment & safety cases'),
  ('hostel_warden',       'Hostel warden'),
  ('counselor',           'Student counselor / mental health support')
on conflict (name) do update set description = excluded.description;

insert into public.universities (name, code, country, allowed_email_domains, is_active) values
  ('Lahore University of Management Sciences', 'LUMS',    'Pakistan',
    '{lums.edu.pk,sdc.lums.edu.pk}', true),
  ('National University of Sciences and Technology', 'NUST', 'Pakistan',
    '{nust.edu.pk,seecs.edu.pk,student.nust.edu.pk}', true),
  ('FAST National University of Computer and Emerging Sciences', 'FAST-NU', 'Pakistan',
    '{nu.edu.pk,lhr.nu.edu.pk,isb.nu.edu.pk,khi.nu.edu.pk,fast.edu.pk,nuces.edu.pk}', true),
  ('University of Engineering and Technology Lahore', 'UET', 'Pakistan',
    '{uet.edu.pk,student.uet.edu.pk}', true),
  ('Institute of Business Administration Karachi', 'IBA', 'Pakistan',
    '{iba.edu.pk,khi.iba.edu.pk}', true),
  ('Ghulam Ishaq Khan Institute of Engineering Sciences and Technology', 'GIKI', 'Pakistan',
    '{giki.edu.pk,student.giki.edu.pk}', true),
  ('COMSATS University Islamabad', 'COMSATS', 'Pakistan',
    '{comsats.edu.pk,cuilahore.edu.pk,cuiatd.edu.pk}', true),
  ('Information Technology University Punjab', 'ITU', 'Pakistan',
    '{itu.edu.pk,student.itu.edu.pk}', true)
on conflict (code) do update set
  name                  = excluded.name,
  allowed_email_domains = excluded.allowed_email_domains,
  is_active             = excluded.is_active;

-- ============================================================================
-- 7. BACKFILL: profiles for any pre-existing auth users
-- ============================================================================

insert into public.profiles (id, full_name)
select u.id, nullif(u.raw_user_meta_data ->> 'full_name', '')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

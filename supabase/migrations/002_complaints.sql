-- ============================================================================
-- CampusAwaz — Sprint 2 migration
-- Complaint submission + protected harassment / safety workflow
-- Idempotent: safe to run multiple times.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. TABLES
-- ============================================================================

-- complaint_categories -------------------------------------------------------
create table if not exists public.complaint_categories (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  description text,
  is_sensitive boolean not null default false,
  display_order integer not null default 0,
  is_active boolean not null default true
);

-- complaints -----------------------------------------------------------------
create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  tracking_id text not null unique,
  student_id uuid not null references auth.users(id) on delete cascade,
  university_id uuid references public.universities(id),
  category_id uuid references public.complaint_categories(id),
  title text not null,
  description text not null,
  privacy_mode text not null default 'identified',
  status text not null default 'submitted',
  priority text not null default 'medium',
  is_sensitive boolean not null default false,
  immediate_danger boolean not null default false,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists complaints_student_id_idx on public.complaints(student_id);
create index if not exists complaints_tracking_id_idx on public.complaints(tracking_id);
create index if not exists complaints_university_id_idx on public.complaints(university_id);
create index if not exists complaints_is_sensitive_idx on public.complaints(is_sensitive);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'complaints_privacy_mode_check'
  ) then
    alter table public.complaints
      add constraint complaints_privacy_mode_check
      check (privacy_mode in ('identified','confidential','anonymous'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'complaints_status_check'
  ) then
    alter table public.complaints
      add constraint complaints_status_check
      check (status in ('submitted','assigned','in_review','action_taken','resolved','escalated','reopened'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'complaints_priority_check'
  ) then
    alter table public.complaints
      add constraint complaints_priority_check
      check (priority in ('low','medium','high','critical'));
  end if;
end $$;

-- complaint_evidence ---------------------------------------------------------
create table if not exists public.complaint_evidence (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id),
  storage_path text not null,
  file_name text not null,
  file_type text not null,
  file_size_bytes integer not null,
  is_resolution_evidence boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists complaint_evidence_complaint_id_idx
  on public.complaint_evidence(complaint_id);

-- complaint_status_history ---------------------------------------------------
create table if not exists public.complaint_status_history (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  status text not null,
  changed_by uuid references auth.users(id),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists complaint_status_history_complaint_id_idx
  on public.complaint_status_history(complaint_id);

-- complaint_privacy ----------------------------------------------------------
-- Stores the identity-exposure rules for a single complaint.
--   identified   → identity visible to authorized staff per normal permissions
--   confidential → identity visible only to user ids listed in exposed_to
--   anonymous    → identity never exposed; handlers see anonymous_alias
create table if not exists public.complaint_privacy (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null unique references public.complaints(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  exposed_to uuid[] not null default '{}',
  anonymous_alias text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists complaint_privacy_student_id_idx
  on public.complaint_privacy(student_id);

-- sensitive_case_access ------------------------------------------------------
-- Assigns a sensitive (harassment / safety) case to an authorized handler.
create table if not exists public.sensitive_case_access (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  assigned_at timestamptz not null default now(),
  unique(complaint_id, user_id)
);
create index if not exists sensitive_case_access_user_id_idx
  on public.sensitive_case_access(user_id);
create index if not exists sensitive_case_access_complaint_id_idx
  on public.sensitive_case_access(complaint_id);

-- tracking_id_sequences ------------------------------------------------------
create table if not exists public.tracking_id_sequences (
  university_id uuid references public.universities(id) on delete cascade,
  year integer not null,
  last_number integer not null default 0,
  primary key (university_id, year)
);

-- ============================================================================
-- 2. TRIGGERS
-- ============================================================================

drop trigger if exists complaints_touch_updated_at on public.complaints;
create trigger complaints_touch_updated_at
  before update on public.complaints
  for each row execute function public.touch_updated_at();

drop trigger if exists complaint_privacy_touch_updated_at on public.complaint_privacy;
create trigger complaint_privacy_touch_updated_at
  before update on public.complaint_privacy
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- 3. FUNCTIONS
-- ============================================================================

-- Atomic, per-university-per-year human-readable tracking id.
-- Format: CA-{UNIVERSITY_CODE}-{YYYY}-{SEQUENCE} e.g. CA-FAST-2026-00001
create or replace function public.generate_tracking_id(p_university_id uuid, p_year integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_next integer;
begin
  select code into v_code from public.universities where id = p_university_id;
  if v_code is null then
    raise exception 'University not found';
  end if;

  insert into public.tracking_id_sequences (university_id, year, last_number)
  values (p_university_id, p_year, 1)
  on conflict (university_id, year)
  do update set last_number = tracking_id_sequences.last_number + 1
  returning tracking_id_sequences.last_number into v_next;

  return 'CA-' || v_code || '-' || p_year || '-' || lpad(v_next::text, 5, '0');
end;
$$;

-- Tracking IDs are allocated only by the API route's service-role client, so the
-- counter cannot be advanced (or probed) from a browser session.
do $$
begin
  execute 'revoke all on function public.generate_tracking_id(uuid, integer) from public';
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.generate_tracking_id(uuid, integer) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function public.generate_tracking_id(uuid, integer) from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.generate_tracking_id(uuid, integer) to service_role';
  end if;
end $$;

-- True when the current user is assigned to the given sensitive case.
create or replace function public.has_sensitive_case_access(p_complaint_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sensitive_case_access sca
    where sca.complaint_id = p_complaint_id
      and sca.user_id = auth.uid()
  );
$$;

-- True when the current user may read the complaint at all.
--   * the reporting student, always
--   * staff, for non-sensitive complaints in their own university
--   * staff explicitly assigned via sensitive_case_access, for sensitive ones
create or replace function public.can_read_complaint(p_complaint_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.complaints c
    where c.id = p_complaint_id
      and (
        c.student_id = auth.uid()
        or (
          public.is_staff()
          and c.is_sensitive = false
          and c.university_id is not distinct from (
            select p.university_id from public.profiles p where p.id = auth.uid()
          )
        )
        or public.has_sensitive_case_access(c.id)
      )
  );
$$;

-- True when the current user may see the reporter's real identity.
create or replace function public.can_see_complaint_identity(p_complaint_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.complaints c
    left join public.complaint_privacy cp on cp.complaint_id = c.id
    where c.id = p_complaint_id
      and (
        c.student_id = auth.uid()
        or (c.privacy_mode = 'identified'
            and public.is_staff()
            and (c.is_sensitive = false or public.has_sensitive_case_access(c.id)))
        or (c.privacy_mode = 'confidential' and auth.uid() = any (cp.exposed_to))
      )
  );
$$;

-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================

alter table public.complaint_categories      enable row level security;
alter table public.complaints                enable row level security;
alter table public.complaint_evidence        enable row level security;
alter table public.complaint_status_history  enable row level security;
alter table public.complaint_privacy         enable row level security;
alter table public.sensitive_case_access     enable row level security;
alter table public.tracking_id_sequences     enable row level security;

-- complaint_categories: public read of active rows ---------------------------
drop policy if exists "complaint_categories_public_select" on public.complaint_categories;
create policy "complaint_categories_public_select"
  on public.complaint_categories for select
  using (is_active = true);

drop policy if exists "complaint_categories_service_all" on public.complaint_categories;
create policy "complaint_categories_service_all"
  on public.complaint_categories for all
  to service_role
  using (true) with check (true);

-- complaints -----------------------------------------------------------------
-- Students read their own complaints.
drop policy if exists "complaints_select_own" on public.complaints;
create policy "complaints_select_own"
  on public.complaints for select
  to authenticated
  using (student_id = auth.uid());

-- Staff read NON-sensitive complaints in their own university only.
drop policy if exists "complaints_select_staff_non_sensitive" on public.complaints;
create policy "complaints_select_staff_non_sensitive"
  on public.complaints for select
  to authenticated
  using (
    is_sensitive = false
    and public.is_staff()
    and university_id is not distinct from (
      select p.university_id from public.profiles p where p.id = auth.uid()
    )
  );

-- Sensitive complaints are readable ONLY by explicitly assigned handlers
-- (female_focal_person / proctor / admin / counselor rows in
-- sensitive_case_access). An unassigned admin sees nothing.
drop policy if exists "complaints_select_sensitive_assigned" on public.complaints;
create policy "complaints_select_sensitive_assigned"
  on public.complaints for select
  to authenticated
  using (public.has_sensitive_case_access(id));

-- No client-side INSERT/UPDATE/DELETE: every write goes through an API route
-- backed by the service-role client.
drop policy if exists "complaints_service_all" on public.complaints;
create policy "complaints_service_all"
  on public.complaints for all
  to service_role
  using (true) with check (true);

-- complaint_evidence ---------------------------------------------------------
drop policy if exists "complaint_evidence_select_own" on public.complaint_evidence;
create policy "complaint_evidence_select_own"
  on public.complaint_evidence for select
  to authenticated
  using (uploaded_by = auth.uid() or public.can_read_complaint(complaint_id));

drop policy if exists "complaint_evidence_service_all" on public.complaint_evidence;
create policy "complaint_evidence_service_all"
  on public.complaint_evidence for all
  to service_role
  using (true) with check (true);

-- complaint_status_history ---------------------------------------------------
drop policy if exists "complaint_status_history_select" on public.complaint_status_history;
create policy "complaint_status_history_select"
  on public.complaint_status_history for select
  to authenticated
  using (public.can_read_complaint(complaint_id));

drop policy if exists "complaint_status_history_service_all" on public.complaint_status_history;
create policy "complaint_status_history_service_all"
  on public.complaint_status_history for all
  to service_role
  using (true) with check (true);

-- complaint_privacy ----------------------------------------------------------
-- The owning student always sees their own row. Staff may read it only when the
-- privacy mode actually exposes the identity to them.
drop policy if exists "complaint_privacy_select" on public.complaint_privacy;
create policy "complaint_privacy_select"
  on public.complaint_privacy for select
  to authenticated
  using (
    student_id = auth.uid()
    or auth.uid() = any (exposed_to)
    or public.can_see_complaint_identity(complaint_id)
  );

drop policy if exists "complaint_privacy_service_all" on public.complaint_privacy;
create policy "complaint_privacy_service_all"
  on public.complaint_privacy for all
  to service_role
  using (true) with check (true);

-- sensitive_case_access ------------------------------------------------------
drop policy if exists "sensitive_case_access_select_own" on public.sensitive_case_access;
create policy "sensitive_case_access_select_own"
  on public.sensitive_case_access for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "sensitive_case_access_service_all" on public.sensitive_case_access;
create policy "sensitive_case_access_service_all"
  on public.sensitive_case_access for all
  to service_role
  using (true) with check (true);

-- tracking_id_sequences ------------------------------------------------------
-- Internal counter table: service_role only, no client access at all.
drop policy if exists "tracking_id_sequences_service_all" on public.tracking_id_sequences;
create policy "tracking_id_sequences_service_all"
  on public.tracking_id_sequences for all
  to service_role
  using (true) with check (true);

-- ============================================================================
-- 5. STORAGE: private bucket for complaint evidence
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('complaint-evidence', 'complaint-evidence', false)
on conflict (id) do nothing;

-- Uploads are performed by the API route (service role), but the owner-prefixed
-- path is also permitted so signed/direct uploads keep working.
drop policy if exists "complaint_evidence_objects_insert_own" on storage.objects;
create policy "complaint_evidence_objects_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'complaint-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Read own objects, or any object linked to a complaint the caller may read.
drop policy if exists "complaint_evidence_objects_select" on storage.objects;
create policy "complaint_evidence_objects_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'complaint-evidence'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1
        from public.complaint_evidence ce
        where ce.storage_path = storage.objects.name
          and public.can_read_complaint(ce.complaint_id)
      )
    )
  );

drop policy if exists "complaint_evidence_objects_delete_own" on storage.objects;
create policy "complaint_evidence_objects_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'complaint-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- 6. SEED: complaint categories
-- ============================================================================

insert into public.complaint_categories
  (key, label, description, is_sensitive, display_order, is_active)
values
  ('academic', 'Academic',
   'Grading disputes, unfair marking, course content, exams, attendance and faculty conduct in class.',
   false, 1, true),
  ('facilities', 'Facilities',
   'Classrooms, labs, libraries, transport, water, electricity, cleanliness and campus infrastructure.',
   false, 2, true),
  ('hostel', 'Hostel',
   'Room allocation, mess and food quality, hostel maintenance, warden issues and curfew concerns.',
   false, 3, true),
  ('financial', 'Financial',
   'Fee challans, scholarships, refunds, fines and unexplained charges.',
   false, 4, true),
  ('administration', 'Administrative',
   'Admissions, transcripts, documents, registration desks and departmental office delays.',
   false, 5, true),
  ('safety_harassment', 'Safety & Harassment',
   'Harassment, bullying, stalking, threats, physical safety and any incident that puts you at risk.',
   true, 6, true),
  ('mental_health', 'Mental Health',
   'Stress, anxiety, burnout, counselling access and wellbeing support.',
   false, 7, true),
  ('other', 'Other',
   'Anything that does not fit the categories above.',
   false, 8, true)
on conflict (key) do update set
  label         = excluded.label,
  description   = excluded.description,
  is_sensitive  = excluded.is_sensitive,
  display_order = excluded.display_order,
  is_active     = excluded.is_active;

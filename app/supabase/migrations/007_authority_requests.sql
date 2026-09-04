-- ============================================================================
-- CampusAwaz — Sprint 7: Verified University Authority System
-- Authority request workflow: request → review → approve/reject/suspend
-- Idempotent: safe to run multiple times.
-- ============================================================================

-- ============================================================================
-- 1. TABLE
-- ============================================================================

create table if not exists public.authority_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  university_id uuid not null references public.universities(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','suspended','reinstated')),
  statement text not null check (char_length(statement) between 50 and 2000),
  evidence_path text,
  reviewed_by uuid references auth.users(id),
  review_reason text,
  reviewed_at timestamptz,
  suspended_by uuid references auth.users(id),
  suspension_reason text,
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, role_id, university_id)
);

create index if not exists authority_requests_university_status_idx
  on public.authority_requests(university_id, status);
create index if not exists authority_requests_user_id_idx
  on public.authority_requests(user_id);
create index if not exists authority_requests_reviewed_by_idx
  on public.authority_requests(reviewed_by);

-- updated_at trigger
drop trigger if exists authority_requests_touch_updated_at on public.authority_requests;
create trigger authority_requests_touch_updated_at
  before update on public.authority_requests
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- 2. SELF-APPROVAL PREVENTION TRIGGER
-- ============================================================================

create or replace function public.prevent_self_approval()
returns trigger
language plpgsql
as $$
begin
  if new.reviewed_by = new.user_id then
    raise exception 'Cannot approve your own authority request'
      using hint = 'A different admin must review authority requests';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_self_approval on public.authority_requests;
create trigger trg_prevent_self_approval
  before update on public.authority_requests
  for each row
  when (new.status in ('approved','rejected','suspended'))
  execute function public.prevent_self_approval();

-- ============================================================================
-- 3. FIX is_staff() — add hostel_warden (was missing from migration 001)
-- ============================================================================

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
      and r.name in ('admin','hod','proctor','female_focal_person','hostel_warden','counselor')
  );
$$;

-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================

alter table public.authority_requests enable row level security;

-- Users can read their own requests
drop policy if exists "authority_requests_select_own" on public.authority_requests;
create policy "authority_requests_select_own"
  on public.authority_requests for select
  to authenticated
  using (
    user_id = auth.uid()
    or (
      public.is_staff()
      and university_id = (
        select p.university_id from public.profiles p where p.id = auth.uid()
      )
    )
  );

-- Authenticated users can create their own requests
drop policy if exists "authority_requests_insert_own" on public.authority_requests;
create policy "authority_requests_insert_own"
  on public.authority_requests for insert
  to authenticated
  with check (user_id = auth.uid());

-- Staff can update requests in their university (approve/reject/suspend)
drop policy if exists "authority_requests_update_staff" on public.authority_requests;
create policy "authority_requests_update_staff"
  on public.authority_requests for update
  to authenticated
  using (
    public.is_staff()
    and university_id = (
      select p.university_id from public.profiles p where p.id = auth.uid()
    )
  )
  with check (
    public.is_staff()
    and university_id = (
      select p.university_id from public.profiles p where p.id = auth.uid()
    )
  );

-- Service role has full access (for API routes using createAdminClient)
drop policy if exists "authority_requests_service_all" on public.authority_requests;
create policy "authority_requests_service_all"
  on public.authority_requests for all
  to service_role
  using (true) with check (true);

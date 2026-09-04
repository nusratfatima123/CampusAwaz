-- ============================================================================
-- CampusAwaz — Sprint 8: Identity Access Requests
-- Authority → Admin → Student identity permission workflow.
-- Idempotent: safe to run multiple times.
-- ============================================================================

-- ============================================================================
-- 1. TABLE
-- ============================================================================

create table if not exists public.identity_access_requests (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  requested_by_role text not null,
  status text not null default 'pending'
    check (status in ('pending','admin_approved','admin_denied','granted','denied','expired')),
  admin_decided_by uuid references auth.users(id),
  admin_decided_at timestamptz,
  admin_notes text,
  student_decided_at timestamptz,
  student_notes text,
  granted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

create index if not exists identity_access_requests_complaint_id_idx
  on public.identity_access_requests(complaint_id);

create index if not exists identity_access_requests_requester_id_idx
  on public.identity_access_requests(requester_id);

create index if not exists identity_access_requests_status_idx
  on public.identity_access_requests(status);

-- Only one active request per complaint at a time.
create unique index if not exists identity_access_requests_one_active_idx
  on public.identity_access_requests(complaint_id)
  where status in ('pending', 'admin_approved', 'granted');

-- updated_at trigger
drop trigger if exists identity_access_requests_touch_updated_at on public.identity_access_requests;
create trigger identity_access_requests_touch_updated_at
  before update on public.identity_access_requests
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================================

alter table public.identity_access_requests enable row level security;

-- Service role has full access (all operations go through lib/identity-access.ts).
drop policy if exists "identity_access_requests_service_all" on public.identity_access_requests;
create policy "identity_access_requests_service_all"
  on public.identity_access_requests for all
  to service_role
  using (true) with check (true);

-- Requesters can read their own requests.
drop policy if exists "identity_access_requests_select_requester" on public.identity_access_requests;
create policy "identity_access_requests_select_requester"
  on public.identity_access_requests for select
  to authenticated
  using (requester_id = auth.uid());

-- Complaint owners (students) can read requests for their own complaints.
drop policy if exists "identity_access_requests_select_student" on public.identity_access_requests;
create policy "identity_access_requests_select_student"
  on public.identity_access_requests for select
  to authenticated
  using (
    complaint_id in (
      select c.id from public.complaints c where c.student_id = auth.uid()
    )
  );

-- Staff can read requests for complaints they can access.
drop policy if exists "identity_access_requests_select_staff" on public.identity_access_requests;
create policy "identity_access_requests_select_staff"
  on public.identity_access_requests for select
  to authenticated
  using (
    public.is_staff()
    and complaint_id in (
      select c.id from public.complaints c
      where c.university_id = (
        select p.university_id from public.profiles p where p.id = auth.uid()
      )
    )
  );

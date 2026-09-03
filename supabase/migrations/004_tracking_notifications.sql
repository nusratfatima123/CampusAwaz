-- ============================================================================
-- CampusAwaz — Sprint 4 migration
-- Notifications + complaint assignment history + status transition validation
-- Idempotent: safe to run multiple times.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. TABLES
-- ============================================================================

-- notifications ----------------------------------------------------------------
-- One row per user notification (status change, assignment, resolution, update).
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,           -- 'status_change' | 'assignment' | 'resolution' | 'case_update'
  complaint_id uuid references public.complaints(id) on delete cascade,
  title text not null,
  body text,
  tracking_id text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists notifications_complaint_id_idx on public.notifications(complaint_id);
create index if not exists notifications_is_read_idx on public.notifications(is_read);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'notifications_type_check'
  ) then
    alter table public.notifications
      add constraint notifications_type_check
      check (type in ('status_change','assignment','resolution','case_update'));
  end if;
end $$;

-- complaint_assignments -------------------------------------------------------
-- Tracks every assignment event as a history row.
create table if not exists public.complaint_assignments (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  assigned_to uuid references auth.users(id),
  assigned_by uuid references auth.users(id),
  department_id uuid references public.departments(id),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists complaint_assignments_complaint_id_idx
  on public.complaint_assignments(complaint_id);
create index if not exists complaint_assignments_assigned_to_idx
  on public.complaint_assignments(assigned_to);

-- ============================================================================
-- 2. STATUS TRANSITION CHECK
-- ============================================================================

-- Enforce valid transitions at the DB level. Sprint 4 statuses:
--   submitted -> assigned, in_review
--   assigned  -> in_review
--   in_review -> action_taken
--   action_taken -> resolved
--   resolved  -> (terminal for Sprint 4)
--
-- The existing complaints_status_check already limits the value set. We add a
-- trigger-based transition check on complaint_status_history so invalid
-- transitions are rejected before they persist.

create or replace function public.validate_status_transition()
returns trigger
language plpgsql
as $$
declare
  v_current_status text;
begin
  -- Find the most recent status before this insert.
  select status into v_current_status
  from public.complaint_status_history
  where complaint_id = new.complaint_id
  order by created_at desc, id desc
  limit 1;

  -- First entry (no prior row) — always allowed.
  if v_current_status is null then
    if new.status <> 'submitted' then
      raise exception 'Initial status must be submitted, got %', new.status;
    end if;
    return new;
  end if;

  -- Sprint 4 valid transitions.
  if v_current_status = 'submitted' and new.status in ('assigned','in_review') then
    return new;
  end if;
  if v_current_status = 'assigned' and new.status = 'in_review' then
    return new;
  end if;
  if v_current_status = 'in_review' and new.status = 'action_taken' then
    return new;
  end if;
  if v_current_status = 'action_taken' and new.status = 'resolved' then
    return new;
  end if;
  -- Allow same-status re-entry for initial insert (idempotent submissions).
  if v_current_status = new.status then
    return new;
  end if;

  raise exception 'Invalid status transition from % to %', v_current_status, new.status;
end;
$$;

drop trigger if exists complaint_status_transition_check on public.complaint_status_history;
create trigger complaint_status_transition_check
  before insert on public.complaint_status_history
  for each row execute function public.validate_status_transition();

-- ============================================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================================

alter table public.notifications         enable row level security;
alter table public.complaint_assignments enable row level security;

-- notifications: users read their own; service_role ALL -----------------------
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "notifications_service_all" on public.notifications;
create policy "notifications_service_all"
  on public.notifications for all
  to service_role
  using (true) with check (true);

-- complaint_assignments: readable by the assigned user and staff who can read
-- the complaint. service_role ALL.
drop policy if exists "complaint_assignments_select" on public.complaint_assignments;
create policy "complaint_assignments_select"
  on public.complaint_assignments for select
  to authenticated
  using (
    assigned_to = auth.uid()
    or public.can_read_complaint(complaint_id)
  );

drop policy if exists "complaint_assignments_service_all" on public.complaint_assignments;
create policy "complaint_assignments_service_all"
  on public.complaint_assignments for all
  to service_role
  using (true) with check (true);

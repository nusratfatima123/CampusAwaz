-- ============================================================================
-- CampusAwaz — Sprint 5 migration
-- Escalation, Proof of Action, Resolution & Feedback
-- Idempotent: safe to run multiple times.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. TABLES
-- ============================================================================

-- sla_rules -------------------------------------------------------------------
-- Configurable response periods per category/priority combination.
-- response_hours: max hours before a complaint is considered overdue/eligible
-- for escalation.
create table if not exists public.sla_rules (
  id uuid primary key default gen_random_uuid(),
  university_id uuid references public.universities(id) on delete cascade,
  category_key text,
  priority text,
  response_hours int not null default 72,
  escalation_level int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists sla_rules_university_idx on public.sla_rules(university_id);
create index if not exists sla_rules_category_priority_idx
  on public.sla_rules(category_key, priority);

-- escalations -----------------------------------------------------------------
-- One row per escalation event. A complaint can be escalated multiple times.
create table if not exists public.escalations (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  escalated_by uuid references auth.users(id),
  escalated_to uuid references auth.users(id),
  reason text not null,
  previous_status text,
  new_status text not null default 'escalated',
  sla_rule_id uuid references public.sla_rules(id),
  level int not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists escalations_complaint_id_idx on public.escalations(complaint_id);
create index if not exists escalations_escalated_to_idx on public.escalations(escalated_to);

-- proof_of_action -------------------------------------------------------------
-- Admin records the action taken when resolving a complaint.
create table if not exists public.proof_of_action (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  action_taken text not null,
  resolution_explanation text,
  created_at timestamptz not null default now()
);

create index if not exists proof_of_action_complaint_id_idx
  on public.proof_of_action(complaint_id);

-- resolution_evidence ---------------------------------------------------------
-- Files uploaded by admins as proof of resolution. Inherits complaint privacy.
create table if not exists public.resolution_evidence (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id),
  storage_path text not null,
  file_name text not null,
  file_type text not null,
  file_size_bytes bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists resolution_evidence_complaint_id_idx
  on public.resolution_evidence(complaint_id);

-- feedback --------------------------------------------------------------------
-- Student feedback after resolution: rating (1-5) + optional comment.
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  rating int not null,
  comment text,
  created_at timestamptz not null default now(),
  unique (complaint_id)
);

create index if not exists feedback_complaint_id_idx on public.feedback(complaint_id);
create index if not exists feedback_student_id_idx on public.feedback(student_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'feedback_rating_check'
  ) then
    alter table public.feedback
      add constraint feedback_rating_check
      check (rating between 1 and 5);
  end if;
end $$;

-- ============================================================================
-- 2. UPDATE STATUS TRANSITION VALIDATION
-- ============================================================================

-- Expand the valid transitions to include Sprint 5 states:
--   assigned, in_review -> escalated (SLA breach or manual)
--   escalated -> in_review, assigned (after higher authority takes over)
--   resolved -> reopened (by authorized admin)
--   reopened -> in_review (back to active work)

create or replace function public.validate_status_transition()
returns trigger
language plpgsql
as $$
declare
  v_current_status text;
begin
  select status into v_current_status
  from public.complaint_status_history
  where complaint_id = new.complaint_id
  order by created_at desc, id desc
  limit 1;

  if v_current_status is null then
    if new.status <> 'submitted' then
      raise exception 'Initial status must be submitted, got %', new.status;
    end if;
    return new;
  end if;

  -- Sprint 4 transitions.
  if v_current_status = 'submitted' and new.status in ('assigned','in_review') then
    return new;
  end if;
  if v_current_status = 'assigned' and new.status in ('in_review', 'escalated') then
    return new;
  end if;
  if v_current_status = 'in_review' and new.status in ('action_taken', 'escalated') then
    return new;
  end if;
  if v_current_status = 'action_taken' and new.status = 'resolved' then
    return new;
  end if;

  -- Sprint 5 transitions.
  if v_current_status = 'escalated' and new.status in ('in_review', 'assigned') then
    return new;
  end if;
  if v_current_status = 'resolved' and new.status = 'reopened' then
    return new;
  end if;
  if v_current_status = 'reopened' and new.status = 'in_review' then
    return new;
  end if;

  -- Allow same-status re-entry (idempotent submissions).
  if v_current_status = new.status then
    return new;
  end if;

  raise exception 'Invalid status transition from % to %', v_current_status, new.status;
end;
$$;

-- ============================================================================
-- 3. UPDATE NOTIFICATIONS TYPE CHECK
-- ============================================================================

do $$
begin
  -- Drop old check if it exists, then recreate with 'escalation' added.
  if exists (
    select 1 from pg_constraint where conname = 'notifications_type_check'
  ) then
    alter table public.notifications drop constraint notifications_type_check;
  end if;

  alter table public.notifications
    add constraint notifications_type_check
    check (type in ('status_change','assignment','resolution','case_update','escalation'));
end $$;

-- ============================================================================
-- 4. UPDATE COMPLAINTS STATUS CHECK
-- ============================================================================

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'complaints_status_check'
  ) then
    alter table public.complaints drop constraint complaints_status_check;
  end if;

  alter table public.complaints
    add constraint complaints_status_check
    check (status in (
      'submitted', 'assigned', 'in_review', 'action_taken',
      'resolved', 'escalated', 'reopened'
    ));
end $$;

-- ============================================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================================

alter table public.sla_rules enable row level security;
alter table public.escalations enable row level security;
alter table public.proof_of_action enable row level security;
alter table public.resolution_evidence enable row level security;
alter table public.feedback enable row level security;

-- sla_rules: staff can read; service_role ALL.
drop policy if exists "sla_rules_select" on public.sla_rules;
create policy "sla_rules_select"
  on public.sla_rules for select
  to authenticated
  using (is_active = true);

drop policy if exists "sla_rules_service_all" on public.sla_rules;
create policy "sla_rules_service_all"
  on public.sla_rules for all
  to service_role
  using (true) with check (true);

-- escalations: readable by the student who owns the complaint and staff who
-- can read the complaint. service_role ALL.
drop policy if exists "escalations_select" on public.escalations;
create policy "escalations_select"
  on public.escalations for select
  to authenticated
  using (
    exists (
      select 1 from public.complaints c
      where c.id = escalations.complaint_id
        and (c.student_id = auth.uid() or public.can_read_complaint(c.id))
    )
  );

drop policy if exists "escalations_service_all" on public.escalations;
create policy "escalations_service_all"
  on public.escalations for all
  to service_role
  using (true) with check (true);

-- proof_of_action: readable by the student and staff who can read the complaint.
drop policy if exists "proof_of_action_select" on public.proof_of_action;
create policy "proof_of_action_select"
  on public.proof_of_action for select
  to authenticated
  using (
    exists (
      select 1 from public.complaints c
      where c.id = proof_of_action.complaint_id
        and (c.student_id = auth.uid() or public.can_read_complaint(c.id))
    )
  );

drop policy if exists "proof_of_action_service_all" on public.proof_of_action;
create policy "proof_of_action_service_all"
  on public.proof_of_action for all
  to service_role
  using (true) with check (true);

-- resolution_evidence: same visibility as proof_of_action.
drop policy if exists "resolution_evidence_select" on public.resolution_evidence;
create policy "resolution_evidence_select"
  on public.resolution_evidence for select
  to authenticated
  using (
    exists (
      select 1 from public.complaints c
      where c.id = resolution_evidence.complaint_id
        and (c.student_id = auth.uid() or public.can_read_complaint(c.id))
    )
  );

drop policy if exists "resolution_evidence_service_all" on public.resolution_evidence;
create policy "resolution_evidence_service_all"
  on public.resolution_evidence for all
  to service_role
  using (true) with check (true);

-- feedback: students read their own; staff can read if they can read the complaint.
drop policy if exists "feedback_select" on public.feedback;
create policy "feedback_select"
  on public.feedback for select
  to authenticated
  using (
    student_id = auth.uid()
    or exists (
      select 1 from public.complaints c
      where c.id = feedback.complaint_id
        and public.can_read_complaint(c.id)
    )
  );

drop policy if exists "feedback_insert_own" on public.feedback;
create policy "feedback_insert_own"
  on public.feedback for insert
  to authenticated
  with check (student_id = auth.uid());

drop policy if exists "feedback_service_all" on public.feedback;
create policy "feedback_service_all"
  on public.feedback for all
  to service_role
  using (true) with check (true);

-- ============================================================================
-- 6. SEED DEFAULT SLA RULES
-- ============================================================================

-- Insert default SLA rules for all universities. These are generic defaults;
-- each university can override per-category/priority.
-- Critical: 24h, High: 48h, Medium: 72h, Low: 168h (7 days).
-- Sensitive categories (safety_harassment) get shorter SLAs.

insert into public.sla_rules (university_id, category_key, priority, response_hours, escalation_level, is_active)
select
  u.id,
  cat.key,
  p.priority,
  case
    when cat.key = 'safety_harassment' and p.priority = 'critical' then 4
    when cat.key = 'safety_harassment' and p.priority = 'high' then 12
    when cat.key = 'safety_harassment' then 24
    when p.priority = 'critical' then 24
    when p.priority = 'high' then 48
    when p.priority = 'medium' then 72
    else 168
  end as response_hours,
  1 as escalation_level,
  true as is_active
from public.universities u
cross join (
  select key from public.complaint_categories where is_active = true
) cat
cross join (
  select unnest(ARRAY['low','medium','high','critical']) as priority
) p
where not exists (
  select 1 from public.sla_rules sr
  where sr.university_id = u.id
    and sr.category_key = cat.key
    and sr.priority = p.priority
);

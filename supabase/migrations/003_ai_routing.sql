-- ============================================================================
-- CampusAwaz — Sprint 3 migration
-- AI Complaint Assistant + Smart Routing (departments, routing map, AI records)
-- Idempotent: safe to run multiple times.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. TABLES
-- ============================================================================

-- departments ----------------------------------------------------------------
-- One row per university per department key. The shared key set keeps routing
-- rules portable across universities.
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(university_id, key)
);

create index if not exists departments_university_id_idx
  on public.departments(university_id);
create index if not exists departments_key_idx on public.departments(key);

-- department_routing ---------------------------------------------------------
-- Maps a complaint category key to the department that owns it, per university.
-- `department_key` is a plain text key (not an FK to departments.id) so a single
-- routing row stays valid for every university that shares the key set.
create table if not exists public.department_routing (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  category_key text not null,
  department_key text not null,
  priority text not null default 'medium',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(university_id, category_key)
);

create index if not exists department_routing_university_id_idx
  on public.department_routing(university_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'department_routing_priority_check'
  ) then
    alter table public.department_routing
      add constraint department_routing_priority_check
      check (priority in ('low','medium','high','critical'));
  end if;
end $$;

-- ai_sessions ----------------------------------------------------------------
-- One row per AI request. `raw_input` is stored already identity-stripped for
-- anonymous sessions (the API route sanitises before insert).
create table if not exists public.ai_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_type text not null,        -- 'complaint_assist' | 'routing_review'
  raw_input text not null,
  privacy_mode text not null default 'identified',
  created_at timestamptz not null default now()
);

create index if not exists ai_sessions_user_id_idx on public.ai_sessions(user_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ai_sessions_type_check'
  ) then
    alter table public.ai_sessions
      add constraint ai_sessions_type_check
      check (session_type in ('complaint_assist','routing_review'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'ai_sessions_privacy_mode_check'
  ) then
    alter table public.ai_sessions
      add constraint ai_sessions_privacy_mode_check
      check (privacy_mode in ('identified','confidential','anonymous'));
  end if;
end $$;

-- ai_recommendations ---------------------------------------------------------
create table if not exists public.ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid references public.complaints(id) on delete cascade,
  session_id uuid references public.ai_sessions(id) on delete set null,
  category_id uuid references public.complaint_categories(id),
  category_key text,
  category_confidence numeric not null,
  subcategory text,
  priority text not null,            -- low | medium | high | critical
  priority_confidence numeric not null,
  department_id uuid references public.departments(id),
  department_key text,
  department_confidence numeric not null,
  structured_draft text,
  overall_confidence numeric not null,
  model_used text,
  was_edited boolean not null default false,
  admin_override jsonb,              -- { category_id, priority, department_id, reason }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_recommendations_complaint_id_idx
  on public.ai_recommendations(complaint_id);
create index if not exists ai_recommendations_session_id_idx
  on public.ai_recommendations(session_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ai_recommendations_priority_check'
  ) then
    alter table public.ai_recommendations
      add constraint ai_recommendations_priority_check
      check (priority in ('low','medium','high','critical'));
  end if;
end $$;

-- Sprint 3 adds a department owner to complaints so routing decisions persist.
alter table public.complaints
  add column if not exists department_id uuid references public.departments(id);
alter table public.complaints
  add column if not exists assigned_to uuid references auth.users(id);

create index if not exists complaints_department_id_idx
  on public.complaints(department_id);
create index if not exists complaints_assigned_to_idx
  on public.complaints(assigned_to);

-- ============================================================================
-- 2. TRIGGERS
-- ============================================================================

drop trigger if exists ai_recommendations_touch_updated_at on public.ai_recommendations;
create trigger ai_recommendations_touch_updated_at
  before update on public.ai_recommendations
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================================

alter table public.departments        enable row level security;
alter table public.department_routing enable row level security;
alter table public.ai_sessions        enable row level security;
alter table public.ai_recommendations enable row level security;

-- departments: any signed-in user may read the active departments of their own
-- university (needed for the routing dropdowns and the student assistant).
drop policy if exists "departments_select_active" on public.departments;
create policy "departments_select_active"
  on public.departments for select
  using (
    is_active = true
    and university_id is not distinct from (
      select p.university_id from public.profiles p where p.id = auth.uid()
    )
  );

drop policy if exists "departments_service_all" on public.departments;
create policy "departments_service_all"
  on public.departments for all
  to service_role
  using (true) with check (true);

-- department_routing ---------------------------------------------------------
drop policy if exists "department_routing_select_active" on public.department_routing;
create policy "department_routing_select_active"
  on public.department_routing for select
  using (
    is_active = true
    and university_id is not distinct from (
      select p.university_id from public.profiles p where p.id = auth.uid()
    )
  );

drop policy if exists "department_routing_service_all" on public.department_routing;
create policy "department_routing_service_all"
  on public.department_routing for all
  to service_role
  using (true) with check (true);

-- ai_sessions: a user reads only their own sessions ---------------------------
drop policy if exists "ai_sessions_select_own" on public.ai_sessions;
create policy "ai_sessions_select_own"
  on public.ai_sessions for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "ai_sessions_service_all" on public.ai_sessions;
create policy "ai_sessions_service_all"
  on public.ai_sessions for all
  to service_role
  using (true) with check (true);

-- ai_recommendations ---------------------------------------------------------
-- Readable by:
--   * the reporting student (via can_read_complaint, which covers ownership)
--   * staff authorized to read that complaint (non-sensitive same-university
--     staff, or an explicitly assigned sensitive handler)
--   * the author of the originating session while it is not yet linked to a
--     complaint (draft state, complaint_id is null)
drop policy if exists "ai_recommendations_select" on public.ai_recommendations;
create policy "ai_recommendations_select"
  on public.ai_recommendations for select
  to authenticated
  using (
    (complaint_id is not null and public.can_read_complaint(complaint_id))
    or (
      complaint_id is null
      and session_id is not null
      and exists (
        select 1 from public.ai_sessions s
        where s.id = ai_recommendations.session_id
          and s.user_id = auth.uid()
      )
    )
  );

drop policy if exists "ai_recommendations_service_all" on public.ai_recommendations;
create policy "ai_recommendations_service_all"
  on public.ai_recommendations for all
  to service_role
  using (true) with check (true);

-- ============================================================================
-- 4. SEED: departments for every university
-- ============================================================================

with dept(key, name, description) as (
  values
    ('academic_affairs', 'Academic Affairs',
     'Curriculum, grading policy, faculty conduct and academic regulations.'),
    ('examinations', 'Examinations Office',
     'Exam conduct, result disputes, remarking and transcript corrections.'),
    ('student_affairs', 'Student Affairs',
     'General student welfare, societies, and anything without a clearer owner.'),
    ('facilities', 'Facilities Management',
     'Buildings, classrooms, labs, utilities, transport and cleanliness.'),
    ('hostel', 'Hostel Administration',
     'Room allocation, mess and food quality, hostel upkeep and curfew.'),
    ('finance', 'Finance Office',
     'Fee challans, scholarships, refunds, fines and billing corrections.'),
    ('administration', 'Central Administration',
     'Admissions, registration, documents and departmental office delays.'),
    ('safety_proctor', 'Proctorial & Safety Office',
     'Harassment, threats, physical safety and disciplinary investigations.'),
    ('counseling', 'Counseling & Wellbeing',
     'Mental health support, stress, burnout and counselling access.'),
    ('it_services', 'IT Services',
     'Portals, LMS, campus network, email accounts and lab computing.')
)
insert into public.departments (university_id, key, name, description, is_active)
select u.id, d.key, d.name, d.description, true
from public.universities u
cross join dept d
on conflict (university_id, key) do update set
  name        = excluded.name,
  description = excluded.description,
  is_active   = excluded.is_active;

-- ============================================================================
-- 5. SEED: category → department routing for every university
-- ============================================================================

with routing(category_key, department_key, priority) as (
  values
    ('academic',          'academic_affairs', 'medium'),
    ('facilities',        'facilities',       'medium'),
    ('hostel',            'hostel',           'medium'),
    ('financial',         'finance',          'medium'),
    ('administration',    'administration',   'medium'),
    ('safety_harassment', 'safety_proctor',   'high'),
    ('mental_health',     'counseling',       'high'),
    ('other',             'student_affairs',  'low')
)
insert into public.department_routing
  (university_id, category_key, department_key, priority, is_active)
select u.id, r.category_key, r.department_key, r.priority, true
from public.universities u
cross join routing r
on conflict (university_id, category_key) do update set
  department_key = excluded.department_key,
  priority       = excluded.priority,
  is_active      = excluded.is_active;

-- Examination-specific academic issues route to the Examinations Office. The
-- AI adapter emits the `examinations` department key directly for exam/result
-- wording, so the subcategory row below documents the second academic owner.
insert into public.department_routing
  (university_id, category_key, department_key, priority, is_active)
select u.id, 'academic_examinations', 'examinations', 'medium', true
from public.universities u
on conflict (university_id, category_key) do update set
  department_key = excluded.department_key,
  priority       = excluded.priority,
  is_active      = excluded.is_active;

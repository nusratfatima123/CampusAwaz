-- ============================================================================
-- CampusAwaz — Sprint 6 migration
-- Support Resources, Counseling, FAQ/Policy, Emergency Contacts & Analytics
-- Idempotent: safe to run multiple times.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. TABLES
-- ============================================================================

-- support_resources -------------------------------------------------------------------
-- University-curated mental health, rights, policy, and general support links.
create table if not exists public.support_resources (
  id uuid primary key default gen_random_uuid(),
  university_id uuid references public.universities(id) on delete cascade,
  resource_type text not null default 'general',
  title text not null,
  description text,
  url text,
  phone text,
  is_active boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists support_resources_university_idx
  on public.support_resources(university_id);
create index if not exists support_resources_type_idx
  on public.support_resources(resource_type);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'support_resources_type_check'
  ) then
    alter table public.support_resources
      add constraint support_resources_type_check
      check (resource_type in (
        'mental_health', 'student_rights', 'policy', 'faq', 'emergency', 'general'
      ));
  end if;
end $$;

-- counseling_requests -----------------------------------------------------------------
-- Anonymous counseling sessions. is_anonymous is always true by design.
create table if not exists public.counseling_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  university_id uuid not null references public.universities(id) on delete cascade,
  counselor_id uuid references auth.users(id),
  subject text not null,
  message text not null,
  status text not null default 'pending',
  is_anonymous boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists counseling_requests_student_idx
  on public.counseling_requests(student_id);
create index if not exists counseling_requests_counselor_idx
  on public.counseling_requests(counselor_id);
create index if not exists counseling_requests_university_idx
  on public.counseling_requests(university_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'counseling_requests_status_check'
  ) then
    alter table public.counseling_requests
      add constraint counseling_requests_status_check
      check (status in ('pending', 'assigned', 'in_progress', 'completed'));
  end if;
end $$;

-- faq_entries -------------------------------------------------------------------------
-- Approved FAQ content used to ground the AI FAQ assistant.
create table if not exists public.faq_entries (
  id uuid primary key default gen_random_uuid(),
  university_id uuid references public.universities(id) on delete cascade,
  question text not null,
  answer text not null,
  category_key text,
  source_url text,
  is_active boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists faq_entries_university_idx
  on public.faq_entries(university_id);
create index if not exists faq_entries_category_idx
  on public.faq_entries(category_key);

-- policies ----------------------------------------------------------------------------
-- University policy documents.
create table if not exists public.policies (
  id uuid primary key default gen_random_uuid(),
  university_id uuid references public.universities(id) on delete cascade,
  title text not null,
  description text,
  document_url text,
  category_key text,
  effective_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists policies_university_idx
  on public.policies(university_id);
create index if not exists policies_category_idx
  on public.policies(category_key);

-- emergency_contacts ------------------------------------------------------------------
-- Emergency phone numbers per university.
create table if not exists public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  university_id uuid references public.universities(id) on delete cascade,
  label text not null,
  phone text not null,
  description text,
  is_active boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists emergency_contacts_university_idx
  on public.emergency_contacts(university_id);

-- ============================================================================
-- 2. ANALYTICS VIEW (privacy-safe — no student identity)
-- ============================================================================

-- Aggregated complaint metrics. Never exposes student_id.
create or replace view public.analytics_complaint_summary as
select
  c.university_id,
  cc.key as category_key,
  cc.label as category_label,
  d.key as department_key,
  d.name as department_name,
  c.status,
  c.priority,
  count(*) as total,
  avg(
    case
      when c.status = 'resolved' then
        extract(epoch from (c.updated_at - c.submitted_at)) / 3600.0
      else null
    end
  ) as avg_resolution_hours
from public.complaints c
left join public.complaint_categories cc on cc.id = c.category_id
left join public.departments d on d.id = c.department_id
group by c.university_id, cc.key, cc.label, d.key, d.name, c.status, c.priority;

-- Escalation summary per university.
create or replace view public.analytics_escalation_summary as
select
  c.university_id,
  count(distinct e.id) as total_escalations,
  count(distinct c.id) as total_escalated_complaints,
  avg(e.level) as avg_escalation_level
from public.escalations e
join public.complaints c on c.id = e.complaint_id
group by c.university_id;

-- Feedback summary per university (no student identity).
create or replace view public.analytics_feedback_summary as
select
  c.university_id,
  count(f.id) as total_feedback,
  avg(f.rating) as avg_rating,
  count(f.id) filter (where f.rating >= 4) as positive_count,
  count(f.id) filter (where f.rating <= 2) as negative_count
from public.feedback f
join public.complaints c on c.id = f.complaint_id
group by c.university_id;

-- ============================================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================================

alter table public.support_resources enable row level security;
alter table public.counseling_requests enable row level security;
alter table public.faq_entries enable row level security;
alter table public.policies enable row level security;
alter table public.emergency_contacts enable row level security;

-- support_resources: all authenticated users at the university can read.
drop policy if exists "support_resources_select" on public.support_resources;
create policy "support_resources_select"
  on public.support_resources for select
  to authenticated
  using (
    is_active = true
    and (
      university_id is null
      or university_id = (
        select p.university_id from public.profiles p where p.id = auth.uid()
      )
    )
  );

drop policy if exists "support_resources_service_all" on public.support_resources;
create policy "support_resources_service_all"
  on public.support_resources for all
  to service_role
  using (true) with check (true);

-- counseling_requests: student sees own; counselor sees assigned; service_role ALL.
drop policy if exists "counseling_requests_select" on public.counseling_requests;
create policy "counseling_requests_select"
  on public.counseling_requests for select
  to authenticated
  using (
    student_id = auth.uid()
    or counselor_id = auth.uid()
    or exists (
      select 1 from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and r.name = 'counselor'
        and ur.university_id = counseling_requests.university_id
    )
  );

drop policy if exists "counseling_requests_insert_own" on public.counseling_requests;
create policy "counseling_requests_insert_own"
  on public.counseling_requests for insert
  to authenticated
  with check (student_id = auth.uid());

drop policy if exists "counseling_requests_counselor_update" on public.counseling_requests;
create policy "counseling_requests_counselor_update"
  on public.counseling_requests for update
  to authenticated
  using (
    counselor_id = auth.uid()
    or exists (
      select 1 from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and r.name = 'counselor'
        and ur.university_id = counseling_requests.university_id
    )
  )
  with check (
    counselor_id = auth.uid()
    or exists (
      select 1 from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and r.name = 'counselor'
        and ur.university_id = counseling_requests.university_id
    )
  );

drop policy if exists "counseling_requests_service_all" on public.counseling_requests;
create policy "counseling_requests_service_all"
  on public.counseling_requests for all
  to service_role
  using (true) with check (true);

-- faq_entries: all authenticated users at the university can read.
drop policy if exists "faq_entries_select" on public.faq_entries;
create policy "faq_entries_select"
  on public.faq_entries for select
  to authenticated
  using (
    is_active = true
    and (
      university_id is null
      or university_id = (
        select p.university_id from public.profiles p where p.id = auth.uid()
      )
    )
  );

drop policy if exists "faq_entries_service_all" on public.faq_entries;
create policy "faq_entries_service_all"
  on public.faq_entries for all
  to service_role
  using (true) with check (true);

-- policies: all authenticated users at the university can read.
drop policy if exists "policies_select" on public.policies;
create policy "policies_select"
  on public.policies for select
  to authenticated
  using (
    is_active = true
    and (
      university_id is null
      or university_id = (
        select p.university_id from public.profiles p where p.id = auth.uid()
      )
    )
  );

drop policy if exists "policies_service_all" on public.policies;
create policy "policies_service_all"
  on public.policies for all
  to service_role
  using (true) with check (true);

-- emergency_contacts: all authenticated users at the university can read.
drop policy if exists "emergency_contacts_select" on public.emergency_contacts;
create policy "emergency_contacts_select"
  on public.emergency_contacts for select
  to authenticated
  using (
    is_active = true
    and (
      university_id is null
      or university_id = (
        select p.university_id from public.profiles p where p.id = auth.uid()
      )
    )
  );

drop policy if exists "emergency_contacts_service_all" on public.emergency_contacts;
create policy "emergency_contacts_service_all"
  on public.emergency_contacts for all
  to service_role
  using (true) with check (true);

-- Analytics views: only service_role can query (admins access via API).
revoke all on public.analytics_complaint_summary from authenticated;
revoke all on public.analytics_escalation_summary from authenticated;
revoke all on public.analytics_feedback_summary from authenticated;

grant select on public.analytics_complaint_summary to service_role;
grant select on public.analytics_escalation_summary to service_role;
grant select on public.analytics_feedback_summary to service_role;

-- ============================================================================
-- 4. SEED DEFAULT SUPPORT RESOURCES
-- ============================================================================

-- Generic support resources available to all universities.
insert into public.support_resources (university_id, resource_type, title, description, url, phone, display_order)
select
  u.id,
  res.resource_type,
  res.title,
  res.description,
  res.url,
  res.phone,
  res.display_order
from public.universities u
cross join (
  values
    ('mental_health', 'Campus Counseling Center', 'Free confidential counseling for enrolled students', null, null, 1),
    ('mental_health', 'National Helpline (SAMHSA)', '24/7 free treatment referral and crisis support', 'https://www.samhsa.gov/find-help/national-helpline', '1-800-662-4357', 2),
    ('mental_health', 'Crisis Text Line', 'Text HOME to connect with a crisis counselor 24/7', 'https://www.crisistextline.org', 'Text HOME to 741741', 3),
    ('student_rights', 'Student Bill of Rights', 'Know your rights as a student at this university', null, null, 4),
    ('student_rights', 'Anti-Discrimination Policy', 'University policy on equal opportunity and non-discrimination', null, null, 5),
    ('general', 'Student Handbook', 'Comprehensive guide to university policies and procedures', null, null, 6),
    ('general', 'Academic Integrity Guidelines', 'Understanding academic honesty and plagiarism policies', null, null, 7)
) as res(resource_type, title, description, url, phone, display_order)
where not exists (
  select 1 from public.support_resources sr
  where sr.university_id = u.id
    and sr.title = res.title
);

-- Seed default emergency contacts.
insert into public.emergency_contacts (university_id, label, phone, description, display_order)
select
  u.id,
  ec.label,
  ec.phone,
  ec.description,
  ec.display_order
from public.universities u
cross join (
  values
    ('Campus Security', '911', 'For immediate safety threats on campus', 1),
    ('Campus Health Center', '', '24/7 medical emergencies', 2),
    ('Title IX Office', '', 'Report sexual misconduct or harassment', 3),
    ('Student Affairs Helpline', '', 'General student support and guidance', 4)
) as ec(label, phone, description, display_order)
where not exists (
  select 1 from public.emergency_contacts ec2
  where ec2.university_id = u.id
    and ec2.label = ec.label
);

-- Seed default FAQ entries.
insert into public.faq_entries (university_id, question, answer, category_key, display_order)
select
  u.id,
  faq.question,
  faq.answer,
  faq.category_key,
  faq.display_order
from public.universities u
cross join (
  values
    ('How do I file a complaint?', 'Go to the Dashboard, click "New Complaint", and follow the step-by-step form. You can choose your privacy level and attach evidence files.', 'complaints', 1),
    ('What privacy options are available?', 'You can file as identified (staff see your name), confidential (only assigned handlers see your identity), or anonymous (your identity is fully hidden behind an alias).', 'privacy', 2),
    ('How long does it take to resolve a complaint?', 'Resolution times vary by priority: Critical (24h), High (48h), Medium (72h), Low (7 days). Safety cases have shorter SLAs.', 'process', 3),
    ('Can I track my complaint?', 'Yes! After submission you receive a unique tracking ID. Use the Track page to see real-time status updates.', 'tracking', 4),
    ('What happens to my evidence files?', 'Files are stored in a secure private bucket. Only authorized handlers can access them through time-limited signed URLs.', 'privacy', 5),
    ('How do I request counseling?', 'Visit the Support page and click the Counseling tab. Your request is completely anonymous and will be handled by a trained counselor.', 'support', 6),
    ('What if my complaint is about harassment?', 'Harassment reports are automatically routed to the safety Proctor office with enhanced privacy protections. Only assigned safety officers can access your case.', 'safety', 7),
    ('Can I remain anonymous for a harassment report?', 'Yes. Anonymous mode is available for all complaint types including harassment. Your identity will never be revealed.', 'safety', 8)
) as faq(question, answer, category_key, display_order)
where not exists (
  select 1 from public.faq_entries fe
  where fe.university_id = u.id
    and fe.question = faq.question
);

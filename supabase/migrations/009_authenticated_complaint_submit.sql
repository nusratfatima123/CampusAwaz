-- ============================================================================
-- CampusAwaz — Migration 009
-- Allow authenticated (verified) students to submit complaints via RLS.
--
-- When the service_role key is unavailable, the admin client falls back to the
-- caller's authenticated session. These policies let that session perform the
-- minimum writes needed for complaint submission.
-- Idempotent: safe to run multiple times.
-- ============================================================================

-- ============================================================================
-- 1. TRACKING ID: allow authenticated callers to generate tracking IDs.
--    The function is security definer (runs as owner), so this is safe.
-- ============================================================================
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.generate_tracking_id(uuid, integer) to authenticated;
  end if;
end $$;

-- ============================================================================
-- 2. COMPLAINTS: students insert their own rows only.
-- ============================================================================
drop policy if exists "complaints_insert_own" on public.complaints;
create policy "complaints_insert_own"
  on public.complaints for insert
  to authenticated
  with check (student_id = auth.uid());

-- Students can update status on their own complaints (needed for sensitive
-- case auto-assignment which sets status = 'assigned').
drop policy if exists "complaints_update_own" on public.complaints;
create policy "complaints_update_own"
  on public.complaints for update
  to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- ============================================================================
-- 3. STATUS HISTORY: students insert for their own complaints.
-- ============================================================================
drop policy if exists "complaint_status_history_insert_own" on public.complaint_status_history;
create policy "complaint_status_history_insert_own"
  on public.complaint_status_history for insert
  to authenticated
  with check (
    exists (
      select 1 from public.complaints c
      where c.id = complaint_id and c.student_id = auth.uid()
    )
  );

-- ============================================================================
-- 4. PRIVACY: students insert and update their own row.
-- ============================================================================
drop policy if exists "complaint_privacy_insert_own" on public.complaint_privacy;
create policy "complaint_privacy_insert_own"
  on public.complaint_privacy for insert
  to authenticated
  with check (student_id = auth.uid());

drop policy if exists "complaint_privacy_update_own" on public.complaint_privacy;
create policy "complaint_privacy_update_own"
  on public.complaint_privacy for update
  to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- ============================================================================
-- 5. EVIDENCE: students insert for their own complaints.
-- ============================================================================
drop policy if exists "complaint_evidence_insert_own" on public.complaint_evidence;
create policy "complaint_evidence_insert_own"
  on public.complaint_evidence for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.complaints c
      where c.id = complaint_id and c.student_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. SENSITIVE CASE ACCESS: allow insert so the complaint flow can assign
--    handlers to sensitive cases (the caller must also be the complaint owner).
-- ============================================================================
drop policy if exists "sensitive_case_access_insert_own_complaint" on public.sensitive_case_access;
create policy "sensitive_case_access_insert_own_complaint"
  on public.sensitive_case_access for insert
  to authenticated
  with check (
    exists (
      select 1 from public.complaints c
      where c.id = complaint_id and c.student_id = auth.uid()
    )
  );

-- ============================================================================
-- 7. USER ROLES: allow authenticated users to read roles at their own
--    university so that sensitive handler resolution works without service_role.
-- ============================================================================
drop policy if exists "user_roles_select_same_university" on public.user_roles;
create policy "user_roles_select_same_university"
  on public.user_roles for select
  to authenticated
  using (
    university_id is not distinct from (
      select p.university_id from public.profiles p where p.id = auth.uid()
    )
  );

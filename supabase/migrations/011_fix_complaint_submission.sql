-- ============================================================================
-- CampusAwaz — Migration 011
-- Fix complaint submission: storage buckets + function permissions.
--
-- Root cause: when SUPABASE_SERVICE_ROLE_KEY is not configured (falls back to
-- the authenticated session), the complaint submission flow requires:
--   1. The complaint-evidence storage bucket to exist.
--   2. The resolution-evidence storage bucket to exist.
--   3. generate_tracking_id() to be callable by authenticated users.
--   4. Storage RLS policies to allow authenticated uploads.
--
-- This migration is idempotent — safe to run multiple times.
-- ============================================================================

-- ============================================================================
-- 1. TRACKING ID: ensure authenticated callers can generate tracking IDs.
--    The function is SECURITY DEFINER (runs as owner), so this is safe.
-- ============================================================================
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.generate_tracking_id(uuid, integer) to authenticated;
  end if;
end $$;

-- ============================================================================
-- 2. STORAGE BUCKETS: create both evidence buckets if they don't exist.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('complaint-evidence', 'complaint-evidence', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('resolution-evidence', 'resolution-evidence', false)
on conflict (id) do nothing;

-- ============================================================================
-- 3. COMPLAINT EVIDENCE: storage policies for authenticated users.
--    Path structure: {userId}/staged/... or {userId}/{complaintId}/...
-- ============================================================================
drop policy if exists "complaint_evidence_objects_insert_own" on storage.objects;
create policy "complaint_evidence_objects_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'complaint-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

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
-- 4. RESOLUTION EVIDENCE: storage policies for authenticated staff.
--    Path structure: {staffUserId}/{TRACKING_ID}/...
--    Staff can upload/read/delete within their own folder.
-- ============================================================================
drop policy if exists "resolution_evidence_objects_insert_own" on storage.objects;
create policy "resolution_evidence_objects_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'resolution-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "resolution_evidence_objects_select" on storage.objects;
create policy "resolution_evidence_objects_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'resolution-evidence'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1
        from public.resolution_evidence re
        where re.storage_path = storage.objects.name
          and public.can_read_complaint(re.complaint_id)
      )
    )
  );

drop policy if exists "resolution_evidence_objects_delete_own" on storage.objects;
create policy "resolution_evidence_objects_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'resolution-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- 5. SERVICE ROLE: ensure full access for both buckets (belt-and-suspenders).
-- ============================================================================
drop policy if exists "complaint_evidence_service_all" on storage.objects;
create policy "complaint_evidence_service_all"
  on storage.objects for all
  to service_role
  using (bucket_id = 'complaint-evidence')
  with check (bucket_id = 'complaint-evidence');

drop policy if exists "resolution_evidence_service_all" on storage.objects;
create policy "resolution_evidence_service_all"
  on storage.objects for all
  to service_role
  using (bucket_id = 'resolution-evidence')
  with check (bucket_id = 'resolution-evidence');

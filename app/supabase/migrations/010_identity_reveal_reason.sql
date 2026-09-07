-- ============================================================================
-- CampusAwaz — Sprint 8b: Authority Flow 2 — Reason for identity reveal
-- Adds a reason column so the assigned authority must justify why they need
-- the student's identity.  Idempotent.
-- ============================================================================

alter table public.identity_access_requests
  add column if not exists reason text;

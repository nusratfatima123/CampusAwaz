-- Migration 013: Add finance_officer and admin_officer roles
--
-- These roles handle financial and administration complaints respectively,
-- replacing the previous use of 'hod' for those categories.
--
-- INSTRUCTIONS: Paste this in the Supabase SQL Editor and run it.

INSERT INTO public.roles (name, description) VALUES
  ('finance_officer', 'Finance Officer — handles financial complaints'),
  ('admin_officer',   'Administration Officer — handles administration complaints')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

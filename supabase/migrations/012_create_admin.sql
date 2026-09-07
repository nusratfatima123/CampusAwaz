-- Migration 012: Assign admin role
-- 
-- The admin auth user (admin@campusawaz.edu / Admin@123) has already been
-- created via the Supabase Auth API. This migration assigns the admin role.
--
-- INSTRUCTIONS: Paste this in the Supabase SQL Editor and run it.

-- Replace student role with admin role for the admin user
DO $$
DECLARE
  v_admin_user_id uuid := '6fc0eb68-7cc4-4828-8834-23ec45104623';
  v_admin_role_id uuid;
  v_student_role_id uuid;
BEGIN
  SELECT id INTO v_admin_role_id FROM public.roles WHERE name = 'admin';
  SELECT id INTO v_student_role_id FROM public.roles WHERE name = 'student';
  
  -- Remove student role
  DELETE FROM public.user_roles
  WHERE user_id = v_admin_user_id AND role_id = v_student_role_id;
  
  -- Add admin role
  INSERT INTO public.user_roles (user_id, role_id, university_id)
  SELECT v_admin_user_id, v_admin_role_id, university_id
  FROM public.profiles
  WHERE id = v_admin_user_id
  ON CONFLICT (user_id, role_id) DO NOTHING;
  
  RAISE NOTICE 'Admin role assigned to user %', v_admin_user_id;
END $$;

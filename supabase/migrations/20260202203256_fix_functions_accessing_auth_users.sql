/*
  # Fix Functions Accessing auth.users
  
  1. Problem
    - is_admin_by_id() function joins with auth.users table
    - create_admin_user() function queries auth.users table
    - Even though they're SECURITY DEFINER, they cause permission errors when called from RLS
  
  2. Solution
    - Update is_admin_by_id() to use profiles table instead of auth.users
    - Update create_admin_user() to use profiles table instead of auth.users
  
  3. Security
    - Same security level maintained
    - Functions remain SECURITY DEFINER to bypass RLS
    - Using profiles.email instead of auth.users.email
*/

-- Fix is_admin_by_id to use profiles instead of auth.users
CREATE OR REPLACE FUNCTION public.is_admin_by_id(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_allowlist
    JOIN profiles ON profiles.email = admin_allowlist.email
    WHERE profiles.id = user_id
    AND admin_allowlist.is_active = true
  );
$$;

-- Fix create_admin_user to use profiles instead of auth.users
CREATE OR REPLACE FUNCTION public.create_admin_user(admin_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Check if profile exists with this email
  SELECT id INTO admin_user_id
  FROM profiles
  WHERE email = admin_email;

  IF admin_user_id IS NOT NULL THEN
    -- Update existing profile to admin role
    UPDATE profiles
    SET role = 'admin', updated_at = now()
    WHERE id = admin_user_id;

    RAISE NOTICE 'Admin user profile updated for: %', admin_email;
  ELSE
    RAISE NOTICE 'Profile does not exist for email: %. User must sign up first.', admin_email;
  END IF;
END;
$$;

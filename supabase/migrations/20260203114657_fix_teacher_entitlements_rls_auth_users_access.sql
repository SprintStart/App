/*
  # Fix Teacher Entitlements RLS - Remove auth.users Access
  
  1. Problem
    - Admin policies on teacher_entitlements were querying auth.users directly
    - This causes "permission denied for table users" errors from client-side
    
  2. Solution
    - Create a helper function `is_admin()` with SECURITY DEFINER
    - This function can safely access auth.users
    - Replace all admin policies to use this function
    
  3. Changes
    - Create `is_admin()` function
    - Drop existing admin policies on teacher_entitlements
    - Recreate policies using the safe helper function
*/

-- Create helper function to check if current user is admin
-- SECURITY DEFINER allows it to access auth.users safely
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Get the current user's email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = auth.uid();
  
  -- Check if this email is in the admin allowlist
  RETURN EXISTS (
    SELECT 1
    FROM admin_allowlist
    WHERE email = user_email
    AND is_active = true
  );
END;
$$;

-- Drop existing admin policies that have the auth.users issue
DROP POLICY IF EXISTS "Admins can view all entitlements" ON teacher_entitlements;
DROP POLICY IF EXISTS "Admins can insert entitlements" ON teacher_entitlements;
DROP POLICY IF EXISTS "Admins can update entitlements" ON teacher_entitlements;

-- Recreate admin policies using the safe helper function
CREATE POLICY "Admins can view all entitlements"
  ON teacher_entitlements
  FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can insert entitlements"
  ON teacher_entitlements
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update entitlements"
  ON teacher_entitlements
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

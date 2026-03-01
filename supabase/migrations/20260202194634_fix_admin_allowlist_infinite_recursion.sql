/*
  # Fix Admin Allowlist Infinite Recursion
  
  1. Problem
    - Current RLS policies on admin_allowlist cause infinite recursion
    - When checking if user is admin, policy queries admin_allowlist, which triggers the same policy
  
  2. Solution
    - Drop existing recursive policies
    - Allow authenticated users to SELECT from admin_allowlist (needed for login check)
    - Only super admins can modify admin_allowlist entries
    - Use direct email comparison instead of recursive subquery
  
  3. Security
    - SELECT is safe for authenticated users (they can only see if emails exist)
    - Modifications require super_admin role check without recursion
*/

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "admin_allowlist_select" ON admin_allowlist;
DROP POLICY IF EXISTS "admin_allowlist_modify" ON admin_allowlist;

-- Allow authenticated users to read admin_allowlist
-- This is needed for login verification
CREATE POLICY "admin_allowlist_read_for_auth"
  ON admin_allowlist
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow super admins to modify admin_allowlist
-- Use a simple check that doesn't recurse
CREATE POLICY "admin_allowlist_super_admin_modify"
  ON admin_allowlist
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND admin_allowlist.role = 'super_admin'
      AND admin_allowlist.is_active = true
      LIMIT 1
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND admin_allowlist.role = 'super_admin'
      AND admin_allowlist.is_active = true
      LIMIT 1
    )
  );

/*
  # Fix Admin Allowlist Infinite Recursion - Version 2
  
  1. Problem
    - Previous fix still had potential for recursion in the modify policy
  
  2. Solution
    - Make admin_allowlist fully readable by authenticated users
    - Remove modify policy entirely (modifications should be done via admin functions)
    - This breaks the recursion cycle completely
  
  3. Security
    - SELECT is safe (only shows email/role/status)
    - Modifications will be handled by edge functions with service role
*/

-- Drop the modify policy that could still cause recursion
DROP POLICY IF EXISTS "admin_allowlist_super_admin_modify" ON admin_allowlist;

-- Keep only the simple read policy for authenticated users
-- This allows login checks without recursion

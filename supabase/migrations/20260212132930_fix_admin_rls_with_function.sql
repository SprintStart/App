/*
  # Fix Admin RLS with Helper Function

  1. Issue
    - Complex nested queries in RLS policies causing 403 errors
    - HEAD requests for count operations are being blocked
  
  2. Solution
    - Create a simple helper function to check admin status
    - Use this function in a clean RLS policy
    - Ensure function has proper SECURITY DEFINER permissions
  
  3. Security
    - Only active admins in allowlist can view all quiz runs
*/

-- Drop existing problematic policy
DROP POLICY IF EXISTS "Admins can view all quiz runs" ON public_quiz_runs;

-- Create a clean helper function
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM admin_allowlist al
    INNER JOIN auth.users u ON u.email = al.email
    WHERE u.id = auth.uid()
    AND al.is_active = true
  );
$$;

-- Create simple, clean admin policy
CREATE POLICY "Admins can view all quiz runs"
ON public_quiz_runs
FOR SELECT
TO authenticated
USING (
  current_user_is_admin()
);
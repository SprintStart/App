/*
  # Fix Admin Dashboard Access to Quiz Runs

  1. Issue
    - Admin dashboard shows 0 plays even though 502 plays exist in public_quiz_runs
    - Missing SELECT policy for admins to view quiz runs data
  
  2. Changes
    - Add SELECT policy for admins to view all quiz runs for analytics
    - Add SELECT policy for authenticated users to view their own quiz runs
  
  3. Security
    - Admins can view all quiz runs for dashboard analytics
    - Regular authenticated users can only view their own quiz runs
    - Anonymous users can still view anonymous quiz runs
*/

-- Allow admins to view all quiz runs for dashboard analytics
CREATE POLICY "Admins can view all quiz runs for analytics"
ON public_quiz_runs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_allowlist
    WHERE admin_allowlist.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND admin_allowlist.is_active = true
  )
);

-- Allow authenticated users to view their own quiz runs
CREATE POLICY "Authenticated users can view own quiz runs"
ON public_quiz_runs
FOR SELECT
TO authenticated
USING (
  quiz_session_id IN (
    SELECT id FROM quiz_sessions
    WHERE user_id = auth.uid()
  )
);
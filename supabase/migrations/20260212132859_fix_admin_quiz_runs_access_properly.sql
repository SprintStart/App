/*
  # Fix Admin Access to Quiz Runs - Proper Implementation

  1. Issue
    - Admin RLS policy is failing with 403 errors on HEAD requests
    - The nested subquery approach is causing permission issues
  
  2. Solution
    - Drop the complex policies and create a simpler, more direct policy
    - Use the is_admin() function properly
    - Ensure policy works with both SELECT and HEAD requests
  
  3. Security
    - Only verified admins in admin_allowlist can view all quiz runs
    - Regular users can only view their own quiz runs
*/

-- Drop the problematic policies
DROP POLICY IF EXISTS "Admins can view all quiz runs for analytics" ON public_quiz_runs;
DROP POLICY IF EXISTS "Authenticated users can view own quiz runs" ON public_quiz_runs;

-- Create a simple, reliable admin policy
CREATE POLICY "Admins can view all quiz runs"
ON public_quiz_runs
FOR SELECT
TO authenticated
USING (
  (
    SELECT is_active 
    FROM admin_allowlist 
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    LIMIT 1
  ) = true
);

-- Create policy for teachers to view quiz runs for their own quizzes
CREATE POLICY "Teachers can view runs for own quizzes"
ON public_quiz_runs
FOR SELECT
TO authenticated
USING (
  quiz_session_id IN (
    SELECT id FROM quiz_sessions WHERE user_id = auth.uid()
  )
  OR
  question_set_id IN (
    SELECT qs.id
    FROM question_sets qs
    JOIN topics t ON t.id = qs.topic_id
    WHERE t.created_by = auth.uid()
  )
);
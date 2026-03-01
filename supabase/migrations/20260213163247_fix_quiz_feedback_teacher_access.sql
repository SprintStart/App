/*
  # Fix Quiz Feedback Access for Teachers

  ## Issue
  Teachers cannot see feedback on their dashboard due to restrictive RLS policy
  The existing policy blocks SECURITY DEFINER functions from accessing feedback data

  ## Changes
  1. Update quiz_feedback SELECT policy to allow teachers to view feedback for their own quizzes
  2. Simplify the policy to work with SECURITY DEFINER functions

  ## Security
  - Teachers can only view feedback for quizzes they created
  - Admins can view all feedback
  - Public can insert feedback (already working)
*/

-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "View quiz feedback restrictive" ON quiz_feedback;

-- Create a new, clearer SELECT policy for teachers and admins
CREATE POLICY "Teachers can view feedback for own quizzes"
  ON quiz_feedback
  FOR SELECT
  TO authenticated
  USING (
    -- Allow if user is admin
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND admin_allowlist.is_active = true
    )
    OR
    -- Allow if user created the quiz
    EXISTS (
      SELECT 1 FROM question_sets
      WHERE question_sets.id = quiz_feedback.quiz_id
      AND question_sets.created_by = auth.uid()
    )
  );

-- Also add a policy for service role to bypass RLS entirely
-- This allows SECURITY DEFINER functions to work properly
CREATE POLICY "Service role can view all feedback"
  ON quiz_feedback
  FOR SELECT
  TO service_role
  USING (true);

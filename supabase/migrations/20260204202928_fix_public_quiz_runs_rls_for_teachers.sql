/*
  # Fix RLS on public_quiz_runs to Allow Teacher Access via question_set_id

  ## Problem
  The teacher_quiz_performance view joins public_quiz_runs by question_set_id,
  but the RLS policy on public_quiz_runs only checks topic_id. This causes the
  view to return no data for teachers when accessed via the frontend.

  ## Solution
  Update the SELECT policy on public_quiz_runs to also allow teachers to see
  quiz runs for their question_sets (not just their topics).

  ## What This Fixes
  - Overview page "Quiz Performance" section will show data
  - Reports page will show accurate statistics
  - Analytics page will load correctly
*/

-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "public_quiz_runs_select_all" ON public_quiz_runs;

-- Create new policy that checks both topic_id AND question_set_id
CREATE POLICY "public_quiz_runs_select_all"
  ON public_quiz_runs FOR SELECT
  TO authenticated
  USING (
    -- Users can see their own quiz runs
    quiz_session_id IN (
      SELECT id FROM quiz_sessions
      WHERE user_id = auth.uid()
    )
    -- Teachers can see runs for their topics
    OR EXISTS (
      SELECT 1 FROM topics t
      WHERE t.id = public_quiz_runs.topic_id
      AND t.created_by = auth.uid()
    )
    -- Teachers can see runs for their question_sets
    OR EXISTS (
      SELECT 1 FROM question_sets qs
      WHERE qs.id = public_quiz_runs.question_set_id
      AND qs.created_by = auth.uid()
    )
    -- Admins can see everything
    OR is_admin()
  );

-- Also allow anonymous users to see anonymous runs
DROP POLICY IF EXISTS "Anonymous users can view anonymous quiz runs" ON public_quiz_runs;
CREATE POLICY "Anonymous users can view anonymous quiz runs"
  ON public_quiz_runs FOR SELECT
  TO anon
  USING (quiz_session_id IS NULL);

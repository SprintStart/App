/*
  # Fix Security Issues - Part 4: Fix public_quiz_runs RLS

  ## Purpose
  Fix auth.uid() initialization in public_quiz_runs policy.

  ## Changes
  - Wrap auth.uid() with (select auth.uid())
  - Maintains existing access control logic
*/

DROP POLICY IF EXISTS "View quiz runs" ON public_quiz_runs;

CREATE POLICY "View quiz runs"
  ON public_quiz_runs FOR SELECT
  USING (
    current_user_is_admin() OR
    quiz_session_id IS NULL OR
    quiz_session_id IN (
      SELECT id 
      FROM quiz_sessions 
      WHERE user_id = (select auth.uid())
    ) OR
    question_set_id IN (
      SELECT qs.id 
      FROM question_sets qs
      JOIN topics t ON t.id = qs.topic_id
      WHERE t.created_by = (select auth.uid())
    )
  );

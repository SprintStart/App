/*
  # Security Fix Part 2: RLS Auth Optimization

  ## What This Does
  - Optimizes RLS policies by wrapping auth.uid() in SELECT
  - Prevents re-evaluation of auth.uid() for each row
  - Improves query performance at scale
*/

-- Fix quiz_play_sessions policy
DROP POLICY IF EXISTS "Update play sessions with validation" ON quiz_play_sessions;
CREATE POLICY "Update play sessions with validation"
  ON quiz_play_sessions FOR UPDATE
  TO authenticated
  USING (
    player_id = (SELECT auth.uid())
    OR (player_id IS NULL AND id IS NOT NULL)
  )
  WITH CHECK (
    total_questions > 0
    AND (correct_count IS NULL OR correct_count <= total_questions)
    AND (wrong_count IS NULL OR wrong_count <= total_questions)
    AND (score IS NULL OR score >= 0)
  );

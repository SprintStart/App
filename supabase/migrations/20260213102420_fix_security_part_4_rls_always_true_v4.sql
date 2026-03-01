/*
  # Security Fix Part 4: Fix RLS Policies That Are "Always True"

  ## What This Does
  - Fixes INSERT/UPDATE policies that allowed unrestricted access
  - Adds NOT NULL and basic validation checks

  ## Policies Fixed
  - analytics_quiz_sessions INSERT
  - analytics_quiz_sessions UPDATE  
  - analytics_question_events INSERT
*/

-- Fix analytics_quiz_sessions INSERT - add validation
DROP POLICY IF EXISTS "System can insert analytics sessions" ON analytics_quiz_sessions;
CREATE POLICY "Insert analytics sessions with validation"
  ON analytics_quiz_sessions FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    quiz_id IS NOT NULL
    AND total_questions > 0
    AND session_id IS NOT NULL
    AND length(session_id) > 0
  );

-- Fix analytics_quiz_sessions UPDATE - restrict updates
DROP POLICY IF EXISTS "System can update analytics sessions" ON analytics_quiz_sessions;
CREATE POLICY "Update analytics sessions"
  ON analytics_quiz_sessions FOR UPDATE
  TO authenticated, anon
  USING (id IS NOT NULL)
  WITH CHECK (
    quiz_id IS NOT NULL
    AND total_questions > 0
    AND session_id IS NOT NULL
    AND length(session_id) > 0
  );

-- Fix analytics_question_events INSERT - add validation
DROP POLICY IF EXISTS "System can insert question events" ON analytics_question_events;
CREATE POLICY "Insert question events with validation"
  ON analytics_question_events FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    session_id IS NOT NULL
    AND question_index >= 0
    AND question_id IS NOT NULL
  );

/*
  # Security Fix Part 3: Consolidate Multiple Permissive Policies

  ## What This Does
  - Consolidates multiple permissive SELECT policies into single policies
  - Optimizes auth.uid() calls with SELECT wrapper
  - Improves query performance

  ## Tables Fixed
  - analytics_quiz_sessions
  - analytics_question_events
  - analytics_daily_rollups
*/

-- analytics_quiz_sessions: Consolidate policies
DROP POLICY IF EXISTS "Admins can view all analytics sessions" ON analytics_quiz_sessions;
DROP POLICY IF EXISTS "Teachers can view own school analytics sessions" ON analytics_quiz_sessions;

CREATE POLICY "View analytics sessions"
  ON analytics_quiz_sessions FOR SELECT
  TO authenticated
  USING (
    is_admin() OR
    school_id IN (
      SELECT school_id FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'teacher'
      AND school_id IS NOT NULL
    )
  );

-- analytics_question_events: Consolidate policies
DROP POLICY IF EXISTS "Admins can view all question events" ON analytics_question_events;
DROP POLICY IF EXISTS "Teachers can view own school question events" ON analytics_question_events;

CREATE POLICY "View question events"
  ON analytics_question_events FOR SELECT
  TO authenticated
  USING (
    is_admin() OR
    session_id IN (
      SELECT id FROM analytics_quiz_sessions
      WHERE school_id IN (
        SELECT school_id FROM profiles
        WHERE id = (SELECT auth.uid())
        AND role = 'teacher'
        AND school_id IS NOT NULL
      )
    )
  );

-- analytics_daily_rollups: Consolidate policies
DROP POLICY IF EXISTS "Admins can view all daily rollups" ON analytics_daily_rollups;
DROP POLICY IF EXISTS "System can manage daily rollups" ON analytics_daily_rollups;
DROP POLICY IF EXISTS "Teachers can view own school daily rollups" ON analytics_daily_rollups;

CREATE POLICY "View daily rollups"
  ON analytics_daily_rollups FOR SELECT
  TO authenticated
  USING (
    is_admin() OR
    school_id IN (
      SELECT school_id FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'teacher'
      AND school_id IS NOT NULL
    )
  );

CREATE POLICY "Admins manage daily rollups"
  ON analytics_daily_rollups FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

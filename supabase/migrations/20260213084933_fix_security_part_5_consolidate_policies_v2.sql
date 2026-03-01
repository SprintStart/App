/*
  # Fix Security Issues - Part 5: Consolidate Multiple Permissive Policies

  ## Purpose
  Replace multiple permissive policies with single restrictive policies.

  ## Changes
  - Consolidate 6 tables with multiple permissive policies
  - Use current_user_is_admin() function for admin checks
  - Improves security and performance
*/

-- countries: Consolidate into one restrictive policy
DROP POLICY IF EXISTS "Admins can view all countries" ON countries;
DROP POLICY IF EXISTS "Public can view active countries" ON countries;

CREATE POLICY "View countries restrictive" ON countries FOR SELECT
  USING (is_active = true OR current_user_is_admin());

-- exam_systems: Consolidate into one restrictive policy
DROP POLICY IF EXISTS "Admins can view all exam systems" ON exam_systems;
DROP POLICY IF EXISTS "Public can view active exam systems" ON exam_systems;

CREATE POLICY "View exam systems restrictive" ON exam_systems FOR SELECT
  USING (is_active = true OR current_user_is_admin());

-- quiz_feedback: Consolidate into one restrictive policy
DROP POLICY IF EXISTS "Admins can view all feedback" ON quiz_feedback;
DROP POLICY IF EXISTS "Teachers can view feedback for their quizzes" ON quiz_feedback;

CREATE POLICY "View quiz feedback restrictive" ON quiz_feedback FOR SELECT TO authenticated
  USING (
    current_user_is_admin() OR
    quiz_id IN (SELECT id FROM question_sets WHERE created_by = (select auth.uid()))
  );

-- quiz_play_sessions: Consolidate into one restrictive policy
DROP POLICY IF EXISTS "Admins can view all play sessions" ON quiz_play_sessions;
DROP POLICY IF EXISTS "Teachers can view sessions for their quizzes" ON quiz_play_sessions;
DROP POLICY IF EXISTS "Users can view own play sessions" ON quiz_play_sessions;

CREATE POLICY "View play sessions restrictive" ON quiz_play_sessions FOR SELECT TO authenticated
  USING (
    player_id = (select auth.uid()) OR
    quiz_id IN (SELECT id FROM question_sets WHERE created_by = (select auth.uid())) OR
    current_user_is_admin()
  );

-- quiz_session_events: Consolidate into one restrictive policy
DROP POLICY IF EXISTS "Admins can view all session events" ON quiz_session_events;
DROP POLICY IF EXISTS "Teachers can view events for their quiz sessions" ON quiz_session_events;
DROP POLICY IF EXISTS "Users can view events for their sessions" ON quiz_session_events;

CREATE POLICY "View session events restrictive" ON quiz_session_events FOR SELECT TO authenticated
  USING (
    session_id IN (SELECT id FROM quiz_play_sessions WHERE player_id = (select auth.uid())) OR
    quiz_id IN (SELECT id FROM question_sets WHERE created_by = (select auth.uid())) OR
    current_user_is_admin()
  );

-- schools: Consolidate into one restrictive policy
DROP POLICY IF EXISTS "Admins can view all schools" ON schools;
DROP POLICY IF EXISTS "Public can view active schools" ON schools;

CREATE POLICY "View schools restrictive" ON schools FOR SELECT
  USING (is_active = true OR current_user_is_admin());

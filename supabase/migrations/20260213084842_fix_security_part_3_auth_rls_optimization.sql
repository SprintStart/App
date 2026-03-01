/*
  # Fix Security Issues - Part 3: Auth RLS Optimization

  ## Purpose
  Wrap auth.uid() calls with (select auth.uid()) to prevent per-row re-evaluation.

  ## Changes
  - Fix 11 RLS policies that call auth.uid() directly
  - Improves RLS performance at scale
*/

-- quiz_play_sessions
DROP POLICY IF EXISTS "Users can view own play sessions" ON quiz_play_sessions;
CREATE POLICY "Users can view own play sessions"
  ON quiz_play_sessions FOR SELECT TO authenticated
  USING (player_id = (select auth.uid()));

DROP POLICY IF EXISTS "Teachers can view sessions for their quizzes" ON quiz_play_sessions;
CREATE POLICY "Teachers can view sessions for their quizzes"
  ON quiz_play_sessions FOR SELECT TO authenticated
  USING (quiz_id IN (SELECT id FROM question_sets WHERE created_by = (select auth.uid())));

-- quiz_session_events
DROP POLICY IF EXISTS "Users can view events for their sessions" ON quiz_session_events;
CREATE POLICY "Users can view events for their sessions"
  ON quiz_session_events FOR SELECT TO authenticated
  USING (session_id IN (SELECT id FROM quiz_play_sessions WHERE player_id = (select auth.uid())));

DROP POLICY IF EXISTS "Teachers can view events for their quiz sessions" ON quiz_session_events;
CREATE POLICY "Teachers can view events for their quiz sessions"
  ON quiz_session_events FOR SELECT TO authenticated
  USING (quiz_id IN (SELECT id FROM question_sets WHERE created_by = (select auth.uid())));

-- quiz_feedback
DROP POLICY IF EXISTS "Teachers can view feedback for their quizzes" ON quiz_feedback;
CREATE POLICY "Teachers can view feedback for their quizzes"
  ON quiz_feedback FOR SELECT TO authenticated
  USING (quiz_id IN (SELECT id FROM question_sets WHERE created_by = (select auth.uid())));

-- teacher_review_prompts
DROP POLICY IF EXISTS "Teachers can view own review prompts" ON teacher_review_prompts;
CREATE POLICY "Teachers can view own review prompts"
  ON teacher_review_prompts FOR SELECT TO authenticated
  USING (teacher_id = (select auth.uid()));

DROP POLICY IF EXISTS "Teachers can insert own review prompts" ON teacher_review_prompts;
CREATE POLICY "Teachers can insert own review prompts"
  ON teacher_review_prompts FOR INSERT TO authenticated
  WITH CHECK (teacher_id = (select auth.uid()));

DROP POLICY IF EXISTS "Teachers can update own review prompts" ON teacher_review_prompts;
CREATE POLICY "Teachers can update own review prompts"
  ON teacher_review_prompts FOR UPDATE TO authenticated
  USING (teacher_id = (select auth.uid()));

-- support_ticket_messages
DROP POLICY IF EXISTS "Create ticket messages" ON support_ticket_messages;
CREATE POLICY "Create ticket messages"
  ON support_ticket_messages FOR INSERT TO authenticated
  WITH CHECK (ticket_id IN (SELECT id FROM support_tickets WHERE created_by_user_id = (select auth.uid())));

DROP POLICY IF EXISTS "View ticket messages" ON support_ticket_messages;
CREATE POLICY "View ticket messages"
  ON support_ticket_messages FOR SELECT TO authenticated
  USING (ticket_id IN (SELECT id FROM support_tickets WHERE created_by_user_id = (select auth.uid())));

-- support_tickets
DROP POLICY IF EXISTS "View support tickets" ON support_tickets;
CREATE POLICY "View support tickets"
  ON support_tickets FOR SELECT TO authenticated
  USING (created_by_user_id = (select auth.uid()));

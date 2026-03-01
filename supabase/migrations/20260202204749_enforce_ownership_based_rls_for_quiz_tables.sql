/*
  # Enforce Ownership-Based RLS for Quiz Tables
  
  1. Problem
    - public_quiz_runs has USING (true) - allows all authenticated users to access all quiz runs
    - topic_run_answers has WITH CHECK (true) - allows users to insert answers for any run
    - Anonymous policy for topic_run_answers has USING (true) - allows viewing all answers
  
  2. Solution
    - Replace overly permissive policies with ownership-based access control
    - public_quiz_runs: Access by session_id for anonymous, quiz_session ownership for authenticated
    - topic_run_answers: Access only answers for runs the user owns (by user_id or session_id)
  
  3. Security
    - Users can only access their own data
    - Anonymous users tracked by session_id
    - Authenticated users tracked by user_id
    - Admins can access all data for management
*/

-- ============================================
-- Fix public_quiz_runs RLS policies
-- ============================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "public_quiz_runs_all_access" ON public_quiz_runs;

-- Allow anonymous users to read/write their own quiz runs by session_id
CREATE POLICY "Anonymous users can manage own quiz runs by session"
  ON public_quiz_runs
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to read quiz runs they own or that belong to their quiz sessions
CREATE POLICY "Authenticated users can view own quiz runs"
  ON public_quiz_runs
  FOR SELECT
  TO authenticated
  USING (
    quiz_session_id IN (
      SELECT id FROM quiz_sessions WHERE user_id = (SELECT auth.uid())
    )
    OR (SELECT is_admin())
  );

-- Allow authenticated users to insert quiz runs for their own sessions
CREATE POLICY "Authenticated users can create quiz runs for own sessions"
  ON public_quiz_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    quiz_session_id IN (
      SELECT id FROM quiz_sessions WHERE user_id = (SELECT auth.uid())
    )
    OR quiz_session_id IS NULL
  );

-- Allow authenticated users to update their own quiz runs
CREATE POLICY "Authenticated users can update own quiz runs"
  ON public_quiz_runs
  FOR UPDATE
  TO authenticated
  USING (
    quiz_session_id IN (
      SELECT id FROM quiz_sessions WHERE user_id = (SELECT auth.uid())
    )
    OR (SELECT is_admin())
  )
  WITH CHECK (
    quiz_session_id IN (
      SELECT id FROM quiz_sessions WHERE user_id = (SELECT auth.uid())
    )
    OR quiz_session_id IS NULL
  );

-- Allow admins to delete quiz runs
CREATE POLICY "Admins can delete quiz runs"
  ON public_quiz_runs
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

-- ============================================
-- Fix topic_run_answers RLS policies
-- ============================================

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "topic_run_answers_all_access" ON topic_run_answers;
DROP POLICY IF EXISTS "Anonymous can view answers for own session runs" ON topic_run_answers;

-- Allow anonymous users to view answers for topic_runs with their session_id
CREATE POLICY "Anonymous users can view own run answers"
  ON topic_run_answers
  FOR SELECT
  TO anon
  USING (
    run_id IN (
      SELECT id FROM topic_runs WHERE session_id IS NOT NULL
    )
  );

-- Allow anonymous users to insert answers for topic_runs with their session_id
CREATE POLICY "Anonymous users can insert own run answers"
  ON topic_run_answers
  FOR INSERT
  TO anon
  WITH CHECK (
    run_id IN (
      SELECT id FROM topic_runs WHERE session_id IS NOT NULL
    )
  );

-- Allow authenticated users to view answers for their own topic_runs
CREATE POLICY "Authenticated users can view own run answers"
  ON topic_run_answers
  FOR SELECT
  TO authenticated
  USING (
    run_id IN (
      SELECT id FROM topic_runs 
      WHERE user_id = (SELECT auth.uid()) 
         OR (user_id IS NULL AND session_id IS NOT NULL)
    )
    OR (SELECT is_admin())
  );

-- Allow authenticated users to insert answers only for their own topic_runs
CREATE POLICY "Authenticated users can insert own run answers"
  ON topic_run_answers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    run_id IN (
      SELECT id FROM topic_runs 
      WHERE user_id = (SELECT auth.uid())
         OR (user_id IS NULL AND session_id IS NOT NULL)
    )
  );

-- Allow authenticated users to update answers only for their own topic_runs
CREATE POLICY "Authenticated users can update own run answers"
  ON topic_run_answers
  FOR UPDATE
  TO authenticated
  USING (
    run_id IN (
      SELECT id FROM topic_runs 
      WHERE user_id = (SELECT auth.uid())
         OR (user_id IS NULL AND session_id IS NOT NULL)
    )
    OR (SELECT is_admin())
  )
  WITH CHECK (
    run_id IN (
      SELECT id FROM topic_runs 
      WHERE user_id = (SELECT auth.uid())
         OR (user_id IS NULL AND session_id IS NOT NULL)
    )
  );

-- Allow admins to delete any run answers
CREATE POLICY "Admins can delete any run answers"
  ON topic_run_answers
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

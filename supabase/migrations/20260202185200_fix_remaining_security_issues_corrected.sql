/*
  # Fix Remaining Security Issues - Corrected

  **Date:** 2nd February 2026
  **Type:** Security hardening - final pass

  ## Changes

  1. Add 5 missing foreign key indexes
  2. Remove duplicate index
  3. Fix Auth RLS performance (wrap auth functions)
  4. Consolidate multiple permissive policies
  5. Fix remaining overly broad policies
*/

-- ============================================================================
-- SECTION 1: ADD MISSING FOREIGN KEY INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_admin_allowlist_created_by ON admin_allowlist(created_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_admin_id ON audit_logs(actor_admin_id);
CREATE INDEX IF NOT EXISTS idx_school_domains_created_by ON school_domains(created_by);
CREATE INDEX IF NOT EXISTS idx_school_licenses_created_by ON school_licenses(created_by);
CREATE INDEX IF NOT EXISTS idx_schools_created_by ON schools(created_by);

-- ============================================================================
-- SECTION 2: REMOVE DUPLICATE INDEX
-- ============================================================================

DROP INDEX IF EXISTS idx_teacher_school_membership_teacher;

-- ============================================================================
-- SECTION 3: FIX AUTH RLS PERFORMANCE ISSUES
-- ============================================================================

-- profiles: Wrap auth.uid() with SELECT for performance
DROP POLICY IF EXISTS "profiles_select" ON profiles;

CREATE POLICY "profiles_select"
  ON profiles
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

-- quiz_sessions: Wrap auth.uid() with SELECT
DROP POLICY IF EXISTS "quiz_sessions_update" ON quiz_sessions;
DROP POLICY IF EXISTS "quiz_sessions_delete" ON quiz_sessions;

CREATE POLICY "quiz_sessions_update"
  ON quiz_sessions
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "quiz_sessions_delete"
  ON quiz_sessions
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- SECTION 4: FIX OVERLY BROAD POLICIES
-- ============================================================================

-- Remove "Update quiz runs" - quiz runs should be immutable
DROP POLICY IF EXISTS "Update quiz runs" ON public_quiz_runs;

-- Remove "Manage quiz sessions" - too broad (allows ALL with USING true)
DROP POLICY IF EXISTS "Manage quiz sessions" ON quiz_sessions;

-- ============================================================================
-- SECTION 5: CONSOLIDATE MULTIPLE PERMISSIVE POLICIES
-- ============================================================================

-- Helper function for admin check (used in many policies)
-- Checks if user's email is in admin_allowlist with is_active = true

-- ============================================================================
-- admin_allowlist
-- ============================================================================
DROP POLICY IF EXISTS "Only super_admins can modify allowlist" ON admin_allowlist;
DROP POLICY IF EXISTS "Only super_admins can view allowlist" ON admin_allowlist;

CREATE POLICY "admin_allowlist_select"
  ON admin_allowlist
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
      AND role = 'super_admin'
      AND is_active = true
    )
  );

CREATE POLICY "admin_allowlist_modify"
  ON admin_allowlist
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
      AND role = 'super_admin'
      AND is_active = true
    )
  );

-- ============================================================================
-- profiles
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
-- "profiles_select" already recreated above

-- ============================================================================
-- public_quiz_answers
-- ============================================================================
DROP POLICY IF EXISTS "Admins can manage public quiz answers" ON public_quiz_answers;
DROP POLICY IF EXISTS "Deny direct insert on public_quiz_answers" ON public_quiz_answers;
DROP POLICY IF EXISTS "View quiz answers" ON public_quiz_answers;

CREATE POLICY "public_quiz_answers_admin"
  ON public_quiz_answers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
      AND is_active = true
    )
  );

CREATE POLICY "public_quiz_answers_select"
  ON public_quiz_answers
  FOR SELECT
  TO public
  USING (true);

-- ============================================================================
-- public_quiz_runs
-- ============================================================================
DROP POLICY IF EXISTS "Admins can manage public quiz runs" ON public_quiz_runs;
DROP POLICY IF EXISTS "Deny direct insert on public_quiz_runs" ON public_quiz_runs;
DROP POLICY IF EXISTS "View quiz runs" ON public_quiz_runs;

CREATE POLICY "public_quiz_runs_admin"
  ON public_quiz_runs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
      AND is_active = true
    )
  );

-- ============================================================================
-- question_sets
-- ============================================================================
DROP POLICY IF EXISTS "Admins can manage all question sets" ON question_sets;
DROP POLICY IF EXISTS "Manage question sets" ON question_sets;

CREATE POLICY "question_sets_admin"
  ON question_sets
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
      AND is_active = true
    )
  );

CREATE POLICY "question_sets_teacher"
  ON question_sets
  FOR ALL
  TO authenticated
  USING ((select auth.uid()) = created_by)
  WITH CHECK ((select auth.uid()) = created_by);

-- ============================================================================
-- quiz_sessions
-- ============================================================================
DROP POLICY IF EXISTS "Admins can manage quiz sessions" ON quiz_sessions;

CREATE POLICY "quiz_sessions_admin"
  ON quiz_sessions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
      AND is_active = true
    )
  );

-- ============================================================================
-- schools
-- ============================================================================
DROP POLICY IF EXISTS "Admins can manage schools" ON schools;
DROP POLICY IF EXISTS "View schools" ON schools;

CREATE POLICY "schools_admin"
  ON schools
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
      AND is_active = true
    )
  );

CREATE POLICY "schools_select"
  ON schools
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teacher_school_membership
      WHERE teacher_school_membership.school_id = schools.id
      AND teacher_school_membership.teacher_id = (SELECT auth.uid())
    )
  );

-- ============================================================================
-- sponsored_ads
-- ============================================================================
DROP POLICY IF EXISTS "Admins can manage sponsored ads" ON sponsored_ads;
DROP POLICY IF EXISTS "View active ads" ON sponsored_ads;

CREATE POLICY "sponsored_ads_admin"
  ON sponsored_ads
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
      AND is_active = true
    )
  );

CREATE POLICY "sponsored_ads_select"
  ON sponsored_ads
  FOR SELECT
  TO public
  USING (is_active = true);

-- ============================================================================
-- subscriptions
-- ============================================================================
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Manage subscriptions" ON subscriptions;

CREATE POLICY "subscriptions_admin"
  ON subscriptions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
      AND is_active = true
    )
  );

CREATE POLICY "subscriptions_user"
  ON subscriptions
  FOR ALL
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- teacher_school_membership
-- ============================================================================
DROP POLICY IF EXISTS "Admins can manage memberships" ON teacher_school_membership;
DROP POLICY IF EXISTS "Teachers can view own membership" ON teacher_school_membership;

CREATE POLICY "teacher_school_membership_admin"
  ON teacher_school_membership
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
      AND is_active = true
    )
  );

CREATE POLICY "teacher_school_membership_select"
  ON teacher_school_membership
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = teacher_id);

-- ============================================================================
-- topic_questions
-- ============================================================================
DROP POLICY IF EXISTS "Admins can manage all questions" ON topic_questions;
DROP POLICY IF EXISTS "Manage questions" ON topic_questions;

CREATE POLICY "topic_questions_admin"
  ON topic_questions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
      AND is_active = true
    )
  );

CREATE POLICY "topic_questions_teacher"
  ON topic_questions
  FOR ALL
  TO authenticated
  USING ((select auth.uid()) = created_by)
  WITH CHECK ((select auth.uid()) = created_by);

-- ============================================================================
-- topic_run_answers
-- ============================================================================
DROP POLICY IF EXISTS "Admins can view all answers" ON topic_run_answers;
DROP POLICY IF EXISTS "View run answers" ON topic_run_answers;

CREATE POLICY "topic_run_answers_admin"
  ON topic_run_answers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
      AND is_active = true
    )
  );

CREATE POLICY "topic_run_answers_select"
  ON topic_run_answers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM topic_runs
      WHERE topic_runs.id = topic_run_answers.run_id
      AND topic_runs.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- topic_runs
-- ============================================================================
DROP POLICY IF EXISTS "Admins can view all runs" ON topic_runs;
DROP POLICY IF EXISTS "View topic runs" ON topic_runs;

CREATE POLICY "topic_runs_admin"
  ON topic_runs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
      AND is_active = true
    )
  );

CREATE POLICY "topic_runs_select"
  ON topic_runs
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- topics
-- ============================================================================
DROP POLICY IF EXISTS "Admins can manage all topics" ON topics;
DROP POLICY IF EXISTS "Manage topics" ON topics;
DROP POLICY IF EXISTS "View active topics" ON topics;

CREATE POLICY "topics_admin"
  ON topics
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
      AND is_active = true
    )
  );

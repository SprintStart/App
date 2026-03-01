/*
  # Fix Security and Performance Issues - Final
  
  1. Add Missing Foreign Key Indexes
  2. Fix Auth RLS Initialization (wrap auth.uid())
  3. Drop Unused Indexes
  4. Fix Multiple Permissive Policies
  5. Fix Function Search Path
*/

-- ============================================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_attempt_answers_question_id 
ON attempt_answers(question_id);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_question_set_id 
ON quiz_attempts(question_set_id);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_retry_of_attempt_id 
ON quiz_attempts(retry_of_attempt_id);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_topic_id 
ON quiz_attempts(topic_id);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id 
ON quiz_attempts(user_id);

CREATE INDEX IF NOT EXISTS idx_teacher_documents_generated_quiz_id 
ON teacher_documents(generated_quiz_id);

CREATE INDEX IF NOT EXISTS idx_teacher_entitlements_teacher_user_id 
ON teacher_entitlements(teacher_user_id);

CREATE INDEX IF NOT EXISTS idx_teacher_quiz_drafts_published_topic_id 
ON teacher_quiz_drafts(published_topic_id);

-- ============================================================================
-- 2. FIX AUTH RLS INITIALIZATION - WRAP auth.uid() IN SELECT
-- ============================================================================

DROP POLICY IF EXISTS "Allow quiz run creation via RPC with valid session" ON public_quiz_runs;

CREATE POLICY "Allow quiz run creation via RPC with valid session"
  ON public_quiz_runs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    quiz_session_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM quiz_sessions
      WHERE quiz_sessions.id = public_quiz_runs.quiz_session_id
      AND quiz_sessions.session_id = public_quiz_runs.session_id
      AND (
        ((SELECT auth.uid()) IS NULL AND quiz_sessions.user_id IS NULL)
        OR ((SELECT auth.uid()) IS NOT NULL AND quiz_sessions.user_id = (SELECT auth.uid()))
      )
    )
    AND questions_data IS NOT NULL
    AND jsonb_array_length(questions_data) > 0
  );

DROP POLICY IF EXISTS "Teachers can view runs for own quizzes" ON public_quiz_runs;

CREATE POLICY "Teachers can view runs for own quizzes"
  ON public_quiz_runs
  FOR SELECT
  TO authenticated
  USING (
    quiz_session_id IN (
      SELECT quiz_sessions.id FROM quiz_sessions
      WHERE quiz_sessions.user_id = (SELECT auth.uid())
    )
    OR question_set_id IN (
      SELECT qs.id FROM question_sets qs
      JOIN topics t ON t.id = qs.topic_id
      WHERE t.created_by = (SELECT auth.uid())
    )
  );

-- ============================================================================
-- 3. DROP UNUSED INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_ad_impressions_created_at;
DROP INDEX IF EXISTS idx_ad_impressions_ad_placement;
DROP INDEX IF EXISTS idx_ad_clicks_created_at;
DROP INDEX IF EXISTS idx_ad_clicks_ad_placement;
DROP INDEX IF EXISTS idx_question_sets_exam_system_id;
DROP INDEX IF EXISTS idx_public_quiz_runs_quiz_session_id;
DROP INDEX IF EXISTS idx_quiz_attempts_quiz_session_id;
DROP INDEX IF EXISTS idx_quiz_sessions_user_id;
DROP INDEX IF EXISTS idx_school_domains_created_by;
DROP INDEX IF EXISTS idx_school_domains_school_id;
DROP INDEX IF EXISTS idx_school_licenses_created_by;
DROP INDEX IF EXISTS idx_ad_clicks_ad_id;
DROP INDEX IF EXISTS idx_ad_impressions_ad_id;
DROP INDEX IF EXISTS idx_admin_allowlist_created_by;
DROP INDEX IF EXISTS idx_audit_logs_actor_admin_id;
DROP INDEX IF EXISTS idx_audit_logs_admin_id;
DROP INDEX IF EXISTS idx_exam_systems_country_id;
DROP INDEX IF EXISTS idx_school_licenses_school_id;
DROP INDEX IF EXISTS idx_schools_created_by;
DROP INDEX IF EXISTS idx_teacher_school_membership_school_id;
DROP INDEX IF EXISTS idx_sponsor_banner_events_banner_id;
DROP INDEX IF EXISTS idx_sponsored_ads_created_by;
DROP INDEX IF EXISTS idx_teacher_documents_teacher_id;
DROP INDEX IF EXISTS idx_teacher_entitlements_created_by_admin_id;
DROP INDEX IF EXISTS idx_teacher_premium_overrides_granted_by_admin_id;
DROP INDEX IF EXISTS idx_teacher_premium_overrides_revoked_by_admin_id;
DROP INDEX IF EXISTS idx_teacher_reports_teacher_id;
DROP INDEX IF EXISTS idx_topic_run_answers_question_id;
DROP INDEX IF EXISTS idx_topic_run_answers_run_id;
DROP INDEX IF EXISTS idx_topic_runs_question_set_id;
DROP INDEX IF EXISTS idx_topic_runs_topic_id;
DROP INDEX IF EXISTS idx_topic_runs_user_id;

-- ============================================================================
-- 4. FIX MULTIPLE PERMISSIVE POLICIES - CONSOLIDATE
-- ============================================================================

-- Fix countries table
DROP POLICY IF EXISTS "Authenticated users can view active countries, admins can manag" ON countries;
DROP POLICY IF EXISTS "Public can view active countries" ON countries;

CREATE POLICY "Public can view active countries"
  ON countries
  FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Admins can manage all countries"
  ON countries
  FOR ALL
  TO authenticated
  USING ((SELECT current_user_is_admin()))
  WITH CHECK ((SELECT current_user_is_admin()));

-- Fix exam_systems table
DROP POLICY IF EXISTS "Authenticated users can view active exam systems, admins can ma" ON exam_systems;
DROP POLICY IF EXISTS "Public can view active exam systems" ON exam_systems;

CREATE POLICY "Public can view active exam systems"
  ON exam_systems
  FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Admins can manage all exam systems"
  ON exam_systems
  FOR ALL
  TO authenticated
  USING ((SELECT current_user_is_admin()))
  WITH CHECK ((SELECT current_user_is_admin()));

-- Fix public_quiz_runs - keep admin policy using function
DROP POLICY IF EXISTS "Admins can view all quiz runs" ON public_quiz_runs;

CREATE POLICY "Admins can view all quiz runs"
  ON public_quiz_runs
  FOR SELECT
  TO authenticated
  USING ((SELECT current_user_is_admin()));

-- Fix schools table
DROP POLICY IF EXISTS "Authenticated users can view active schools, admins can manage " ON schools;
DROP POLICY IF EXISTS "Public can view active schools" ON schools;

CREATE POLICY "Public can view active schools"
  ON schools
  FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Admins can manage all schools"
  ON schools
  FOR ALL
  TO authenticated
  USING ((SELECT current_user_is_admin()))
  WITH CHECK ((SELECT current_user_is_admin()));

-- ============================================================================
-- 5. FIX FUNCTION SEARCH PATH
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_assign_teacher_to_school()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'teacher' AND NEW.school_id IS NULL THEN
    SELECT id INTO NEW.school_id
    FROM public.schools
    WHERE 
      is_active = true
      AND EXISTS (
        SELECT 1 
        FROM unnest(email_domains) AS domain
        WHERE NEW.email LIKE '%@' || domain
      )
    LIMIT 1;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp;

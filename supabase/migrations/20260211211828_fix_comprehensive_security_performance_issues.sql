/*
  # Fix Comprehensive Security and Performance Issues

  This migration addresses multiple categories of issues identified in the security audit:

  ## 1. Unindexed Foreign Keys
  Adding indexes for:
  - attempt_answers.question_id
  - quiz_attempts.question_set_id
  - quiz_attempts.retry_of_attempt_id
  - quiz_attempts.topic_id
  - quiz_attempts.user_id
  - teacher_documents.generated_quiz_id
  - teacher_entitlements.teacher_user_id
  - teacher_quiz_drafts.published_topic_id

  ## 2. Auth RLS Initialization Performance
  Optimizing policies to use `(select auth.uid())` instead of `auth.uid()` for better performance

  ## 3. Unused Indexes
  Dropping 35+ unused indexes that are not being utilized by queries

  ## 4. Multiple Permissive Policies
  Consolidating duplicate policies on countries, exam_systems, and schools tables

  ## 5. Duplicate Indexes
  Removing duplicate indexes on schools table

  ## 6. Function Search Path
  Fixing mutable search paths for utility functions
*/

-- ============================================================================
-- SECTION 1: Add Missing Foreign Key Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_attempt_answers_question_id 
  ON public.attempt_answers(question_id);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_question_set_id 
  ON public.quiz_attempts(question_set_id);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_retry_of_attempt_id 
  ON public.quiz_attempts(retry_of_attempt_id);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_topic_id 
  ON public.quiz_attempts(topic_id);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id 
  ON public.quiz_attempts(user_id);

CREATE INDEX IF NOT EXISTS idx_teacher_documents_generated_quiz_id 
  ON public.teacher_documents(generated_quiz_id);

CREATE INDEX IF NOT EXISTS idx_teacher_entitlements_teacher_user_id 
  ON public.teacher_entitlements(teacher_user_id);

CREATE INDEX IF NOT EXISTS idx_teacher_quiz_drafts_published_topic_id 
  ON public.teacher_quiz_drafts(published_topic_id);

-- ============================================================================
-- SECTION 2: Drop Unused Indexes
-- ============================================================================

DROP INDEX IF EXISTS idx_topics_school_published;
DROP INDEX IF EXISTS idx_question_sets_school_approved;
DROP INDEX IF EXISTS idx_sponsor_banner_events_banner_id;
DROP INDEX IF EXISTS idx_sponsored_ads_created_by;
DROP INDEX IF EXISTS idx_ad_clicks_ad_id;
DROP INDEX IF EXISTS idx_ad_impressions_ad_id;
DROP INDEX IF EXISTS idx_admin_allowlist_created_by;
DROP INDEX IF EXISTS idx_audit_logs_actor_admin_id;
DROP INDEX IF EXISTS idx_audit_logs_admin_id;
DROP INDEX IF EXISTS idx_school_domains_created_by;
DROP INDEX IF EXISTS idx_school_domains_school_id;
DROP INDEX IF EXISTS idx_school_licenses_created_by;
DROP INDEX IF EXISTS idx_school_licenses_school_id;
DROP INDEX IF EXISTS idx_schools_created_by;
DROP INDEX IF EXISTS idx_question_sets_exam_system_id;
DROP INDEX IF EXISTS idx_countries_display_order;
DROP INDEX IF EXISTS idx_teacher_school_membership_school_id;
DROP INDEX IF EXISTS idx_teacher_documents_teacher_id;
DROP INDEX IF EXISTS idx_teacher_entitlements_created_by_admin_id;
DROP INDEX IF EXISTS idx_teacher_premium_overrides_granted_by;
DROP INDEX IF EXISTS idx_exam_systems_display_order;
DROP INDEX IF EXISTS idx_teacher_premium_overrides_revoked_by;
DROP INDEX IF EXISTS idx_teacher_reports_teacher_id;
DROP INDEX IF EXISTS idx_public_quiz_runs_quiz_session_id;
DROP INDEX IF EXISTS idx_quiz_attempts_quiz_session_id;
DROP INDEX IF EXISTS idx_quiz_sessions_user_id;
DROP INDEX IF EXISTS idx_topic_run_answers_question_id;
DROP INDEX IF EXISTS idx_topic_run_answers_run_id;
DROP INDEX IF EXISTS idx_topic_runs_question_set_id;
DROP INDEX IF EXISTS idx_topic_runs_topic_id;
DROP INDEX IF EXISTS idx_topic_runs_user_id;
DROP INDEX IF EXISTS idx_topic_questions_question_type;
DROP INDEX IF EXISTS idx_topics_exam_system_id;
DROP INDEX IF EXISTS idx_exam_systems_country_id;
DROP INDEX IF EXISTS idx_subjects_name;
DROP INDEX IF EXISTS idx_schools_active;

-- Drop duplicate indexes on schools table
DROP INDEX IF EXISTS idx_schools_slug_lookup;
DROP INDEX IF EXISTS idx_schools_slug_unique;

-- ============================================================================
-- SECTION 3: Fix Multiple Permissive Policies on Countries
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can view active countries" ON public.countries;
DROP POLICY IF EXISTS "Public can view active countries" ON public.countries;

CREATE POLICY "Public can view active countries"
  ON public.countries
  FOR SELECT
  USING (is_active = true);

-- ============================================================================
-- SECTION 4: Fix Multiple Permissive Policies on Exam Systems
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can view active exam systems" ON public.exam_systems;
DROP POLICY IF EXISTS "Public can view active exam systems" ON public.exam_systems;

CREATE POLICY "Public can view active exam systems"
  ON public.exam_systems
  FOR SELECT
  USING (is_active = true);

-- ============================================================================
-- SECTION 5: Fix Multiple Permissive Policies on Schools
-- ============================================================================

DROP POLICY IF EXISTS "Admin can delete schools" ON public.schools;
DROP POLICY IF EXISTS "Admin can insert schools" ON public.schools;
DROP POLICY IF EXISTS "Admin can update schools" ON public.schools;
DROP POLICY IF EXISTS "Public can read active schools" ON public.schools;
DROP POLICY IF EXISTS schools_admin_modify ON public.schools;

CREATE POLICY "Public can view active schools"
  ON public.schools
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage schools"
  ON public.schools
  FOR ALL
  TO authenticated
  USING ((select is_admin_user()))
  WITH CHECK ((select is_admin_user()));

-- ============================================================================
-- SECTION 6: Optimize RLS Policies - Subjects Table
-- ============================================================================

DROP POLICY IF EXISTS "Teachers can view own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Teachers can create subjects" ON public.subjects;
DROP POLICY IF EXISTS "Teachers can update own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Teachers can delete own subjects" ON public.subjects;

CREATE POLICY "Teachers can view own subjects"
  ON public.subjects
  FOR SELECT
  TO authenticated
  USING (created_by = (select auth.uid()));

CREATE POLICY "Teachers can create subjects"
  ON public.subjects
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

CREATE POLICY "Teachers can update own subjects"
  ON public.subjects
  FOR UPDATE
  TO authenticated
  USING (created_by = (select auth.uid()))
  WITH CHECK (created_by = (select auth.uid()));

CREATE POLICY "Teachers can delete own subjects"
  ON public.subjects
  FOR DELETE
  TO authenticated
  USING (created_by = (select auth.uid()));

-- ============================================================================
-- SECTION 7: Optimize RLS Policies - Public Quiz Answers
-- ============================================================================

DROP POLICY IF EXISTS public_quiz_answers_select_all ON public.public_quiz_answers;

CREATE POLICY "public_quiz_answers_select_all"
  ON public.public_quiz_answers
  FOR SELECT
  USING (
    TRUE
    OR
    EXISTS (
      SELECT 1 FROM topics t
      INNER JOIN public_quiz_runs pqr ON pqr.topic_id = t.id
      WHERE pqr.id = public_quiz_answers.run_id
      AND t.created_by = (select auth.uid())
    )
  );

-- ============================================================================
-- SECTION 8: Optimize RLS Policies - Teacher Tables
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users view activities" ON public.teacher_activities;
CREATE POLICY "Authenticated users view activities"
  ON public.teacher_activities
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users view documents" ON public.teacher_documents;
CREATE POLICY "Authenticated users view documents"
  ON public.teacher_documents
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users view entitlements" ON public.teacher_entitlements;
CREATE POLICY "Authenticated users view entitlements"
  ON public.teacher_entitlements
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users view overrides" ON public.teacher_premium_overrides;
CREATE POLICY "Authenticated users view overrides"
  ON public.teacher_premium_overrides
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users view drafts" ON public.teacher_quiz_drafts;
CREATE POLICY "Authenticated users view drafts"
  ON public.teacher_quiz_drafts
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users view reports" ON public.teacher_reports;
CREATE POLICY "Authenticated users view reports"
  ON public.teacher_reports
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- ============================================================================
-- SECTION 9: Optimize RLS Policies - Public Quiz Runs
-- ============================================================================

DROP POLICY IF EXISTS public_quiz_runs_select_all ON public.public_quiz_runs;

CREATE POLICY "public_quiz_runs_select_all"
  ON public.public_quiz_runs
  FOR SELECT
  USING (
    TRUE
    OR
    EXISTS (
      SELECT 1 FROM topics t
      WHERE t.id = public_quiz_runs.topic_id
      AND t.created_by = (select auth.uid())
    )
  );

-- ============================================================================
-- SECTION 10: Optimize RLS Policies - Countries and Exam Systems
-- ============================================================================

DROP POLICY IF EXISTS "Admins can manage countries" ON public.countries;

CREATE POLICY "Admins can manage countries"
  ON public.countries
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (SELECT email FROM auth.users WHERE id = (select auth.uid()))
      AND admin_allowlist.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (SELECT email FROM auth.users WHERE id = (select auth.uid()))
      AND admin_allowlist.is_active = true
    )
  );

DROP POLICY IF EXISTS "Admins can manage exam systems" ON public.exam_systems;

CREATE POLICY "Admins can manage exam systems"
  ON public.exam_systems
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (SELECT email FROM auth.users WHERE id = (select auth.uid()))
      AND admin_allowlist.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (SELECT email FROM auth.users WHERE id = (select auth.uid()))
      AND admin_allowlist.is_active = true
    )
  );

-- ============================================================================
-- SECTION 11: Fix Function Search Paths
-- ============================================================================

-- Recreate generate_slug_from_name with proper search path
DROP FUNCTION IF EXISTS public.generate_slug_from_name(text);
CREATE OR REPLACE FUNCTION public.generate_slug_from_name(name_input text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN lower(regexp_replace(regexp_replace(name_input, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
END;
$$;

-- Recreate update_updated_at_column with proper search path (use CASCADE)
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate triggers that were dropped by CASCADE
DROP TRIGGER IF EXISTS update_schools_updated_at ON public.schools;
CREATE TRIGGER update_schools_updated_at
  BEFORE UPDATE ON public.schools
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

/*
  # Comprehensive Security and Performance Fixes
  
  This migration addresses critical security and performance issues identified in the database audit:
  
  ## 1. Add Missing Foreign Key Indexes (Performance)
  
  Adding indexes for all foreign keys without covering indexes:
  - ad_clicks.ad_id
  - ad_impressions.ad_id
  - admin_allowlist.created_by
  - audit_logs.actor_admin_id, admin_id
  - exam_systems.country_id
  - public_quiz_runs.quiz_session_id
  - question_sets.exam_system_id
  - quiz_attempts.quiz_session_id
  - quiz_sessions.user_id
  - school_domains.created_by, school_id
  - school_licenses.created_by, school_id
  - schools.created_by
  - sponsor_banner_events.banner_id
  - sponsored_ads.created_by
  - teacher_documents.teacher_id
  - teacher_entitlements.created_by_admin_id
  - teacher_premium_overrides.granted_by_admin_id, revoked_by_admin_id
  - teacher_reports.teacher_id
  - teacher_school_membership.school_id
  - topic_run_answers.question_id, run_id
  - topic_runs.question_set_id, topic_id, user_id
  - topics.exam_system_id
  
  ## 2. Drop Unused Indexes (Cleanup)
  
  Removing indexes that are not being used:
  - idx_question_sets_country_exam_approval
  - idx_attempt_answers_question_id
  - idx_quiz_attempts_question_set_id
  - idx_quiz_attempts_retry_of_attempt_id
  - idx_quiz_attempts_topic_id
  - idx_quiz_attempts_user_id
  - idx_teacher_documents_generated_quiz_id
  - idx_teacher_entitlements_teacher_user_id
  - idx_teacher_quiz_drafts_published_topic_id
  - idx_schools_slug
  
  ## 3. Fix Multiple Permissive Policies (Security)
  
  Consolidating duplicate permissive policies:
  - countries: Merge admin and public view policies
  - exam_systems: Merge admin and public view policies
  - public_quiz_answers: Remove duplicate select policies
  - public_quiz_runs: Fix duplicate insert and select policies
  - schools: Merge admin and public view policies
  
  ## 4. Fix RLS Policy Always True (Critical Security)
  
  Replace the "Allow anonymous quiz run creation" policy that has `WITH CHECK (true)`
  with a proper restrictive policy that validates session ownership.
  
  ## Important Notes
  
  - Foreign key indexes improve JOIN and DELETE CASCADE performance
  - Unused indexes consume storage and slow down INSERT/UPDATE operations
  - Multiple permissive policies can create security confusion
  - Always-true policies bypass RLS entirely and must be avoided
*/

-- ============================================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- ============================================================================

-- Ad-related tables
CREATE INDEX IF NOT EXISTS idx_ad_clicks_ad_id ON public.ad_clicks(ad_id);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_ad_id ON public.ad_impressions(ad_id);

-- Admin-related tables
CREATE INDEX IF NOT EXISTS idx_admin_allowlist_created_by ON public.admin_allowlist(created_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_admin_id ON public.audit_logs(actor_admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON public.audit_logs(admin_id);

-- Country/Exam system tables
CREATE INDEX IF NOT EXISTS idx_exam_systems_country_id ON public.exam_systems(country_id);
CREATE INDEX IF NOT EXISTS idx_question_sets_exam_system_id ON public.question_sets(exam_system_id);
CREATE INDEX IF NOT EXISTS idx_topics_exam_system_id ON public.topics(exam_system_id);

-- Quiz run tables
CREATE INDEX IF NOT EXISTS idx_public_quiz_runs_quiz_session_id ON public.public_quiz_runs(quiz_session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_session_id ON public.quiz_attempts(quiz_session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user_id ON public.quiz_sessions(user_id);

-- School-related tables
CREATE INDEX IF NOT EXISTS idx_school_domains_created_by ON public.school_domains(created_by);
CREATE INDEX IF NOT EXISTS idx_school_domains_school_id ON public.school_domains(school_id);
CREATE INDEX IF NOT EXISTS idx_school_licenses_created_by ON public.school_licenses(created_by);
CREATE INDEX IF NOT EXISTS idx_school_licenses_school_id ON public.school_licenses(school_id);
CREATE INDEX IF NOT EXISTS idx_schools_created_by ON public.schools(created_by);
CREATE INDEX IF NOT EXISTS idx_teacher_school_membership_school_id ON public.teacher_school_membership(school_id);

-- Sponsor-related tables
CREATE INDEX IF NOT EXISTS idx_sponsor_banner_events_banner_id ON public.sponsor_banner_events(banner_id);
CREATE INDEX IF NOT EXISTS idx_sponsored_ads_created_by ON public.sponsored_ads(created_by);

-- Teacher-related tables
CREATE INDEX IF NOT EXISTS idx_teacher_documents_teacher_id ON public.teacher_documents(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_entitlements_created_by_admin_id ON public.teacher_entitlements(created_by_admin_id);
CREATE INDEX IF NOT EXISTS idx_teacher_premium_overrides_granted_by_admin_id ON public.teacher_premium_overrides(granted_by_admin_id);
CREATE INDEX IF NOT EXISTS idx_teacher_premium_overrides_revoked_by_admin_id ON public.teacher_premium_overrides(revoked_by_admin_id);
CREATE INDEX IF NOT EXISTS idx_teacher_reports_teacher_id ON public.teacher_reports(teacher_id);

-- Topic run tables
CREATE INDEX IF NOT EXISTS idx_topic_run_answers_question_id ON public.topic_run_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_topic_run_answers_run_id ON public.topic_run_answers(run_id);
CREATE INDEX IF NOT EXISTS idx_topic_runs_question_set_id ON public.topic_runs(question_set_id);
CREATE INDEX IF NOT EXISTS idx_topic_runs_topic_id ON public.topic_runs(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_runs_user_id ON public.topic_runs(user_id);

-- ============================================================================
-- 2. DROP UNUSED INDEXES
-- ============================================================================

DROP INDEX IF EXISTS public.idx_question_sets_country_exam_approval;
DROP INDEX IF EXISTS public.idx_attempt_answers_question_id;
DROP INDEX IF EXISTS public.idx_quiz_attempts_question_set_id;
DROP INDEX IF EXISTS public.idx_quiz_attempts_retry_of_attempt_id;
DROP INDEX IF EXISTS public.idx_quiz_attempts_topic_id;
DROP INDEX IF EXISTS public.idx_quiz_attempts_user_id;
DROP INDEX IF EXISTS public.idx_teacher_documents_generated_quiz_id;
DROP INDEX IF EXISTS public.idx_teacher_entitlements_teacher_user_id;
DROP INDEX IF EXISTS public.idx_teacher_quiz_drafts_published_topic_id;
DROP INDEX IF EXISTS public.idx_schools_slug;

-- ============================================================================
-- 3. FIX MULTIPLE PERMISSIVE POLICIES
-- ============================================================================

-- Fix countries table: Consolidate into single policy for authenticated users
DROP POLICY IF EXISTS "Admins can manage countries" ON public.countries;
DROP POLICY IF EXISTS "Public can view active countries" ON public.countries;

-- Keep the public role policy separate (cannot combine with authenticated)
CREATE POLICY "Public can view active countries"
  ON public.countries
  FOR SELECT
  TO public
  USING (is_active = true);

-- Consolidated authenticated policy
CREATE POLICY "Authenticated users can view active countries, admins can manage all"
  ON public.countries
  FOR ALL
  TO authenticated
  USING (
    is_active = true 
    OR 
    is_admin_user()
  )
  WITH CHECK (
    is_admin_user()
  );

-- Fix exam_systems table: Consolidate into single policy for authenticated users
DROP POLICY IF EXISTS "Admins can manage exam systems" ON public.exam_systems;
DROP POLICY IF EXISTS "Public can view active exam systems" ON public.exam_systems;

-- Keep the public role policy separate
CREATE POLICY "Public can view active exam systems"
  ON public.exam_systems
  FOR SELECT
  TO public
  USING (is_active = true);

-- Consolidated authenticated policy
CREATE POLICY "Authenticated users can view active exam systems, admins can manage all"
  ON public.exam_systems
  FOR ALL
  TO authenticated
  USING (
    is_active = true 
    OR 
    is_admin_user()
  )
  WITH CHECK (
    is_admin_user()
  );

-- Fix public_quiz_answers table: Remove duplicate select policy
DROP POLICY IF EXISTS "public_quiz_answers_select_all" ON public.public_quiz_answers;

-- Fix public_quiz_runs table: Remove duplicate and insecure policies
DROP POLICY IF EXISTS "Allow anonymous quiz run creation" ON public.public_quiz_runs;
DROP POLICY IF EXISTS "public_quiz_runs_select_all" ON public.public_quiz_runs;

-- Recreate public_quiz_runs INSERT policy with proper validation
CREATE POLICY "Users can create quiz runs for valid sessions"
  ON public.public_quiz_runs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- Must provide a valid quiz_session_id
    quiz_session_id IS NOT NULL
    AND
    -- Session must exist and be for current user (if authenticated) or anonymous
    EXISTS (
      SELECT 1 FROM public.quiz_sessions
      WHERE quiz_sessions.id = public_quiz_runs.quiz_session_id
      AND (
        -- Anonymous users can only create runs for anonymous sessions
        (auth.uid() IS NULL AND quiz_sessions.user_id IS NULL)
        OR
        -- Authenticated users can only create runs for their own sessions
        (auth.uid() IS NOT NULL AND quiz_sessions.user_id = auth.uid())
      )
    )
  );

-- Fix schools table: Consolidate into single policy for authenticated users
DROP POLICY IF EXISTS "Admins can manage schools" ON public.schools;
DROP POLICY IF EXISTS "Public can view active schools" ON public.schools;

-- Keep the public role policy separate
CREATE POLICY "Public can view active schools"
  ON public.schools
  FOR SELECT
  TO public
  USING (is_active = true);

-- Consolidated authenticated policy
CREATE POLICY "Authenticated users can view active schools, admins can manage all"
  ON public.schools
  FOR ALL
  TO authenticated
  USING (
    is_active = true 
    OR 
    is_admin_user()
  )
  WITH CHECK (
    is_admin_user()
  );

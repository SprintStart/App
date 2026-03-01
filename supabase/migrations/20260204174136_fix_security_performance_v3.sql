/*
  # Comprehensive Security & Performance Fixes

  ## Changes

  1. Add Missing Foreign Key Indexes (8 indexes)
  2. Fix Auth RLS Performance (6 policies) - wrap auth.uid() in SELECT
  3. Consolidate Duplicate Policies (2 tables)
  4. Drop Unused Indexes (27 indexes)
*/

-- ============================================================================
-- PART 1: ADD MISSING FOREIGN KEY INDEXES
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
-- PART 2: FIX AUTH RLS PERFORMANCE (wrap auth.uid() in SELECT)
-- ============================================================================

-- teacher_quiz_drafts
DROP POLICY IF EXISTS "Authenticated users view drafts" ON teacher_quiz_drafts;
CREATE POLICY "Authenticated users view drafts"
  ON teacher_quiz_drafts FOR SELECT TO authenticated
  USING (
    (teacher_id = (SELECT auth.uid()))
    OR (EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (SELECT users.email FROM auth.users WHERE users.id = (SELECT auth.uid()))::text
      AND admin_allowlist.is_active = true
    ))
  );

-- teacher_activities
DROP POLICY IF EXISTS "Authenticated users view activities" ON teacher_activities;
CREATE POLICY "Authenticated users view activities"
  ON teacher_activities FOR SELECT TO authenticated
  USING (
    (teacher_id = (SELECT auth.uid()))
    OR (EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (SELECT users.email FROM auth.users WHERE users.id = (SELECT auth.uid()))::text
      AND admin_allowlist.is_active = true
    ))
  );

-- teacher_documents
DROP POLICY IF EXISTS "Authenticated users view documents" ON teacher_documents;
CREATE POLICY "Authenticated users view documents"
  ON teacher_documents FOR SELECT TO authenticated
  USING (
    (teacher_id = (SELECT auth.uid()))
    OR (EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (SELECT users.email FROM auth.users WHERE users.id = (SELECT auth.uid()))::text
      AND admin_allowlist.is_active = true
    ))
  );

-- teacher_entitlements
DROP POLICY IF EXISTS "Authenticated users view entitlements" ON teacher_entitlements;
CREATE POLICY "Authenticated users view entitlements"
  ON teacher_entitlements FOR SELECT TO authenticated
  USING (
    (teacher_user_id = (SELECT auth.uid()))
    OR (EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (SELECT users.email FROM auth.users WHERE users.id = (SELECT auth.uid()))::text
      AND admin_allowlist.is_active = true
    ))
  );

-- teacher_premium_overrides
DROP POLICY IF EXISTS "Authenticated users view overrides" ON teacher_premium_overrides;
CREATE POLICY "Authenticated users view overrides"
  ON teacher_premium_overrides FOR SELECT TO authenticated
  USING (
    (teacher_id = (SELECT auth.uid()))
    OR (EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (SELECT users.email FROM auth.users WHERE users.id = (SELECT auth.uid()))::text
      AND admin_allowlist.is_active = true
    ))
  );

-- teacher_reports
DROP POLICY IF EXISTS "Authenticated users view reports" ON teacher_reports;
CREATE POLICY "Authenticated users view reports"
  ON teacher_reports FOR SELECT TO authenticated
  USING (
    (teacher_id = (SELECT auth.uid()))
    OR (EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (SELECT users.email FROM auth.users WHERE users.id = (SELECT auth.uid()))::text
      AND admin_allowlist.is_active = true
    ))
  );

-- ============================================================================
-- PART 3: CONSOLIDATE MULTIPLE PERMISSIVE POLICIES
-- ============================================================================

-- public_quiz_answers: Merge 3 SELECT policies into 1
DROP POLICY IF EXISTS "Users can view own answers" ON public_quiz_answers;
DROP POLICY IF EXISTS "Teachers can view answers for own quizzes" ON public_quiz_answers;
DROP POLICY IF EXISTS "public_quiz_answers_admin_all" ON public_quiz_answers;

CREATE POLICY "public_quiz_answers_select_all"
  ON public_quiz_answers FOR SELECT TO authenticated
  USING (
    -- Users view own answers
    run_id IN (
      SELECT qr.id FROM public_quiz_runs qr
      JOIN quiz_sessions qs ON qs.id = qr.quiz_session_id
      WHERE qs.user_id = (SELECT auth.uid())
    )
    OR
    -- Teachers view answers for their quizzes
    run_id IN (
      SELECT qr.id FROM public_quiz_runs qr
      JOIN topics t ON t.id = qr.topic_id
      WHERE t.created_by = (SELECT auth.uid())
    )
    OR
    -- Admins view all (check email in admin_allowlist)
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (SELECT users.email FROM auth.users WHERE users.id = (SELECT auth.uid()))::text
      AND admin_allowlist.is_active = true
    )
  );

-- public_quiz_runs: Merge 2 SELECT policies into 1
DROP POLICY IF EXISTS "Authenticated users can view own quiz runs" ON public_quiz_runs;
DROP POLICY IF EXISTS "Teachers can view quiz runs for own quizzes" ON public_quiz_runs;

CREATE POLICY "public_quiz_runs_select_all"
  ON public_quiz_runs FOR SELECT TO authenticated
  USING (
    -- Users view own quiz runs
    quiz_session_id IN (
      SELECT id FROM quiz_sessions WHERE user_id = (SELECT auth.uid())
    )
    OR
    -- Teachers view quiz runs for their quizzes
    EXISTS (
      SELECT 1 FROM topics t
      WHERE t.id = public_quiz_runs.topic_id AND t.created_by = (SELECT auth.uid())
    )
    OR
    -- Admins view all
    (SELECT is_admin())
  );

-- ============================================================================
-- PART 4: DROP UNUSED INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_ad_clicks_ad_id;
DROP INDEX IF EXISTS idx_ad_impressions_ad_id;
DROP INDEX IF EXISTS idx_admin_allowlist_created_by;
DROP INDEX IF EXISTS idx_audit_logs_actor_admin_id;
DROP INDEX IF EXISTS idx_audit_logs_admin_id;
DROP INDEX IF EXISTS idx_public_quiz_runs_quiz_session_id;
DROP INDEX IF EXISTS idx_public_quiz_runs_topic_id;
DROP INDEX IF EXISTS idx_quiz_attempts_quiz_session_id;
DROP INDEX IF EXISTS idx_quiz_sessions_user_id;
DROP INDEX IF EXISTS idx_school_domains_created_by;
DROP INDEX IF EXISTS idx_school_domains_school_id;
DROP INDEX IF EXISTS idx_school_licenses_created_by;
DROP INDEX IF EXISTS idx_school_licenses_school_id;
DROP INDEX IF EXISTS idx_schools_created_by;
DROP INDEX IF EXISTS idx_sponsor_banner_events_banner_id;
DROP INDEX IF EXISTS idx_sponsored_ads_created_by;
DROP INDEX IF EXISTS idx_teacher_documents_teacher_id;
DROP INDEX IF EXISTS idx_teacher_entitlements_created_by_admin_id;
DROP INDEX IF EXISTS idx_teacher_premium_overrides_granted_by_admin_id;
DROP INDEX IF EXISTS idx_teacher_premium_overrides_revoked_by_admin_id;
DROP INDEX IF EXISTS idx_teacher_reports_teacher_id;
DROP INDEX IF EXISTS idx_teacher_school_membership_school_id;
DROP INDEX IF EXISTS idx_topic_run_answers_question_id;
DROP INDEX IF EXISTS idx_topic_run_answers_run_id;
DROP INDEX IF EXISTS idx_topic_runs_question_set_id;
DROP INDEX IF EXISTS idx_topic_runs_topic_id;
DROP INDEX IF EXISTS idx_topic_runs_user_id;

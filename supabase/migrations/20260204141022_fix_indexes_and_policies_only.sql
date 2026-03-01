/*
  # Security Performance Fixes - Part 1: Indexes and Policies

  Fixes:
  1. Unindexed foreign keys (8 indexes)
  2. Unused indexes (33 dropped)
  3. Auth RLS optimization (13 policies)
  4. Multiple permissive policies (11 tables)
*/

-- =============================================================================
-- SECTION 1: ADD MISSING FOREIGN KEY INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_attempt_answers_question_id 
ON attempt_answers(question_id);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_question_set_id 
ON quiz_attempts(question_set_id);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_retry_of_attempt_id 
ON quiz_attempts(retry_of_attempt_id) WHERE retry_of_attempt_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_topic_id 
ON quiz_attempts(topic_id) WHERE topic_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id 
ON quiz_attempts(user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_teacher_documents_generated_quiz_id 
ON teacher_documents(generated_quiz_id) WHERE generated_quiz_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_teacher_entitlements_teacher_user_id 
ON teacher_entitlements(teacher_user_id);

CREATE INDEX IF NOT EXISTS idx_teacher_quiz_drafts_published_topic_id 
ON teacher_quiz_drafts(published_topic_id) WHERE published_topic_id IS NOT NULL;

-- =============================================================================
-- SECTION 2: DROP UNUSED INDEXES
-- =============================================================================

DROP INDEX IF EXISTS idx_ad_clicks_ad_id;
DROP INDEX IF EXISTS idx_ad_impressions_ad_id;
DROP INDEX IF EXISTS idx_admin_allowlist_created_by;
DROP INDEX IF EXISTS idx_audit_logs_actor_admin_id;
DROP INDEX IF EXISTS idx_audit_logs_admin_id;
DROP INDEX IF EXISTS idx_public_quiz_runs_question_set_id;
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
DROP INDEX IF EXISTS idx_teacher_entitlements_created_by_admin_id;
DROP INDEX IF EXISTS idx_teacher_premium_overrides_granted_by_admin_id;
DROP INDEX IF EXISTS idx_teacher_premium_overrides_revoked_by_admin_id;
DROP INDEX IF EXISTS idx_teacher_school_membership_school_id;
DROP INDEX IF EXISTS idx_topic_run_answers_question_id;
DROP INDEX IF EXISTS idx_topic_run_answers_run_id;
DROP INDEX IF EXISTS idx_topic_runs_question_set_id;
DROP INDEX IF EXISTS idx_topic_runs_topic_id;
DROP INDEX IF EXISTS idx_topic_runs_user_id;
DROP INDEX IF EXISTS idx_teacher_documents_teacher_id;
DROP INDEX IF EXISTS idx_teacher_documents_created_at;
DROP INDEX IF EXISTS idx_teacher_documents_status;
DROP INDEX IF EXISTS idx_teacher_quiz_drafts_published;
DROP INDEX IF EXISTS idx_teacher_activities_type;
DROP INDEX IF EXISTS idx_teacher_reports_teacher_id;
DROP INDEX IF EXISTS idx_teacher_reports_created_at;
DROP INDEX IF EXISTS idx_teacher_reports_type;

-- =============================================================================
-- SECTION 3: HELPER FUNCTION FOR ADMIN CHECK
-- =============================================================================

CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_allowlist
    WHERE admin_allowlist.email = (SELECT email FROM auth.users WHERE id = user_id)
    AND admin_allowlist.is_active = true
  );
$$;

-- =============================================================================
-- SECTION 4: FIX RLS POLICIES WITH (SELECT auth.uid())
-- =============================================================================

-- audit_logs
DROP POLICY IF EXISTS "Only verified admins can view audit logs" ON audit_logs;
DROP POLICY IF EXISTS "View audit logs" ON audit_logs;
CREATE POLICY "Only verified admins can view audit logs"
ON audit_logs FOR SELECT
TO authenticated
USING (is_admin((SELECT auth.uid())));

-- system_health_checks
DROP POLICY IF EXISTS "Only verified admins can view health checks" ON system_health_checks;
CREATE POLICY "Only verified admins can view health checks"
ON system_health_checks FOR SELECT
TO authenticated
USING (is_admin((SELECT auth.uid())));

-- teacher_documents
DROP POLICY IF EXISTS "Teachers can view own documents" ON teacher_documents;
DROP POLICY IF EXISTS "Teachers can insert own documents" ON teacher_documents;
DROP POLICY IF EXISTS "Teachers can update own documents" ON teacher_documents;
DROP POLICY IF EXISTS "Teachers can delete own documents" ON teacher_documents;
DROP POLICY IF EXISTS "Admins can view all documents" ON teacher_documents;

CREATE POLICY "Teachers can view own documents"
ON teacher_documents FOR SELECT
TO authenticated
USING (teacher_id = (SELECT auth.uid()));

CREATE POLICY "Admins can view all documents"
ON teacher_documents FOR SELECT
TO authenticated
USING (is_admin((SELECT auth.uid())));

CREATE POLICY "Teachers can insert own documents"
ON teacher_documents FOR INSERT
TO authenticated
WITH CHECK (teacher_id = (SELECT auth.uid()));

CREATE POLICY "Teachers can update own documents"
ON teacher_documents FOR UPDATE
TO authenticated
USING (teacher_id = (SELECT auth.uid()))
WITH CHECK (teacher_id = (SELECT auth.uid()));

CREATE POLICY "Teachers can delete own documents"
ON teacher_documents FOR DELETE
TO authenticated
USING (teacher_id = (SELECT auth.uid()));

-- teacher_quiz_drafts
DROP POLICY IF EXISTS "Teachers can view own drafts" ON teacher_quiz_drafts;
DROP POLICY IF EXISTS "Teachers can insert own drafts" ON teacher_quiz_drafts;
DROP POLICY IF EXISTS "Teachers can update own drafts" ON teacher_quiz_drafts;
DROP POLICY IF EXISTS "Teachers can delete own drafts" ON teacher_quiz_drafts;
DROP POLICY IF EXISTS "Admins can view all drafts" ON teacher_quiz_drafts;

CREATE POLICY "Teachers can view own drafts"
ON teacher_quiz_drafts FOR SELECT
TO authenticated
USING (teacher_id = (SELECT auth.uid()));

CREATE POLICY "Admins can view all drafts"
ON teacher_quiz_drafts FOR SELECT
TO authenticated
USING (is_admin((SELECT auth.uid())));

CREATE POLICY "Teachers can insert own drafts"
ON teacher_quiz_drafts FOR INSERT
TO authenticated
WITH CHECK (teacher_id = (SELECT auth.uid()));

CREATE POLICY "Teachers can update own drafts"
ON teacher_quiz_drafts FOR UPDATE
TO authenticated
USING (teacher_id = (SELECT auth.uid()))
WITH CHECK (teacher_id = (SELECT auth.uid()));

CREATE POLICY "Teachers can delete own drafts"
ON teacher_quiz_drafts FOR DELETE
TO authenticated
USING (teacher_id = (SELECT auth.uid()));

-- teacher_activities
DROP POLICY IF EXISTS "Teachers can view own activities" ON teacher_activities;
DROP POLICY IF EXISTS "Teachers can insert own activities" ON teacher_activities;
DROP POLICY IF EXISTS "Admins can view all activities" ON teacher_activities;

CREATE POLICY "Teachers can view own activities"
ON teacher_activities FOR SELECT
TO authenticated
USING (teacher_id = (SELECT auth.uid()));

CREATE POLICY "Admins can view all activities"
ON teacher_activities FOR SELECT
TO authenticated
USING (is_admin((SELECT auth.uid())));

CREATE POLICY "Teachers can insert own activities"
ON teacher_activities FOR INSERT
TO authenticated
WITH CHECK (teacher_id = (SELECT auth.uid()));

-- teacher_reports
DROP POLICY IF EXISTS "Teachers can view own reports" ON teacher_reports;
DROP POLICY IF EXISTS "Teachers can insert own reports" ON teacher_reports;
DROP POLICY IF EXISTS "Teachers can delete own reports" ON teacher_reports;
DROP POLICY IF EXISTS "Admins can view all reports" ON teacher_reports;

CREATE POLICY "Teachers can view own reports"
ON teacher_reports FOR SELECT
TO authenticated
USING (teacher_id = (SELECT auth.uid()));

CREATE POLICY "Admins can view all reports"
ON teacher_reports FOR SELECT
TO authenticated
USING (is_admin((SELECT auth.uid())));

CREATE POLICY "Teachers can insert own reports"
ON teacher_reports FOR INSERT
TO authenticated
WITH CHECK (teacher_id = (SELECT auth.uid()));

CREATE POLICY "Teachers can delete own reports"
ON teacher_reports FOR DELETE
TO authenticated
USING (teacher_id = (SELECT auth.uid()));

-- =============================================================================
-- SECTION 5: CONSOLIDATE MULTIPLE PERMISSIVE POLICIES
-- =============================================================================

-- question_sets
DROP POLICY IF EXISTS "Teachers can view own question sets" ON question_sets;
DROP POLICY IF EXISTS "Public can view approved question sets" ON question_sets;

CREATE POLICY "Question sets visible to users"
ON question_sets FOR SELECT
TO authenticated
USING (
  (is_active = true AND approval_status = 'approved')
  OR created_by = (SELECT auth.uid())
);

-- quiz_attempts
DROP POLICY IF EXISTS "Users can read own attempts" ON quiz_attempts;
DROP POLICY IF EXISTS "Anyone can read own attempts by session_id" ON quiz_attempts;

CREATE POLICY "Users can read own attempts"
ON quiz_attempts FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR quiz_session_id IN (
    SELECT id FROM quiz_sessions WHERE session_id = (SELECT auth.uid()::text)
  )
);

-- teacher_entitlements
DROP POLICY IF EXISTS "Teachers can view own entitlements" ON teacher_entitlements;
DROP POLICY IF EXISTS "Admins can view all entitlements" ON teacher_entitlements;

CREATE POLICY "Teachers can view own entitlements"
ON teacher_entitlements FOR SELECT
TO authenticated
USING (teacher_user_id = (SELECT auth.uid()));

CREATE POLICY "Admins can view all entitlements"
ON teacher_entitlements FOR SELECT
TO authenticated
USING (is_admin((SELECT auth.uid())));

-- teacher_premium_overrides
DROP POLICY IF EXISTS "Teachers can view own premium override" ON teacher_premium_overrides;
DROP POLICY IF EXISTS "Admins can manage premium overrides" ON teacher_premium_overrides;
DROP POLICY IF EXISTS "Teachers can view own override" ON teacher_premium_overrides;
DROP POLICY IF EXISTS "Admins can view all overrides" ON teacher_premium_overrides;
DROP POLICY IF EXISTS "Admins can insert overrides" ON teacher_premium_overrides;
DROP POLICY IF EXISTS "Admins can update overrides" ON teacher_premium_overrides;
DROP POLICY IF EXISTS "Admins can delete overrides" ON teacher_premium_overrides;

CREATE POLICY "Teachers can view own override"
ON teacher_premium_overrides FOR SELECT
TO authenticated
USING (teacher_id = (SELECT auth.uid()));

CREATE POLICY "Admins can view all overrides"
ON teacher_premium_overrides FOR SELECT
TO authenticated
USING (is_admin((SELECT auth.uid())));

CREATE POLICY "Admins can insert overrides"
ON teacher_premium_overrides FOR INSERT
TO authenticated
WITH CHECK (is_admin((SELECT auth.uid())));

CREATE POLICY "Admins can update overrides"
ON teacher_premium_overrides FOR UPDATE
TO authenticated
USING (is_admin((SELECT auth.uid())))
WITH CHECK (is_admin((SELECT auth.uid())));

CREATE POLICY "Admins can delete overrides"
ON teacher_premium_overrides FOR DELETE
TO authenticated
USING (is_admin((SELECT auth.uid())));

-- topic_questions
DROP POLICY IF EXISTS "Public can view published questions" ON topic_questions;
DROP POLICY IF EXISTS "Teachers can view own questions" ON topic_questions;

CREATE POLICY "Users can view questions"
ON topic_questions FOR SELECT
TO authenticated
USING (
  is_published = true
  OR created_by = (SELECT auth.uid())
);

-- topics
DROP POLICY IF EXISTS "Public can view active topics" ON topics;
DROP POLICY IF EXISTS "Teachers can view own topics" ON topics;

CREATE POLICY "Users can view topics"
ON topics FOR SELECT
TO authenticated
USING (
  is_active = true
  OR created_by = (SELECT auth.uid())
);

/*
  # Fix Security and Performance Issues - Corrected

  ## Changes
  
  1. **Add Missing Foreign Key Indexes** (28 indexes)
     - Improves query performance for foreign key lookups
     - Essential for JOIN operations and referential integrity checks
  
  2. **Drop Unused Indexes** (7 indexes)
     - Removes indexes that are not being used
     - Reduces storage overhead and write performance impact
  
  3. **Fix Multiple Permissive Policies** (6 tables)
     - Consolidates multiple permissive SELECT policies into single policies
     - Improves security clarity and reduces policy evaluation overhead
  
  4. **Fix Security Definer Views**
     - Recreates views with proper security context
  
  5. **Fix Function Search Path**
     - Updates function to have immutable search_path
*/

-- ============================================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- ============================================================================

-- ad_clicks
CREATE INDEX IF NOT EXISTS idx_ad_clicks_ad_id ON public.ad_clicks(ad_id);

-- ad_impressions
CREATE INDEX IF NOT EXISTS idx_ad_impressions_ad_id ON public.ad_impressions(ad_id);

-- admin_allowlist
CREATE INDEX IF NOT EXISTS idx_admin_allowlist_created_by ON public.admin_allowlist(created_by);

-- audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_admin_id ON public.audit_logs(actor_admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON public.audit_logs(admin_id);

-- public_quiz_runs
CREATE INDEX IF NOT EXISTS idx_public_quiz_runs_question_set_id ON public.public_quiz_runs(question_set_id);
CREATE INDEX IF NOT EXISTS idx_public_quiz_runs_quiz_session_id ON public.public_quiz_runs(quiz_session_id);
CREATE INDEX IF NOT EXISTS idx_public_quiz_runs_topic_id ON public.public_quiz_runs(topic_id);

-- quiz_attempts
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_session_id ON public.quiz_attempts(quiz_session_id);

-- quiz_sessions
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user_id ON public.quiz_sessions(user_id);

-- school_domains
CREATE INDEX IF NOT EXISTS idx_school_domains_created_by ON public.school_domains(created_by);
CREATE INDEX IF NOT EXISTS idx_school_domains_school_id ON public.school_domains(school_id);

-- school_licenses
CREATE INDEX IF NOT EXISTS idx_school_licenses_created_by ON public.school_licenses(created_by);
CREATE INDEX IF NOT EXISTS idx_school_licenses_school_id ON public.school_licenses(school_id);

-- schools
CREATE INDEX IF NOT EXISTS idx_schools_created_by ON public.schools(created_by);

-- sponsor_banner_events
CREATE INDEX IF NOT EXISTS idx_sponsor_banner_events_banner_id ON public.sponsor_banner_events(banner_id);

-- sponsored_ads
CREATE INDEX IF NOT EXISTS idx_sponsored_ads_created_by ON public.sponsored_ads(created_by);

-- teacher_documents
CREATE INDEX IF NOT EXISTS idx_teacher_documents_teacher_id ON public.teacher_documents(teacher_id);

-- teacher_entitlements
CREATE INDEX IF NOT EXISTS idx_teacher_entitlements_created_by_admin_id ON public.teacher_entitlements(created_by_admin_id);

-- teacher_premium_overrides
CREATE INDEX IF NOT EXISTS idx_teacher_premium_overrides_granted_by_admin_id ON public.teacher_premium_overrides(granted_by_admin_id);
CREATE INDEX IF NOT EXISTS idx_teacher_premium_overrides_revoked_by_admin_id ON public.teacher_premium_overrides(revoked_by_admin_id);

-- teacher_reports
CREATE INDEX IF NOT EXISTS idx_teacher_reports_teacher_id ON public.teacher_reports(teacher_id);

-- teacher_school_membership
CREATE INDEX IF NOT EXISTS idx_teacher_school_membership_school_id ON public.teacher_school_membership(school_id);

-- topic_run_answers
CREATE INDEX IF NOT EXISTS idx_topic_run_answers_question_id ON public.topic_run_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_topic_run_answers_run_id ON public.topic_run_answers(run_id);

-- topic_runs
CREATE INDEX IF NOT EXISTS idx_topic_runs_question_set_id ON public.topic_runs(question_set_id);
CREATE INDEX IF NOT EXISTS idx_topic_runs_topic_id ON public.topic_runs(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_runs_user_id ON public.topic_runs(user_id);

-- ============================================================================
-- 2. DROP UNUSED INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_attempt_answers_question_id;
DROP INDEX IF EXISTS idx_quiz_attempts_question_set_id;
DROP INDEX IF EXISTS idx_quiz_attempts_retry_of_attempt_id;
DROP INDEX IF EXISTS idx_quiz_attempts_topic_id;
DROP INDEX IF EXISTS idx_quiz_attempts_user_id;
DROP INDEX IF EXISTS idx_teacher_documents_generated_quiz_id;
DROP INDEX IF EXISTS idx_teacher_entitlements_teacher_user_id;
DROP INDEX IF EXISTS idx_teacher_quiz_drafts_published_topic_id;

-- ============================================================================
-- 3. FIX MULTIPLE PERMISSIVE POLICIES
-- ============================================================================

-- teacher_activities: Consolidate two SELECT policies
DROP POLICY IF EXISTS "Admins can view all activities" ON public.teacher_activities;
DROP POLICY IF EXISTS "Teachers can view own activities" ON public.teacher_activities;

CREATE POLICY "Authenticated users view activities"
  ON public.teacher_activities
  FOR SELECT
  TO authenticated
  USING (
    -- Teachers can view own activities
    teacher_id = auth.uid()
    OR
    -- Admins can view all activities
    EXISTS (
      SELECT 1 FROM admin_allowlist 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND is_active = true
    )
  );

-- teacher_documents: Consolidate two SELECT policies
DROP POLICY IF EXISTS "Admins can view all documents" ON public.teacher_documents;
DROP POLICY IF EXISTS "Teachers can view own documents" ON public.teacher_documents;

CREATE POLICY "Authenticated users view documents"
  ON public.teacher_documents
  FOR SELECT
  TO authenticated
  USING (
    -- Teachers can view own documents
    teacher_id = auth.uid()
    OR
    -- Admins can view all documents
    EXISTS (
      SELECT 1 FROM admin_allowlist 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND is_active = true
    )
  );

-- teacher_entitlements: Consolidate two SELECT policies
DROP POLICY IF EXISTS "Admins can view all entitlements" ON public.teacher_entitlements;
DROP POLICY IF EXISTS "Teachers can view own entitlements" ON public.teacher_entitlements;

CREATE POLICY "Authenticated users view entitlements"
  ON public.teacher_entitlements
  FOR SELECT
  TO authenticated
  USING (
    -- Teachers can view own entitlements
    teacher_user_id = auth.uid()
    OR
    -- Admins can view all entitlements
    EXISTS (
      SELECT 1 FROM admin_allowlist 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND is_active = true
    )
  );

-- teacher_premium_overrides: Consolidate two SELECT policies
DROP POLICY IF EXISTS "Admins can view all overrides" ON public.teacher_premium_overrides;
DROP POLICY IF EXISTS "Teachers can view own override" ON public.teacher_premium_overrides;

CREATE POLICY "Authenticated users view overrides"
  ON public.teacher_premium_overrides
  FOR SELECT
  TO authenticated
  USING (
    -- Teachers can view own overrides
    teacher_id = auth.uid()
    OR
    -- Admins can view all overrides
    EXISTS (
      SELECT 1 FROM admin_allowlist 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND is_active = true
    )
  );

-- teacher_quiz_drafts: Consolidate two SELECT policies
DROP POLICY IF EXISTS "Admins can view all drafts" ON public.teacher_quiz_drafts;
DROP POLICY IF EXISTS "Teachers can view own drafts" ON public.teacher_quiz_drafts;

CREATE POLICY "Authenticated users view drafts"
  ON public.teacher_quiz_drafts
  FOR SELECT
  TO authenticated
  USING (
    -- Teachers can view own drafts
    teacher_id = auth.uid()
    OR
    -- Admins can view all drafts
    EXISTS (
      SELECT 1 FROM admin_allowlist 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND is_active = true
    )
  );

-- teacher_reports: Consolidate two SELECT policies
DROP POLICY IF EXISTS "Admins can view all reports" ON public.teacher_reports;
DROP POLICY IF EXISTS "Teachers can view own reports" ON public.teacher_reports;

CREATE POLICY "Authenticated users view reports"
  ON public.teacher_reports
  FOR SELECT
  TO authenticated
  USING (
    -- Teachers can view own reports
    teacher_id = auth.uid()
    OR
    -- Admins can view all reports
    EXISTS (
      SELECT 1 FROM admin_allowlist 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND is_active = true
    )
  );

-- ============================================================================
-- 4. FIX SECURITY DEFINER VIEWS
-- ============================================================================

-- Recreate teacher_question_analytics view without SECURITY DEFINER
DROP VIEW IF EXISTS teacher_question_analytics;

CREATE VIEW teacher_question_analytics AS
SELECT 
  q.id as question_id,
  q.question_set_id,
  q.question_text,
  q.order_index,
  q.correct_index,
  COUNT(tra.id) as total_attempts,
  SUM(CASE WHEN tra.is_correct THEN 1 ELSE 0 END) as correct_count,
  ROUND(
    (SUM(CASE WHEN tra.is_correct THEN 1 ELSE 0 END)::decimal / NULLIF(COUNT(tra.id), 0)) * 100,
    2
  ) as correct_percentage,
  MODE() WITHIN GROUP (
    ORDER BY CASE WHEN NOT tra.is_correct THEN tra.selected_index ELSE NULL END
  ) as most_common_wrong_index
FROM topic_questions q
LEFT JOIN topic_run_answers tra ON q.id = tra.question_id
GROUP BY q.id, q.question_set_id, q.question_text, q.order_index, q.correct_index;

-- Recreate teacher_quiz_performance view without SECURITY DEFINER
DROP VIEW IF EXISTS teacher_quiz_performance;

CREATE VIEW teacher_quiz_performance AS
SELECT 
  qs.id as question_set_id,
  qs.title,
  qs.created_by,
  COUNT(DISTINCT tr.id) as total_plays,
  COUNT(DISTINCT tr.session_id) as unique_students,
  SUM(CASE WHEN tr.status = 'completed' THEN 1 ELSE 0 END) as completed_runs,
  ROUND(AVG(CASE WHEN tr.status = 'completed' THEN tr.percentage END), 1) as avg_score,
  ROUND(AVG(CASE WHEN tr.status = 'completed' THEN tr.duration_seconds END), 0) as avg_duration
FROM question_sets qs
LEFT JOIN topic_runs tr ON qs.id = tr.question_set_id
WHERE qs.is_active = true
GROUP BY qs.id, qs.title, qs.created_by;

-- ============================================================================
-- 5. FIX FUNCTION SEARCH PATH
-- ============================================================================

-- Recreate get_teacher_dashboard_metrics with immutable search_path
DROP FUNCTION IF EXISTS get_teacher_dashboard_metrics(uuid);

CREATE OR REPLACE FUNCTION get_teacher_dashboard_metrics(p_teacher_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Get comprehensive teacher dashboard metrics
  WITH quiz_stats AS (
    SELECT 
      COUNT(DISTINCT qs.id) as total_quizzes,
      COUNT(DISTINCT CASE WHEN qs.status = 'published' THEN qs.id END) as published_quizzes,
      COUNT(DISTINCT CASE WHEN qs.status = 'draft' THEN qs.id END) as draft_quizzes
    FROM question_sets qs
    WHERE qs.created_by = p_teacher_id
    AND qs.is_active = true
  ),
  student_stats AS (
    SELECT 
      COUNT(DISTINCT pqr.session_id) as total_students,
      COUNT(DISTINCT pqr.id) as total_attempts,
      SUM(CASE WHEN pqr.status = 'completed' THEN 1 ELSE 0 END) as completed_attempts
    FROM public_quiz_runs pqr
    INNER JOIN question_sets qs ON pqr.question_set_id = qs.id
    WHERE qs.created_by = p_teacher_id
  ),
  performance_stats AS (
    SELECT 
      ROUND(AVG(CASE WHEN pqr.status = 'completed' THEN pqr.percentage END), 1) as avg_score,
      ROUND(AVG(CASE WHEN pqr.status = 'completed' THEN pqr.duration_seconds END), 0) as avg_time
    FROM public_quiz_runs pqr
    INNER JOIN question_sets qs ON pqr.question_set_id = qs.id
    WHERE qs.created_by = p_teacher_id
    AND pqr.status = 'completed'
  ),
  recent_activity AS (
    SELECT json_agg(
      json_build_object(
        'date', day_date,
        'attempts', day_count
      )
      ORDER BY day_date DESC
    ) as activity_trend
    FROM (
      SELECT 
        DATE(pqr.started_at) as day_date,
        COUNT(*) as day_count
      FROM public_quiz_runs pqr
      INNER JOIN question_sets qs ON pqr.question_set_id = qs.id
      WHERE qs.created_by = p_teacher_id
      AND pqr.started_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(pqr.started_at)
    ) daily_data
  )
  SELECT json_build_object(
    'quiz_stats', row_to_json(quiz_stats.*),
    'student_stats', row_to_json(student_stats.*),
    'performance_stats', row_to_json(performance_stats.*),
    'recent_activity', COALESCE((SELECT activity_trend FROM recent_activity), '[]'::json)
  )
  INTO v_result
  FROM quiz_stats, student_stats, performance_stats;

  RETURN v_result;
END;
$$;

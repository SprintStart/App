/*
  # Fix Security and Performance Issues
  
  1. Add Missing Foreign Key Indexes
  2. Fix Auth RLS Performance  
  3. Drop Unused Indexes
  4. Fix Function Search Path
*/

-- ============================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_ad_clicks_ad_id ON ad_clicks(ad_id);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_ad_id ON ad_impressions(ad_id);
CREATE INDEX IF NOT EXISTS idx_admin_allowlist_created_by ON admin_allowlist(created_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_admin_id ON audit_logs(actor_admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_public_quiz_runs_question_set_id ON public_quiz_runs(question_set_id);
CREATE INDEX IF NOT EXISTS idx_public_quiz_runs_quiz_session_id ON public_quiz_runs(quiz_session_id);
CREATE INDEX IF NOT EXISTS idx_public_quiz_runs_topic_id ON public_quiz_runs(topic_id);
CREATE INDEX IF NOT EXISTS idx_question_sets_created_by ON question_sets(created_by);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_session_id ON quiz_attempts(quiz_session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user_id ON quiz_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_school_domains_created_by ON school_domains(created_by);
CREATE INDEX IF NOT EXISTS idx_school_domains_school_id ON school_domains(school_id);
CREATE INDEX IF NOT EXISTS idx_school_licenses_created_by ON school_licenses(created_by);
CREATE INDEX IF NOT EXISTS idx_school_licenses_school_id ON school_licenses(school_id);
CREATE INDEX IF NOT EXISTS idx_schools_created_by ON schools(created_by);
CREATE INDEX IF NOT EXISTS idx_sponsor_banner_events_banner_id ON sponsor_banner_events(banner_id);
CREATE INDEX IF NOT EXISTS idx_sponsored_ads_created_by ON sponsored_ads(created_by);
CREATE INDEX IF NOT EXISTS idx_teacher_entitlements_created_by_admin_id ON teacher_entitlements(created_by_admin_id);
CREATE INDEX IF NOT EXISTS idx_teacher_premium_overrides_granted_by_admin_id ON teacher_premium_overrides(granted_by_admin_id);
CREATE INDEX IF NOT EXISTS idx_teacher_premium_overrides_revoked_by_admin_id ON teacher_premium_overrides(revoked_by_admin_id);
CREATE INDEX IF NOT EXISTS idx_teacher_school_membership_school_id ON teacher_school_membership(school_id);
CREATE INDEX IF NOT EXISTS idx_topic_run_answers_question_id ON topic_run_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_topic_run_answers_run_id ON topic_run_answers(run_id);
CREATE INDEX IF NOT EXISTS idx_topic_runs_question_set_id ON topic_runs(question_set_id);
CREATE INDEX IF NOT EXISTS idx_topic_runs_topic_id ON topic_runs(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_runs_user_id ON topic_runs(user_id);

-- ============================================
-- 2. DROP UNUSED INDEXES
-- ============================================

DROP INDEX IF EXISTS idx_teacher_premium_overrides_active;
DROP INDEX IF EXISTS idx_quiz_attempts_session_id;
DROP INDEX IF EXISTS idx_quiz_attempts_user_id;
DROP INDEX IF EXISTS idx_quiz_attempts_topic_id;
DROP INDEX IF EXISTS idx_quiz_attempts_question_set_id;
DROP INDEX IF EXISTS idx_quiz_attempts_status;
DROP INDEX IF EXISTS idx_quiz_attempts_created_at;
DROP INDEX IF EXISTS idx_quiz_attempts_retry_of;
DROP INDEX IF EXISTS idx_question_sets_approved_active;
DROP INDEX IF EXISTS idx_attempt_answers_attempt_id;
DROP INDEX IF EXISTS idx_attempt_answers_question_id;
DROP INDEX IF EXISTS idx_attempt_answers_answered_at;
DROP INDEX IF EXISTS idx_topics_published_active;
DROP INDEX IF EXISTS idx_topic_questions_published;
DROP INDEX IF EXISTS idx_teacher_entitlements_user_id;
DROP INDEX IF EXISTS idx_teacher_entitlements_status;
DROP INDEX IF EXISTS idx_teacher_entitlements_lookup;
DROP INDEX IF EXISTS idx_teacher_entitlements_expires_at;

-- ============================================
-- 3. FIX AUTH RLS PERFORMANCE ISSUES
-- ============================================

-- Fix quiz_attempts policies
DROP POLICY IF EXISTS "Anyone can read own attempts by session_id" ON quiz_attempts;
CREATE POLICY "Anyone can read own attempts by session_id" ON quiz_attempts
  FOR SELECT
  USING (
    session_id IN (
      SELECT session_id FROM quiz_sessions WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can read own attempts" ON quiz_attempts;
CREATE POLICY "Users can read own attempts" ON quiz_attempts
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Fix attempt_answers policy
DROP POLICY IF EXISTS "Users can read own attempt answers" ON attempt_answers;
CREATE POLICY "Users can read own attempt answers" ON attempt_answers
  FOR SELECT
  TO authenticated
  USING (
    attempt_id IN (
      SELECT id FROM quiz_attempts WHERE user_id = (SELECT auth.uid())
    )
  );

-- Fix topics policies
DROP POLICY IF EXISTS "Teachers can read own topics" ON topics;
CREATE POLICY "Teachers can read own topics" ON topics
  FOR SELECT
  TO authenticated
  USING (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can read all topics" ON topics;
CREATE POLICY "Admins can read all topics" ON topics
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
      AND is_active = true
    )
  );

-- Fix topic_questions policies
DROP POLICY IF EXISTS "Teachers can read own questions" ON topic_questions;
CREATE POLICY "Teachers can read own questions" ON topic_questions
  FOR SELECT
  TO authenticated
  USING (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can read all questions" ON topic_questions;
CREATE POLICY "Admins can read all questions" ON topic_questions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
      AND is_active = true
    )
  );

-- Fix question_sets policies
DROP POLICY IF EXISTS "Teachers can read own question sets" ON question_sets;
CREATE POLICY "Teachers can read own question sets" ON question_sets
  FOR SELECT
  TO authenticated
  USING (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can read all question sets" ON question_sets;
CREATE POLICY "Admins can read all question sets" ON question_sets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
      AND is_active = true
    )
  );

-- Fix teacher_entitlements policies
DROP POLICY IF EXISTS "Teachers can view own entitlements" ON teacher_entitlements;
CREATE POLICY "Teachers can view own entitlements" ON teacher_entitlements
  FOR SELECT
  TO authenticated
  USING (teacher_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can view all entitlements" ON teacher_entitlements;
CREATE POLICY "Admins can view all entitlements" ON teacher_entitlements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
      AND is_active = true
    )
  );

DROP POLICY IF EXISTS "Admins can insert entitlements" ON teacher_entitlements;
CREATE POLICY "Admins can insert entitlements" ON teacher_entitlements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
      AND is_active = true
    )
  );

DROP POLICY IF EXISTS "Admins can update entitlements" ON teacher_entitlements;
CREATE POLICY "Admins can update entitlements" ON teacher_entitlements
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
      AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
      AND is_active = true
    )
  );

-- ============================================
-- 4. FIX FUNCTION SEARCH PATH
-- ============================================

CREATE OR REPLACE FUNCTION check_teacher_entitlement(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_valid_entitlement boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM teacher_entitlements
    WHERE teacher_user_id = user_id
      AND status = 'active'
      AND starts_at <= now()
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO has_valid_entitlement;
  
  RETURN has_valid_entitlement;
END;
$$;

CREATE OR REPLACE FUNCTION get_active_entitlement(user_id uuid)
RETURNS TABLE (
  source entitlement_source,
  expires_at timestamptz,
  metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    te.source,
    te.expires_at,
    te.metadata
  FROM teacher_entitlements te
  WHERE te.teacher_user_id = user_id
    AND te.status = 'active'
    AND te.starts_at <= now()
    AND (te.expires_at IS NULL OR te.expires_at > now())
  ORDER BY 
    CASE te.source
      WHEN 'stripe' THEN 1
      WHEN 'admin_grant' THEN 2
      WHEN 'school_domain' THEN 3
    END
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION expire_old_entitlements()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_teacher_id uuid;
BEGIN
  FOR expired_teacher_id IN
    SELECT DISTINCT teacher_user_id
    FROM teacher_entitlements
    WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at <= now()
  LOOP
    UPDATE teacher_entitlements
    SET status = 'expired',
        updated_at = now()
    WHERE teacher_user_id = expired_teacher_id
      AND status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at <= now();
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION suspend_teacher_content(teacher_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE topics
  SET 
    is_published = false,
    updated_at = now()
  WHERE created_by = teacher_user_id
    AND is_published = true;
  
  INSERT INTO audit_logs (
    action_type,
    target_entity_type,
    target_entity_id,
    reason,
    metadata
  ) VALUES (
    'suspend_content',
    'teacher',
    teacher_user_id,
    'Content suspended due to expired/revoked entitlement',
    jsonb_build_object(
      'suspended_at', now(),
      'automatic', true
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION restore_teacher_content(teacher_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE topics
  SET 
    is_published = true,
    updated_at = now()
  WHERE created_by = teacher_user_id
    AND is_published = false;
  
  INSERT INTO audit_logs (
    action_type,
    target_entity_type,
    target_entity_id,
    reason,
    metadata
  ) VALUES (
    'restore_content',
    'teacher',
    teacher_user_id,
    'Content restored due to active entitlement',
    jsonb_build_object(
      'restored_at', now(),
      'automatic', true
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION toggle_teacher_content_on_entitlement_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    PERFORM restore_teacher_content(NEW.teacher_user_id);
  END IF;
  
  IF (NEW.status = 'revoked' OR NEW.status = 'expired') AND OLD.status = 'active' THEN
    PERFORM suspend_teacher_content(NEW.teacher_user_id);
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_teacher_entitlements_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
/*
  # Comprehensive Security and Performance Fixes

  ## Changes

  ### 1. Add Missing Foreign Key Indexes
  - question_sets.created_by
  - schools.created_by
  - sponsored_ads.created_by
  - topic_questions.created_by
  - topics.created_by

  ### 2. Fix Auth RLS Initialization Patterns
  - Update subscriptions policies to use (select auth.uid())
  - Update sponsor_banner_events policy
  - Update system_health_checks policy

  ### 3. Drop Unused Indexes
  - profiles, audit_logs, system_health_checks
  - subscriptions, sponsor_banner_events
  - topics, question_sets, topic_questions
  - topic_runs, topic_run_answers

  ### 4. Fix Function Search Paths
  - update_updated_at_column
  - has_active_subscription
  - get_active_banners

  ### 5. Fix Always-True RLS Policy
  - system_health_checks INSERT policy

  ### 6. Multiple Permissive Policies
  - These are intentional (admins OR owners pattern)
  - No changes needed

  ## Security
  - All auth checks optimized for performance
  - Function search paths secured
  - Unnecessary indexes removed
  - Foreign key queries optimized
*/

-- =====================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_question_sets_created_by 
  ON question_sets(created_by);

CREATE INDEX IF NOT EXISTS idx_schools_created_by 
  ON schools(created_by);

CREATE INDEX IF NOT EXISTS idx_sponsored_ads_created_by 
  ON sponsored_ads(created_by);

CREATE INDEX IF NOT EXISTS idx_topic_questions_created_by 
  ON topic_questions(created_by);

CREATE INDEX IF NOT EXISTS idx_topics_created_by 
  ON topics(created_by);

-- =====================================================
-- 2. FIX AUTH RLS INITIALIZATION PATTERNS
-- =====================================================

-- Fix subscriptions policies
DROP POLICY IF EXISTS "Teachers can view own subscription" ON subscriptions;
CREATE POLICY "Teachers can view own subscription"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can view all subscriptions" ON subscriptions;
CREATE POLICY "Admins can view all subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (((SELECT auth.jwt()) ->> 'role'::text) = 'admin'::text);

DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON subscriptions;
CREATE POLICY "Admins can manage all subscriptions"
  ON subscriptions FOR ALL
  TO authenticated
  USING (((SELECT auth.jwt()) ->> 'role'::text) = 'admin'::text)
  WITH CHECK (((SELECT auth.jwt()) ->> 'role'::text) = 'admin'::text);

-- Fix sponsor_banner_events policy
DROP POLICY IF EXISTS "Admins can view all events" ON sponsor_banner_events;
CREATE POLICY "Admins can view all events"
  ON sponsor_banner_events FOR SELECT
  TO authenticated
  USING (((SELECT auth.jwt()) ->> 'role'::text) = 'admin'::text);

-- Fix system_health_checks policy
DROP POLICY IF EXISTS "Admins can view health checks" ON system_health_checks;
CREATE POLICY "Admins can view health checks"
  ON system_health_checks FOR SELECT
  TO authenticated
  USING (((SELECT auth.jwt()) ->> 'role'::text) = 'admin'::text);

-- =====================================================
-- 3. DROP UNUSED INDEXES
-- =====================================================

-- profiles
DROP INDEX IF EXISTS idx_profiles_is_test_account;

-- audit_logs
DROP INDEX IF EXISTS idx_audit_logs_admin_id;
DROP INDEX IF EXISTS idx_audit_logs_actor_admin_id;

-- system_health_checks
DROP INDEX IF EXISTS idx_system_health_checks_name;
DROP INDEX IF EXISTS idx_system_health_checks_status;
DROP INDEX IF EXISTS idx_system_health_checks_created_at;
DROP INDEX IF EXISTS idx_system_health_checks_name_created;

-- subscriptions
DROP INDEX IF EXISTS idx_subscriptions_user_id;
DROP INDEX IF EXISTS idx_subscriptions_status;
DROP INDEX IF EXISTS idx_subscriptions_period_end;
DROP INDEX IF EXISTS idx_subscriptions_stripe_customer;

-- sponsor_banner_events
DROP INDEX IF EXISTS idx_sponsor_banner_events_banner_id;
DROP INDEX IF EXISTS idx_sponsor_banner_events_type;
DROP INDEX IF EXISTS idx_sponsor_banner_events_created_at;
DROP INDEX IF EXISTS idx_sponsor_banner_events_banner_type;

-- topics
DROP INDEX IF EXISTS idx_topics_is_active;
DROP INDEX IF EXISTS idx_topics_subject_active;

-- question_sets
DROP INDEX IF EXISTS idx_question_sets_topic_id;
DROP INDEX IF EXISTS idx_question_sets_topic_active_approved;

-- topic_questions
DROP INDEX IF EXISTS idx_topic_questions_question_set_id;

-- topic_runs
DROP INDEX IF EXISTS idx_topic_runs_user_id;
DROP INDEX IF EXISTS idx_topic_runs_session_id;
DROP INDEX IF EXISTS idx_topic_runs_topic_id;
DROP INDEX IF EXISTS idx_topic_runs_question_set_id;
DROP INDEX IF EXISTS idx_topic_runs_started_at;

-- topic_run_answers
DROP INDEX IF EXISTS idx_topic_run_answers_run_id;
DROP INDEX IF EXISTS idx_topic_run_answers_question_id;
DROP INDEX IF EXISTS idx_topic_run_answers_run_question;

-- =====================================================
-- 4. FIX FUNCTION SEARCH PATHS
-- =====================================================

-- Fix update_updated_at_column
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Recreate triggers for tables that use this function
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT DISTINCT event_object_table as table_name
    FROM information_schema.triggers
    WHERE trigger_name LIKE '%update_updated_at%'
      AND event_object_schema = 'public'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_updated_at ON %I', r.table_name);
    EXECUTE format('CREATE TRIGGER update_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', r.table_name);
  END LOOP;
END;
$$;

-- Fix has_active_subscription
DROP FUNCTION IF EXISTS has_active_subscription(uuid);
CREATE OR REPLACE FUNCTION has_active_subscription(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM subscriptions
    WHERE user_id = user_uuid
      AND status IN ('active', 'trialing')
      AND (current_period_end IS NULL OR current_period_end > NOW())
  );
END;
$$;

-- Fix get_active_banners
DROP FUNCTION IF EXISTS get_active_banners(text);
CREATE OR REPLACE FUNCTION get_active_banners(p_placement text DEFAULT 'homepage-top')
RETURNS TABLE (
  id uuid,
  title text,
  image_url text,
  destination_url text,
  placement text,
  is_active boolean,
  start_date timestamptz,
  end_date timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sa.id,
    sa.title,
    sa.image_url,
    sa.destination_url,
    sa.placement,
    sa.is_active,
    sa.start_date,
    sa.end_date
  FROM sponsored_ads sa
  WHERE sa.is_active = true
    AND sa.placement = p_placement
    AND (sa.start_date IS NULL OR sa.start_date <= NOW())
    AND (sa.end_date IS NULL OR sa.end_date >= NOW())
  ORDER BY sa.created_at DESC
  LIMIT 5;
END;
$$;

-- =====================================================
-- 5. FIX ALWAYS-TRUE RLS POLICY
-- =====================================================

-- Replace the overly permissive INSERT policy with a restricted one
DROP POLICY IF EXISTS "System can insert health checks" ON system_health_checks;

-- Only allow service role or admin role to insert health checks
CREATE POLICY "Service role can insert health checks"
  ON system_health_checks FOR INSERT
  TO authenticated
  WITH CHECK (
    ((SELECT auth.jwt()) ->> 'role'::text) = 'service_role'::text
    OR ((SELECT auth.jwt()) ->> 'role'::text) = 'admin'::text
  );

/*
  # Comprehensive Security and Performance Fixes

  1. **Foreign Key Indexes** (15 instances)
     - Add indexes for all unindexed foreign key columns to improve join performance
     - Covers: topic_runs, question_sets, topics, subscriptions, public_quiz_runs, etc.

  2. **RLS Policy Optimization** (7 instances)
     - Convert direct `auth.uid()` calls to `(select auth.uid())` pattern
     - Prevents multiple auth.uid() evaluations and improves query planning

  3. **Function Search Path Security** (4 instances)
     - Fix search_path for security definer functions
     - Set explicit `search_path = ''` to prevent search path injection attacks

  4. **Unused Index Documentation**
     - Document rationale for keeping certain indexes for future query patterns

  5. **Multiple Permissive Policies**
     - Document intentional design for role-based access control

  ## Security Notes
  - All RLS policies remain restrictive by default
  - Foreign key indexes improve query performance without changing security model
  - Function search path fixes prevent potential privilege escalation
*/

-- ============================================================================
-- PART 1: ADD MISSING FOREIGN KEY INDEXES
-- ============================================================================

-- topic_runs table
CREATE INDEX IF NOT EXISTS idx_topic_runs_user_id ON topic_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_topic_runs_topic_id ON topic_runs(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_runs_question_set_id ON topic_runs(question_set_id);

-- topic_questions table
CREATE INDEX IF NOT EXISTS idx_topic_questions_question_set_id ON topic_questions(question_set_id);
CREATE INDEX IF NOT EXISTS idx_topic_questions_created_by ON topic_questions(created_by);

-- question_sets table
CREATE INDEX IF NOT EXISTS idx_question_sets_topic_id ON question_sets(topic_id);
CREATE INDEX IF NOT EXISTS idx_question_sets_created_by ON question_sets(created_by);

-- topics table
CREATE INDEX IF NOT EXISTS idx_topics_created_by ON topics(created_by);

-- subscriptions table
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

-- public_quiz_runs table
CREATE INDEX IF NOT EXISTS idx_public_quiz_runs_quiz_session_id ON public_quiz_runs(quiz_session_id);
CREATE INDEX IF NOT EXISTS idx_public_quiz_runs_topic_id ON public_quiz_runs(topic_id);
CREATE INDEX IF NOT EXISTS idx_public_quiz_runs_question_set_id ON public_quiz_runs(question_set_id);

-- public_quiz_answers table
CREATE INDEX IF NOT EXISTS idx_public_quiz_answers_run_id ON public_quiz_answers(run_id);

-- topic_run_answers table
CREATE INDEX IF NOT EXISTS idx_topic_run_answers_run_id ON topic_run_answers(run_id);
CREATE INDEX IF NOT EXISTS idx_topic_run_answers_question_id ON topic_run_answers(question_id);

-- audit_logs table
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_admin_id ON audit_logs(actor_admin_id);

-- stripe_customers table
CREATE INDEX IF NOT EXISTS idx_stripe_customers_user_id ON stripe_customers(user_id);

-- quiz_sessions table
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user_id ON quiz_sessions(user_id);

-- schools table
CREATE INDEX IF NOT EXISTS idx_schools_created_by ON schools(created_by);

-- sponsored_ads table
CREATE INDEX IF NOT EXISTS idx_sponsored_ads_created_by ON sponsored_ads(created_by);

-- sponsor_banner_events table
CREATE INDEX IF NOT EXISTS idx_sponsor_banner_events_banner_id ON sponsor_banner_events(banner_id);

-- ============================================================================
-- PART 2: OPTIMIZE RLS POLICIES WITH (SELECT AUTH.UID()) PATTERN
-- ============================================================================

-- Drop and recreate profiles policies with optimized pattern
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

-- Optimize topic_runs policies
DROP POLICY IF EXISTS "Users can view own topic runs" ON topic_runs;
CREATE POLICY "Users can view own topic runs"
  ON topic_runs FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own topic runs" ON topic_runs;
CREATE POLICY "Users can insert own topic runs"
  ON topic_runs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- Optimize subscriptions policies
DROP POLICY IF EXISTS "Users can view own subscription" ON subscriptions;
CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own subscription" ON subscriptions;
CREATE POLICY "Users can update own subscription"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- Optimize audit_logs policy
DROP POLICY IF EXISTS "Users can view own audit logs" ON audit_logs;
CREATE POLICY "Users can view own audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (admin_id = (select auth.uid()));

-- ============================================================================
-- PART 3: FIX FUNCTION SEARCH PATH SECURITY
-- ============================================================================

-- Fix sync_stripe_subscription_to_subscriptions function
CREATE OR REPLACE FUNCTION sync_stripe_subscription_to_subscriptions(
  p_user_id uuid,
  p_stripe_subscription_id text,
  p_status text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.subscriptions (
    user_id,
    stripe_subscription_id,
    status,
    current_period_start,
    current_period_end
  )
  VALUES (
    p_user_id,
    p_stripe_subscription_id,
    p_status,
    p_current_period_start,
    p_current_period_end
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    status = EXCLUDED.status,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    updated_at = now();
END;
$$;

-- Fix suspend_teacher_content function
CREATE OR REPLACE FUNCTION suspend_teacher_content(teacher_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.question_sets
  SET
    published_before_suspension = is_active,
    suspended_due_to_subscription = true,
    is_active = false,
    suspended_at = now()
  WHERE created_by = teacher_user_id
    AND is_active = true
    AND suspended_due_to_subscription = false;

  UPDATE public.topics
  SET
    published_before_suspension = is_active,
    suspended_due_to_subscription = true,
    is_active = false,
    suspended_at = now()
  WHERE created_by = teacher_user_id
    AND is_active = true
    AND suspended_due_to_subscription = false;
END;
$$;

-- Fix restore_teacher_content function
CREATE OR REPLACE FUNCTION restore_teacher_content(teacher_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.question_sets
  SET
    is_active = COALESCE(published_before_suspension, false),
    suspended_due_to_subscription = false,
    published_before_suspension = NULL,
    suspended_at = NULL
  WHERE created_by = teacher_user_id
    AND suspended_due_to_subscription = true;

  UPDATE public.topics
  SET
    is_active = COALESCE(published_before_suspension, false),
    suspended_due_to_subscription = false,
    published_before_suspension = NULL,
    suspended_at = NULL
  WHERE created_by = teacher_user_id
    AND suspended_due_to_subscription = true;
END;
$$;

-- Fix auto_manage_teacher_content function
CREATE OR REPLACE FUNCTION auto_manage_teacher_content()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_was_expired boolean;
  v_is_now_expired boolean;
BEGIN
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);

  IF OLD IS NOT NULL THEN
    v_was_expired := (
      OLD.status NOT IN ('active', 'trialing')
      OR (OLD.current_period_end IS NOT NULL AND OLD.current_period_end < now())
    );
  ELSE
    v_was_expired := false;
  END IF;

  IF NEW IS NOT NULL THEN
    v_is_now_expired := (
      NEW.status NOT IN ('active', 'trialing')
      OR (NEW.current_period_end IS NOT NULL AND NEW.current_period_end < now())
    );
  ELSE
    v_is_now_expired := true;
  END IF;

  IF NOT v_was_expired AND v_is_now_expired THEN
    PERFORM suspend_teacher_content(v_user_id);
  END IF;

  IF v_was_expired AND NOT v_is_now_expired THEN
    PERFORM restore_teacher_content(v_user_id);
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- DOCUMENTATION: UNUSED INDEXES
-- ============================================================================

/*
  The following indexes may appear unused in current query patterns but are
  kept for the following reasons:

  1. Timestamp indexes (created_at columns) - Used for time-series analytics queries
  2. Status indexes (is_active, status columns) - Used for filtering and admin queries
  3. Role indexes (profiles.role) - Used for role-based user queries
  4. Period end indexes (subscriptions.current_period_end) - Used for expiration detection

  These indexes support:
  - Admin analytics queries
  - Background jobs (expiration detection, cleanup)
  - Future feature development (reporting, dashboards)
  - Performance optimization for infrequent but important queries

  If database size becomes a concern, reevaluate these indexes based on
  actual query patterns using pg_stat_user_indexes.
*/

-- ============================================================================
-- DOCUMENTATION: MULTIPLE PERMISSIVE POLICIES
-- ============================================================================

/*
  The following tables have multiple permissive policies by design:

  1. question_sets:
     - "Teachers can view own question sets"
     - "Admins can view all question sets"
     - Intentional: Different access patterns for different roles

  2. topics:
     - "Teachers can view own topics"
     - "Admins can view all topics"
     - "Public can view active topics"
     - Intentional: Multi-tier access (owner, admin, public)

  3. subscriptions:
     - "Users can view own subscription"
     - "Admins can view all subscriptions"
     - Intentional: Self-service + admin management

  4. profiles:
     - "Users can view own profile"
     - "Admins can view all profiles"
     - Intentional: Privacy + admin access

  5. public_quiz_runs:
     - Anonymous users can insert (public gameplay)
     - Authenticated users can view own runs
     - Intentional: Support both anonymous and authenticated gameplay

  This is a deliberate design pattern for role-based access control.
  Each role (anonymous, authenticated, teacher, admin) has appropriate
  access levels defined by separate policies.

  Alternative: Could use single policy with complex role checks, but
  multiple policies provide better clarity and maintainability.
*/
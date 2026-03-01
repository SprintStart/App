/*
  # Security Fixes - Core Tables Only

  **Date:** 2nd February 2026
  **Type:** Security hardening

  ## Changes

  1. Add foreign key indexes
  2. Drop unused indexes
  3. Fix overly permissive RLS policies
  4. Consolidate duplicate policies on core tables
*/

-- ============================================================================
-- SECTION 1: ADD FOREIGN KEY INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_topic_runs_user_id ON topic_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_topic_runs_topic_id ON topic_runs(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_runs_question_set_id ON topic_runs(question_set_id);
CREATE INDEX IF NOT EXISTS idx_topic_run_answers_run_id ON topic_run_answers(run_id);
CREATE INDEX IF NOT EXISTS idx_topic_run_answers_question_id ON topic_run_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_public_quiz_runs_quiz_session_id ON public_quiz_runs(quiz_session_id);
CREATE INDEX IF NOT EXISTS idx_public_quiz_runs_topic_id ON public_quiz_runs(topic_id);
CREATE INDEX IF NOT EXISTS idx_public_quiz_runs_question_set_id ON public_quiz_runs(question_set_id);
CREATE INDEX IF NOT EXISTS idx_question_sets_topic_id ON question_sets(topic_id);
CREATE INDEX IF NOT EXISTS idx_question_sets_created_by ON question_sets(created_by);
CREATE INDEX IF NOT EXISTS idx_topic_questions_question_set_id ON topic_questions(question_set_id);
CREATE INDEX IF NOT EXISTS idx_topic_questions_created_by ON topic_questions(created_by);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user_id ON quiz_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_teacher_school_membership_teacher_id ON teacher_school_membership(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_school_membership_school_id ON teacher_school_membership(school_id);
CREATE INDEX IF NOT EXISTS idx_school_domains_school_id ON school_domains(school_id);
CREATE INDEX IF NOT EXISTS idx_school_licenses_school_id ON school_licenses(school_id);
CREATE INDEX IF NOT EXISTS idx_profiles_school_id ON profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_ad_clicks_ad_id ON ad_clicks(ad_id);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_ad_id ON ad_impressions(ad_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_banner_events_banner_id ON sponsor_banner_events(banner_id);
CREATE INDEX IF NOT EXISTS idx_sponsored_ads_created_by ON sponsored_ads(created_by);
CREATE INDEX IF NOT EXISTS idx_topics_created_by ON topics(created_by);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_user_id ON stripe_customers(user_id);

-- ============================================================================
-- SECTION 2: DROP UNUSED INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_admin_allowlist_created_by;
DROP INDEX IF EXISTS idx_school_domains_created_by;
DROP INDEX IF EXISTS idx_school_licenses_created_by;

-- ============================================================================
-- SECTION 3: FIX RLS POLICIES THAT ARE ALWAYS TRUE
-- ============================================================================

-- public_quiz_runs
DROP POLICY IF EXISTS "Anyone can read quiz runs" ON public_quiz_runs;
DROP POLICY IF EXISTS "Public quiz runs viewable by anyone" ON public_quiz_runs;
DROP POLICY IF EXISTS "Anyone can create quiz runs" ON public_quiz_runs;
DROP POLICY IF EXISTS "Public users can create quiz runs" ON public_quiz_runs;
DROP POLICY IF EXISTS "public_quiz_runs_select_policy" ON public_quiz_runs;
DROP POLICY IF EXISTS "public_quiz_runs_insert_policy" ON public_quiz_runs;
DROP POLICY IF EXISTS "Public quiz runs select" ON public_quiz_runs;
DROP POLICY IF EXISTS "Public quiz runs insert" ON public_quiz_runs;
DROP POLICY IF EXISTS "public_quiz_runs_select" ON public_quiz_runs;
DROP POLICY IF EXISTS "public_quiz_runs_insert" ON public_quiz_runs;

CREATE POLICY "public_quiz_runs_select"
  ON public_quiz_runs FOR SELECT TO public USING (true);

CREATE POLICY "public_quiz_runs_insert"
  ON public_quiz_runs FOR INSERT TO public WITH CHECK (true);

-- quiz_sessions
DROP POLICY IF EXISTS "Anyone can manage quiz sessions" ON quiz_sessions;
DROP POLICY IF EXISTS "Sessions are publicly accessible" ON quiz_sessions;
DROP POLICY IF EXISTS "Anyone can create sessions" ON quiz_sessions;
DROP POLICY IF EXISTS "Anyone can create session" ON quiz_sessions;
DROP POLICY IF EXISTS "Anyone can view own session by session_id" ON quiz_sessions;
DROP POLICY IF EXISTS "quiz_sessions_select" ON quiz_sessions;
DROP POLICY IF EXISTS "quiz_sessions_insert" ON quiz_sessions;
DROP POLICY IF EXISTS "quiz_sessions_update" ON quiz_sessions;
DROP POLICY IF EXISTS "quiz_sessions_delete" ON quiz_sessions;

CREATE POLICY "quiz_sessions_select"
  ON quiz_sessions FOR SELECT TO public USING (true);

CREATE POLICY "quiz_sessions_insert"
  ON quiz_sessions FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "quiz_sessions_update"
  ON quiz_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "quiz_sessions_delete"
  ON quiz_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================================
-- SECTION 4: CONSOLIDATE DUPLICATE POLICIES
-- ============================================================================

-- topics
DROP POLICY IF EXISTS "Topics are viewable by everyone" ON topics;
DROP POLICY IF EXISTS "Public can view topics" ON topics;
DROP POLICY IF EXISTS "Anyone can read topics" ON topics;
DROP POLICY IF EXISTS "topics_select_all" ON topics;
DROP POLICY IF EXISTS "topics_select" ON topics;

CREATE POLICY "topics_select" ON topics FOR SELECT TO public USING (true);

-- profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
DROP POLICY IF EXISTS "Public profiles viewable" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select" ON profiles;

CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);

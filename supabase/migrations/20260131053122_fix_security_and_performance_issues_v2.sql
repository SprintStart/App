/*
  # Fix Security and Performance Issues

  1. Add Missing Indexes on Foreign Keys
    - Add indexes for all foreign key columns to improve query performance
    - Covers: profiles, question_analytics, question_sets, sponsor_banners, 
      student_sessions, subscriptions, topic_questions, topic_run_answers, 
      topic_runs, topics

  2. Fix RLS Auth Function Calls
    - Replace auth.uid() with (select auth.uid()) in all RLS policies
    - This prevents re-evaluation for each row, significantly improving performance
    - Affects: topic_run_answers, stripe_customers, stripe_subscriptions, 
      stripe_orders, topic_runs, audit_logs, sponsor_ads, school_domains

  3. Note on Warnings
    - "Unused Index" warnings are expected for newly created tables
    - "Multiple Permissive Policies" are intentional design (admin OR owner access patterns)
    - Auth connection and password protection are configuration settings (non-migration)
*/

-- ============================================================================
-- PART 1: ADD MISSING FOREIGN KEY INDEXES
-- ============================================================================

-- profiles table
CREATE INDEX IF NOT EXISTS idx_profiles_school_id ON profiles(school_id);

-- question_analytics table
CREATE INDEX IF NOT EXISTS idx_question_analytics_question_set_id ON question_analytics(question_set_id);

-- question_sets table
CREATE INDEX IF NOT EXISTS idx_question_sets_approved_by ON question_sets(approved_by);
CREATE INDEX IF NOT EXISTS idx_question_sets_created_by ON question_sets(created_by);
CREATE INDEX IF NOT EXISTS idx_question_sets_topic_id ON question_sets(topic_id);

-- sponsor_banners table
CREATE INDEX IF NOT EXISTS idx_sponsor_banners_created_by ON sponsor_banners(created_by);

-- student_sessions table
CREATE INDEX IF NOT EXISTS idx_student_sessions_question_set_id ON student_sessions(question_set_id);

-- subscriptions table
CREATE INDEX IF NOT EXISTS idx_subscriptions_teacher_id ON subscriptions(teacher_id);

-- topic_questions table
CREATE INDEX IF NOT EXISTS idx_topic_questions_created_by ON topic_questions(created_by);

-- topic_run_answers table
CREATE INDEX IF NOT EXISTS idx_topic_run_answers_question_id ON topic_run_answers(question_id);

-- topic_runs table
CREATE INDEX IF NOT EXISTS idx_topic_runs_question_set_id ON topic_runs(question_set_id);
CREATE INDEX IF NOT EXISTS idx_topic_runs_topic_id ON topic_runs(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_runs_user_id ON topic_runs(user_id);

-- topics table
CREATE INDEX IF NOT EXISTS idx_topics_created_by ON topics(created_by);

-- ============================================================================
-- PART 2: FIX RLS POLICIES - REPLACE auth.uid() WITH (select auth.uid())
-- ============================================================================

-- Fix topic_run_answers policies
DROP POLICY IF EXISTS "Anyone can create run answers" ON topic_run_answers;
CREATE POLICY "Anyone can create run answers"
  ON topic_run_answers
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can read own run answers" ON topic_run_answers;
CREATE POLICY "Users can read own run answers"
  ON topic_run_answers
  FOR SELECT
  TO authenticated, anon
  USING (
    run_id IN (
      SELECT id FROM topic_runs 
      WHERE user_id = (select auth.uid()) 
      OR session_id IS NOT NULL
    )
  );

-- Fix stripe_customers policies
DROP POLICY IF EXISTS "Users can view their own customer data" ON stripe_customers;
CREATE POLICY "Users can view their own customer data"
  ON stripe_customers
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Fix stripe_subscriptions policies
DROP POLICY IF EXISTS "Users can view their own subscription data" ON stripe_subscriptions;
CREATE POLICY "Users can view their own subscription data"
  ON stripe_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT customer_id FROM stripe_customers 
      WHERE user_id = (select auth.uid())
    )
  );

-- Fix stripe_orders policies
DROP POLICY IF EXISTS "Users can view their own order data" ON stripe_orders;
CREATE POLICY "Users can view their own order data"
  ON stripe_orders
  FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT customer_id FROM stripe_customers 
      WHERE user_id = (select auth.uid())
    )
  );

-- Fix topic_runs policies
DROP POLICY IF EXISTS "Users can read own runs by session or user" ON topic_runs;
CREATE POLICY "Users can read own runs by session or user"
  ON topic_runs
  FOR SELECT
  TO authenticated, anon
  USING (
    user_id = (select auth.uid()) OR session_id IS NOT NULL
  );

DROP POLICY IF EXISTS "Users can update own runs by session or user" ON topic_runs;
CREATE POLICY "Users can update own runs by session or user"
  ON topic_runs
  FOR UPDATE
  TO authenticated, anon
  USING (
    user_id = (select auth.uid()) OR session_id IS NOT NULL
  )
  WITH CHECK (
    user_id = (select auth.uid()) OR session_id IS NOT NULL
  );

-- Fix audit_logs policies
DROP POLICY IF EXISTS "Admins can insert audit logs" ON audit_logs;
CREATE POLICY "Admins can insert audit logs"
  ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;
CREATE POLICY "Admins can view audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- Fix sponsor_ads policies
DROP POLICY IF EXISTS "Admins can manage sponsor ads" ON sponsor_ads;
CREATE POLICY "Admins can manage sponsor ads"
  ON sponsor_ads
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- Fix school_domains policies
DROP POLICY IF EXISTS "Admins can manage school domains" ON school_domains;
CREATE POLICY "Admins can manage school domains"
  ON school_domains
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

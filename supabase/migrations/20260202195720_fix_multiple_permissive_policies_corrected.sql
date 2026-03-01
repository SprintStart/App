/*
  # Fix Multiple Permissive Policies - Corrected Version
  
  1. Problem
    - Many tables have multiple permissive policies for the same role and action
    - This can lead to confusion and unintended access
  
  2. Solution
    - Combine similar policies into single policies with OR conditions
    - Keep admin policies separate as they provide full access
  
  3. Tables Fixed
    - profiles, public_quiz_answers, public_quiz_runs, question_sets
    - quiz_sessions, schools, sponsored_ads, stripe_customers
    - stripe_subscriptions, subscriptions, teacher_school_membership
    - topic_questions, topic_run_answers, topic_runs, topics
*/

-- profiles: Combine select policies
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
CREATE POLICY "profiles_select"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = id
    OR EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (
        SELECT email FROM auth.users WHERE id = (SELECT auth.uid())
      )::text
      AND admin_allowlist.is_active = true
    )
  );

-- public_quiz_answers: Combine select policies
DROP POLICY IF EXISTS "public_quiz_answers_select" ON public_quiz_answers;
DROP POLICY IF EXISTS "public_quiz_answers_admin" ON public_quiz_answers;
CREATE POLICY "public_quiz_answers_select"
  ON public_quiz_answers
  FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "public_quiz_answers_admin_all"
  ON public_quiz_answers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (
        SELECT email FROM auth.users WHERE id = (SELECT auth.uid())
      )::text
      AND admin_allowlist.is_active = true
    )
  );

-- public_quiz_runs: Combine policies
DROP POLICY IF EXISTS "public_quiz_runs_insert" ON public_quiz_runs;
DROP POLICY IF EXISTS "public_quiz_runs_select" ON public_quiz_runs;
DROP POLICY IF EXISTS "public_quiz_runs_admin" ON public_quiz_runs;
CREATE POLICY "public_quiz_runs_all_access"
  ON public_quiz_runs
  FOR ALL
  TO authenticated
  USING (
    true
    OR EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (
        SELECT email FROM auth.users WHERE id = (SELECT auth.uid())
      )::text
      AND admin_allowlist.is_active = true
    )
  )
  WITH CHECK (true);

-- question_sets: Combine teacher and admin policies
DROP POLICY IF EXISTS "question_sets_teacher" ON question_sets;
DROP POLICY IF EXISTS "question_sets_admin" ON question_sets;
CREATE POLICY "question_sets_all_access"
  ON question_sets
  FOR ALL
  TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (
        SELECT email FROM auth.users WHERE id = (SELECT auth.uid())
      )::text
      AND admin_allowlist.is_active = true
    )
  );

-- quiz_sessions: Combine policies
DROP POLICY IF EXISTS "quiz_sessions_insert" ON quiz_sessions;
DROP POLICY IF EXISTS "quiz_sessions_select" ON quiz_sessions;
DROP POLICY IF EXISTS "quiz_sessions_update" ON quiz_sessions;
DROP POLICY IF EXISTS "quiz_sessions_delete" ON quiz_sessions;
DROP POLICY IF EXISTS "quiz_sessions_admin" ON quiz_sessions;
CREATE POLICY "quiz_sessions_all_access"
  ON quiz_sessions
  FOR ALL
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR user_id IS NULL
    OR EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (
        SELECT email FROM auth.users WHERE id = (SELECT auth.uid())
      )::text
      AND admin_allowlist.is_active = true
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR user_id IS NULL
  );

-- schools: Combine policies
DROP POLICY IF EXISTS "schools_select" ON schools;
DROP POLICY IF EXISTS "schools_admin" ON schools;
CREATE POLICY "schools_select"
  ON schools
  FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "schools_admin_modify"
  ON schools
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (
        SELECT email FROM auth.users WHERE id = (SELECT auth.uid())
      )::text
      AND admin_allowlist.is_active = true
    )
  );

-- sponsored_ads: Combine policies
DROP POLICY IF EXISTS "sponsored_ads_select" ON sponsored_ads;
DROP POLICY IF EXISTS "sponsored_ads_admin" ON sponsored_ads;
CREATE POLICY "sponsored_ads_select"
  ON sponsored_ads
  FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "sponsored_ads_admin_modify"
  ON sponsored_ads
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (
        SELECT email FROM auth.users WHERE id = (SELECT auth.uid())
      )::text
      AND admin_allowlist.is_active = true
    )
  );

-- stripe_customers: Combine policies
DROP POLICY IF EXISTS "Users can view own stripe customer" ON stripe_customers;
DROP POLICY IF EXISTS "Admins can read all stripe customers" ON stripe_customers;
CREATE POLICY "stripe_customers_select"
  ON stripe_customers
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (
        SELECT email FROM auth.users WHERE id = (SELECT auth.uid())
      )::text
      AND admin_allowlist.is_active = true
    )
  );

-- stripe_subscriptions: Combine policies (uses customer_id to find user)
DROP POLICY IF EXISTS "Users can view own stripe subscription" ON stripe_subscriptions;
DROP POLICY IF EXISTS "Admins can read all stripe subscriptions" ON stripe_subscriptions;
CREATE POLICY "stripe_subscriptions_select"
  ON stripe_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT customer_id FROM stripe_customers WHERE user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (
        SELECT email FROM auth.users WHERE id = (SELECT auth.uid())
      )::text
      AND admin_allowlist.is_active = true
    )
  );

-- subscriptions: Combine policies
DROP POLICY IF EXISTS "subscriptions_user" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_admin" ON subscriptions;
CREATE POLICY "subscriptions_all_access"
  ON subscriptions
  FOR ALL
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (
        SELECT email FROM auth.users WHERE id = (SELECT auth.uid())
      )::text
      AND admin_allowlist.is_active = true
    )
  );

-- teacher_school_membership: Combine policies
DROP POLICY IF EXISTS "teacher_school_membership_select" ON teacher_school_membership;
DROP POLICY IF EXISTS "teacher_school_membership_admin" ON teacher_school_membership;
CREATE POLICY "teacher_school_membership_select"
  ON teacher_school_membership
  FOR SELECT
  TO authenticated
  USING (
    teacher_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (
        SELECT email FROM auth.users WHERE id = (SELECT auth.uid())
      )::text
      AND admin_allowlist.is_active = true
    )
  );

-- topic_questions: Combine policies
DROP POLICY IF EXISTS "topic_questions_teacher" ON topic_questions;
DROP POLICY IF EXISTS "topic_questions_admin" ON topic_questions;
CREATE POLICY "topic_questions_all_access"
  ON topic_questions
  FOR ALL
  TO authenticated
  USING (
    question_set_id IN (
      SELECT id FROM question_sets WHERE created_by = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (
        SELECT email FROM auth.users WHERE id = (SELECT auth.uid())
      )::text
      AND admin_allowlist.is_active = true
    )
  );

-- topic_run_answers: Combine policies
DROP POLICY IF EXISTS "Anyone can create answers" ON topic_run_answers;
DROP POLICY IF EXISTS "topic_run_answers_select" ON topic_run_answers;
DROP POLICY IF EXISTS "topic_run_answers_admin" ON topic_run_answers;
CREATE POLICY "topic_run_answers_all_access"
  ON topic_run_answers
  FOR ALL
  TO authenticated
  USING (
    run_id IN (
      SELECT id FROM topic_runs WHERE user_id = (SELECT auth.uid()) OR user_id IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (
        SELECT email FROM auth.users WHERE id = (SELECT auth.uid())
      )::text
      AND admin_allowlist.is_active = true
    )
  )
  WITH CHECK (true);

-- topic_runs: Combine policies
DROP POLICY IF EXISTS "Anyone can create runs" ON topic_runs;
DROP POLICY IF EXISTS "Users can update own runs" ON topic_runs;
DROP POLICY IF EXISTS "topic_runs_select" ON topic_runs;
DROP POLICY IF EXISTS "topic_runs_admin" ON topic_runs;
CREATE POLICY "topic_runs_all_access"
  ON topic_runs
  FOR ALL
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR user_id IS NULL
    OR EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (
        SELECT email FROM auth.users WHERE id = (SELECT auth.uid())
      )::text
      AND admin_allowlist.is_active = true
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR user_id IS NULL
  );

-- topics: Combine policies
DROP POLICY IF EXISTS "topics_select" ON topics;
DROP POLICY IF EXISTS "topics_admin" ON topics;
CREATE POLICY "topics_select"
  ON topics
  FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "topics_admin_modify"
  ON topics
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (
        SELECT email FROM auth.users WHERE id = (SELECT auth.uid())
      )::text
      AND admin_allowlist.is_active = true
    )
  );

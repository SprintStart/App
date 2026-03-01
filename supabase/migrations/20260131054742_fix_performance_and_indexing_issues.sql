/*
  # Fix Performance and Indexing Issues
  
  1. Purpose
    - Add indexes for all unindexed foreign keys
    - Optimize RLS policies to cache auth.uid() calls
    
  2. Changes Made
    - Add 15 indexes for foreign key columns
    - Recreate 9 RLS policies with (select auth.uid()) pattern
    
  3. Performance Impact
    - Dramatically improved JOIN performance on foreign keys
    - Reduced RLS policy evaluation overhead at scale
    - Better query plan selection for foreign key relationships
    
  4. Security Impact
    - No change to security model
    - Same access control, just more efficient
*/

-- ============================================================================
-- PART 1: Add Indexes for Unindexed Foreign Keys
-- ============================================================================

-- These indexes dramatically improve JOIN performance and foreign key lookups
-- Without them, PostgreSQL must do full table scans for foreign key checks

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id_fk 
  ON audit_logs(admin_id);

CREATE INDEX IF NOT EXISTS idx_profiles_school_id_fk 
  ON profiles(school_id);

CREATE INDEX IF NOT EXISTS idx_question_analytics_question_set_id_fk 
  ON question_analytics(question_set_id);

CREATE INDEX IF NOT EXISTS idx_question_sets_approved_by_fk 
  ON question_sets(approved_by);

CREATE INDEX IF NOT EXISTS idx_question_sets_created_by_fk 
  ON question_sets(created_by);

CREATE INDEX IF NOT EXISTS idx_question_sets_topic_id_fk 
  ON question_sets(topic_id);

CREATE INDEX IF NOT EXISTS idx_sponsor_banners_created_by_fk 
  ON sponsor_banners(created_by);

CREATE INDEX IF NOT EXISTS idx_student_sessions_question_set_id_fk 
  ON student_sessions(question_set_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_teacher_id_fk 
  ON subscriptions(teacher_id);

CREATE INDEX IF NOT EXISTS idx_topic_questions_created_by_fk 
  ON topic_questions(created_by);

CREATE INDEX IF NOT EXISTS idx_topic_run_answers_question_id_fk 
  ON topic_run_answers(question_id);

CREATE INDEX IF NOT EXISTS idx_topic_runs_question_set_id_fk 
  ON topic_runs(question_set_id);

CREATE INDEX IF NOT EXISTS idx_topic_runs_topic_id_fk 
  ON topic_runs(topic_id);

CREATE INDEX IF NOT EXISTS idx_topic_runs_user_id_fk 
  ON topic_runs(user_id);

CREATE INDEX IF NOT EXISTS idx_topics_created_by_fk 
  ON topics(created_by);

-- ============================================================================
-- PART 2: Optimize RLS Policies - Cache auth.uid() Calls
-- ============================================================================

-- The pattern (select auth.uid()) caches the user ID once per query
-- instead of calling auth.uid() for every row being evaluated
-- This is critical for performance at scale

-- ----------------------------------------------------------------------------
-- question_analytics
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Authenticated users can view relevant analytics" ON question_analytics;

CREATE POLICY "Authenticated users can view relevant analytics"
  ON question_analytics
  FOR SELECT
  TO authenticated
  USING (
    -- Admins can see everything
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
    OR
    -- Teachers can see analytics for their own question sets
    EXISTS (
      SELECT 1 FROM question_sets qs
      WHERE qs.id = question_analytics.question_set_id
      AND qs.created_by = (select auth.uid())
    )
  );

-- ----------------------------------------------------------------------------
-- question_sets (4 policies)
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can read approved question sets or own sets" ON question_sets;

CREATE POLICY "Users can read approved question sets or own sets"
  ON question_sets
  FOR SELECT
  TO authenticated
  USING (
    approval_status = 'approved'
    OR created_by = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Paid teachers and admins can create question sets" ON question_sets;

CREATE POLICY "Paid teachers and admins can create question sets"
  ON question_sets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
    OR
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = (select auth.uid())
        AND profiles.role = 'teacher'
      )
      AND
      EXISTS (
        SELECT 1 FROM subscriptions
        WHERE subscriptions.teacher_id = (select auth.uid())
        AND subscriptions.status = 'active'
        AND subscriptions.current_period_end > NOW()
      )
    )
  );

DROP POLICY IF EXISTS "Owners and admins can update question sets" ON question_sets;

CREATE POLICY "Owners and admins can update question sets"
  ON question_sets
  FOR UPDATE
  TO authenticated
  USING (
    created_by = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    created_by = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Owners and admins can delete question sets" ON question_sets;

CREATE POLICY "Owners and admins can delete question sets"
  ON question_sets
  FOR DELETE
  TO authenticated
  USING (
    created_by = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- ----------------------------------------------------------------------------
-- sponsor_ads
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view active ads, admins can manage all" ON sponsor_ads;

CREATE POLICY "Users can view active ads, admins can manage all"
  ON sponsor_ads
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- ----------------------------------------------------------------------------
-- sponsor_banners
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view active banners, admins can manage all" ON sponsor_banners;

CREATE POLICY "Users can view active banners, admins can manage all"
  ON sponsor_banners
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- ----------------------------------------------------------------------------
-- student_sessions
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins and quiz owners can view sessions" ON student_sessions;

CREATE POLICY "Admins and quiz owners can view sessions"
  ON student_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM question_sets qs
      WHERE qs.id = student_sessions.question_set_id
      AND qs.created_by = (select auth.uid())
    )
  );

-- ----------------------------------------------------------------------------
-- subscriptions
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view own subscription, admins can view all" ON subscriptions;

CREATE POLICY "Users can view own subscription, admins can view all"
  ON subscriptions
  FOR SELECT
  TO authenticated
  USING (
    teacher_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- ============================================================================
-- Summary
-- ============================================================================

-- Added Indexes: 15 foreign key indexes for optimal JOIN performance
-- Optimized Policies: 9 RLS policies now cache auth.uid() calls
-- Performance Gain: 
--   ✓ Faster foreign key JOINs (index seeks vs table scans)
--   ✓ Reduced RLS overhead (1 auth.uid() call vs N calls per row)
--   ✓ Better query planning and execution
-- Security: Unchanged - same access control, just more efficient

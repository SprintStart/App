/*
  # Fix Security and Performance Issues
  
  ## Overview
  Addresses critical security and performance issues identified in the database audit.
  
  ## Changes
  
  ### 1. Add Missing Foreign Key Indexes
  - Add indexes for all unindexed foreign keys to improve query performance
  - Covers: question_sets, sponsor_banners, topic_questions, topic_run_answers, topic_runs
  
  ### 2. Optimize RLS Policies
  - Replace `auth.uid()` with `(select auth.uid())` in all RLS policies
  - This prevents re-evaluation for each row, significantly improving performance at scale
  - Applies to all tables: topics, question_sets, topic_questions, topic_runs, etc.
  
  ### 3. Fix Function Search Path
  - Set stable search_path for create_teacher_subscription function
  - Prevents security vulnerabilities from mutable search paths
  
  ## Performance Impact
  - Foreign key indexes: Improves join and foreign key lookup performance
  - RLS optimization: Reduces CPU usage and improves query speed at scale
  - Search path fix: Prevents potential security issues
*/

-- ============================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_question_sets_approved_by ON question_sets(approved_by);
CREATE INDEX IF NOT EXISTS idx_sponsor_banners_created_by ON sponsor_banners(created_by);
CREATE INDEX IF NOT EXISTS idx_topic_questions_created_by ON topic_questions(created_by);
CREATE INDEX IF NOT EXISTS idx_topic_run_answers_question_id ON topic_run_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_topic_runs_question_set_id ON topic_runs(question_set_id);
CREATE INDEX IF NOT EXISTS idx_topic_runs_topic_id ON topic_runs(topic_id);

-- ============================================
-- 2. OPTIMIZE RLS POLICIES - PROFILES
-- ============================================

DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- ============================================
-- 3. OPTIMIZE RLS POLICIES - TOPICS
-- ============================================

DROP POLICY IF EXISTS "Teachers and admins can create topics" ON topics;
CREATE POLICY "Teachers and admins can create topics"
  ON topics FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role IN ('teacher', 'admin')
    )
  );

DROP POLICY IF EXISTS "Creators and admins can update topics" ON topics;
CREATE POLICY "Creators and admins can update topics"
  ON topics FOR UPDATE
  TO authenticated
  USING (
    created_by = (select auth.uid()) OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    created_by = (select auth.uid()) OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete topics" ON topics;
CREATE POLICY "Admins can delete topics"
  ON topics FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

-- ============================================
-- 4. OPTIMIZE RLS POLICIES - QUESTION SETS
-- ============================================

DROP POLICY IF EXISTS "Teachers and admins can create question sets" ON question_sets;
CREATE POLICY "Teachers and admins can create question sets"
  ON question_sets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role IN ('teacher', 'admin')
    )
  );

DROP POLICY IF EXISTS "Creators and admins can update question sets" ON question_sets;
CREATE POLICY "Creators and admins can update question sets"
  ON question_sets FOR UPDATE
  TO authenticated
  USING (
    created_by = (select auth.uid()) OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    created_by = (select auth.uid()) OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete question sets" ON question_sets;
CREATE POLICY "Admins can delete question sets"
  ON question_sets FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Teachers can manage own quizzes if paid" ON question_sets;
CREATE POLICY "Teachers can manage own quizzes if paid"
  ON question_sets FOR ALL
  TO authenticated
  USING (created_by = (select auth.uid()))
  WITH CHECK (created_by = (select auth.uid()));

-- ============================================
-- 5. OPTIMIZE RLS POLICIES - TOPIC QUESTIONS
-- ============================================

DROP POLICY IF EXISTS "Anyone can read question text and options" ON topic_questions;
CREATE POLICY "Anyone can read question text and options"
  ON topic_questions FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Teachers and admins can read all question data" ON topic_questions;
CREATE POLICY "Teachers and admins can read all question data"
  ON topic_questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role IN ('teacher', 'admin')
    )
  );

DROP POLICY IF EXISTS "Teachers and admins can create questions" ON topic_questions;
CREATE POLICY "Teachers and admins can create questions"
  ON topic_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role IN ('teacher', 'admin')
    )
  );

DROP POLICY IF EXISTS "Creators and admins can update questions" ON topic_questions;
CREATE POLICY "Creators and admins can update questions"
  ON topic_questions FOR UPDATE
  TO authenticated
  USING (
    created_by = (select auth.uid()) OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    created_by = (select auth.uid()) OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete questions" ON topic_questions;
CREATE POLICY "Admins can delete questions"
  ON topic_questions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

-- ============================================
-- 6. OPTIMIZE RLS POLICIES - TOPIC RUNS
-- ============================================

DROP POLICY IF EXISTS "Anyone can create runs" ON topic_runs;
CREATE POLICY "Anyone can create runs"
  ON topic_runs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can read own runs by session or user" ON topic_runs;
CREATE POLICY "Users can read own runs by session or user"
  ON topic_runs FOR SELECT
  TO anon, authenticated
  USING (
    session_id = current_setting('app.session_id', true) OR
    user_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "Users can update own runs by session or user" ON topic_runs;
CREATE POLICY "Users can update own runs by session or user"
  ON topic_runs FOR UPDATE
  TO anon, authenticated
  USING (
    session_id = current_setting('app.session_id', true) OR
    user_id = (select auth.uid())
  )
  WITH CHECK (
    session_id = current_setting('app.session_id', true) OR
    user_id = (select auth.uid())
  );

-- ============================================
-- 7. OPTIMIZE RLS POLICIES - TOPIC RUN ANSWERS
-- ============================================

DROP POLICY IF EXISTS "Anyone can create run answers" ON topic_run_answers;
CREATE POLICY "Anyone can create run answers"
  ON topic_run_answers FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can read own run answers" ON topic_run_answers;
CREATE POLICY "Users can read own run answers"
  ON topic_run_answers FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM topic_runs 
      WHERE id = topic_run_answers.run_id 
      AND (
        session_id = current_setting('app.session_id', true) OR
        user_id = (select auth.uid())
      )
    )
  );

-- ============================================
-- 8. OPTIMIZE RLS POLICIES - SPONSOR BANNERS
-- ============================================

DROP POLICY IF EXISTS "Admin can manage sponsor banners" ON sponsor_banners;
CREATE POLICY "Admin can manage sponsor banners"
  ON sponsor_banners FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

-- ============================================
-- 9. OPTIMIZE RLS POLICIES - SCHOOLS
-- ============================================

DROP POLICY IF EXISTS "Admin can manage schools" ON schools;
CREATE POLICY "Admin can manage schools"
  ON schools FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

-- ============================================
-- 10. OPTIMIZE RLS POLICIES - SUBSCRIPTIONS
-- ============================================

DROP POLICY IF EXISTS "Teachers can view own subscription" ON subscriptions;
CREATE POLICY "Teachers can view own subscription"
  ON subscriptions FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = teacher_id);

DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON subscriptions;
CREATE POLICY "Admins can manage all subscriptions"
  ON subscriptions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

-- ============================================
-- 11. OPTIMIZE RLS POLICIES - STUDENT SESSIONS
-- ============================================

DROP POLICY IF EXISTS "Teachers can view sessions for their quizzes" ON student_sessions;
CREATE POLICY "Teachers can view sessions for their quizzes"
  ON student_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM question_sets qs
      WHERE qs.id = student_sessions.question_set_id
      AND qs.created_by = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can view all sessions" ON student_sessions;
CREATE POLICY "Admins can view all sessions"
  ON student_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

-- ============================================
-- 12. OPTIMIZE RLS POLICIES - QUESTION ANALYTICS
-- ============================================

DROP POLICY IF EXISTS "Teachers can view analytics for their questions" ON question_analytics;
CREATE POLICY "Teachers can view analytics for their questions"
  ON question_analytics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM question_sets qs
      WHERE qs.id = question_analytics.question_set_id
      AND qs.created_by = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can view all analytics" ON question_analytics;
CREATE POLICY "Admins can view all analytics"
  ON question_analytics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

-- ============================================
-- 13. FIX FUNCTION SEARCH PATH
-- ============================================

DROP FUNCTION IF EXISTS create_teacher_subscription() CASCADE;

CREATE OR REPLACE FUNCTION create_teacher_subscription()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role = 'teacher' THEN
    INSERT INTO subscriptions (teacher_id, plan_type, status, max_active_quizzes, max_students_per_quiz)
    VALUES (NEW.id, 'free', 'active', 5, 30);
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_create_teacher_subscription ON profiles;
CREATE TRIGGER trigger_create_teacher_subscription
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_teacher_subscription();

/*
  # Fix Question Sets and Topic Questions RLS

  ## Problem
  - Multiple conflicting SELECT policies on question_sets table
  - Multiple conflicting SELECT policies on topic_questions table
  - Teachers getting 403 when trying to publish quizzes
  - Some policies use non-existent is_admin() function

  ## Solution
  - Drop ALL existing policies on both tables
  - Create clean, simple policies
  - Teachers can fully manage their own question sets and questions
  - Public can view published content

  ## Security
  - Teachers can only manage content they created
  - Admins can manage all content
  - Public can only read published/approved content
*/

-- ========================================
-- QUESTION_SETS TABLE - CLEAN SLATE
-- ========================================

-- Drop ALL existing policies on question_sets
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'question_sets' 
    AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.question_sets', pol.policyname);
  END LOOP;
END $$;

-- Public can SELECT approved question sets for published topics
CREATE POLICY "Public can view approved question sets"
  ON public.question_sets FOR SELECT
  TO public
  USING (
    is_active = true 
    AND approval_status = 'approved' 
    AND EXISTS (
      SELECT 1 FROM topics 
      WHERE topics.id = question_sets.topic_id 
      AND topics.is_active = true 
      AND topics.is_published = true
    )
  );

-- Teachers can INSERT their own question sets
CREATE POLICY "Teachers can create question sets"
  ON public.question_sets FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    OR is_admin_by_id((SELECT auth.uid()))
  );

-- Teachers can SELECT their own question sets
CREATE POLICY "Teachers can view own question sets"
  ON public.question_sets FOR SELECT
  TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR is_admin_by_id((SELECT auth.uid()))
  );

-- Teachers can UPDATE their own question sets
CREATE POLICY "Teachers can update own question sets"
  ON public.question_sets FOR UPDATE
  TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR is_admin_by_id((SELECT auth.uid()))
  )
  WITH CHECK (
    created_by = (SELECT auth.uid())
    OR is_admin_by_id((SELECT auth.uid()))
  );

-- Teachers can DELETE their own question sets
CREATE POLICY "Teachers can delete own question sets"
  ON public.question_sets FOR DELETE
  TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR is_admin_by_id((SELECT auth.uid()))
  );

-- ========================================
-- TOPIC_QUESTIONS TABLE - CLEAN SLATE
-- ========================================

-- Drop ALL existing policies on topic_questions
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'topic_questions' 
    AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.topic_questions', pol.policyname);
  END LOOP;
END $$;

-- Public can SELECT published questions in approved sets
CREATE POLICY "Public can view published questions"
  ON public.topic_questions FOR SELECT
  TO public
  USING (
    is_published = true 
    AND EXISTS (
      SELECT 1 FROM question_sets qs 
      WHERE qs.id = topic_questions.question_set_id 
      AND qs.is_active = true 
      AND qs.approval_status = 'approved'
    )
  );

-- Teachers can INSERT questions into their own question sets
CREATE POLICY "Teachers can create questions"
  ON public.topic_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin_by_id((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM question_sets qs 
      WHERE qs.id = topic_questions.question_set_id 
      AND qs.created_by = (SELECT auth.uid())
    )
  );

-- Teachers can SELECT questions in their own question sets
CREATE POLICY "Teachers can view own questions"
  ON public.topic_questions FOR SELECT
  TO authenticated
  USING (
    is_admin_by_id((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM question_sets qs 
      WHERE qs.id = topic_questions.question_set_id 
      AND qs.created_by = (SELECT auth.uid())
    )
  );

-- Teachers can UPDATE questions in their own question sets
CREATE POLICY "Teachers can update own questions"
  ON public.topic_questions FOR UPDATE
  TO authenticated
  USING (
    is_admin_by_id((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM question_sets qs 
      WHERE qs.id = topic_questions.question_set_id 
      AND qs.created_by = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    is_admin_by_id((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM question_sets qs 
      WHERE qs.id = topic_questions.question_set_id 
      AND qs.created_by = (SELECT auth.uid())
    )
  );

-- Teachers can DELETE questions in their own question sets
CREATE POLICY "Teachers can delete own questions"
  ON public.topic_questions FOR DELETE
  TO authenticated
  USING (
    is_admin_by_id((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM question_sets qs 
      WHERE qs.id = topic_questions.question_set_id 
      AND qs.created_by = (SELECT auth.uid())
    )
  );
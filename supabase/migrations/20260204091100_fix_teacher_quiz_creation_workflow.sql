/*
  # Fix Teacher Quiz Creation Workflow - RLS + Policies

  ## Problem
  Teachers get 403 Forbidden when creating topics because the RLS policy
  uses USING clause for INSERT, which fails since the row doesn't exist yet.

  ## Changes

  1. **Topics Table**
     - Split "Manage topics" policy into separate INSERT, UPDATE, DELETE policies
     - INSERT: Only check WITH CHECK (created_by = auth.uid())
     - UPDATE/DELETE: Check USING (created_by = auth.uid())
     - Keep SELECT policy for anonymous users

  2. **Question Sets Table**
     - Split "Manage question sets" into separate policies
     - Same pattern as topics

  3. **Topic Questions Table**
     - Split "Manage questions" into separate policies
     - Verify ownership through question_sets.created_by

  ## Security
  - Teachers can only create/modify their own content
  - Admins have full access to all content
  - Anonymous users can view active/approved content only

  ## Required for Production
  - Teachers must be able to create topics
  - Teachers must be able to create question sets (quizzes)
  - Teachers must be able to add questions (manual/AI/upload)
*/

-- ============================================================================
-- FIX TOPICS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Manage topics" ON public.topics;

-- Allow authenticated users to INSERT topics with themselves as creator
CREATE POLICY "Teachers can insert topics"
  ON public.topics FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()) OR is_admin_by_id((SELECT auth.uid())));

-- Allow users to SELECT their own topics, admins can see all
CREATE POLICY "Teachers can view own topics"
  ON public.topics FOR SELECT
  TO authenticated
  USING (created_by = (SELECT auth.uid()) OR is_admin_by_id((SELECT auth.uid())));

-- Allow users to UPDATE their own topics
CREATE POLICY "Teachers can update own topics"
  ON public.topics FOR UPDATE
  TO authenticated
  USING (created_by = (SELECT auth.uid()) OR is_admin_by_id((SELECT auth.uid())))
  WITH CHECK (created_by = (SELECT auth.uid()) OR is_admin_by_id((SELECT auth.uid())));

-- Allow users to DELETE their own topics
CREATE POLICY "Teachers can delete own topics"
  ON public.topics FOR DELETE
  TO authenticated
  USING (created_by = (SELECT auth.uid()) OR is_admin_by_id((SELECT auth.uid())));

-- Keep anonymous view policy
-- View active topics policy already exists from line 155-157

-- ============================================================================
-- FIX QUESTION_SETS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Manage question sets" ON public.question_sets;

CREATE POLICY "Teachers can insert question sets"
  ON public.question_sets FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()) OR is_admin_by_id((SELECT auth.uid())));

CREATE POLICY "Teachers can view own question sets"
  ON public.question_sets FOR SELECT
  TO authenticated
  USING (
    is_admin_by_id((SELECT auth.uid())) OR
    created_by = (SELECT auth.uid())
  );

CREATE POLICY "Teachers can update own question sets"
  ON public.question_sets FOR UPDATE
  TO authenticated
  USING (created_by = (SELECT auth.uid()) OR is_admin_by_id((SELECT auth.uid())))
  WITH CHECK (created_by = (SELECT auth.uid()) OR is_admin_by_id((SELECT auth.uid())));

CREATE POLICY "Teachers can delete own question sets"
  ON public.question_sets FOR DELETE
  TO authenticated
  USING (created_by = (SELECT auth.uid()) OR is_admin_by_id((SELECT auth.uid())));

-- Anonymous view policy already exists

-- ============================================================================
-- FIX TOPIC_QUESTIONS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Manage questions" ON public.topic_questions;

CREATE POLICY "Teachers can insert questions"
  ON public.topic_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin_by_id((SELECT auth.uid())) OR
    EXISTS (
      SELECT 1 FROM public.question_sets qs
      WHERE qs.id = topic_questions.question_set_id
      AND qs.created_by = (SELECT auth.uid())
    )
  );

CREATE POLICY "Teachers can view own questions"
  ON public.topic_questions FOR SELECT
  TO authenticated
  USING (
    is_admin_by_id((SELECT auth.uid())) OR
    EXISTS (
      SELECT 1 FROM public.question_sets qs
      WHERE qs.id = topic_questions.question_set_id
      AND qs.created_by = (SELECT auth.uid())
    )
  );

CREATE POLICY "Teachers can update own questions"
  ON public.topic_questions FOR UPDATE
  TO authenticated
  USING (
    is_admin_by_id((SELECT auth.uid())) OR
    EXISTS (
      SELECT 1 FROM public.question_sets qs
      WHERE qs.id = topic_questions.question_set_id
      AND qs.created_by = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    is_admin_by_id((SELECT auth.uid())) OR
    EXISTS (
      SELECT 1 FROM public.question_sets qs
      WHERE qs.id = topic_questions.question_set_id
      AND qs.created_by = (SELECT auth.uid())
    )
  );

CREATE POLICY "Teachers can delete own questions"
  ON public.topic_questions FOR DELETE
  TO authenticated
  USING (
    is_admin_by_id((SELECT auth.uid())) OR
    EXISTS (
      SELECT 1 FROM public.question_sets qs
      WHERE qs.id = topic_questions.question_set_id
      AND qs.created_by = (SELECT auth.uid())
    )
  );

-- Anonymous view policy already exists

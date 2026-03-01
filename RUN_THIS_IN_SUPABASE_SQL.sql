-- ============================================================================
-- COPY AND PASTE THIS ENTIRE FILE INTO SUPABASE SQL EDITOR AND RUN IT
-- ============================================================================
-- This fixes the RLS policies preventing questions from being saved
-- Location: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new
-- ============================================================================

-- 1. Fix topic_questions INSERT policy (allows teachers to add questions)
DROP POLICY IF EXISTS "Teachers can create questions" ON topic_questions;
DROP POLICY IF EXISTS "Authenticated users can insert own questions" ON topic_questions;

CREATE POLICY "Authenticated users can insert own questions"
  ON topic_questions FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- 2. Ensure question_sets are readable by their creators
DROP POLICY IF EXISTS "Authenticated users can view active question sets" ON question_sets;

CREATE POLICY "Authenticated users can view active question sets"
  ON question_sets FOR SELECT
  TO authenticated
  USING (
    is_active = true
    OR created_by = auth.uid()
  );

-- 3. Fix topic_questions UPDATE policy (allows teachers to edit their questions)
DROP POLICY IF EXISTS "Teachers can update own questions" ON topic_questions;

CREATE POLICY "Authenticated users can update own questions"
  ON topic_questions FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- 4. Ensure teachers can see their own question sets for editing
DROP POLICY IF EXISTS "Teachers can view own question sets" ON question_sets;

CREATE POLICY "Teachers can view own question sets"
  ON question_sets FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- Verification query: Run this after to confirm policies are correct
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('topic_questions', 'question_sets')
AND cmd IN ('INSERT', 'SELECT')
ORDER BY tablename, cmd, policyname;

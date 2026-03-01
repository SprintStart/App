/*
  # Fix RLS Policies That Reference auth.users Directly

  ## Problem
  Multiple RLS policies are directly querying the `auth.users` table which can cause:
  - 401/403 errors due to permission issues
  - Performance problems
  - RLS recursion issues

  ## Solution
  1. Create a helper function to safely get current user's email
  2. Update all affected RLS policies to use the helper function

  ## Tables Fixed
  - public_quiz_answers
  - teacher_activities
  - teacher_documents
  - teacher_entitlements
  - teacher_premium_overrides
  - teacher_quiz_drafts
  - teacher_reports
*/

-- Create helper function to safely get current user's email
CREATE OR REPLACE FUNCTION get_current_user_email()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT raw_user_meta_data->>'email' FROM auth.users WHERE id = auth.uid()),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    ''
  );
$$;

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_allowlist
    WHERE email = get_current_user_email()
    AND is_active = true
  );
$$;

-- Fix public_quiz_answers policy
DROP POLICY IF EXISTS "public_quiz_answers_select_all" ON public_quiz_answers;
CREATE POLICY "public_quiz_answers_select_all"
  ON public_quiz_answers FOR SELECT
  TO authenticated
  USING (
    run_id IN (
      SELECT qr.id FROM public_quiz_runs qr
      JOIN quiz_sessions qs ON qs.id = qr.quiz_session_id
      WHERE qs.user_id = auth.uid()
    )
    OR run_id IN (
      SELECT qr.id FROM public_quiz_runs qr
      JOIN topics t ON t.id = qr.topic_id
      WHERE t.created_by = auth.uid()
    )
    OR is_current_user_admin()
  );

-- Fix teacher_activities policy
DROP POLICY IF EXISTS "Authenticated users view activities" ON teacher_activities;
CREATE POLICY "Authenticated users view activities"
  ON teacher_activities FOR SELECT
  TO authenticated
  USING (
    teacher_id = auth.uid()
    OR is_current_user_admin()
  );

-- Fix teacher_documents policy
DROP POLICY IF EXISTS "Authenticated users view documents" ON teacher_documents;
CREATE POLICY "Authenticated users view documents"
  ON teacher_documents FOR SELECT
  TO authenticated
  USING (
    teacher_id = auth.uid()
    OR is_current_user_admin()
  );

-- Fix teacher_entitlements policy
DROP POLICY IF EXISTS "Authenticated users view entitlements" ON teacher_entitlements;
CREATE POLICY "Authenticated users view entitlements"
  ON teacher_entitlements FOR SELECT
  TO authenticated
  USING (
    teacher_user_id = auth.uid()
    OR is_current_user_admin()
  );

-- Fix teacher_premium_overrides policy
DROP POLICY IF EXISTS "Authenticated users view overrides" ON teacher_premium_overrides;
CREATE POLICY "Authenticated users view overrides"
  ON teacher_premium_overrides FOR SELECT
  TO authenticated
  USING (
    teacher_id = auth.uid()
    OR is_current_user_admin()
  );

-- Fix teacher_quiz_drafts policy
DROP POLICY IF EXISTS "Authenticated users view drafts" ON teacher_quiz_drafts;
CREATE POLICY "Authenticated users view drafts"
  ON teacher_quiz_drafts FOR SELECT
  TO authenticated
  USING (
    teacher_id = auth.uid()
    OR is_current_user_admin()
  );

-- Fix teacher_reports policy
DROP POLICY IF EXISTS "Authenticated users view reports" ON teacher_reports;
CREATE POLICY "Authenticated users view reports"
  ON teacher_reports FOR SELECT
  TO authenticated
  USING (
    teacher_id = auth.uid()
    OR is_current_user_admin()
  );

/*
  # Add Teacher SELECT Policy for Topics

  ## Problem
  - Teachers can INSERT/UPDATE/DELETE their own topics
  - But there's no SELECT policy for authenticated teachers to view their own topics
  - This causes 403 errors during quiz publish workflow

  ## Solution
  - Add SELECT policy for authenticated teachers to view their own topics
  - This allows teachers to see both active AND draft topics they created

  ## Security
  - Teachers can only SELECT topics they created (created_by = auth.uid())
  - Admins can SELECT all topics (is_admin_by_id check)
*/

-- Allow authenticated teachers to SELECT their own topics
CREATE POLICY "Teachers can view own topics"
  ON public.topics FOR SELECT
  TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR is_admin_by_id((SELECT auth.uid()))
  );
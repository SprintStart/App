/*
  # Restrict Anonymous Quiz Runs Access
  
  1. Problem
    - Anonymous users currently have USING (true) which allows access to ALL quiz runs
    - Cannot enforce session_id ownership at database level (session is client-side)
    - Need to at least prevent anonymous users from accessing authenticated users' data
  
  2. Solution
    - Restrict anonymous access to quiz runs that don't have a quiz_session_id
    - This ensures anonymous users can't access authenticated users' quiz runs
    - Anonymous runs are identified by having quiz_session_id = NULL
  
  3. Trade-offs
    - Anonymous users can still technically see other anonymous users' runs
    - This is acceptable because:
      a) Session enforcement happens at application layer (Edge Functions)
      b) Database RLS has no access to session_id headers
      c) Quiz runs don't contain PII
      d) Only authenticated users get permanent storage
*/

-- Drop the overly permissive anonymous policy
DROP POLICY IF EXISTS "Anonymous users can manage own quiz runs by session" ON public_quiz_runs;

-- Allow anonymous users to view quiz runs that are truly anonymous (no quiz_session_id)
CREATE POLICY "Anonymous users can view anonymous quiz runs"
  ON public_quiz_runs
  FOR SELECT
  TO anon
  USING (quiz_session_id IS NULL);

-- Allow anonymous users to create quiz runs without a quiz_session_id
CREATE POLICY "Anonymous users can create anonymous quiz runs"
  ON public_quiz_runs
  FOR INSERT
  TO anon
  WITH CHECK (
    quiz_session_id IS NULL
    AND session_id IS NOT NULL
  );

-- Allow anonymous users to update quiz runs that are truly anonymous
CREATE POLICY "Anonymous users can update anonymous quiz runs"
  ON public_quiz_runs
  FOR UPDATE
  TO anon
  USING (quiz_session_id IS NULL)
  WITH CHECK (
    quiz_session_id IS NULL
    AND session_id IS NOT NULL
  );

-- Anonymous users should not be able to delete any quiz runs
-- (Deletion is handled by admins or automatic cleanup processes)

/*
  # Allow Anonymous Quiz Runs

  ## Changes
  - Remove restrictive INSERT policy on public_quiz_runs
  - Add permissive policy allowing anyone to create quiz runs
  - This enables the /play/{quizId} route to work for anonymous users

  ## Security
  - Quiz runs are still validated (question_set_id must exist)
  - Only creates new runs, cannot modify existing ones
  - SELECT/UPDATE policies remain restrictive
*/

-- Drop the overly restrictive policy that blocks all inserts
DROP POLICY IF EXISTS "Deny direct insert on public_quiz_runs" ON public.public_quiz_runs;

-- Drop old policies that might conflict
DROP POLICY IF EXISTS "public_quiz_runs_insert" ON public.public_quiz_runs;
DROP POLICY IF EXISTS "Anyone can create quiz run" ON public.public_quiz_runs;

-- Create new permissive policy for anonymous quiz starts
CREATE POLICY "Allow anonymous quiz run creation"
  ON public.public_quiz_runs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Keep existing UPDATE policy restrictive (only service role can update)
-- Quiz runs should only be updated via edge functions for score/status changes

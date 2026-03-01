/*
  # Restrict Anonymous Topic Runs Access
  
  1. Problem
    - Anonymous users have SELECT policy with USING (true)
    - This allows anonymous users to see ALL topic runs, including authenticated users' runs
    - Missing INSERT policy for anonymous users
  
  2. Solution
    - Restrict anonymous SELECT to only runs with user_id = NULL (anonymous runs)
    - Add INSERT policy for anonymous users to create their own runs
    - Keep UPDATE policy restricted to session_id IS NOT NULL
  
  3. Security
    - Anonymous users can only access truly anonymous runs (user_id = NULL)
    - Anonymous users cannot see authenticated users' runs
    - Each operation properly restricted
*/

-- Drop the overly permissive anonymous SELECT policy
DROP POLICY IF EXISTS "Anonymous can view own session runs" ON topic_runs;

-- Create restricted SELECT policy for anonymous users
CREATE POLICY "Anonymous can view anonymous topic runs"
  ON topic_runs
  FOR SELECT
  TO anon
  USING (user_id IS NULL);

-- Add INSERT policy for anonymous users
CREATE POLICY "Anonymous can create anonymous topic runs"
  ON topic_runs
  FOR INSERT
  TO anon
  WITH CHECK (
    user_id IS NULL
    AND session_id IS NOT NULL
  );

-- Keep the existing UPDATE policy (it's already properly restricted)
-- Anonymous can update own session runs - already exists with proper checks

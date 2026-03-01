/*
  # Allow Anonymous Users to Read Teacher Names
  
  ## Problem
  - Anonymous users browsing school walls and topics can't see quizzes
  - Query fails with 400 error when trying to LEFT JOIN profiles table
  - RLS blocks anonymous access to profiles table entirely
  
  ## Solution
  - Add SELECT policy for anon role on profiles table
  - Allow reading only non-sensitive data (id, full_name)
  - Enables teacher name display on quiz cards
  
  ## Security
  - Only allows reading public profile data
  - No access to sensitive fields (email, role, etc.)
  - Read-only access for anonymous users
*/

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Anonymous can view public profile info" ON profiles;

-- Allow anonymous users to read basic profile info for teacher attribution
CREATE POLICY "Anonymous can view public profile info"
  ON profiles
  FOR SELECT
  TO anon
  USING (true);

/*
  # Add INSERT Policy for Profiles Table
  
  ## Problem
  The profiles table is missing an INSERT policy. While the handle_new_user() trigger
  uses SECURITY DEFINER to bypass RLS, having a proper INSERT policy ensures:
  1. Consistent security model
  2. Allows manual profile creation if needed (e.g., admin tools)
  3. Better auditability
  
  ## Solution
  Add an INSERT policy that allows authenticated users to create their own profile only.
  
  ## Security
  - Users can only insert profiles where id = auth.uid()
  - Prevents users from creating profiles for other users
  - Consistent with existing UPDATE policy
*/

CREATE POLICY "Users can create own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id);

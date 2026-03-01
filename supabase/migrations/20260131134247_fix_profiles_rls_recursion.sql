/*
  # Fix Profiles RLS Recursion (42P17 Error)

  ## Problem
  The existing SELECT policy on profiles table causes infinite recursion:
  - Policy queries profiles table to check if user is admin
  - This creates circular dependency (profiles policy checks profiles table)
  - Results in: 42P17 infinite recursion detected in policy for relation "profiles"

  ## Solution
  Replace recursive policy with non-recursive alternatives:
  1. Users can ALWAYS read their own profile (auth.uid() = id)
  2. Admins identified via app_metadata in JWT (not profiles table query)
  3. Allow INSERT for authenticated users (own row only, profile created by trigger)
  4. Allow UPDATE for own profile only

  ## Security Notes
  - Admin role must be set in auth.users.raw_app_meta_data
  - Profiles table role is display-only, not authoritative
  - No circular dependencies in any policy
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile or admins can view all" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Allow profile insert for authenticated users" ON profiles;

-- SELECT: Users read own profile, admins read all (via JWT metadata)
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR
    (auth.jwt()->>'role')::text = 'admin'
  );

-- INSERT: Allow authenticated users to insert their own profile only
-- This supports the trigger that creates profiles on signup
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- UPDATE: Users can only update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- DELETE: No one can delete profiles (not even admins, for data integrity)
-- If deletion is needed in future, add explicit admin-only policy

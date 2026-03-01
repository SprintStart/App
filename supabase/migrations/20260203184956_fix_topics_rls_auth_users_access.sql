/*
  # Fix Topics RLS Policy - Remove auth.users Access

  ## Problem
  The "Admins can read all topics" policy queries auth.users directly:
  ```sql
  SELECT users.email FROM auth.users WHERE users.id = auth.uid()
  ```
  This causes "permission denied for table users" errors from frontend.

  ## Solution
  1. Drop the problematic policy
  2. Replace with simpler policy using is_admin() function (already exists)
  3. Add policy for authenticated teachers to read all published/active topics

  ## Changes
  - DROP POLICY: "Admins can read all topics" (uses auth.users)
  - CREATE POLICY: "Admins can read all topics via function" (uses is_admin())
  - CREATE POLICY: "Teachers can read published topics" (for quiz creation)

  ## Security
  - Admins: Can read all topics (via is_admin() function)
  - Teachers: Can read published + active topics only
  - Teachers: Can still read own topics (existing policy)
  - Public: Can read published + active topics (existing policy)
*/

-- Drop the problematic policy that accesses auth.users
DROP POLICY IF EXISTS "Admins can read all topics" ON topics;

-- Create new admin policy using is_admin() function (no auth.users access)
CREATE POLICY "Admins can read all topics via function"
  ON topics
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (SELECT email FROM profiles WHERE id = auth.uid())
      AND admin_allowlist.is_active = true
    )
  );

-- Allow authenticated teachers to read published topics (for quiz creation)
CREATE POLICY "Teachers can read all published topics"
  ON topics
  FOR SELECT
  TO authenticated
  USING (
    is_active = true 
    AND is_published = true
  );

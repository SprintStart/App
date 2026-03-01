/*
  # HOTFIX: Restore Public Access to Schools

  ## Critical Issue
  The previous migration broke public access to school walls.
  The "View schools" policy was set to `authenticated` only, blocking anonymous users.
  
  ## Root Cause
  School wall pages like /northampton-college are accessed by:
  - Anonymous users (not logged in)
  - Authenticated users
  
  The policy only allowed authenticated users, causing "School Not Found" errors.

  ## Fix
  1. Drop the broken policy that's restricted to authenticated only
  2. Create a new policy for PUBLIC access to active schools
  3. Keep the admin policy for viewing inactive schools

  ## Security
  - Public users can only view active schools (is_active = true)
  - Admins can view all schools (active and inactive)
  - This is the correct behavior for school wall pages
*/

-- Drop the broken policy
DROP POLICY IF EXISTS "View schools" ON public.schools;

-- Allow PUBLIC (anonymous + authenticated) to view active schools
CREATE POLICY "Public can view active schools"
  ON public.schools
  FOR SELECT
  TO public
  USING (is_active = true);

-- Allow admins to view all schools
CREATE POLICY "Admins can view all schools"
  ON public.schools
  FOR SELECT
  TO authenticated
  USING (current_user_is_admin());

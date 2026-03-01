/*
  # HOTFIX: Restore Public Access to Countries and Exam Systems

  ## Issue
  Same as schools table - countries and exam_systems were restricted to authenticated only,
  breaking public access to school wall pages and quiz selection flows for anonymous users.

  ## Fix
  1. Drop policies restricted to authenticated only
  2. Create public policies for active records
  3. Keep admin policies for viewing inactive records

  ## Security
  - Public users can view active countries and exam systems
  - Admins can view all records (active and inactive)
*/

-- Countries: Fix public access
DROP POLICY IF EXISTS "View countries" ON public.countries;

CREATE POLICY "Public can view active countries"
  ON public.countries
  FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Admins can view all countries"
  ON public.countries
  FOR SELECT
  TO authenticated
  USING (current_user_is_admin());

-- Exam Systems: Fix public access
DROP POLICY IF EXISTS "View exam systems" ON public.exam_systems;

CREATE POLICY "Public can view active exam systems"
  ON public.exam_systems
  FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Admins can view all exam systems"
  ON public.exam_systems
  FOR SELECT
  TO authenticated
  USING (current_user_is_admin());

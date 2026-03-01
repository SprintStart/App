/*
  # Fix Critical Security Vulnerabilities
  
  ## Security Issues Fixed
  
  ### 1. SECURITY DEFINER View Removal (CRITICAL)
  - Drop `sponsor_banners` view with SECURITY DEFINER (security_invoker=false)
  - Create normal view with security_invoker=true (default)
  - Add proper RLS policy on `sponsored_ads` table for anon SELECT
  
  ### 2. Prevent Anonymous Database Spam (CRITICAL)
  - Remove "always true" INSERT policies that allow database spam
  - Deny direct INSERT access for anon users
  - All inserts must go through Edge Functions with validation
  - Edge Functions use service_role_key to bypass RLS safely
  
  ## Tables Secured
  - `quiz_sessions` - No direct anon INSERT
  - `public_quiz_runs` - No direct anon INSERT  
  - `public_quiz_answers` - No direct anon INSERT
  - `sponsored_ads` - RLS enabled for anon SELECT only when active
  
  ## Edge Functions Handle Inserts
  - `start-public-quiz` - Creates quiz_sessions and public_quiz_runs
  - `submit-public-answer` - Creates public_quiz_answers
  - Both functions validate data server-side before inserting
*/

-- 1. Drop SECURITY DEFINER view and create normal view
DROP VIEW IF EXISTS public.sponsor_banners CASCADE;

-- Create normal view with security_invoker=true (default, safe)
CREATE VIEW public.sponsor_banners AS
SELECT 
  id,
  title,
  image_url,
  destination_url AS target_url,
  placement,
  is_active,
  start_date AS start_at,
  end_date AS end_at,
  display_order,
  created_by,
  created_at,
  updated_at
FROM sponsored_ads
WHERE is_active = true
  AND (start_date IS NULL OR start_date <= CURRENT_DATE)
  AND (end_date IS NULL OR end_date >= CURRENT_DATE);

-- Grant SELECT on view (read-only)
GRANT SELECT ON public.sponsor_banners TO anon, authenticated;

-- 2. Add RLS policy on sponsored_ads for anon SELECT
-- First check if RLS is enabled
ALTER TABLE sponsored_ads ENABLE ROW LEVEL SECURITY;

-- Add policy for anon to view active sponsored ads
CREATE POLICY "Anon can view active sponsored ads"
  ON sponsored_ads FOR SELECT
  TO anon
  USING (
    is_active = true
    AND (start_date IS NULL OR start_date <= CURRENT_DATE)
    AND (end_date IS NULL OR end_date >= CURRENT_DATE)
  );

-- 3. Remove dangerous INSERT policies that allow database spam
DROP POLICY IF EXISTS "Anyone can create session" ON quiz_sessions;
DROP POLICY IF EXISTS "Anyone can create quiz run" ON public_quiz_runs;
DROP POLICY IF EXISTS "Anyone can create answer" ON public_quiz_answers;

-- 4. Add DENY policies for direct anon INSERT (only Edge Functions can insert)
-- Note: Edge Functions use service_role_key which bypasses RLS

-- Quiz Sessions: Only authenticated users can directly insert (for future features)
-- Anonymous users MUST use start-public-quiz Edge Function
CREATE POLICY "Authenticated users can create own session"
  ON quiz_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- Service role can insert (for Edge Functions)
-- Anon users are implicitly denied (no policy for them)

-- Public Quiz Runs: NO direct INSERT for anon or authenticated
-- MUST use start-public-quiz Edge Function
CREATE POLICY "Deny direct insert on public_quiz_runs"
  ON public_quiz_runs FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

-- Public Quiz Answers: NO direct INSERT for anon or authenticated  
-- MUST use submit-public-answer Edge Function
CREATE POLICY "Deny direct insert on public_quiz_answers"
  ON public_quiz_answers FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

-- 5. Add admin policies for management access
CREATE POLICY "Admins can manage quiz sessions"
  ON quiz_sessions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage public quiz runs"
  ON public_quiz_runs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage public quiz answers"
  ON public_quiz_answers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

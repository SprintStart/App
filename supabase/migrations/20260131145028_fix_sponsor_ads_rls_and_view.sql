/*
  # Fix Sponsor Ads RLS and View Access

  ## Changes
  1. Fix RLS policy on sponsored_ads to handle NULL dates correctly
  2. Grant SELECT on sponsor_banners view to anon users
  3. Ensure view can be accessed without authentication

  ## Security
  - Public can only view active ads within date range or with NULL dates
  - NULL dates mean "always active" (no time restrictions)
*/

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Anyone can view active sponsored ads" ON sponsored_ads;

-- Create new policy that properly handles NULL dates
CREATE POLICY "Public can view active sponsored ads"
  ON sponsored_ads FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true
    AND (start_date IS NULL OR start_date <= now())
    AND (end_date IS NULL OR end_date >= now())
  );

-- Ensure view has proper grants
GRANT SELECT ON sponsor_banners TO anon, authenticated;

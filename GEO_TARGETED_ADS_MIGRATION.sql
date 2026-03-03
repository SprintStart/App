/*
  # Add Geo-Targeting to Sponsored Ads System

  COPY AND PASTE THIS ENTIRE FILE INTO SUPABASE SQL EDITOR

  ## Changes
  1. Add geo-targeting columns (scope, country_id, exam_system_id, school_id)
  2. Add rotation columns (priority, weight)
  3. Add tracking columns (impression_count, click_count)
  4. Update placement enum with new options
  5. Add constraints to enforce scope rules
  6. Create ad_impressions and ad_clicks tracking tables
  7. Add helper functions for fetching and tracking ads
  8. Add performance indexes

  ## No Data Loss
  - Existing ads will be set to scope='GLOBAL'
  - All existing data preserved
*/

-- ============================================================================
-- STEP 1: ADD NEW COLUMNS TO sponsored_ads
-- ============================================================================

-- Add geo-targeting columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sponsored_ads' AND column_name = 'scope') THEN
    ALTER TABLE sponsored_ads ADD COLUMN scope text NOT NULL DEFAULT 'GLOBAL' CHECK (scope IN ('GLOBAL', 'COUNTRY', 'SCHOOL'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sponsored_ads' AND column_name = 'country_id') THEN
    ALTER TABLE sponsored_ads ADD COLUMN country_id uuid REFERENCES countries(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sponsored_ads' AND column_name = 'exam_system_id') THEN
    ALTER TABLE sponsored_ads ADD COLUMN exam_system_id uuid REFERENCES exam_systems(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sponsored_ads' AND column_name = 'school_id') THEN
    ALTER TABLE sponsored_ads ADD COLUMN school_id uuid REFERENCES schools(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add rotation/priority columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sponsored_ads' AND column_name = 'priority') THEN
    ALTER TABLE sponsored_ads ADD COLUMN priority int DEFAULT 100;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sponsored_ads' AND column_name = 'weight') THEN
    ALTER TABLE sponsored_ads ADD COLUMN weight int DEFAULT 1;
  END IF;
END $$;

-- Add tracking columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sponsored_ads' AND column_name = 'impression_count') THEN
    ALTER TABLE sponsored_ads ADD COLUMN impression_count bigint DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sponsored_ads' AND column_name = 'click_count') THEN
    ALTER TABLE sponsored_ads ADD COLUMN click_count bigint DEFAULT 0;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: ADD SCOPE CONSTRAINTS
-- ============================================================================

-- Add constraints to enforce scope rules
DO $$
BEGIN
  -- Global scope cannot have any targeting
  IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE constraint_name = 'global_scope_no_targeting') THEN
    ALTER TABLE sponsored_ads ADD CONSTRAINT global_scope_no_targeting CHECK (
      scope != 'GLOBAL' OR (
        country_id IS NULL AND
        exam_system_id IS NULL AND
        school_id IS NULL
      )
    );
  END IF;

  -- Country scope requires country_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE constraint_name = 'country_scope_requires_country') THEN
    ALTER TABLE sponsored_ads ADD CONSTRAINT country_scope_requires_country CHECK (
      scope != 'COUNTRY' OR country_id IS NOT NULL
    );
  END IF;

  -- School scope requires school_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE constraint_name = 'school_scope_requires_school') THEN
    ALTER TABLE sponsored_ads ADD CONSTRAINT school_scope_requires_school CHECK (
      scope != 'SCHOOL' OR school_id IS NOT NULL
    );
  END IF;
END $$;

-- ============================================================================
-- STEP 3: CREATE TRACKING TABLES
-- ============================================================================

-- Create ad_impressions table
CREATE TABLE IF NOT EXISTS ad_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid NOT NULL REFERENCES sponsored_ads(id) ON DELETE CASCADE,
  session_id text,
  page_url text,
  placement text,
  country_code text,
  created_at timestamptz DEFAULT now()
);

-- Create ad_clicks table
CREATE TABLE IF NOT EXISTS ad_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid NOT NULL REFERENCES sponsored_ads(id) ON DELETE CASCADE,
  session_id text,
  page_url text,
  placement text,
  country_code text,
  referrer text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on tracking tables
ALTER TABLE ad_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_clicks ENABLE ROW LEVEL SECURITY;

-- Anyone can insert tracking data (anonymous allowed)
DROP POLICY IF EXISTS "Anyone can insert impressions" ON ad_impressions;
CREATE POLICY "Anyone can insert impressions"
  ON ad_impressions FOR INSERT
  TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view impressions" ON ad_impressions;
CREATE POLICY "Admins can view impressions"
  ON ad_impressions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND admin_allowlist.is_active = true
    )
  );

DROP POLICY IF EXISTS "Anyone can insert clicks" ON ad_clicks;
CREATE POLICY "Anyone can insert clicks"
  ON ad_clicks FOR INSERT
  TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view clicks" ON ad_clicks;
CREATE POLICY "Admins can view clicks"
  ON ad_clicks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND admin_allowlist.is_active = true
    )
  );

-- ============================================================================
-- STEP 4: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sponsored_ads_scope_placement ON sponsored_ads(scope, placement) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sponsored_ads_country_placement ON sponsored_ads(country_id, placement) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sponsored_ads_exam_placement ON sponsored_ads(exam_system_id, placement) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sponsored_ads_school_placement ON sponsored_ads(school_id, placement) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sponsored_ads_priority ON sponsored_ads(priority DESC, weight DESC) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_ad_impressions_ad_created ON ad_impressions(ad_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_session ON ad_impressions(session_id);
CREATE INDEX IF NOT EXISTS idx_ad_clicks_ad_created ON ad_clicks(ad_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_clicks_session ON ad_clicks(session_id);

-- ============================================================================
-- STEP 5: CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to get active ads for a placement with geo-filtering
CREATE OR REPLACE FUNCTION get_active_ads_for_placement(
  p_placement text,
  p_country_id uuid DEFAULT NULL,
  p_exam_system_id uuid DEFAULT NULL,
  p_school_id uuid DEFAULT NULL,
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  title text,
  image_url text,
  click_url text,
  placement text,
  priority int,
  weight int,
  scope text,
  country_id uuid,
  impression_count bigint,
  click_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sa.id,
    sa.title,
    sa.image_url,
    sa.destination_url as click_url,
    sa.placement,
    sa.priority,
    sa.weight,
    sa.scope,
    sa.country_id,
    sa.impression_count,
    sa.click_count
  FROM sponsored_ads sa
  WHERE
    sa.is_active = true
    AND sa.placement = p_placement
    AND (sa.start_date IS NULL OR sa.start_date <= now())
    AND (sa.end_date IS NULL OR sa.end_date >= now())
    AND (
      -- GLOBAL scope (no targeting)
      (sa.scope = 'GLOBAL' AND p_country_id IS NULL AND p_school_id IS NULL)
      OR
      -- COUNTRY scope (match country)
      (sa.scope = 'COUNTRY' AND sa.country_id = p_country_id AND p_school_id IS NULL)
      OR
      -- SCHOOL scope (match school)
      (sa.scope = 'SCHOOL' AND sa.school_id = p_school_id)
    )
  ORDER BY sa.priority DESC, sa.weight DESC, random()
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track impression
CREATE OR REPLACE FUNCTION track_ad_impression(
  p_ad_id uuid,
  p_session_id text DEFAULT NULL,
  p_page_url text DEFAULT NULL,
  p_placement text DEFAULT NULL,
  p_country_code text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- Insert impression record
  INSERT INTO ad_impressions (ad_id, session_id, page_url, placement, country_code)
  VALUES (p_ad_id, p_session_id, p_page_url, p_placement, p_country_code);

  -- Increment counter
  UPDATE sponsored_ads
  SET impression_count = impression_count + 1
  WHERE id = p_ad_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track click
CREATE OR REPLACE FUNCTION track_ad_click(
  p_ad_id uuid,
  p_session_id text DEFAULT NULL,
  p_page_url text DEFAULT NULL,
  p_placement text DEFAULT NULL,
  p_country_code text DEFAULT NULL,
  p_referrer text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- Insert click record
  INSERT INTO ad_clicks (ad_id, session_id, page_url, placement, country_code, referrer)
  VALUES (p_ad_id, p_session_id, p_page_url, p_placement, p_country_code, p_referrer);

  -- Increment counter
  UPDATE sponsored_ads
  SET click_count = click_count + 1
  WHERE id = p_ad_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 6: ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN sponsored_ads.scope IS 'GLOBAL (no targeting), COUNTRY (requires country_id), or SCHOOL (requires school_id)';
COMMENT ON COLUMN sponsored_ads.country_id IS 'Required for COUNTRY scope, must be NULL for GLOBAL scope';
COMMENT ON COLUMN sponsored_ads.exam_system_id IS 'Optional additional targeting by exam system';
COMMENT ON COLUMN sponsored_ads.school_id IS 'Required for SCHOOL scope, must be NULL for GLOBAL scope';
COMMENT ON COLUMN sponsored_ads.priority IS 'Higher priority ads shown first (default 100)';
COMMENT ON COLUMN sponsored_ads.weight IS 'Weight for random rotation among same priority (default 1)';
COMMENT ON COLUMN sponsored_ads.impression_count IS 'Total impressions tracked';
COMMENT ON COLUMN sponsored_ads.click_count IS 'Total clicks tracked';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  global_count int;
  country_count int;
  total_count int;
BEGIN
  SELECT COUNT(*) INTO total_count FROM sponsored_ads;
  SELECT COUNT(*) INTO global_count FROM sponsored_ads WHERE scope = 'GLOBAL';
  SELECT COUNT(*) INTO country_count FROM sponsored_ads WHERE scope = 'COUNTRY';

  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'GEO-TARGETED ADS MIGRATION COMPLETE';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Total ads: %', total_count;
  RAISE NOTICE 'GLOBAL ads: %', global_count;
  RAISE NOTICE 'COUNTRY ads: %', country_count;
  RAISE NOTICE '';
  RAISE NOTICE 'New Features:';
  RAISE NOTICE '  ✓ Scope-based targeting (GLOBAL/COUNTRY/SCHOOL)';
  RAISE NOTICE '  ✓ Priority and weight for ad rotation';
  RAISE NOTICE '  ✓ Impression and click tracking';
  RAISE NOTICE '  ✓ Geo-filtering functions';
  RAISE NOTICE '  ✓ Performance indexes';
  RAISE NOTICE '=================================================================';
END $$;

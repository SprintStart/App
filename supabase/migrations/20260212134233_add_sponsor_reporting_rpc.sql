/*
  # Add Sponsor Reporting RPC Functions

  1. New Functions
    - admin_get_sponsor_report(ad_id uuid, start_date timestamptz, end_date timestamptz)
      Returns detailed sponsor report with impressions, clicks, CTR, top pages
    - admin_get_all_sponsors_summary()
      Returns summary of all sponsors and their ads
  
  2. Security
    - Functions verify admin status before returning data
    - Use SECURITY DEFINER to access analytics tables
*/

-- Function to get detailed sponsor report for a specific ad
CREATE OR REPLACE FUNCTION admin_get_sponsor_report(
  p_ad_id uuid,
  p_start_date timestamptz DEFAULT NOW() - INTERVAL '30 days',
  p_end_date timestamptz DEFAULT NOW()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin_user boolean;
  result jsonb;
  v_impressions bigint;
  v_clicks bigint;
  v_ctr numeric;
  v_sessions bigint;
BEGIN
  -- Verify admin
  SELECT EXISTS (
    SELECT 1 
    FROM admin_allowlist al
    INNER JOIN auth.users u ON u.email = al.email
    WHERE u.id = auth.uid()
    AND al.is_active = true
  ) INTO is_admin_user;
  
  IF NOT is_admin_user THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  -- Get ad info and metrics
  SELECT 
    (SELECT COUNT(*) FROM ad_impressions WHERE ad_id = p_ad_id AND created_at BETWEEN p_start_date AND p_end_date),
    (SELECT COUNT(*) FROM ad_clicks WHERE ad_id = p_ad_id AND created_at BETWEEN p_start_date AND p_end_date),
    (SELECT COUNT(DISTINCT session_id) FROM ad_impressions WHERE ad_id = p_ad_id AND created_at BETWEEN p_start_date AND p_end_date)
  INTO v_impressions, v_clicks, v_sessions;
  
  -- Calculate CTR
  IF v_impressions > 0 THEN
    v_ctr := (v_clicks::numeric / v_impressions::numeric) * 100;
  ELSE
    v_ctr := 0;
  END IF;
  
  -- Build result
  SELECT jsonb_build_object(
    'ad_info', (
      SELECT jsonb_build_object(
        'id', sa.id,
        'title', sa.title,
        'sponsor_name', COALESCE(sa.sponsor_name, 'N/A'),
        'placement', sa.placement,
        'image_url', sa.image_url,
        'destination_url', sa.destination_url
      )
      FROM sponsored_ads sa
      WHERE sa.id = p_ad_id
    ),
    'metrics', jsonb_build_object(
      'impressions', v_impressions,
      'clicks', v_clicks,
      'ctr', ROUND(v_ctr, 2),
      'unique_sessions', v_sessions
    ),
    'date_range', jsonb_build_object(
      'start', p_start_date,
      'end', p_end_date
    ),
    'top_pages', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'page', COALESCE(page, 'Unknown'),
          'impressions', impressions
        )
        ORDER BY impressions DESC
      ), '[]'::jsonb)
      FROM (
        SELECT 
          COALESCE(page, '/') as page,
          COUNT(*) as impressions
        FROM ad_impressions
        WHERE ad_id = p_ad_id 
        AND created_at BETWEEN p_start_date AND p_end_date
        GROUP BY page
        ORDER BY impressions DESC
        LIMIT 10
      ) top_p
    ),
    'daily_breakdown', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'date', date,
          'impressions', impressions,
          'clicks', clicks
        )
        ORDER BY date DESC
      ), '[]'::jsonb)
      FROM (
        SELECT 
          DATE(imp.created_at) as date,
          COUNT(imp.id) as impressions,
          COUNT(cl.id) as clicks
        FROM ad_impressions imp
        LEFT JOIN ad_clicks cl ON cl.ad_id = imp.ad_id AND DATE(cl.created_at) = DATE(imp.created_at)
        WHERE imp.ad_id = p_ad_id
        AND imp.created_at BETWEEN p_start_date AND p_end_date
        GROUP BY DATE(imp.created_at)
        ORDER BY date DESC
      ) daily
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Function to get summary of all sponsors
CREATE OR REPLACE FUNCTION admin_get_all_sponsors_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin_user boolean;
  result jsonb;
BEGIN
  -- Verify admin
  SELECT EXISTS (
    SELECT 1 
    FROM admin_allowlist al
    INNER JOIN auth.users u ON u.email = al.email
    WHERE u.id = auth.uid()
    AND al.is_active = true
  ) INTO is_admin_user;
  
  IF NOT is_admin_user THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  -- Get all sponsors with their metrics
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'ad_id', sa.id,
      'title', sa.title,
      'sponsor_name', COALESCE(sa.sponsor_name, 'Unnamed Sponsor'),
      'placement', sa.placement,
      'is_active', sa.is_active,
      'impressions_7d', (
        SELECT COUNT(*) 
        FROM ad_impressions 
        WHERE ad_id = sa.id 
        AND created_at >= NOW() - INTERVAL '7 days'
      ),
      'clicks_7d', (
        SELECT COUNT(*) 
        FROM ad_clicks 
        WHERE ad_id = sa.id 
        AND created_at >= NOW() - INTERVAL '7 days'
      ),
      'impressions_30d', (
        SELECT COUNT(*) 
        FROM ad_impressions 
        WHERE ad_id = sa.id 
        AND created_at >= NOW() - INTERVAL '30 days'
      ),
      'clicks_30d', (
        SELECT COUNT(*) 
        FROM ad_clicks 
        WHERE ad_id = sa.id 
        AND created_at >= NOW() - INTERVAL '30 days'
      )
    )
    ORDER BY sa.created_at DESC
  ), '[]'::jsonb)
  INTO result
  FROM sponsored_ads sa;
  
  RETURN result;
END;
$$;

-- Grant execute
GRANT EXECUTE ON FUNCTION admin_get_sponsor_report(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_all_sponsors_summary() TO authenticated;
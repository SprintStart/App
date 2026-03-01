/*
  # Add Admin RPC for Monthly Stats

  1. New Function
    - admin_get_monthly_quiz_stats() - Returns monthly breakdown of plays
    - admin_get_monthly_drill_down(month_key text) - Returns drill-down data for a specific month
  
  2. Security
    - Both functions verify admin status before returning data
    - Use SECURITY DEFINER to bypass RLS
*/

-- Function to get monthly quiz stats
CREATE OR REPLACE FUNCTION admin_get_monthly_quiz_stats()
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
  
  -- Get monthly stats for last 12 months
  SELECT jsonb_agg(
    jsonb_build_object(
      'month', month_key,
      'plays', play_count,
      'unique_quizzes', quiz_count
    )
    ORDER BY month_key DESC
  )
  INTO result
  FROM (
    SELECT 
      TO_CHAR(started_at, 'YYYY-MM') as month_key,
      COUNT(*) as play_count,
      COUNT(DISTINCT question_set_id) as quiz_count
    FROM public_quiz_runs
    WHERE started_at >= NOW() - INTERVAL '12 months'
    GROUP BY month_key
    ORDER BY month_key DESC
    LIMIT 12
  ) monthly_data;
  
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Function to get drill-down data for a specific month
CREATE OR REPLACE FUNCTION admin_get_monthly_drill_down(month_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin_user boolean;
  start_date timestamptz;
  end_date timestamptz;
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
  
  -- Parse month_key (format: YYYY-MM)
  start_date := (month_key || '-01')::date;
  end_date := (start_date + INTERVAL '1 month' - INTERVAL '1 second');
  
  -- Build result with top quizzes, schools, and subjects
  SELECT jsonb_build_object(
    'month', month_key,
    'top_quizzes', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('name', topic_name, 'plays', play_count)
        ORDER BY play_count DESC
      ), '[]'::jsonb)
      FROM (
        SELECT 
          COALESCE(t.name, 'Unknown Quiz') as topic_name,
          COUNT(*) as play_count
        FROM public_quiz_runs qr
        LEFT JOIN question_sets qs ON qs.id = qr.question_set_id
        LEFT JOIN topics t ON t.id = qs.topic_id
        WHERE qr.started_at >= start_date 
        AND qr.started_at <= end_date
        GROUP BY t.name
        ORDER BY play_count DESC
        LIMIT 10
      ) top_q
    ),
    'top_schools', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('name', school_name, 'plays', play_count)
        ORDER BY play_count DESC
      ), '[]'::jsonb)
      FROM (
        SELECT 
          COALESCE(s.school_name, 'Global') as school_name,
          COUNT(*) as play_count
        FROM public_quiz_runs qr
        LEFT JOIN question_sets qs ON qs.id = qr.question_set_id
        LEFT JOIN topics t ON t.id = qs.topic_id
        LEFT JOIN schools s ON s.id = t.school_id
        WHERE qr.started_at >= start_date 
        AND qr.started_at <= end_date
        GROUP BY s.school_name
        ORDER BY play_count DESC
        LIMIT 10
      ) top_s
    ),
    'top_subjects', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('name', subject_name, 'plays', play_count)
        ORDER BY play_count DESC
      ), '[]'::jsonb)
      FROM (
        SELECT 
          COALESCE(t.subject, 'Other') as subject_name,
          COUNT(*) as play_count
        FROM public_quiz_runs qr
        LEFT JOIN question_sets qs ON qs.id = qr.question_set_id
        LEFT JOIN topics t ON t.id = qs.topic_id
        WHERE qr.started_at >= start_date 
        AND qr.started_at <= end_date
        GROUP BY t.subject
        ORDER BY play_count DESC
      ) top_sub
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Grant execute
GRANT EXECUTE ON FUNCTION admin_get_monthly_quiz_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_monthly_drill_down(text) TO authenticated;
/*
  # Admin Analytics RPC Functions
  
  ## Purpose
  Provide system-wide analytics for admin dashboard using existing public_quiz_runs table.
  
  ## Functions Created
  
  1. get_admin_overview_stats()
     - Total plays all time
     - Plays this month
     - Active schools
     - Active quizzes
  
  2. get_admin_monthly_plays(months_back)
     - Monthly play counts for trending chart
  
  3. get_admin_top_quizzes(limit, metric)
     - Top quizzes by plays or completion rate
  
  4. get_admin_school_activity(limit)
     - Schools ranked by quiz activity
  
  ## Data Source
  Uses public_quiz_runs (production data)
*/

-- Function: Get admin overview statistics
CREATE OR REPLACE FUNCTION get_admin_overview_stats()
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
  v_total_plays bigint;
  v_plays_this_month bigint;
  v_plays_last_month bigint;
  v_active_schools bigint;
  v_active_quizzes bigint;
  v_avg_score numeric;
BEGIN
  -- Verify admin access
  IF NOT current_user_is_admin() THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  -- Get total plays
  SELECT COUNT(*) INTO v_total_plays
  FROM public_quiz_runs;

  -- Get plays this month
  SELECT COUNT(*) INTO v_plays_this_month
  FROM public_quiz_runs
  WHERE started_at >= DATE_TRUNC('month', CURRENT_DATE);

  -- Get plays last month
  SELECT COUNT(*) INTO v_plays_last_month
  FROM public_quiz_runs
  WHERE started_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
    AND started_at < DATE_TRUNC('month', CURRENT_DATE);

  -- Get active schools (schools with quiz runs in last 30 days)
  SELECT COUNT(DISTINCT qs.school_id) INTO v_active_schools
  FROM public_quiz_runs pr
  JOIN question_sets qs ON qs.id = pr.question_set_id
  WHERE pr.started_at >= CURRENT_DATE - 30
    AND qs.school_id IS NOT NULL;

  -- Get active quizzes (quizzes played in last 30 days)
  SELECT COUNT(DISTINCT question_set_id) INTO v_active_quizzes
  FROM public_quiz_runs
  WHERE started_at >= CURRENT_DATE - 30;

  -- Get average score
  SELECT ROUND(AVG(NULLIF(score, 0)), 1) INTO v_avg_score
  FROM public_quiz_runs
  WHERE status = 'completed';

  -- Build result
  v_result := jsonb_build_object(
    'total_plays', COALESCE(v_total_plays, 0),
    'plays_this_month', COALESCE(v_plays_this_month, 0),
    'plays_last_month', COALESCE(v_plays_last_month, 0),
    'month_growth_pct', CASE 
      WHEN v_plays_last_month > 0 THEN 
        ROUND(((v_plays_this_month - v_plays_last_month)::numeric / v_plays_last_month) * 100, 1)
      ELSE 0
    END,
    'active_schools', COALESCE(v_active_schools, 0),
    'active_quizzes', COALESCE(v_active_quizzes, 0),
    'avg_score', COALESCE(v_avg_score, 0)
  );

  RETURN v_result;
END;
$$;

-- Function: Get monthly play counts
CREATE OR REPLACE FUNCTION get_admin_monthly_plays(
  p_months_back integer DEFAULT 12
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Verify admin access
  IF NOT current_user_is_admin() THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Get monthly play counts
  SELECT jsonb_agg(
    jsonb_build_object(
      'month', TO_CHAR(month_date, 'YYYY-MM'),
      'month_name', TO_CHAR(month_date, 'Mon YYYY'),
      'plays', COALESCE(plays, 0),
      'completions', COALESCE(completions, 0),
      'completion_rate', COALESCE(completion_rate, 0),
      'avg_score', COALESCE(avg_score, 0)
    ) ORDER BY month_date
  )
  INTO v_result
  FROM (
    SELECT 
      DATE_TRUNC('month', started_at) as month_date,
      COUNT(*) as plays,
      COUNT(*) FILTER (WHERE status = 'completed') as completions,
      ROUND((COUNT(*) FILTER (WHERE status = 'completed')::numeric / COUNT(*)) * 100, 1) as completion_rate,
      ROUND(AVG(NULLIF(score, 0)), 1) as avg_score
    FROM public_quiz_runs
    WHERE started_at >= DATE_TRUNC('month', CURRENT_DATE - (p_months_back || ' months')::interval)
    GROUP BY DATE_TRUNC('month', started_at)
  ) monthly_stats;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Function: Get top quizzes by metric
CREATE OR REPLACE FUNCTION get_admin_top_quizzes(
  p_limit integer DEFAULT 10,
  p_metric text DEFAULT 'plays'
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Verify admin access
  IF NOT current_user_is_admin() THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Get top quizzes
  SELECT jsonb_agg(
    jsonb_build_object(
      'quiz_id', qs.id,
      'quiz_title', qs.title,
      'school_name', COALESCE(s.name, 'Global'),
      'plays', stats.plays,
      'completions', stats.completions,
      'completion_rate', stats.completion_rate,
      'avg_score', stats.avg_score,
      'teacher_email', p.email
    )
  )
  INTO v_result
  FROM (
    SELECT 
      question_set_id,
      COUNT(*) as plays,
      COUNT(*) FILTER (WHERE status = 'completed') as completions,
      ROUND((COUNT(*) FILTER (WHERE status = 'completed')::numeric / COUNT(*)) * 100, 1) as completion_rate,
      ROUND(AVG(NULLIF(score, 0)), 1) as avg_score
    FROM public_quiz_runs
    GROUP BY question_set_id
    ORDER BY 
      CASE 
        WHEN p_metric = 'plays' THEN COUNT(*)
        WHEN p_metric = 'completions' THEN COUNT(*) FILTER (WHERE status = 'completed')
        ELSE COUNT(*)
      END DESC
    LIMIT p_limit
  ) stats
  JOIN question_sets qs ON qs.id = stats.question_set_id
  LEFT JOIN schools s ON s.id = qs.school_id
  LEFT JOIN profiles p ON p.id = qs.created_by;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Function: Get school activity rankings
CREATE OR REPLACE FUNCTION get_admin_school_activity(
  p_limit integer DEFAULT 10
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Verify admin access
  IF NOT current_user_is_admin() THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Get school activity
  SELECT jsonb_agg(
    jsonb_build_object(
      'school_id', s.id,
      'school_name', s.name,
      'school_slug', s.slug,
      'total_plays', COALESCE(stats.plays, 0),
      'total_completions', COALESCE(stats.completions, 0),
      'active_quizzes', COALESCE(stats.quiz_count, 0),
      'active_teachers', COALESCE(stats.teacher_count, 0),
      'avg_score', COALESCE(stats.avg_score, 0)
    ) ORDER BY COALESCE(stats.plays, 0) DESC
  )
  INTO v_result
  FROM schools s
  LEFT JOIN (
    SELECT 
      qs.school_id,
      COUNT(*) as plays,
      COUNT(*) FILTER (WHERE pr.status = 'completed') as completions,
      COUNT(DISTINCT pr.question_set_id) as quiz_count,
      COUNT(DISTINCT qs.created_by) as teacher_count,
      ROUND(AVG(NULLIF(pr.score, 0)), 1) as avg_score
    FROM public_quiz_runs pr
    JOIN question_sets qs ON qs.id = pr.question_set_id
    WHERE qs.school_id IS NOT NULL
    GROUP BY qs.school_id
  ) stats ON stats.school_id = s.id
  WHERE stats.plays IS NOT NULL
  ORDER BY stats.plays DESC
  LIMIT p_limit;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Function: Get quiz plays for specific month (drilldown)
CREATE OR REPLACE FUNCTION get_admin_monthly_drilldown(
  p_year integer,
  p_month integer
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
  v_start_date date;
  v_end_date date;
BEGIN
  -- Verify admin access
  IF NOT current_user_is_admin() THEN
    RETURN '[]'::jsonb;
  END IF;

  v_start_date := make_date(p_year, p_month, 1);
  v_end_date := v_start_date + interval '1 month';

  -- Get daily breakdown for the month
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', play_date,
      'plays', plays,
      'completions', completions,
      'avg_score', avg_score
    ) ORDER BY play_date
  )
  INTO v_result
  FROM (
    SELECT 
      DATE(started_at) as play_date,
      COUNT(*) as plays,
      COUNT(*) FILTER (WHERE status = 'completed') as completions,
      ROUND(AVG(NULLIF(score, 0)), 1) as avg_score
    FROM public_quiz_runs
    WHERE started_at >= v_start_date
      AND started_at < v_end_date
    GROUP BY DATE(started_at)
  ) daily_stats;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_admin_overview_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_monthly_plays TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_top_quizzes TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_school_activity TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_monthly_drilldown TO authenticated;

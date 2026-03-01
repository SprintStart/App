/*
  # Update Admin Overview Stats RPC
  
  ## Purpose
  Add 7-day and 30-day play counts to admin overview stats to fix the dashboard display.
  
  ## Changes
  - Adds total_plays_7days field
  - Adds total_plays_30days field  
  - Renames total_plays to total_plays_all_time for clarity
*/

CREATE OR REPLACE FUNCTION get_admin_overview_stats()
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
  v_total_plays bigint;
  v_plays_7days bigint;
  v_plays_30days bigint;
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

  -- Get total plays all time
  SELECT COUNT(*) INTO v_total_plays
  FROM public_quiz_runs;

  -- Get plays in last 7 days
  SELECT COUNT(*) INTO v_plays_7days
  FROM public_quiz_runs
  WHERE started_at >= CURRENT_DATE - 7;

  -- Get plays in last 30 days
  SELECT COUNT(*) INTO v_plays_30days
  FROM public_quiz_runs
  WHERE started_at >= CURRENT_DATE - 30;

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
    'total_plays_all_time', COALESCE(v_total_plays, 0),
    'total_plays_7days', COALESCE(v_plays_7days, 0),
    'total_plays_30days', COALESCE(v_plays_30days, 0),
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

GRANT EXECUTE ON FUNCTION get_admin_overview_stats TO authenticated;

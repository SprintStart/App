/*
  # Fix Remaining Function Search Path

  Adds immutable search_path to the 3-parameter version of get_teacher_dashboard_metrics
*/

DROP FUNCTION IF EXISTS get_teacher_dashboard_metrics(uuid, timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION get_teacher_dashboard_metrics(
  p_teacher_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSON;
  v_start_date TIMESTAMPTZ;
  v_end_date TIMESTAMPTZ;
BEGIN
  -- Set default date range if not provided
  v_start_date := COALESCE(p_start_date, NOW() - INTERVAL '30 days');
  v_end_date := COALESCE(p_end_date, NOW());

  -- Validate teacher access
  IF p_teacher_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = p_teacher_id
  ) THEN
    RETURN json_build_object('error', 'Invalid teacher ID');
  END IF;

  -- Compute metrics
  SELECT json_build_object(
    'total_plays', COALESCE(COUNT(DISTINCT tr.id), 0),
    'active_students', COALESCE(COUNT(DISTINCT tr.session_id), 0),
    'weighted_avg_score', COALESCE(ROUND(AVG(CASE WHEN tr.status = 'completed' THEN tr.percentage END), 1), 0),
    'engagement_rate', COALESCE(
      ROUND((COUNT(DISTINCT CASE WHEN tr.status = 'completed' THEN tr.id END)::numeric / 
      NULLIF(COUNT(DISTINCT tr.id), 0)::numeric) * 100, 1), 
      0
    ),
    'total_quizzes', COALESCE(COUNT(DISTINCT qs.id), 0),
    'avg_completion_time', COALESCE(ROUND(AVG(CASE WHEN tr.status = 'completed' THEN tr.duration_seconds END), 0), 0),
    'date_range', json_build_object(
      'start', v_start_date,
      'end', v_end_date
    )
  )
  INTO v_result
  FROM question_sets qs
  LEFT JOIN topic_runs tr ON qs.id = tr.question_set_id 
    AND tr.started_at BETWEEN v_start_date AND v_end_date
  WHERE qs.created_by = p_teacher_id
    AND qs.is_active = true
    AND qs.approval_status = 'approved';

  RETURN v_result;
END;
$$;

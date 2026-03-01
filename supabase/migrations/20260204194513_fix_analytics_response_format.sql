/*
  # Fix Analytics Response Format to Match Frontend Expectations

  1. Problem
    - Frontend expects flat response: { total_plays, active_students, weighted_avg_score, etc. }
    - Backend returns nested: { quiz_stats: {...}, student_stats: {...}, performance_stats: {...} }
    
  2. Solution
    - Update get_teacher_dashboard_metrics to return flat structure matching frontend
    - Add all fields frontend expects
*/

DROP FUNCTION IF EXISTS get_teacher_dashboard_metrics(uuid);

CREATE OR REPLACE FUNCTION get_teacher_dashboard_metrics(p_teacher_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_result JSON;
  v_total_quizzes INT;
  v_total_students INT;
  v_total_attempts INT;
  v_completed_attempts INT;
  v_avg_score NUMERIC;
  v_avg_time INT;
BEGIN
  -- Get quiz counts
  SELECT 
    COUNT(DISTINCT qs.id)
  INTO v_total_quizzes
  FROM question_sets qs
  WHERE qs.created_by = p_teacher_id
    AND qs.is_active = true
    AND qs.approval_status = 'approved';

  -- Get student stats from public_quiz_runs
  SELECT 
    COUNT(DISTINCT pqr.session_id),
    COUNT(DISTINCT pqr.id),
    SUM(CASE WHEN pqr.status = 'completed' THEN 1 ELSE 0 END)
  INTO v_total_students, v_total_attempts, v_completed_attempts
  FROM public_quiz_runs pqr
  INNER JOIN question_sets qs ON pqr.question_set_id = qs.id
  WHERE qs.created_by = p_teacher_id;

  -- Get performance stats
  SELECT 
    ROUND(AVG(CASE WHEN pqr.status = 'completed' THEN pqr.percentage END), 1),
    ROUND(AVG(CASE WHEN pqr.status = 'completed' THEN pqr.duration_seconds END), 0)
  INTO v_avg_score, v_avg_time
  FROM public_quiz_runs pqr
  INNER JOIN question_sets qs ON pqr.question_set_id = qs.id
  WHERE qs.created_by = p_teacher_id
    AND pqr.status = 'completed';

  -- Build flat response matching frontend expectations
  v_result := json_build_object(
    'total_plays', COALESCE(v_total_attempts, 0),
    'active_students', COALESCE(v_total_students, 0),
    'weighted_avg_score', COALESCE(v_avg_score, 0),
    'engagement_rate', CASE 
      WHEN v_total_attempts > 0 
      THEN ROUND((v_completed_attempts::numeric / v_total_attempts::numeric) * 100, 1)
      ELSE 0 
    END,
    'total_quizzes', COALESCE(v_total_quizzes, 0),
    'avg_completion_time', COALESCE(v_avg_time, 0),
    'date_range', json_build_object(
      'start', (NOW() - INTERVAL '30 days')::text,
      'end', NOW()::text
    )
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_teacher_dashboard_metrics(uuid) TO authenticated;
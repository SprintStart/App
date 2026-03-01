/*
  # Fix Single Parameter Dashboard Metrics Function

  Update the single-parameter version to also use public_quiz_runs.
*/

DROP FUNCTION IF EXISTS get_teacher_dashboard_metrics(uuid);

CREATE OR REPLACE FUNCTION get_teacher_dashboard_metrics(p_teacher_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Get comprehensive teacher dashboard metrics using public_quiz_runs
  WITH quiz_stats AS (
    SELECT 
      COUNT(DISTINCT qs.id) as total_quizzes,
      COUNT(DISTINCT CASE WHEN qs.status = 'published' THEN qs.id END) as published_quizzes,
      COUNT(DISTINCT CASE WHEN qs.status = 'draft' THEN qs.id END) as draft_quizzes
    FROM question_sets qs
    WHERE qs.created_by = p_teacher_id
    AND qs.is_active = true
  ),
  student_stats AS (
    SELECT 
      COUNT(DISTINCT pqr.session_id) as total_students,
      COUNT(DISTINCT pqr.id) as total_attempts,
      SUM(CASE WHEN pqr.status = 'completed' THEN 1 ELSE 0 END) as completed_attempts
    FROM public_quiz_runs pqr
    INNER JOIN question_sets qs ON pqr.question_set_id = qs.id
    WHERE qs.created_by = p_teacher_id
  ),
  performance_stats AS (
    SELECT 
      ROUND(AVG(CASE WHEN pqr.status = 'completed' THEN pqr.percentage END), 1) as avg_score,
      ROUND(AVG(CASE WHEN pqr.status = 'completed' THEN pqr.duration_seconds END), 0) as avg_time
    FROM public_quiz_runs pqr
    INNER JOIN question_sets qs ON pqr.question_set_id = qs.id
    WHERE qs.created_by = p_teacher_id
    AND pqr.status = 'completed'
  ),
  recent_activity AS (
    SELECT json_agg(
      json_build_object(
        'date', day_date,
        'attempts', day_count
      )
      ORDER BY day_date DESC
    ) as activity_trend
    FROM (
      SELECT 
        DATE(pqr.started_at) as day_date,
        COUNT(*) as day_count
      FROM public_quiz_runs pqr
      INNER JOIN question_sets qs ON pqr.question_set_id = qs.id
      WHERE qs.created_by = p_teacher_id
      AND pqr.started_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(pqr.started_at)
    ) daily_data
  )
  SELECT json_build_object(
    'quiz_stats', row_to_json(quiz_stats.*),
    'student_stats', row_to_json(student_stats.*),
    'performance_stats', row_to_json(performance_stats.*),
    'recent_activity', COALESCE((SELECT activity_trend FROM recent_activity), '[]'::json)
  )
  INTO v_result
  FROM quiz_stats, student_stats, performance_stats;

  RETURN v_result;
END;
$$;

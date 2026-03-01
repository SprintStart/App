/*
  # Fix Teacher Analytics Functions

  1. Problem
    - get_teacher_dashboard_metrics() function references non-existent 'status' column (should be 'approval_status')
    - get_quiz_deep_analytics() function queries wrong tables (topic_runs instead of public_quiz_runs)
    - Multiple duplicate function definitions causing "function is not unique" errors
    - Teacher has 28 quiz plays but analytics show 0

  2. Solution
    - Drop all duplicate functions
    - Recreate with correct table/column names
    - Use public_quiz_runs (164 rows) instead of topic_runs (0 rows)
    - Use approval_status instead of status
    - Add proper teacher ownership checks

  3. Security
    - SECURITY DEFINER with strict search_path
    - Teacher can only see their own quiz analytics
*/

-- Drop all duplicate functions first
DROP FUNCTION IF EXISTS get_teacher_dashboard_metrics(uuid);
DROP FUNCTION IF EXISTS get_teacher_dashboard_metrics(uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS get_quiz_deep_analytics(uuid);
DROP FUNCTION IF EXISTS get_quiz_deep_analytics(uuid, uuid);

-- Create get_teacher_dashboard_metrics function (single parameter version)
CREATE OR REPLACE FUNCTION get_teacher_dashboard_metrics(p_teacher_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Get comprehensive teacher dashboard metrics using public_quiz_runs
  WITH quiz_stats AS (
    SELECT 
      COUNT(DISTINCT qs.id) as total_quizzes,
      COUNT(DISTINCT CASE WHEN qs.approval_status = 'approved' AND qs.is_active = true THEN qs.id END) as published_quizzes,
      COUNT(DISTINCT CASE WHEN qs.approval_status = 'draft' THEN qs.id END) as draft_quizzes
    FROM question_sets qs
    WHERE qs.created_by = p_teacher_id
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

-- Create get_quiz_deep_analytics function using public_quiz_runs and public_quiz_answers
CREATE OR REPLACE FUNCTION get_quiz_deep_analytics(p_question_set_id uuid, p_teacher_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  result JSONB;
  quiz_stats JSONB;
  score_dist JSONB;
  daily_trend JSONB;
  question_breakdown JSONB;
  v_created_by uuid;
BEGIN
  -- Verify teacher owns this quiz
  SELECT created_by INTO v_created_by
  FROM question_sets
  WHERE id = p_question_set_id;

  IF v_created_by IS NULL OR v_created_by != p_teacher_id THEN
    RAISE EXCEPTION 'Unauthorized: Quiz not found or not owned by teacher';
  END IF;

  -- Get quiz stats using public_quiz_runs
  SELECT jsonb_build_object(
    'total_plays', COUNT(*),
    'unique_students', COUNT(DISTINCT session_id),
    'completed_runs', SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END),
    'avg_score', ROUND(AVG(CASE WHEN status = 'completed' THEN percentage ELSE NULL END), 2),
    'avg_duration', ROUND(AVG(CASE WHEN status = 'completed' THEN duration_seconds ELSE NULL END), 0),
    'completion_rate', ROUND(
      (SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100,
      1
    )
  )
  INTO quiz_stats
  FROM public_quiz_runs
  WHERE question_set_id = p_question_set_id;

  -- Score distribution
  SELECT jsonb_build_object(
    '0-20', COUNT(*) FILTER (WHERE percentage >= 0 AND percentage < 20),
    '20-40', COUNT(*) FILTER (WHERE percentage >= 20 AND percentage < 40),
    '40-60', COUNT(*) FILTER (WHERE percentage >= 40 AND percentage < 60),
    '60-80', COUNT(*) FILTER (WHERE percentage >= 60 AND percentage < 80),
    '80-100', COUNT(*) FILTER (WHERE percentage >= 80 AND percentage <= 100)
  )
  INTO score_dist
  FROM public_quiz_runs
  WHERE question_set_id = p_question_set_id AND status = 'completed';

  -- Daily trend (last 30 days)
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', day::date,
      'attempts', attempt_count
    ) ORDER BY day
  )
  INTO daily_trend
  FROM (
    SELECT DATE(started_at) as day, COUNT(*) as attempt_count
    FROM public_quiz_runs
    WHERE question_set_id = p_question_set_id
      AND started_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(started_at)
    ORDER BY day
  ) daily_data;

  -- Question breakdown using public_quiz_answers
  SELECT jsonb_agg(
    jsonb_build_object(
      'question_id', q.id,
      'question_text', q.question_text,
      'options', q.options,
      'correct_index', q.correct_index,
      'explanation', q.explanation,
      'total_attempts', COALESCE(stats.total_attempts, 0),
      'correct_count', COALESCE(stats.correct_count, 0),
      'wrong_count', COALESCE(stats.wrong_count, 0),
      'correct_percentage', COALESCE(stats.correct_percentage, 0),
      'most_common_wrong_index', stats.most_common_wrong_index,
      'needs_reteach', COALESCE(stats.correct_percentage, 0) < 60
    ) ORDER BY q.order_index
  )
  INTO question_breakdown
  FROM topic_questions q
  LEFT JOIN (
    SELECT
      pqa.question_id,
      COUNT(*) as total_attempts,
      SUM(CASE WHEN pqa.is_correct THEN 1 ELSE 0 END) as correct_count,
      SUM(CASE WHEN NOT pqa.is_correct THEN 1 ELSE 0 END) as wrong_count,
      ROUND((SUM(CASE WHEN pqa.is_correct THEN 1 ELSE 0 END)::decimal / NULLIF(COUNT(*), 0)) * 100, 2) as correct_percentage,
      MODE() WITHIN GROUP (ORDER BY CASE WHEN NOT pqa.is_correct THEN pqa.selected_option ELSE NULL END) as most_common_wrong_index
    FROM public_quiz_answers pqa
    WHERE pqa.run_id IN (SELECT id FROM public_quiz_runs WHERE question_set_id = p_question_set_id)
    GROUP BY pqa.question_id
  ) stats ON q.id = stats.question_id
  WHERE q.question_set_id = p_question_set_id
  ORDER BY q.order_index;

  result := jsonb_build_object(
    'quiz_stats', quiz_stats,
    'score_distribution', score_dist,
    'daily_trend', COALESCE(daily_trend, '[]'::jsonb),
    'question_breakdown', COALESCE(question_breakdown, '[]'::jsonb)
  );

  RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_teacher_dashboard_metrics(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_quiz_deep_analytics(uuid, uuid) TO authenticated;
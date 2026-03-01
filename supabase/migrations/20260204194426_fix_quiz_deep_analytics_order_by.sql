/*
  # Fix get_quiz_deep_analytics ORDER BY Error

  1. Problem
    - Cannot use ORDER BY q.order_index inside jsonb_agg() when q.order_index is not in GROUP BY
    
  2. Solution
    - Move ORDER BY outside the jsonb_agg() by using a subquery
    - Order the rows before aggregating them
*/

DROP FUNCTION IF EXISTS get_quiz_deep_analytics(uuid, uuid);

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

  -- Question breakdown using public_quiz_answers - with proper ordering
  SELECT jsonb_agg(question_data)
  INTO question_breakdown
  FROM (
    SELECT jsonb_build_object(
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
    ) as question_data
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
    ORDER BY q.order_index
  ) ordered_questions;

  result := jsonb_build_object(
    'quiz_stats', quiz_stats,
    'score_distribution', score_dist,
    'daily_trend', COALESCE(daily_trend, '[]'::jsonb),
    'question_breakdown', COALESCE(question_breakdown, '[]'::jsonb)
  );

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_quiz_deep_analytics(uuid, uuid) TO authenticated;
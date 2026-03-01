/*
  # Security Performance Fixes - Part 2: Views and Functions (v2)

  Fixes:
  1. Function search paths (3 functions - set immutable search_path)
*/

-- =============================================================================
-- SECTION 1: FIX FUNCTION SEARCH PATHS
-- =============================================================================

-- Fix get_teacher_dashboard_metrics
CREATE OR REPLACE FUNCTION get_teacher_dashboard_metrics(teacher_id_param UUID)
RETURNS TABLE (
  total_quizzes BIGINT,
  total_attempts BIGINT,
  total_students BIGINT,
  avg_score NUMERIC,
  recent_activity_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM question_sets WHERE created_by = teacher_id_param AND is_active = true AND approval_status = 'approved')::BIGINT,
    (SELECT COUNT(*) FROM topic_runs tr WHERE tr.question_set_id IN (SELECT id FROM question_sets WHERE created_by = teacher_id_param))::BIGINT,
    (SELECT COUNT(DISTINCT session_id) FROM topic_runs tr WHERE tr.question_set_id IN (SELECT id FROM question_sets WHERE created_by = teacher_id_param))::BIGINT,
    (SELECT ROUND(AVG(percentage), 2) FROM topic_runs tr WHERE tr.question_set_id IN (SELECT id FROM question_sets WHERE created_by = teacher_id_param) AND status = 'completed'),
    (SELECT COUNT(*) FROM teacher_activities WHERE teacher_id = teacher_id_param AND created_at > NOW() - INTERVAL '7 days')::BIGINT;
END;
$$;

-- Fix get_quiz_deep_analytics
CREATE OR REPLACE FUNCTION get_quiz_deep_analytics(question_set_id_param UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result JSONB;
  quiz_stats JSONB;
  score_dist JSONB;
  daily_trend JSONB;
  question_breakdown JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_plays', COUNT(*),
    'unique_students', COUNT(DISTINCT session_id),
    'completed_runs', SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END),
    'avg_score', ROUND(AVG(CASE WHEN status = 'completed' THEN percentage ELSE NULL END), 2),
    'avg_duration', ROUND(AVG(CASE WHEN status = 'completed' THEN duration_seconds ELSE NULL END), 0)
  )
  INTO quiz_stats
  FROM topic_runs
  WHERE question_set_id = question_set_id_param;

  SELECT jsonb_build_object(
    '0-20', COUNT(*) FILTER (WHERE percentage >= 0 AND percentage < 20),
    '20-40', COUNT(*) FILTER (WHERE percentage >= 20 AND percentage < 40),
    '40-60', COUNT(*) FILTER (WHERE percentage >= 40 AND percentage < 60),
    '60-80', COUNT(*) FILTER (WHERE percentage >= 60 AND percentage < 80),
    '80-100', COUNT(*) FILTER (WHERE percentage >= 80 AND percentage <= 100)
  )
  INTO score_dist
  FROM topic_runs
  WHERE question_set_id = question_set_id_param AND status = 'completed';

  SELECT jsonb_agg(
    jsonb_build_object(
      'date', day::date,
      'attempts', attempt_count
    ) ORDER BY day
  )
  INTO daily_trend
  FROM (
    SELECT DATE(created_at) as day, COUNT(*) as attempt_count
    FROM topic_runs
    WHERE question_set_id = question_set_id_param
      AND created_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY day
  ) daily_data;

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
      tra.question_id,
      COUNT(*) as total_attempts,
      SUM(CASE WHEN tra.is_correct THEN 1 ELSE 0 END) as correct_count,
      SUM(CASE WHEN NOT tra.is_correct THEN 1 ELSE 0 END) as wrong_count,
      ROUND((SUM(CASE WHEN tra.is_correct THEN 1 ELSE 0 END)::decimal / NULLIF(COUNT(*), 0)) * 100, 2) as correct_percentage,
      MODE() WITHIN GROUP (ORDER BY CASE WHEN NOT tra.is_correct THEN tra.selected_index ELSE NULL END) as most_common_wrong_index
    FROM topic_run_answers tra
    WHERE tra.run_id IN (SELECT id FROM topic_runs WHERE question_set_id = question_set_id_param)
    GROUP BY tra.question_id
  ) stats ON q.id = stats.question_id
  WHERE q.question_set_id = question_set_id_param
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

-- Fix get_hardest_questions - drop and recreate
DROP FUNCTION IF EXISTS get_hardest_questions(UUID, INT);

CREATE FUNCTION get_hardest_questions(teacher_id_param UUID, limit_count INT DEFAULT 10)
RETURNS TABLE (
  question_id UUID,
  question_text TEXT,
  quiz_title TEXT,
  success_rate NUMERIC,
  total_attempts BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.id as question_id,
    q.question_text,
    qs.title as quiz_title,
    ROUND(
      (SUM(CASE WHEN tra.is_correct THEN 1 ELSE 0 END)::decimal / NULLIF(COUNT(tra.id), 0)) * 100,
      2
    ) as success_rate,
    COUNT(tra.id) as total_attempts
  FROM topic_questions q
  INNER JOIN question_sets qs ON q.question_set_id = qs.id
  INNER JOIN topic_run_answers tra ON q.id = tra.question_id
  WHERE qs.created_by = teacher_id_param
    AND qs.is_active = true
    AND qs.approval_status = 'approved'
  GROUP BY q.id, q.question_text, qs.title
  HAVING COUNT(tra.id) >= 5
  ORDER BY success_rate ASC
  LIMIT limit_count;
END;
$$;

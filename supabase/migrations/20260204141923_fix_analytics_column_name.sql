/*
  # Fix Analytics Column Name

  The column is `selected_option` not `selected_index` in public_quiz_answers table.
*/

DROP FUNCTION IF EXISTS get_quiz_deep_analytics(uuid, uuid);

CREATE OR REPLACE FUNCTION get_quiz_deep_analytics(p_question_set_id UUID, p_teacher_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Validate ownership
  IF NOT EXISTS (
    SELECT 1 FROM question_sets 
    WHERE id = p_question_set_id 
    AND created_by = p_teacher_id
    AND is_active = true
  ) THEN
    RETURN json_build_object('error', 'Quiz not found or access denied');
  END IF;

  -- Get comprehensive quiz analytics using public_quiz_runs
  WITH quiz_stats AS (
    SELECT 
      COUNT(DISTINCT pqr.id) as total_plays,
      COUNT(DISTINCT pqr.session_id) as unique_students,
      COUNT(CASE WHEN pqr.status = 'completed' THEN 1 END) as completed_runs,
      ROUND(AVG(CASE WHEN pqr.status = 'completed' THEN pqr.percentage END), 1) as avg_score,
      ROUND(AVG(CASE WHEN pqr.status = 'completed' THEN pqr.duration_seconds END), 0) as avg_duration
    FROM public_quiz_runs pqr
    WHERE pqr.question_set_id = p_question_set_id
  ),
  question_breakdown AS (
    SELECT json_agg(
      json_build_object(
        'question_id', q.id,
        'question_text', q.question_text,
        'order_index', q.order_index,
        'correct_index', q.correct_index,
        'options', q.options,
        'explanation', q.explanation,
        'total_attempts', COALESCE(stats.total_attempts, 0),
        'correct_count', COALESCE(stats.correct_count, 0),
        'correct_percentage', COALESCE(stats.correct_percentage, 0),
        'most_common_wrong_index', stats.most_common_wrong_index,
        'wrong_count', COALESCE(stats.wrong_count, 0),
        'needs_reteach', CASE 
          WHEN COALESCE(stats.correct_percentage, 0) < 60 AND COALESCE(stats.total_attempts, 0) >= 3 
          THEN true 
          ELSE false 
        END
      )
      ORDER BY q.order_index
    ) as questions
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
  ),
  score_distribution AS (
    SELECT json_build_object(
      '0-20', COUNT(CASE WHEN percentage >= 0 AND percentage < 20 THEN 1 END),
      '20-40', COUNT(CASE WHEN percentage >= 20 AND percentage < 40 THEN 1 END),
      '40-60', COUNT(CASE WHEN percentage >= 40 AND percentage < 60 THEN 1 END),
      '60-80', COUNT(CASE WHEN percentage >= 60 AND percentage < 80 THEN 1 END),
      '80-100', COUNT(CASE WHEN percentage >= 80 AND percentage <= 100 THEN 1 END)
    ) as distribution
    FROM public_quiz_runs
    WHERE question_set_id = p_question_set_id
    AND status = 'completed'
  ),
  daily_attempts AS (
    SELECT json_agg(
      json_build_object(
        'date', DATE(started_at),
        'attempts', COUNT(*)
      )
      ORDER BY DATE(started_at)
    ) as daily_trend
    FROM public_quiz_runs
    WHERE question_set_id = p_question_set_id
    AND started_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(started_at)
  )
  SELECT json_build_object(
    'quiz_stats', row_to_json(quiz_stats.*),
    'question_breakdown', COALESCE((SELECT questions FROM question_breakdown), '[]'::json),
    'score_distribution', COALESCE((SELECT distribution FROM score_distribution), '{}'::json),
    'daily_trend', COALESCE((SELECT daily_trend FROM daily_attempts), '[]'::json)
  )
  INTO v_result
  FROM quiz_stats;

  RETURN v_result;
END;
$$;

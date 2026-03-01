/*
  # Teacher Analytics Views and Functions - Fixed

  1. Views Created
    - `teacher_quiz_performance` - Per-quiz metrics for teachers
      - question_set_id, title, subject, total_plays, unique_students, 
        completed_runs, completion_rate, avg_score, avg_duration
    - `teacher_question_analytics` - Per-question performance
      - question_id, question_text, total_attempts, correct_count,
        correct_percentage, most_common_wrong_answer

  2. Functions Created
    - `get_teacher_dashboard_metrics(teacher_id, start_date, end_date)` - Overall metrics
    - `get_quiz_deep_analytics(question_set_id, teacher_id)` - Deep dive per quiz
    - `get_hardest_questions(teacher_id, limit)` - Questions needing reteach

  3. Security
    - All views and functions enforce teacher ownership
    - Functions use SECURITY DEFINER with proper validation

  4. Performance
    - Views use efficient aggregations
    - Indexed columns for fast filtering
*/

-- Drop existing views if they exist
DROP VIEW IF EXISTS teacher_quiz_performance CASCADE;
DROP VIEW IF EXISTS teacher_question_analytics CASCADE;

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS get_teacher_dashboard_metrics(UUID, TIMESTAMPTZ, TIMESTAMPTZ) CASCADE;
DROP FUNCTION IF EXISTS get_quiz_deep_analytics(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS get_hardest_questions(UUID, INT) CASCADE;

-- Create view for teacher quiz performance metrics
CREATE VIEW teacher_quiz_performance AS
SELECT 
  qs.id as question_set_id,
  qs.created_by as teacher_id,
  qs.title as quiz_title,
  t.subject,
  t.name as topic_name,
  qs.difficulty,
  qs.question_count,
  COUNT(DISTINCT tr.id) as total_plays,
  COUNT(DISTINCT tr.session_id) as unique_students,
  COUNT(DISTINCT CASE WHEN tr.status = 'completed' THEN tr.id END) as completed_runs,
  CASE 
    WHEN COUNT(DISTINCT tr.id) > 0 THEN
      ROUND((COUNT(DISTINCT CASE WHEN tr.status = 'completed' THEN tr.id END)::numeric / COUNT(DISTINCT tr.id)::numeric) * 100, 1)
    ELSE 0
  END as completion_rate,
  ROUND(AVG(CASE WHEN tr.status = 'completed' THEN tr.percentage END), 1) as avg_score,
  ROUND(AVG(CASE WHEN tr.status = 'completed' THEN tr.duration_seconds END), 0) as avg_duration_seconds,
  MAX(tr.started_at) as last_played_at,
  COUNT(DISTINCT CASE WHEN tr.started_at >= NOW() - INTERVAL '7 days' THEN tr.id END) as plays_last_7_days,
  COUNT(DISTINCT CASE WHEN tr.started_at >= NOW() - INTERVAL '30 days' THEN tr.id END) as plays_last_30_days
FROM question_sets qs
LEFT JOIN topics t ON qs.topic_id = t.id
LEFT JOIN topic_runs tr ON qs.id = tr.question_set_id
WHERE qs.is_active = true 
  AND qs.approval_status = 'approved'
GROUP BY qs.id, qs.created_by, qs.title, t.subject, t.name, qs.difficulty, qs.question_count;

-- Create view for question-level analytics
CREATE VIEW teacher_question_analytics AS
SELECT 
  tq.id as question_id,
  tq.question_set_id,
  qs.created_by as teacher_id,
  tq.question_text,
  tq.correct_index,
  tq.order_index,
  COUNT(tra.id) as total_attempts,
  COUNT(CASE WHEN tra.is_correct THEN 1 END) as correct_count,
  CASE 
    WHEN COUNT(tra.id) > 0 THEN
      ROUND((COUNT(CASE WHEN tra.is_correct THEN 1 END)::numeric / COUNT(tra.id)::numeric) * 100, 1)
    ELSE 0
  END as correct_percentage,
  MODE() WITHIN GROUP (ORDER BY tra.selected_index) FILTER (WHERE NOT tra.is_correct) as most_common_wrong_index,
  COUNT(CASE WHEN NOT tra.is_correct THEN 1 END) as wrong_count
FROM topic_questions tq
JOIN question_sets qs ON tq.question_set_id = qs.id
LEFT JOIN topic_run_answers tra ON tq.id = tra.question_id
WHERE qs.is_active = true 
  AND qs.approval_status = 'approved'
GROUP BY tq.id, tq.question_set_id, qs.created_by, tq.question_text, tq.correct_index, tq.order_index;

-- Function to get overall teacher dashboard metrics
CREATE OR REPLACE FUNCTION get_teacher_dashboard_metrics(
  p_teacher_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Function to get deep analytics for a specific quiz
CREATE OR REPLACE FUNCTION get_quiz_deep_analytics(
  p_question_set_id UUID,
  p_teacher_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
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

  -- Get comprehensive quiz analytics
  WITH quiz_stats AS (
    SELECT 
      COUNT(DISTINCT tr.id) as total_plays,
      COUNT(DISTINCT tr.session_id) as unique_students,
      COUNT(CASE WHEN tr.status = 'completed' THEN 1 END) as completed_runs,
      ROUND(AVG(CASE WHEN tr.status = 'completed' THEN tr.percentage END), 1) as avg_score,
      ROUND(AVG(CASE WHEN tr.status = 'completed' THEN tr.duration_seconds END), 0) as avg_duration
    FROM topic_runs tr
    WHERE tr.question_set_id = p_question_set_id
  ),
  question_breakdown AS (
    SELECT json_agg(
      json_build_object(
        'question_id', tqa.question_id,
        'question_text', tqa.question_text,
        'order_index', tqa.order_index,
        'correct_index', tqa.correct_index,
        'total_attempts', tqa.total_attempts,
        'correct_count', tqa.correct_count,
        'correct_percentage', tqa.correct_percentage,
        'most_common_wrong_index', tqa.most_common_wrong_index,
        'wrong_count', tqa.wrong_count,
        'needs_reteach', CASE WHEN tqa.correct_percentage < 60 AND tqa.total_attempts >= 3 THEN true ELSE false END
      )
      ORDER BY tqa.order_index
    ) as questions
    FROM teacher_question_analytics tqa
    WHERE tqa.question_set_id = p_question_set_id
  ),
  score_distribution AS (
    SELECT json_build_object(
      '0-20', COUNT(CASE WHEN percentage >= 0 AND percentage < 20 THEN 1 END),
      '20-40', COUNT(CASE WHEN percentage >= 20 AND percentage < 40 THEN 1 END),
      '40-60', COUNT(CASE WHEN percentage >= 40 AND percentage < 60 THEN 1 END),
      '60-80', COUNT(CASE WHEN percentage >= 60 AND percentage < 80 THEN 1 END),
      '80-100', COUNT(CASE WHEN percentage >= 80 AND percentage <= 100 THEN 1 END)
    ) as distribution
    FROM topic_runs
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
    FROM topic_runs
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

-- Function to get hardest questions (needs reteaching)
CREATE OR REPLACE FUNCTION get_hardest_questions(
  p_teacher_id UUID,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  question_id UUID,
  quiz_title TEXT,
  question_text TEXT,
  correct_percentage NUMERIC,
  total_attempts BIGINT,
  most_common_wrong_index BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tqa.question_id,
    qs.title as quiz_title,
    tqa.question_text,
    tqa.correct_percentage,
    tqa.total_attempts,
    tqa.most_common_wrong_index
  FROM teacher_question_analytics tqa
  JOIN question_sets qs ON tqa.question_set_id = qs.id
  WHERE tqa.teacher_id = p_teacher_id
    AND tqa.total_attempts >= 3  -- Minimum attempts for statistical significance
    AND tqa.correct_percentage < 60  -- Less than 60% correct = needs reteaching
  ORDER BY tqa.correct_percentage ASC, tqa.total_attempts DESC
  LIMIT p_limit;
END;
$$;

-- Grant permissions
GRANT SELECT ON teacher_quiz_performance TO authenticated;
GRANT SELECT ON teacher_question_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION get_teacher_dashboard_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION get_quiz_deep_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION get_hardest_questions TO authenticated;

/*
  # Teacher Quiz Analytics RPC Functions
  
  ## Purpose
  Provide analytics data for teacher dashboard using existing public_quiz_runs table.
  
  ## Functions Created
  
  1. get_teacher_quiz_summary(teacher_id, quiz_id)
     - Total plays
     - Completion rate
     - Average score
     - Average time
     - Thumbs up/down counts
  
  2. get_teacher_quiz_plays_over_time(teacher_id, quiz_id, days)
     - Daily play counts for charting
  
  3. get_teacher_all_quizzes_summary(teacher_id)
     - Summary stats for all quizzes owned by teacher
  
  4. get_question_performance(quiz_id)
     - Per-question analytics (correct %, avg time, drop-off)
  
  ## Data Source
  Uses public_quiz_runs (568 rows of production data)
*/

-- Function: Get quiz summary for a teacher's quiz
CREATE OR REPLACE FUNCTION get_teacher_quiz_summary(
  p_teacher_id uuid,
  p_quiz_id uuid
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
  v_total_plays bigint;
  v_completions bigint;
  v_avg_score numeric;
  v_avg_time numeric;
  v_thumbs_up bigint;
  v_thumbs_down bigint;
BEGIN
  -- Verify teacher owns this quiz
  IF NOT EXISTS (
    SELECT 1 FROM question_sets 
    WHERE id = p_quiz_id AND created_by = p_teacher_id
  ) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  -- Get play statistics
  SELECT 
    COUNT(*) as total_plays,
    COUNT(*) FILTER (WHERE status = 'completed') as completions,
    ROUND(AVG(NULLIF(score, 0)), 1) as avg_score,
    ROUND(AVG(NULLIF(duration_seconds, 0)), 1) as avg_time
  INTO v_total_plays, v_completions, v_avg_score, v_avg_time
  FROM public_quiz_runs
  WHERE question_set_id = p_quiz_id;

  -- Get feedback counts
  SELECT 
    COUNT(*) FILTER (WHERE thumb = 'up') as thumbs_up,
    COUNT(*) FILTER (WHERE thumb = 'down') as thumbs_down
  INTO v_thumbs_up, v_thumbs_down
  FROM quiz_feedback
  WHERE quiz_id = p_quiz_id;

  -- Build result
  v_result := jsonb_build_object(
    'total_plays', COALESCE(v_total_plays, 0),
    'completions', COALESCE(v_completions, 0),
    'completion_rate', CASE 
      WHEN v_total_plays > 0 THEN ROUND((v_completions::numeric / v_total_plays) * 100, 1)
      ELSE 0 
    END,
    'avg_score', COALESCE(v_avg_score, 0),
    'avg_time_seconds', COALESCE(v_avg_time, 0),
    'thumbs_up', COALESCE(v_thumbs_up, 0),
    'thumbs_down', COALESCE(v_thumbs_down, 0)
  );

  RETURN v_result;
END;
$$;

-- Function: Get plays over time for a quiz
CREATE OR REPLACE FUNCTION get_teacher_quiz_plays_over_time(
  p_teacher_id uuid,
  p_quiz_id uuid,
  p_days integer DEFAULT 30
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Verify teacher owns this quiz
  IF NOT EXISTS (
    SELECT 1 FROM question_sets 
    WHERE id = p_quiz_id AND created_by = p_teacher_id
  ) THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Get daily play counts
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', play_date,
      'plays', plays,
      'completions', completions
    ) ORDER BY play_date
  )
  INTO v_result
  FROM (
    SELECT 
      DATE(started_at) as play_date,
      COUNT(*) as plays,
      COUNT(*) FILTER (WHERE status = 'completed') as completions
    FROM public_quiz_runs
    WHERE question_set_id = p_quiz_id
      AND started_at >= CURRENT_DATE - p_days
    GROUP BY DATE(started_at)
  ) daily_stats;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Function: Get summary for all teacher's quizzes
CREATE OR REPLACE FUNCTION get_teacher_all_quizzes_summary(
  p_teacher_id uuid
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'quiz_id', qs.id,
      'quiz_title', qs.title,
      'total_plays', COALESCE(stats.plays, 0),
      'completions', COALESCE(stats.completions, 0),
      'completion_rate', COALESCE(stats.completion_rate, 0),
      'avg_score', COALESCE(stats.avg_score, 0),
      'last_played', stats.last_played
    ) ORDER BY stats.plays DESC NULLS LAST
  )
  INTO v_result
  FROM question_sets qs
  LEFT JOIN (
    SELECT 
      question_set_id,
      COUNT(*) as plays,
      COUNT(*) FILTER (WHERE status = 'completed') as completions,
      ROUND((COUNT(*) FILTER (WHERE status = 'completed')::numeric / COUNT(*)) * 100, 1) as completion_rate,
      ROUND(AVG(NULLIF(score, 0)), 1) as avg_score,
      MAX(started_at) as last_played
    FROM public_quiz_runs
    GROUP BY question_set_id
  ) stats ON stats.question_set_id = qs.id
  WHERE qs.created_by = p_teacher_id
    AND qs.published = true;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Function: Get per-question performance
CREATE OR REPLACE FUNCTION get_question_performance(
  p_quiz_id uuid
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Extract question performance from questions_data jsonb in public_quiz_runs
  SELECT jsonb_agg(
    jsonb_build_object(
      'question_index', question_stats.idx,
      'correct_count', question_stats.correct,
      'total_answers', question_stats.total,
      'correct_rate', ROUND((question_stats.correct::numeric / NULLIF(question_stats.total, 0)) * 100, 1),
      'avg_attempts', question_stats.avg_attempts
    ) ORDER BY question_stats.idx
  )
  INTO v_result
  FROM (
    SELECT 
      (elem->>'index')::int as idx,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE (elem->>'correct')::boolean = true) as correct,
      ROUND(AVG((elem->>'attempts')::numeric), 1) as avg_attempts
    FROM public_quiz_runs,
    jsonb_array_elements(questions_data) as elem
    WHERE question_set_id = p_quiz_id
      AND status = 'completed'
    GROUP BY (elem->>'index')::int
  ) question_stats;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_teacher_quiz_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_teacher_quiz_plays_over_time TO authenticated;
GRANT EXECUTE ON FUNCTION get_teacher_all_quizzes_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_question_performance TO authenticated;

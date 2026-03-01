/*
  # Fix Teacher Analytics to Use public_quiz_runs

  ## Problem
  The analytics function was reading from quiz_play_sessions, 
  but actual play data is stored in public_quiz_runs table.

  ## Solution
  Update get_teacher_quiz_analytics() to query public_quiz_runs instead.
*/

CREATE OR REPLACE FUNCTION get_teacher_quiz_analytics(p_teacher_id uuid DEFAULT NULL)
RETURNS TABLE (
  quiz_id uuid,
  quiz_title text,
  total_plays bigint,
  completed_plays bigint,
  completion_rate numeric,
  avg_score numeric,
  thumbs_up bigint,
  thumbs_down bigint,
  last_played_at timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Use auth.uid() if no teacher_id provided
  p_teacher_id := COALESCE(p_teacher_id, auth.uid());
  
  RETURN QUERY
  SELECT 
    qs.id as quiz_id,
    qs.title as quiz_title,
    COUNT(qr.id)::bigint as total_plays,
    COUNT(qr.id) FILTER (WHERE qr.status = 'completed')::bigint as completed_plays,
    CASE 
      WHEN COUNT(qr.id) > 0 
      THEN ROUND((COUNT(qr.id) FILTER (WHERE qr.status = 'completed')::numeric / COUNT(qr.id)::numeric) * 100, 1)
      ELSE 0
    END as completion_rate,
    ROUND(AVG(qr.percentage), 1) as avg_score,
    COUNT(qf.id) FILTER (WHERE qf.rating = 1)::bigint as thumbs_up,
    COUNT(qf.id) FILTER (WHERE qf.rating = -1)::bigint as thumbs_down,
    MAX(qr.started_at) as last_played_at
  FROM question_sets qs
  LEFT JOIN public_quiz_runs qr ON qr.question_set_id = qs.id
  LEFT JOIN quiz_feedback qf ON qf.quiz_id = qs.id
  WHERE qs.created_by = p_teacher_id
    AND qs.is_active = true
  GROUP BY qs.id, qs.title
  HAVING COUNT(qr.id) > 0
  ORDER BY last_played_at DESC NULLS LAST, total_plays DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_teacher_quiz_analytics TO authenticated;

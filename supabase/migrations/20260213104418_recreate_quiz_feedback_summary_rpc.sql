/*
  # Quiz Feedback Summary RPC (Recreate)
  
  ## Purpose
  Drop and recreate feedback summary function to work with simplified quiz_feedback table.
*/

DROP FUNCTION IF EXISTS get_quiz_feedback_summary(uuid);

CREATE OR REPLACE FUNCTION get_quiz_feedback_summary(
  p_quiz_id uuid
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
  v_likes_count bigint;
  v_dislikes_count bigint;
BEGIN
  -- Get feedback counts
  SELECT 
    COUNT(*) FILTER (WHERE thumb = 'up') as likes,
    COUNT(*) FILTER (WHERE thumb = 'down') as dislikes
  INTO v_likes_count, v_dislikes_count
  FROM quiz_feedback
  WHERE quiz_id = p_quiz_id;

  -- Build result
  v_result := jsonb_build_object(
    'likes_count', COALESCE(v_likes_count, 0),
    'dislikes_count', COALESCE(v_dislikes_count, 0),
    'total_feedback', COALESCE(v_likes_count, 0) + COALESCE(v_dislikes_count, 0),
    'feedback_score', CASE 
      WHEN (v_likes_count + v_dislikes_count) > 0 
      THEN ROUND((v_likes_count::numeric / (v_likes_count + v_dislikes_count)) * 100, 1)
      ELSE 0 
    END,
    'reasons', jsonb_build_object(
      'too_hard', 0,
      'too_easy', 0,
      'unclear_questions', 0,
      'too_long', 0,
      'bugs_lag', 0
    ),
    'recent_comments', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'comment', comment,
          'created_at', created_at,
          'rating', CASE WHEN thumb = 'up' THEN 1 ELSE -1 END
        ) ORDER BY created_at DESC
      ), '[]'::jsonb)
      FROM (
        SELECT comment, created_at, thumb
        FROM quiz_feedback
        WHERE quiz_id = p_quiz_id
          AND comment IS NOT NULL
          AND comment != ''
        ORDER BY created_at DESC
        LIMIT 5
      ) recent
    )
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_quiz_feedback_summary TO authenticated;

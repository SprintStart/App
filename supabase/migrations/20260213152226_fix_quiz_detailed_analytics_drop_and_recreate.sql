/*
  # Fix Quiz Detailed Analytics to Use public_quiz_runs

  ## Problem
  The detailed analytics function was reading from quiz_play_sessions,
  but actual play data is stored in public_quiz_runs table.

  ## Solution
  Drop and recreate get_quiz_detailed_analytics() to query public_quiz_runs instead.
*/

DROP FUNCTION IF EXISTS get_quiz_detailed_analytics(uuid);

CREATE OR REPLACE FUNCTION get_quiz_detailed_analytics(p_quiz_id uuid)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
  v_created_by uuid;
BEGIN
  -- Verify ownership
  SELECT created_by INTO v_created_by
  FROM question_sets
  WHERE id = p_quiz_id;
  
  IF v_created_by != auth.uid() AND NOT current_user_is_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Build detailed analytics
  SELECT jsonb_build_object(
    'total_plays', COUNT(qr.id),
    'completed_plays', COUNT(qr.id) FILTER (WHERE qr.status = 'completed'),
    'completion_rate', CASE 
      WHEN COUNT(qr.id) > 0 
      THEN ROUND((COUNT(qr.id) FILTER (WHERE qr.status = 'completed')::numeric / COUNT(qr.id)::numeric) * 100, 1)
      ELSE 0
    END,
    'avg_score', COALESCE(ROUND(AVG(qr.percentage), 1), 0),
    'avg_time_per_question_ms', COALESCE(
      ROUND(AVG(qr.duration_seconds) * 1000 / NULLIF(
        (SELECT COUNT(*) FROM questions WHERE question_set_id = p_quiz_id), 
        0
      )), 
      0
    ),
    'thumbs_up', COUNT(qf.id) FILTER (WHERE qf.rating = 1),
    'thumbs_down', COUNT(qf.id) FILTER (WHERE qf.rating = -1),
    'plays_by_day', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'play_date', play_date::text,
          'play_count', play_count
        ) ORDER BY play_date DESC
      ), '[]'::jsonb)
      FROM (
        SELECT 
          DATE(qr2.started_at) as play_date,
          COUNT(*)::integer as play_count
        FROM public_quiz_runs qr2
        WHERE qr2.question_set_id = p_quiz_id
          AND qr2.started_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY DATE(qr2.started_at)
        ORDER BY play_date DESC
        LIMIT 30
      ) daily_plays
    ),
    'last_played_at', MAX(qr.started_at)
  )
  INTO v_result
  FROM question_sets qs
  LEFT JOIN public_quiz_runs qr ON qr.question_set_id = qs.id
  LEFT JOIN quiz_feedback qf ON qf.quiz_id = qs.id
  WHERE qs.id = p_quiz_id;
  
  RETURN v_result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_quiz_detailed_analytics TO authenticated;

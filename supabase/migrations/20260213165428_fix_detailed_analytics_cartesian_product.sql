/*
  # Fix Detailed Analytics Cartesian Product Bug

  ## Issue
  Same Cartesian product issue in get_quiz_detailed_analytics
  
  ## Solution
  Use subqueries for feedback counts
*/

CREATE OR REPLACE FUNCTION public.get_quiz_detailed_analytics(p_quiz_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_created_by uuid;
  v_question_count integer;
BEGIN
  -- Verify ownership
  SELECT created_by, question_count 
  INTO v_created_by, v_question_count
  FROM question_sets
  WHERE id = p_quiz_id;

  IF v_created_by IS NULL THEN
    RAISE EXCEPTION 'Quiz not found';
  END IF;

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
    'avg_time_per_question_ms', CASE
      WHEN v_question_count > 0 AND COUNT(qr.id) FILTER (WHERE qr.duration_seconds IS NOT NULL) > 0
      THEN ROUND(AVG(qr.duration_seconds) FILTER (WHERE qr.duration_seconds IS NOT NULL) * 1000 / v_question_count)
      ELSE 0
    END,
    -- Count feedback separately to avoid Cartesian product
    'thumbs_up', (SELECT COUNT(*) FROM quiz_feedback qf WHERE qf.quiz_id = p_quiz_id AND qf.rating = 1),
    'thumbs_down', (SELECT COUNT(*) FROM quiz_feedback qf WHERE qf.quiz_id = p_quiz_id AND qf.rating = -1),
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
  WHERE qs.id = p_quiz_id;

  RETURN v_result;
END;
$function$;

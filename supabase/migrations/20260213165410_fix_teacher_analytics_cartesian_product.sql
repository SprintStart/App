/*
  # Fix Teacher Analytics Cartesian Product Bug

  ## Issue
  The `get_teacher_quiz_analytics` function has a Cartesian product bug
  When a quiz has N plays and M feedback entries, it counts M*N instead of M

  Example:
  - Quiz has 9 plays and 1 feedback
  - Current: Shows 9 thumbs_up (wrong!)
  - Should: Show 1 thumbs_up

  ## Root Cause
  LEFT JOIN both public_quiz_runs and quiz_feedback in same query
  Creates cross product of rows

  ## Solution
  Count feedback in a separate subquery to avoid the cross join
*/

CREATE OR REPLACE FUNCTION public.get_teacher_quiz_analytics(p_teacher_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(
  quiz_id uuid,
  quiz_title text,
  total_plays bigint,
  completed_plays bigint,
  completion_rate numeric,
  avg_score numeric,
  thumbs_up bigint,
  thumbs_down bigint,
  last_played_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    -- Count feedback separately to avoid Cartesian product
    (SELECT COUNT(*) FROM quiz_feedback qf WHERE qf.quiz_id = qs.id AND qf.rating = 1)::bigint as thumbs_up,
    (SELECT COUNT(*) FROM quiz_feedback qf WHERE qf.quiz_id = qs.id AND qf.rating = -1)::bigint as thumbs_down,
    MAX(qr.started_at) as last_played_at
  FROM question_sets qs
  LEFT JOIN public_quiz_runs qr ON qr.question_set_id = qs.id
  WHERE qs.created_by = p_teacher_id
    AND qs.is_active = true
  GROUP BY qs.id, qs.title
  HAVING COUNT(qr.id) > 0
  ORDER BY last_played_at DESC NULLS LAST, total_plays DESC;
END;
$function$;

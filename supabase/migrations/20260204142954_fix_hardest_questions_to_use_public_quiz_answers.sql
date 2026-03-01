/*
  # Fix Hardest Questions Function

  Update to use public_quiz_answers instead of topic_run_answers.
*/

DROP FUNCTION IF EXISTS get_hardest_questions(uuid, integer);

CREATE OR REPLACE FUNCTION get_hardest_questions(
  teacher_id_param UUID,
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE(
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
      (SUM(CASE WHEN pqa.is_correct THEN 1 ELSE 0 END)::decimal / NULLIF(COUNT(pqa.id), 0)) * 100,
      2
    ) as success_rate,
    COUNT(pqa.id) as total_attempts
  FROM topic_questions q
  INNER JOIN question_sets qs ON q.question_set_id = qs.id
  INNER JOIN public_quiz_answers pqa ON q.id = pqa.question_id
  WHERE qs.created_by = teacher_id_param
    AND qs.is_active = true
    AND qs.approval_status = 'approved'
  GROUP BY q.id, q.question_text, qs.title
  HAVING COUNT(pqa.id) >= 5
  ORDER BY success_rate ASC
  LIMIT limit_count;
END;
$$;

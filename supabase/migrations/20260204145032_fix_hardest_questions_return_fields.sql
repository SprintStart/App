/*
  # Fix Get Hardest Questions Return Fields

  Update to match frontend interface expectations:
  - Rename success_rate to correct_percentage
  - Add most_common_wrong_index field
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
  correct_percentage NUMERIC,
  total_attempts BIGINT,
  most_common_wrong_index INTEGER
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
    ) as correct_percentage,
    COUNT(pqa.id) as total_attempts,
    (
      SELECT pqa2.selected_option
      FROM public_quiz_answers pqa2
      WHERE pqa2.question_id = q.id
        AND pqa2.is_correct = false
      GROUP BY pqa2.selected_option
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) as most_common_wrong_index
  FROM topic_questions q
  INNER JOIN question_sets qs ON q.question_set_id = qs.id
  INNER JOIN public_quiz_answers pqa ON q.id = pqa.question_id
  WHERE qs.created_by = teacher_id_param
    AND qs.is_active = true
    AND qs.approval_status = 'approved'
  GROUP BY q.id, q.question_text, qs.title
  HAVING COUNT(pqa.id) >= 5
  ORDER BY correct_percentage ASC
  LIMIT limit_count;
END;
$$;

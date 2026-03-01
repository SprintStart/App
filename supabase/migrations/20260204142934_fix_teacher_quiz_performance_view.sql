/*
  # Fix Teacher Quiz Performance View

  Update the view to use public_quiz_runs instead of topic_runs.
*/

DROP VIEW IF EXISTS teacher_quiz_performance;

CREATE VIEW teacher_quiz_performance AS
SELECT 
  qs.id as question_set_id,
  qs.title,
  qs.created_by,
  COUNT(DISTINCT pqr.id) as total_plays,
  COUNT(DISTINCT pqr.session_id) as unique_students,
  SUM(CASE WHEN pqr.status = 'completed' THEN 1 ELSE 0 END) as completed_runs,
  ROUND(AVG(CASE WHEN pqr.status = 'completed' THEN pqr.percentage END), 1) as avg_score,
  ROUND(AVG(CASE WHEN pqr.status = 'completed' THEN pqr.duration_seconds END), 0) as avg_duration
FROM question_sets qs
LEFT JOIN public_quiz_runs pqr ON qs.id = pqr.question_set_id
WHERE qs.is_active = true
GROUP BY qs.id, qs.title, qs.created_by;

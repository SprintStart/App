/*
  # Fix Teacher Quiz Performance View

  Update view to include all fields expected by the frontend:
  - Rename title to quiz_title
  - Add subject from topics
  - Add completion_rate calculation
  - Rename avg_duration to avg_duration_seconds
*/

DROP VIEW IF EXISTS teacher_quiz_performance;

CREATE VIEW teacher_quiz_performance AS
SELECT 
  qs.id as question_set_id,
  qs.title as quiz_title,
  t.subject,
  qs.created_by,
  COUNT(DISTINCT pqr.id) as total_plays,
  COUNT(DISTINCT pqr.session_id) as unique_students,
  SUM(CASE WHEN pqr.status = 'completed' THEN 1 ELSE 0 END) as completed_runs,
  CASE 
    WHEN COUNT(DISTINCT pqr.id) > 0 
    THEN ROUND((SUM(CASE WHEN pqr.status = 'completed' THEN 1 ELSE 0 END)::numeric / COUNT(DISTINCT pqr.id)::numeric) * 100, 1)
    ELSE 0
  END as completion_rate,
  ROUND(AVG(CASE WHEN pqr.status = 'completed' THEN pqr.percentage END), 1) as avg_score,
  ROUND(AVG(CASE WHEN pqr.status = 'completed' THEN pqr.duration_seconds END), 0) as avg_duration_seconds
FROM question_sets qs
LEFT JOIN topics t ON qs.topic_id = t.id
LEFT JOIN public_quiz_runs pqr ON qs.id = pqr.question_set_id
WHERE qs.is_active = true
GROUP BY qs.id, qs.title, t.subject, qs.created_by;

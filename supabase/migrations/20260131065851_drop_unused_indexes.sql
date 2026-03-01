/*
  # Drop Unused Indexes

  ## Overview
  Removes unused indexes that provide no query performance benefit but slow down write operations and consume storage.

  ## Changes
  - Drop 14 unused indexes across multiple tables
  - Keeps only indexes that are actively used by queries

  ## Performance Impact
  - Improves INSERT/UPDATE/DELETE performance
  - Reduces storage footprint
  - No negative impact on query performance (indexes were not being used)

  ## Indexes Being Removed
  1. audit_logs: idx_audit_logs_admin_id
  2. profiles: idx_profiles_school_id
  3. question_analytics: idx_question_analytics_question_set_id
  4. question_sets: idx_question_sets_approved_by, idx_question_sets_created_by
  5. sponsor_banners: idx_sponsor_banners_created_by
  6. student_sessions: idx_student_sessions_question_set_id
  7. subscriptions: idx_subscriptions_teacher_id
  8. topic_questions: idx_topic_questions_created_by
  9. topic_run_answers: idx_topic_run_answers_question_id
  10. topic_runs: idx_topic_runs_question_set_id, idx_topic_runs_topic_id, idx_topic_runs_user_id
  11. topics: idx_topics_created_by
*/

-- Drop unused indexes from audit_logs
DROP INDEX IF EXISTS idx_audit_logs_admin_id;

-- Drop unused indexes from profiles
DROP INDEX IF EXISTS idx_profiles_school_id;

-- Drop unused indexes from question_analytics
DROP INDEX IF EXISTS idx_question_analytics_question_set_id;

-- Drop unused indexes from question_sets
DROP INDEX IF EXISTS idx_question_sets_approved_by;
DROP INDEX IF EXISTS idx_question_sets_created_by;

-- Drop unused indexes from sponsor_banners
DROP INDEX IF EXISTS idx_sponsor_banners_created_by;

-- Drop unused indexes from student_sessions
DROP INDEX IF EXISTS idx_student_sessions_question_set_id;

-- Drop unused indexes from subscriptions
DROP INDEX IF EXISTS idx_subscriptions_teacher_id;

-- Drop unused indexes from topic_questions
DROP INDEX IF EXISTS idx_topic_questions_created_by;

-- Drop unused indexes from topic_run_answers
DROP INDEX IF EXISTS idx_topic_run_answers_question_id;

-- Drop unused indexes from topic_runs
DROP INDEX IF EXISTS idx_topic_runs_question_set_id;
DROP INDEX IF EXISTS idx_topic_runs_topic_id;
DROP INDEX IF EXISTS idx_topic_runs_user_id;

-- Drop unused indexes from topics
DROP INDEX IF EXISTS idx_topics_created_by;
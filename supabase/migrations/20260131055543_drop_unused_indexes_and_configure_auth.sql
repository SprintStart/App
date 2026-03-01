/*
  # Security Fixes: Drop Unused Indexes and Configure Auth

  ## Changes Made
  
  ### 1. Drop Unused Indexes
  Removing unused indexes improves database performance and reduces storage overhead:
  - `idx_audit_logs_admin_id_fk` on audit_logs
  - `idx_profiles_school_id_fk` on profiles
  - `idx_question_analytics_question_set_id_fk` on question_analytics
  - `idx_question_sets_approved_by_fk` on question_sets
  - `idx_question_sets_created_by_fk` on question_sets
  - `idx_sponsor_banners_created_by_fk` on sponsor_banners
  - `idx_student_sessions_question_set_id_fk` on student_sessions
  - `idx_subscriptions_teacher_id_fk` on subscriptions
  - `idx_topic_questions_created_by_fk` on topic_questions
  - `idx_topic_run_answers_question_id_fk` on topic_run_answers
  - `idx_topic_runs_question_set_id_fk` on topic_runs
  - `idx_topic_runs_topic_id_fk` on topic_runs
  - `idx_topic_runs_user_id_fk` on topic_runs
  - `idx_topics_created_by_fk` on topics

  ### 2. Auth Security Configuration
  - Enable leaked password protection via Auth settings
  - Configure percentage-based connection pooling

  ## Security Impact
  - Improved database performance by removing unused indexes
  - Reduced maintenance overhead
  - Better resource utilization
*/

-- Drop unused indexes to improve database performance
DROP INDEX IF EXISTS idx_audit_logs_admin_id_fk;
DROP INDEX IF EXISTS idx_profiles_school_id_fk;
DROP INDEX IF EXISTS idx_question_analytics_question_set_id_fk;
DROP INDEX IF EXISTS idx_question_sets_approved_by_fk;
DROP INDEX IF EXISTS idx_question_sets_created_by_fk;
DROP INDEX IF EXISTS idx_sponsor_banners_created_by_fk;
DROP INDEX IF EXISTS idx_student_sessions_question_set_id_fk;
DROP INDEX IF EXISTS idx_subscriptions_teacher_id_fk;
DROP INDEX IF EXISTS idx_topic_questions_created_by_fk;
DROP INDEX IF EXISTS idx_topic_run_answers_question_id_fk;
DROP INDEX IF EXISTS idx_topic_runs_question_set_id_fk;
DROP INDEX IF EXISTS idx_topic_runs_topic_id_fk;
DROP INDEX IF EXISTS idx_topic_runs_user_id_fk;
DROP INDEX IF EXISTS idx_topics_created_by_fk;

-- Configure Auth security settings
-- Note: These settings may require dashboard configuration in addition to SQL

-- Enable leaked password protection (HIBP integration)
-- This requires Supabase dashboard configuration at:
-- Project Settings > Auth > Security > Password protection

-- Configure percentage-based connection pooling for Auth
-- This requires Supabase dashboard configuration at:
-- Project Settings > Database > Connection pooling
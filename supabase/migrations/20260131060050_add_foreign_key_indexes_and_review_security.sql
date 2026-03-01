/*
  # Add Foreign Key Indexes and Review Security Settings

  ## Changes Made
  
  ### 1. Add Missing Foreign Key Indexes
  Creating indexes for all foreign key columns to improve JOIN performance:
  - `idx_audit_logs_admin_id` on audit_logs(admin_id)
  - `idx_profiles_school_id` on profiles(school_id)
  - `idx_question_analytics_question_set_id` on question_analytics(question_set_id)
  - `idx_question_sets_approved_by` on question_sets(approved_by)
  - `idx_question_sets_created_by` on question_sets(created_by)
  - `idx_sponsor_banners_created_by` on sponsor_banners(created_by)
  - `idx_student_sessions_question_set_id` on student_sessions(question_set_id)
  - `idx_subscriptions_teacher_id` on subscriptions(teacher_id)
  - `idx_topic_questions_created_by` on topic_questions(created_by)
  - `idx_topic_run_answers_question_id` on topic_run_answers(question_id)
  - `idx_topic_runs_question_set_id` on topic_runs(question_set_id)
  - `idx_topic_runs_topic_id` on topic_runs(topic_id)
  - `idx_topic_runs_user_id` on topic_runs(user_id)
  - `idx_topics_created_by` on topics(created_by)

  ### 2. Anonymous Access Review
  The application intentionally allows anonymous students to:
  - Read active topics (public quiz content)
  - Create and manage quiz runs via session_id (no account needed)
  - Submit and view their own answers
  
  This is a legitimate educational use case with proper security controls.

  ## Security Impact
  - Significantly improved query performance for foreign key JOINs
  - Reduced database load during relationship queries
  - Maintained secure anonymous access for student quiz functionality

  ## Notes
  - Auth connection pooling and leaked password protection require Supabase Dashboard configuration
  - Anonymous sign-ins are intentionally enabled for student quiz functionality
*/

-- Add indexes for all foreign key columns to improve JOIN performance

-- audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id 
ON audit_logs(admin_id);

-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_school_id 
ON profiles(school_id);

-- question_analytics
CREATE INDEX IF NOT EXISTS idx_question_analytics_question_set_id 
ON question_analytics(question_set_id);

-- question_sets
CREATE INDEX IF NOT EXISTS idx_question_sets_approved_by 
ON question_sets(approved_by);

CREATE INDEX IF NOT EXISTS idx_question_sets_created_by 
ON question_sets(created_by);

-- sponsor_banners
CREATE INDEX IF NOT EXISTS idx_sponsor_banners_created_by 
ON sponsor_banners(created_by);

-- student_sessions
CREATE INDEX IF NOT EXISTS idx_student_sessions_question_set_id 
ON student_sessions(question_set_id);

-- subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_teacher_id 
ON subscriptions(teacher_id);

-- topic_questions
CREATE INDEX IF NOT EXISTS idx_topic_questions_created_by 
ON topic_questions(created_by);

-- topic_run_answers
CREATE INDEX IF NOT EXISTS idx_topic_run_answers_question_id 
ON topic_run_answers(question_id);

-- topic_runs (has multiple foreign keys)
CREATE INDEX IF NOT EXISTS idx_topic_runs_question_set_id 
ON topic_runs(question_set_id);

CREATE INDEX IF NOT EXISTS idx_topic_runs_topic_id 
ON topic_runs(topic_id);

CREATE INDEX IF NOT EXISTS idx_topic_runs_user_id 
ON topic_runs(user_id);

-- topics
CREATE INDEX IF NOT EXISTS idx_topics_created_by 
ON topics(created_by);
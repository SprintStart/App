/*
  # Add Missing Foreign Key Indexes

  ## Overview
  This migration addresses critical performance issues by adding indexes for all 
  unindexed foreign keys across the database schema.

  ## New Indexes Added
  
  ### Performance Improvements
  - `idx_audit_logs_admin_id` - Index on audit_logs.admin_id foreign key
  - `idx_profiles_school_id` - Index on profiles.school_id foreign key
  - `idx_question_analytics_question_set_id` - Index on question_analytics.question_set_id foreign key
  - `idx_question_sets_approved_by` - Index on question_sets.approved_by foreign key
  - `idx_question_sets_created_by` - Index on question_sets.created_by foreign key
  - `idx_sponsor_banners_created_by` - Index on sponsor_banners.created_by foreign key
  - `idx_student_sessions_question_set_id` - Index on student_sessions.question_set_id foreign key
  - `idx_subscriptions_teacher_id` - Index on subscriptions.teacher_id foreign key
  - `idx_topic_questions_created_by` - Index on topic_questions.created_by foreign key
  - `idx_topic_run_answers_question_id` - Index on topic_run_answers.question_id foreign key
  - `idx_topic_runs_question_set_id` - Index on topic_runs.question_set_id foreign key
  - `idx_topic_runs_topic_id` - Index on topic_runs.topic_id foreign key
  - `idx_topic_runs_user_id` - Index on topic_runs.user_id foreign key
  - `idx_topics_created_by` - Index on topics.created_by foreign key

  ## Performance Impact
  These indexes will significantly improve:
  - JOIN operations between related tables
  - Foreign key constraint checking
  - Query performance for lookups using these foreign keys
  - Overall database performance under load

  ## Security Notes
  Additional security settings (leaked password protection and auth connection strategy)
  must be configured via Supabase Dashboard:
  1. Navigate to Authentication > Settings
  2. Enable "Password breach protection (HIBP)"
  3. Navigate to Database > Connection pooling
  4. Set connection strategy to "Percentage-based"
*/

-- Add index for audit_logs.admin_id
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id 
  ON public.audit_logs(admin_id);

-- Add index for profiles.school_id
CREATE INDEX IF NOT EXISTS idx_profiles_school_id 
  ON public.profiles(school_id);

-- Add index for question_analytics.question_set_id
CREATE INDEX IF NOT EXISTS idx_question_analytics_question_set_id 
  ON public.question_analytics(question_set_id);

-- Add index for question_sets.approved_by
CREATE INDEX IF NOT EXISTS idx_question_sets_approved_by 
  ON public.question_sets(approved_by);

-- Add index for question_sets.created_by
CREATE INDEX IF NOT EXISTS idx_question_sets_created_by 
  ON public.question_sets(created_by);

-- Add index for sponsor_banners.created_by
CREATE INDEX IF NOT EXISTS idx_sponsor_banners_created_by 
  ON public.sponsor_banners(created_by);

-- Add index for student_sessions.question_set_id
CREATE INDEX IF NOT EXISTS idx_student_sessions_question_set_id 
  ON public.student_sessions(question_set_id);

-- Add index for subscriptions.teacher_id
CREATE INDEX IF NOT EXISTS idx_subscriptions_teacher_id 
  ON public.subscriptions(teacher_id);

-- Add index for topic_questions.created_by
CREATE INDEX IF NOT EXISTS idx_topic_questions_created_by 
  ON public.topic_questions(created_by);

-- Add index for topic_run_answers.question_id
CREATE INDEX IF NOT EXISTS idx_topic_run_answers_question_id 
  ON public.topic_run_answers(question_id);

-- Add index for topic_runs.question_set_id
CREATE INDEX IF NOT EXISTS idx_topic_runs_question_set_id 
  ON public.topic_runs(question_set_id);

-- Add index for topic_runs.topic_id
CREATE INDEX IF NOT EXISTS idx_topic_runs_topic_id 
  ON public.topic_runs(topic_id);

-- Add index for topic_runs.user_id
CREATE INDEX IF NOT EXISTS idx_topic_runs_user_id 
  ON public.topic_runs(user_id);

-- Add index for topics.created_by
CREATE INDEX IF NOT EXISTS idx_topics_created_by 
  ON public.topics(created_by);
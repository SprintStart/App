/*
  # Fix RLS Performance and Remove Unused Indexes

  ## Changes Made

  1. **RLS Performance Optimization**
     - Fix the "Users can create own profile" policy on profiles table
     - Replace `auth.uid()` with `(select auth.uid())` to prevent re-evaluation per row
     - This significantly improves query performance at scale

  2. **Remove Unused Indexes**
     - Drop 14 unused indexes that add maintenance overhead without performance benefit:
       - idx_audit_logs_admin_id
       - idx_profiles_school_id
       - idx_question_analytics_question_set_id
       - idx_question_sets_approved_by
       - idx_question_sets_created_by
       - idx_sponsor_banners_created_by
       - idx_student_sessions_question_set_id
       - idx_subscriptions_teacher_id
       - idx_topic_questions_created_by
       - idx_topic_run_answers_question_id
       - idx_topic_runs_question_set_id
       - idx_topic_runs_topic_id
       - idx_topic_runs_user_id
       - idx_topics_created_by

  ## Security Notes
  - RLS optimization maintains same security guarantees while improving performance
  - Removing unused indexes reduces maintenance overhead and disk usage
*/

-- Fix RLS performance issue on profiles table
DROP POLICY IF EXISTS "Users can create own profile" ON profiles;

CREATE POLICY "Users can create own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id);

-- Drop unused indexes to reduce maintenance overhead
DROP INDEX IF EXISTS idx_audit_logs_admin_id;
DROP INDEX IF EXISTS idx_profiles_school_id;
DROP INDEX IF EXISTS idx_question_analytics_question_set_id;
DROP INDEX IF EXISTS idx_question_sets_approved_by;
DROP INDEX IF EXISTS idx_question_sets_created_by;
DROP INDEX IF EXISTS idx_sponsor_banners_created_by;
DROP INDEX IF EXISTS idx_student_sessions_question_set_id;
DROP INDEX IF EXISTS idx_subscriptions_teacher_id;
DROP INDEX IF EXISTS idx_topic_questions_created_by;
DROP INDEX IF EXISTS idx_topic_run_answers_question_id;
DROP INDEX IF EXISTS idx_topic_runs_question_set_id;
DROP INDEX IF EXISTS idx_topic_runs_topic_id;
DROP INDEX IF EXISTS idx_topic_runs_user_id;
DROP INDEX IF EXISTS idx_topics_created_by;

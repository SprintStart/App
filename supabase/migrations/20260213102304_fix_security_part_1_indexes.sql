/*
  # Security Fix Part 1: Foreign Key Indexes and Cleanup

  ## What This Does
  - Adds 37 missing foreign key indexes for better performance
  - Drops 12 unused indexes to reduce write overhead
*/

-- Add missing foreign key indexes
CREATE INDEX IF NOT EXISTS idx_ad_clicks_ad_id ON ad_clicks(ad_id);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_ad_id ON ad_impressions(ad_id);
CREATE INDEX IF NOT EXISTS idx_admin_allowlist_created_by ON admin_allowlist(created_by);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_rollups_subject_id_fk ON analytics_daily_rollups(subject_id);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_rollups_topic_id_fk ON analytics_daily_rollups(topic_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_admin_id ON audit_logs(actor_admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_exam_systems_country_id ON exam_systems(country_id);
CREATE INDEX IF NOT EXISTS idx_public_quiz_runs_quiz_session_id ON public_quiz_runs(quiz_session_id);
CREATE INDEX IF NOT EXISTS idx_question_sets_exam_system_id ON question_sets(exam_system_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_session_id ON quiz_attempts(quiz_session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_feedback_quiz_id ON quiz_feedback(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_play_sessions_player_id ON quiz_play_sessions(player_id);
CREATE INDEX IF NOT EXISTS idx_quiz_play_sessions_quiz_id ON quiz_play_sessions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_play_sessions_school_id_fk ON quiz_play_sessions(school_id);
CREATE INDEX IF NOT EXISTS idx_quiz_session_events_quiz_id ON quiz_session_events(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_session_events_session_id ON quiz_session_events(session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user_id ON quiz_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_school_domains_created_by ON school_domains(created_by);
CREATE INDEX IF NOT EXISTS idx_school_domains_school_id_fk ON school_domains(school_id);
CREATE INDEX IF NOT EXISTS idx_school_licenses_created_by ON school_licenses(created_by);
CREATE INDEX IF NOT EXISTS idx_school_licenses_school_id_fk ON school_licenses(school_id);
CREATE INDEX IF NOT EXISTS idx_schools_created_by ON schools(created_by);
CREATE INDEX IF NOT EXISTS idx_sponsor_banner_events_banner_id ON sponsor_banner_events(banner_id);
CREATE INDEX IF NOT EXISTS idx_sponsored_ads_created_by ON sponsored_ads(created_by);
CREATE INDEX IF NOT EXISTS idx_teacher_documents_teacher_id_fk ON teacher_documents(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_entitlements_created_by_admin_id ON teacher_entitlements(created_by_admin_id);
CREATE INDEX IF NOT EXISTS idx_teacher_premium_overrides_granted_by ON teacher_premium_overrides(granted_by_admin_id);
CREATE INDEX IF NOT EXISTS idx_teacher_premium_overrides_revoked_by ON teacher_premium_overrides(revoked_by_admin_id);
CREATE INDEX IF NOT EXISTS idx_teacher_reports_teacher_id_fk ON teacher_reports(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_school_membership_school_id_fk ON teacher_school_membership(school_id);
CREATE INDEX IF NOT EXISTS idx_topic_run_answers_question_id ON topic_run_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_topic_run_answers_run_id ON topic_run_answers(run_id);
CREATE INDEX IF NOT EXISTS idx_topic_runs_question_set_id ON topic_runs(question_set_id);
CREATE INDEX IF NOT EXISTS idx_topic_runs_topic_id_fk ON topic_runs(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_runs_user_id ON topic_runs(user_id);

-- Drop unused indexes
DROP INDEX IF EXISTS idx_attempt_answers_question_id;
DROP INDEX IF EXISTS idx_quiz_attempts_question_set_id;
DROP INDEX IF EXISTS idx_quiz_attempts_retry_of_attempt_id;
DROP INDEX IF EXISTS idx_quiz_attempts_topic_id;
DROP INDEX IF EXISTS idx_quiz_attempts_user_id;
DROP INDEX IF EXISTS idx_quiz_feedback_school_id;
DROP INDEX IF EXISTS idx_quiz_feedback_session_id;
DROP INDEX IF EXISTS idx_support_tickets_school_id;
DROP INDEX IF EXISTS idx_teacher_documents_generated_quiz_id;
DROP INDEX IF EXISTS idx_teacher_entitlements_teacher_user_id;
DROP INDEX IF EXISTS idx_teacher_quiz_drafts_published_topic_id;
DROP INDEX IF EXISTS idx_teacher_review_prompts_quiz_id;

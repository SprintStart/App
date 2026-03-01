/*
  # Fix Security Issues - Part 2: Drop Unused Indexes

  ## Purpose
  Remove unused indexes to reduce storage overhead and improve write performance.

  ## Changes
  - Drop 54 unused indexes that have never been used
  - Reduces storage footprint and write operation overhead
*/

-- Quiz play sessions unused indexes
DROP INDEX IF EXISTS idx_quiz_play_sessions_school_id;
DROP INDEX IF EXISTS idx_quiz_play_sessions_started_at;
DROP INDEX IF EXISTS idx_quiz_play_sessions_completed;
DROP INDEX IF EXISTS idx_quiz_play_sessions_player;
DROP INDEX IF EXISTS idx_quiz_play_sessions_quiz_id;

-- Quiz session events unused indexes
DROP INDEX IF EXISTS idx_quiz_session_events_session_id;
DROP INDEX IF EXISTS idx_quiz_session_events_quiz_id;
DROP INDEX IF EXISTS idx_quiz_session_events_type;
DROP INDEX IF EXISTS idx_quiz_session_events_created;

-- Quiz feedback unused indexes
DROP INDEX IF EXISTS idx_quiz_feedback_quiz_id;
DROP INDEX IF EXISTS idx_quiz_feedback_thumb;
DROP INDEX IF EXISTS idx_quiz_feedback_created;
DROP INDEX IF EXISTS idx_quiz_feedback_rating;

-- Ad related unused indexes
DROP INDEX IF EXISTS idx_ad_clicks_ad_id;
DROP INDEX IF EXISTS idx_ad_impressions_ad_id;
DROP INDEX IF EXISTS idx_sponsor_banner_events_banner_id;
DROP INDEX IF EXISTS idx_sponsored_ads_created_by;

-- Admin unused indexes
DROP INDEX IF EXISTS idx_admin_allowlist_created_by;
DROP INDEX IF EXISTS idx_audit_logs_actor_admin_id;
DROP INDEX IF EXISTS idx_audit_logs_admin_id;

-- School unused indexes
DROP INDEX IF EXISTS idx_schools_created_by;
DROP INDEX IF EXISTS idx_school_domains_created_by;
DROP INDEX IF EXISTS idx_school_domains_school_id;
DROP INDEX IF EXISTS idx_school_licenses_created_by;
DROP INDEX IF EXISTS idx_school_licenses_school_id;
DROP INDEX IF EXISTS idx_teacher_school_membership_school_id;

-- Teacher unused indexes
DROP INDEX IF EXISTS idx_teacher_documents_teacher_id;
DROP INDEX IF EXISTS idx_teacher_entitlements_created_by_admin_id;
DROP INDEX IF EXISTS idx_teacher_premium_overrides_granted_by_admin_id;
DROP INDEX IF EXISTS idx_teacher_premium_overrides_revoked_by_admin_id;
DROP INDEX IF EXISTS idx_teacher_reports_teacher_id;

-- Question and quiz unused indexes
DROP INDEX IF EXISTS idx_question_sets_exam_system_id;
DROP INDEX IF EXISTS idx_quiz_attempts_quiz_session_id;
DROP INDEX IF EXISTS idx_quiz_sessions_user_id;
DROP INDEX IF EXISTS idx_public_quiz_runs_quiz_session_id;

-- Topic runs unused indexes
DROP INDEX IF EXISTS idx_topic_runs_question_set_id;
DROP INDEX IF EXISTS idx_topic_runs_topic_id;
DROP INDEX IF EXISTS idx_topic_runs_user_id;
DROP INDEX IF EXISTS idx_topic_run_answers_question_id;
DROP INDEX IF EXISTS idx_topic_run_answers_run_id;

-- Other unused indexes
DROP INDEX IF EXISTS idx_exam_systems_country_id;
DROP INDEX IF EXISTS idx_health_checks_name_created;
DROP INDEX IF EXISTS idx_health_checks_status_created;
DROP INDEX IF EXISTS idx_health_alerts_check_name;
DROP INDEX IF EXISTS idx_health_alerts_resolved;
DROP INDEX IF EXISTS idx_quiz_feedback_stats_score;
DROP INDEX IF EXISTS idx_teacher_review_prompts_teacher;
DROP INDEX IF EXISTS idx_teacher_review_prompts_shown;

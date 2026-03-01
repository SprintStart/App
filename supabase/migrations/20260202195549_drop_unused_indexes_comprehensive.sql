/*
  # Drop Unused Indexes
  
  1. Problem
    - Many indexes exist but are not being used by any queries
    - Unused indexes consume storage and slow down write operations
  
  2. Changes
    - Drop all indexes that have not been used
    - Indexes can be recreated later if needed
  
  3. Performance Impact
    - Reduces storage usage
    - Improves INSERT/UPDATE/DELETE performance
    - No impact on SELECT queries (indexes weren't being used anyway)
*/

-- Topic runs indexes
DROP INDEX IF EXISTS idx_topic_runs_user_id;
DROP INDEX IF EXISTS idx_topic_runs_topic_id;
DROP INDEX IF EXISTS idx_topic_runs_question_set_id;

-- Topic run answers indexes
DROP INDEX IF EXISTS idx_topic_run_answers_run_id;
DROP INDEX IF EXISTS idx_topic_run_answers_question_id;

-- Public quiz runs indexes
DROP INDEX IF EXISTS idx_public_quiz_runs_quiz_session_id;
DROP INDEX IF EXISTS idx_public_quiz_runs_topic_id;
DROP INDEX IF EXISTS idx_public_quiz_runs_question_set_id;

-- Question sets indexes
DROP INDEX IF EXISTS idx_question_sets_created_by;

-- Topic questions indexes
DROP INDEX IF EXISTS idx_topic_questions_question_set_id;

-- Quiz sessions indexes
DROP INDEX IF EXISTS idx_quiz_sessions_user_id;

-- Teacher school membership indexes
DROP INDEX IF EXISTS idx_teacher_school_membership_teacher_id;
DROP INDEX IF EXISTS idx_teacher_school_membership_school_id;

-- School related indexes
DROP INDEX IF EXISTS idx_school_domains_school_id;
DROP INDEX IF EXISTS idx_school_licenses_school_id;

-- Profiles indexes
DROP INDEX IF EXISTS idx_profiles_school_id;

-- Audit logs indexes
DROP INDEX IF EXISTS idx_audit_logs_admin_id;
DROP INDEX IF EXISTS idx_audit_logs_actor_admin_id;

-- Ad related indexes
DROP INDEX IF EXISTS idx_ad_clicks_ad_id;
DROP INDEX IF EXISTS idx_ad_impressions_ad_id;
DROP INDEX IF EXISTS idx_sponsor_banner_events_banner_id;

-- Sponsored ads indexes
DROP INDEX IF EXISTS idx_sponsored_ads_created_by;

-- Stripe indexes
DROP INDEX IF EXISTS idx_stripe_customers_user_id;

-- Admin allowlist indexes
DROP INDEX IF EXISTS idx_admin_allowlist_created_by;

-- School domain and license indexes
DROP INDEX IF EXISTS idx_school_domains_created_by;
DROP INDEX IF EXISTS idx_school_licenses_created_by;

-- Schools indexes
DROP INDEX IF EXISTS idx_schools_created_by;

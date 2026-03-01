/*
  # Add Remaining Foreign Key Indexes

  ## Changes

  ### Foreign Key Indexes Added
  
  1. audit_logs table (2 indexes):
     - actor_admin_id → idx_audit_logs_actor_admin_id
     - admin_id → idx_audit_logs_admin_id

  2. question_sets table (1 index):
     - topic_id → idx_question_sets_topic_id

  3. sponsor_banner_events table (1 index):
     - banner_id → idx_sponsor_banner_events_banner_id

  4. topic_run_answers table (2 indexes):
     - question_id → idx_topic_run_answers_question_id
     - run_id → idx_topic_run_answers_run_id

  5. topic_runs table (3 indexes):
     - question_set_id → idx_topic_runs_question_set_id
     - topic_id → idx_topic_runs_topic_id
     - user_id → idx_topic_runs_user_id

  ## Performance Impact

  - Faster JOIN operations on foreign key columns
  - Improved CASCADE DELETE/UPDATE performance
  - Better query planning for filtered queries
  - Essential for production-scale query performance

  ## Note on "Unused" Indexes

  Previously created indexes (idx_*_created_by) show as "unused" because they were
  just created. These will be used as queries access those columns. They are NOT
  dropped in this migration as they are essential for creator-based queries.
*/

-- =====================================================
-- AUDIT LOGS FOREIGN KEY INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_admin_id 
  ON audit_logs(actor_admin_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id 
  ON audit_logs(admin_id);

-- =====================================================
-- QUESTION SETS FOREIGN KEY INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_question_sets_topic_id 
  ON question_sets(topic_id);

-- =====================================================
-- SPONSOR BANNER EVENTS FOREIGN KEY INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_sponsor_banner_events_banner_id 
  ON sponsor_banner_events(banner_id);

-- =====================================================
-- TOPIC RUN ANSWERS FOREIGN KEY INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_topic_run_answers_question_id 
  ON topic_run_answers(question_id);

CREATE INDEX IF NOT EXISTS idx_topic_run_answers_run_id 
  ON topic_run_answers(run_id);

-- =====================================================
-- TOPIC RUNS FOREIGN KEY INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_topic_runs_question_set_id 
  ON topic_runs(question_set_id);

CREATE INDEX IF NOT EXISTS idx_topic_runs_topic_id 
  ON topic_runs(topic_id);

CREATE INDEX IF NOT EXISTS idx_topic_runs_user_id 
  ON topic_runs(user_id);

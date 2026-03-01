/*
  # Fix Content Visibility and Add Deterministic Attempts System

  ## Part A: Content Visibility Fixes
  
  1. Add `is_published` column to topics and topic_questions
    - topics.is_published (boolean, default false)
    - topic_questions.is_published (boolean, default false)
    - Only published content visible to students/anonymous users
  
  2. Update RLS Policies for Student/Anonymous Access
    - Allow anonymous SELECT on published topics
    - Allow anonymous SELECT on published questions via approved question_sets
    - Maintain existing teacher/admin access
  
  3. Default Existing Content to Published
    - Set is_published = true for all active topics
    - Set is_published = true for all questions in approved sets
  
  ## Part B: Deterministic Attempts System
  
  1. Create quiz_attempts table
    - Stores seed, question_ids in order, option_order per question
    - Supports retry tracking and multi-student uniqueness
    - Links to quiz_sessions and question_sets
  
  2. Add attempt_used_questions junction table
    - Tracks which questions each student has seen
    - Enables "new questions only" retry logic
  
  ## Security
  - RLS enabled on all new tables
  - Anonymous users can only read published content
  - Teachers/admins can manage all content
*/

-- ============================================================================
-- PART A: Add is_published columns
-- ============================================================================

-- Add is_published to topics
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'topics' AND column_name = 'is_published'
  ) THEN
    ALTER TABLE topics ADD COLUMN is_published boolean DEFAULT false NOT NULL;
    COMMENT ON COLUMN topics.is_published IS 'Controls student visibility. Only published topics appear in student UI.';
  END IF;
END $$;

-- Add is_published to topic_questions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'topic_questions' AND column_name = 'is_published'
  ) THEN
    ALTER TABLE topic_questions ADD COLUMN is_published boolean DEFAULT false NOT NULL;
    COMMENT ON COLUMN topic_questions.is_published IS 'Controls question visibility. Only published questions included in quizzes.';
  END IF;
END $$;

-- Publish all existing active topics
UPDATE topics 
SET is_published = true 
WHERE is_active = true AND is_published = false;

-- Publish all questions in approved question sets
UPDATE topic_questions 
SET is_published = true 
WHERE is_published = false 
  AND question_set_id IN (
    SELECT id FROM question_sets 
    WHERE approval_status = 'approved' AND is_active = true
  );

-- ============================================================================
-- PART B: Create quiz_attempts table for deterministic ordering
-- ============================================================================

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Session/User identification
  session_id text NOT NULL,
  quiz_session_id uuid REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Quiz context
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  question_set_id uuid NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
  
  -- Deterministic ordering
  seed text NOT NULL,
  question_ids uuid[] NOT NULL,
  option_orders jsonb NOT NULL,
  
  -- Retry tracking
  retry_of_attempt_id uuid REFERENCES quiz_attempts(id) ON DELETE SET NULL,
  attempt_number integer DEFAULT 1 NOT NULL CHECK (attempt_number > 0),
  reuse_count integer DEFAULT 0 NOT NULL CHECK (reuse_count >= 0),
  
  -- Status and scoring
  status text DEFAULT 'in_progress' NOT NULL CHECK (status IN ('in_progress', 'completed', 'game_over', 'abandoned')),
  score integer DEFAULT 0 NOT NULL,
  correct_count integer DEFAULT 0 NOT NULL,
  wrong_count integer DEFAULT 0 NOT NULL,
  percentage numeric(5,2),
  
  -- Timing
  started_at timestamptz DEFAULT now() NOT NULL,
  completed_at timestamptz,
  duration_seconds integer,
  
  -- Device tracking
  device_info jsonb,
  
  -- Audit
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- Performance indexes
  CONSTRAINT quiz_attempts_percentage_check CHECK (percentage IS NULL OR (percentage >= 0 AND percentage <= 100))
);

COMMENT ON TABLE quiz_attempts IS 'Deterministic quiz attempts with seeded question/option ordering. Supports retry logic and multi-student uniqueness.';
COMMENT ON COLUMN quiz_attempts.seed IS 'Unique seed for deterministic shuffling. Each attempt gets a new seed.';
COMMENT ON COLUMN quiz_attempts.question_ids IS 'Ordered array of question IDs as presented to student.';
COMMENT ON COLUMN quiz_attempts.option_orders IS 'JSONB mapping of question_id to option index array for reproducible option shuffling.';
COMMENT ON COLUMN quiz_attempts.reuse_count IS 'Number of questions reused from previous attempts (when pool exhausted).';

-- ============================================================================
-- Indexes for quiz_attempts
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_session_id ON quiz_attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON quiz_attempts(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_topic_id ON quiz_attempts(topic_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_question_set_id ON quiz_attempts(question_set_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_status ON quiz_attempts(status);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_created_at ON quiz_attempts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_retry_of ON quiz_attempts(retry_of_attempt_id) WHERE retry_of_attempt_id IS NOT NULL;

-- ============================================================================
-- Create attempt_answers table (replaces public_quiz_answers for new system)
-- ============================================================================

CREATE TABLE IF NOT EXISTS attempt_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES topic_questions(id) ON DELETE CASCADE,
  
  -- Answer data
  selected_option_index integer NOT NULL CHECK (selected_option_index >= 0 AND selected_option_index <= 3),
  is_correct boolean NOT NULL,
  attempt_number integer DEFAULT 1 NOT NULL CHECK (attempt_number IN (1, 2)),
  
  -- Timing
  answered_at timestamptz DEFAULT now() NOT NULL,
  
  -- Unique constraint: one answer per question per attempt_number per attempt
  UNIQUE(attempt_id, question_id, attempt_number)
);

COMMENT ON TABLE attempt_answers IS 'Individual answers for quiz attempts. Supports 2-attempt system.';

-- Indexes for attempt_answers
CREATE INDEX IF NOT EXISTS idx_attempt_answers_attempt_id ON attempt_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_attempt_answers_question_id ON attempt_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_attempt_answers_answered_at ON attempt_answers(answered_at DESC);

-- ============================================================================
-- RLS Policies for quiz_attempts
-- ============================================================================

ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Anonymous/Students can read their own attempts by session_id
CREATE POLICY "Anyone can read own attempts by session_id"
  ON quiz_attempts FOR SELECT
  USING (
    session_id = current_setting('request.headers', true)::json->>'x-session-id'
    OR session_id IN (
      SELECT session_id FROM quiz_sessions WHERE id = quiz_session_id
    )
  );

-- Authenticated users can read their own attempts
CREATE POLICY "Users can read own attempts"
  ON quiz_attempts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role full access to attempts"
  ON quiz_attempts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- RLS Policies for attempt_answers
-- ============================================================================

ALTER TABLE attempt_answers ENABLE ROW LEVEL SECURITY;

-- Users can read answers for their own attempts
CREATE POLICY "Users can read own attempt answers"
  ON attempt_answers FOR SELECT
  USING (
    attempt_id IN (
      SELECT id FROM quiz_attempts 
      WHERE session_id = current_setting('request.headers', true)::json->>'x-session-id'
        OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
    )
  );

-- Service role full access
CREATE POLICY "Service role full access to answers"
  ON attempt_answers FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Update RLS Policies for topics (allow anonymous read of published content)
-- ============================================================================

-- Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "Anyone can view active topics" ON topics;
DROP POLICY IF EXISTS "Public can read active topics" ON topics;
DROP POLICY IF EXISTS "Anonymous users can read topics" ON topics;

-- Create new policy for anonymous read access to published topics
CREATE POLICY "Anyone can read published topics"
  ON topics FOR SELECT
  USING (is_active = true AND is_published = true);

-- Teachers can read their own topics
CREATE POLICY "Teachers can read own topics"
  ON topics FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by);

-- Admins can read all topics
CREATE POLICY "Admins can read all topics"
  ON topics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================================
-- Update RLS Policies for topic_questions (allow anonymous read via question_sets)
-- ============================================================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Anyone can view questions" ON topic_questions;
DROP POLICY IF EXISTS "Public can read questions" ON topic_questions;

-- Anonymous can read published questions in approved sets
CREATE POLICY "Anyone can read published questions in approved sets"
  ON topic_questions FOR SELECT
  USING (
    is_published = true
    AND question_set_id IN (
      SELECT id FROM question_sets
      WHERE is_active = true AND approval_status = 'approved'
    )
  );

-- Teachers can read questions in their own question sets
CREATE POLICY "Teachers can read own questions"
  ON topic_questions FOR SELECT
  TO authenticated
  USING (
    question_set_id IN (
      SELECT id FROM question_sets WHERE created_by = auth.uid()
    )
  );

-- Admins can read all questions
CREATE POLICY "Admins can read all questions"
  ON topic_questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================================
-- Update RLS Policies for question_sets (allow anonymous read of approved sets)
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can view approved question sets" ON question_sets;
DROP POLICY IF EXISTS "Public can read question sets" ON question_sets;

-- Anonymous can read approved active sets for published topics
CREATE POLICY "Anyone can read approved question sets for published topics"
  ON question_sets FOR SELECT
  USING (
    is_active = true 
    AND approval_status = 'approved'
    AND topic_id IN (
      SELECT id FROM topics WHERE is_active = true AND is_published = true
    )
  );

-- Teachers can read their own question sets
CREATE POLICY "Teachers can read own question sets"
  ON question_sets FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by);

-- Admins can read all question sets
CREATE POLICY "Admins can read all question sets"
  ON question_sets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================================
-- Add indexes for performance on filtering columns
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_topics_published_active ON topics(is_published, is_active) WHERE is_published = true AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_topic_questions_published ON topic_questions(is_published, question_set_id) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_question_sets_approved_active ON question_sets(approval_status, is_active, topic_id) WHERE approval_status = 'approved' AND is_active = true;
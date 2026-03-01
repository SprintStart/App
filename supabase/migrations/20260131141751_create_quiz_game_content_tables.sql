/*
  # Create Quiz Game Content Tables

  ## Overview
  Creates the complete database schema for the quiz game content system including topics, question sets, questions, runs, and analytics.

  ## New Tables

  ### 1. topics
  Stores quiz topics organized by subject (Mathematics, Science, etc.)
  - `id` (uuid, primary key)
  - `name` (text) - Topic name (e.g., "Algebra Basics")
  - `slug` (text, unique) - URL-friendly identifier
  - `subject` (text) - Subject category (mathematics, science, etc.)
  - `description` (text, nullable) - Topic description
  - `cover_image_url` (text, nullable) - Cover image
  - `is_active` (boolean) - Visibility flag
  - `created_by` (uuid, nullable) - Creator user ID
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. question_sets
  Stores quiz collections under topics
  - `id` (uuid, primary key)
  - `topic_id` (uuid, foreign key to topics)
  - `title` (text) - Quiz title
  - `difficulty` (text, nullable) - easy/medium/hard
  - `is_active` (boolean) - Visibility flag
  - `approval_status` (text) - draft/pending/approved/rejected
  - `question_count` (integer) - Number of questions
  - `shuffle_questions` (boolean) - Whether to shuffle questions
  - `created_by` (uuid, nullable) - Creator user ID
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. topic_questions
  Stores individual questions in question sets
  - `id` (uuid, primary key)
  - `question_set_id` (uuid, foreign key to question_sets)
  - `question_text` (text) - The question
  - `options` (text[]) - Array of answer options
  - `correct_index` (integer) - Index of correct answer (0-3)
  - `explanation` (text, nullable) - Explanation for the answer
  - `order_index` (integer) - Question order
  - `created_by` (uuid, nullable) - Creator user ID
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 4. topic_runs
  Stores student game sessions
  - `id` (uuid, primary key)
  - `user_id` (uuid, nullable) - User ID (nullable for anonymous)
  - `session_id` (text, nullable) - Anonymous session ID
  - `topic_id` (uuid, foreign key to topics)
  - `question_set_id` (uuid, foreign key to question_sets)
  - `status` (text) - in_progress/completed/game_over
  - `score_total` (integer) - Total points
  - `correct_count` (integer) - Number correct
  - `wrong_count` (integer) - Number wrong
  - `started_at` (timestamptz)
  - `completed_at` (timestamptz, nullable)
  - `duration_seconds` (integer, nullable)

  ### 5. topic_run_answers
  Stores student answers during runs
  - `id` (uuid, primary key)
  - `run_id` (uuid, foreign key to topic_runs)
  - `question_id` (uuid, foreign key to topic_questions)
  - `attempt_number` (integer) - 1 or 2
  - `selected_index` (integer) - Answer selected
  - `is_correct` (boolean) - Whether correct
  - `answered_at` (timestamptz)

  ## Security
  - RLS enabled on all tables
  - Public read access for active/approved content
  - Teachers can create/manage own content
  - Admins have full access
  - Anonymous users can create runs/answers

  ## Indexes
  - Foreign key indexes for performance
  - Subject/active indexes for filtering
  - Session/user indexes for analytics
*/

-- ============================================================================
-- 1. CREATE TOPICS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  subject text NOT NULL,
  description text,
  cover_image_url text,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_subject CHECK (subject IN (
    'mathematics', 'science', 'english', 'computing',
    'business', 'geography', 'history', 'languages',
    'art', 'engineering', 'health', 'other'
  ))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_topics_subject ON topics(subject);
CREATE INDEX IF NOT EXISTS idx_topics_is_active ON topics(is_active);
CREATE INDEX IF NOT EXISTS idx_topics_created_by ON topics(created_by);
CREATE INDEX IF NOT EXISTS idx_topics_subject_active ON topics(subject, is_active);

-- RLS
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active topics"
  ON topics FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Teachers can create topics"
  ON topics FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

CREATE POLICY "Teachers can update own topics"
  ON topics FOR UPDATE
  TO authenticated
  USING (created_by = (select auth.uid()))
  WITH CHECK (created_by = (select auth.uid()));

CREATE POLICY "Admins can manage all topics"
  ON topics FOR ALL
  TO authenticated
  USING (((select auth.jwt())->>'role')::text = 'admin')
  WITH CHECK (((select auth.jwt())->>'role')::text = 'admin');

-- Trigger
CREATE TRIGGER update_topics_updated_at
  BEFORE UPDATE ON topics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 2. CREATE QUESTION_SETS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS question_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  title text NOT NULL,
  difficulty text,
  is_active boolean DEFAULT true,
  approval_status text DEFAULT 'approved',
  question_count integer DEFAULT 0,
  shuffle_questions boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_difficulty CHECK (difficulty IN ('easy', 'medium', 'hard')),
  CONSTRAINT valid_approval_status CHECK (approval_status IN ('draft', 'pending', 'approved', 'rejected'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_question_sets_topic_id ON question_sets(topic_id);
CREATE INDEX IF NOT EXISTS idx_question_sets_is_active ON question_sets(is_active);
CREATE INDEX IF NOT EXISTS idx_question_sets_approval_status ON question_sets(approval_status);
CREATE INDEX IF NOT EXISTS idx_question_sets_created_by ON question_sets(created_by);
CREATE INDEX IF NOT EXISTS idx_question_sets_topic_active_approved 
  ON question_sets(topic_id, is_active, approval_status);

-- RLS
ALTER TABLE question_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active approved question sets"
  ON question_sets FOR SELECT
  TO public
  USING (is_active = true AND approval_status = 'approved');

CREATE POLICY "Teachers can create question sets"
  ON question_sets FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

CREATE POLICY "Teachers can view own question sets"
  ON question_sets FOR SELECT
  TO authenticated
  USING (created_by = (select auth.uid()));

CREATE POLICY "Teachers can update own question sets"
  ON question_sets FOR UPDATE
  TO authenticated
  USING (created_by = (select auth.uid()))
  WITH CHECK (created_by = (select auth.uid()));

CREATE POLICY "Admins can manage all question sets"
  ON question_sets FOR ALL
  TO authenticated
  USING (((select auth.jwt())->>'role')::text = 'admin')
  WITH CHECK (((select auth.jwt())->>'role')::text = 'admin');

-- Trigger
CREATE TRIGGER update_question_sets_updated_at
  BEFORE UPDATE ON question_sets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 3. CREATE TOPIC_QUESTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS topic_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_set_id uuid NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  options text[] NOT NULL,
  correct_index integer NOT NULL,
  explanation text,
  order_index integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_correct_index CHECK (correct_index >= 0 AND correct_index <= 3),
  CONSTRAINT valid_options_count CHECK (array_length(options, 1) >= 2 AND array_length(options, 1) <= 4)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_topic_questions_question_set_id ON topic_questions(question_set_id);
CREATE INDEX IF NOT EXISTS idx_topic_questions_created_by ON topic_questions(created_by);
CREATE INDEX IF NOT EXISTS idx_topic_questions_set_order 
  ON topic_questions(question_set_id, order_index);

-- RLS
ALTER TABLE topic_questions ENABLE ROW LEVEL SECURITY;

-- Public can view questions for approved question sets
CREATE POLICY "Public can view questions for approved sets"
  ON topic_questions FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM question_sets
      WHERE question_sets.id = topic_questions.question_set_id
      AND question_sets.is_active = true
      AND question_sets.approval_status = 'approved'
    )
  );

CREATE POLICY "Teachers can create questions"
  ON topic_questions FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

CREATE POLICY "Teachers can view own questions"
  ON topic_questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM question_sets
      WHERE question_sets.id = topic_questions.question_set_id
      AND question_sets.created_by = (select auth.uid())
    )
  );

CREATE POLICY "Teachers can update own questions"
  ON topic_questions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM question_sets
      WHERE question_sets.id = topic_questions.question_set_id
      AND question_sets.created_by = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM question_sets
      WHERE question_sets.id = topic_questions.question_set_id
      AND question_sets.created_by = (select auth.uid())
    )
  );

CREATE POLICY "Teachers can delete own questions"
  ON topic_questions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM question_sets
      WHERE question_sets.id = topic_questions.question_set_id
      AND question_sets.created_by = (select auth.uid())
    )
  );

CREATE POLICY "Admins can manage all questions"
  ON topic_questions FOR ALL
  TO authenticated
  USING (((select auth.jwt())->>'role')::text = 'admin')
  WITH CHECK (((select auth.jwt())->>'role')::text = 'admin');

-- Trigger
CREATE TRIGGER update_topic_questions_updated_at
  BEFORE UPDATE ON topic_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. CREATE TOPIC_RUNS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS topic_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  question_set_id uuid NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
  status text DEFAULT 'in_progress',
  score_total integer DEFAULT 0,
  correct_count integer DEFAULT 0,
  wrong_count integer DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  duration_seconds integer,
  
  CONSTRAINT valid_status CHECK (status IN ('in_progress', 'completed', 'game_over')),
  CONSTRAINT user_or_session CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_topic_runs_user_id ON topic_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_topic_runs_session_id ON topic_runs(session_id);
CREATE INDEX IF NOT EXISTS idx_topic_runs_topic_id ON topic_runs(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_runs_question_set_id ON topic_runs(question_set_id);
CREATE INDEX IF NOT EXISTS idx_topic_runs_status ON topic_runs(status);
CREATE INDEX IF NOT EXISTS idx_topic_runs_started_at ON topic_runs(started_at);

-- RLS
ALTER TABLE topic_runs ENABLE ROW LEVEL SECURITY;

-- Users can view own runs
CREATE POLICY "Users can view own runs"
  ON topic_runs FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Anonymous can view runs by session
CREATE POLICY "Anonymous can view own session runs"
  ON topic_runs FOR SELECT
  TO anon
  USING (true);

-- Anyone can create runs (authenticated or anonymous)
CREATE POLICY "Anyone can create runs"
  ON topic_runs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Users can update own runs
CREATE POLICY "Users can update own runs"
  ON topic_runs FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- Anonymous can update own session runs
CREATE POLICY "Anonymous can update own session runs"
  ON topic_runs FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Admins can view all runs for analytics
CREATE POLICY "Admins can view all runs"
  ON topic_runs FOR SELECT
  TO authenticated
  USING (((select auth.jwt())->>'role')::text = 'admin');

-- Teachers can view runs for their content
CREATE POLICY "Teachers can view runs for own content"
  ON topic_runs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM question_sets
      WHERE question_sets.id = topic_runs.question_set_id
      AND question_sets.created_by = (select auth.uid())
    )
  );

-- ============================================================================
-- 5. CREATE TOPIC_RUN_ANSWERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS topic_run_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES topic_runs(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES topic_questions(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL,
  selected_index integer NOT NULL,
  is_correct boolean NOT NULL,
  answered_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_attempt_number CHECK (attempt_number IN (1, 2)),
  CONSTRAINT valid_selected_index CHECK (selected_index >= 0 AND selected_index <= 3)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_topic_run_answers_run_id ON topic_run_answers(run_id);
CREATE INDEX IF NOT EXISTS idx_topic_run_answers_question_id ON topic_run_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_topic_run_answers_run_question 
  ON topic_run_answers(run_id, question_id);

-- RLS
ALTER TABLE topic_run_answers ENABLE ROW LEVEL SECURITY;

-- Users can view answers for own runs
CREATE POLICY "Users can view answers for own runs"
  ON topic_run_answers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM topic_runs
      WHERE topic_runs.id = topic_run_answers.run_id
      AND topic_runs.user_id = (select auth.uid())
    )
  );

-- Anonymous can view answers for own session runs
CREATE POLICY "Anonymous can view answers for own session runs"
  ON topic_run_answers FOR SELECT
  TO anon
  USING (true);

-- Anyone can create answers
CREATE POLICY "Anyone can create answers"
  ON topic_run_answers FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Admins can view all answers for analytics
CREATE POLICY "Admins can view all answers"
  ON topic_run_answers FOR SELECT
  TO authenticated
  USING (((select auth.jwt())->>'role')::text = 'admin');

-- Teachers can view answers for runs on their content
CREATE POLICY "Teachers can view answers for own content"
  ON topic_run_answers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM topic_runs
      JOIN question_sets ON question_sets.id = topic_runs.question_set_id
      WHERE topic_runs.id = topic_run_answers.run_id
      AND question_sets.created_by = (select auth.uid())
    )
  );

-- ============================================================================
-- 6. ADD is_test_account FIELD TO PROFILES
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_test_account'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_test_account boolean DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_is_test_account ON profiles(is_test_account);

-- ============================================================================
-- 7. UPDATE QUESTION_COUNT FUNCTION
-- ============================================================================

-- Function to automatically update question_count on question_sets
CREATE OR REPLACE FUNCTION update_question_set_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE question_sets
    SET question_count = (
      SELECT COUNT(*)
      FROM topic_questions
      WHERE question_set_id = OLD.question_set_id
    )
    WHERE id = OLD.question_set_id;
    RETURN OLD;
  ELSE
    UPDATE question_sets
    SET question_count = (
      SELECT COUNT(*)
      FROM topic_questions
      WHERE question_set_id = NEW.question_set_id
    )
    WHERE id = NEW.question_set_id;
    RETURN NEW;
  END IF;
END;
$$;

-- Trigger to update question count
DROP TRIGGER IF EXISTS update_question_count_trigger ON topic_questions;
CREATE TRIGGER update_question_count_trigger
  AFTER INSERT OR DELETE ON topic_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_question_set_count();

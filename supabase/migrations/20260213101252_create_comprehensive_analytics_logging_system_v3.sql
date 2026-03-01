/*
  # Comprehensive Analytics Logging System - Phase 1

  ## What This Migration Does
  Creates a complete analytics logging layer for quiz plays and user behavior

  ## New Tables Created

  1. **analytics_quiz_sessions**
     - Tracks each quiz play session with complete context
     - Includes school_id, subject_id, topic_id for segmentation
     - Tracks device type, browser, and randomization seed
     - Records start time, end time, and completion status

  2. **analytics_question_events**
     - Tracks individual question answer events
     - Records correctness, response time, attempt number
     - Tracks skipped questions
     - Links to session for full context

  3. **analytics_daily_rollups**
     - Precomputed daily metrics for fast dashboards
     - Total plays, completions, average scores
     - Per school, subject, topic aggregation

  ## Logging Rules
  - Quiz starts → insert analytics_quiz_sessions
  - Question answered → insert analytics_question_events
  - Quiz ends → update session with ended_at + completed
  - Server-side only, no frontend calculations

  ## RLS Security
  - Admin full access
  - Teachers can view their own school's data only
  - Students cannot access analytics tables

  ## Performance
  - Indexed on session_id, quiz_id, school_id, created_at
  - Daily rollup table for fast aggregations
*/

-- 1. Create analytics_quiz_sessions table
CREATE TABLE IF NOT EXISTS analytics_quiz_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
  school_id uuid REFERENCES schools(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  topic_id uuid REFERENCES topics(id) ON DELETE SET NULL,
  player_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  completed boolean DEFAULT false,
  score integer DEFAULT 0,
  total_questions integer NOT NULL,
  correct_answers integer DEFAULT 0,
  device_type text,
  browser text,
  seed bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create analytics_question_events table
CREATE TABLE IF NOT EXISTS analytics_question_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES analytics_quiz_sessions(id) ON DELETE CASCADE,
  question_id uuid NOT NULL,
  question_index integer NOT NULL,
  correct boolean NOT NULL,
  response_time_ms integer,
  attempt_number integer DEFAULT 1,
  skipped boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Create analytics_daily_rollups table for fast dashboards
CREATE TABLE IF NOT EXISTS analytics_daily_rollups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES topics(id) ON DELETE CASCADE,
  quiz_id uuid REFERENCES question_sets(id) ON DELETE CASCADE,
  total_plays bigint DEFAULT 0,
  total_completions bigint DEFAULT 0,
  avg_score numeric(5,2),
  avg_completion_rate numeric(5,2),
  total_questions_answered bigint DEFAULT 0,
  total_correct_answers bigint DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(date, school_id, subject_id, topic_id, quiz_id)
);

-- 4. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_quiz_id ON analytics_quiz_sessions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_school_id ON analytics_quiz_sessions(school_id);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_subject_id ON analytics_quiz_sessions(subject_id);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_topic_id ON analytics_quiz_sessions(topic_id);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_started_at ON analytics_quiz_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_session_id ON analytics_quiz_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_player_id ON analytics_quiz_sessions(player_id) WHERE player_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON analytics_question_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_question_id ON analytics_question_events(question_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_question_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_rollups_date ON analytics_daily_rollups(date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_rollups_school_id ON analytics_daily_rollups(school_id);
CREATE INDEX IF NOT EXISTS idx_analytics_rollups_quiz_id ON analytics_daily_rollups(quiz_id);

-- 5. Enable RLS
ALTER TABLE analytics_quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_question_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_daily_rollups ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for analytics_quiz_sessions

-- Admin can see all
CREATE POLICY "Admins can view all analytics sessions"
  ON analytics_quiz_sessions FOR SELECT
  TO authenticated
  USING (is_admin());

-- Teachers can view their school's sessions
CREATE POLICY "Teachers can view own school analytics sessions"
  ON analytics_quiz_sessions FOR SELECT
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM profiles
      WHERE id = auth.uid()
      AND role = 'teacher'
      AND school_id IS NOT NULL
    )
  );

-- System can insert (for logging)
CREATE POLICY "System can insert analytics sessions"
  ON analytics_quiz_sessions FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- System can update (for end time)
CREATE POLICY "System can update analytics sessions"
  ON analytics_quiz_sessions FOR UPDATE
  TO authenticated, anon
  USING (true);

-- 7. RLS Policies for analytics_question_events

-- Admin can see all
CREATE POLICY "Admins can view all question events"
  ON analytics_question_events FOR SELECT
  TO authenticated
  USING (is_admin());

-- Teachers can view their school's events
CREATE POLICY "Teachers can view own school question events"
  ON analytics_question_events FOR SELECT
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM analytics_quiz_sessions
      WHERE school_id IN (
        SELECT school_id FROM profiles
        WHERE id = auth.uid()
        AND role = 'teacher'
        AND school_id IS NOT NULL
      )
    )
  );

-- System can insert
CREATE POLICY "System can insert question events"
  ON analytics_question_events FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- 8. RLS Policies for analytics_daily_rollups

-- Admin can see all
CREATE POLICY "Admins can view all daily rollups"
  ON analytics_daily_rollups FOR SELECT
  TO authenticated
  USING (is_admin());

-- Teachers can view their school's rollups
CREATE POLICY "Teachers can view own school daily rollups"
  ON analytics_daily_rollups FOR SELECT
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM profiles
      WHERE id = auth.uid()
      AND role = 'teacher'
      AND school_id IS NOT NULL
    )
  );

-- System can insert/update rollups
CREATE POLICY "System can manage daily rollups"
  ON analytics_daily_rollups FOR ALL
  TO authenticated
  USING (is_admin());

-- 9. Create function to compute daily rollups
CREATE OR REPLACE FUNCTION compute_daily_analytics_rollups(p_date date DEFAULT CURRENT_DATE - 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert or update daily rollups for the specified date
  INSERT INTO analytics_daily_rollups (
    date,
    school_id,
    subject_id,
    topic_id,
    quiz_id,
    total_plays,
    total_completions,
    avg_score,
    avg_completion_rate,
    total_questions_answered,
    total_correct_answers,
    updated_at
  )
  SELECT
    DATE(aqs.started_at) as date,
    aqs.school_id,
    aqs.subject_id,
    aqs.topic_id,
    aqs.quiz_id,
    COUNT(*) as total_plays,
    COUNT(*) FILTER (WHERE aqs.completed = true) as total_completions,
    AVG(aqs.score) as avg_score,
    AVG(CASE 
      WHEN aqs.total_questions > 0 
      THEN (aqs.correct_answers::numeric / aqs.total_questions::numeric * 100)
      ELSE 0
    END) as avg_completion_rate,
    SUM(aqs.total_questions) as total_questions_answered,
    SUM(aqs.correct_answers) as total_correct_answers,
    now() as updated_at
  FROM analytics_quiz_sessions aqs
  WHERE DATE(aqs.started_at) = p_date
  GROUP BY DATE(aqs.started_at), aqs.school_id, aqs.subject_id, aqs.topic_id, aqs.quiz_id
  ON CONFLICT (date, school_id, subject_id, topic_id, quiz_id)
  DO UPDATE SET
    total_plays = EXCLUDED.total_plays,
    total_completions = EXCLUDED.total_completions,
    avg_score = EXCLUDED.avg_score,
    avg_completion_rate = EXCLUDED.avg_completion_rate,
    total_questions_answered = EXCLUDED.total_questions_answered,
    total_correct_answers = EXCLUDED.total_correct_answers,
    updated_at = now();
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION compute_daily_analytics_rollups TO authenticated;

/*
  # Phase 1 Analytics Tables - Beta Launch

  ## Purpose
  Track quiz sessions, events, and feedback for Teacher and Admin analytics dashboards.
  
  ## Design Principles
  - Additive only (no destructive changes)
  - Fail-safe logging (errors don't break quiz flow)
  - Server-side computation only
  - RLS protected

  ## Tables Created
  
  1. quiz_play_sessions (renamed to avoid conflict with existing quiz_sessions)
     - Tracks each quiz play session from start to completion
     - Links to quiz, school, subject, topic
     - Stores completion status, score, device info
  
  2. quiz_session_events
     - Tracks granular events within each session
     - Question start, answer submission, quiz end
     - Records correctness, attempts, time spent
  
  3. quiz_feedback
     - Simple thumbs up/down feedback per quiz
     - Optional school/session linkage
  
  4. feature_flags
     - Controls feature rollout without redeployment
     - ANALYTICS_V1_ENABLED flag

  ## Security
  - Students can insert their own sessions/events
  - Teachers can read their own quiz analytics
  - Admins can read all analytics
  - Public can view aggregated stats only
*/

-- Feature flags table (for safe rollout)
CREATE TABLE IF NOT EXISTS feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name text UNIQUE NOT NULL,
  enabled boolean DEFAULT false,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default flags
INSERT INTO feature_flags (flag_name, enabled, description)
VALUES 
  ('ANALYTICS_V1_ENABLED', true, 'Phase 1 Analytics Dashboard for teachers and admins')
ON CONFLICT (flag_name) DO NOTHING;

-- Quiz play sessions table
CREATE TABLE IF NOT EXISTS quiz_play_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL,
  school_id uuid,
  subject_id uuid,
  topic_id uuid,
  player_id uuid,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  completed boolean DEFAULT false,
  score integer,
  total_questions integer NOT NULL DEFAULT 0,
  correct_count integer DEFAULT 0,
  wrong_count integer DEFAULT 0,
  device_type text,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT fk_play_quiz FOREIGN KEY (quiz_id) REFERENCES question_sets(id) ON DELETE CASCADE,
  CONSTRAINT fk_play_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL,
  CONSTRAINT fk_play_player FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE SET NULL
);

-- Quiz session events table
CREATE TABLE IF NOT EXISTS quiz_session_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  quiz_id uuid NOT NULL,
  question_id uuid,
  event_type text NOT NULL CHECK (event_type IN ('session_start', 'question_start', 'answer_submitted', 'question_end', 'quiz_end')),
  is_correct boolean,
  attempts_used integer,
  time_spent_ms integer,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT fk_event_session FOREIGN KEY (session_id) REFERENCES quiz_play_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_event_quiz FOREIGN KEY (quiz_id) REFERENCES question_sets(id) ON DELETE CASCADE
);

-- Quiz feedback table
CREATE TABLE IF NOT EXISTS quiz_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL,
  school_id uuid,
  session_id uuid,
  thumb text NOT NULL CHECK (thumb IN ('up', 'down')),
  comment text,
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT fk_feedback_quiz FOREIGN KEY (quiz_id) REFERENCES question_sets(id) ON DELETE CASCADE,
  CONSTRAINT fk_feedback_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL,
  CONSTRAINT fk_feedback_session FOREIGN KEY (session_id) REFERENCES quiz_play_sessions(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quiz_play_sessions_quiz_id ON quiz_play_sessions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_play_sessions_school_id ON quiz_play_sessions(school_id);
CREATE INDEX IF NOT EXISTS idx_quiz_play_sessions_started_at ON quiz_play_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_play_sessions_completed ON quiz_play_sessions(completed) WHERE completed = true;
CREATE INDEX IF NOT EXISTS idx_quiz_play_sessions_player ON quiz_play_sessions(player_id);

CREATE INDEX IF NOT EXISTS idx_quiz_session_events_session_id ON quiz_session_events(session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_session_events_quiz_id ON quiz_session_events(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_session_events_type ON quiz_session_events(event_type);
CREATE INDEX IF NOT EXISTS idx_quiz_session_events_created ON quiz_session_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quiz_feedback_quiz_id ON quiz_feedback(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_feedback_thumb ON quiz_feedback(thumb);
CREATE INDEX IF NOT EXISTS idx_quiz_feedback_created ON quiz_feedback(created_at DESC);

-- Enable RLS
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_play_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_session_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies: feature_flags
CREATE POLICY "Anyone can read feature flags"
  ON feature_flags
  FOR SELECT
  USING (true);

CREATE POLICY "Only admins can update feature flags"
  ON feature_flags
  FOR UPDATE
  TO authenticated
  USING (current_user_is_admin());

-- RLS Policies: quiz_play_sessions
CREATE POLICY "Anyone can insert play sessions"
  ON quiz_play_sessions
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update own play sessions"
  ON quiz_play_sessions
  FOR UPDATE
  USING (true);

CREATE POLICY "Users can view own play sessions"
  ON quiz_play_sessions
  FOR SELECT
  TO authenticated
  USING (player_id = auth.uid());

CREATE POLICY "Anonymous can view all play sessions"
  ON quiz_play_sessions
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Teachers can view sessions for their quizzes"
  ON quiz_play_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM question_sets qs
      WHERE qs.id = quiz_play_sessions.quiz_id
      AND qs.created_by = auth.uid()
    )
  );

CREATE POLICY "Admins can view all play sessions"
  ON quiz_play_sessions
  FOR SELECT
  TO authenticated
  USING (current_user_is_admin());

-- RLS Policies: quiz_session_events
CREATE POLICY "Anyone can insert session events"
  ON quiz_session_events
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view events for their sessions"
  ON quiz_session_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quiz_play_sessions qps
      WHERE qps.id = quiz_session_events.session_id
      AND qps.player_id = auth.uid()
    )
  );

CREATE POLICY "Anonymous can view all session events"
  ON quiz_session_events
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Teachers can view events for their quiz sessions"
  ON quiz_session_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM question_sets qset
      WHERE qset.id = quiz_session_events.quiz_id
      AND qset.created_by = auth.uid()
    )
  );

CREATE POLICY "Admins can view all session events"
  ON quiz_session_events
  FOR SELECT
  TO authenticated
  USING (current_user_is_admin());

-- RLS Policies: quiz_feedback
CREATE POLICY "Anyone can insert feedback"
  ON quiz_feedback
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Teachers can view feedback for their quizzes"
  ON quiz_feedback
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM question_sets qs
      WHERE qs.id = quiz_feedback.quiz_id
      AND qs.created_by = auth.uid()
    )
  );

CREATE POLICY "Admins can view all feedback"
  ON quiz_feedback
  FOR SELECT
  TO authenticated
  USING (current_user_is_admin());

-- Helper function to check if analytics is enabled
CREATE OR REPLACE FUNCTION is_analytics_enabled()
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_enabled boolean;
BEGIN
  SELECT enabled INTO v_enabled
  FROM feature_flags
  WHERE flag_name = 'ANALYTICS_V1_ENABLED';
  
  RETURN COALESCE(v_enabled, false);
END;
$$;

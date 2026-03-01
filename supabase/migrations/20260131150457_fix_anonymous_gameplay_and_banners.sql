/*
  # Fix Anonymous Gameplay + Sponsor Banners
  
  1. Sponsor Banners Fix
    - Add `display_order` column to `sponsored_ads` table
    - Update `sponsor_banners` view to include `display_order`
  
  2. Anonymous Quiz Play Tables
    - Create `quiz_sessions` table for anonymous users
    - Create `public_quiz_runs` table for anonymous gameplay
    - Create `public_quiz_answers` table for anonymous answers
  
  3. Security
    - Enable RLS on all new tables
    - Add policies for anonymous and authenticated access
    - Ensure quiz start/submit can work without auth
*/

-- 1. Add display_order to sponsored_ads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sponsored_ads' AND column_name = 'display_order'
  ) THEN
    ALTER TABLE sponsored_ads ADD COLUMN display_order int NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 2. Update sponsor_banners view to include display_order
DROP VIEW IF EXISTS public.sponsor_banners;
CREATE VIEW public.sponsor_banners 
WITH (security_invoker=false) AS
SELECT 
  id,
  title,
  image_url,
  destination_url AS target_url,
  placement,
  is_active,
  start_date AS start_at,
  end_date AS end_at,
  display_order,
  created_by,
  created_at,
  updated_at
FROM sponsored_ads;

-- Grant access to view
GRANT SELECT ON public.sponsor_banners TO anon, authenticated;

-- 3. Create quiz_sessions table for anonymous users
CREATE TABLE IF NOT EXISTS public.quiz_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text UNIQUE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  last_activity timestamptz DEFAULT now()
);

ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for quiz_sessions
CREATE POLICY "Anyone can create session"
  ON quiz_sessions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can view own session by session_id"
  ON quiz_sessions FOR SELECT
  TO anon, authenticated
  USING (session_id = current_setting('request.headers', true)::json->>'x-session-id' OR auth.uid() = user_id);

CREATE POLICY "Anyone can update own session"
  ON quiz_sessions FOR UPDATE
  TO anon, authenticated
  USING (session_id = current_setting('request.headers', true)::json->>'x-session-id' OR auth.uid() = user_id);

-- 4. Create public_quiz_runs table
CREATE TABLE IF NOT EXISTS public.public_quiz_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  quiz_session_id uuid REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES topics(id) ON DELETE CASCADE,
  question_set_id uuid REFERENCES question_sets(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed')),
  score int DEFAULT 0,
  questions_data jsonb NOT NULL,
  current_question_index int DEFAULT 0,
  attempts_used jsonb DEFAULT '{}',
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.public_quiz_runs ENABLE ROW LEVEL SECURITY;

-- Policies for public_quiz_runs
CREATE POLICY "Anyone can create quiz run"
  ON public_quiz_runs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can view own runs"
  ON public_quiz_runs FOR SELECT
  TO anon, authenticated
  USING (session_id = current_setting('request.headers', true)::json->>'x-session-id');

CREATE POLICY "Anyone can update own runs"
  ON public_quiz_runs FOR UPDATE
  TO anon, authenticated
  USING (session_id = current_setting('request.headers', true)::json->>'x-session-id');

-- 5. Create public_quiz_answers table
CREATE TABLE IF NOT EXISTS public.public_quiz_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public_quiz_runs(id) ON DELETE CASCADE,
  question_id uuid NOT NULL,
  selected_option int NOT NULL,
  is_correct boolean NOT NULL,
  attempt_number int NOT NULL DEFAULT 1,
  answered_at timestamptz DEFAULT now()
);

ALTER TABLE public.public_quiz_answers ENABLE ROW LEVEL SECURITY;

-- Policies for public_quiz_answers
CREATE POLICY "Anyone can create answer"
  ON public_quiz_answers FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can view answers for own runs"
  ON public_quiz_answers FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public_quiz_runs
      WHERE public_quiz_runs.id = run_id
      AND public_quiz_runs.session_id = current_setting('request.headers', true)::json->>'x-session-id'
    )
  );

-- 6. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_session_id ON quiz_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user_id ON quiz_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_public_quiz_runs_session_id ON public_quiz_runs(session_id);
CREATE INDEX IF NOT EXISTS idx_public_quiz_runs_topic_id ON public_quiz_runs(topic_id);
CREATE INDEX IF NOT EXISTS idx_public_quiz_runs_status ON public_quiz_runs(status);
CREATE INDEX IF NOT EXISTS idx_public_quiz_answers_run_id ON public_quiz_answers(run_id);
CREATE INDEX IF NOT EXISTS idx_public_quiz_answers_question_id ON public_quiz_answers(question_id);

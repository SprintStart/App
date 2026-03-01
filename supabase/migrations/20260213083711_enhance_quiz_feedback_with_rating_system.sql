/*
  # Enhance Quiz Feedback with Rating System

  ## Purpose
  Add micro feedback system with thumbs up/down, reasons, and aggregated ranking.

  ## Changes
  
  1. Update quiz_feedback table:
     - Add user_type (student/teacher)
     - Add rating (-1 for down, 1 for up)
     - Add reason (category chips)
     - Add user_agent and app_version
     - Update RLS policies
  
  2. Create aggregation view:
     - quiz_feedback_stats view with likes/dislikes per quiz
     - Calculate feedback_score for ranking
  
  3. Create helper functions:
     - get_quiz_feedback_summary() for teacher dashboard
     - get_top_rated_quizzes() for browse pages

  ## Security
  - Anyone can insert feedback (non-blocking)
  - Only teachers can view their own quiz feedback
  - Only admins can view all feedback
*/

-- Add new columns to quiz_feedback table
DO $$
BEGIN
  -- Add user_type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quiz_feedback' AND column_name = 'user_type'
  ) THEN
    ALTER TABLE quiz_feedback ADD COLUMN user_type text DEFAULT 'student' CHECK (user_type IN ('student', 'teacher'));
  END IF;

  -- Add rating column (convert from thumb if needed)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quiz_feedback' AND column_name = 'rating'
  ) THEN
    ALTER TABLE quiz_feedback ADD COLUMN rating integer;
    
    -- Migrate existing thumb data to rating
    UPDATE quiz_feedback 
    SET rating = CASE 
      WHEN thumb = 'up' THEN 1 
      WHEN thumb = 'down' THEN -1 
      ELSE NULL 
    END
    WHERE rating IS NULL;
    
    -- Add constraint
    ALTER TABLE quiz_feedback ADD CONSTRAINT rating_check CHECK (rating IN (-1, 1));
    ALTER TABLE quiz_feedback ALTER COLUMN rating SET NOT NULL;
  END IF;

  -- Add reason column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quiz_feedback' AND column_name = 'reason'
  ) THEN
    ALTER TABLE quiz_feedback ADD COLUMN reason text CHECK (reason IN ('too_hard', 'too_easy', 'unclear_questions', 'too_long', 'bugs_lag', NULL));
  END IF;

  -- Add user_agent column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quiz_feedback' AND column_name = 'user_agent'
  ) THEN
    ALTER TABLE quiz_feedback ADD COLUMN user_agent text;
  END IF;

  -- Add app_version column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quiz_feedback' AND column_name = 'app_version'
  ) THEN
    ALTER TABLE quiz_feedback ADD COLUMN app_version text;
  END IF;
END $$;

-- Create index for faster aggregation
CREATE INDEX IF NOT EXISTS idx_quiz_feedback_rating ON quiz_feedback(quiz_id, rating);

-- Create materialized view for quiz feedback stats
CREATE MATERIALIZED VIEW IF NOT EXISTS quiz_feedback_stats AS
SELECT 
  qf.quiz_id,
  COUNT(*) FILTER (WHERE qf.rating = 1) as likes_count,
  COUNT(*) FILTER (WHERE qf.rating = -1) as dislikes_count,
  COUNT(*) as total_feedback,
  ROUND(
    (COUNT(*) FILTER (WHERE qf.rating = 1)::numeric - COUNT(*) FILTER (WHERE qf.rating = -1)::numeric) / 
    (COUNT(*) FILTER (WHERE qf.rating = 1)::numeric + COUNT(*) FILTER (WHERE qf.rating = -1)::numeric + 5)
  , 3) as feedback_score,
  COUNT(DISTINCT qf.session_id) as unique_sessions,
  MAX(qf.created_at) as last_feedback_at
FROM quiz_feedback qf
GROUP BY qf.quiz_id;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_feedback_stats_quiz_id ON quiz_feedback_stats(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_feedback_stats_score ON quiz_feedback_stats(feedback_score DESC);

-- Create function to refresh stats (can be called by cron)
CREATE OR REPLACE FUNCTION refresh_quiz_feedback_stats()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY quiz_feedback_stats;
END;
$$;

-- Function: Get feedback summary for a specific quiz (teacher dashboard)
CREATE OR REPLACE FUNCTION get_quiz_feedback_summary(p_quiz_id uuid)
RETURNS json
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_result json;
  v_created_by uuid;
BEGIN
  -- Check permission: owner or admin
  SELECT created_by INTO v_created_by
  FROM question_sets
  WHERE id = p_quiz_id;
  
  IF v_created_by != auth.uid() AND NOT current_user_is_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  SELECT json_build_object(
    'likes_count', COUNT(*) FILTER (WHERE rating = 1),
    'dislikes_count', COUNT(*) FILTER (WHERE rating = -1),
    'total_feedback', COUNT(*),
    'feedback_score', ROUND(
      (COUNT(*) FILTER (WHERE rating = 1)::numeric - COUNT(*) FILTER (WHERE rating = -1)::numeric) / 
      (COUNT(*) FILTER (WHERE rating = 1)::numeric + COUNT(*) FILTER (WHERE rating = -1)::numeric + 5)
    , 3),
    'reasons', json_build_object(
      'too_hard', COUNT(*) FILTER (WHERE reason = 'too_hard'),
      'too_easy', COUNT(*) FILTER (WHERE reason = 'too_easy'),
      'unclear_questions', COUNT(*) FILTER (WHERE reason = 'unclear_questions'),
      'too_long', COUNT(*) FILTER (WHERE reason = 'too_long'),
      'bugs_lag', COUNT(*) FILTER (WHERE reason = 'bugs_lag')
    ),
    'recent_comments', (
      SELECT json_agg(c ORDER BY created_at DESC)
      FROM (
        SELECT comment, created_at, rating
        FROM quiz_feedback
        WHERE quiz_id = p_quiz_id
        AND comment IS NOT NULL
        AND comment != ''
        ORDER BY created_at DESC
        LIMIT 10
      ) c
    )
  ) INTO v_result
  FROM quiz_feedback
  WHERE quiz_id = p_quiz_id;
  
  RETURN v_result;
END;
$$;

-- Function: Get top rated quizzes (for browse pages)
CREATE OR REPLACE FUNCTION get_top_rated_quizzes(
  p_school_id uuid DEFAULT NULL,
  p_min_feedback integer DEFAULT 10,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  quiz_id uuid,
  quiz_title text,
  likes_count bigint,
  dislikes_count bigint,
  total_plays bigint,
  feedback_score numeric,
  teacher_name text,
  school_name text,
  created_at timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    qs.id as quiz_id,
    qs.title as quiz_title,
    COALESCE(qfs.likes_count, 0) as likes_count,
    COALESCE(qfs.dislikes_count, 0) as dislikes_count,
    COUNT(qps.id)::bigint as total_plays,
    COALESCE(qfs.feedback_score, 0) as feedback_score,
    p.full_name as teacher_name,
    s.name as school_name,
    qs.created_at
  FROM question_sets qs
  LEFT JOIN quiz_feedback_stats qfs ON qfs.quiz_id = qs.id
  LEFT JOIN quiz_play_sessions qps ON qps.quiz_id = qs.id
  LEFT JOIN profiles p ON p.id = qs.created_by
  LEFT JOIN schools s ON s.id = qs.school_id
  WHERE qs.is_active = true
  AND qs.approval_status = 'approved'
  AND (p_school_id IS NULL OR qs.school_id = p_school_id)
  AND COALESCE(qfs.total_feedback, 0) >= p_min_feedback
  GROUP BY qs.id, qs.title, qfs.likes_count, qfs.dislikes_count, qfs.feedback_score, p.full_name, s.name, qs.created_at
  ORDER BY feedback_score DESC, total_plays DESC
  LIMIT p_limit;
END;
$$;

-- Update RLS policies for quiz_feedback
DROP POLICY IF EXISTS "Anyone can insert feedback" ON quiz_feedback;

CREATE POLICY "Anyone can insert feedback anonymously"
  ON quiz_feedback
  FOR INSERT
  WITH CHECK (true);

-- Ensure teachers can view feedback for their quizzes (already exists)
-- Ensure admins can view all feedback (already exists)

-- Create table for teacher review prompts
CREATE TABLE IF NOT EXISTS teacher_review_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  quiz_id uuid NOT NULL,
  shown_at timestamptz DEFAULT now(),
  dismissed boolean DEFAULT false,
  clicked boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT fk_teacher FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_quiz FOREIGN KEY (quiz_id) REFERENCES question_sets(id) ON DELETE CASCADE,
  UNIQUE(teacher_id, quiz_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_review_prompts_teacher ON teacher_review_prompts(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_review_prompts_shown ON teacher_review_prompts(shown_at DESC);

-- Enable RLS
ALTER TABLE teacher_review_prompts ENABLE ROW LEVEL SECURITY;

-- RLS policies for teacher_review_prompts
CREATE POLICY "Teachers can view own review prompts"
  ON teacher_review_prompts
  FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can insert own review prompts"
  ON teacher_review_prompts
  FOR INSERT
  TO authenticated
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can update own review prompts"
  ON teacher_review_prompts
  FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid());

-- Function: Check if teacher should see review prompt
CREATE OR REPLACE FUNCTION should_show_teacher_review_prompt(p_teacher_id uuid, p_quiz_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_quiz_created_at timestamptz;
  v_total_plays integer;
  v_already_shown boolean;
  v_days_since_publish integer;
BEGIN
  -- Check if already shown
  SELECT EXISTS (
    SELECT 1 FROM teacher_review_prompts
    WHERE teacher_id = p_teacher_id
    AND quiz_id = p_quiz_id
  ) INTO v_already_shown;
  
  IF v_already_shown THEN
    RETURN false;
  END IF;
  
  -- Get quiz details
  SELECT created_at INTO v_quiz_created_at
  FROM question_sets
  WHERE id = p_quiz_id
  AND created_by = p_teacher_id;
  
  IF v_quiz_created_at IS NULL THEN
    RETURN false;
  END IF;
  
  -- Calculate days since publish
  v_days_since_publish := EXTRACT(DAY FROM (NOW() - v_quiz_created_at));
  
  -- Get total plays
  SELECT COUNT(*) INTO v_total_plays
  FROM quiz_play_sessions
  WHERE quiz_id = p_quiz_id;
  
  -- Show if >= 20 plays OR >= 3 days after publish
  RETURN (v_total_plays >= 20 OR v_days_since_publish >= 3);
END;
$$;

-- Initial refresh of stats
SELECT refresh_quiz_feedback_stats();

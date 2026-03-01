/*
  # Add Country and Exam Code Fields to Question Sets
  
  1. New Columns
    - `country_code` (text, nullable) - ISO country code (GB, GH, US, CA, NG, IN, AU, INTL)
    - `exam_code` (text, nullable) - Exam system code (GCSE, A-Level, WASSCE, etc.)
    - `description` (text, nullable) - Quiz description for preview cards
    - `timer_seconds` (integer, nullable) - Optional time limit per quiz
  
  2. Indexes
    - Index on (approval_status, created_at) for efficient global quiz listing
    - Composite index on (country_code, exam_code, approval_status, created_at) for country/exam filtering
  
  3. Notes
    - NULL values mean "global" quizzes (not tied to specific country/exam)
    - school_id NULL also means "global" (visible on /explore)
    - school_id NOT NULL means "school wall" quiz (visible on /[slug])
    - approval_status = 'approved' means published, 'draft' means unpublished
*/

-- Add columns to question_sets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'question_sets' AND column_name = 'country_code'
  ) THEN
    ALTER TABLE question_sets ADD COLUMN country_code text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'question_sets' AND column_name = 'exam_code'
  ) THEN
    ALTER TABLE question_sets ADD COLUMN exam_code text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'question_sets' AND column_name = 'description'
  ) THEN
    ALTER TABLE question_sets ADD COLUMN description text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'question_sets' AND column_name = 'timer_seconds'
  ) THEN
    ALTER TABLE question_sets ADD COLUMN timer_seconds integer;
  END IF;
END $$;

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_question_sets_approval_created 
  ON question_sets(approval_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_question_sets_country_exam_approval 
  ON question_sets(country_code, exam_code, approval_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_question_sets_school_approval
  ON question_sets(school_id, approval_status, created_at DESC);

-- Add comments for documentation
COMMENT ON COLUMN question_sets.country_code IS 'ISO country code for country-specific quizzes (GB, GH, US, CA, NG, IN, AU, INTL). NULL = global quiz.';
COMMENT ON COLUMN question_sets.exam_code IS 'Exam system code (GCSE, A-Level, WASSCE, etc.). NULL = global quiz or not exam-specific.';
COMMENT ON COLUMN question_sets.description IS 'Quiz description shown on preview cards';
COMMENT ON COLUMN question_sets.timer_seconds IS 'Optional time limit for the entire quiz in seconds';
/*
  # Add Question Types and Image Support

  ## Changes Overview
  
  This migration enhances the quiz question system to support:
  1. Multiple question types (MCQ, True/False, Yes/No)
  2. Optional images per question
  3. Flexible option counts (2-6 options for MCQ)
  
  ## Changes Made
  
  ### 1. New Types
  - `question_type_enum`: Defines available question types (mcq, true_false, yes_no)
  
  ### 2. Table Modifications
  - Add `question_type` column to `topic_questions` table (defaults to 'mcq')
  - Add `image_url` column to `topic_questions` table (optional)
  - Update constraint to allow 2-6 options (current constraint: 2-4)
  
  ### 3. Storage Setup
  - Create `question-images` storage bucket for question images
  - Set up public access policies for viewing images
  - Set up authenticated teacher policies for uploading/deleting images
  
  ## Notes
  - Existing questions will default to 'mcq' type
  - Image URLs are optional and can be added to any question type
  - Storage bucket allows public read but requires authentication to upload
  - MCQ can have 2-6 options, True/False and Yes/No will have exactly 2
*/

-- =====================================================
-- PART 1: CREATE QUESTION TYPE ENUM
-- =====================================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'question_type_enum') THEN
    CREATE TYPE question_type_enum AS ENUM ('mcq', 'true_false', 'yes_no');
  END IF;
END $$;

-- =====================================================
-- PART 2: ADD COLUMNS TO TOPIC_QUESTIONS TABLE
-- =====================================================

-- Add question_type column (defaults to mcq for backward compatibility)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'topic_questions'
    AND column_name = 'question_type'
  ) THEN
    ALTER TABLE public.topic_questions
    ADD COLUMN question_type question_type_enum NOT NULL DEFAULT 'mcq';
  END IF;
END $$;

-- Add image_url column (optional)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'topic_questions'
    AND column_name = 'image_url'
  ) THEN
    ALTER TABLE public.topic_questions
    ADD COLUMN image_url text;
  END IF;
END $$;

-- Drop the old constraint that limits options to 2-4
ALTER TABLE public.topic_questions
DROP CONSTRAINT IF EXISTS topic_questions_options_check;

-- Drop the old constraint on correct_index
ALTER TABLE public.topic_questions
DROP CONSTRAINT IF EXISTS topic_questions_correct_index_check;

-- Add new constraint to allow 2-6 options
ALTER TABLE public.topic_questions
ADD CONSTRAINT topic_questions_options_check
CHECK (array_length(options, 1) >= 2 AND array_length(options, 1) <= 6);

-- Add new constraint for correct_index (0-5 to support 6 options)
ALTER TABLE public.topic_questions
ADD CONSTRAINT topic_questions_correct_index_check
CHECK (correct_index >= 0 AND correct_index <= 5);

-- Add index on question_type for filtering
CREATE INDEX IF NOT EXISTS idx_topic_questions_question_type
  ON public.topic_questions(question_type);

-- =====================================================
-- PART 3: CREATE STORAGE BUCKET FOR QUESTION IMAGES
-- =====================================================

-- Create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'question-images',
  'question-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- PART 4: STORAGE POLICIES FOR QUESTION IMAGES
-- =====================================================

-- Allow public read access to question images
DROP POLICY IF EXISTS "Public can view question images" ON storage.objects;
CREATE POLICY "Public can view question images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'question-images');

-- Allow authenticated teachers to upload question images
DROP POLICY IF EXISTS "Teachers can upload question images" ON storage.objects;
CREATE POLICY "Teachers can upload question images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'question-images'
    AND auth.uid() IS NOT NULL
  );

-- Allow teachers to update their own question images
DROP POLICY IF EXISTS "Teachers can update own question images" ON storage.objects;
CREATE POLICY "Teachers can update own question images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'question-images'
    AND auth.uid() IS NOT NULL
  )
  WITH CHECK (
    bucket_id = 'question-images'
    AND auth.uid() IS NOT NULL
  );

-- Allow teachers to delete their own question images
DROP POLICY IF EXISTS "Teachers can delete own question images" ON storage.objects;
CREATE POLICY "Teachers can delete own question images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'question-images'
    AND auth.uid() IS NOT NULL
  );

-- =====================================================
-- PART 5: ADD HELPFUL COMMENTS
-- =====================================================

COMMENT ON COLUMN public.topic_questions.question_type IS 'Type of question: mcq (2-6 options), true_false (2 options), yes_no (2 options)';
COMMENT ON COLUMN public.topic_questions.image_url IS 'Optional image URL for the question (stored in Supabase Storage)';

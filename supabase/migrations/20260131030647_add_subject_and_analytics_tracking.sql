/*
  # Add Subject Classification and Analytics Tracking
  
  ## Overview
  Adds subject categorization and play tracking for analytics.
  
  ## Changes
  
  ### 1. Topics Table
  - Add `subject` column to categorize topics under 12 subjects
  - Subject options: mathematics, science, english, computing, business, geography, history, languages, art, engineering, health, other
  
  ### 2. Question Sets Table
  - Add `play_count` to track how many times a quiz is started
  - Add `completion_count` to track how many times completed
  - Add `last_played_at` timestamp
  
  ### 3. Schools Table (NEW)
  - Stores school information for domain-based auto-premium
  - Links to profiles for teachers at that school
  
  ### 4. Indexes
  - Add performance indexes for analytics queries
*/

-- Add subject column to topics
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'topics' AND column_name = 'subject'
  ) THEN
    ALTER TABLE topics ADD COLUMN subject text DEFAULT 'other' CHECK (
      subject IN ('mathematics', 'science', 'english', 'computing', 'business', 
                  'geography', 'history', 'languages', 'art', 'engineering', 'health', 'other')
    );
  END IF;
END $$;

-- Add play tracking to question_sets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'question_sets' AND column_name = 'play_count'
  ) THEN
    ALTER TABLE question_sets ADD COLUMN play_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'question_sets' AND column_name = 'completion_count'
  ) THEN
    ALTER TABLE question_sets ADD COLUMN completion_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'question_sets' AND column_name = 'last_played_at'
  ) THEN
    ALTER TABLE question_sets ADD COLUMN last_played_at timestamptz;
  END IF;
END $$;

-- Create schools table
CREATE TABLE IF NOT EXISTS schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  domain text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  subscription_type text DEFAULT 'premium' CHECK (subscription_type IN ('free', 'premium', 'enterprise')),
  subscription_end_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

-- Schools policies (admin only management)
CREATE POLICY "Admin can manage schools"
  ON schools FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Add school_id to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'school_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN school_id uuid REFERENCES schools(id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'school_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN school_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'subjects_taught'
  ) THEN
    ALTER TABLE profiles ADD COLUMN subjects_taught text[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'date_of_birth'
  ) THEN
    ALTER TABLE profiles ADD COLUMN date_of_birth date;
  END IF;
END $$;

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_topics_subject ON topics(subject) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_question_sets_plays ON question_sets(play_count DESC);
CREATE INDEX IF NOT EXISTS idx_question_sets_teacher ON question_sets(created_by) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_profiles_school ON profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_schools_domain ON schools(domain) WHERE is_active = true;

-- Update existing topics to have a subject (default to 'other')
UPDATE topics SET subject = 'other' WHERE subject IS NULL;

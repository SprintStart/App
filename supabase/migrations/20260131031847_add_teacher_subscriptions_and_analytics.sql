/*
  # Add Teacher Subscriptions and Enhanced Analytics
  
  ## Overview
  Adds subscription management for teachers and enhanced analytics tracking.
  
  ## Changes
  
  ### 1. Subscriptions Table (NEW)
  - Stores teacher subscription information
  - Tracks subscription status, plan type, billing cycle
  - Links to Stripe customer and subscription IDs
  - Fields:
    - `id` (uuid, primary key)
    - `teacher_id` (uuid, references profiles)
    - `stripe_customer_id` (text)
    - `stripe_subscription_id` (text)
    - `plan_type` (free, premium, enterprise)
    - `status` (active, canceled, expired, trialing)
    - `current_period_start` (timestamptz)
    - `current_period_end` (timestamptz)
    - `canceled_at` (timestamptz)
    - `max_active_quizzes` (integer, default based on plan)
    - `max_students_per_quiz` (integer)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)
  
  ### 2. Student Sessions Table (Enhanced)
  - Tracks individual student play sessions for analytics
  - Fields:
    - `id` (uuid, primary key)
    - `question_set_id` (uuid)
    - `student_name` (text, anonymous)
    - `started_at` (timestamptz)
    - `completed_at` (timestamptz)
    - `score` (integer)
    - `total_questions` (integer)
    - `time_spent_seconds` (integer)
    - `answers` (jsonb, array of answer objects)
    - `drop_off_question` (integer, null if completed)
  
  ### 3. Question Analytics Table (NEW)
  - Per-question performance tracking
  - Fields:
    - `id` (uuid, primary key)
    - `question_id` (uuid, references topic_questions)
    - `question_set_id` (uuid)
    - `total_attempts` (integer)
    - `correct_attempts` (integer)
    - `average_time_seconds` (numeric)
    - `updated_at` (timestamptz)
  
  ### 4. Indexes
  - Performance indexes for analytics queries
  
  ### 5. Security
  - RLS policies for all new tables
  - Teachers can only access their own data
  - Admins have full access
*/

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  plan_type text DEFAULT 'free' CHECK (plan_type IN ('free', 'premium', 'enterprise')),
  status text DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'expired', 'trialing')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  max_active_quizzes integer DEFAULT 5,
  max_students_per_quiz integer DEFAULT 30,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view own subscription"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = teacher_id);

CREATE POLICY "Admins can manage all subscriptions"
  ON subscriptions FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Create student sessions table
CREATE TABLE IF NOT EXISTS student_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_set_id uuid REFERENCES question_sets(id) ON DELETE CASCADE NOT NULL,
  student_name text NOT NULL,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  score integer DEFAULT 0,
  total_questions integer NOT NULL,
  time_spent_seconds integer,
  answers jsonb DEFAULT '[]'::jsonb,
  drop_off_question integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE student_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view sessions for their quizzes"
  ON student_sessions FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM question_sets qs
    WHERE qs.id = student_sessions.question_set_id
    AND qs.created_by = auth.uid()
  ));

CREATE POLICY "Admins can view all sessions"
  ON student_sessions FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Create question analytics table
CREATE TABLE IF NOT EXISTS question_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid REFERENCES topic_questions(id) ON DELETE CASCADE NOT NULL,
  question_set_id uuid REFERENCES question_sets(id) ON DELETE CASCADE NOT NULL,
  total_attempts integer DEFAULT 0,
  correct_attempts integer DEFAULT 0,
  average_time_seconds numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(question_id)
);

ALTER TABLE question_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view analytics for their questions"
  ON question_analytics FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM question_sets qs
    WHERE qs.id = question_analytics.question_set_id
    AND qs.created_by = auth.uid()
  ));

CREATE POLICY "Admins can view all analytics"
  ON question_analytics FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_teacher ON subscriptions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status, current_period_end);
CREATE INDEX IF NOT EXISTS idx_student_sessions_question_set ON student_sessions(question_set_id);
CREATE INDEX IF NOT EXISTS idx_student_sessions_completed ON student_sessions(completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_question_analytics_question ON question_analytics(question_id);
CREATE INDEX IF NOT EXISTS idx_question_analytics_set ON question_analytics(question_set_id);

-- Add published status to question_sets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'question_sets' AND column_name = 'is_published'
  ) THEN
    ALTER TABLE question_sets ADD COLUMN is_published boolean DEFAULT false;
  END IF;
END $$;

-- Create function to auto-create free subscription for new teachers
CREATE OR REPLACE FUNCTION create_teacher_subscription()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'teacher' THEN
    INSERT INTO subscriptions (teacher_id, plan_type, status, max_active_quizzes, max_students_per_quiz)
    VALUES (NEW.id, 'free', 'active', 5, 30);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-subscription
DROP TRIGGER IF EXISTS trigger_create_teacher_subscription ON profiles;
CREATE TRIGGER trigger_create_teacher_subscription
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_teacher_subscription();

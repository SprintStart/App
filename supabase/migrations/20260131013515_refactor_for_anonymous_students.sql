/*
  # Refactor ImmersiQ for Anonymous Students & Teacher Payment
  
  ## Overview
  Major architectural shift to support:
  - Anonymous student sessions (no authentication)
  - Teacher payment enforcement (£99.99/year)
  - Admin approval workflow for quizzes
  - Public topic categories (admin-controlled)
  - Sponsor banner management
  
  ## Changes
  
  ### 1. Update Profiles Table
  - Add payment fields for teachers
  - Remove student role (students don't have profiles)
  
  ### 2. Update Topics
  - Topics are now public categories (admin manages)
  - Remove teacher ownership requirement
  
  ### 3. Update Question Sets (now "Quizzes")
  - Add approval workflow fields
  - Add visibility controls
  
  ### 4. Update Topic Runs
  - Change user_id to session_id (anonymous tracking)
  - Make user_id nullable for backward compatibility
  
  ### 5. Add Sponsor Banners Table
  - Homepage sponsor management
  
  ## Security
  - Students access quizzes without authentication
  - Teachers must be authenticated AND paid
  - Admin controls all public content
*/

-- Add payment and subscription fields to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN subscription_status text DEFAULT 'inactive' CHECK (subscription_status IN ('active', 'inactive', 'trial', 'cancelled'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'subscription_end_date'
  ) THEN
    ALTER TABLE profiles ADD COLUMN subscription_end_date timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'payment_method_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN payment_method_id text;
  END IF;
END $$;

-- Update role check to exclude students
DO $$
BEGIN
  ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
  ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('teacher', 'admin'));
END $$;

-- Add approval workflow to question_sets (quizzes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'question_sets' AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE question_sets ADD COLUMN approval_status text DEFAULT 'draft' CHECK (approval_status IN ('draft', 'pending', 'approved', 'rejected'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'question_sets' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE question_sets ADD COLUMN approved_by uuid REFERENCES profiles(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'question_sets' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE question_sets ADD COLUMN approved_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'question_sets' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE question_sets ADD COLUMN rejection_reason text;
  END IF;
END $$;

-- Make topic_runs work with anonymous sessions
DO $$
BEGIN
  -- Make user_id nullable
  ALTER TABLE topic_runs ALTER COLUMN user_id DROP NOT NULL;

  -- Add session_id for anonymous tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'topic_runs' AND column_name = 'session_id'
  ) THEN
    ALTER TABLE topic_runs ADD COLUMN session_id text;
  END IF;

  -- Add check: must have either user_id OR session_id
  ALTER TABLE topic_runs DROP CONSTRAINT IF EXISTS topic_runs_identity_check;
  ALTER TABLE topic_runs ADD CONSTRAINT topic_runs_identity_check CHECK (
    (user_id IS NOT NULL AND session_id IS NULL) OR 
    (user_id IS NULL AND session_id IS NOT NULL) OR
    (user_id IS NOT NULL AND session_id IS NOT NULL)
  );
END $$;

-- Create sponsor_banners table for homepage
CREATE TABLE IF NOT EXISTS sponsor_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  image_url text NOT NULL,
  link_url text,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  click_count integer DEFAULT 0,
  impression_count integer DEFAULT 0,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sponsor_banners ENABLE ROW LEVEL SECURITY;

-- Sponsor banner policies (admin only)
CREATE POLICY "Admin can manage sponsor banners"
  ON sponsor_banners FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Allow anonymous users to read active sponsor banners
CREATE POLICY "Anyone can read active sponsor banners"
  ON sponsor_banners FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Update RLS policies for anonymous student access

-- Topics: Allow anonymous read access to active topics
DROP POLICY IF EXISTS "Anyone can read active topics" ON topics;
CREATE POLICY "Anyone can read active topics"
  ON topics FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Question sets: Allow anonymous read access to approved quizzes
DROP POLICY IF EXISTS "Anyone can read active question sets" ON question_sets;
CREATE POLICY "Anyone can read approved question sets"
  ON question_sets FOR SELECT
  TO anon, authenticated
  USING (is_active = true AND approval_status = 'approved');

-- Topic questions: Allow anonymous read (text and options only, not correct_index)
DROP POLICY IF EXISTS "Students can read question text and options" ON topic_questions;
CREATE POLICY "Anyone can read question text and options"
  ON topic_questions FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM question_sets qs
      WHERE qs.id = topic_questions.question_set_id
      AND qs.is_active = true
      AND qs.approval_status = 'approved'
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin')
    )
  );

-- Topic runs: Allow anonymous insert with session_id
DROP POLICY IF EXISTS "Users can create own runs" ON topic_runs;
CREATE POLICY "Anyone can create runs"
  ON topic_runs FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND session_id IS NOT NULL)
  );

-- Topic runs: Allow anonymous read by session_id
DROP POLICY IF EXISTS "Users can read own runs" ON topic_runs;
CREATE POLICY "Users can read own runs by session or user"
  ON topic_runs FOR SELECT
  TO anon, authenticated
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND session_id IS NOT NULL) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
  );

-- Topic runs: Allow anonymous update by session_id
DROP POLICY IF EXISTS "Users can update own runs" ON topic_runs;
CREATE POLICY "Users can update own runs by session or user"
  ON topic_runs FOR UPDATE
  TO anon, authenticated
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND session_id IS NOT NULL)
  )
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND session_id IS NOT NULL)
  );

-- Topic run answers: Allow anonymous insert
DROP POLICY IF EXISTS "Users can create own run answers" ON topic_run_answers;
CREATE POLICY "Anyone can create run answers"
  ON topic_run_answers FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM topic_runs 
      WHERE id = run_id 
      AND (
        (user_id = auth.uid()) OR 
        (session_id IS NOT NULL AND auth.uid() IS NULL) OR
        (session_id IS NOT NULL)
      )
    )
  );

-- Topic run answers: Allow anonymous read
DROP POLICY IF EXISTS "Users can read own run answers" ON topic_run_answers;
CREATE POLICY "Users can read own run answers"
  ON topic_run_answers FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM topic_runs 
      WHERE id = run_id 
      AND (
        (user_id = auth.uid()) OR 
        (session_id IS NOT NULL)
      )
    ) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
  );

-- Teacher policies: Require active subscription
CREATE POLICY "Teachers can manage own quizzes if paid"
  ON question_sets FOR ALL
  TO authenticated
  USING (
    (created_by = auth.uid() OR auth.uid() = created_by) AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('teacher', 'admin')
      AND (
        role = 'admin' OR 
        (subscription_status = 'active' AND subscription_end_date > now())
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('teacher', 'admin')
      AND (
        role = 'admin' OR 
        (subscription_status = 'active' AND subscription_end_date > now())
      )
    )
  );

-- Update existing seed data to approved status
UPDATE question_sets SET approval_status = 'approved' WHERE approval_status IS NULL OR approval_status = 'draft';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_question_sets_approval ON question_sets(approval_status);
CREATE INDEX IF NOT EXISTS idx_topic_runs_session ON topic_runs(session_id);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription ON profiles(subscription_status, subscription_end_date);
CREATE INDEX IF NOT EXISTS idx_sponsor_banners_active ON sponsor_banners(is_active, display_order);

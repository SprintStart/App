/*
  # Create Teacher Dashboard Tables
  
  1. New Tables
    - `teacher_documents`
      - Stores uploaded documents (PDFs, Word, etc.)
      - Links to generated quizzes
      - Tracks processing status
    
    - `teacher_quiz_drafts`
      - Stores work-in-progress quizzes before publishing
      - Auto-saves every 30 seconds
      - Tracks last edited timestamp
    
    - `teacher_activities`
      - Lightweight activity log for teacher actions
      - Used for recent activity timeline
      - Separate from admin audit_logs
    
    - `teacher_reports`
      - Stores exported reports (CSV, PDF)
      - Tracks report type and parameters
      - Links to file storage
  
  2. Security
    - Enable RLS on all tables
    - Teachers can only access their own data
    - Admins can view all data for support
  
  3. Performance
    - Add indexes on foreign keys and query columns
    - Add created_at indexes for sorting
*/

-- Teacher Documents Table
CREATE TABLE IF NOT EXISTS teacher_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename text NOT NULL,
  file_size_bytes bigint NOT NULL,
  file_type text NOT NULL,
  storage_path text NOT NULL,
  processing_status text NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  processing_error text,
  extracted_text text,
  generated_quiz_id uuid REFERENCES topics(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Teacher Quiz Drafts Table
CREATE TABLE IF NOT EXISTS teacher_quiz_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  subject text CHECK (subject IN ('mathematics', 'science', 'english', 'computing', 'business', 'geography', 'history', 'languages', 'art', 'engineering', 'health', 'other')),
  description text,
  difficulty text CHECK (difficulty IN ('easy', 'medium', 'hard')),
  questions jsonb DEFAULT '[]'::jsonb,
  published_topic_id uuid REFERENCES topics(id) ON DELETE SET NULL,
  is_published boolean DEFAULT false,
  last_autosave_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Teacher Activities Table
CREATE TABLE IF NOT EXISTS teacher_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (activity_type IN (
    'quiz_created', 
    'quiz_published', 
    'quiz_edited',
    'quiz_archived',
    'quiz_duplicated',
    'ai_generated',
    'doc_uploaded',
    'doc_processed',
    'report_exported',
    'profile_updated',
    'login'
  )),
  entity_type text,
  entity_id uuid,
  title text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Teacher Reports Table
CREATE TABLE IF NOT EXISTS teacher_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_type text NOT NULL CHECK (report_type IN (
    'quiz_performance',
    'question_analysis',
    'student_attempts',
    'weekly_summary',
    'custom'
  )),
  report_format text NOT NULL CHECK (report_format IN ('csv', 'pdf', 'json')),
  parameters jsonb DEFAULT '{}'::jsonb,
  storage_path text,
  file_size_bytes bigint,
  generated_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_teacher_documents_teacher_id ON teacher_documents(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_documents_created_at ON teacher_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_teacher_documents_status ON teacher_documents(processing_status);

CREATE INDEX IF NOT EXISTS idx_teacher_quiz_drafts_teacher_id ON teacher_quiz_drafts(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_quiz_drafts_updated_at ON teacher_quiz_drafts(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_teacher_quiz_drafts_published ON teacher_quiz_drafts(is_published);

CREATE INDEX IF NOT EXISTS idx_teacher_activities_teacher_id ON teacher_activities(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_activities_created_at ON teacher_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_teacher_activities_type ON teacher_activities(activity_type);

CREATE INDEX IF NOT EXISTS idx_teacher_reports_teacher_id ON teacher_reports(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_reports_created_at ON teacher_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_teacher_reports_type ON teacher_reports(report_type);

-- Enable RLS
ALTER TABLE teacher_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_quiz_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for teacher_documents
CREATE POLICY "Teachers can view own documents"
  ON teacher_documents FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can insert own documents"
  ON teacher_documents FOR INSERT
  TO authenticated
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can update own documents"
  ON teacher_documents FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete own documents"
  ON teacher_documents FOR DELETE
  TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY "Admins can view all documents"
  ON teacher_documents FOR SELECT
  TO authenticated
  USING (is_admin());

-- RLS Policies for teacher_quiz_drafts
CREATE POLICY "Teachers can view own drafts"
  ON teacher_quiz_drafts FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can insert own drafts"
  ON teacher_quiz_drafts FOR INSERT
  TO authenticated
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can update own drafts"
  ON teacher_quiz_drafts FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete own drafts"
  ON teacher_quiz_drafts FOR DELETE
  TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY "Admins can view all drafts"
  ON teacher_quiz_drafts FOR SELECT
  TO authenticated
  USING (is_admin());

-- RLS Policies for teacher_activities
CREATE POLICY "Teachers can view own activities"
  ON teacher_activities FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can insert own activities"
  ON teacher_activities FOR INSERT
  TO authenticated
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Admins can view all activities"
  ON teacher_activities FOR SELECT
  TO authenticated
  USING (is_admin());

-- RLS Policies for teacher_reports
CREATE POLICY "Teachers can view own reports"
  ON teacher_reports FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can insert own reports"
  ON teacher_reports FOR INSERT
  TO authenticated
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete own reports"
  ON teacher_reports FOR DELETE
  TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY "Admins can view all reports"
  ON teacher_reports FOR SELECT
  TO authenticated
  USING (is_admin());

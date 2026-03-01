/*
  # Create Subjects Table for Custom Teacher Subjects

  ## Overview
  This migration creates a `subjects` table to store custom subjects created by teachers.
  The table works alongside the hardcoded AVAILABLE_SUBJECTS list in the frontend.

  ## Changes Made

  1. **New Table: subjects**
     - `id` (uuid, primary key) - Unique identifier
     - `name` (text, not null) - Subject name (e.g., "Advanced Mathematics")
     - `created_by` (uuid, not null) - Teacher who created this custom subject
     - `is_active` (boolean, default true) - Soft delete flag
     - `created_at` (timestamptz, default now()) - Creation timestamp
     - `updated_at` (timestamptz, default now()) - Last update timestamp

  2. **Security (RLS Policies)**
     - Teachers can SELECT their own custom subjects
     - Teachers can INSERT new custom subjects
     - Teachers can UPDATE their own custom subjects
     - Teachers can DELETE their own custom subjects
     - Admins can view all subjects

  3. **Indexes**
     - Index on created_by for fast teacher lookups
     - Index on name for search/autocomplete

  ## Usage
  - Frontend CreateQuizWizard loads custom subjects via `loadCustomSubjects()`
  - Teachers can create new subjects via `createNewSubject()` function
  - Subjects show in dropdown alongside AVAILABLE_SUBJECTS array
*/

-- Create subjects table
CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT unique_teacher_subject_name UNIQUE (created_by, name)
);

-- Enable RLS
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subjects_created_by ON subjects(created_by) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_subjects_name ON subjects(name) WHERE is_active = true;

-- RLS Policies

-- SELECT: Teachers can view their own custom subjects
CREATE POLICY "Teachers can view own subjects"
  ON subjects FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR is_admin_by_id(auth.uid())
  );

-- INSERT: Teachers can create new subjects
CREATE POLICY "Teachers can create subjects"
  ON subjects FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
  );

-- UPDATE: Teachers can update their own subjects
CREATE POLICY "Teachers can update own subjects"
  ON subjects FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- DELETE: Teachers can delete their own subjects
CREATE POLICY "Teachers can delete own subjects"
  ON subjects FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_subjects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER set_subjects_updated_at
  BEFORE UPDATE ON subjects
  FOR EACH ROW
  EXECUTE FUNCTION update_subjects_updated_at();

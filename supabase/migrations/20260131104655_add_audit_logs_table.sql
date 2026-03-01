/*
  # Add Audit Logs Table

  ## Overview
  Creates an audit_logs table to track important system events like teacher signups.

  ## New Tables
  
  ### audit_logs
  - `id` (uuid, primary key) - Unique identifier for the log entry
  - `admin_id` (uuid, nullable) - ID of the user who performed the action
  - `action_type` (text) - Type of action performed (e.g., 'teacher_signup', 'profile_update')
  - `entity_type` (text, nullable) - Type of entity affected (e.g., 'profile', 'topic')
  - `entity_id` (uuid, nullable) - ID of the affected entity
  - `reason` (text, nullable) - Description of why the action was taken
  - `before_state` (jsonb, nullable) - State before the action
  - `after_state` (jsonb, nullable) - State after the action
  - `created_at` (timestamptz) - When the action occurred
  
  ## Security
  - Enable RLS on audit_logs table
  - Only admins can view audit logs
  - Any authenticated user can insert logs for their own actions
  
  ## Indexes
  - Index on admin_id for filtering by user
  - Index on action_type for filtering by action
  - Index on created_at for chronological queries
*/

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES profiles(id),
  action_type text NOT NULL,
  entity_type text,
  entity_id uuid,
  reason text,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can insert own audit logs"
  ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    admin_id = (select auth.uid())
  );

CREATE POLICY "Admins can view all audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
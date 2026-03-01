/*
  # Add Admin Features

  1. New Tables
    - `audit_logs` - Track all admin actions for accountability
      - `id` (uuid, primary key)
      - `admin_id` (uuid, references profiles)
      - `action_type` (text) - Type of action performed
      - `entity_type` (text) - Type of entity (teacher, quiz, subscription, etc.)
      - `entity_id` (text) - ID of affected entity
      - `reason` (text) - Reason for the action
      - `before_state` (jsonb, optional) - State before action
      - `after_state` (jsonb, optional) - State after action
      - `created_at` (timestamptz)
    
    - `sponsor_ads` - Sponsored content shown to students
      - `id` (uuid, primary key)
      - `sponsor_name` (text) - Internal name
      - `image_url` (text) - URL to sponsor image
      - `target_url` (text) - Where ad links to
      - `is_active` (boolean) - Whether ad is currently shown
      - `start_date` (date, optional)
      - `end_date` (date, optional)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `school_domains` - Approved school email domains for auto-premium
      - `id` (uuid, primary key)
      - `school_name` (text)
      - `email_domain` (text) - e.g., "schoolname.edu"
      - `plan_type` (text) - Type of plan granted
      - `is_active` (boolean)
      - `start_date` (date)
      - `end_date` (date, optional)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Only admins can access these tables
    - Audit logs are append-only (no updates/deletes)

  3. Indexes
    - Index on audit_logs for admin_id, entity_type, created_at
    - Index on sponsor_ads for is_active
    - Index on school_domains for email_domain
*/

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES profiles(id) NOT NULL,
  action_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  reason text NOT NULL,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can insert audit logs
CREATE POLICY "Admins can insert audit logs"
  ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can view audit logs
CREATE POLICY "Admins can view audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Create sponsor_ads table
CREATE TABLE IF NOT EXISTS sponsor_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_name text NOT NULL,
  image_url text NOT NULL,
  target_url text NOT NULL,
  is_active boolean DEFAULT false,
  start_date date,
  end_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sponsor_ads ENABLE ROW LEVEL SECURITY;

-- Admins can manage sponsor ads
CREATE POLICY "Admins can manage sponsor ads"
  ON sponsor_ads
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Anyone can view active sponsor ads
CREATE POLICY "Anyone can view active sponsor ads"
  ON sponsor_ads
  FOR SELECT
  TO authenticated, anon
  USING (is_active = true);

-- Create index for sponsor_ads
CREATE INDEX IF NOT EXISTS idx_sponsor_ads_active ON sponsor_ads(is_active) WHERE is_active = true;

-- Create school_domains table
CREATE TABLE IF NOT EXISTS school_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name text NOT NULL,
  email_domain text NOT NULL UNIQUE,
  plan_type text DEFAULT 'annual',
  is_active boolean DEFAULT true,
  start_date date NOT NULL,
  end_date date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE school_domains ENABLE ROW LEVEL SECURITY;

-- Admins can manage school domains
CREATE POLICY "Admins can manage school domains"
  ON school_domains
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create index for school_domains
CREATE INDEX IF NOT EXISTS idx_school_domains_email ON school_domains(email_domain) WHERE is_active = true;

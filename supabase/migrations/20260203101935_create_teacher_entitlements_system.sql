/*
  # Teacher Entitlements System - Single Source of Truth
  
  1. Purpose
    - Unified entitlement tracking for all teacher premium access
    - Replaces fragmented checks across multiple tables
    - Explicit audit trail for admin grants, Stripe subscriptions, and school licenses
  
  2. New Table: teacher_entitlements
    - `id` (uuid, primary key)
    - `teacher_user_id` (uuid, references auth.users)
    - `source` (enum: stripe, admin_grant, school_domain)
    - `status` (enum: active, revoked, expired)
    - `starts_at` (timestamptz, default now())
    - `expires_at` (timestamptz, nullable - null means no expiry)
    - `created_by_admin_id` (uuid, nullable, references auth.users)
    - `note` (text, nullable - admin notes)
    - `metadata` (jsonb, nullable - store stripe subscription_id, school_id, etc)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)
  
  3. Security
    - RLS enabled
    - Teachers can read their own entitlements
    - Only admins can insert/update/delete
  
  4. Indexes
    - Index on teacher_user_id for fast lookups
    - Index on status for filtering active entitlements
    - Composite index on (teacher_user_id, status, expires_at) for entitlement checks
  
  5. Functions
    - check_teacher_entitlement(user_id) - returns boolean if teacher has valid entitlement
    - expire_old_entitlements() - marks expired entitlements as 'expired'
*/

-- Create enum types
DO $$ BEGIN
  CREATE TYPE entitlement_source AS ENUM ('stripe', 'admin_grant', 'school_domain');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE entitlement_status AS ENUM ('active', 'revoked', 'expired');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create teacher_entitlements table
CREATE TABLE IF NOT EXISTS teacher_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source entitlement_source NOT NULL,
  status entitlement_status NOT NULL DEFAULT 'active',
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_by_admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_teacher_entitlements_user_id 
  ON teacher_entitlements(teacher_user_id);

CREATE INDEX IF NOT EXISTS idx_teacher_entitlements_status 
  ON teacher_entitlements(status);

CREATE INDEX IF NOT EXISTS idx_teacher_entitlements_lookup 
  ON teacher_entitlements(teacher_user_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_teacher_entitlements_expires_at 
  ON teacher_entitlements(expires_at) WHERE expires_at IS NOT NULL;

-- Enable RLS
ALTER TABLE teacher_entitlements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Teachers can view own entitlements"
  ON teacher_entitlements
  FOR SELECT
  TO authenticated
  USING (auth.uid() = teacher_user_id);

CREATE POLICY "Admins can view all entitlements"
  ON teacher_entitlements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND is_active = true
    )
  );

CREATE POLICY "Admins can insert entitlements"
  ON teacher_entitlements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND is_active = true
    )
  );

CREATE POLICY "Admins can update entitlements"
  ON teacher_entitlements
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND is_active = true
    )
  );

-- Function to check if teacher has valid entitlement
CREATE OR REPLACE FUNCTION check_teacher_entitlement(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  has_valid_entitlement boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM teacher_entitlements
    WHERE teacher_user_id = user_id
      AND status = 'active'
      AND starts_at <= now()
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO has_valid_entitlement;
  
  RETURN has_valid_entitlement;
END;
$$;

-- Function to expire old entitlements (run periodically)
CREATE OR REPLACE FUNCTION expire_old_entitlements()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE teacher_entitlements
  SET status = 'expired',
      updated_at = now()
  WHERE status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at <= now();
END;
$$;

-- Function to get active entitlement for a teacher
CREATE OR REPLACE FUNCTION get_active_entitlement(user_id uuid)
RETURNS TABLE (
  source entitlement_source,
  expires_at timestamptz,
  metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    te.source,
    te.expires_at,
    te.metadata
  FROM teacher_entitlements te
  WHERE te.teacher_user_id = user_id
    AND te.status = 'active'
    AND te.starts_at <= now()
    AND (te.expires_at IS NULL OR te.expires_at > now())
  ORDER BY 
    CASE te.source
      WHEN 'stripe' THEN 1
      WHEN 'admin_grant' THEN 2
      WHEN 'school_domain' THEN 3
    END
  LIMIT 1;
END;
$$;

-- Migrate existing data from teacher_premium_overrides
INSERT INTO teacher_entitlements (
  teacher_user_id,
  source,
  status,
  expires_at,
  note,
  created_at,
  updated_at
)
SELECT 
  teacher_id,
  'admin_grant'::entitlement_source,
  CASE 
    WHEN is_active = true AND (expires_at IS NULL OR expires_at > now()) THEN 'active'::entitlement_status
    WHEN is_active = false THEN 'revoked'::entitlement_status
    ELSE 'expired'::entitlement_status
  END,
  expires_at,
  'Migrated from teacher_premium_overrides',
  created_at,
  updated_at
FROM teacher_premium_overrides
WHERE NOT EXISTS (
  SELECT 1 FROM teacher_entitlements te
  WHERE te.teacher_user_id = teacher_premium_overrides.teacher_id
  AND te.source = 'admin_grant'
);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_teacher_entitlements_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_teacher_entitlements_updated_at ON teacher_entitlements;
CREATE TRIGGER trigger_update_teacher_entitlements_updated_at
  BEFORE UPDATE ON teacher_entitlements
  FOR EACH ROW
  EXECUTE FUNCTION update_teacher_entitlements_updated_at();
/*
  # Create Admin User and Required Tables for Admin Dashboard

  ## Overview
  Sets up the complete admin infrastructure including admin user, sponsored ads,
  schools management, and enhanced audit logging.

  ## Changes

  ### 1. Create Admin User
  - Email: lesliekweku.addae@gmail.com
  - Role: admin
  - Created via security definer function (not via public signup)
  - Must set password via reset link

  ### 2. Sponsored Ads Table
  - For homepage banner ads
  - Admin-controlled start/end dates
  - Active status flag

  ### 3. Schools Table
  - School name and email domains
  - Auto-upgrade rules for teachers
  - Seat limits

  ### 4. Enhanced Audit Logs
  - Tracks all admin actions
  - Immutable log entries
  - Searchable and filterable

  ## Security
  - Admin user creation via security definer function only
  - RLS enabled on all tables
  - Admins have full access via JWT check
  - Regular users cannot access admin tables
*/

-- 1. Create sponsored_ads table
CREATE TABLE IF NOT EXISTS sponsored_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  image_url text NOT NULL,
  destination_url text NOT NULL,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  placement text DEFAULT 'homepage-top',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on sponsored_ads
ALTER TABLE sponsored_ads ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view active ads within date range
CREATE POLICY "Anyone can view active sponsored ads"
  ON sponsored_ads FOR SELECT
  TO public
  USING (
    is_active = true 
    AND start_date <= now() 
    AND end_date >= now()
  );

-- Policy: Admins can manage all ads
CREATE POLICY "Admins can manage sponsored ads"
  ON sponsored_ads FOR ALL
  TO authenticated
  USING ((auth.jwt()->>'role')::text = 'admin')
  WITH CHECK ((auth.jwt()->>'role')::text = 'admin');

-- Index for active ads query
CREATE INDEX IF NOT EXISTS idx_sponsored_ads_active 
  ON sponsored_ads(is_active, start_date, end_date) 
  WHERE is_active = true;

-- 2. Create schools table
CREATE TABLE IF NOT EXISTS schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name text NOT NULL,
  email_domains text[] NOT NULL,
  default_plan text DEFAULT 'standard',
  seat_limit integer,
  auto_approve_teachers boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_default_plan CHECK (default_plan IN ('standard', 'premium'))
);

-- Enable RLS on schools
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can manage schools
CREATE POLICY "Admins can manage schools"
  ON schools FOR ALL
  TO authenticated
  USING ((auth.jwt()->>'role')::text = 'admin')
  WITH CHECK ((auth.jwt()->>'role')::text = 'admin');

-- Policy: Teachers can view their school
CREATE POLICY "Teachers can view own school"
  ON schools FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.school_id = schools.id
    )
  );

-- Index for domain lookups
CREATE INDEX IF NOT EXISTS idx_schools_email_domains 
  ON schools USING GIN(email_domains);

-- 3. Add school_id to profiles (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'school_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN school_id uuid REFERENCES schools(id);
  END IF;
END $$;

-- Index for school lookups
CREATE INDEX IF NOT EXISTS idx_profiles_school_id 
  ON profiles(school_id) 
  WHERE school_id IS NOT NULL;

-- 4. Enhance audit_logs table
DO $$
BEGIN
  -- Add columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = 'actor_admin_id'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN actor_admin_id uuid REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = 'action_type'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN action_type text NOT NULL DEFAULT 'unknown';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = 'target_entity_type'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN target_entity_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = 'target_entity_id'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN target_entity_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Index for audit log searches
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor 
  ON audit_logs(actor_admin_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type 
  ON audit_logs(action_type);

CREATE INDEX IF NOT EXISTS idx_audit_logs_target 
  ON audit_logs(target_entity_type, target_entity_id);

-- Policy: Admins can view all audit logs
DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_logs;
CREATE POLICY "Admins can view all audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'role')::text = 'admin');

-- 5. Create security definer function to create admin user
CREATE OR REPLACE FUNCTION create_admin_user(admin_email text)
RETURNS void AS $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Check if admin already exists
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = admin_email;

  IF admin_user_id IS NOT NULL THEN
    -- Admin already exists, just ensure profile exists with admin role
    INSERT INTO profiles (id, email, role, created_at, updated_at)
    VALUES (admin_user_id, admin_email, 'admin', now(), now())
    ON CONFLICT (id) DO UPDATE
    SET role = 'admin', updated_at = now();
    
    RAISE NOTICE 'Admin user profile updated for: %', admin_email;
  ELSE
    RAISE NOTICE 'Admin user does not exist in auth.users. Please create via Supabase dashboard or service role.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Helper function to check if email is admin allowlisted
CREATE OR REPLACE FUNCTION is_admin_email(email text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.email = is_admin_email.email
    AND profiles.role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create function to log admin actions
CREATE OR REPLACE FUNCTION log_admin_action(
  p_actor_admin_id uuid,
  p_action_type text,
  p_target_entity_type text,
  p_target_entity_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void AS $$
BEGIN
  INSERT INTO audit_logs (
    actor_admin_id,
    action_type,
    target_entity_type,
    target_entity_id,
    metadata,
    created_at
  ) VALUES (
    p_actor_admin_id,
    p_action_type,
    p_target_entity_type,
    p_target_entity_id,
    p_metadata,
    now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Add updated_at trigger to new tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_sponsored_ads_updated_at ON sponsored_ads;
CREATE TRIGGER update_sponsored_ads_updated_at
  BEFORE UPDATE ON sponsored_ads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_schools_updated_at ON schools;
CREATE TRIGGER update_schools_updated_at
  BEFORE UPDATE ON schools
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 9. Create or update admin profile if user exists in auth.users
-- Note: This will only work if the user already exists in auth.users
-- Admin must be created manually via Supabase dashboard first time
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Try to find the admin user
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = 'lesliekweku.addae@gmail.com';

  IF admin_user_id IS NOT NULL THEN
    -- Create or update profile
    INSERT INTO profiles (id, email, role, created_at, updated_at)
    VALUES (admin_user_id, 'lesliekweku.addae@gmail.com', 'admin', now(), now())
    ON CONFLICT (id) DO UPDATE
    SET role = 'admin', 
        email = 'lesliekweku.addae@gmail.com',
        updated_at = now();
    
    RAISE NOTICE 'Admin profile created/updated for lesliekweku.addae@gmail.com';
  ELSE
    RAISE NOTICE 'Admin user not found in auth.users. Create manually via Supabase dashboard first.';
  END IF;
END $$;

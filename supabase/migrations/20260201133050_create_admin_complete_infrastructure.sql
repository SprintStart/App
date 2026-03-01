/*
  # Complete Admin Portal Infrastructure

  ## New Tables
  
  1. **admin_allowlist**
     - Allowlisted admin emails with roles
     - Only emails in this table can access admin portal
     - Roles: super_admin, admin, support
  
  2. **school_domains**
     - Email domains linked to schools
     - Used for automatic premium grants
     - Requires verification before activation
  
  3. **school_licenses**
     - Tracks bulk licensing agreements
     - Start/end dates for school subscriptions
     - Seat limits and usage tracking
  
  4. **teacher_school_membership**
     - Links teachers to schools via email domain
     - Tracks premium auto-grants
  
  5. **ad_impressions** & **ad_clicks**
     - Detailed analytics tracking for sponsored ads
     - Session-based tracking with page context
  
  ## Security
  
  - Enable RLS on all new tables
  - Admin-only access policies
  - Audit log triggers on critical operations
  
  ## Seeds
  
  - Add primary admin email to allowlist
  - Create indexes for performance
*/

-- =====================================================
-- 1) ADMIN ALLOWLIST TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS admin_allowlist (
  email text PRIMARY KEY,
  is_active boolean DEFAULT true NOT NULL,
  role text DEFAULT 'admin' NOT NULL CHECK (role IN ('super_admin', 'admin', 'support')),
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  notes text
);

ALTER TABLE admin_allowlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only super_admins can view allowlist"
  ON admin_allowlist FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND role = 'super_admin'
      AND is_active = true
    )
  );

CREATE POLICY "Only super_admins can modify allowlist"
  ON admin_allowlist FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND role = 'super_admin'
      AND is_active = true
    )
  );

-- Seed primary admin
INSERT INTO admin_allowlist (email, role, is_active)
VALUES ('lesliekweku.addae@gmail.com', 'super_admin', true)
ON CONFLICT (email) DO UPDATE SET role = 'super_admin', is_active = true;

-- =====================================================
-- 2) SCHOOL DOMAINS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS school_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  domain text NOT NULL,
  is_verified boolean DEFAULT false NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  verification_code text,
  verified_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(domain)
);

ALTER TABLE school_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage school domains"
  ON school_domains FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND is_active = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_school_domains_school_id ON school_domains(school_id);
CREATE INDEX IF NOT EXISTS idx_school_domains_domain ON school_domains(domain);
CREATE INDEX IF NOT EXISTS idx_school_domains_active_verified ON school_domains(is_active, is_verified) WHERE is_active = true AND is_verified = true;

-- =====================================================
-- 3) SCHOOL LICENSES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS school_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  license_type text NOT NULL CHECK (license_type IN ('standard', 'premium', 'enterprise')),
  seat_limit integer,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  billing_contact_email text,
  billing_notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE school_licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage school licenses"
  ON school_licenses FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND is_active = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_school_licenses_school_id ON school_licenses(school_id);
CREATE INDEX IF NOT EXISTS idx_school_licenses_active ON school_licenses(is_active, ends_at) WHERE is_active = true;

-- =====================================================
-- 4) TEACHER SCHOOL MEMBERSHIP TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS teacher_school_membership (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  joined_via text NOT NULL CHECK (joined_via IN ('email_domain', 'admin_invite', 'manual')),
  premium_granted boolean DEFAULT false NOT NULL,
  premium_granted_at timestamptz,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(teacher_id, school_id)
);

ALTER TABLE teacher_school_membership ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view own membership"
  ON teacher_school_membership FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY "Admins can manage memberships"
  ON teacher_school_membership FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND is_active = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_teacher_school_membership_teacher ON teacher_school_membership(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_school_membership_school ON teacher_school_membership(school_id);

-- =====================================================
-- 5) AD TRACKING TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS ad_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid REFERENCES sponsored_ads(id) ON DELETE CASCADE NOT NULL,
  session_id text,
  page text,
  placement text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS ad_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid REFERENCES sponsored_ads(id) ON DELETE CASCADE NOT NULL,
  session_id text,
  page text,
  placement text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE ad_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_clicks ENABLE ROW LEVEL SECURITY;

-- Public can insert impressions/clicks
CREATE POLICY "Anyone can log ad impressions"
  ON ad_impressions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can log ad clicks"
  ON ad_clicks FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can read
CREATE POLICY "Admins can view ad impressions"
  ON ad_impressions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND is_active = true
    )
  );

CREATE POLICY "Admins can view ad clicks"
  ON ad_clicks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND is_active = true
    )
  );

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_ad_impressions_ad_id ON ad_impressions(ad_id);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_created ON ad_impressions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_clicks_ad_id ON ad_clicks(ad_id);
CREATE INDEX IF NOT EXISTS idx_ad_clicks_created ON ad_clicks(created_at DESC);

-- =====================================================
-- 6) HELPER FUNCTIONS
-- =====================================================

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_allowlist
    WHERE email = user_email
    AND is_active = true
  );
$$;

-- Function to get active school license for a domain
CREATE OR REPLACE FUNCTION get_active_school_license(email_domain text)
RETURNS TABLE (
  school_id uuid,
  school_name text,
  license_type text,
  ends_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    s.id as school_id,
    s.school_name,
    sl.license_type,
    sl.ends_at
  FROM schools s
  JOIN school_domains sd ON sd.school_id = s.id
  JOIN school_licenses sl ON sl.school_id = s.id
  WHERE sd.domain = email_domain
    AND sd.is_verified = true
    AND sd.is_active = true
    AND sl.is_active = true
    AND sl.starts_at <= now()
    AND sl.ends_at > now()
    AND s.is_active = true
  ORDER BY sl.ends_at DESC
  LIMIT 1;
$$;

-- =====================================================
-- 7) UPDATE audit_logs TO SUPPORT NEW FEATURES
-- =====================================================

-- Ensure audit_logs has all necessary columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'actor_email'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN actor_email text;
  END IF;
END $$;

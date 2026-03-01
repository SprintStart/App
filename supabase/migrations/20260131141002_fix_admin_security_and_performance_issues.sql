/*
  # Fix Admin System Security and Performance Issues

  ## Overview
  Addresses security warnings and performance optimizations for the admin system.

  ## Changes

  ### 1. Add Missing Foreign Key Indexes
  - Index on schools.created_by
  - Index on sponsored_ads.created_by

  ### 2. Fix RLS Performance Issues
  - Replace `auth.uid()` with `(select auth.uid())` in all policies
  - Prevents re-evaluation for each row (critical for scale)

  ### 3. Remove Duplicate/Overlapping Policies
  - Consolidate profiles INSERT policies
  - Keep only necessary SELECT policies for schools/sponsored_ads

  ### 4. Fix Function Search Paths
  - Add `SET search_path = public` to all SECURITY DEFINER functions
  - Prevents search path manipulation attacks

  ### 5. Drop Unused Indexes
  - Remove indexes that are truly redundant
  - Keep indexes that will be used as features are built

  ## Security
  - All RLS policies optimized for performance
  - Functions protected against search path attacks
  - Foreign keys properly indexed
*/

-- ============================================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_schools_created_by 
  ON schools(created_by);

CREATE INDEX IF NOT EXISTS idx_sponsored_ads_created_by 
  ON sponsored_ads(created_by);

-- ============================================================================
-- 2. FIX RLS POLICIES - REPLACE auth.uid() WITH (select auth.uid())
-- ============================================================================

-- PROFILES TABLE
-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can create own profile" ON profiles;

-- Recreate with optimized auth check
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = (select auth.uid()));

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = (select auth.uid()));

-- SCHOOLS TABLE
-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage schools" ON schools;
DROP POLICY IF EXISTS "Teachers can view own school" ON schools;

-- Recreate with optimized auth check
CREATE POLICY "Admins can manage schools"
  ON schools FOR ALL
  TO authenticated
  USING (((select auth.jwt())->>'role')::text = 'admin')
  WITH CHECK (((select auth.jwt())->>'role')::text = 'admin');

CREATE POLICY "Teachers can view own school"
  ON schools FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.school_id = schools.id
    )
  );

-- AUDIT_LOGS TABLE
-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_logs;

-- Recreate with optimized auth check
CREATE POLICY "Admins can view all audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (((select auth.jwt())->>'role')::text = 'admin');

-- SPONSORED_ADS TABLE
-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage sponsored ads" ON sponsored_ads;
DROP POLICY IF EXISTS "Anyone can view active sponsored ads" ON sponsored_ads;

-- Recreate with optimized auth check
CREATE POLICY "Admins can manage sponsored ads"
  ON sponsored_ads FOR ALL
  TO authenticated
  USING (((select auth.jwt())->>'role')::text = 'admin')
  WITH CHECK (((select auth.jwt())->>'role')::text = 'admin');

-- Public can view active ads (no auth check needed)
CREATE POLICY "Anyone can view active sponsored ads"
  ON sponsored_ads FOR SELECT
  TO public
  USING (
    is_active = true 
    AND start_date <= now() 
    AND end_date >= now()
  );

-- ============================================================================
-- 3. FIX FUNCTION SEARCH PATHS
-- ============================================================================

-- Recreate create_admin_user with secure search_path
CREATE OR REPLACE FUNCTION create_admin_user(admin_email text)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_user_id uuid;
BEGIN
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = admin_email;

  IF admin_user_id IS NOT NULL THEN
    INSERT INTO profiles (id, email, role, created_at, updated_at)
    VALUES (admin_user_id, admin_email, 'admin', now(), now())
    ON CONFLICT (id) DO UPDATE
    SET role = 'admin', updated_at = now();
    
    RAISE NOTICE 'Admin user profile updated for: %', admin_email;
  ELSE
    RAISE NOTICE 'Admin user does not exist in auth.users. Please create via Supabase dashboard or service role.';
  END IF;
END;
$$;

-- Recreate is_admin_email with secure search_path
CREATE OR REPLACE FUNCTION is_admin_email(email text)
RETURNS boolean 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.email = is_admin_email.email
    AND profiles.role = 'admin'
  );
END;
$$;

-- Recreate log_admin_action with secure search_path
CREATE OR REPLACE FUNCTION log_admin_action(
  p_actor_admin_id uuid,
  p_action_type text,
  p_target_entity_type text,
  p_target_entity_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Recreate update_updated_at_column with secure search_path
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 4. DROP TRULY UNUSED INDEXES
-- ============================================================================

-- Keep audit log indexes - they'll be used when audit UI is built
-- Keep sponsored ads index - will be used when ads UI is built
-- Keep schools indexes - will be used when schools UI is built
-- Drop only the duplicate admin_id index (we have actor_admin_id instead)

DROP INDEX IF EXISTS idx_audit_logs_admin_id;

-- Keep idx_audit_logs_actor (correct column name)
-- Keep idx_audit_logs_action_type (for filtering)
-- Keep idx_audit_logs_created_at (for time-based queries)
-- Keep idx_audit_logs_target (for entity lookups)
-- Keep idx_sponsored_ads_active (for public homepage query)
-- Keep idx_schools_email_domains (for domain lookups)
-- Keep idx_profiles_school_id (for school member queries)

-- ============================================================================
-- 5. ADD PERFORMANCE NOTES TO PROFILES
-- ============================================================================

-- Add comment explaining the RLS optimization
COMMENT ON POLICY "Users can read own profile" ON profiles IS 
  'Optimized with (select auth.uid()) to prevent per-row re-evaluation';

COMMENT ON POLICY "Users can update own profile" ON profiles IS 
  'Optimized with (select auth.uid()) to prevent per-row re-evaluation';

COMMENT ON POLICY "Users can insert own profile" ON profiles IS 
  'Optimized with (select auth.uid()) to prevent per-row re-evaluation';

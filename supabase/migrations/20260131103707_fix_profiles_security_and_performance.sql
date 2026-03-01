/*
  # Fix Profiles Table Security and Performance Issues

  ## Overview
  Addresses critical security and performance issues for the profiles table.

  ## Changes
  
  ### 1. RLS Performance Optimization
  - Replace `auth.uid()` with `(select auth.uid())` in all policies
  - Prevents function re-evaluation for each row
  - Significantly improves query performance at scale
  
  ### 2. Remove Unused Indexes
  - Drop `idx_profiles_email_lower` (unused index)
  - Reduces database overhead
  
  ### 3. Consolidate Permissive Policies
  - Combine multiple SELECT policies into single policy
  - Simplifies policy management
  - Improves query planner efficiency
  
  ### 4. Fix Function Search Path Security
  - Add explicit search_path to functions
  - Prevents search path injection attacks
  - Ensures functions execute in secure context
  
  ## Security Impact
  - Improved RLS performance (no repeated auth function calls)
  - Reduced attack surface (search path security)
  - Cleaner policy structure (easier to audit)
  
  ## Note on Password Protection
  - Leaked password protection should be enabled via Supabase Dashboard
  - Navigate to: Authentication > Policies > Enable "Leaked Password Protection"
  - This prevents users from using compromised passwords from HaveIBeenPwned.org
*/

-- 1. Drop existing policies that will be recreated
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- 2. Create optimized policies with (select auth.uid())
-- Consolidate SELECT policies into one with OR condition
CREATE POLICY "Users can view own profile or admins can view all"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) = id 
    OR 
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid())
      AND p.role = 'admin'
    )
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- 3. Remove unused index
DROP INDEX IF EXISTS idx_profiles_email_lower;

-- 4. Fix function search path security
CREATE OR REPLACE FUNCTION normalize_email(email text)
RETURNS text AS $$
BEGIN
  IF email IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN lower(trim(email));
END;
$$ LANGUAGE plpgsql IMMUTABLE
SET search_path = '';

CREATE OR REPLACE FUNCTION sync_profile_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Update profile email when auth.users email is set
  IF NEW.email IS NOT NULL THEN
    UPDATE profiles 
    SET email = NEW.email,
        updated_at = now()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';
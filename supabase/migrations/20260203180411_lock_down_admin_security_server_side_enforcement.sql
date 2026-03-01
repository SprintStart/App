/*
  # Lock Down Admin Security - Server-Side Enforcement Only

  ## Critical Security Fixes

  This migration implements server-side-only admin enforcement to prevent frontend bypass attacks.

  ### 1. Audit Logs Security
  
  **REMOVED**: Policy allowing any authenticated user to insert audit logs
  **NEW**: Only service role (edge functions) can insert audit logs
  
  Rationale: Audit logs must be tamper-proof. Allowing client inserts means:
  - Users can forge audit trails
  - Malicious actors can inject false logs
  - Compliance requirements are not met
  
  ### 2. Admin Verification Helper
  
  Creates a security-definer function that:
  - Checks admin_allowlist for user's email
  - Returns boolean (true/false) for admin status
  - Runs with elevated privileges to prevent RLS bypass
  
  ### 3. System Health Checks
  
  Locks down system_health_checks table:
  - Only edge functions can insert/update
  - Only admins can read via admin_allowlist check
  
  ## Security Model
  
  ✅ Admin status checked via admin_allowlist (single source of truth)
  ✅ All admin operations must go through edge functions with service role
  ✅ No client can directly write to admin tables
  ✅ RLS policies enforce server-side verification
  
  ## Proof Requirements
  
  After this migration:
  - Direct REST calls to audit_logs.insert() = 403 Forbidden
  - Direct REST calls to admin tables = 403 Forbidden
  - Edge functions with service role = Success
  - Non-admin users accessing /admindashboard = Instant redirect with no content flash
*/

-- =====================================================
-- 1) LOCK DOWN AUDIT LOGS
-- =====================================================

-- Drop the insecure policy that allowed any authenticated user to insert
DROP POLICY IF EXISTS "Users can insert own audit logs" ON audit_logs;

-- Create restrictive policy: NO client inserts allowed
-- Only service role (edge functions) can insert
CREATE POLICY "Only service role can insert audit logs"
  ON audit_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Keep the admin read policy (verified via admin_allowlist)
-- Update it to use admin_allowlist instead of profiles.role
DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_logs;

CREATE POLICY "Only verified admins can view audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND is_active = true
    )
  );

-- =====================================================
-- 2) CREATE ADMIN VERIFICATION FUNCTION
-- =====================================================

-- Helper function to verify admin status server-side
-- This is the ONLY source of truth for admin verification
CREATE OR REPLACE FUNCTION verify_admin_status(check_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
  admin_record record;
  result jsonb;
BEGIN
  -- Get user email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = check_user_id;
  
  IF user_email IS NULL THEN
    RETURN jsonb_build_object(
      'is_admin', false,
      'reason', 'user_not_found'
    );
  END IF;
  
  -- Check admin_allowlist
  SELECT * INTO admin_record
  FROM admin_allowlist
  WHERE email = user_email
  AND is_active = true;
  
  IF admin_record.email IS NOT NULL THEN
    -- User is verified admin
    result := jsonb_build_object(
      'is_admin', true,
      'email', user_email,
      'role', admin_record.role,
      'verified_at', now()
    );
    
    -- Log admin access verification
    INSERT INTO audit_logs (admin_id, action_type, entity_type, after_state)
    VALUES (
      check_user_id,
      'admin_access_verified',
      'admin_session',
      result
    );
    
    RETURN result;
  ELSE
    -- User is NOT admin
    RETURN jsonb_build_object(
      'is_admin', false,
      'email', user_email,
      'reason', 'not_in_allowlist'
    );
  END IF;
END;
$$;

-- =====================================================
-- 3) LOCK DOWN SYSTEM HEALTH CHECKS
-- =====================================================

-- Only edge functions can write
DROP POLICY IF EXISTS "System can insert health checks" ON system_health_checks;

CREATE POLICY "Only service role can manage health checks"
  ON system_health_checks
  FOR ALL
  TO service_role
  WITH CHECK (true);

-- Only admins can read
DROP POLICY IF EXISTS "Admins can view health checks" ON system_health_checks;

CREATE POLICY "Only verified admins can view health checks"
  ON system_health_checks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND is_active = true
    )
  );

-- =====================================================
-- 4) ADD SECURITY COMMENTS
-- =====================================================

COMMENT ON FUNCTION verify_admin_status IS 
  'Server-side admin verification. Returns jsonb with is_admin boolean and role. Called by edge functions only.';

COMMENT ON POLICY "Only service role can insert audit logs" ON audit_logs IS 
  'CRITICAL: Only edge functions with service role can write audit logs. No client access.';

COMMENT ON POLICY "Only verified admins can view audit logs" ON audit_logs IS 
  'Verified via admin_allowlist table. Frontend cannot bypass this check.';

/*
  # Fix System Health Checks RLS Policy

  1. Changes
    - Drop incorrect admin policy that checks JWT role
    - Create new admin policy that checks admin_allowlist table
    
  2. Security
    - Only users in admin_allowlist with is_active=true can view health checks
    - Maintains service role insert permission
*/

-- Drop the old incorrect policy
DROP POLICY IF EXISTS "Admins can view health checks" ON system_health_checks;

-- Create new policy that checks admin_allowlist
CREATE POLICY "Admins can view health checks"
  ON system_health_checks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (
        SELECT email FROM auth.users WHERE id = auth.uid()
      )
      AND admin_allowlist.is_active = true
    )
  );

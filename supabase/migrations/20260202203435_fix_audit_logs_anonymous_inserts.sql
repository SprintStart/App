/*
  # Fix Audit Logs for Anonymous Failed Login Attempts
  
  1. Problem
    - Failed login attempts need to be logged even for unauthenticated users
    - Current INSERT policy requires admin_id = auth.uid()
    - This prevents logging of failed login attempts
  
  2. Solution
    - Add a separate policy for anonymous users to insert failed login attempts
    - Keep the authenticated user policy for other audit log types
  
  3. Security
    - Anonymous users can only insert logs with action_type = 'failed_admin_login'
    - Authenticated users can still insert their own audit logs
    - All audit logs are immutable (no UPDATE or DELETE policies)
*/

-- Allow anonymous failed login attempt logging
CREATE POLICY "Anonymous users can log failed login attempts"
  ON audit_logs
  FOR INSERT
  TO anon
  WITH CHECK (
    action_type = 'failed_admin_login'
    AND target_entity_type = 'auth'
  );

-- Also update the authenticated insert policy to allow NULL admin_id for failed attempts
DROP POLICY IF EXISTS "Users can insert own audit logs" ON audit_logs;
CREATE POLICY "Users can insert own audit logs"
  ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    admin_id = (SELECT auth.uid())
    OR (action_type = 'failed_admin_login' AND admin_id IS NULL)
  );

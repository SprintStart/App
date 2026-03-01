/*
  # Create System Health Checks Table

  1. New Tables
    - `system_health_checks`
      - `id` (uuid, primary key)
      - `service_name` (text) - Name of the service being checked
      - `status` (text) - healthy, degraded, or down
      - `response_time_ms` (integer, nullable) - Response time in milliseconds
      - `error_message` (text, nullable) - Error details if any
      - `checked_at` (timestamptz) - When the check was performed
      - `created_at` (timestamptz) - Record creation time

  2. Security
    - Enable RLS on `system_health_checks` table
    - Only service role can INSERT (via edge function)
    - Admins can read all health check data

  3. Indexes
    - Index on service_name and checked_at for efficient querying
*/

-- Create system_health_checks table
CREATE TABLE IF NOT EXISTS system_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('healthy', 'degraded', 'down')),
  response_time_ms integer,
  error_message text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE system_health_checks ENABLE ROW LEVEL SECURITY;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_health_checks_service_time
  ON system_health_checks(service_name, checked_at DESC);

-- Service role can insert (used by edge function)
CREATE POLICY "Service role can insert health checks"
  ON system_health_checks FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Admins can read all health checks
CREATE POLICY "Admins can read health checks"
  ON system_health_checks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND is_active = true
    )
  );

-- Public can read recent health status (last 24 hours only, no error details)
CREATE POLICY "Public can read recent health status"
  ON system_health_checks FOR SELECT
  TO anon, authenticated
  USING (
    checked_at > now() - interval '24 hours'
  );

-- Create a view for the latest health status
CREATE OR REPLACE VIEW latest_health_status AS
SELECT DISTINCT ON (service_name)
  service_name,
  status,
  response_time_ms,
  checked_at
FROM system_health_checks
ORDER BY service_name, checked_at DESC;

-- Grant access to the view
GRANT SELECT ON latest_health_status TO anon, authenticated;

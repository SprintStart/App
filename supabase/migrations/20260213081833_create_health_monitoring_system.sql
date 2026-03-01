/*
  # Create Health Monitoring System

  ## Purpose
  Phase-1 monitoring and alerting system to track critical paths:
  - /explore loads
  - /northampton-college loads
  - /subjects/business loads
  - /quiz/<id> loads
  - Quiz start API works

  ## Tables Created
  
  1. health_checks
     - Stores each health check execution result
     - Tracks status, HTTP codes, errors, timing
  
  2. health_alerts
     - Stores alert history
     - Tracks when alerts were sent and to whom

  ## Security
  - Only admins can read health checks and alerts
  - System functions can insert via service role
*/

-- Health checks table
CREATE TABLE IF NOT EXISTS health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  target text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'failure', 'warning')),
  http_status integer,
  error_message text,
  response_time_ms integer,
  marker_found boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Health alerts table
CREATE TABLE IF NOT EXISTS health_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_name text NOT NULL,
  alert_type text NOT NULL CHECK (alert_type IN ('consecutive_failure', 'error_threshold', 'manual')),
  failure_count integer DEFAULT 0,
  error_details jsonb,
  recipients text[] NOT NULL,
  sent_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_health_checks_name_created 
  ON health_checks(name, created_at DESC);
  
CREATE INDEX IF NOT EXISTS idx_health_checks_status_created 
  ON health_checks(status, created_at DESC);
  
CREATE INDEX IF NOT EXISTS idx_health_alerts_check_name 
  ON health_alerts(check_name, created_at DESC);
  
CREATE INDEX IF NOT EXISTS idx_health_alerts_resolved 
  ON health_alerts(resolved_at) 
  WHERE resolved_at IS NULL;

-- Enable RLS
ALTER TABLE health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only admins can view health checks
CREATE POLICY "Admins can view health checks"
  ON health_checks
  FOR SELECT
  TO authenticated
  USING (current_user_is_admin());

CREATE POLICY "Admins can view health alerts"
  ON health_alerts
  FOR SELECT
  TO authenticated
  USING (current_user_is_admin());

-- Function to get latest health check status for each check
CREATE OR REPLACE FUNCTION get_latest_health_status()
RETURNS TABLE (
  check_name text,
  last_run timestamptz,
  last_success timestamptz,
  last_error text,
  status text,
  http_status integer,
  response_time_ms integer
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH latest_checks AS (
    SELECT DISTINCT ON (hc.name)
      hc.name,
      hc.created_at as last_run,
      hc.status,
      hc.http_status,
      hc.response_time_ms,
      hc.error_message
    FROM health_checks hc
    ORDER BY hc.name, hc.created_at DESC
  ),
  last_success AS (
    SELECT DISTINCT ON (hc.name)
      hc.name,
      hc.created_at as success_time
    FROM health_checks hc
    WHERE hc.status = 'success'
    ORDER BY hc.name, hc.created_at DESC
  )
  SELECT 
    lc.name,
    lc.last_run,
    ls.success_time,
    lc.error_message,
    lc.status,
    lc.http_status,
    lc.response_time_ms
  FROM latest_checks lc
  LEFT JOIN last_success ls ON ls.name = lc.name;
END;
$$;

-- Function to check for consecutive failures
CREATE OR REPLACE FUNCTION check_consecutive_failures(
  p_check_name text,
  p_threshold integer DEFAULT 2
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_consecutive_failures integer;
BEGIN
  -- Count consecutive failures from most recent checks
  SELECT COUNT(*)
  INTO v_consecutive_failures
  FROM (
    SELECT status
    FROM health_checks
    WHERE name = p_check_name
    ORDER BY created_at DESC
    LIMIT p_threshold
  ) recent
  WHERE status = 'failure';
  
  RETURN v_consecutive_failures >= p_threshold;
END;
$$;

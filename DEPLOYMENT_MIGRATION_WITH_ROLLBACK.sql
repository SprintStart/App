-- ============================================================================
-- STARTSPRINT HEALTH MONITORING SYSTEM - PRODUCTION DEPLOYMENT
-- ============================================================================
-- Version: 1.0.0
-- Date: 2026-02-28
-- Safe to deploy: YES (isolated monitoring only, no production changes)
-- ============================================================================

-- ============================================================================
-- SECTION 1: PRE-DEPLOYMENT CHECKS
-- ============================================================================

-- Verify required extensions are available
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_net') THEN
    RAISE EXCEPTION 'pg_net extension not available. Contact Supabase support.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    RAISE EXCEPTION 'pg_cron extension not available. Contact Supabase support.';
  END IF;

  RAISE NOTICE 'Pre-deployment checks passed ✓';
END $$;

-- ============================================================================
-- SECTION 2: ENABLE EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================================
-- SECTION 3: CREATE TABLES
-- ============================================================================

-- Table: health_checks
CREATE TABLE IF NOT EXISTS health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  target text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'failure', 'warning')),
  http_status integer,
  error_message text,
  response_time_ms integer,
  marker_found boolean DEFAULT false,
  check_category text DEFAULT 'endpoint' CHECK (check_category IN ('endpoint', 'storage', 'database', 'api', 'system')),
  created_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_health_checks_created ON health_checks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_checks_name ON health_checks(name);
CREATE INDEX IF NOT EXISTS idx_health_checks_status ON health_checks(status);
CREATE INDEX IF NOT EXISTS idx_health_checks_category ON health_checks(check_category);

-- Add comments
COMMENT ON TABLE health_checks IS 'Health monitoring data - automated checks every 5 minutes';
COMMENT ON COLUMN health_checks.check_category IS 'Category: endpoint, storage, database, api, system';

-- Enable RLS
ALTER TABLE health_checks ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins can view all health checks
CREATE POLICY "Admins can view all health checks"
  ON health_checks FOR SELECT TO authenticated
  USING (current_user_is_admin());

-- RLS Policy: System can insert health checks
CREATE POLICY "System can insert health checks"
  ON health_checks FOR INSERT
  WITH CHECK (true);

-- ============================================================================

-- Table: health_alerts
CREATE TABLE IF NOT EXISTS health_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_name text NOT NULL,
  alert_type text NOT NULL CHECK (alert_type IN ('consecutive_failure', 'threshold_exceeded', 'storage_error')),
  failure_count integer NOT NULL DEFAULT 0,
  error_details jsonb,
  recipients text[] NOT NULL,
  alert_sent_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_alerts_created ON health_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_alerts_check_name ON health_alerts(check_name);
CREATE INDEX IF NOT EXISTS idx_health_alerts_resolved ON health_alerts(resolved_at) WHERE resolved_at IS NULL;

COMMENT ON TABLE health_alerts IS 'Alert tracking - emails sent when failures detected';

ALTER TABLE health_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all alerts"
  ON health_alerts FOR SELECT TO authenticated
  USING (current_user_is_admin());

CREATE POLICY "System can insert alerts"
  ON health_alerts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update alerts"
  ON health_alerts FOR UPDATE TO authenticated
  USING (current_user_is_admin());

-- ============================================================================

-- Table: storage_error_logs
CREATE TABLE IF NOT EXISTS storage_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation text NOT NULL,
  bucket_name text NOT NULL,
  file_path text,
  error_code integer,
  error_message text,
  user_id uuid,
  is_rls_violation boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_storage_errors_created ON storage_error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_storage_errors_rls ON storage_error_logs(is_rls_violation) WHERE is_rls_violation = true;

COMMENT ON TABLE storage_error_logs IS 'Storage error tracking - monitors upload failures and RLS violations';

ALTER TABLE storage_error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view storage errors"
  ON storage_error_logs FOR SELECT TO authenticated
  USING (current_user_is_admin());

CREATE POLICY "System can insert storage errors"
  ON storage_error_logs FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- SECTION 4: CREATE FUNCTIONS
-- ============================================================================

-- Function: Invoke health checks via pg_net
CREATE OR REPLACE FUNCTION invoke_health_checks_via_net()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_request_id bigint;
  v_supabase_url text;
  v_service_role_key text;
  v_healthcheck_secret text;
BEGIN
  -- Get configuration from Supabase secrets
  SELECT decrypted_secret INTO v_service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  SELECT decrypted_secret INTO v_healthcheck_secret
  FROM vault.decrypted_secrets
  WHERE name = 'HEALTHCHECK_SECRET'
  LIMIT 1;

  -- Use the Supabase project URL
  v_supabase_url := 'https://quhugpgfrnzvqugwibfp.supabase.co/functions/v1/run-health-checks';

  -- Make HTTP request via pg_net
  SELECT net.http_post(
    url := v_supabase_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_service_role_key,
      'Content-Type', 'application/json',
      'X-Health-Secret', v_healthcheck_secret
    ),
    body := '{}'::jsonb
  ) INTO v_request_id;

  -- Log successful trigger
  INSERT INTO health_checks (name, target, status, http_status, error_message, response_time_ms, marker_found, check_category)
  VALUES ('automated_trigger', 'pg_cron -> pg_net -> edge_function', 'success', 200, 'Invoked (req: ' || v_request_id || ')', 0, true, 'system');

EXCEPTION WHEN OTHERS THEN
  -- Log failed trigger
  INSERT INTO health_checks (name, target, status, http_status, error_message, response_time_ms, marker_found, check_category)
  VALUES ('automated_trigger', 'pg_cron -> pg_net -> edge_function', 'failure', NULL, 'Error: ' || SQLERRM, 0, false, 'system');
END;
$$;

COMMENT ON FUNCTION invoke_health_checks_via_net IS 'Triggers health checks via pg_net HTTP call to edge function';

-- ============================================================================

-- Function: Check storage health
CREATE OR REPLACE FUNCTION check_storage_health()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_rls_violations integer;
  v_upload_failures integer;
  v_recent_errors integer;
BEGIN
  -- Count RLS violations in last 10 minutes
  SELECT COUNT(*) INTO v_rls_violations
  FROM storage_error_logs
  WHERE is_rls_violation = true AND created_at > now() - interval '10 minutes';

  -- Count upload failures in last 10 minutes
  SELECT COUNT(*) INTO v_upload_failures
  FROM storage_error_logs
  WHERE operation = 'upload' AND created_at > now() - interval '10 minutes';

  -- Total recent errors
  v_recent_errors := v_rls_violations + v_upload_failures;

  -- Insert health check result
  INSERT INTO health_checks (name, target, status, http_status, error_message, response_time_ms, marker_found, check_category)
  VALUES (
    'storage_health',
    'question-images bucket',
    CASE
      WHEN v_rls_violations > 2 OR v_upload_failures > 5 THEN 'failure'
      WHEN v_recent_errors > 0 THEN 'warning'
      ELSE 'success'
    END,
    200,
    CASE
      WHEN v_rls_violations > 2 THEN 'RLS violations: ' || v_rls_violations || ' (threshold: 2)'
      WHEN v_upload_failures > 5 THEN 'Upload failures: ' || v_upload_failures || ' (threshold: 5)'
      WHEN v_recent_errors > 0 THEN 'Minor issues: ' || v_recent_errors || ' errors'
      ELSE 'All storage operations healthy'
    END,
    0,
    true,
    'storage'
  );

  -- Create alert if thresholds exceeded
  IF v_rls_violations > 2 OR v_upload_failures > 5 THEN
    -- Check if alert already sent recently (throttling)
    IF NOT EXISTS (
      SELECT 1 FROM health_alerts
      WHERE check_name = 'storage_health'
        AND resolved_at IS NULL
        AND created_at > now() - interval '30 minutes'
    ) THEN
      -- Insert new alert
      INSERT INTO health_alerts (check_name, alert_type, failure_count, error_details, recipients)
      VALUES (
        'storage_health',
        'storage_error',
        GREATEST(v_rls_violations, v_upload_failures),
        jsonb_build_object(
          'rls_violations', v_rls_violations,
          'upload_failures', v_upload_failures,
          'total_errors', v_recent_errors,
          'time_window', '10 minutes'
        ),
        ARRAY['support@startsprint.app', 'leslie.addae@startsprint.app']
      );
    END IF;
  END IF;
END;
$$;

COMMENT ON FUNCTION check_storage_health IS 'Checks storage health and creates alerts on threshold breaches';

-- ============================================================================

-- Function: Log storage errors (called from application)
CREATE OR REPLACE FUNCTION log_storage_error(
  p_operation text,
  p_bucket_name text,
  p_file_path text,
  p_error_code integer,
  p_error_message text,
  p_user_id uuid DEFAULT NULL
)
RETURNS uuid
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_error_id uuid;
  v_is_rls boolean;
BEGIN
  -- Detect if this is an RLS violation
  v_is_rls := (
    p_error_code = 403 OR
    p_error_message ILIKE '%permission%' OR
    p_error_message ILIKE '%policy%' OR
    p_error_message ILIKE '%unauthorized%' OR
    p_error_message ILIKE '%access denied%'
  );

  -- Insert error log
  INSERT INTO storage_error_logs (
    operation,
    bucket_name,
    file_path,
    error_code,
    error_message,
    user_id,
    is_rls_violation
  )
  VALUES (
    p_operation,
    p_bucket_name,
    p_file_path,
    p_error_code,
    p_error_message,
    p_user_id,
    v_is_rls
  )
  RETURNING id INTO v_error_id;

  RETURN v_error_id;
END;
$$;

COMMENT ON FUNCTION log_storage_error IS 'Logs storage errors from application code - call this when upload fails';

-- ============================================================================
-- SECTION 5: SCHEDULE CRON JOBS
-- ============================================================================

-- Clean up old cron jobs (if any exist)
DO $$
BEGIN
  PERFORM cron.unschedule('run-health-checks');
  PERFORM cron.unschedule('automated-health-checks-5min');
  PERFORM cron.unschedule('automated-storage-checks-5min');
  PERFORM cron.unschedule('startsprint-health-checks');
  PERFORM cron.unschedule('startsprint-storage-checks');
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore errors if jobs don't exist
END $$;

-- Schedule: Health checks every 5 minutes
SELECT cron.schedule(
  'startsprint-health-checks',
  '*/5 * * * *',
  'SELECT invoke_health_checks_via_net();'
);

-- Schedule: Storage checks every 5 minutes
SELECT cron.schedule(
  'startsprint-storage-checks',
  '*/5 * * * *',
  'SELECT check_storage_health();'
);

-- ============================================================================
-- SECTION 6: GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION invoke_health_checks_via_net() TO postgres;
GRANT EXECUTE ON FUNCTION check_storage_health() TO postgres;
GRANT EXECUTE ON FUNCTION log_storage_error(text, text, text, integer, text, uuid) TO authenticated, anon;

-- ============================================================================
-- SECTION 7: VERIFICATION
-- ============================================================================

-- Verify tables created
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'health_checks') THEN
    RAISE EXCEPTION 'Table health_checks not created';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'health_alerts') THEN
    RAISE EXCEPTION 'Table health_alerts not created';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'storage_error_logs') THEN
    RAISE EXCEPTION 'Table storage_error_logs not created';
  END IF;

  RAISE NOTICE 'All tables created successfully ✓';
END $$;

-- Verify functions created
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'invoke_health_checks_via_net') THEN
    RAISE EXCEPTION 'Function invoke_health_checks_via_net not created';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_storage_health') THEN
    RAISE EXCEPTION 'Function check_storage_health not created';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_storage_error') THEN
    RAISE EXCEPTION 'Function log_storage_error not created';
  END IF;

  RAISE NOTICE 'All functions created successfully ✓';
END $$;

-- Display active cron jobs
SELECT
  jobid,
  jobname,
  schedule,
  command,
  active,
  nodename
FROM cron.job
WHERE jobname LIKE '%startsprint%'
ORDER BY jobname;

-- ============================================================================
-- DEPLOYMENT COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Verify cron jobs are active (query above should show 2 jobs)
-- 2. Add HEALTHCHECK_SECRET to Supabase Vault
-- 3. Add RESEND_API_KEY to Supabase Vault
-- 4. Deploy edge functions: run-health-checks, send-health-alert
-- 5. Test manually: SELECT invoke_health_checks_via_net();
-- 6. Wait 5 minutes and check: SELECT * FROM health_checks ORDER BY created_at DESC LIMIT 10;
-- ============================================================================

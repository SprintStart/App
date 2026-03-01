-- COPY THIS ENTIRE FILE AND RUN IN SUPABASE SQL EDITOR
-- https://supabase.com/dashboard/project/quhugpgfrnzvqugwibfp/sql/new

-- ============================================
-- COMPLETE HEALTH MONITORING AUTOMATION
-- ============================================
-- This SQL sets up fully automated health monitoring:
-- - Health checks every 5 minutes
-- - Storage RLS violation tracking
-- - Email alerts on failures
-- - Zero manual intervention
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Add check category column
ALTER TABLE health_checks
  ADD COLUMN IF NOT EXISTS check_category text DEFAULT 'endpoint';

COMMENT ON COLUMN health_checks.check_category IS 'Category: endpoint, storage, database, api, system';

-- Create storage error tracking table
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

ALTER TABLE storage_error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view storage errors"
  ON storage_error_logs FOR SELECT TO authenticated
  USING (current_user_is_admin());

-- Function: Invoke health checks via pg_net
CREATE OR REPLACE FUNCTION invoke_health_checks_via_net()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_request_id bigint;
BEGIN
  SELECT net.http_post(
    url := 'https://quhugpgfrnzvqugwibfp.supabase.co/functions/v1/run-health-checks',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json',
      'X-Health-Secret', current_setting('app.settings.healthcheck_secret', true)
    ),
    body := '{}'::jsonb
  ) INTO v_request_id;

  INSERT INTO health_checks (name, target, status, http_status, error_message, response_time_ms, marker_found, check_category)
  VALUES ('automated_trigger', 'pg_cron -> pg_net', 'success', 200, 'Invoked (req: ' || v_request_id || ')', 0, true, 'system');

EXCEPTION WHEN OTHERS THEN
  INSERT INTO health_checks (name, target, status, http_status, error_message, response_time_ms, marker_found, check_category)
  VALUES ('automated_trigger', 'pg_cron -> pg_net', 'failure', NULL, 'Error: ' || SQLERRM, 0, false, 'system');
END;
$$;

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
BEGIN
  SELECT COUNT(*) INTO v_rls_violations
  FROM storage_error_logs
  WHERE is_rls_violation = true AND created_at > now() - interval '10 minutes';

  SELECT COUNT(*) INTO v_upload_failures
  FROM storage_error_logs
  WHERE operation = 'upload' AND created_at > now() - interval '10 minutes';

  INSERT INTO health_checks (name, target, status, http_status, error_message, response_time_ms, marker_found, check_category)
  VALUES (
    'storage_health',
    'question-images bucket',
    CASE
      WHEN v_rls_violations > 2 OR v_upload_failures > 5 THEN 'failure'
      WHEN v_rls_violations > 0 OR v_upload_failures > 0 THEN 'warning'
      ELSE 'success'
    END,
    200,
    CASE
      WHEN v_rls_violations > 2 THEN 'RLS violations: ' || v_rls_violations
      WHEN v_upload_failures > 5 THEN 'Upload failures: ' || v_upload_failures
      ELSE NULL
    END,
    0,
    true,
    'storage'
  );

  IF v_rls_violations > 2 OR v_upload_failures > 5 THEN
    IF NOT EXISTS (
      SELECT 1 FROM health_alerts
      WHERE check_name = 'storage_health' AND resolved_at IS NULL
        AND created_at > now() - interval '30 minutes'
    ) THEN
      INSERT INTO health_alerts (check_name, alert_type, failure_count, error_details, recipients)
      VALUES (
        'storage_health',
        'consecutive_failure',
        GREATEST(v_rls_violations, v_upload_failures),
        jsonb_build_object('rls_violations', v_rls_violations, 'upload_failures', v_upload_failures),
        ARRAY['support@startsprint.app', 'leslie.addae@startsprint.app']
      );
    END IF;
  END IF;
END;
$$;

-- Function: Log storage errors (called from app)
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
  v_is_rls := (
    p_error_code = 403 OR
    p_error_message ILIKE '%permission%' OR
    p_error_message ILIKE '%policy%' OR
    p_error_message ILIKE '%unauthorized%'
  );

  INSERT INTO storage_error_logs (operation, bucket_name, file_path, error_code, error_message, user_id, is_rls_violation)
  VALUES (p_operation, p_bucket_name, p_file_path, p_error_code, p_error_message, p_user_id, v_is_rls)
  RETURNING id INTO v_error_id;

  RETURN v_error_id;
END;
$$;

-- Clean up old cron jobs
DO $$
BEGIN
  PERFORM cron.unschedule('run-health-checks');
  PERFORM cron.unschedule('automated-health-checks-5min');
  PERFORM cron.unschedule('automated-storage-checks-5min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Schedule: Health checks every 5 minutes
SELECT cron.schedule('automated-health-checks-5min', '*/5 * * * *', 'SELECT invoke_health_checks_via_net();');

-- Schedule: Storage checks every 5 minutes
SELECT cron.schedule('automated-storage-checks-5min', '*/5 * * * *', 'SELECT check_storage_health();');

-- Grant permissions
GRANT EXECUTE ON FUNCTION invoke_health_checks_via_net() TO postgres;
GRANT EXECUTE ON FUNCTION check_storage_health() TO postgres;
GRANT EXECUTE ON FUNCTION log_storage_error(text, text, text, integer, text, uuid) TO authenticated, anon;

-- Verify cron jobs created
SELECT jobid, jobname, schedule, command, active
FROM cron.job
WHERE jobname LIKE '%health%' OR jobname LIKE '%storage%';

-- ============================================
-- SETUP COMPLETE
-- ============================================
-- Next steps:
-- 1. Deploy edge functions (run-health-checks, send-health-alert)
-- 2. Set HEALTHCHECK_SECRET in Supabase secrets
-- 3. Set RESEND_API_KEY in Supabase secrets
-- 4. Test with: SELECT invoke_health_checks_via_net();
-- ============================================

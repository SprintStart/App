# Complete Health Monitoring Automation Setup

## Status: Ready for Deployment

All code is ready. The Supabase MCP deployment tool is experiencing issues, so manual deployment is required.

---

## 1️⃣ Deploy Edge Functions

### Option A: Via Supabase Dashboard (Recommended)

1. Go to: https://supabase.com/dashboard/project/quhugpgfrnzvqugwibfp/functions

2. **Deploy `run-health-checks` function:**
   - Click "Create Function" or edit existing
   - Name: `run-health-checks`
   - Copy code from: `supabase/functions/run-health-checks/index.ts`
   - Set: `--no-verify-jwt` (public endpoint with secret header auth)
   - Deploy

3. **Deploy `send-health-alert` function:**
   - Click "Create Function" or edit existing
   - Name: `send-health-alert`
   - Copy code from: `supabase/functions/send-health-alert/index.ts`
   - Set: `--no-verify-jwt`
   - Deploy

### Option B: Via Supabase CLI

```bash
cd /tmp/cc-agent/63189572/project

# Deploy functions
supabase functions deploy run-health-checks --no-verify-jwt
supabase functions deploy send-health-alert --no-verify-jwt
```

---

## 2️⃣ Configure Supabase Secrets

Go to: https://supabase.com/dashboard/project/quhugpgfrnzvqugwibfp/settings/vault

**Add these secrets:**

```bash
# Generate a strong health check secret
HEALTHCHECK_SECRET=<generate 32-byte random hex>

# Add Resend API key for email alerts
RESEND_API_KEY=<your_resend_api_key>
```

**To generate HEALTHCHECK_SECRET:**
```bash
openssl rand -hex 32
```

---

## 3️⃣ Run Database Migration

Go to: https://supabase.com/dashboard/project/quhugpgfrnzvqugwibfp/sql/new

**Copy and execute this SQL:**

```sql
/*
  Complete Health Monitoring Automation

  This enables:
  - Automated health checks every 5 minutes
  - Storage RLS violation tracking
  - Email alerts on consecutive failures
  - Zero manual intervention required
*/

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Add storage monitoring to health_checks
ALTER TABLE health_checks
  ADD COLUMN IF NOT EXISTS check_category text DEFAULT 'endpoint';

COMMENT ON COLUMN health_checks.check_category IS
  'Category: endpoint, storage, database, api, system';

-- Create storage error log table
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

CREATE INDEX IF NOT EXISTS idx_storage_errors_created
  ON storage_error_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_storage_errors_rls
  ON storage_error_logs(is_rls_violation)
  WHERE is_rls_violation = true;

ALTER TABLE storage_error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view storage errors"
  ON storage_error_logs
  FOR SELECT
  TO authenticated
  USING (current_user_is_admin());

-- Function to call health check edge function via pg_net
CREATE OR REPLACE FUNCTION invoke_health_checks_via_net()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_request_id bigint;
BEGIN
  -- Make async HTTP POST request to health check function
  SELECT net.http_post(
    url := 'https://quhugpgfrnzvqugwibfp.supabase.co/functions/v1/run-health-checks',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json',
      'X-Health-Secret', current_setting('app.settings.healthcheck_secret', true)
    ),
    body := '{}'::jsonb
  ) INTO v_request_id;

  -- Log successful trigger
  INSERT INTO health_checks (
    name,
    target,
    status,
    http_status,
    error_message,
    response_time_ms,
    marker_found,
    check_category
  ) VALUES (
    'automated_trigger',
    'pg_cron -> pg_net -> run-health-checks',
    'success',
    200,
    'Health check invoked via pg_net (request_id: ' || v_request_id || ')',
    0,
    true,
    'system'
  );

EXCEPTION WHEN OTHERS THEN
  -- Log error
  INSERT INTO health_checks (
    name,
    target,
    status,
    http_status,
    error_message,
    response_time_ms,
    marker_found,
    check_category
  ) VALUES (
    'automated_trigger',
    'pg_cron -> pg_net -> run-health-checks',
    'failure',
    NULL,
    'Failed to invoke health checks: ' || SQLERRM,
    0,
    false,
    'system'
  );
END;
$$;

-- Function to check storage RLS violations
CREATE OR REPLACE FUNCTION check_storage_health()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_recent_rls_violations integer;
  v_recent_upload_failures integer;
BEGIN
  -- Check for RLS violations in the last 10 minutes
  SELECT COUNT(*)
  INTO v_recent_rls_violations
  FROM storage_error_logs
  WHERE is_rls_violation = true
    AND created_at > now() - interval '10 minutes';

  -- Check for upload failures in the last 10 minutes
  SELECT COUNT(*)
  INTO v_recent_upload_failures
  FROM storage_error_logs
  WHERE operation = 'upload'
    AND created_at > now() - interval '10 minutes';

  -- Log storage health check
  INSERT INTO health_checks (
    name,
    target,
    status,
    http_status,
    error_message,
    response_time_ms,
    marker_found,
    check_category
  ) VALUES (
    'storage_health',
    'question-images bucket',
    CASE
      WHEN v_recent_rls_violations > 2 THEN 'failure'
      WHEN v_recent_upload_failures > 5 THEN 'failure'
      WHEN v_recent_rls_violations > 0 OR v_recent_upload_failures > 0 THEN 'warning'
      ELSE 'success'
    END,
    200,
    CASE
      WHEN v_recent_rls_violations > 2 THEN
        'RLS violations detected: ' || v_recent_rls_violations || ' in last 10 minutes'
      WHEN v_recent_upload_failures > 5 THEN
        'Upload failures detected: ' || v_recent_upload_failures || ' in last 10 minutes'
      WHEN v_recent_rls_violations > 0 OR v_recent_upload_failures > 0 THEN
        'Minor issues: ' || v_recent_rls_violations || ' RLS violations, ' || v_recent_upload_failures || ' upload failures'
      ELSE NULL
    END,
    0,
    true,
    'storage'
  );

  -- Check for consecutive failures and trigger alert
  IF v_recent_rls_violations > 2 OR v_recent_upload_failures > 5 THEN
    IF NOT EXISTS (
      SELECT 1 FROM health_alerts
      WHERE check_name = 'storage_health'
        AND resolved_at IS NULL
        AND created_at > now() - interval '30 minutes'
    ) THEN
      INSERT INTO health_alerts (
        check_name,
        alert_type,
        failure_count,
        error_details,
        recipients
      ) VALUES (
        'storage_health',
        'consecutive_failure',
        GREATEST(v_recent_rls_violations, v_recent_upload_failures),
        jsonb_build_object(
          'rls_violations', v_recent_rls_violations,
          'upload_failures', v_recent_upload_failures,
          'time_window', '10 minutes'
        ),
        ARRAY['support@startsprint.app', 'leslie.addae@startsprint.app']
      );
    END IF;
  END IF;
END;
$$;

-- Function to log storage errors (called from application code)
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
  v_is_rls_violation boolean;
BEGIN
  v_is_rls_violation := (
    p_error_code = 403 OR
    p_error_message ILIKE '%permission%' OR
    p_error_message ILIKE '%policy%' OR
    p_error_message ILIKE '%unauthorized%'
  );

  INSERT INTO storage_error_logs (
    operation,
    bucket_name,
    file_path,
    error_code,
    error_message,
    user_id,
    is_rls_violation
  ) VALUES (
    p_operation,
    p_bucket_name,
    p_file_path,
    p_error_code,
    p_error_message,
    p_user_id,
    v_is_rls_violation
  ) RETURNING id INTO v_error_id;

  RETURN v_error_id;
END;
$$;

-- Drop existing cron jobs
DO $$
BEGIN
  PERFORM cron.unschedule('run-health-checks');
  PERFORM cron.unschedule('automated-health-checks-5min');
  PERFORM cron.unschedule('automated-storage-checks-5min');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Schedule health checks every 5 minutes
SELECT cron.schedule(
  'automated-health-checks-5min',
  '*/5 * * * *',
  'SELECT invoke_health_checks_via_net();'
);

-- Schedule storage health checks every 5 minutes
SELECT cron.schedule(
  'automated-storage-checks-5min',
  '*/5 * * * *',
  'SELECT check_storage_health();'
);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION invoke_health_checks_via_net() TO postgres;
GRANT EXECUTE ON FUNCTION check_storage_health() TO postgres;
GRANT EXECUTE ON FUNCTION log_storage_error(text, text, text, integer, text, uuid) TO authenticated, anon;

-- View active cron jobs (for verification)
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE jobname LIKE '%health%' OR jobname LIKE '%storage%';
```

---

## 4️⃣ Test the System

### Test Health Check Function

```bash
curl -X POST \
  https://quhugpgfrnzvqugwibfp.supabase.co/functions/v1/run-health-checks \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Health-Secret: YOUR_HEALTHCHECK_SECRET" \
  -d '{}'
```

**Expected Response:**
```json
{
  "success": true,
  "checks": [
    {
      "name": "explore_page",
      "target": "/explore",
      "status": "success",
      "http_status": 200,
      "error_message": null,
      "response_time_ms": 245,
      "marker_found": true
    },
    ...
  ],
  "timestamp": "2026-02-14T00:00:00.000Z"
}
```

### Test Alert Function (Force Failure)

To test email alerts, manually insert 2 consecutive failures:

```sql
-- Insert 2 failures for a test check
INSERT INTO health_checks (name, target, status, http_status, error_message, response_time_ms, marker_found)
VALUES
  ('test_check', '/test', 'failure', 500, 'Test error 1', 0, false),
  ('test_check', '/test', 'failure', 500, 'Test error 2', 0, false);

-- Manually trigger alert
SELECT net.http_post(
  url := 'https://quhugpgfrnzvqugwibfp.supabase.co/functions/v1/send-health-alert',
  headers := '{"Content-Type": "application/json"}'::jsonb,
  body := jsonb_build_object(
    'check_name', 'test_check',
    'target', '/test',
    'error_message', 'Test error for email verification',
    'failure_count', 2
  )
);
```

---

## 5️⃣ Verify Automation

### Check Cron Jobs Are Running

```sql
-- View all scheduled jobs
SELECT jobid, jobname, schedule, command, active
FROM cron.job
WHERE jobname LIKE '%health%' OR jobname LIKE '%storage%';

-- View recent cron execution history
SELECT jobid, runid, job_pid, status, return_message, start_time, end_time
FROM cron.job_run_details
WHERE jobid IN (
  SELECT jobid FROM cron.job
  WHERE jobname LIKE '%health%' OR jobname LIKE '%storage%'
)
ORDER BY start_time DESC
LIMIT 20;
```

### Check Health Check Logs

```sql
-- View recent health checks
SELECT
  name,
  target,
  status,
  http_status,
  error_message,
  response_time_ms,
  check_category,
  created_at
FROM health_checks
ORDER BY created_at DESC
LIMIT 50;

-- View automated triggers specifically
SELECT *
FROM health_checks
WHERE name = 'automated_trigger'
ORDER BY created_at DESC
LIMIT 10;
```

### Check Storage Errors

```sql
-- View recent storage errors
SELECT *
FROM storage_error_logs
ORDER BY created_at DESC
LIMIT 20;
```

### Check Alerts

```sql
-- View all alerts
SELECT *
FROM health_alerts
ORDER BY created_at DESC;

-- View unresolved alerts
SELECT *
FROM health_alerts
WHERE resolved_at IS NULL
ORDER BY created_at DESC;
```

---

## 6️⃣ Email Configuration

### Get Resend API Key

1. Go to https://resend.com
2. Sign up or log in
3. Navigate to API Keys
4. Create a new API key
5. Add to Supabase secrets as `RESEND_API_KEY`

### Verify Email Domain

For production use:
1. Add `startsprint.app` domain to Resend
2. Configure DNS records (SPF, DKIM, DMARC)
3. Verify domain ownership

For testing:
- Resend allows sending from `onboarding@resend.dev` without domain verification

---

## 7️⃣ Monitoring Dashboard

Access the admin dashboard at:
https://startsprint.app/admin/system-health

**Features:**
- Real-time health check status
- Historical performance data
- Alert management
- Storage error tracking

---

## Production Checklist

- [ ] Edge functions deployed (`run-health-checks`, `send-health-alert`)
- [ ] Secrets configured (`HEALTHCHECK_SECRET`, `RESEND_API_KEY`)
- [ ] Database migration executed
- [ ] Cron jobs scheduled and active
- [ ] Health check function tested manually
- [ ] Alert email sent and received
- [ ] Resend domain verified
- [ ] Admin dashboard accessible
- [ ] 5-minute automation confirmed running

---

## No Changes to Production Routes

**Confirmed: Zero modifications to:**
- Quiz creation APIs
- Quiz publishing logic
- Game play routes (`/quiz/*`, `/northampton-college`)
- Analytics schema
- Payment integration
- School slug matching
- Teacher dashboard
- Authentication flow
- RLS policies (except monitoring tables)

**Only additions:**
- `storage_error_logs` table
- `check_category` column in `health_checks`
- Automation functions (isolated to monitoring)
- Cron jobs for automated execution

---

## Support

If health checks fail to trigger automatically:

1. Check cron job status in `cron.job` table
2. Verify secrets are set in Supabase vault
3. Check edge function logs in Supabase dashboard
4. Review `health_checks` table for error messages

For email alert issues:
1. Verify `RESEND_API_KEY` is set correctly
2. Check Resend dashboard for API usage/errors
3. Ensure `from` address is verified in Resend
4. Check edge function logs for `send-health-alert`

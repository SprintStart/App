# Monitoring Hardening v1 - Deployment Guide

## Overview

This guide provides step-by-step instructions to deploy the Monitoring Hardening v1 enhancements.

**Time to deploy:** 10-15 minutes
**Risk level:** Low (additive changes only, feature-flagged)
**Rollback time:** 2 minutes

---

## Pre-Deployment Checklist

- [ ] Review all code changes
- [ ] Confirm RESEND_API_KEY is configured in Supabase secrets
- [ ] Confirm CRON_SECRET is configured in Supabase secrets
- [ ] Backup current database state (optional, changes are additive)
- [ ] Have rollback SQL ready (see MONITORING_PLAYBOOK.md)

---

## Step 1: Apply Database Migration (5 minutes)

### Option A: Via Supabase SQL Editor (Recommended)

1. Go to Supabase Dashboard → SQL Editor
2. Create a new query
3. Copy and paste the following SQL:

```sql
-- Monitoring Hardening v1 - Additive Fields

-- Add fields to health_alerts for cooldown management
ALTER TABLE health_alerts
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS cooldown_until timestamptz,
  ADD COLUMN IF NOT EXISTS severity text DEFAULT 'critical' CHECK (severity IN ('critical', 'warning'));

-- Add fields to health_checks for categorization and performance
ALTER TABLE health_checks
  ADD COLUMN IF NOT EXISTS check_category text DEFAULT 'route' CHECK (check_category IN ('route', 'api', 'function')),
  ADD COLUMN IF NOT EXISTS is_critical boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS performance_baseline_ms integer DEFAULT 2000;

-- Index for cooldown queries
CREATE INDEX IF NOT EXISTS idx_health_alerts_cooldown
  ON health_alerts(check_name, cooldown_until)
  WHERE resolved_at IS NULL;

-- Index for 24h trend queries
CREATE INDEX IF NOT EXISTS idx_health_checks_24h_trend
  ON health_checks(name, created_at DESC)
  WHERE created_at > NOW() - INTERVAL '24 hours';

-- Function to get 24h trends per check
CREATE OR REPLACE FUNCTION get_24h_health_trends()
RETURNS TABLE (
  check_name text,
  total_runs bigint,
  failure_count bigint,
  success_count bigint,
  avg_response_time_ms numeric,
  max_response_time_ms integer,
  last_failure_time timestamptz,
  last_failure_message text,
  success_rate numeric
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH trend_data AS (
    SELECT
      hc.name,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE hc.status = 'failure') as failures,
      COUNT(*) FILTER (WHERE hc.status = 'success') as successes,
      AVG(hc.response_time_ms) as avg_ms,
      MAX(hc.response_time_ms) as max_ms
    FROM health_checks hc
    WHERE hc.created_at > NOW() - INTERVAL '24 hours'
    GROUP BY hc.name
  ),
  last_failures AS (
    SELECT DISTINCT ON (hc.name)
      hc.name,
      hc.created_at as failure_time,
      hc.error_message
    FROM health_checks hc
    WHERE hc.status = 'failure'
      AND hc.created_at > NOW() - INTERVAL '24 hours'
    ORDER BY hc.name, hc.created_at DESC
  )
  SELECT
    td.name,
    td.total,
    td.failures,
    td.successes,
    ROUND(td.avg_ms, 0),
    td.max_ms,
    lf.failure_time,
    lf.error_message,
    CASE
      WHEN td.total > 0 THEN ROUND((td.successes::numeric / td.total::numeric) * 100, 1)
      ELSE 0
    END as success_rate
  FROM trend_data td
  LEFT JOIN last_failures lf ON lf.name = td.name
  ORDER BY td.name;
END;
$$;

-- Function to check if alert is in cooldown
CREATE OR REPLACE FUNCTION is_alert_in_cooldown(
  p_check_name text,
  p_cooldown_hours integer DEFAULT 6
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_last_alert timestamptz;
  v_cooldown_until timestamptz;
BEGIN
  SELECT cooldown_until, sent_at
  INTO v_cooldown_until, v_last_alert
  FROM health_alerts
  WHERE check_name = p_check_name
    AND resolved_at IS NULL
  ORDER BY sent_at DESC
  LIMIT 1;

  IF v_last_alert IS NULL THEN
    RETURN false;
  END IF;

  IF v_cooldown_until IS NOT NULL AND v_cooldown_until > NOW() THEN
    RETURN true;
  END IF;

  IF v_last_alert > NOW() - (p_cooldown_hours || ' hours')::INTERVAL THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Function to record alert with cooldown
CREATE OR REPLACE FUNCTION record_health_alert(
  p_check_name text,
  p_alert_type text,
  p_failure_count integer,
  p_error_details jsonb,
  p_recipients text[],
  p_severity text DEFAULT 'critical',
  p_cooldown_hours integer DEFAULT 6
)
RETURNS uuid
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_alert_id uuid;
  v_cooldown_until timestamptz;
BEGIN
  v_cooldown_until := NOW() + (p_cooldown_hours || ' hours')::INTERVAL;

  INSERT INTO health_alerts (
    check_name,
    alert_type,
    failure_count,
    error_details,
    recipients,
    severity,
    last_seen_at,
    cooldown_until
  ) VALUES (
    p_check_name,
    p_alert_type,
    p_failure_count,
    p_error_details,
    p_recipients,
    p_severity,
    NOW(),
    v_cooldown_until
  )
  RETURNING id INTO v_alert_id;

  RETURN v_alert_id;
END;
$$;

-- Update existing checks with default categories
UPDATE health_checks
SET
  check_category = CASE
    WHEN target LIKE '%/functions/v1/%' THEN 'function'
    WHEN target LIKE '%start%' OR target LIKE '%submit%' THEN 'api'
    ELSE 'route'
  END,
  is_critical = CASE
    WHEN name LIKE '%explore%' THEN true
    WHEN name LIKE '%school-wall%' THEN true
    WHEN name LIKE '%subject%' THEN true
    WHEN name LIKE '%quiz-start%' THEN true
    ELSE false
  END,
  performance_baseline_ms = CASE
    WHEN target LIKE '%/functions/v1/%' THEN 1000
    WHEN name LIKE '%explore%' THEN 2000
    ELSE 3000
  END
WHERE check_category IS NULL OR is_critical IS NULL OR performance_baseline_ms IS NULL;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_24h_health_trends() TO authenticated;
GRANT EXECUTE ON FUNCTION is_alert_in_cooldown(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION record_health_alert(text, text, integer, jsonb, text[], text, integer) TO authenticated;
```

4. Click "Run" (bottom right)
5. Verify success message: "Success. No rows returned"

### Verification

Run this query to verify the migration:

```sql
-- Verify new columns exist
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'health_alerts'
  AND column_name IN ('last_seen_at', 'cooldown_until', 'severity');

-- Should return 3 rows
```

---

## Step 2: Deploy Edge Functions (5 minutes)

### Deploy run-health-checks

The edge function files have been updated locally. To deploy:

1. Go to Supabase Dashboard → Edge Functions
2. Find `run-health-checks` function
3. Click "Deploy" or use Supabase CLI:

```bash
# If you have Supabase CLI installed
supabase functions deploy run-health-checks
```

**What changed:**
- Added 3 new route checks (global library, mathematics subject, GCSE exam page)
- Added performance threshold detection (>2000ms = warning)
- Added consecutive failure detection (2+ failures = alert)
- Added cooldown checking before sending alerts
- Added automatic alert recording in database

### Deploy send-health-alert

1. Go to Supabase Dashboard → Edge Functions
2. Find `send-health-alert` function
3. Click "Deploy" or use CLI:

```bash
supabase functions deploy send-health-alert
```

**What changed:**
- Enhanced error messages with root cause analysis
- Added HTTP status code interpretation
- Added severity levels (critical vs warning)
- Added troubleshooting steps in alert emails

### Verification

Test the health check manually:

```bash
# Get your admin JWT from browser (login to admin panel, open DevTools, check localStorage)
curl -X POST https://quhugpgfrnzvqugwibfp.supabase.co/functions/v1/run-health-checks \
  -H "Authorization: Bearer YOUR_ADMIN_JWT" \
  -H "Content-Type: application/json"
```

Expected response: HTTP 200 with JSON containing health check results

---

## Step 3: Verify Frontend Deployment (Auto)

The frontend changes are already included in the build. When you push to main:

1. Netlify automatically builds and deploys
2. Changes include:
   - 24h trend summaries on health check cards
   - "Copy Diagnostics" button
   - Updated route labels
   - Performance warning indicators

### Manual Verification

1. Go to https://startsprint.app/admin/system-health
2. Login as admin
3. Click "Run Check Now"
4. Verify:
   - New routes appear (Global Library, Mathematics, GCSE Math)
   - Each card shows "Last 24h" section with trends
   - "Copy Diagnostics" button appears in header
   - Performance warnings show if response > 2000ms

---

## Step 4: Update Cron Job (2 minutes)

If you have cron-job.org configured:

1. Go to https://cron-job.org
2. Find "StartSprint Health Checks" job
3. Verify configuration:
   - URL: `https://quhugpgfrnzvqugwibfp.supabase.co/functions/v1/run-health-checks`
   - Method: POST
   - Headers: `X-CRON-SECRET: [your_cron_secret]`
   - Schedule: Every 5-10 minutes

No changes needed to existing cron job configuration.

---

## Step 5: Post-Deployment Verification (5 minutes)

### Test Checklist

- [ ] Health checks run successfully from cron
- [ ] Health checks run successfully from admin UI ("Run Check Now")
- [ ] All 6 routes are being checked
- [ ] 24h trends display correctly in UI
- [ ] "Copy Diagnostics" button works
- [ ] Performance warnings appear for slow responses
- [ ] Alerts respect 6-hour cooldown

### Test Alert Flow

Trigger a test alert (optional):

```bash
curl -X POST https://quhugpgfrnzvqugwibfp.supabase.co/functions/v1/send-health-alert \
  -H "Authorization: Bearer [SUPABASE_SERVICE_KEY]" \
  -H "Content-Type: application/json" \
  -d '{
    "check_name": "test_alert",
    "target": "https://startsprint.app/test",
    "error_message": "Test alert - please ignore",
    "failure_count": 2,
    "severity": "warning"
  }'
```

Verify:
- [ ] Email received at support@startsprint.app
- [ ] Email received at leslie.addae@startsprint.app
- [ ] Email contains root cause analysis
- [ ] Email contains troubleshooting steps

---

## Rollback Procedure (2 minutes)

If issues occur, rollback using feature flag:

### Quick Rollback (UI Only)

1. Edit `/src/lib/featureFlags.ts`:
   ```typescript
   export const FEATURE_MONITORING_HARDENING = false;
   ```
2. Commit and push
3. Netlify redeploys automatically (2-3 minutes)

This hides:
- 24h trend summaries
- "Copy Diagnostics" button
- Performance warning indicators

Health checks continue running, but enhanced UI features are hidden.

### Full Rollback (Database + Functions)

If you need to rollback database changes:

```sql
-- Rollback additive fields
ALTER TABLE health_alerts DROP COLUMN IF EXISTS last_seen_at;
ALTER TABLE health_alerts DROP COLUMN IF EXISTS cooldown_until;
ALTER TABLE health_alerts DROP COLUMN IF EXISTS severity;
ALTER TABLE health_checks DROP COLUMN IF EXISTS check_category;
ALTER TABLE health_checks DROP COLUMN IF EXISTS is_critical;
ALTER TABLE health_checks DROP COLUMN IF EXISTS performance_baseline_ms;

-- Rollback functions
DROP FUNCTION IF EXISTS get_24h_health_trends();
DROP FUNCTION IF EXISTS is_alert_in_cooldown(text, integer);
DROP FUNCTION IF EXISTS record_health_alert(text, text, integer, jsonb, text[], text, integer);
```

Edge functions remain backward compatible - no rollback needed unless bugs found.

---

## Success Metrics

After deployment, monitor these metrics for 1 week:

| Metric | Target | Query |
|--------|--------|-------|
| False alert rate | < 1 per week | Review alert emails |
| Mean time to detect | < 10 minutes | Check alert timestamps |
| Health check success rate | > 99% | `SELECT AVG(CASE WHEN status='success' THEN 1.0 ELSE 0 END) FROM health_checks WHERE created_at > NOW() - INTERVAL '7 days';` |

---

## Troubleshooting

### Issue: Migration fails

**Error:** Column already exists

**Solution:** This is fine - migration is idempotent. Verify columns exist:
```sql
\d health_alerts
\d health_checks
```

### Issue: Edge function deployment fails

**Error:** Function not found

**Solution:**
1. Verify function files exist in `/supabase/functions/`
2. Use Supabase CLI to deploy
3. Check Supabase Dashboard → Edge Functions for errors

### Issue: 24h trends not showing

**Symptoms:** UI loads but no trend data

**Solutions:**
1. Check if `get_24h_health_trends()` function exists:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'get_24h_health_trends';
   ```
2. Run function manually to test:
   ```sql
   SELECT * FROM get_24h_health_trends();
   ```
3. Check browser console for errors

### Issue: Alerts not respecting cooldown

**Symptoms:** Multiple alerts for same check within 6 hours

**Solutions:**
1. Check cooldown function:
   ```sql
   SELECT is_alert_in_cooldown('explore_page', 6);
   ```
2. Verify cooldown_until timestamps:
   ```sql
   SELECT check_name, sent_at, cooldown_until
   FROM health_alerts
   WHERE resolved_at IS NULL;
   ```

---

## Next Steps

After successful deployment:

1. **Week 1:** Monitor closely
   - Check alert accuracy
   - Verify no false positives
   - Ensure cooldown works

2. **Week 2:** Tune thresholds
   - Adjust performance baselines if needed
   - Update content markers if pages changed
   - Add/remove monitored routes as needed

3. **Month 1:** Review metrics
   - Calculate success metrics
   - Document learnings
   - Plan next monitoring phase

---

## Support

Questions or issues during deployment?

- Check MONITORING_PLAYBOOK.md for operational procedures
- Review Supabase logs for edge function errors
- Contact leslie.addae@startsprint.app with:
  - Deployment step where issue occurred
  - Error messages
  - Screenshots

---

## Deployment Sign-off

- [ ] Database migration applied successfully
- [ ] Edge functions deployed successfully
- [ ] Frontend changes deployed successfully
- [ ] Post-deployment verification completed
- [ ] Team notified of new features
- [ ] MONITORING_PLAYBOOK.md shared with on-call staff

**Deployed by:** _______________
**Date:** _______________
**Version:** Monitoring Hardening v1.0

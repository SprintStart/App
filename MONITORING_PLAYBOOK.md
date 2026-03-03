# Monitoring Playbook v1.0

## Overview

This playbook describes how to operate StartSprint's health monitoring system, respond to alerts, and troubleshoot issues.

**Scope:** P0 critical routes monitoring (Monitoring Hardening v1)

**Alert Recipients:**
- support@startsprint.app
- leslie.addae@startsprint.app

---

## Monitored Routes

The following P0 "money routes" are monitored every 5-10 minutes:

| Route | Purpose | Response Time Baseline |
|-------|---------|----------------------|
| `/explore` | Main landing page | 2000ms |
| `/explore/global` | Global quiz library | 2000ms |
| `/northampton-college` | School wall page | 2000ms |
| `/subjects/business` | Business subject page | 2000ms |
| `/subjects/mathematics` | Mathematics subject page | 2000ms |
| `/exams/gcse/mathematics` | Country/exam listing | 2000ms |

---

## Alert Policy

### Trigger Conditions

An alert is triggered when:
1. A health check fails **2 consecutive times**
2. The check is NOT already in cooldown period

### Alert Cooldown

- After an alert is sent, no repeat alerts for that check for **6 hours**
- Prevents spam from persistent issues
- System automatically re-alerts every 6 hours if issue remains unresolved

### Severity Levels

- **CRITICAL**: Route returning errors (4xx, 5xx) or completely unreachable
- **WARNING**: Route responding but slower than baseline (>2000ms)

---

## When You Receive an Alert

### Step 1: Assess Severity (2 minutes)

1. Check the alert email subject line:
   - `CRITICAL:` → Investigate immediately
   - `WARNING:` → Performance degradation, investigate within 30 minutes

2. Read the error message in the email:
   - Note the HTTP status code
   - Read the root cause analysis provided

### Step 2: Verify Current Status (2 minutes)

1. Go to https://startsprint.app/admin/system-health
2. Log in with admin credentials
3. Check if the issue is still occurring:
   - Red card = Still failing
   - Green card = Resolved automatically
4. Click "Run Check Now" to get fresh status

### Step 3: Check Recent Changes (3 minutes)

1. Go to Netlify dashboard: https://app.netlify.com
2. Check recent deployments:
   - Was there a deployment in the last hour?
   - If yes, consider rolling back

3. Go to Supabase dashboard: https://supabase.com/dashboard
4. Check edge function logs:
   - Any errors in the last hour?
   - Any database migrations applied?

### Step 4: Manual Testing (3 minutes)

1. Open an incognito window
2. Navigate to the failing URL directly:
   ```
   https://startsprint.app[route]
   ```
3. Observe:
   - Does it load?
   - How long does it take?
   - Any errors in browser console? (F12)

### Step 5: Root Cause Analysis

Use this decision tree based on the error message:

#### HTTP 500 Server Error
- **Cause:** Application server error
- **Action:**
  1. Check Supabase logs for errors
  2. Check recent code deployments
  3. Check database for issues (connections, migrations)
  4. Roll back last deployment if needed

#### HTTP 404 Not Found
- **Cause:** Route doesn't exist
- **Action:**
  1. Verify routing configuration in React Router
  2. Check for typos in route paths
  3. Verify Netlify redirects file (_redirects)

#### HTTP 403 Forbidden
- **Cause:** Permission denied
- **Action:**
  1. Check RLS policies in Supabase
  2. Verify authentication state
  3. Check API key configuration

#### SSL Certificate Error
- **Cause:** Domain or SSL configuration issue
- **Action:**
  1. Verify domain DNS records
  2. Check Netlify SSL certificate status
  3. Contact Netlify support if needed

#### DNS Resolution Failed
- **Cause:** Domain not resolving
- **Action:**
  1. Check domain registrar settings
  2. Verify nameservers point to Netlify
  3. Wait 5-10 minutes and retry (DNS propagation)

#### Request Timeout
- **Cause:** Server overloaded or unresponsive
- **Action:**
  1. Check Supabase database load
  2. Check for slow queries
  3. Verify no DDoS or unusual traffic
  4. Scale resources if needed

#### Connection Refused
- **Cause:** Service not running
- **Action:**
  1. Check Netlify deployment status
  2. Check Supabase project status
  3. Restart services if needed

---

## Testing the Monitoring System

### Manual Test: Force a Failure

1. Go to https://startsprint.app/admin/system-health
2. Click "Run Check Now"
3. Observe results

### Automated Test: Verify Cron Job

1. Go to https://cron-job.org (login credentials in 1Password)
2. Find "StartSprint Health Checks" job
3. Verify:
   - Status: Enabled
   - Schedule: Every 5-10 minutes
   - Last execution: Recently succeeded

### Test Alert Flow

1. Manually trigger edge function:
   ```bash
   curl -X POST https://quhugpgfrnzvqugwibfp.supabase.co/functions/v1/send-health-alert \
     -H "Authorization: Bearer [SUPABASE_SERVICE_KEY]" \
     -H "Content-Type: application/json" \
     -d '{
       "check_name": "test_alert",
       "target": "https://startsprint.app/test",
       "error_message": "Test alert",
       "failure_count": 2
     }'
   ```

2. Check email inbox:
   - support@startsprint.app should receive email within 1 minute
   - leslie.addae@startsprint.app should receive email within 1 minute

---

## Where to Find Logs

### Application Logs
- **Location:** Supabase Dashboard → Logs → Edge Functions
- **URL:** https://supabase.com/dashboard/project/quhugpgfrnzvqugwibfp/logs/edge-functions

### Health Check Logs
- **Location:** Supabase Dashboard → SQL Editor
- **Query:**
  ```sql
  SELECT * FROM health_checks
  ORDER BY created_at DESC
  LIMIT 100;
  ```

### Alert History
- **Location:** Supabase Dashboard → SQL Editor
- **Query:**
  ```sql
  SELECT * FROM health_alerts
  WHERE resolved_at IS NULL
  ORDER BY sent_at DESC;
  ```

### Cron Job Execution History
- **Location:** https://cron-job.org → Execution History
- Shows success/failure of automated health check runs

---

## Common Issues and Solutions

### Issue: False Positives (Alerts when system is working)

**Symptoms:**
- Receiving alerts but manual testing shows site working
- Intermittent failures

**Root Causes:**
1. Slow response times triggering timeouts
2. Rate limiting from health checker
3. Incorrect content markers

**Solutions:**
1. Increase response time baseline in edge function
2. Add delay between health checks
3. Update content markers to match current page content

### Issue: No Alerts When System is Down

**Symptoms:**
- Site not loading but no alerts received

**Root Causes:**
1. Cron job not running
2. Alert cooldown active
3. Email service (Resend) not configured

**Solutions:**
1. Check cron-job.org status
2. Check health_alerts table for cooldown_until timestamps
3. Verify RESEND_API_KEY in Supabase secrets

### Issue: Too Many Alerts (Alert Spam)

**Symptoms:**
- Receiving multiple alerts for same issue

**Root Causes:**
1. Cooldown not working
2. Multiple checks failing

**Solutions:**
1. Check is_alert_in_cooldown function
2. Fix underlying system issues
3. Increase cooldown period if needed

---

## Monitoring Metrics (Success Criteria)

Track these metrics weekly:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| False alert rate | < 1 per week | Count alerts where system was actually working |
| Mean time to detect | < 10 minutes | Time from issue start to alert received |
| Health check success rate | > 99% | Query: `SELECT AVG(CASE WHEN status='success' THEN 1 ELSE 0 END) FROM health_checks WHERE created_at > NOW() - INTERVAL '7 days';` |

---

## Emergency Contacts

| Role | Email | When to Contact |
|------|-------|----------------|
| Platform Support | support@startsprint.app | General issues, user reports |
| Technical Lead | leslie.addae@startsprint.app | Critical outages, system-wide failures |
| Supabase Support | https://supabase.com/dashboard/support | Database/edge function issues |
| Netlify Support | https://app.netlify.com/support | Deployment/CDN issues |

---

## Rollback Procedures

### Rollback Monitoring UI Changes (30 seconds)

1. Edit `/src/lib/featureFlags.ts`:
   ```typescript
   export const FEATURE_MONITORING_HARDENING = false;
   ```
2. Commit and push
3. Netlify auto-deploys (2-3 minutes)

### Disable Automated Checks (1 minute)

1. Go to https://cron-job.org
2. Find "StartSprint Health Checks" job
3. Click "Disable"
4. Manual "Run Check Now" still works from admin UI

### Rollback Database Changes (2 minutes)

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

---

## Maintenance Tasks

### Weekly Tasks (5 minutes)

1. Review alert history:
   - Were alerts accurate?
   - Any false positives to investigate?

2. Check monitoring metrics:
   - Calculate false alert rate
   - Calculate mean time to detect
   - Check health check success rate

3. Clean up old alerts (auto-resolves after 24h, but verify):
   ```sql
   UPDATE health_alerts
   SET resolved_at = NOW()
   WHERE resolved_at IS NULL
     AND sent_at < NOW() - INTERVAL '7 days';
   ```

### Monthly Tasks (15 minutes)

1. Review monitored routes:
   - Are all P0 routes still monitored?
   - Any new P0 routes to add?

2. Test alert flow end-to-end

3. Review and update content markers if pages changed

4. Check cron job reliability:
   - Review execution history
   - Verify no missed executions

---

## Changelog

### v1.0 (2026-03-02)
- Initial monitoring hardening release
- Added 6 P0 route monitors
- Implemented 2-failure consecutive alert policy
- Added 6-hour cooldown to prevent spam
- Added 24h trend tracking
- Added performance threshold warnings (>2000ms)
- Added root cause analysis in alert emails

---

## Questions or Issues?

If this playbook doesn't cover your situation:
1. Check Supabase logs
2. Review recent code changes
3. Contact leslie.addae@startsprint.app with:
   - Alert email screenshot
   - What you've tried so far
   - Current system status screenshot

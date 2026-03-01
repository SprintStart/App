# Copy-Paste Deployment Guide

Complete automation in 3 copy-paste steps.

---

## STEP 1: Deploy Edge Functions

### A. Deploy `run-health-checks`

1. Go to: https://supabase.com/dashboard/project/quhugpgfrnzvqugwibfp/functions
2. Click "Create a new function" or edit existing
3. Name: `run-health-checks`
4. Paste code from: `supabase/functions/run-health-checks/index.ts`
5. Set: **--no-verify-jwt** ✓
6. Click Deploy

### B. Deploy `send-health-alert`

1. Same dashboard: https://supabase.com/dashboard/project/quhugpgfrnzvqugwibfp/functions
2. Click "Create a new function" or edit existing
3. Name: `send-health-alert`
4. Paste code from: `supabase/functions/send-health-alert/index.ts`
5. Set: **--no-verify-jwt** ✓
6. Click Deploy

---

## STEP 2: Configure Secrets

Go to: https://supabase.com/dashboard/project/quhugpgfrnzvqugwibfp/settings/vault

### Generate HEALTHCHECK_SECRET

Run this in your terminal:
```bash
openssl rand -hex 32
```

Copy the output (64-character hex string)

### Add Secrets

Click "New secret" for each:

**Secret 1:**
```
Name: HEALTHCHECK_SECRET
Value: <paste your generated hex string>
```

**Secret 2:**
```
Name: RESEND_API_KEY
Value: <paste your Resend API key>
```

Get Resend API key from: https://resend.com/api-keys

---

## STEP 3: Run SQL Migration

Go to: https://supabase.com/dashboard/project/quhugpgfrnzvqugwibfp/sql/new

**Copy the ENTIRE contents of `QUICK_SETUP_MONITORING.sql` and paste into the SQL editor.**

Click "Run" button.

Expected output: Multiple "Success" messages showing:
- Tables created
- Functions created
- Cron jobs scheduled
- Final SELECT showing active cron jobs

---

## STEP 4: Test (Optional but Recommended)

### Test Health Check Function

Replace `YOUR_SERVICE_ROLE_KEY` and `YOUR_HEALTHCHECK_SECRET` with your actual values:

```bash
curl -X POST \
  https://quhugpgfrnzvqugwibfp.supabase.co/functions/v1/run-health-checks \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "X-Health-Secret: YOUR_HEALTHCHECK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected:** JSON response with health check results

### Test Email Alert

Run this SQL query:
```sql
-- Insert 2 consecutive failures
INSERT INTO health_checks (name, target, status, http_status, error_message, response_time_ms, marker_found)
VALUES
  ('test_alert', '/test', 'failure', 500, 'Test error 1', 0, false),
  ('test_alert', '/test', 'failure', 500, 'Test error 2', 0, false);

-- Trigger alert manually
SELECT net.http_post(
  url := 'https://quhugpgfrnzvqugwibfp.supabase.co/functions/v1/send-health-alert',
  headers := '{"Content-Type": "application/json"}'::jsonb,
  body := jsonb_build_object(
    'check_name', 'test_alert',
    'target', '/test',
    'error_message', 'Test error for verification',
    'failure_count', 2
  )
);
```

**Expected:** Email received at support@startsprint.app and leslie.addae@startsprint.app

---

## STEP 5: Verify Automation

Wait 5 minutes, then run this SQL query:

```sql
SELECT name, target, status, created_at
FROM health_checks
WHERE name = 'automated_trigger'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:** New entry with timestamp within last 5 minutes

---

## Troubleshooting

### No automated health checks appearing?

```sql
-- Check if cron jobs are scheduled
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname LIKE '%health%';
```

Should show 2 jobs with `active = true`

### Cron job errors?

```sql
-- Check cron execution history
SELECT jobid, status, return_message, start_time
FROM cron.job_run_details
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE '%health%')
ORDER BY start_time DESC
LIMIT 10;
```

### Email not sending?

1. Check Resend dashboard: https://resend.com/emails
2. Verify RESEND_API_KEY is set correctly
3. Check edge function logs in Supabase dashboard
4. Ensure `from` address is verified in Resend

---

## You're Done!

Monitoring is now fully automated:
- Health checks run every 5 minutes
- Alerts sent on 2 consecutive failures
- Storage errors tracked
- Zero manual intervention required

View monitoring dashboard at:
https://startsprint.app/admin/system-health

---

## Summary

**What runs automatically:**
- `/explore` page check
- `/northampton-college` page check
- `/subjects/business` page check
- `/quiz/<id>` page check
- Quiz start API check
- Storage RLS violation check

**Alerts sent to:**
- support@startsprint.app
- leslie.addae@startsprint.app

**Frequency:**
- Every 5 minutes

**No manual action required.**

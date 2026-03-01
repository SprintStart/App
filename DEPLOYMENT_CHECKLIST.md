# Health Checks Deployment Checklist

Use this checklist to deploy the health monitoring system. Total time: ~10 minutes.

## Pre-Deployment Verification

- [x] Edge function created: `supabase/functions/run-health-checks/index.ts` (206 lines)
- [x] Database migration created: `CREATE_HEALTH_CHECKS_TABLE.sql`
- [x] Documentation created:
  - [x] Quick start guide: `SETUP_CRON_SECRET.md`
  - [x] Detailed guide: `CRON_SETUP_GUIDE.md`
  - [x] Overview: `README_HEALTH_CHECKS.md`
  - [x] This checklist: `DEPLOYMENT_CHECKLIST.md`

## Deployment Steps

### Step 1: Generate CRON_SECRET (30 seconds)
- [ ] Run: `openssl rand -hex 32`
- [ ] Copy the output (32+ character hex string)
- [ ] Save it somewhere secure temporarily

**Output Example:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0
```

---

### Step 2: Add CRON_SECRET to Supabase (1 minute)
- [ ] Open: https://supabase.com/dashboard
- [ ] Select your project
- [ ] Navigate to: **Project Settings** → **Edge Functions** → **Secrets**
- [ ] Click: **"Add Secret"**
- [ ] Enter:
  - Name: `CRON_SECRET`
  - Value: [paste your secret from Step 1]
- [ ] Click: **"Save"**
- [ ] Verify: `CRON_SECRET` appears in secrets list

---

### Step 3: Create Database Table (1 minute)
- [ ] In Supabase Dashboard, click: **SQL Editor**
- [ ] Click: **"New query"**
- [ ] Open file: `CREATE_HEALTH_CHECKS_TABLE.sql`
- [ ] Copy all contents
- [ ] Paste into SQL Editor
- [ ] Click: **"Run"** (or press Ctrl+Enter)
- [ ] Verify: Success message appears
- [ ] Run verification query:
  ```sql
  SELECT table_name FROM information_schema.tables
  WHERE table_name = 'system_health_checks';
  ```
- [ ] Verify: Returns 1 row with `system_health_checks`

---

### Step 4: Deploy Edge Function (1-2 minutes)

**Option A: Supabase Dashboard (Recommended)**
- [ ] In Supabase Dashboard, go to: **Edge Functions**
- [ ] Click: **"Deploy new function"**
- [ ] Upload or select folder: `supabase/functions/run-health-checks`
- [ ] **IMPORTANT:** Ensure **"Verify JWT"** is **UNCHECKED/OFF**
- [ ] Click: **"Deploy"**
- [ ] Wait for deployment to complete
- [ ] Verify: Function shows status "Active" or "Deployed"

**Option B: Supabase CLI**
- [ ] Install Supabase CLI if not already: https://supabase.com/docs/guides/cli
- [ ] Run: `supabase functions deploy run-health-checks --no-verify-jwt`
- [ ] Wait for deployment confirmation
- [ ] Verify: Success message appears

**Get Function URL:**
- [ ] Your function URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/run-health-checks`
- [ ] Replace `YOUR_PROJECT_REF` with your actual project reference
- [ ] Find it: Supabase Dashboard → Settings → API → Project URL

---

### Step 5: Test Edge Function Manually (1 minute)

Run this curl command (replace placeholders):

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/run-health-checks \
  -H "X-CRON-SECRET: YOUR_SECRET_FROM_STEP_1" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response:**
- [ ] HTTP Status: 200
- [ ] Response contains:
  ```json
  {
    "overall": "healthy",
    "checks": [ ... ],
    "timestamp": "..."
  }
  ```

**Verify in Database:**
```sql
SELECT * FROM system_health_checks ORDER BY checked_at DESC LIMIT 5;
```
- [ ] Query returns at least 3 rows (database, auth, storage)
- [ ] All have recent `checked_at` timestamps

---

### Step 6: Configure Cron-job.org (2 minutes)

**Sign Up/Login:**
- [ ] Go to: https://cron-job.org
- [ ] Create account or login

**Create Cron Job:**
- [ ] Click: **"Create cronjob"**
- [ ] Fill in details:

**Basic Settings:**
```
Title: Supabase Health Checks
```

**URL:**
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/run-health-checks
```
- [ ] Replace `YOUR_PROJECT_REF`

**Schedule:**
```
*/5 * * * *
```
- [ ] Means: Every 5 minutes

**Request Settings:**
- [ ] Method: **POST**
- [ ] Request body type: **JSON**
- [ ] Request body: `{}`

**Request Headers:**
- [ ] Click "Add header"
- [ ] Header 1:
  - Name: `X-CRON-SECRET`
  - Value: [Your secret from Step 1]
- [ ] Click "Add header"
- [ ] Header 2:
  - Name: `Content-Type`
  - Value: `application/json`

**Advanced Settings:**
- [ ] Timeout: `30` seconds
- [ ] Fail on HTTP error: ✅ Enabled (4xx, 5xx)

**Notifications:**
- [ ] ✅ Enable "Send notification on failure"
- [ ] Threshold: `2` (consecutive failures)
- [ ] Email: [Your email address]

**Save:**
- [ ] Click: **"Create"** or **"Save"**

---

### Step 7: Test Cron Job (1 minute)

**Manual Test:**
- [ ] In cron-job.org, find your job in the list
- [ ] Click: **"Execute now"**
- [ ] Wait for execution to complete (~5 seconds)
- [ ] Check execution history:
  - [ ] Status: 200 (green checkmark)
  - [ ] Duration: < 5 seconds
  - [ ] No errors

**Verify in Database:**
```sql
SELECT
  service_name,
  status,
  response_time_ms,
  checked_at
FROM system_health_checks
ORDER BY checked_at DESC
LIMIT 10;
```
- [ ] New records appeared within last minute
- [ ] All 3 services checked (database, auth, storage)
- [ ] All show status `healthy` (if system is healthy)

---

### Step 8: Monitor First Hour (Optional)

**Wait 15-30 minutes, then check:**
```sql
SELECT
  service_name,
  COUNT(*) as check_count,
  AVG(response_time_ms) as avg_response_ms,
  MAX(checked_at) as last_check
FROM system_health_checks
WHERE checked_at > now() - interval '1 hour'
GROUP BY service_name;
```

- [ ] All 3 services have multiple checks (3+ each)
- [ ] Last check is within last 5 minutes
- [ ] Average response times are reasonable (< 1000ms)

**Check Cron Execution History:**
- [ ] In cron-job.org, view execution history
- [ ] All executions show Status 200
- [ ] No timeouts or errors

---

## Troubleshooting

If you encounter issues, refer to:
- **Quick fixes:** `SETUP_CRON_SECRET.md` (Troubleshooting section)
- **Detailed troubleshooting:** `CRON_SETUP_GUIDE.md`
- **Overview & architecture:** `README_HEALTH_CHECKS.md`

### Common Issues

**❌ 401 Unauthorized**
- X-CRON-SECRET header doesn't match
- Check for typos, extra spaces, or quotes
- Verify secret in both Supabase and cron-job.org

**❌ 500 Server Error**
- CRON_SECRET not set in Supabase
- Go back to Step 2

**❌ 404 Not Found**
- Edge function not deployed
- Check Edge Functions list in Supabase Dashboard
- Redeploy if needed (Step 4)

**❌ No data in database**
- Table not created
- Go back to Step 3
- Run the SQL migration

---

## Post-Deployment

### Monitoring Dashboard (Optional)
Create a simple monitoring view:
```sql
CREATE OR REPLACE VIEW health_summary AS
SELECT
  service_name,
  COUNT(*) as total_checks,
  COUNT(*) FILTER (WHERE status = 'healthy') as healthy_count,
  COUNT(*) FILTER (WHERE status = 'degraded') as degraded_count,
  COUNT(*) FILTER (WHERE status = 'down') as down_count,
  AVG(response_time_ms) as avg_response_ms,
  MAX(checked_at) as last_check
FROM system_health_checks
WHERE checked_at > now() - interval '24 hours'
GROUP BY service_name;
```

### Set Up Alerts
- [ ] Verify email notifications work in cron-job.org
- [ ] Optional: Add Slack webhook for critical alerts
- [ ] Optional: Add PagerDuty integration for on-call

### Regular Maintenance
- [ ] Weekly: Review health check logs for patterns
- [ ] Monthly: Analyze average response times
- [ ] Quarterly: Review and adjust alert thresholds

---

## Sign-Off

Once all steps are complete:

- [ ] ✅ All deployment steps completed
- [ ] ✅ Manual test successful (Step 5)
- [ ] ✅ Cron job configured and tested (Steps 6-7)
- [ ] ✅ Database receiving health check data
- [ ] ✅ Email alerts configured
- [ ] ✅ Documentation reviewed

**Deployed By:** ___________________

**Date:** ___________________

**System Status:** ✅ Healthy

---

**Total Time:** 10 minutes

**Maintenance Required:** None (automated)

**Documentation:** See `README_HEALTH_CHECKS.md` for complete overview

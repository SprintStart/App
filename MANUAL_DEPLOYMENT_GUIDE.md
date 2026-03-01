# Health Monitoring System - Manual Deployment Guide

**Time Required:** 10-15 minutes
**Risk Level:** Zero (isolated monitoring system, no changes to production code)
**Status:** All code already exists in repository

---

## Overview

The health monitoring system is **already in your GitHub repository**. You don't need to modify any code.

You only need to:
1. Deploy 2 Supabase Edge Functions
2. Add 2 secrets to Supabase Vault
3. Run 1 SQL migration

**No GitHub commits needed. No Netlify redeploy needed.**

---

## Step 1: Deploy Edge Functions (5 minutes)

### 1.1 Deploy `run-health-checks`

1. Go to: https://supabase.com/dashboard/project/quhugpgfrnzvqugwibfp/functions
2. Click **"Deploy new function"**
3. Settings:
   - **Function name:** `run-health-checks`
   - **Import from:** Select file `supabase/functions/run-health-checks/index.ts` from your repo
   - **Verify JWT:** ❌ **UNCHECK THIS** (critical!)
4. Click **"Deploy"**
5. Wait for deployment to complete

### 1.2 Deploy `send-health-alert`

1. Same page, click **"Deploy new function"** again
2. Settings:
   - **Function name:** `send-health-alert`
   - **Import from:** Select file `supabase/functions/send-health-alert/index.ts` from your repo
   - **Verify JWT:** ❌ **UNCHECK THIS** (critical!)
3. Click **"Deploy"**
4. Wait for deployment to complete

---

## Step 2: Add Secrets (3 minutes)

### 2.1 Generate CRON_SECRET

On your local machine, run:
```bash
openssl rand -hex 32
```

Copy the output (it will look like: `a1b2c3d4e5f6...`)

### 2.2 Add Secrets to Supabase

1. Go to: https://supabase.com/dashboard/project/quhugpgfrnzvqugwibfp/settings/vault/secrets
2. Click **"New secret"**
3. Add **First Secret:**
   - **Name:** `CRON_SECRET`
   - **Value:** [paste the hex string from step 2.1]
   - Click **"Save"**

4. Click **"New secret"** again
5. Add **Second Secret:**
   - **Name:** `RESEND_API_KEY`
   - **Value:** Get from https://resend.com/api-keys
   - Click **"Save"**

### 2.3 Verify Secrets

Run this to confirm secrets are configured:
```bash
curl https://supabase.com/dashboard/project/quhugpgfrnzvqugwibfp/settings/vault/secrets
```

You should see both `CRON_SECRET` and `RESEND_API_KEY` listed.

---

## Step 3: Run Database Migration (2 minutes)

### 3.1 Open SQL Editor

Go to: https://supabase.com/dashboard/project/quhugpgfrnzvqugwibfp/sql/new

### 3.2 Copy Migration SQL

Open the file `DEPLOYMENT_MIGRATION_WITH_ROLLBACK.sql` from your repository.

Copy the **entire contents** of the file.

### 3.3 Execute Migration

1. Paste the SQL into the SQL Editor
2. Click **"Run"**
3. Wait for execution to complete

### 3.4 Verify Success

You should see:
```
✓ All tables created successfully
✓ Cron job scheduled: run_health_checks (every 5 minutes)
✓ Cron job scheduled: cleanup_old_health_checks (daily at 2am)
```

---

## Step 4: Configure Cron-Job.org (5 minutes)

### 4.1 Create Account

1. Go to: https://cron-job.org/en/signup/
2. Create a free account
3. Verify your email

### 4.2 Create Health Check Job

1. Go to: https://cron-job.org/en/members/jobs/create/
2. Settings:
   - **Title:** `StartSprint Health Checks`
   - **Address (URL):** `https://quhugpgfrnzvqugwibfp.supabase.co/functions/v1/run-health-checks`
   - **Schedule:** Every 5 minutes (enter `*/5 * * * *`)
   - **Request method:** POST
   - **Headers:** Click "Add header"
     - **Name:** `X-CRON-SECRET`
     - **Value:** [paste your CRON_SECRET from Step 2.1]
3. Click **"Create"**

### 4.3 Test Job

1. Find the job in your dashboard
2. Click **"Run now"** to test
3. Check execution log - should show **200 OK**

---

## Step 5: Verify System (2 minutes)

### 5.1 Check Admin Dashboard

1. Go to: https://startsprint.app/admin/system-health
2. Log in as admin
3. You should see:
   - System health overview
   - Recent health checks
   - Service status

### 5.2 Check Database

Run this query in SQL Editor:
```sql
SELECT * FROM system_health_checks ORDER BY checked_at DESC LIMIT 10;
```

You should see recent health check results.

### 5.3 Check Cron Jobs

Run this query:
```sql
SELECT * FROM cron.job;
```

You should see 2 active jobs:
- `run_health_checks` (every 5 minutes)
- `cleanup_old_health_checks` (daily at 2am)

---

## Rollback Instructions (if needed)

If you need to remove the monitoring system:

1. **Delete Edge Functions:**
   - Go to Functions dashboard
   - Delete `run-health-checks`
   - Delete `send-health-alert`

2. **Remove Secrets:**
   - Go to Vault
   - Delete `CRON_SECRET`
   - Delete `RESEND_API_KEY`

3. **Run Rollback SQL:**
   ```sql
   -- Remove cron jobs
   SELECT cron.unschedule('run_health_checks');
   SELECT cron.unschedule('cleanup_old_health_checks');

   -- Drop tables
   DROP TABLE IF EXISTS health_checks CASCADE;
   DROP TABLE IF EXISTS system_health_checks CASCADE;
   ```

---

## Troubleshooting

### Edge Function Deployment Fails

**Error:** "Function already exists"
- **Solution:** Delete the existing function and redeploy

**Error:** "Invalid JWT"
- **Solution:** Make sure "Verify JWT" is **unchecked**

### Cron Job Fails (401 Unauthorized)

**Error:** "Unauthorized"
- **Solution:** Double-check that `X-CRON-SECRET` header matches the secret in Supabase Vault

### No Health Checks Appearing

**Possible causes:**
1. Cron job not configured correctly in cron-job.org
2. CRON_SECRET mismatch
3. Edge function not deployed

**Debug steps:**
1. Test edge function manually:
   ```bash
   curl -X POST \
     https://quhugpgfrnzvqugwibfp.supabase.co/functions/v1/run-health-checks \
     -H "X-CRON-SECRET: your_secret_here"
   ```
2. Check edge function logs in Supabase dashboard
3. Check cron-job.org execution history

### Email Alerts Not Sending

**Possible causes:**
1. RESEND_API_KEY not configured
2. Invalid API key
3. Email addresses not verified in Resend

**Debug steps:**
1. Check Resend dashboard: https://resend.com/emails
2. Verify API key is active
3. Check edge function logs for email errors

---

## Support

If you encounter issues:

1. Check edge function logs in Supabase Dashboard
2. Check cron-job.org execution history
3. Check SQL query results in Supabase SQL Editor
4. Review error messages in browser console (Admin Dashboard)

---

## Summary

**What you deployed:**
- 2 edge functions (monitoring + alerting)
- 2 database tables (health check logs)
- 2 cron jobs (automated checks + cleanup)
- External monitoring via cron-job.org

**What changed:**
- Nothing in production code
- No Netlify redeploy needed
- No database schema changes to existing tables
- Isolated monitoring system only

**Result:**
- Automated health monitoring every 5 minutes
- Admin dashboard shows real-time system status
- Email alerts for critical failures
- 90-day health check history

✅ **Deployment Complete!**

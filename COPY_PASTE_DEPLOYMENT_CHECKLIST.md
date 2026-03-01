# 15-Minute Deployment Checklist
## Copy, Paste, Done

**Production:** `main@58f55ff` on Netlify
**Risk:** Zero (monitoring only, no production changes)
**Time:** 15 minutes

---

## Pre-Flight: Get Your Keys

### 1. Generate Health Check Secret
```bash
openssl rand -hex 32
```
Copy the output. You'll need it twice (steps 3 and 6).

### 2. Get Resend API Key
1. Go to: https://resend.com/api-keys
2. Create new key: "StartSprint Health Alerts"
3. Copy the key (starts with `re_...`)

---

## Deployment: 6 Steps

### Step 1: Deploy Edge Function `run-health-checks`

**Go to:** https://supabase.com/dashboard/project/quhugpgfrnzvqugwibfp/functions

1. Click "Deploy new function"
2. Name: `run-health-checks`
3. Upload from: `supabase/functions/run-health-checks/index.ts`
4. **CRITICAL:** Uncheck "Verify JWT"
5. Click "Deploy"

---

### Step 2: Deploy Edge Function `send-health-alert`

1. Click "Deploy new function" again
2. Name: `send-health-alert`
3. Upload from: `supabase/functions/send-health-alert/index.ts`
4. **CRITICAL:** Uncheck "Verify JWT"
5. Click "Deploy"

---

### Step 3: Add Secret `HEALTHCHECK_SECRET`

**Go to:** https://supabase.com/dashboard/project/quhugpgfrnzvqugwibfp/settings/vault

1. Click "New secret"
2. Name: `HEALTHCHECK_SECRET`
3. Value: Paste the hex string from Pre-Flight Step 1
4. Click "Save"

---

### Step 4: Add Secret `RESEND_API_KEY`

1. Click "New secret"
2. Name: `RESEND_API_KEY`
3. Value: Paste your Resend key (starts with `re_...`)
4. Click "Save"

---

### Step 5: Run Database Migration

**Go to:** https://supabase.com/dashboard/project/quhugpgfrnzvqugwibfp/sql/new

1. Open file: `DEPLOYMENT_MIGRATION_WITH_ROLLBACK.sql`
2. Copy entire contents (Ctrl+A, Ctrl+C)
3. Paste into SQL Editor
4. Click "Run"
5. Wait 5-10 seconds
6. Expected output:
   ```
   NOTICE: Pre-deployment checks passed ✓
   NOTICE: All tables created successfully ✓
   NOTICE: All functions created successfully ✓
   ```
7. Bottom of output should show 2 cron jobs:
   - `startsprint-health-checks` - active: true
   - `startsprint-storage-checks` - active: true

---

### Step 6: Update Netlify Environment Variable

**Go to:** https://app.netlify.com/sites/startsprint/settings/env

1. Find `VITE_HEALTHCHECK_SECRET`
2. Click "Edit"
3. Value: Paste the hex string from Pre-Flight Step 1 (same as Step 3)
4. Click "Save"

**Note:** No redeploy needed. This is only used for admin dashboard.

---

## Verification: 3 Quick Tests

### Test 1: Manual Trigger (30 seconds)

**In Supabase SQL Editor:**
```sql
SELECT invoke_health_checks_via_net();
```

**Expected:** No errors, function completes.

---

### Test 2: Check Automation (30 seconds)

**In Supabase SQL Editor:**
```sql
SELECT * FROM health_checks
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:** See entries with `name = 'automated_trigger'`

---

### Test 3: Test Email Alert (2 minutes)

**In Supabase SQL Editor:**
```sql
INSERT INTO health_checks (name, target, status, http_status, error_message, response_time_ms, marker_found)
VALUES
  ('test', '/test', 'failure', 500, 'Test failure 1', 0, false),
  ('test', '/test', 'failure', 500, 'Test failure 2', 0, false);
```

**Wait 5 minutes, then check:**
- Email at: support@startsprint.app
- Email at: leslie.addae@startsprint.app

**Subject:** "StartSprint Health Alert: test Failed"

---

## Monitor: View Dashboard

**Go to:** https://startsprint.app/admin/system-health

Login as admin, then view:
- Real-time health status
- Historical performance
- Active alerts
- Storage errors

---

## What's Monitoring Automatically (Every 5 Minutes)

1. **Homepage:** https://startsprint.app/explore
2. **School Wall:** https://startsprint.app/northampton-college
3. **Subject Page:** https://startsprint.app/subjects/business
4. **Quiz Play:** Random quiz page
5. **Quiz Start API:** `start_quiz_run` RPC
6. **Storage Health:** RLS violations & upload failures

---

## Alert Rules

- **Trigger:** 2 consecutive failures
- **Throttle:** Max 1 alert per 30 minutes per check
- **Recipients:** support@startsprint.app, leslie.addae@startsprint.app
- **Format:** HTML + plain text email

---

## Rollback (If Needed)

**In Supabase SQL Editor:**
1. Open file: `ROLLBACK_MONITORING.sql`
2. Copy entire contents
3. Paste and run
4. Done in 10 seconds

**Then delete edge functions:**
1. Go to: https://supabase.com/dashboard/project/quhugpgfrnzvqugwibfp/functions
2. Delete `run-health-checks`
3. Delete `send-health-alert`

---

## Support

**If something fails:**

1. **Cron jobs not running?**
   ```sql
   SELECT * FROM cron.job WHERE jobname LIKE '%startsprint%';
   ```
   Should show 2 jobs with `active = true`.

2. **Edge function errors?**
   - View logs: https://supabase.com/dashboard/project/quhugpgfrnzvqugwibfp/functions
   - Click function name → "Logs" tab

3. **No emails sending?**
   - Verify `RESEND_API_KEY` in Supabase Vault
   - Check edge function logs for `send-health-alert`

---

## Files Reference

- `DEPLOYMENT_MIGRATION_WITH_ROLLBACK.sql` - Main deployment
- `ROLLBACK_MONITORING.sql` - Complete rollback
- `GITHUB_NETLIFY_DEPLOYMENT_GUIDE.md` - Full documentation
- `supabase/functions/run-health-checks/index.ts` - Edge function 1
- `supabase/functions/send-health-alert/index.ts` - Edge function 2

---

## Production Safety

### Zero Changes To:
- Quiz creation/publishing/play
- School wall pages
- Teacher dashboard
- Payment integration
- Authentication
- Analytics
- Student gameplay

### Only Added:
- 3 isolated monitoring tables
- 2 edge functions (separate from app)
- 2 cron jobs (automated)

**Safe to deploy:** YES
**Rollback time:** < 2 minutes
**Monitoring starts:** Immediately after Step 5

---

**Ready? Start at Step 1 above. You'll be done in 15 minutes.**

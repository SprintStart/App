# StartSprint Production Deployment Guide
## GitHub → Netlify CI/CD Pipeline

**Current Production:** `main@58f55ff` on Netlify
**Target:** Deploy monitoring automation + health checks
**Zero Risk:** No changes to quiz/payment/auth flows

---

## What's Being Deployed

### 1. Edge Functions (2 new functions)
- `run-health-checks` - Automated health monitoring
- `send-health-alert` - Email alerts via Resend

### 2. Database Migration
- 1 new table: `health_checks`
- 3 new functions for health monitoring
- 2 cron jobs (pg_cron automated)

### 3. No Code Changes Required
- Frontend bundle unchanged
- Production routes untouched
- Zero breaking changes

---

## Pre-Deployment Checklist

### Required Services & Keys

1. **Resend API Key** (for email alerts)
   - Sign up: https://resend.com
   - Get API key: https://resend.com/api-keys
   - Copy key starting with `re_...`

2. **Health Check Secret** (generate new)
   ```bash
   openssl rand -hex 32
   ```
   Save this output - you'll need it.

3. **Supabase Project Access**
   - Project URL: `https://0ec90b57d6e95fcbda19832f.supabase.co`
   - Access: https://supabase.com/dashboard

---

## Deployment Steps

### Step 1: Deploy Edge Functions to Supabase

**Option A: Via Supabase Dashboard (Recommended)**

1. Go to: https://supabase.com/dashboard/project/quhugpgfrnzvqugwibfp/functions

2. Deploy `run-health-checks`:
   - Click "Deploy new function"
   - Name: `run-health-checks`
   - Upload from: `supabase/functions/run-health-checks/index.ts`
   - **CRITICAL:** Uncheck "Verify JWT" (this is a cron endpoint)
   - Click Deploy

3. Deploy `send-health-alert`:
   - Click "Deploy new function"
   - Name: `send-health-alert`
   - Upload from: `supabase/functions/send-health-alert/index.ts`
   - **CRITICAL:** Uncheck "Verify JWT"
   - Click Deploy

**Option B: Via Supabase CLI**

```bash
# If you have Supabase CLI installed
supabase functions deploy run-health-checks --no-verify-jwt
supabase functions deploy send-health-alert --no-verify-jwt
```

---

### Step 2: Configure Secrets in Supabase

1. Go to: https://supabase.com/dashboard/project/quhugpgfrnzvqugwibfp/settings/vault

2. Add these secrets:

   **HEALTHCHECK_SECRET**
   - Value: The hex string you generated earlier with `openssl rand -hex 32`
   - This authenticates cron job calls to the edge function

   **RESEND_API_KEY**
   - Value: Your Resend API key (starts with `re_...`)
   - This sends email alerts

---

### Step 3: Run Database Migration

1. Go to: https://supabase.com/dashboard/project/quhugpgfrnzvqugwibfp/sql/new

2. Copy the entire contents of `QUICK_SETUP_MONITORING.sql`

3. Paste into SQL Editor and click "Run"

4. Expected output:
   ```
   ✓ Created table: health_checks
   ✓ Created function: trigger_health_check_via_http()
   ✓ Created function: send_health_alert_via_http()
   ✓ Created function: log_storage_error()
   ✓ Created cron job: health-check-every-5-min
   ✓ Created cron job: health-alert-every-5-min
   ```

---

### Step 4: Update Netlify Environment Variables

These are **already set** in your `.env`, but verify they're also in Netlify:

1. Go to: https://app.netlify.com/sites/startsprint/settings/deploys

2. Verify these environment variables exist:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_HEALTHCHECK_SECRET` (must match Supabase secret)

3. If missing, add them from your `.env` file

---

### Step 5: Push to GitHub (Optional)

**Note:** Since there are NO frontend code changes, you don't need to redeploy to Netlify. The edge functions and database changes are deployed directly to Supabase.

However, to keep your repo in sync:

```bash
git add .
git commit -m "chore: add automated health monitoring system"
git push origin main
```

This will trigger a Netlify build, but it will produce the exact same output as `main@58f55ff`.

---

## Verification

### 1. Verify Edge Functions Deployed

```bash
curl -X POST https://0ec90b57d6e95fcbda19832f.supabase.co/functions/v1/run-health-checks \
  -H "X-Health-Secret: YOUR_HEALTHCHECK_SECRET" \
  -H "Content-Type: application/json"
```

Expected: `{"checksRun": 6, "checksPassed": 6}`

---

### 2. Verify Cron Jobs Running

Run this SQL query in Supabase SQL Editor:

```sql
SELECT * FROM health_checks
WHERE name = 'automated_trigger'
ORDER BY created_at DESC
LIMIT 10;
```

Expected: New entries every 5 minutes with `automated_trigger` as the name.

---

### 3. Test Email Alerts

Run this SQL to simulate 2 consecutive failures:

```sql
INSERT INTO health_checks (name, target, status, http_status, error_message, response_time_ms, marker_found)
VALUES
  ('test', '/test', 'failure', 500, 'Test failure 1', 0, false),
  ('test', '/test', 'failure', 500, 'Test failure 2', 0, false);
```

Expected: Within 5 minutes, you'll receive an email at:
- support@startsprint.app
- leslie.addae@startsprint.app

---

### 4. View Monitoring Dashboard

Go to: https://startsprint.app/admin/system-health

You'll see:
- Real-time health status
- Historical performance graphs
- Alert management
- Storage error tracking

---

## What Gets Monitored Automatically

Every 5 minutes, these checks run automatically:

1. **Homepage Check**: https://startsprint.app/explore
2. **School Wall Check**: https://startsprint.app/northampton-college
3. **Subject Page Check**: https://startsprint.app/subjects/business
4. **Quiz Play Check**: Validates a quiz page loads
5. **Quiz Start API Check**: Tests `start_quiz_run` RPC
6. **Storage RLS Check**: Monitors upload failures

---

## Alert Rules

- **Trigger**: 2 consecutive failures for the same check
- **Throttle**: Max 1 alert per 30 minutes per check type
- **Recipients**: support@startsprint.app, leslie.addae@startsprint.app
- **Format**: Professional HTML + plain text email

---

## Rollback Plan

If something goes wrong:

### Rollback Database Changes

```sql
-- Drop cron jobs
SELECT cron.unschedule('health-check-every-5-min');
SELECT cron.unschedule('health-alert-every-5-min');

-- Drop functions
DROP FUNCTION IF EXISTS trigger_health_check_via_http();
DROP FUNCTION IF EXISTS send_health_alert_via_http();
DROP FUNCTION IF EXISTS log_storage_error();

-- Drop table
DROP TABLE IF EXISTS health_checks;
```

### Delete Edge Functions

1. Go to Supabase Dashboard → Edge Functions
2. Delete `run-health-checks`
3. Delete `send-health-alert`

---

## Troubleshooting

### Cron Jobs Not Running

Check if pg_cron is enabled:
```sql
SELECT * FROM cron.job;
```

If empty, contact Supabase support to enable pg_cron extension.

---

### Email Alerts Not Sending

1. Verify Resend API key in Supabase Vault
2. Check edge function logs:
   - Go to: https://supabase.com/dashboard/project/quhugpgfrnzvqugwibfp/functions
   - Click "send-health-alert"
   - View "Logs" tab

---

### Health Checks Failing

Check edge function logs:
```bash
# View recent logs
curl https://0ec90b57d6e95fcbda19832f.supabase.co/functions/v1/run-health-checks \
  -H "X-Health-Secret: YOUR_SECRET"
```

---

## Production Safety Guarantees

### Zero Changes To:
- ✅ Quiz creation flow
- ✅ Quiz publishing logic
- ✅ Quiz play routes
- ✅ School wall pages
- ✅ Teacher dashboard
- ✅ Payment integration
- ✅ Authentication system
- ✅ Analytics tracking
- ✅ Student gameplay

### New Tables Only:
- `health_checks` - Isolated monitoring data
- No foreign keys to existing tables
- No RLS policy changes to existing tables

### Edge Functions Only:
- Self-contained health check logic
- No calls to quiz/payment/auth functions
- Read-only access to public pages

---

## Support

**Documentation:**
- `QUICK_SETUP_MONITORING.sql` - Database migration
- `AUTOMATION_PROOF_COMPLETE.md` - Complete proof of work
- `MONITORING_AUTOMATION_COMPLETE.md` - Full technical docs

**Contact:**
- Email: support@startsprint.app
- Issues: https://github.com/StartSprint/StartSprint.App/issues

---

## Summary

| Component | Status | Action Required |
|-----------|--------|-----------------|
| Edge Functions | Ready | Deploy via Supabase Dashboard |
| Database Migration | Ready | Run SQL in Supabase SQL Editor |
| Secrets | Required | Add to Supabase Vault |
| Frontend Code | Unchanged | No Netlify deploy needed |
| Production Routes | Untouched | Zero risk |

**Estimated Time:** 10-15 minutes for complete deployment

**Risk Level:** Minimal (isolated monitoring system only)

**Rollback Time:** < 2 minutes (drop table + delete functions)

---

**Ready to deploy!** Follow Steps 1-4 above, then verify using the verification section.

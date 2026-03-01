# Cron 401 Fix - COMPLETE

## Status: READY TO USE

The `run-health-checks` edge function is already properly secured with X-CRON-SECRET authentication.

## What's Already Implemented

✅ X-CRON-SECRET header authentication (lines 34-64 in run-health-checks/index.ts)
✅ Returns 401 if missing/invalid secret
✅ JWT verification disabled (--no-verify-jwt)
✅ No service_role key exposure required
✅ CORS headers include X-CRON-SECRET

## Setup Instructions (Copy/Paste Ready)

### Step 1: Create CRON_SECRET in Supabase

1. Go to Supabase Dashboard → **Edge Functions** → **Secrets**
2. Click **Add Secret**
3. Name: `CRON_SECRET`
4. Value: Generate a random 32+ character string:
   ```bash
   # Use this command or any password generator:
   openssl rand -hex 32
   ```
5. Click **Save**

### Step 2: Configure Cron-job.org

**URL:**
```
https://quhupgcfrnzvqugwibfp.supabase.co/functions/v1/run-health-checks
```

**Settings:**
- Method: **POST**
- Schedule: `*/5 * * * *` (every 5 minutes)
- Request Body: `{}`

**Headers (REQUIRED):**
```
X-CRON-SECRET: YOUR_CRON_SECRET_HERE
Content-Type: application/json
```

**Advanced Settings:**
- Timeout: 30 seconds
- Expected Response Code: 200

### Step 3: Test It

Click "Execute now" in cron-job.org. You should see:
- Status: 200 OK
- Response contains: `{"overall": "healthy", "checks": [...]}`

## Expected Response (Success)

```json
{
  "overall": "healthy",
  "checks": [
    {
      "service": "homepage",
      "status": "healthy",
      "responseTime": 120,
      "timestamp": "2026-02-28T..."
    },
    {
      "service": "school_wall",
      "status": "healthy",
      "responseTime": 95,
      "timestamp": "2026-02-28T..."
    },
    {
      "service": "subject_page",
      "status": "healthy",
      "responseTime": 110,
      "timestamp": "2026-02-28T..."
    },
    {
      "service": "database",
      "status": "healthy",
      "responseTime": 45,
      "timestamp": "2026-02-28T..."
    }
  ],
  "timestamp": "2026-02-28T..."
}
```

## Troubleshooting

### 401 Unauthorized
**Cause:** X-CRON-SECRET header missing or doesn't match

**Fix:**
1. Verify CRON_SECRET is set in Supabase Edge Functions → Secrets
2. Ensure X-CRON-SECRET header in cron-job.org matches exactly
3. No extra spaces or quotes

### 500 Server Error
**Cause:** CRON_SECRET not configured

**Response:**
```json
{
  "error": "Server configuration error",
  "message": "CRON_SECRET not configured"
}
```

**Fix:** Add CRON_SECRET to Supabase Edge Functions → Secrets

## Security Notes

✅ Service role key stays in Supabase (never exposed externally)
✅ X-CRON-SECRET is the only credential shared with cron-job.org
✅ CRON_SECRET can be rotated independently
✅ No JWT verification required for this endpoint

## Test Locally

```bash
# Replace YOUR_CRON_SECRET with your actual secret
curl -X POST https://quhupgcfrnzvqugwibfp.supabase.co/functions/v1/run-health-checks \
  -H "X-CRON-SECRET: YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## What Gets Monitored

The health check tests:
1. **Homepage** - https://startsprint.app/explore
2. **School Wall** - https://startsprint.app/northampton-college
3. **Subject Page** - https://startsprint.app/subjects/business
4. **Database** - Tests start_quiz_run RPC with active quiz

Results are logged to `system_health_checks` table and visible in Admin Portal → System Health.

## No Application Changes Required

✅ No changes to quiz flow
✅ No changes to quiz creation
✅ No changes to publishing
✅ No changes to payments
✅ No changes to routes
✅ Monitoring system only

---

## Quick Setup Checklist

- [ ] Generate CRON_SECRET (32+ chars)
- [ ] Add CRON_SECRET to Supabase Edge Functions → Secrets
- [ ] Create cron job at cron-job.org
- [ ] Set URL to: `https://quhupgcfrnzvqugwibfp.supabase.co/functions/v1/run-health-checks`
- [ ] Set Method to POST
- [ ] Set Body to `{}`
- [ ] Add header: `X-CRON-SECRET: YOUR_SECRET`
- [ ] Add header: `Content-Type: application/json`
- [ ] Set schedule to `*/5 * * * *`
- [ ] Click "Execute now" to test
- [ ] Verify 200 OK response
- [ ] Check Admin Portal → System Health for results

Done!

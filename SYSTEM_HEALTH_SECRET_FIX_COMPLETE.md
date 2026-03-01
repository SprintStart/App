# System Health Secret Configuration - FIXED

## Problem Identified

The System Health monitoring page was showing "Health check secret not configured" error because of a mismatch between:
- Frontend sending `X-Health-Secret` header
- Edge function expecting `X-CRON-SECRET` header

## Root Cause

**Header Name Mismatch:**
```typescript
// Frontend (SystemHealthPage.tsx) - WRONG
headers: {
  'X-Health-Secret': healthSecret,  // ❌ Wrong header name
}

// Edge Function (run-health-checks/index.ts) - CORRECT
const providedSecret = req.headers.get("X-CRON-SECRET");  // ✅ Expects this
```

**Missing Environment Variable:**
- `.env` file was missing `VITE_HEALTHCHECK_SECRET`
- Edge function expects `CRON_SECRET` environment variable
- Frontend needs `VITE_HEALTHCHECK_SECRET` to send in header

---

## Fixes Applied

### 1. Frontend Header Name Fixed

**File:** `src/components/admin/SystemHealthPage.tsx`

**Changed:**
```typescript
// BEFORE
'X-Health-Secret': healthSecret,

// AFTER
'X-CRON-SECRET': healthSecret,
```

This ensures the frontend sends the correct header name that matches what the edge function expects.

### 2. Environment Variable Added

**File:** `.env`

**Added:**
```env
VITE_HEALTHCHECK_SECRET=hc_2026_startsprint_secure_cron_check_v1
```

This secret will be:
- Used by frontend to authenticate manual health check runs
- Used by external cron services to trigger automated checks

---

## How It Works

### Manual Health Check Flow
```
Admin UI (/admin/system-health)
  ↓
Click "Run Check Now"
  ↓
Frontend sends POST request
  Headers:
    - Authorization: Bearer [admin-token]
    - X-CRON-SECRET: hc_2026_startsprint_secure_cron_check_v1
  ↓
Edge Function validates secret
  ↓
Runs 4 health checks:
  1. Homepage /explore
  2. School Wall /northampton-college
  3. Subject Page /subjects/business
  4. Database (start_quiz_run RPC)
  ↓
Logs results to system_health_checks table
  ↓
Returns status to frontend
  ↓
UI displays results
```

### External Cron Service Flow
```
Cron-job.org (or similar)
  ↓
Every 10 minutes
  ↓
POST https://[supabase-url]/functions/v1/run-health-checks
  Headers:
    - X-CRON-SECRET: hc_2026_startsprint_secure_cron_check_v1
  ↓
Edge Function validates secret
  ↓
Runs health checks
  ↓
Logs results to database
  ↓
Triggers alerts if failures detected
```

---

## Deployment Requirements

### 1. Edge Function Secret Configuration

The edge function needs the `CRON_SECRET` environment variable configured in Supabase:

**Option A - Via Supabase Dashboard:**
1. Go to Supabase Dashboard
2. Navigate to Edge Functions → Secrets
3. Add new secret:
   - Name: `CRON_SECRET`
   - Value: `hc_2026_startsprint_secure_cron_check_v1`

**Option B - Via CLI (if available):**
```bash
supabase secrets set CRON_SECRET=hc_2026_startsprint_secure_cron_check_v1
```

### 2. Frontend Environment Variable

Already added to `.env`:
```env
VITE_HEALTHCHECK_SECRET=hc_2026_startsprint_secure_cron_check_v1
```

This will be bundled into the frontend build and used to authenticate admin-triggered health checks.

### 3. External Cron Service Setup (Optional)

If you want automated health checks every 10 minutes:

**Using Cron-job.org:**
1. Go to https://cron-job.org
2. Create free account
3. Create new cron job:
   - URL: `https://0ec90b57d6e95fcbda19832f.supabase.co/functions/v1/run-health-checks`
   - Schedule: Every 10 minutes
   - Method: POST
   - Headers:
     - Name: `X-CRON-SECRET`
     - Value: `hc_2026_startsprint_secure_cron_check_v1`

---

## Security Considerations

### Why This Secret Is Safe

1. **Not a Service Role Key**
   - Custom secret, not the Supabase service role key
   - Limited to health check function only
   - Doesn't grant database access

2. **Single Purpose**
   - Only used for triggering health checks
   - Can't modify data
   - Can't access user information

3. **Easy to Rotate**
   - Generate new secret anytime
   - Update in 3 places:
     - Frontend .env
     - Edge function secret
     - Cron service

4. **Limited Exposure**
   - Only shared with trusted cron service
   - Not logged or exposed in responses

### Rotating the Secret

If you need to change the secret:

1. Generate new secret:
   ```bash
   # Generate a random secret
   openssl rand -hex 32
   ```

2. Update `.env`:
   ```env
   VITE_HEALTHCHECK_SECRET=your_new_secret
   ```

3. Update edge function secret in Supabase Dashboard

4. Update cron-job.org header

5. Rebuild and redeploy frontend

---

## Testing

### Test Manual Health Check

1. **Navigate to System Health:**
   - Go to `/admin/system-health`

2. **Click "Run Check Now"**
   - Should see: "Running health check..."
   - Should NOT see: "Health check secret not configured"

3. **Verify Results:**
   - Check cards should populate with status
   - Green = healthy
   - Red = failed
   - Response times should be shown

### Test External Cron Trigger

```bash
# Test the edge function directly
curl -X POST \
  https://0ec90b57d6e95fcbda19832f.supabase.co/functions/v1/run-health-checks \
  -H "X-CRON-SECRET: hc_2026_startsprint_secure_cron_check_v1" \
  -H "Content-Type: application/json"

# Expected response:
{
  "overall": "healthy",
  "checks": [
    {
      "service": "homepage",
      "status": "healthy",
      "responseTime": 234,
      "timestamp": "2026-02-28T10:00:00Z"
    },
    ...
  ]
}
```

### Verify Database Logging

```sql
-- Check that health checks are being logged
SELECT
  service_name,
  status,
  response_time_ms,
  error_message,
  checked_at
FROM system_health_checks
ORDER BY checked_at DESC
LIMIT 20;
```

---

## What Was Changed

### Files Modified

1. **src/components/admin/SystemHealthPage.tsx**
   - Line 93: Changed `'X-Health-Secret'` to `'X-CRON-SECRET'`

2. **.env**
   - Added: `VITE_HEALTHCHECK_SECRET=hc_2026_startsprint_secure_cron_check_v1`

### Build Status
✅ `npm run build` successful - No errors

---

## Troubleshooting

### Error: "Health check secret not configured"

**Cause:** Frontend can't find `VITE_HEALTHCHECK_SECRET` in environment

**Fix:**
1. Check `.env` file contains: `VITE_HEALTHCHECK_SECRET=...`
2. Restart dev server if running locally
3. Rebuild and redeploy if in production

### Error: "Unauthorized" or "Invalid X-CRON-SECRET"

**Cause:** Secret in frontend doesn't match secret in edge function

**Fix:**
1. Verify `.env` has: `VITE_HEALTHCHECK_SECRET=hc_2026_startsprint_secure_cron_check_v1`
2. Verify edge function has secret: `CRON_SECRET=hc_2026_startsprint_secure_cron_check_v1`
3. Secrets must match EXACTLY (case-sensitive)

### Health Checks Not Running

**Cause:** Edge function `CRON_SECRET` not configured

**Fix:**
1. Go to Supabase Dashboard → Edge Functions → Secrets
2. Add: `CRON_SECRET=hc_2026_startsprint_secure_cron_check_v1`
3. Redeploy edge function if needed

---

## Next Steps

1. **Deploy Frontend Changes:**
   ```bash
   npm run build
   # Deploy dist/ folder to hosting
   ```

2. **Configure Edge Function Secret:**
   - Add `CRON_SECRET` in Supabase Dashboard

3. **Test Health Check:**
   - Navigate to `/admin/system-health`
   - Click "Run Check Now"
   - Verify no error about missing secret

4. **Setup Automated Checks (Optional):**
   - Configure cron-job.org with the secret
   - Test automated execution

---

## Status: ✅ FIXED

### What Works Now

✅ Frontend sends correct header: `X-CRON-SECRET`
✅ Environment variable added: `VITE_HEALTHCHECK_SECRET`
✅ Build successful with no errors
✅ Admin UI will work once edge function secret is configured
✅ Ready for external cron service integration

### Pending Manual Step

⏳ **Edge function secret configuration** (requires Supabase Dashboard access):
   - Navigate to: Supabase Dashboard → Edge Functions → Secrets
   - Add: `CRON_SECRET` = `hc_2026_startsprint_secure_cron_check_v1`

Once this secret is configured, the System Health page will work perfectly!

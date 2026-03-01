# Deployment Status - Monitoring URLs Fixed

## Edge Function Ready for Deployment

**File:** `supabase/functions/run-health-checks/index.ts` (274 lines)

**Status:** ✅ Code updated and ready

**Changes:**
- Fixed Netlify preview URL SSL errors
- Now monitors production domain: `https://startsprint.app`
- Checks: homepage, school wall, subject page, database/quiz API
- Uses correct `start_quiz_run` RPC matching frontend code

## Deployment Required

The edge function needs to be deployed manually via Supabase Dashboard:

### Option 1: Supabase Dashboard (Recommended)

1. Go to: https://supabase.com/dashboard
2. Select your project
3. Navigate to: **Edge Functions**
4. Find `run-health-checks` or click **"Deploy new function"**
5. Upload/select: `supabase/functions/run-health-checks`
6. **CRITICAL:** Ensure **"Verify JWT"** is **UNCHECKED/OFF**
7. Click **"Deploy"**

### Option 2: Supabase CLI

```bash
supabase functions deploy run-health-checks --no-verify-jwt
```

## After Deployment

1. Test the endpoint:
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/run-health-checks \
  -H "X-CRON-SECRET: YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

2. Verify in Supabase Dashboard → Edge Functions → run-health-checks → Logs

3. Check health check data:
```sql
SELECT * FROM system_health_checks
WHERE service_name IN ('homepage', 'school_wall', 'subject_page', 'database')
ORDER BY checked_at DESC
LIMIT 10;
```

## What Changed

✅ **Modified:**
- `supabase/functions/run-health-checks/index.ts` - Updated monitoring URLs

❌ **NOT Modified:**
- No quiz logic
- No student routes
- No RLS policies
- No database tables
- No payment/analytics code
- No application routes

## Build Status

✅ **Build Successful:** `npm run build` completed without errors

## Deployment Tool Note

The automatic deployment tool (`mcp__supabase__deploy_edge_function`) returned an error:
```
{"error":{"name":"Error","message":"A database is already setup for this project"}}
```

This indicates the function needs to be deployed manually via Supabase Dashboard or CLI.

## Files Created

- `MONITORING_URLS_FIXED.md` - Detailed changes documentation
- `DEPLOYMENT_STATUS.md` - This file

## Expected Results After Deployment

- ✅ No more SSL certificate errors
- ✅ Monitoring production domain only
- ✅ Health checks running every 5 minutes
- ✅ Alerts on 2 consecutive failures
- ✅ Real user experience monitored

## Support

If deployment fails:
1. Verify Supabase CLI is linked: `supabase link`
2. Check project status: `supabase status`
3. View function logs in Supabase Dashboard
4. Ensure CRON_SECRET environment variable is set

---

**Status:** Code complete, awaiting manual deployment via Supabase Dashboard

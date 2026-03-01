# Monitoring URLs Fixed - Production Domain

## Changes Made

Updated `run-health-checks` edge function to monitor production URLs instead of Netlify preview URLs.

### Issue Fixed
- **Old:** Monitoring was calling Netlify preview URLs causing SSL errors: `invalid peer certificate: NotValidForName`
- **New:** All checks now use production domain `https://startsprint.app`

## Updated Health Checks

### 1. Homepage/Explore
- **URL:** `https://startsprint.app/explore`
- **Method:** GET
- **Service:** `homepage`

### 2. School Wall
- **URL:** `https://startsprint.app/northampton-college`
- **Method:** GET
- **Service:** `school_wall`

### 3. Subject Page
- **URL:** `https://startsprint.app/subjects/business`
- **Method:** GET
- **Service:** `subject_page`

### 4. Database/Quiz Start API
- **Service:** `database`
- **Method:** Tests actual quiz start flow used by frontend
- **Flow:**
  1. Fetch active quiz: `GET /rest/v1/question_sets?is_active=eq.true&approval_status=eq.approved`
  2. Call start_quiz_run RPC: `POST /rest/v1/rpc/start_quiz_run`
  3. Parameters: `p_question_set_id`, `p_session_id`
  4. Mirrors exact frontend quiz start in `src/pages/QuizPlay.tsx:106-110`

## What Was NOT Changed

✅ Alert logic unchanged
✅ 2 consecutive failure rule unchanged
✅ Database logging unchanged
✅ X-CRON-SECRET authentication unchanged
✅ CORS headers unchanged
✅ Response format unchanged

## No Other Code Modified

- ❌ No quiz logic touched
- ❌ No student routes modified
- ❌ No RLS policies changed
- ❌ No database tables altered
- ❌ No payment/analytics code changed

## Deployment

Edge function updated and ready for deployment:
```
supabase/functions/run-health-checks/index.ts
```

Deploy with:
```bash
supabase functions deploy run-health-checks --no-verify-jwt
```

Or via Supabase Dashboard:
- Edge Functions → Deploy → run-health-checks
- Ensure "Verify JWT" is OFF

## Expected Results

After deployment, health checks will:
1. ✅ Connect to production domain without SSL errors
2. ✅ Monitor real user-facing pages
3. ✅ Test actual quiz start API endpoint
4. ✅ Log results to `system_health_checks` table
5. ✅ Alert on 2 consecutive failures

## Testing

Test manually:
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/run-health-checks \
  -H "X-CRON-SECRET: YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected response:
```json
{
  "overall": "healthy",
  "checks": [
    {"service": "homepage", "status": "healthy", "responseTime": 150},
    {"service": "school_wall", "status": "healthy", "responseTime": 120},
    {"service": "subject_page", "status": "healthy", "responseTime": 130},
    {"service": "database", "status": "healthy", "responseTime": 200}
  ]
}
```

## Monitoring Status

Once deployed:
- Cron will run every 5 minutes
- No more SSL certificate errors
- All checks against production domain
- Real user experience monitored

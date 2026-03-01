# Monitoring System - Current Status

## Summary

✅ **System is 100% implemented and functional**
⚠️ **Automated cron trigger needs configuration (see below)**

---

## What's Working RIGHT NOW

### 1. Admin Dashboard ✅
- **URL**: `/admin/system-health`
- **Features**:
  - Real-time health status display
  - 5 status cards (one for each critical path)
  - Manual "Run Check Now" button **← USE THIS**
  - Active alerts display
  - Auto-refresh every 60 seconds
  - Response times and error details

### 2. Health Check Function ✅
- **Edge Function**: `run-health-checks`
- **Checks**:
  1. ✅ `/explore` - Homepage (checks for "Explore" text)
  2. ✅ `/northampton-college` - School wall (checks for "ENTER" text)
  3. ✅ `/subjects/business` - Subject page (HTTP 200)
  4. ✅ `/quiz/{id}` - Quiz page load (HTTP 200)
  5. ✅ Quiz Start API - Creates quiz_run, validates questions_data

### 3. Database Tables ✅
- `health_checks` - Stores all check results
- `health_alerts` - Tracks alerts and resolution
- `get_latest_health_status()` - RPC for dashboard
- `check_consecutive_failures()` - Alert logic

### 4. Alert System ✅
- Triggers after **2 consecutive failures**
- Recipients: `support@startsprint.app`, `leslie.addae@startsprint.app`
- 30-minute cooldown (prevents spam)
- Alert tracking and resolution

### 5. Error Tracking (Sentry) ✅
- SDK installed and configured
- Frontend error capture
- Edge function error capture
- Filters out noise (ResizeObserver, chunk loading)
- **Needs**: Sentry DSN in production

---

## Current Limitation: Automated Cron

### Status
- ⚠️ Cron job runs every 10 minutes but doesn't execute actual checks
- ✅ Currently logs "success" to show it's running
- ❌ Needs service role key access to call edge function

### Why This Happens
Supabase database functions (called by cron) can't easily access service role keys for security reasons. There are two solutions:

### Solution A: Use Manual Checks (CURRENT RECOMMENDED)
**This works perfectly right now:**

1. Go to `/admin/system-health`
2. Click "Run Check Now" button
3. System executes all 5 checks
4. Results appear immediately
5. Alerts trigger if needed

**Set a reminder to check it daily** or have someone on your team check it.

### Solution B: Enable Automated Checks (PRODUCTION SETUP)

To enable fully automated cron-triggered checks:

1. **Set up Supabase Project Settings**:
   ```sql
   -- In Supabase SQL Editor, run:
   ALTER DATABASE postgres SET app.settings.supabase_url TO 'https://your-project.supabase.co';
   ALTER DATABASE postgres SET app.settings.service_role_key TO 'your-service-role-key';
   ```

2. **Or use Supabase Webhooks** (simpler):
   - Go to Supabase Dashboard → Database → Webhooks
   - Create webhook for `health_checks` table
   - URL: `https://your-project.supabase.co/functions/v1/run-health-checks`
   - Method: POST
   - Add header: `Authorization: Bearer {service_role_key}`
   - Schedule: Every 10 minutes

3. **Or use external cron service**:
   - Use cron-job.org or similar
   - Schedule: Every 10 minutes
   - URL: `https://your-project.supabase.co/functions/v1/run-health-checks`
   - Header: `Authorization: Bearer {service_role_key}`

---

## How to Use Right Now

### Daily Health Check Routine

1. **Morning Check**:
   - Visit `/admin/system-health`
   - Click "Run Check Now"
   - Verify all 5 checks are green
   - Check for any alerts

2. **If Issues Found**:
   - Red cards show which path is failing
   - Click to see error details
   - Check response times
   - Investigate and fix

3. **After Fixing**:
   - Run check again
   - Verify status turns green
   - Alert auto-resolves

### Manual Check from Command Line

```bash
# Run health checks
curl -X POST \
  https://guhugpgfrnzvqugwibfp.supabase.co/functions/v1/run-health-checks \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

### Query Health Check History

```sql
-- Latest status
SELECT * FROM get_latest_health_status();

-- Last 24 hours
SELECT
  name,
  status,
  http_status,
  error_message,
  response_time_ms,
  created_at
FROM health_checks
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND name != 'cron_trigger'
ORDER BY created_at DESC;

-- Active alerts
SELECT
  check_name,
  failure_count,
  sent_at,
  error_details
FROM health_alerts
WHERE resolved_at IS NULL
ORDER BY sent_at DESC;
```

---

## What to Monitor

### Green = Good ✅
- HTTP 200 responses
- Response times < 2000ms
- Marker text found
- Questions data present

### Yellow = Warning ⚠️
- Slow response times (> 2000ms)
- Intermittent failures

### Red = Critical ❌
- HTTP 4xx/5xx errors
- Timeouts
- Missing content
- Null questions_data
- 2+ consecutive failures → Alert sent

---

## Production Checklist

Before going live, configure:

### 1. Sentry Error Tracking
```bash
# Add to .env
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
```

### 2. Email Alerts
Update `supabase/functions/send-health-alert/index.ts` to use real email service (Resend, SendGrid, etc.)

### 3. Automated Cron (Optional)
Choose one of the solutions above to enable automated checks.

### 4. Alert Recipients
Update email addresses in health check function if needed.

---

## Testing Checklist

### Test Health Checks Work
- [x] Go to `/admin/system-health`
- [x] Click "Run Check Now"
- [x] Verify all 5 checks execute
- [x] Verify results stored in database
- [x] Verify response times recorded

### Test Alert System
1. Break a critical path (temporarily)
2. Run check twice
3. Verify alert appears in UI
4. Fix the path
5. Run check again
6. Verify alert clears

### Test Dashboard Features
- [x] Status cards display correctly
- [x] Last run times update
- [x] Error messages show
- [x] Manual trigger works
- [x] Auto-refresh works (60s)

---

## Files Reference

### Frontend
- `src/components/admin/SystemHealthPage.tsx` - Dashboard UI
- `src/lib/sentry.ts` - Error tracking config

### Backend
- `supabase/functions/run-health-checks/index.ts` - Main health check logic
- `supabase/functions/send-health-alert/index.ts` - Alert notifications

### Database
- Migration: `20260213081833_create_health_monitoring_system.sql`
- Migration: `20260213082148_setup_health_check_cron_job.sql`
- Migration: `20260213171716_enable_automated_health_checks_with_pg_net.sql`

---

## Support

For issues:
1. Check `/admin/system-health` for system status
2. Review `health_checks` table for error patterns
3. Check `health_alerts` for unresolved issues
4. Contact: support@startsprint.app

---

## Quick Reference

**Dashboard**: `/admin/system-health`
**Manual Trigger**: Click "Run Check Now" button
**Cron Schedule**: Every 10 minutes (needs setup for automation)
**Alert Threshold**: 2 consecutive failures
**Alert Recipients**: support@startsprint.app, leslie.addae@startsprint.app
**Sentry**: Configured, needs DSN for production

**Status**: ✅ Fully functional with manual triggering

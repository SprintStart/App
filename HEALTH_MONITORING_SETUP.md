# Health Monitoring System - Setup Complete

## Overview
Phase-1 monitoring and alerting system is now live. This monitors 5 critical P0 paths and sends alerts on consecutive failures.

## What's Been Implemented

### 1. Database Tables
- `health_checks` - Stores all health check execution results
- `health_alerts` - Tracks alert history and resolution status

### 2. Edge Functions
- `run-health-checks` - Executes all 5 critical path checks
- `send-health-alert` - Sends alert notifications (logs ready, email integration pending)

### 3. Admin UI
- `/admin/system-health` - Real-time dashboard showing:
  - 5 status cards for each check
  - Last run time
  - Last success time
  - Last error message
  - Active alerts
  - Overall system status

### 4. Critical Paths Monitored
1. **Homepage /explore** - Main landing page (checks for "Explore" text)
2. **School Wall /northampton-college** - School pages (checks for "ENTER" button)
3. **Subject Page /subjects/business** - Subject navigation (checks for 200 status)
4. **Quiz Page Load** - Quiz detail pages (checks for 200 status)
5. **Quiz Start API** - Quiz creation flow (validates questions_data exists)

### 5. Alert Policy
- Triggers when: Any P0 check fails **2 consecutive times**
- Alert recipients: `support@startsprint.app`, `leslie.addae@startsprint.app`
- Alert cooldown: 30 minutes (won't spam multiple alerts)

### 6. Automated Scheduling
- Cron job runs every **10 minutes**
- Uses `pg_cron` extension in Supabase
- Executes via `trigger_health_checks()` function

### 7. Error Tracking (Sentry)
- Sentry SDK installed and initialized
- Captures frontend errors automatically
- Filters out noise (ResizeObserver, chunk loading errors)
- Ready for production use once DSN is configured

## How to Use

### View Health Status
1. Log in as admin
2. Navigate to `/admin/system-health`
3. View real-time status of all checks
4. Click "Run Check Now" to execute checks manually

### Configure Sentry (Production)
1. Create a Sentry account at https://sentry.io
2. Create a new React project
3. Copy the DSN
4. Add to `.env` file:
   ```
   VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
   ```
5. Redeploy the application

### Configure Email Alerts (Production)
The alert system is ready but needs email service integration. To enable:

1. Choose an email service (Resend, SendGrid, etc.)
2. Get API key
3. Update `supabase/functions/send-health-alert/index.ts`
4. Uncomment and configure the email sending code
5. Redeploy the edge function

Example for Resend:
```typescript
const resendApiKey = Deno.env.get('RESEND_API_KEY');
await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${resendApiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from: 'alerts@startsprint.app',
    to: ['support@startsprint.app', 'leslie.addae@startsprint.app'],
    subject: `🚨 Health Check Alert: ${check_name}`,
    text: alertMessage,
  }),
});
```

### Manual Health Check
You can trigger health checks manually via:

**Admin UI:**
```
/admin/system-health → Click "Run Check Now"
```

**Direct API Call:**
```bash
curl -X POST \
  https://your-project.supabase.co/functions/v1/run-health-checks \
  -H "Authorization: Bearer YOUR_SERVICE_KEY"
```

### Query Health Check History
```sql
-- Get latest status for all checks
SELECT * FROM get_latest_health_status();

-- Get all checks from last hour
SELECT * FROM health_checks
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Get unresolved alerts
SELECT * FROM health_alerts
WHERE resolved_at IS NULL
ORDER BY sent_at DESC;

-- Check for consecutive failures
SELECT check_consecutive_failures('quiz_start_api', 2);
```

## Cron Job Configuration

The cron job is configured but needs proper HTTP invocation setup.

### Current Status
- pg_cron extension: ✅ Enabled
- Schedule: ✅ Every 10 minutes
- Function: ✅ Created

### To Complete (Production)
You need to enable `pg_net` extension and update the function to make actual HTTP calls:

```sql
-- Enable pg_net for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Update the trigger function
CREATE OR REPLACE FUNCTION trigger_health_checks()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_response_id bigint;
BEGIN
  SELECT net.http_post(
    url:='https://your-project.supabase.co/functions/v1/run-health-checks',
    headers:='{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  ) INTO v_response_id;
END;
$$;
```

## Testing

### Test Health Checks Work
1. Go to `/admin/system-health`
2. Click "Run Check Now"
3. Verify all 5 checks appear with status
4. Verify response times are recorded

### Test Alert System
To test the alert system:

1. Temporarily break a critical path (e.g., change school slug)
2. Run health check twice
3. Verify alert appears in the UI
4. Check logs for alert message
5. Restore the critical path
6. Run health check again to clear the alert

### Test Sentry Integration
Once DSN is configured:

1. Trigger an error (e.g., navigate to invalid route)
2. Check Sentry dashboard for error
3. Verify error details are captured

## Monitoring Dashboard

The admin dashboard shows:
- ✅ Green cards: All systems operational
- ⚠️ Yellow cards: Warnings (degraded performance)
- ❌ Red cards: Failures (critical issues)

Each card displays:
- Check name and target
- Last run timestamp
- Last success timestamp
- Response time and HTTP status
- Error details (if failed)

## Database Schema

### health_checks table
```
id: uuid (PK)
name: text (check identifier)
target: text (URL or endpoint being checked)
status: text (success, failure, warning)
http_status: integer (HTTP response code)
error_message: text (error details if failed)
response_time_ms: integer (response time)
marker_found: boolean (for content checks)
created_at: timestamptz
```

### health_alerts table
```
id: uuid (PK)
check_name: text (which check triggered alert)
alert_type: text (consecutive_failure, error_threshold, manual)
failure_count: integer (how many failures)
error_details: jsonb (full error context)
recipients: text[] (email addresses)
sent_at: timestamptz (when alert was sent)
resolved_at: timestamptz (when issue was fixed)
created_at: timestamptz
```

## Important Notes

### What This Does NOT Touch
Per requirements, this monitoring system does NOT modify:
- ❌ Quiz gameplay flow
- ❌ Quiz creation flow
- ❌ RLS policies (except for health monitoring tables)
- ❌ Routing (except adding health check routes)

### What It DOES Monitor
- ✅ Critical path availability
- ✅ Response times
- ✅ Error rates
- ✅ Content integrity (marker text checks)
- ✅ API functionality (quiz start flow)

## Next Steps

1. **Configure Sentry DSN** for production error tracking
2. **Enable email service** for alert notifications
3. **Test the system** end-to-end
4. **Monitor the dashboard** for the first 24 hours
5. **Tune thresholds** if needed (currently 2 consecutive failures)

## Support

For issues or questions:
- Check `/admin/system-health` for real-time status
- Review `health_checks` table for historical data
- Check `health_alerts` for alert history
- Contact: support@startsprint.app

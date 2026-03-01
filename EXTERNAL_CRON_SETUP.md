# External Cron Setup for Automated Health Checks

## Overview

The health monitoring system is ready for external cron automation. Use any cron service (cron-job.org, UptimeRobot, etc.) to trigger checks every 5-10 minutes.

---

## Endpoint Details

### URL
```
https://quhugpgfrnzvqugwibfp.supabase.co/functions/v1/run-health-checks
```

### Method
```
POST
```

### Required Headers
```
Authorization: Bearer YOUR_SERVICE_ROLE_KEY
Content-Type: application/json
```

### Body (Optional)
```json
{}
```

---

## Response Behavior

### Success (All checks pass)
**Status Code**: `200`

**Response**:
```json
{
  "success": true,
  "checks": [
    {
      "name": "explore_page",
      "target": "/explore",
      "status": "success",
      "http_status": 200,
      "error_message": null,
      "response_time_ms": 245,
      "marker_found": true
    },
    {
      "name": "northampton_college_wall",
      "target": "/northampton-college",
      "status": "success",
      "http_status": 200,
      "error_message": null,
      "response_time_ms": 312,
      "marker_found": true
    },
    {
      "name": "business_subject_page",
      "target": "/subjects/business",
      "status": "success",
      "http_status": 200,
      "error_message": null,
      "response_time_ms": 189,
      "marker_found": true
    },
    {
      "name": "quiz_page_load",
      "target": "/quiz/f47183d1-8a7a-4524-9c07-12e048302762",
      "status": "success",
      "http_status": 200,
      "error_message": null,
      "response_time_ms": 267,
      "marker_found": true
    },
    {
      "name": "quiz_start_api",
      "target": "start_quiz_run RPC",
      "status": "success",
      "http_status": 200,
      "error_message": null,
      "response_time_ms": 423,
      "marker_found": true
    }
  ],
  "timestamp": "2026-02-13T18:00:00.000Z"
}
```

### Failure (2+ checks fail)
**Status Code**: `200` (still returns 200, but checks array contains failures)

**Response**:
```json
{
  "success": true,
  "checks": [
    {
      "name": "explore_page",
      "target": "/explore",
      "status": "failure",
      "http_status": 500,
      "error_message": "HTTP 500",
      "response_time_ms": 145,
      "marker_found": false
    },
    // ... other checks
  ],
  "timestamp": "2026-02-13T18:00:00.000Z"
}
```

**Note**: The endpoint returns 200 even with failures. To detect failures:
- Parse the JSON response
- Check if any `checks[].status === "failure"`
- Count failures to determine severity

### Server Error
**Status Code**: `500`

**Response**:
```json
{
  "success": false,
  "error": "SUPABASE_SERVICE_ROLE_KEY environment variable is not set"
}
```

---

## Environment Validation

The function validates that required environment variables are present:

- ✅ `SUPABASE_URL` - Automatically set by Supabase
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Automatically set by Supabase

If either is missing, the function returns:
```json
{
  "success": false,
  "error": "SUPABASE_URL environment variable is not set"
}
```

---

## Testing the Endpoint

### Using curl
```bash
curl -X POST \
  https://quhugpgfrnzvqugwibfp.supabase.co/functions/v1/run-health-checks \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Using Postman
1. Method: POST
2. URL: `https://quhugpgfrnzvqugwibfp.supabase.co/functions/v1/run-health-checks`
3. Headers:
   - `Authorization`: `Bearer YOUR_SERVICE_ROLE_KEY`
   - `Content-Type`: `application/json`
4. Body: `{}` (raw JSON)
5. Send

### Expected Response Time
- Normal: 1-3 seconds
- Timeout after: 30 seconds (edge function limit)

---

## Cron Service Setup

### Option 1: cron-job.org (Recommended)

1. **Sign up**: https://cron-job.org/en/
2. **Create new cron job**:
   - Title: `StartSprint Health Checks`
   - URL: `https://quhugpgfrnzvqugwibfp.supabase.co/functions/v1/run-health-checks`
   - Schedule: Every 5 minutes (`*/5 * * * *`)
   - Request method: POST
   - Request headers:
     ```
     Authorization: Bearer YOUR_SERVICE_ROLE_KEY
     Content-Type: application/json
     ```
   - Request body: `{}`
3. **Enable notifications**: Get email if job fails
4. **Save and enable**

### Option 2: UptimeRobot

1. **Sign up**: https://uptimerobot.com/
2. **Add new monitor**:
   - Monitor Type: HTTP(s)
   - Friendly Name: `StartSprint Health Checks`
   - URL: `https://quhugpgfrnzvqugwibfp.supabase.co/functions/v1/run-health-checks`
   - Monitoring Interval: 5 minutes
   - Monitor Timeout: 30 seconds
3. **Advanced Settings**:
   - HTTP Method: POST
   - HTTP Headers:
     ```
     Authorization: Bearer YOUR_SERVICE_ROLE_KEY
     Content-Type: application/json
     ```
   - POST Value: `{}`
4. **Alert contacts**: Add email/SMS
5. **Create monitor**

### Option 3: GitHub Actions (Free for public repos)

Create `.github/workflows/health-checks.yml`:
```yaml
name: Health Checks
on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:  # Manual trigger

jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - name: Run Health Checks
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{}' \
            https://quhugpgfrnzvqugwibfp.supabase.co/functions/v1/run-health-checks
```

Add `SUPABASE_SERVICE_ROLE_KEY` to repository secrets.

---

## Alert System Behavior

### Automatic Alerts

When 2 consecutive failures occur:
1. System checks `health_checks` table for consecutive failures
2. Verifies no alert sent in last 30 minutes (prevents spam)
3. Calls `send-health-alert` edge function
4. Inserts record in `health_alerts` table
5. Sends notification to:
   - support@startsprint.app
   - leslie.addae@startsprint.app

### Alert Cooldown

- **Duration**: 30 minutes
- **Purpose**: Prevents alert spam during extended outages
- **Behavior**: After first alert, no more alerts for same check until 30 minutes pass

### Alert Resolution

Alerts auto-resolve when:
- Check passes again
- Dashboard shows alert as "resolved"
- No action needed from you

---

## Monitoring Dashboard

View results in real-time:

**URL**: `https://startsprint.app/admin/system-health`

**Features**:
- Live status of all 5 checks
- Last run timestamp
- Response times
- Error messages
- Active alerts
- Manual trigger button

---

## What Gets Checked

### 1. Homepage (/explore)
- **Target**: `https://startsprint.app/explore`
- **Validates**: HTTP 200 + contains "Explore" or "explore" text
- **Failure means**: Homepage is down or not rendering correctly

### 2. School Wall (/northampton-college)
- **Target**: `https://startsprint.app/northampton-college`
- **Validates**: HTTP 200 + contains "ENTER" text
- **Failure means**: School walls not accessible

### 3. Subject Page (/subjects/business)
- **Target**: `https://startsprint.app/subjects/business`
- **Validates**: HTTP 200
- **Failure means**: Subject navigation broken

### 4. Quiz Page Load
- **Target**: `https://startsprint.app/quiz/f47183d1-8a7a-4524-9c07-12e048302762`
- **Validates**: HTTP 200
- **Failure means**: Quiz detail pages not loading

### 5. Quiz Start API
- **Target**: Database RPC `start_quiz_run`
- **Validates**: Creates quiz run + questions_data not null
- **Failure means**: Quiz gameplay broken (CRITICAL)

---

## Security Notes

### Service Role Key Protection

⚠️ **CRITICAL**: Never commit service role key to code or public repositories

- Use environment variables or secrets management
- Rotate key if exposed
- Only grant to trusted cron services

### Edge Function Security

The edge function:
- ✅ Requires valid Authorization header
- ✅ Validates environment variables
- ✅ Uses service role (bypasses RLS for checks)
- ✅ Logs all activity to `health_checks` table
- ❌ Does not modify any game/quiz data

---

## Troubleshooting

### Issue: 500 Error "environment variable is not set"
**Cause**: Supabase project not properly configured
**Fix**: Check Supabase Dashboard → Settings → API for service role key

### Issue: Checks always timeout
**Cause**: Production URL may be wrong or down
**Fix**: Verify `https://startsprint.app` is live and accessible

### Issue: Quiz Start API always fails
**Cause**: Test quiz ID may not exist or be published
**Fix**: Check that quiz `f47183d1-8a7a-4524-9c07-12e048302762` exists and is published

### Issue: No alerts received
**Cause**: Email service not configured in `send-health-alert` function
**Fix**: Configure email service (Resend, SendGrid) in the alert function

---

## Getting Your Service Role Key

1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Settings → API
4. Copy `service_role` secret key
5. Use this in your cron service configuration

⚠️ **Never use the `anon` key for health checks** - it won't work because checks need elevated permissions.

---

## Next Steps

1. ✅ Choose a cron service (cron-job.org recommended)
2. ✅ Get your service role key from Supabase
3. ✅ Configure the cron job with URL and headers above
4. ✅ Test manually using curl
5. ✅ Enable the cron schedule (every 5 minutes)
6. ✅ Configure email service in `send-health-alert` function (optional)
7. ✅ Monitor `/admin/system-health` dashboard

---

## Support

Questions or issues?
- Check the dashboard: `/admin/system-health`
- Review logs: Query `health_checks` table
- Contact: support@startsprint.app

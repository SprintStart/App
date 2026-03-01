# Health Checks System - Deployment Complete

## Overview

A secure automated health monitoring system for Supabase that:
- Monitors database, auth, and storage services every 5 minutes
- Uses X-CRON-SECRET authentication (no exposed service keys)
- Logs results to database for monitoring and alerts
- Runs via external cron service (cron-job.org)

## What Was Created

### 1. Edge Function: `run-health-checks`
**Location:** `supabase/functions/run-health-checks/index.ts`

**Features:**
- ✅ X-CRON-SECRET header authentication
- ✅ JWT verification disabled (--no-verify-jwt)
- ✅ Checks database, auth, and storage services
- ✅ Logs results to `system_health_checks` table
- ✅ Returns JSON response with health status
- ✅ CORS headers configured
- ✅ Comprehensive error handling

**Authentication Flow:**
```
Cron-job.org → [X-CRON-SECRET header] → Edge Function
                                          ↓
                                    Validates secret
                                          ↓
                              Runs health checks (using service_role internally)
                                          ↓
                                    Logs to database
```

### 2. Database Table: `system_health_checks`
**SQL Migration:** `CREATE_HEALTH_CHECKS_TABLE.sql`

**Schema:**
```sql
id               uuid
service_name     text (database, auth, storage)
status           text (healthy, degraded, down)
response_time_ms integer
error_message    text
checked_at       timestamptz
created_at       timestamptz
```

**RLS Policies:**
- Service role can INSERT (edge function)
- Admins can read all data
- Public can read last 24 hours

**View:** `latest_health_status` - Shows current status of each service

### 3. Documentation
- **SETUP_CRON_SECRET.md** - Quick start guide (10 minutes)
- **CRON_SETUP_GUIDE.md** - Detailed setup and troubleshooting
- **README_HEALTH_CHECKS.md** - This file

## Deployment Steps (Required)

### ⚠️ IMPORTANT: Complete These Steps Now

#### 1. Generate CRON_SECRET (30 seconds)
```bash
openssl rand -hex 32
```
Save this value - you'll need it in steps 2 and 5.

#### 2. Add to Supabase (1 minute)
1. Go to: https://supabase.com/dashboard → Your Project
2. Settings → Edge Functions → Secrets
3. Add secret:
   - Name: `CRON_SECRET`
   - Value: [your generated secret]
   - Click Save

#### 3. Create Database Table (1 minute)
1. Supabase Dashboard → SQL Editor
2. Copy contents of `CREATE_HEALTH_CHECKS_TABLE.sql`
3. Run the query

#### 4. Deploy Edge Function (1 minute)
```bash
supabase functions deploy run-health-checks --no-verify-jwt
```

Or via Supabase Dashboard:
- Edge Functions → Deploy new function
- Select `run-health-checks`
- Ensure "Verify JWT" is OFF
- Click Deploy

#### 5. Configure Cron-job.org (2 minutes)

**URL:**
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/run-health-checks
```

**Method:** POST

**Schedule:** `*/5 * * * *` (every 5 minutes)

**Headers:**
```
X-CRON-SECRET: [your secret from step 1]
Content-Type: application/json
```

**Body:**
```json
{}
```

**Timeout:** 30 seconds

#### 6. Test & Verify (1 minute)
```bash
# Test manually
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/run-health-checks \
  -H "X-CRON-SECRET: YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'

# Check database
SELECT * FROM system_health_checks ORDER BY checked_at DESC LIMIT 5;
```

## How It Works

### Request Flow
```
Every 5 minutes:
  Cron-job.org
    ↓ POST with X-CRON-SECRET
  run-health-checks edge function
    ↓ Validate secret
    ↓ Check database (REST API)
    ↓ Check auth (/auth/v1/health)
    ↓ Check storage (/storage/v1/bucket)
    ↓ Log results to system_health_checks table
    ↓ Return JSON response
  Cron-job.org
    ↓ Log success/failure
    ↓ Send alerts if needed
```

### Security Model

**External Layer (Cron → Function):**
- X-CRON-SECRET header validation
- No JWT verification required
- No service_role key exposed externally

**Internal Layer (Function → Supabase):**
- Uses SUPABASE_SERVICE_ROLE_KEY (auto-injected)
- Direct API calls to check services
- RLS policies protect database writes

### Success Response
```json
{
  "overall": "healthy",
  "checks": [
    {
      "service": "database",
      "status": "healthy",
      "responseTime": 45,
      "timestamp": "2024-02-28T10:30:00.000Z"
    },
    {
      "service": "auth",
      "status": "healthy",
      "responseTime": 32,
      "timestamp": "2024-02-28T10:30:00.000Z"
    },
    {
      "service": "storage",
      "status": "healthy",
      "responseTime": 28,
      "timestamp": "2024-02-28T10:30:00.000Z"
    }
  ],
  "timestamp": "2024-02-28T10:30:00.000Z"
}
```

## Monitoring

### View Current Status
```sql
SELECT * FROM latest_health_status;
```

### Check Health History (Last 24 Hours)
```sql
SELECT
  service_name,
  status,
  AVG(response_time_ms) as avg_response_ms,
  COUNT(*) as check_count,
  COUNT(*) FILTER (WHERE status = 'healthy') as healthy_count
FROM system_health_checks
WHERE checked_at > now() - interval '24 hours'
GROUP BY service_name, status
ORDER BY service_name;
```

### Alert on Failures
Cron-job.org automatically sends email alerts when:
- HTTP status is not 200
- Timeout occurs (> 30 seconds)
- 2+ consecutive failures

## Troubleshooting

### 401 Unauthorized
**Cause:** Invalid or missing X-CRON-SECRET

**Fix:**
1. Verify CRON_SECRET is set in Supabase Edge Functions secrets
2. Check X-CRON-SECRET header in cron-job.org matches exactly
3. No extra spaces or quotes

### 500 Server Error
**Cause:** CRON_SECRET environment variable not configured

**Fix:**
1. Add CRON_SECRET to Supabase Edge Functions secrets
2. Redeploy the edge function

### No Data in Database
**Cause:** Table doesn't exist or RLS blocking

**Fix:**
1. Run `CREATE_HEALTH_CHECKS_TABLE.sql`
2. Verify service_role can INSERT:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'system_health_checks';
   ```

### 404 Not Found
**Cause:** Function not deployed

**Fix:**
```bash
supabase functions deploy run-health-checks --no-verify-jwt
```

## Important Notes

### ✅ What This System Does
- Monitors Supabase services (database, auth, storage)
- Logs health check results
- Sends alerts on failures
- Provides monitoring data

### ❌ What This System Does NOT Touch
- Quiz flow
- Quiz creation/publishing
- User authentication
- Payment processing
- Application routes
- Student/teacher functionality

**This is monitoring infrastructure only - completely separate from app functionality.**

## Security Best Practices

✅ **Do:**
- Use strong random CRON_SECRET (32+ characters)
- Keep secret in Supabase environment only
- Enable cron-job.org failure notifications
- Review health check logs weekly

❌ **Don't:**
- Commit CRON_SECRET to git
- Share secret publicly
- Expose service_role key externally
- Use same secret across projects

## Files Reference

| File | Purpose |
|------|---------|
| `supabase/functions/run-health-checks/index.ts` | Edge function code |
| `CREATE_HEALTH_CHECKS_TABLE.sql` | Database migration |
| `SETUP_CRON_SECRET.md` | Quick start guide (10 min) |
| `CRON_SETUP_GUIDE.md` | Detailed setup & troubleshooting |
| `README_HEALTH_CHECKS.md` | This overview document |

## Next Steps

1. ✅ Complete the 6 deployment steps above
2. ✅ Verify cron is running successfully
3. ✅ Set up email alerts in cron-job.org
4. 📊 Optional: Create dashboard to visualize uptime
5. 📧 Optional: Add Slack/Discord webhook notifications

## Support

If you encounter issues:
1. Check Supabase Edge Function logs
2. Review cron-job.org execution history
3. Verify all environment variables are set
4. Test endpoint manually with curl
5. Review troubleshooting section in `CRON_SETUP_GUIDE.md`

---

**Status:** ✅ Implementation complete - Ready for deployment

**Estimated Setup Time:** 10 minutes

**Maintenance:** None (automated monitoring)

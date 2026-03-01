# Health Checks Cron Setup Guide

This guide explains how to set up automated health checks for your Supabase application using Cron-job.org.

## Overview

The `run-health-checks` edge function performs periodic health checks on:
- Database connectivity
- Authentication service
- Storage service

Results are logged to the `system_health_checks` table for monitoring and alerting.

## Security

Authentication uses **X-CRON-SECRET** header instead of exposing the service role key externally.

## Setup Instructions

### Step 1: Generate CRON_SECRET

Generate a secure random secret (32+ characters):

```bash
# On Mac/Linux:
openssl rand -hex 32

# Or use this online generator:
# https://www.random.org/strings/?num=1&len=32&digits=on&upperalpha=on&loweralpha=on&unique=on&format=html&rnd=new
```

Example output: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0`

### Step 2: Add CRON_SECRET to Supabase

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to **Project Settings** → **Edge Functions** → **Secrets**
3. Click **Add Secret**
4. Name: `CRON_SECRET`
5. Value: Paste your generated secret
6. Click **Save**

### Step 3: Create Health Checks Table

1. Go to **SQL Editor** in your Supabase Dashboard
2. Copy the contents of `CREATE_HEALTH_CHECKS_TABLE.sql`
3. Paste and run the SQL
4. Verify the table was created: `system_health_checks`

### Step 4: Deploy Edge Function

The `run-health-checks` edge function should be deployed to:
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/run-health-checks
```

To deploy manually (if needed):
1. Install Supabase CLI: https://supabase.com/docs/guides/cli
2. Run: `supabase functions deploy run-health-checks --no-verify-jwt`

### Step 5: Configure Cron-job.org

1. Go to https://cron-job.org and sign up/login
2. Click **Create cronjob**
3. Configure the job:

   **Basic Settings:**
   - Title: `Supabase Health Checks`
   - URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/run-health-checks`
   - Schedule: Every 5 minutes (`*/5 * * * *`)

   **Request Settings:**
   - Method: **POST**
   - Request body: `{}`
   - Content-Type: `application/json`

   **Request Headers:**
   Add these headers:
   ```
   X-CRON-SECRET: YOUR_CRON_SECRET_HERE
   Content-Type: application/json
   ```

   **Advanced Settings:**
   - Timeout: 30 seconds
   - Fail on HTTP errors: Yes (4xx, 5xx)

4. Click **Create**

### Step 6: Test the Cron Job

1. In cron-job.org, click **Execute now** on your health check job
2. Check the execution history - should see **Status 200**
3. Verify in Supabase:
   ```sql
   SELECT * FROM system_health_checks ORDER BY checked_at DESC LIMIT 5;
   ```
4. You should see recent health check results

## Monitoring

### View Latest Health Status

```sql
SELECT * FROM latest_health_status;
```

### Check Health History

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

### Set Up Alerts in Cron-job.org

1. Edit your cron job
2. Go to **Notifications** tab
3. Add email notification for failures
4. Threshold: Fail 2 times in a row

## Troubleshooting

### 401 Unauthorized Error

**Cause:** Missing or invalid `X-CRON-SECRET` header

**Fix:**
1. Verify `CRON_SECRET` is set in Supabase Edge Functions secrets
2. Ensure the `X-CRON-SECRET` header in cron-job.org matches exactly
3. No extra spaces or quotes around the secret value

### 500 Server Error

**Cause:** CRON_SECRET not configured in Supabase

**Fix:**
1. Go to Supabase Dashboard → Edge Functions → Secrets
2. Add `CRON_SECRET` environment variable
3. Redeploy the edge function if needed

### No Data in system_health_checks Table

**Cause:** Table doesn't exist or RLS blocking inserts

**Fix:**
1. Run `CREATE_HEALTH_CHECKS_TABLE.sql` in SQL Editor
2. Verify RLS policy allows service_role to insert:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'system_health_checks';
   ```

### Edge Function Not Found (404)

**Cause:** Function not deployed or wrong URL

**Fix:**
1. Verify function is deployed: https://supabase.com/dashboard/project/YOUR_PROJECT/functions
2. Check URL format: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/run-health-checks`
3. Redeploy if needed

## Security Best Practices

✅ **DO:**
- Use a strong, random CRON_SECRET (32+ characters)
- Keep CRON_SECRET in Supabase secrets only
- Use HTTPS for all cron requests
- Enable fail notifications in cron-job.org

❌ **DON'T:**
- Share or commit CRON_SECRET to version control
- Use the same secret across multiple projects
- Expose service role key externally
- Disable JWT verification without alternative auth

## Example Cron-job.org Configuration

```
Title: Supabase Health Checks
URL: https://abcdefghijklmn.supabase.co/functions/v1/run-health-checks
Schedule: */5 * * * *
Method: POST
Body: {}
Headers:
  X-CRON-SECRET: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0
  Content-Type: application/json
Timeout: 30s
```

## Success Response Example

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

## Support

If you continue to have issues:
1. Check Supabase Edge Function logs in the Dashboard
2. Verify all environment variables are set correctly
3. Test the endpoint manually with curl:

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/run-health-checks \
  -H "X-CRON-SECRET: YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

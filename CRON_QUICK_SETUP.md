# Quick Setup: External Cron for Health Checks

## ⚡ 60-Second Setup

### Step 1: Get Service Role Key
1. Go to: https://supabase.com/dashboard/project/guhugpgfrnzvqugwibfp/settings/api
2. Copy the `service_role` key (starts with `eyJ...`)

### Step 2: Configure Cron Service
Use these exact values in your cron service:

**URL**:
```
https://quhugpgfrnzvqugwibfp.supabase.co/functions/v1/run-health-checks
```

**Method**:
```
POST
```

**Headers**:
```
Authorization: Bearer YOUR_SERVICE_ROLE_KEY_HERE
Content-Type: application/json
```

**Body**:
```json
{}
```

**Schedule**:
```
*/5 * * * *
```
(Every 5 minutes)

### Step 3: Test with curl
```bash
curl -X POST \
  https://quhugpgfrnzvqugwibfp.supabase.co/functions/v1/run-health-checks \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: JSON response with 5 health checks

---

## ✅ What Happens

1. **Every 5 minutes**: Cron triggers the endpoint
2. **Function runs 5 checks**:
   - Homepage loads
   - School wall works
   - Subject page loads
   - Quiz page loads
   - Quiz start API works
3. **Results saved**: All results go to `health_checks` table
4. **Alerts sent**: If 2 consecutive failures → email to support team
5. **View dashboard**: See live status at `/admin/system-health`

---

## 📊 Response Format

**Success** (all pass):
```json
{
  "success": true,
  "checks": [
    { "name": "explore_page", "status": "success", ... },
    { "name": "northampton_college_wall", "status": "success", ... },
    { "name": "business_subject_page", "status": "success", ... },
    { "name": "quiz_page_load", "status": "success", ... },
    { "name": "quiz_start_api", "status": "success", ... }
  ],
  "timestamp": "2026-02-13T18:00:00.000Z"
}
```

**Failure** (at least one fails):
```json
{
  "success": true,
  "checks": [
    { "name": "explore_page", "status": "failure", "error_message": "HTTP 500", ... },
    ...
  ]
}
```

---

## 🔧 Recommended Cron Services

### Option 1: cron-job.org (Free, Easy)
1. Sign up: https://cron-job.org/en/
2. Create job with values above
3. Set schedule: `*/5 * * * *`
4. Enable email notifications
5. Done!

### Option 2: UptimeRobot (Free, Monitoring)
1. Sign up: https://uptimerobot.com/
2. Add HTTP(s) monitor
3. Configure POST with headers above
4. Set interval: 5 minutes
5. Done!

### Option 3: GitHub Actions (Free for public repos)
See `EXTERNAL_CRON_SETUP.md` for workflow file

---

## 🚨 Alert Behavior

**Triggers when**: Any check fails 2 times in a row
**Sends to**: support@startsprint.app, leslie.addae@startsprint.app
**Cooldown**: 30 minutes (won't spam)
**Auto-resolves**: When check passes again

---

## 📱 View Results

**Dashboard**: https://startsprint.app/admin/system-health
- Real-time status
- Response times
- Error details
- Active alerts

---

## 🔐 Security

⚠️ **Service Role Key**:
- Never commit to code
- Never share publicly
- Use environment variables
- Rotate if exposed

---

## ✅ Verification Checklist

Before going live:

- [ ] Get service role key from Supabase
- [ ] Test endpoint with curl (should return JSON)
- [ ] Configure cron service
- [ ] Verify cron runs (check dashboard after 5 minutes)
- [ ] Test alerts (temporarily break a check, run twice)
- [ ] Configure email service (optional, see `send-health-alert` function)

---

## 📞 Support

Issues? Check:
1. Dashboard: `/admin/system-health`
2. Database: Query `health_checks` table
3. Logs: Check cron service logs
4. Email: support@startsprint.app

---

## 🎯 What This DOES NOT Touch

✅ Zero impact on:
- Quiz gameplay
- Quiz creation
- Publishing flow
- Student experience
- Teacher dashboard
- Database schemas
- RLS policies
- Routing (except `/admin/system-health`)

This is **monitoring only** - completely isolated from game logic.

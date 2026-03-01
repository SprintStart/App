# Quick Start: Set Up CRON_SECRET

Follow these steps to enable secure automated health checks.

## Step 1: Generate Secret (30 seconds)

Run one of these commands to generate a secure random secret:

**Mac/Linux:**
```bash
openssl rand -hex 32
```

**Or use online generator:**
Visit: https://www.random.org/strings/?num=1&len=32&digits=on&upperalpha=on&loweralpha=on&unique=on&format=html&rnd=new

**Example output:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0
```

Copy this value - you'll need it in the next steps.

---

## Step 2: Add to Supabase (1 minute)

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project

2. **Navigate to Edge Functions Secrets**
   - Click **Project Settings** (gear icon in sidebar)
   - Click **Edge Functions** in the left menu
   - Click the **Secrets** tab

3. **Add the Secret**
   - Click **"Add Secret"** button
   - Name: `CRON_SECRET`
   - Value: Paste your generated secret from Step 1
   - Click **"Save"** or **"Add"**

✅ **Verification:** You should see `CRON_SECRET` listed in your secrets (value hidden)

---

## Step 3: Create Database Table (1 minute)

1. **Open SQL Editor**
   - In Supabase Dashboard, click **SQL Editor** in sidebar

2. **Run Migration**
   - Click **"New query"**
   - Copy the entire contents of `CREATE_HEALTH_CHECKS_TABLE.sql`
   - Paste into the query editor
   - Click **"Run"** or press `Ctrl+Enter`

✅ **Verification:** You should see "Success. No rows returned"

---

## Step 4: Deploy Edge Function (1 minute)

The `run-health-checks` function is already created. Deploy it:

**Option A: Using Supabase Dashboard (Recommended)**
1. Go to **Edge Functions** in Supabase Dashboard
2. Click **"Deploy new function"**
3. Select the `run-health-checks` folder
4. Ensure **"Verify JWT"** is **OFF** (unchecked)
5. Click **"Deploy"**

**Option B: Using Supabase CLI**
```bash
supabase functions deploy run-health-checks --no-verify-jwt
```

✅ **Verification:** Function appears in Edge Functions list with status "Deployed"

---

## Step 5: Configure Cron-job.org (2 minutes)

1. **Sign Up/Login**
   - Go to: https://cron-job.org
   - Create free account or login

2. **Create New Cron Job**
   - Click **"Create cronjob"** button

3. **Configure Job Settings**

   **Title:**
   ```
   Supabase Health Checks
   ```

   **URL:**
   ```
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/run-health-checks
   ```
   ⚠️ Replace `YOUR_PROJECT_REF` with your actual Supabase project reference

   Find it here: Supabase Dashboard → Settings → API → Project URL

   **Schedule:**
   ```
   */5 * * * *
   ```
   (Every 5 minutes)

   **Method:**
   ```
   POST
   ```

   **Request Body:**
   ```json
   {}
   ```

   **Request Headers:**
   Click "Add header" twice and add these:

   Header 1:
   - Name: `X-CRON-SECRET`
   - Value: `YOUR_CRON_SECRET_FROM_STEP_1`

   Header 2:
   - Name: `Content-Type`
   - Value: `application/json`

   **Timeout:**
   ```
   30
   ```
   (30 seconds)

   **Enable notifications:**
   - ✅ Check "Send notification on failure"
   - Threshold: 2 consecutive failures

4. **Save and Test**
   - Click **"Create"** or **"Save"**
   - Click **"Execute now"** to test immediately

✅ **Verification:** Execution history shows Status 200 (Success)

---

## Step 6: Verify It's Working (1 minute)

1. **Check Cron Execution**
   - In cron-job.org, view execution history
   - Should see green checkmark with "Status 200"

2. **Check Database Logs**
   - In Supabase Dashboard, go to **SQL Editor**
   - Run this query:
   ```sql
   SELECT * FROM system_health_checks
   ORDER BY checked_at DESC
   LIMIT 5;
   ```
   - Should see recent health check results

3. **View Latest Status**
   ```sql
   SELECT * FROM latest_health_status;
   ```
   - Should show current status of all services

✅ **Done!** Your health checks are now running every 5 minutes automatically.

---

## Quick Reference

**Your Configuration:**

| Setting | Value |
|---------|-------|
| Edge Function URL | `https://YOUR_PROJECT.supabase.co/functions/v1/run-health-checks` |
| Schedule | Every 5 minutes (`*/5 * * * *`) |
| Method | POST |
| Body | `{}` |
| Required Header | `X-CRON-SECRET: YOUR_SECRET` |
| JWT Verification | OFF (disabled) |

---

## Troubleshooting

### ❌ 401 Unauthorized

**Problem:** X-CRON-SECRET doesn't match

**Fix:**
1. Check spelling: `X-CRON-SECRET` (exact case)
2. Verify secret in Supabase matches cron-job.org exactly
3. No extra spaces or quotes

### ❌ 500 Server Error

**Problem:** CRON_SECRET not set in Supabase

**Fix:**
1. Go back to Step 2
2. Verify `CRON_SECRET` exists in Edge Functions secrets
3. Redeploy the edge function

### ❌ 404 Not Found

**Problem:** Edge function not deployed or wrong URL

**Fix:**
1. Check Edge Functions list in Supabase Dashboard
2. Verify URL format: `https://PROJECT_REF.supabase.co/functions/v1/run-health-checks`
3. Deploy function if missing (Step 4)

### ❌ No Data in Database

**Problem:** Table doesn't exist

**Fix:**
1. Go back to Step 3
2. Run the SQL migration in SQL Editor

---

## Test Manually

Test the endpoint directly with curl:

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/run-health-checks \
  -H "X-CRON-SECRET: YOUR_SECRET_HERE" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected response:
```json
{
  "overall": "healthy",
  "checks": [...],
  "timestamp": "2024-02-28T10:30:00.000Z"
}
```

---

## Security Notes

✅ **Good Practices:**
- CRON_SECRET should be 32+ random characters
- Keep secret in Supabase environment only
- Never commit secret to git
- Use different secret per project

❌ **Never Do This:**
- Don't put service_role key in cron-job.org
- Don't share CRON_SECRET publicly
- Don't use simple/guessable secrets

---

## Next Steps

Once health checks are running:
1. Monitor the `system_health_checks` table
2. Set up alerts for degraded services
3. Create dashboard to visualize uptime
4. Review logs weekly for patterns

For detailed documentation, see: `CRON_SETUP_GUIDE.md`

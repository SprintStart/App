# ⚠️ MANUAL DEPLOYMENT REQUIRED

The edge function `run-health-checks` has been created but needs to be manually deployed.

## Edge Function Location
```
supabase/functions/run-health-checks/index.ts
```

## Deployment Options

### Option 1: Supabase Dashboard (Easiest)

1. Go to: https://supabase.com/dashboard
2. Select your project
3. Navigate to: **Edge Functions** in the sidebar
4. Click: **"Deploy new function"**
5. Select or upload the folder: `supabase/functions/run-health-checks`
6. **CRITICAL:** Ensure **"Verify JWT"** is **UNCHECKED/OFF**
7. Click: **"Deploy"**

### Option 2: Supabase CLI

```bash
# Install Supabase CLI if needed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
supabase functions deploy run-health-checks --no-verify-jwt
```

### Option 3: Copy Function Code to Dashboard

1. Go to: https://supabase.com/dashboard → Your Project → Edge Functions
2. Click: **"Create a new function"**
3. Name: `run-health-checks`
4. Copy the entire contents of `supabase/functions/run-health-checks/index.ts`
5. Paste into the editor
6. **CRITICAL:** Ensure **"Verify JWT"** is **OFF**
7. Click: **"Deploy"**

## After Deployment

Once deployed, your function will be available at:
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/run-health-checks
```

## Next Steps

After deploying the edge function:

1. ✅ Generate CRON_SECRET: `openssl rand -hex 32`
2. ✅ Add to Supabase: Settings → Edge Functions → Secrets → Add `CRON_SECRET`
3. ✅ Create database table: Run `CREATE_HEALTH_CHECKS_TABLE.sql` in SQL Editor
4. ✅ Configure cron-job.org with the function URL and X-CRON-SECRET header

See `DEPLOYMENT_CHECKLIST.md` for complete instructions.

## Files Ready for Deployment

All files are created and ready:
- ✅ Edge function: `supabase/functions/run-health-checks/index.ts` (206 lines)
- ✅ Database migration: `CREATE_HEALTH_CHECKS_TABLE.sql`
- ✅ Documentation: `SETUP_CRON_SECRET.md`, `CRON_SETUP_GUIDE.md`, `README_HEALTH_CHECKS.md`
- ✅ Deployment checklist: `DEPLOYMENT_CHECKLIST.md`

**Status:** Implementation complete, awaiting manual deployment

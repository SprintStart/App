# Deploy Edge Function Manually

## Issue
The automated Supabase deployment tool is encountering an error: "A database is already setup for this project"

## Edge Function to Deploy
- **Function Name:** `run-health-checks`
- **File Path:** `supabase/functions/run-health-checks/index.ts`
- **Changes Made:** Updated CORS headers and OPTIONS response

## Manual Deployment Options

### Option 1: Supabase CLI (Recommended)

```bash
# Install Supabase CLI if not installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project (use your project ref)
supabase link --project-ref guhupgpfrnzyuquwibfp

# Deploy the specific function
supabase functions deploy run-health-checks --no-verify-jwt

# Verify deployment
supabase functions list
```

### Option 2: Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/guhupgpfrnzyuquwibfp/functions
2. Find the `run-health-checks` function
3. Click on it to edit
4. Copy the contents of `supabase/functions/run-health-checks/index.ts`
5. Paste into the editor
6. Click "Deploy"

### Option 3: Using npx (No Installation)

```bash
# From project root
npx supabase login
npx supabase link --project-ref guhupgpfrnzyuquwibfp
npx supabase functions deploy run-health-checks --no-verify-jwt
```

## Changes in the Edge Function

### CORS Headers (Lines 3-7)
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://startsprint.app",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, x-client-info, apikey, x-cron-secret, x-health-secret",
};
```

### OPTIONS Response (Line 28)
```typescript
status: 204,  // Changed from 200
```

## Verification After Deployment

1. Check function is deployed:
```bash
supabase functions list
```

2. Check function logs:
```bash
supabase functions logs run-health-checks
```

3. Test from admin dashboard:
   - Go to: https://startsprint.app/admindashboard/system-health
   - Click "Run Check Now"
   - Should NOT see CORS errors
   - Should see health check results

## Required Environment Variable

Ensure this secret is set in Supabase:

```
CRON_SECRET=hc_2026_startsprint_secure_cron_check_v1
```

Set via CLI:
```bash
supabase secrets set CRON_SECRET=hc_2026_startsprint_secure_cron_check_v1
```

Or via Dashboard:
1. Go to Edge Functions settings
2. Navigate to Environment Variables
3. Add `CRON_SECRET` with the value above

## What This Fixes

- ✅ CORS preflight errors when browser sends lowercase headers
- ✅ Proper OPTIONS response (204 instead of 200)
- ✅ More secure origin restriction (startsprint.app instead of *)
- ✅ Backward compatibility with x-health-secret during transition

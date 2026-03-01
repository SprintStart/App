# Health Check Function Deployment Instructions

## ⚠️ DEPLOYMENT REQUIRED

The `run-health-checks` edge function has been updated with security hardening but needs manual deployment.

---

## Security Features Added

### 1. Secret Header Authentication
- **Required Header**: `X-Health-Secret: <your-secret>`
- **Rejects**: Requests without valid secret (401 Unauthorized)
- **Environment Variable**: `HEALTHCHECK_SECRET`

### 2. Rate Limiting
- **Limit**: 1 request per minute per IP
- **Response**: 429 Too Many Requests with Retry-After header
- **Cleanup**: Auto-removes old rate limit entries

### 3. Environment Validation
- Validates `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `HEALTHCHECK_SECRET`
- Returns clear error messages if missing

---

## Manual Deployment Steps

### Step 1: Generate Health Check Secret

```bash
# Generate a secure random secret (32 characters)
openssl rand -hex 32
```

Save this secret - you'll need it for:
1. Supabase edge function environment variable
2. Cron service configuration

### Step 2: Deploy via Supabase CLI

```bash
# Install Supabase CLI if needed
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref quhugpgfrnzvqugwibfp

# Set the health check secret as environment variable
supabase secrets set HEALTHCHECK_SECRET=your_generated_secret_here

# Deploy the function
supabase functions deploy run-health-checks --no-verify-jwt
```

### Step 3: Verify Deployment

Test without secret (should fail):
```bash
curl -X POST \
  https://quhugpgfrnzvqugwibfp.supabase.co/functions/v1/run-health-checks \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected response:
```json
{
  "success": false,
  "error": "Unauthorized: Invalid or missing X-Health-Secret header"
}
```
Status: 401

Test with secret (should succeed):
```bash
curl -X POST \
  https://quhugpgfrnzvqugwibfp.supabase.co/functions/v1/run-health-checks \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Health-Secret: your_generated_secret_here" \
  -d '{}'
```

Expected response:
```json
{
  "success": true,
  "checks": [
    {
      "name": "explore_page",
      "status": "success",
      "http_status": 200,
      ...
    },
    ...
  ],
  "timestamp": "2026-02-14T..."
}
```
Status: 200

### Step 4: Test Rate Limiting

Run the same command twice within 60 seconds:
```bash
# First call - should succeed
curl -X POST https://quhugpgfrnzvqugwibfp.supabase.co/functions/v1/run-health-checks \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "X-Health-Secret: your_secret" \
  -H "Content-Type: application/json" \
  -d '{}'

# Second call immediately - should be rate limited
curl -X POST https://quhugpgfrnzvqugwibfp.supabase.co/functions/v1/run-health-checks \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "X-Health-Secret: your_secret" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected second response:
```json
{
  "success": false,
  "error": "Rate limit exceeded. Please wait XX seconds before retrying."
}
```
Status: 429

---

## Alternative: Deploy via Supabase Dashboard

### Step 1: Go to Functions Dashboard
https://supabase.com/dashboard/project/quhugpgfrnzvqugwibfp/functions

### Step 2: Create/Update Function
1. Click "New Function" or edit existing `run-health-checks`
2. Name: `run-health-checks`
3. Copy entire contents of `supabase/functions/run-health-checks/index.ts`
4. Paste into editor
5. Verify JWT: **OFF**
6. Click "Deploy"

### Step 3: Add Environment Variable
1. Go to Project Settings → Edge Functions → Secrets
2. Add new secret:
   - Name: `HEALTHCHECK_SECRET`
   - Value: Your generated secret from Step 1
3. Save

### Step 4: Test (same as CLI steps above)

---

## Updated Cron Configuration

### New Headers Required

```
Authorization: Bearer YOUR_SERVICE_ROLE_KEY
Content-Type: application/json
X-Health-Secret: YOUR_HEALTHCHECK_SECRET
```

### Updated cron-job.org Configuration

1. Go to your cron job settings
2. Update Request Headers:
   - Authorization: Bearer YOUR_SERVICE_ROLE_KEY
   - Content-Type: application/json
   - **X-Health-Secret: YOUR_HEALTHCHECK_SECRET** (NEW)
3. Save changes

### Updated curl Test

```bash
curl -X POST \
  https://quhugpgfrnzvqugwibfp.supabase.co/functions/v1/run-health-checks \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Health-Secret: YOUR_HEALTHCHECK_SECRET" \
  -d '{}'
```

---

## Verification Checklist

After deployment, verify:

- [ ] Function deployed successfully in Supabase Dashboard
- [ ] `HEALTHCHECK_SECRET` environment variable set
- [ ] Test without secret header → Returns 401
- [ ] Test with wrong secret → Returns 401
- [ ] Test with correct secret → Returns 200 with checks
- [ ] Test rate limiting → Second call within 60s returns 429
- [ ] Manual trigger in `/admin/system-health` works
- [ ] Cron service updated with new header
- [ ] Cron job executes successfully
- [ ] Results appear in dashboard

---

## Security Benefits

### Before
- ✅ Required service role key
- ❌ No additional authentication
- ❌ No rate limiting
- ❌ Could be abused by anyone with URL

### After
- ✅ Required service role key
- ✅ Required secret header (`X-Health-Secret`)
- ✅ Rate limiting (1 req/min per IP)
- ✅ Environment variable validation
- ✅ Abuse-resistant

---

## Troubleshooting

### Error: "HEALTHCHECK_SECRET environment variable is not set"
**Solution**: Set the secret in Supabase Dashboard → Project Settings → Edge Functions → Secrets

### Error: "Unauthorized: Invalid or missing X-Health-Secret header"
**Solution**: Add `X-Health-Secret` header with correct secret value to your request

### Error: "Rate limit exceeded"
**Solution**: Wait 60 seconds between requests, or adjust `RATE_LIMIT_WINDOW_MS` in function code

### Dashboard "Run Check Now" doesn't work
**Solution**: Update frontend to include `X-Health-Secret` header (see below)

---

## Frontend Integration Update

The admin dashboard needs to be updated to include the secret header. Add this environment variable to `.env`:

```
VITE_HEALTHCHECK_SECRET=your_generated_secret_here
```

Then update the fetch call in `SystemHealthPage.tsx` (line 78-86):
```typescript
const response = await fetch(
  `${supabaseUrl}/functions/v1/run-health-checks`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'X-Health-Secret': import.meta.env.VITE_HEALTHCHECK_SECRET || '', // ADD THIS
    },
  }
);
```

---

## Support

For deployment issues:
- Check Supabase Function logs: https://supabase.com/dashboard/project/quhugpgfrnzvqugwibfp/logs/edge-functions
- Verify environment variables are set
- Test with curl first before enabling cron
- Contact: support@startsprint.app

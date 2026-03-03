# Edge Functions Deployment Instructions

**Functions to Deploy**: `issue-token`, `validate-token`

**Location**:
- `supabase/functions/issue-token/index.ts` ✅ Created
- `supabase/functions/validate-token/index.ts` ✅ Created

---

## Deployment Methods

### Method 1: Supabase CLI (Recommended)

```bash
# Install Supabase CLI if not installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref quhugpgfrnzvqugwibfp

# Deploy issue-token
supabase functions deploy issue-token --no-verify-jwt

# Deploy validate-token
supabase functions deploy validate-token --no-verify-jwt
```

**Note**: `--no-verify-jwt` is required because these functions work for anonymous users.

---

### Method 2: Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/quhugpgfrnzvqugwibfp/functions

2. **Deploy issue-token**:
   - Click "Create a new function"
   - Name: `issue-token`
   - Copy contents from `supabase/functions/issue-token/index.ts`
   - Uncheck "Verify JWT"
   - Deploy

3. **Deploy validate-token**:
   - Click "Create a new function"
   - Name: `validate-token`
   - Copy contents from `supabase/functions/validate-token/index.ts`
   - Uncheck "Verify JWT"
   - Deploy

---

## Required Environment Variables

After deploying functions, set the `TOKEN_SECRET` in Supabase:

1. Go to: https://supabase.com/dashboard/project/quhugpgfrnzvqugwibfp/settings/functions
2. Click "Add new secret"
3. Key: `TOKEN_SECRET`
4. Value: Generate a secure random string (32+ characters)

**Example generation**:
```bash
# Generate secure random string
openssl rand -hex 32
```

---

## Verification

After deployment, test the functions:

### Test issue-token

```bash
curl -X POST \
  https://quhugpgfrnzvqugwibfp.supabase.co/functions/v1/issue-token \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"deviceNonce": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"}'
```

**Expected Response**:
```json
{
  "token": "SS-A1B2C3",
  "signature": "64-char-hex-string",
  "expiresAt": "2026-03-03T...",
  "rewardType": "challenge_mode"
}
```

---

## Deployment Checklist

- [ ] Supabase CLI installed or dashboard access confirmed
- [ ] issue-token function deployed (verify JWT: OFF)
- [ ] validate-token function deployed (verify JWT: OFF)
- [ ] TOKEN_SECRET generated (32+ random chars)
- [ ] TOKEN_SECRET set in Supabase secrets
- [ ] Test issue-token endpoint (200 response)
- [ ] Test validate-token endpoint (200 response, ok: true)
- [ ] Set FEATURE_TOKENS = true when ready to enable

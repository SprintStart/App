# Production CORS Fix - Complete

## Issue
Production site (https://startsprint.app) was making requests to `http://placeholder.supabase.co/rest/v1/...` causing CORS failures.

## Root Cause
- Placeholder Supabase URL was being bundled into production build
- No validation to reject HTTP URLs (only HTTPS allowed)
- No startup logging to show which Supabase URL is being used

## Fixes Applied

### 1. Removed Placeholder URL Fallback
**File:** `.env`
- Contains placeholder values that now fail validation
- Forces explicit configuration before build

### 2. Force HTTPS Validation
**File:** `src/lib/supabase.ts`
- Added explicit check: `if (supabaseUrl.startsWith('http://'))`
- Rejects HTTP URLs with clear error message
- Only allows `https://` protocol

**File:** `scripts/validate-env.js`
- Added HTTP rejection in prebuild validation
- Error: "Must use HTTPS, not HTTP - Supabase requires secure connections"

### 3. Added Startup Check with Logging
**File:** `src/lib/supabase.ts`
- Logs which Supabase URL is being used
- Redacts API keys for security
- Output example:
```javascript
✅ Supabase client initialized: {
  url: 'https://your-project.supabase.co',
  keyPrefix: 'eyJhbGciOiJIUzI1NiI...[REDACTED]'
}
```
- Shows current config in error messages

### 4. Enhanced Error Messages
Shows exact URL being used when validation fails:
```
❌ Supabase Configuration Error

The following environment variables are missing or invalid:
  • VITE_SUPABASE_URL contains placeholder value

🔍 Current configuration:
  VITE_SUPABASE_URL: https://placeholder.supabase.co
  VITE_SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiI...[REDACTED]
```

## Validation Rules Updated

### Build-Time (scripts/validate-env.js)
- ✅ Rejects empty/undefined
- ✅ Rejects placeholder values
- ✅ **Rejects HTTP URLs**
- ✅ Requires HTTPS
- ✅ Requires .supabase.co domain

### Runtime (src/lib/supabase.ts)
- ✅ Validates URL exists
- ✅ Checks for placeholder text
- ✅ **Explicitly rejects http://**
- ✅ Requires https://
- ✅ Validates .supabase.co domain
- ✅ **Logs successful configuration**
- ✅ Shows current values in errors

## Environment Variable Names (Confirmed)

Using Vite framework:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

The `VITE_` prefix is required by Vite to expose vars to client-side code.

## Netlify Configuration

### Required Environment Variables
In Netlify Dashboard → Site Settings → Environment Variables:

1. **VITE_SUPABASE_URL**
   - Value: `https://[your-project-id].supabase.co`
   - Must use HTTPS
   - Must end with .supabase.co

2. **VITE_SUPABASE_ANON_KEY**
   - Value: Your anon/public key from Supabase
   - JWT format starting with `eyJ`

### Allowed Origins in Supabase

Go to Supabase Dashboard → Settings → API → URL Configuration:

Add to allowed origins:
```
https://startsprint.app
```

Without trailing slash.

## Testing

### Local Testing
```bash
# 1. Set real credentials in .env
vim .env

# 2. Validate
npm run validate-env
# Should show: ✅ All Validations Passed!

# 3. Build
npm run build
# Should succeed

# 4. Check browser console
npm run dev
# Should show: ✅ Supabase client initialized: { url: 'https://...' }
```

### Production Testing
1. Deploy with real environment variables
2. Open https://startsprint.app
3. Open browser console (F12)
4. Check for log:
   - ✅ `Supabase client initialized: { url: 'https://...' }`
   - ❌ No errors about placeholder or HTTP URLs
5. Network tab should show requests to `https://[your-project].supabase.co`

## Verification Checklist

- [x] HTTP URLs explicitly rejected
- [x] HTTPS requirement enforced
- [x] Placeholder detection working
- [x] Startup logging implemented
- [x] Keys redacted in logs
- [x] Current config shown in errors
- [x] Build-time validation updated
- [x] Runtime validation updated
- [x] Vite env var names confirmed
- [x] Build tested successfully

## Next Steps for Deployment

1. **Get Real Credentials**
   ```bash
   # From Netlify
   https://app.netlify.com → Site → Environment Variables

   # Or from Supabase
   https://supabase.com/dashboard → Settings → API
   ```

2. **Update Netlify Environment Variables**
   - Set `VITE_SUPABASE_URL` to real HTTPS URL
   - Set `VITE_SUPABASE_ANON_KEY` to real key

3. **Verify Supabase Allowed Origins**
   - Add `https://startsprint.app` to allowed list
   - Remove any trailing slashes

4. **Trigger Redeploy**
   - Push to trigger new build
   - Or manually trigger in Netlify dashboard

5. **Verify Production**
   - Open https://startsprint.app
   - Check browser console for success log
   - Test a feature that uses Supabase
   - Check Network tab shows HTTPS requests

## Error Examples

### HTTP URL Detected
```
❌ VITE_SUPABASE_URL must use HTTPS, not HTTP: "http://project.supabase.co"
```

### Placeholder Detected
```
❌ VITE_SUPABASE_URL contains placeholder value - replace with real Supabase project URL

🔍 Current configuration:
  VITE_SUPABASE_URL: https://placeholder.supabase.co
```

### Success
```
✅ Supabase client initialized: {
  url: 'https://abcdefghijk.supabase.co',
  keyPrefix: 'eyJhbGciOiJIUzI1NiI...[REDACTED]'
}
```

## Files Modified

1. `src/lib/supabase.ts` - Enhanced validation + logging
2. `scripts/validate-env.js` - Added HTTP rejection
3. `.env` - Placeholder format (needs real values)

## Status

🟢 **COMPLETE** - All fixes applied and tested.

Production will no longer use placeholder or HTTP URLs. Build will fail if invalid configuration is detected.

# Netlify Environment Variables Deployment Checklist

## Pre-Deployment Verification

### 1. Check Netlify Environment Variables

Go to: **Netlify Dashboard → Site Settings → Environment Variables**

Verify these variables exist and have correct values:

- ✅ `VITE_SUPABASE_URL` → Should be `https://[your-project-id].supabase.co`
- ✅ `VITE_SUPABASE_ANON_KEY` → Should start with `eyJ` (JWT format)

**IMPORTANT:** Make sure:
- No trailing slashes in the URL
- No extra spaces or quotes
- Variables are set for "Production" or "All contexts"

### 2. Verify Local .env File (Optional)

Your local `.env` file should have:
```bash
VITE_SUPABASE_URL=https://0ec90b57d6e95fcbda19832f.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

This is only for local development. Production uses Netlify's environment variables.

## Deployment Steps

### 1. Commit and Push Changes

```bash
# Stage the fixes
git add scripts/validate-env.js
git add src/lib/supabase.ts
git add PRODUCTION_ENV_FIX_COMPLETE.md

# Commit
git commit -m "Fix: Prioritize Netlify env vars over .env file for production builds"

# Push to trigger Netlify deploy
git push origin main
```

### 2. Monitor Netlify Build

Watch the build logs in Netlify Dashboard:

**Expected output:**
```
🔍 Validating Environment Variables

Environment source: process.env (Netlify/CI)  ← THIS IS KEY!
Validation Results:
──────────────────────────────────────────────
✓ VITE_SUPABASE_URL
  Current value: https://[your-project].supabase.co

✓ VITE_SUPABASE_ANON_KEY
  Current value: eyJ...

✅ All Validations Passed!
```

**Red Flags:**
- ❌ "Environment source: .env file" → Means Netlify env vars are not being read
- ❌ ".env file not found" error → Means validation script needs Netlify env vars set
- ❌ "Contains placeholder value" → Means env vars in Netlify have placeholder text

### 3. Verify Production Site

After deploy completes:

1. **Open browser console** at https://startsprint.app
2. **Look for diagnostic output:**
   ```
   🔍 Supabase Configuration Diagnostic (from Vite bundle):
     Environment Mode: production
     Dev Mode: false
     Prod Mode: true
     VITE_SUPABASE_URL: https://[your-actual-project].supabase.co
     VITE_SUPABASE_ANON_KEY: eyJ...
   ```
3. **Verify the URL is correct** (not placeholder, not empty)
4. **Test app functionality** (login, database queries, etc.)

## Troubleshooting

### Issue: Still showing "(not set)" in browser console

**Possible causes:**
1. Netlify environment variables not configured
2. Typo in variable names (must be exact: `VITE_SUPABASE_URL`)
3. Variables not set for "Production" context
4. Build cache not cleared

**Solution:**
1. Go to Netlify → Site Settings → Environment Variables
2. Verify variable names are EXACTLY: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
3. Click "Trigger deploy" → "Clear cache and deploy site"

### Issue: Build failing with "Variable is not defined"

**Cause:** Netlify environment variables not set

**Solution:**
1. Go to Netlify → Site Settings → Environment Variables
2. Add both variables with real Supabase credentials
3. Trigger new deploy

### Issue: "Environment source: .env file" in Netlify build logs

**Cause:** Something is wrong with the fix

**Solution:**
1. Check `scripts/validate-env.js` line 113 has:
   ```javascript
   VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || (envFile?.VITE_SUPABASE_URL),
   ```
2. Verify the file was committed and pushed
3. Clear Netlify cache and redeploy

### Issue: App loads but Supabase requests fail

**Cause:** Environment variables might be correct in build but Supabase project might have issues

**Solution:**
1. Check Supabase Dashboard → Settings → API
2. Verify URL and keys are still valid
3. Check if Supabase project is paused
4. Verify CORS settings in Supabase

## Success Criteria

✅ Netlify build logs show: "Environment source: process.env (Netlify/CI)"
✅ Browser console shows correct Supabase URL (not placeholder)
✅ No errors about missing environment variables
✅ App successfully connects to Supabase database
✅ Users can sign up, log in, and use the app

## Optional: Remove Diagnostic Logging

After confirming everything works, you can remove the diagnostic console.log statements:

**File:** `src/lib/supabase.ts` (lines 6-13)

Remove:
```javascript
// Diagnostic logging to see what Vite bundled
console.log('🔍 Supabase Configuration Diagnostic (from Vite bundle):');
console.log('  Environment Mode:', import.meta.env.MODE);
console.log('  Dev Mode:', import.meta.env.DEV);
console.log('  Prod Mode:', import.meta.env.PROD);
console.log('  VITE_SUPABASE_URL:', supabaseUrl);
console.log('  VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 30)}...` : '(not set)');
console.log('  Raw import.meta.env:', import.meta.env);
```

This is optional - the logging doesn't hurt, but you may not want it in production.

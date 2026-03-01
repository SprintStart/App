# Quick Reference: Netlify Environment Variables Fix

## What Was Wrong

`scripts/validate-env.js` only read from `.env` file and ignored `process.env` (where Netlify sets variables).

## What Was Fixed

Changed the script to prioritize `process.env` over `.env` file:

```javascript
// OLD - Only used .env file
const env = loadEnvFile();
if (!env) {
  process.exit(1); // Failed if .env missing
}

// NEW - Uses process.env first (Netlify), .env as fallback (local dev)
const envFile = loadEnvFile();
const env = {
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || (envFile?.VITE_SUPABASE_URL),
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || (envFile?.VITE_SUPABASE_ANON_KEY),
};
```

## Files Changed

1. `scripts/validate-env.js` (lines 104-127)
2. `src/lib/supabase.ts` (added diagnostic logging, lines 6-13)

## Deploy Now

```bash
git add scripts/validate-env.js src/lib/supabase.ts
git commit -m "Fix: Prioritize Netlify env vars over .env file"
git push origin main
```

## Verify After Deploy

Open browser console at https://startsprint.app and look for:

```
🔍 Supabase Configuration Diagnostic (from Vite bundle):
  VITE_SUPABASE_URL: https://your-project.supabase.co  ← Should be real URL!
  VITE_SUPABASE_ANON_KEY: eyJ...
```

## Netlify Environment Variables Required

Make sure these are set in **Netlify Dashboard → Site Settings → Environment Variables**:

- `VITE_SUPABASE_URL=https://[your-project].supabase.co`
- `VITE_SUPABASE_ANON_KEY=eyJ[your-actual-key]`

## Troubleshooting

**Still showing "(not set)"?**
→ Check Netlify env vars are set correctly (no typos in variable names)

**Build failing?**
→ Run `npm run build` locally first to test

**"Environment source: .env file" in Netlify logs?**
→ Netlify env vars not set or validation script not updated

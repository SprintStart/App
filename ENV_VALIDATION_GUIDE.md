# Environment Variable Validation System

## Overview

The build process now includes automatic validation of environment variables to prevent deployment with invalid or placeholder credentials.

## How It Works

### 1. Prebuild Validation

When you run `npm run build`, the system automatically:
1. Runs `scripts/validate-env.js` before building
2. Checks all required environment variables
3. Validates format and values
4. **Stops the build** if validation fails
5. Provides clear instructions on how to fix issues

### 2. Runtime Validation

When the app initializes in the browser:
1. `src/lib/supabase.ts` validates credentials
2. Provides detailed error messages in the console
3. Prevents app from starting with invalid config
4. Shows exact steps to fix the issue

## Required Environment Variables

### `VITE_SUPABASE_URL`

**Format:** `https://[project-id].supabase.co`

**Valid example:** `https://abcdefghijk.supabase.co`

**Invalid examples:**
- `https://placeholder.supabase.co` ❌ (placeholder)
- `YOUR_SUPABASE_PROJECT_URL` ❌ (placeholder)
- `http://project.supabase.co` ❌ (must use HTTPS)
- `https://project.example.com` ❌ (must end with .supabase.co)

### `VITE_SUPABASE_ANON_KEY`

**Format:** JWT token starting with `eyJ`

**Valid example:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6...` (200+ characters)

**Invalid examples:**
- `YOUR_SUPABASE_ANON_KEY` ❌ (placeholder)
- `eyJ...placeholder` ❌ (contains placeholder)
- `abc123def456` ❌ (wrong format)
- Empty or missing ❌

## Available Commands

### Validate Environment

```bash
npm run validate-env
```

Checks environment variables without building. Use this to verify your configuration.

### Build with Validation (Default)

```bash
npm run build
```

Validates environment variables, then builds if validation passes.

### Build Without Validation (Emergency Only)

```bash
npm run build:skip-validation
```

**⚠️ WARNING:** Only use this for testing or emergency situations. The app will not work without valid credentials.

## Setup Instructions

### Step 1: Get Your Credentials

**Option A: From Netlify (Fastest)**
1. Go to https://app.netlify.com
2. Select your StartSprint site
3. Navigate: **Site Settings → Environment Variables**
4. Copy both values:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

**Option B: From Supabase Dashboard**
1. Go to https://supabase.com/dashboard
2. Select your StartSprint project
3. Navigate: **Settings → API**
4. Copy:
   - **Project URL** → use as `VITE_SUPABASE_URL`
   - **anon public** key → use as `VITE_SUPABASE_ANON_KEY`

### Step 2: Update .env File

Edit `.env` in the project root:

```env
VITE_SUPABASE_URL=https://your-real-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-real-key
```

### Step 3: Validate

```bash
npm run validate-env
```

Expected output:
```
✅ All Validations Passed!
```

### Step 4: Build

```bash
npm run build
```

Build will proceed automatically if validation passes.

## Troubleshooting

### Build Stops with Validation Error

**Symptom:**
```
❌ Validation Failed
```

**Solution:**
1. Check the error messages - they tell you exactly what's wrong
2. Update `.env` with real credentials
3. Run `npm run validate-env` to verify
4. Try building again

### App Crashes on Startup

**Symptom:**
- Console shows: "❌ Supabase Configuration Error"
- App shows white screen or error boundary

**Solution:**
1. Open browser console (F12)
2. Read the detailed error message
3. The error lists exactly which variables are invalid
4. Update `.env` with correct values
5. Rebuild: `npm run build`

### Still Using Placeholders After Update

**Symptom:**
```
Contains placeholder value - must be replaced
```

**Solution:**
1. Verify you edited the correct `.env` file in project root
2. Check for extra spaces or quotes around values
3. Ensure you saved the file after editing
4. Restart dev server or rebuild

### Production Build Works But Site is Down

**Symptom:**
- Local build succeeds
- Deployed site shows errors

**Solution:**
1. Your **Netlify environment variables** don't match your local `.env`
2. Go to Netlify dashboard → Environment Variables
3. Update them to match your working local values
4. Trigger a redeploy

## CI/CD Integration

### Netlify

Environment variables are automatically injected during build:

1. Set in Netlify dashboard: **Site Settings → Environment Variables**
2. Add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Validation runs automatically during `netlify build`
4. Build fails if validation fails

### GitHub Actions / Other CI

Add environment variables as **secrets** in your CI platform:

```yaml
env:
  VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
  VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
```

## Developer Notes

### Validation Logic

Located in: `scripts/validate-env.js`

Checks:
- ✓ Variables are defined
- ✓ Not empty
- ✓ Not placeholder values
- ✓ Valid format (URL structure, JWT format)
- ✓ Correct domain (.supabase.co)
- ✓ HTTPS protocol

### Runtime Validation

Located in: `src/lib/supabase.ts`

- Runs when app initializes
- Provides detailed console output
- Prevents Supabase client creation with bad config
- Graceful error handling

### Emergency Override

If you absolutely must build without validation:

```bash
npm run build:skip-validation
```

**Note:** The app will still fail at runtime without valid credentials. This is only useful for testing build configuration issues.

## Success Checklist

- [ ] `.env` file exists in project root
- [ ] `VITE_SUPABASE_URL` is set to real URL
- [ ] `VITE_SUPABASE_ANON_KEY` is set to real key
- [ ] `npm run validate-env` shows "✅ All Validations Passed"
- [ ] `npm run build` completes successfully
- [ ] `npm run dev` starts without console errors
- [ ] Browser console shows no Supabase errors
- [ ] Production environment variables match local `.env`

## Support

If you're still having issues:

1. Run `npm run validate-env` and share the output
2. Check browser console for runtime errors
3. Verify Supabase project is active: https://supabase.com/dashboard
4. Confirm Netlify environment variables are set correctly
5. Review `URGENT_FIX_REQUIRED.md` for detailed recovery steps

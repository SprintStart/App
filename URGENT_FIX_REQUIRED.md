# URGENT: App Down - Missing Real Supabase Credentials

## QUICK FIX (2 minutes)
1. Get credentials from Netlify: https://app.netlify.com → Your Site → Environment Variables
2. Paste into `.env` file (replace the placeholder values)
3. Run: `node test-supabase-connection.js` to verify
4. Run: `npm run build` to rebuild

## Problem
The `.env` file has placeholder Supabase credentials. The app builds successfully but fails at runtime with:
- "Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL"
- "Missing Supabase environment variables"

## Current Status
- **Build:** Successful
- **Frontend:** Loads but crashes on initialization
- **Database:** Not connected (placeholder credentials)
- **Impact:** App is completely non-functional

## Root Cause
The `.env` file has placeholder credentials that pass URL validation but don't connect to your actual Supabase project:
```
VITE_SUPABASE_URL=https://placeholder.supabase.co
```
Your production site at startsprint.app is using real Supabase credentials that are configured elsewhere.

## How to Fix

### Step 1: Get Your Real Supabase Credentials

**FASTEST METHOD - From Netlify (if already deployed):**
1. Go to https://app.netlify.com
2. Find your StartSprint site
3. Go to Site Settings → Environment Variables
4. Copy the values for:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

**Alternative - From Supabase Dashboard:**
1. Go to https://supabase.com/dashboard
2. Select your StartSprint project
3. Go to Settings → API
4. Copy:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **Anon/Public Key** (starts with `eyJ...`)

### Step 2: Update the .env File
Edit `/tmp/cc-agent/63189572/project/.env` and replace with your real credentials:

```env
VITE_SUPABASE_URL=https://YOUR_REAL_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...YOUR_REAL_KEY
```

### Step 3: Test the Connection (Optional but Recommended)
```bash
node test-supabase-connection.js
```
This will verify your credentials work before building.

### Step 4: Rebuild and Deploy
```bash
npm run build
# Then redeploy to Netlify or your hosting platform
```

### Step 5: Verify Production Environment Variables
In your Netlify dashboard (or wherever you deployed):
1. Go to Site Settings → Environment Variables
2. Verify these exist and match your .env file:
   - `VITE_SUPABASE_URL` = your real Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your real anon key
3. If they don't match, update them and trigger a redeploy

## Alternative: If You Don't Have a Supabase Project

If you haven't created a Supabase project yet:

1. Go to https://supabase.com
2. Create a new project (takes ~2 minutes)
3. Wait for project to provision
4. Run all the migrations in `/supabase/migrations/` folder
5. Get your credentials from Settings → API
6. Update `.env` as described above

## Quick Test
After updating, test locally:
```bash
npm run dev
```

Then check the browser console - the "Missing Supabase environment variables" error should be gone.

## Need Help?
If you have the production Supabase credentials but can't access them, check:
- Netlify dashboard environment variables
- Previous deployment logs
- Git history for the `.env.example` or `.env.production` files

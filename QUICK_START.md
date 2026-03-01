# Quick Start Guide - Environment Setup

## Problem
App won't build or crashes with "Invalid supabaseUrl" error.

## Solution (2 minutes)

### Step 1: Get Credentials

**From Netlify (Fastest):**
1. Open: https://app.netlify.com
2. Find: Your StartSprint site
3. Go to: Site Settings → Environment Variables
4. Copy both values

**Or from Supabase:**
1. Open: https://supabase.com/dashboard
2. Find: Your project
3. Go to: Settings → API
4. Copy URL and anon key

### Step 2: Update .env

Edit `.env` file in project root:

```env
VITE_SUPABASE_URL=https://your-real-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-real-key
```

### Step 3: Verify

```bash
npm run validate-env
```

Should show: `✅ All Validations Passed!`

### Step 4: Build

```bash
npm run build
```

Build will complete successfully.

## Common Issues

### "Validation Failed"
- You're still using placeholder values
- Update `.env` with real credentials from Netlify or Supabase

### "Build succeeds but app crashes"
- Your production environment variables don't match local
- Update Netlify environment variables to match `.env`

### "Can't find .env file"
- Create it in the project root (same folder as `package.json`)

## Quick Commands

```bash
# Validate config
npm run validate-env

# Build with validation
npm run build

# Build without validation (emergency)
npm run build:skip-validation

# Run dev server
npm run dev
```

## Need More Help?

Read the detailed guides:
- `ENV_VALIDATION_GUIDE.md` - Complete setup guide
- `ENV_VALIDATION_IMPLEMENTATION.md` - Technical details
- `URGENT_FIX_REQUIRED.md` - Troubleshooting

## Variable Names Reference

Must be exactly:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

(Note the `VITE_` prefix - required by Vite)

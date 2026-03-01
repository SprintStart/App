# Supabase Setup Checklist

Use this checklist to get your app working again.

## Status Check

Run these commands to see what's wrong:

```bash
# Check if .env file exists
cat .env

# Check if credentials are still placeholders
grep "placeholder" .env
```

If you see "placeholder" in the output, you need to update your credentials.

## Setup Steps

### [ ] 1. Get Real Credentials

**Option A: From Netlify (Fastest)**
- Go to: https://app.netlify.com
- Select: Your StartSprint site
- Navigate: Site Settings → Environment Variables
- Copy: Both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

**Option B: From Supabase Dashboard**
- Go to: https://supabase.com/dashboard
- Select: Your StartSprint project
- Navigate: Settings → API
- Copy: Project URL and anon/public key

### [ ] 2. Update .env File

Edit the `.env` file and replace:
```env
VITE_SUPABASE_URL=https://placeholder.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...placeholder
```

With your real credentials:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...real-key
```

### [ ] 3. Test Connection

```bash
node test-supabase-connection.js
```

Expected output:
```
✅ Supabase client created successfully
✅ Database connection successful!
🎉 All tests passed!
```

If you see errors, your credentials are wrong or your database is not set up.

### [ ] 4. Build Project

```bash
npm run build
```

Should complete without errors.

### [ ] 5. Test Locally

```bash
npm run dev
```

Open http://localhost:5173 and check the browser console - no Supabase errors should appear.

### [ ] 6. Deploy to Production

Push your changes and redeploy, or manually deploy the `dist` folder.

## Troubleshooting

### Error: "Invalid supabaseUrl"
- Your URL format is wrong
- Must start with `https://` and end with `.supabase.co`
- Example: `https://abcdefghijk.supabase.co`

### Error: "Missing Supabase environment variables"
- Check that `.env` file exists in project root
- Check that both variables are set (not empty)
- Restart dev server after changing .env

### Error: "Database query failed"
- Credentials are correct but database has no data
- Check if migrations have been run
- Check RLS policies in Supabase dashboard

### Build works but app crashes
- Your production environment variables don't match `.env`
- Update Netlify/hosting platform environment variables
- Redeploy after updating

## Quick Commands Reference

```bash
# Test connection
node test-supabase-connection.js

# Build for production
npm run build

# Run locally
npm run dev

# Check environment variables
cat .env | grep VITE_SUPABASE
```

## Still Need Help?

1. Check `URGENT_FIX_REQUIRED.md` for detailed instructions
2. Verify your Supabase project is active at https://supabase.com/dashboard
3. Verify your Netlify environment variables match your `.env`
4. Check browser console for specific error messages

# Authentication Fix - Teacher Signup & Login

## Problem Summary

Teacher signup was failing with **500 Internal Server Error**:
```
POST /auth/v1/signup → 500
Error: AuthApiError: Database error saving new user
```

Teacher login was failing with **400 Bad Request**:
```
POST /auth/v1/token?grant_type=password → 400
Error: Invalid login credentials
```

## Root Cause

The database was missing a critical trigger to create user profiles during signup. When a teacher tried to sign up:

1. ✅ Supabase Auth successfully created a record in `auth.users`
2. ❌ No trigger existed to create the corresponding profile in `public.profiles`
3. ❌ Login failed because the user existed in `auth.users` but not in `profiles`

## Solution Implemented

### 1. Created `handle_new_user()` Function

Added a database function that automatically creates a profile when a new user signs up:

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    'teacher'
  );

  RETURN NEW;
END;
$$;
```

**Key features:**
- Runs as `SECURITY DEFINER` to bypass RLS during initial profile creation
- Extracts `full_name` from user metadata
- Sets default `role` to `'teacher'`
- Profile `id` always matches `auth.users.id`

### 2. Created Trigger on `auth.users`

```sql
CREATE TRIGGER trigger_handle_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
```

This trigger fires immediately after a new user is inserted, creating their profile.

### 3. Added INSERT Policy for Profiles

```sql
CREATE POLICY "Users can create own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id);
```

While the trigger uses `SECURITY DEFINER` to bypass RLS, this policy ensures:
- Consistent security model
- Manual profile creation is still secured
- Better auditability

### 4. Updated Email Sync Function

Made `sync_profile_email()` idempotent using `INSERT ON CONFLICT`:

```sql
CREATE OR REPLACE FUNCTION sync_profile_email()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, updated_at)
  VALUES (NEW.id, NEW.email, now())
  ON CONFLICT (id)
  DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = EXCLUDED.updated_at;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;
```

This makes the function safe to run even if the profile already exists.

## Current Database State

### Auth Triggers (on `auth.users`)
1. `trigger_handle_new_user` → Creates profile on signup
2. `trigger_sync_profile_email` → Syncs email changes

### Profile Policies (on `profiles`)
1. **INSERT**: Users can create own profile
2. **UPDATE**: Users can update own profile
3. **SELECT**: Users can view own profile or admins can view all

### Profile Triggers
None (by design - no subscription trigger since subscriptions table doesn't exist)

## Signup Flow (End-to-End)

### Step 1: User Fills Signup Form
```typescript
// src/components/auth/SignupForm.tsx
const { data, error } = await supabase.auth.signUp({
  email: normalizedEmail,
  password,
  options: {
    emailRedirectTo: `${window.location.origin}/auth/confirmed`,
    data: {
      full_name: fullName,
    },
  },
});
```

### Step 2: Supabase Auth Creates User
1. New record inserted into `auth.users`
2. Email stored in `auth.users.email`
3. Full name stored in `auth.users.raw_user_meta_data->>'full_name'`

### Step 3: Trigger Creates Profile
1. `trigger_handle_new_user` fires AFTER INSERT
2. Calls `handle_new_user()` function
3. Inserts into `public.profiles`:
   - `id` = `auth.users.id`
   - `email` = `auth.users.email`
   - `full_name` = from metadata
   - `role` = `'teacher'`

### Step 4: Email Confirmation
1. Supabase sends confirmation email
2. User clicks link
3. Redirects to `/auth/confirmed`
4. Shows success message

### Step 5: Login
1. User enters credentials
2. Supabase Auth validates against `auth.users`
3. Profile exists in `profiles` table
4. Login succeeds
5. User redirected to dashboard

## Email Confirmation Notes

**Email confirmation is ENABLED by default in Supabase.**

This means:
- Users CANNOT log in until they confirm their email
- After signup, users must check their email
- The confirmation link redirects to `/auth/confirmed`
- Only after confirmation can they log in

### UI Flow for Email Confirmation

**After Signup:**
1. User submits signup form
2. Supabase creates account
3. Database trigger creates profile
4. User redirected to `/signup-success`
5. Shows "Check your email to confirm your account" screen
6. User receives confirmation email
7. User clicks confirmation link → redirects to `/auth/confirmed`
8. User can now log in

**Resend Confirmation Email:**
- Available on `/signup-success` page
- Available on `/login` page when "Email not confirmed" error occurs
- Uses `supabase.auth.resend({ type: 'signup', email })`

**Login Before Confirmation:**
- Login fails with error: "Email not confirmed"
- Error message shows with "Resend confirmation email" button
- User can resend confirmation and try again

### To Disable Email Confirmation (Optional)

If you want users to log in immediately without email confirmation:

1. Go to Supabase Dashboard → Authentication → Providers
2. Find "Email" provider
3. Disable "Confirm email"
4. Save changes

**Note:** Keeping email confirmation ENABLED is recommended for production to prevent spam signups.

## Critical Supabase Dashboard Configuration

### Required Settings for Production

**IMPORTANT:** These settings MUST be configured in the Supabase Dashboard before deployment.

#### 1. Site URL Configuration

Go to: **Authentication → URL Configuration**

Set **Site URL** to:
```
https://startsprint.app
```

This is the base URL that Supabase will use for redirects.

#### 2. Redirect URLs (Allowed)

Go to: **Authentication → URL Configuration**

Add these URLs to **Redirect URLs**:
```
https://startsprint.app/*
https://startsprint.app/auth/confirmed
https://startsprint.app/auth/callback
https://startsprint.app/reset-password
```

**Important:**
- The wildcard `https://startsprint.app/*` allows all paths under your domain
- Include specific paths for email confirmation and password reset
- DO NOT include `localhost` URLs in production

#### 3. Email Templates

Go to: **Authentication → Email Templates**

**Confirm signup template:**
- Make sure the confirmation URL uses: `{{ .SiteURL }}/auth/confirmed?token={{ .Token }}`
- DO NOT hardcode localhost or other domains
- Verify "Disable email link tracking" is enabled (see SUPABASE_EMAIL_FIX.md)

**Reset password template:**
- Make sure the reset URL uses: `{{ .SiteURL }}/reset-password?token={{ .Token }}`
- DO NOT hardcode localhost or other domains

#### 4. Testing Configuration

Before going live, test with a real email:

1. Sign up with a real email address
2. Check that confirmation email arrives
3. Click confirmation link
4. Verify it redirects to `https://startsprint.app/auth/confirmed` (NOT localhost)
5. Verify SSL certificate is valid (no warnings)
6. Log in successfully

### Common Configuration Mistakes

❌ **Wrong:** Site URL set to `http://localhost:5173`
✅ **Right:** Site URL set to `https://startsprint.app`

❌ **Wrong:** Confirmation link contains `localhost` or tracking domain
✅ **Right:** Confirmation link goes directly to `https://startsprint.app/auth/confirmed`

❌ **Wrong:** Redirect URLs list is empty or only contains localhost
✅ **Right:** Redirect URLs includes production domain with wildcard

❌ **Wrong:** Email templates hardcode URLs
✅ **Right:** Email templates use `{{ .SiteURL }}` variable

## Testing the Fix

### Test 1: New Teacher Signup (Happy Path)

1. **Navigate to signup page**
   ```
   https://startsprint.app/teacher
   ```

2. **Fill in signup form:**
   - Full Name: `Test Teacher`
   - Email: `test.teacher@example.com`
   - Password: `SecurePass123!`

3. **Click "Create account & continue"**

4. **Expected results:**
   - ✅ No 500 error
   - ✅ Redirected to `/signup-success`
   - ✅ See message: "Check your email to confirm your account"
   - ✅ Confirmation email received

5. **Verify in database:**
   ```sql
   SELECT id, email, role FROM profiles WHERE email = 'test.teacher@example.com';
   ```
   - Should return one row
   - `role` should be `'teacher'`

### Test 2: Email Confirmation

1. **Open confirmation email**

2. **Click "Confirm my email"**

3. **Expected results:**
   - ✅ Browser opens `https://startsprint.app/auth/confirmed`
   - ✅ No SSL certificate errors
   - ✅ No tracking domain redirects
   - ✅ See "Email Verified!" success message
   - ✅ Button: "Go to Dashboard"

### Test 3: Login After Confirmation

1. **Navigate to login page**
   ```
   https://startsprint.app/teacher
   ```

2. **Click "Sign in" tab**

3. **Enter credentials:**
   - Email: `test.teacher@example.com`
   - Password: `SecurePass123!`

4. **Click "Sign in"**

5. **Expected results:**
   - ✅ No 400 error
   - ✅ No "Invalid login credentials" error
   - ✅ Redirected to `/dashboard`
   - ✅ Can see teacher dashboard

### Test 4: Duplicate Email Prevention

1. **Try to sign up with existing email**
   - Email: `test.teacher@example.com`

2. **Expected results:**
   - ✅ See inline error: "This email is already registered"
   - ✅ See "Sign in" button
   - ✅ See "Reset password" button
   - ❌ No signup allowed

### Test 5: Login Before Email Confirmation

1. **Create new account** but DON'T confirm email

2. **Try to log in immediately**

3. **Expected results:**
   - ❌ Login fails with: "Email not confirmed"
   - ✅ See message prompting to check email

## Troubleshooting

### Issue: Still getting 500 on signup

**Check:**
1. Verify trigger exists:
   ```sql
   SELECT tgname FROM pg_trigger
   WHERE tgrelid = 'auth.users'::regclass
   AND tgname = 'trigger_handle_new_user';
   ```

2. Check for errors in Supabase logs:
   - Dashboard → Logs → Database
   - Look for constraint violations

### Issue: Login fails after signup

**Check:**
1. Verify profile was created:
   ```sql
   SELECT * FROM profiles WHERE email = 'user@example.com';
   ```

2. Check email confirmation status:
   ```sql
   SELECT email, email_confirmed_at
   FROM auth.users
   WHERE email = 'user@example.com';
   ```
   - If `email_confirmed_at` is NULL, user hasn't confirmed email

### Issue: "Invalid login credentials" error

**Possible causes:**
1. Email not confirmed yet (if confirmation is enabled)
2. Wrong password
3. User doesn't exist in `auth.users`

**Check:**
```sql
SELECT u.email, u.email_confirmed_at, p.role
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE u.email = 'user@example.com';
```

## Security Notes

### Profile Creation Security

1. **Trigger runs as SECURITY DEFINER**
   - Bypasses RLS during initial profile creation
   - This is SAFE because the trigger controls all values
   - Profile `id` is sourced from `auth.users.id` (trusted)

2. **Users cannot spoof profile creation**
   - INSERT policy requires `auth.uid() = id`
   - Only the authenticated user can create their own profile
   - Cannot create profiles for other users

3. **Email is trusted source**
   - Comes directly from `auth.users.email`
   - Already validated by Supabase Auth
   - Cannot be manipulated by the client

### Function Search Path Security

All functions use explicit `search_path`:
```sql
SET search_path = public, pg_temp
```

This prevents search path injection attacks.

## Migration Files Applied

The following migrations were applied to fix this issue:

1. **`20260131110049_fix_auth_trigger_create_profile.sql`**
   - Created `handle_new_user()` function
   - Created trigger on `auth.users`
   - Updated `sync_profile_email()` to be idempotent

2. **`20260131110128_add_profiles_insert_policy.sql`**
   - Added INSERT policy for profiles table

## Summary

✅ **Fixed:** Profile creation during signup
✅ **Fixed:** Login after signup
✅ **Added:** Email confirmation redirect to `/auth/confirmed`
✅ **Added:** Password reset page at `/reset-password`
✅ **Verified:** RLS policies are secure
✅ **Verified:** No orphaned triggers referencing missing tables

The teacher signup and login flow is now fully functional.

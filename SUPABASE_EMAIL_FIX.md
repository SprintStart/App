# CRITICAL: Fix Email Confirmation Flow

## Problem Summary
Email confirmation links are being rewritten through a tracking domain (`url3153.startsprint.app`) that has invalid SSL certificates, blocking teacher signups.

## What We Fixed in Code
✅ Added `emailRedirectTo` parameter to signup flow → redirects to `/auth/confirmed`
✅ Created `/auth/confirmed` page to show successful email verification
✅ Created `/reset-password` page for password reset flow
✅ Email availability check prevents duplicate signups
✅ Database unique constraint enforces email uniqueness

## Required Supabase Dashboard Configuration

### Step 1: Update Auth Settings

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Set the following values:

   **Site URL:**
   ```
   https://startsprint.app
   ```

   **Redirect URLs (add both):**
   ```
   https://startsprint.app/auth/confirmed
   https://startsprint.app/reset-password
   ```

3. Save changes

### Step 2: Disable Email Link Tracking (CRITICAL)

If you're using an email service provider (SendGrid, Mailgun, etc.), you MUST disable click tracking for authentication emails:

#### For SendGrid:
1. Go to Settings → Tracking
2. Turn OFF "Click Tracking" for authentication emails
3. OR create a separate email template group for auth emails with tracking disabled

#### For Mailgun:
1. Go to Sending → Domains → [your domain] → Settings
2. Disable "Track Clicks" for authentication emails
3. OR use unsubscribe groups to exclude auth emails from tracking

#### For Supabase's Built-in Email:
Supabase's default email service should NOT rewrite links. If links are being rewritten, check:
1. Custom SMTP settings
2. Any email proxy/forwarding services
3. DNS records that might route through a tracking service

### Step 3: Update Email Templates (If Using Custom Templates)

If you have custom email templates configured:

1. Go to Supabase Dashboard → Authentication → Email Templates
2. For each template (Confirm signup, Reset password), ensure the link uses the raw variable:

   **Correct format:**
   ```html
   <a href="{{ .ConfirmationURL }}">Confirm your email</a>
   ```

   **WRONG - DO NOT USE:**
   ```html
   <a href="https://url3153.startsprint.app/ls/click/...">Confirm your email</a>
   ```

3. DO NOT wrap or transform the URL
4. DO NOT add tracking parameters manually

### Step 4: Verify Email Template Variables

Ensure these variables are correctly used in templates:

- **Signup Confirmation:** `{{ .ConfirmationURL }}`
- **Password Reset:** `{{ .ConfirmationURL }}`
- **Email Change:** `{{ .ConfirmationURL }}`

### Step 5: Check DNS and Domain Configuration

Ensure your domain is properly configured:

1. Verify `startsprint.app` has a valid SSL certificate
2. Ensure no DNS-level redirects or proxies are rewriting URLs
3. Check for any Cloudflare Workers or edge functions that might modify emails

## Testing the Fix

After making the above changes, test the complete flow:

### Test 1: New Teacher Signup
1. Go to signup page
2. Enter a new teacher email
3. Click "Create account & continue"
4. Check email inbox
5. Click "Confirm my email" button
6. **Expected:** Browser opens `https://startsprint.app/auth/confirmed`
7. **Expected:** See "Email Verified!" success message
8. **Expected:** No SSL certificate errors
9. **Expected:** Can proceed to dashboard

### Test 2: Password Reset
1. Go to login page
2. Click "Forgot your password?"
3. Enter email and submit
4. Check email inbox
5. Click reset password link
6. **Expected:** Browser opens `https://startsprint.app/reset-password`
7. **Expected:** Can set new password
8. **Expected:** Redirected to dashboard after success

### Test 3: Duplicate Email Prevention
1. Try to sign up with an existing email
2. **Expected:** See inline error: "This email is already registered"
3. **Expected:** See "Sign in" and "Reset password" buttons
4. **Expected:** Cannot proceed to create duplicate account

## Troubleshooting

### If links are still being rewritten:

1. **Check your email service logs** - see if the link is being modified before sending
2. **Inspect the raw email source** - right-click the email and "Show Original" or "View Source"
3. **Look for the actual href value** - it should be the raw Supabase URL, not a tracking domain
4. **Contact your email provider** if tracking persists despite being disabled

### If SSL errors persist:

1. Verify `url3153.startsprint.app` is NOT in your DNS records
2. Check for any email routing/forwarding rules
3. Ensure you're not using a third-party email tracking service
4. Check Cloudflare or CDN settings that might proxy emails

### If redirects fail:

1. Verify the Site URL in Supabase Auth settings matches exactly: `https://startsprint.app`
2. Ensure redirect URLs are in the allowed list
3. Check browser console for CORS errors
4. Verify the user's session is being properly handled

## Additional Security Recommendations

1. **Enable Rate Limiting** on the `/check-teacher-email` endpoint to prevent abuse
2. **Monitor Failed Signups** in the audit_logs table
3. **Set up Email Deliverability Monitoring** to catch issues early
4. **Configure SPF, DKIM, and DMARC** records for your domain to improve email delivery

## Support Resources

- Supabase Auth Docs: https://supabase.com/docs/guides/auth
- Supabase Email Configuration: https://supabase.com/docs/guides/auth/auth-email
- Email Template Variables: https://supabase.com/docs/guides/auth/auth-email-templates

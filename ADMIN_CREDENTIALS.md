# StartSprint Admin Access

## Admin Credentials

**Email**: `lesliekweku.addae@gmail.com`
**User ID**: `b517e2f3-c3d1-4c87-8ffc-c76cf18592ef`
**Role**: `admin`
**Status**: ✅ Active (password setup required on first login)

---

## How to Access Admin Portal

### First Time Setup

1. **Go to Admin Login**:
   - URL: `https://startsprint.app/admin/login`

2. **Request Password Setup**:
   - Enter email: `lesliekweku.addae@gmail.com`
   - Click "Send Password Setup Link"
   - Check your inbox (arrives within 30 seconds)

3. **Set Your Password**:
   - Click the link in the email
   - You'll be redirected to password setup page
   - Enter a password (minimum 8 characters)
   - Confirm password
   - Click "Set Password"

4. **Log In**:
   - You'll be redirected to login page
   - Enter email and your new password
   - Click "Admin Sign In"

5. **Access Dashboard**:
   - Automatically redirected to `/admindashboard`
   - Full admin access granted

### Subsequent Logins

1. Go to: `https://startsprint.app/admin/login`
2. Enter email: `lesliekweku.addae@gmail.com`
3. Enter your password
4. Click "Admin Sign In"

---

## Admin Capabilities

Once logged in, you have access to:

- **Teacher Management**: View, approve, and manage all teacher accounts
- **Subscription Management**: View and modify teacher subscriptions
- **Analytics Dashboard**: View platform-wide analytics and reports
- **Content Management**: Manage quiz content, topics, and question sets
- **Sponsor Ads**: Create and manage sponsored banner ads
- **System Health**: Monitor system status and performance
- **Audit Logs**: View all admin actions and security events
- **School Management**: Configure school domains and auto-upgrade rules

---

## Security Features

### Access Control
- ✅ Only `lesliekweku.addae@gmail.com` can access admin portal (allowlist enforced)
- ✅ Role verified at login (non-admins automatically signed out)
- ✅ Role verified on every admin API call
- ✅ Session automatically invalidated if role changes

### Audit Trail
- ✅ All admin actions logged to `audit_logs` table
- ✅ Failed login attempts logged
- ✅ Password changes logged
- ✅ Timestamps and actor IDs recorded

### Database Security
- ✅ RLS (Row Level Security) enforced on all tables
- ✅ Admin-only policies check JWT role
- ✅ Service role key kept secure (server-side only)

---

## Troubleshooting

### "Access Denied" Error

**Cause**: Email not in allowlist or user doesn't have admin role

**Solution**:
1. Verify you're using: `lesliekweku.addae@gmail.com`
2. Check console for detailed error message
3. If role is missing, contact database administrator

### "Invalid Reset Link" Error

**Cause**: Password setup link expired (1 hour timeout)

**Solution**:
1. Go back to `/admin/login`
2. Request a new password setup link
3. Use the new link within 1 hour

### No Email Received

**Cause**: Email may be in spam or delayed

**Solution**:
1. Check spam/junk folder
2. Wait up to 2 minutes (usually arrives within 30 seconds)
3. Try requesting again (it's safe to call multiple times)
4. Check console logs for error messages

### Console Shows Error

**Solution**:
1. Copy the full error message
2. Check `ADMIN_LOGIN_FIX_COMPLETE.md` for troubleshooting details
3. All errors are logged with detailed context

---

## Technical Details

### Database Tables

**auth.users**:
- Contains admin authentication credentials
- `raw_app_meta_data.role = 'admin'`

**profiles**:
- Contains admin profile information
- `role = 'admin'`
- Linked to `auth.users` via `id`

**audit_logs**:
- Contains all admin actions
- Searchable by action type, date, actor
- Immutable (cannot be edited or deleted)

### Edge Functions

**create-admin-user**:
- Ensures admin user exists in database
- Generates password setup links
- Uses service role key (full privileges)
- Validates allowlist before any action

### Routes

- `/admin/login` - Admin login page
- `/admin/reset-password` - Password setup/reset page
- `/admindashboard` - Main admin dashboard

---

## Important Notes

### DO NOT:
- ❌ Share admin credentials
- ❌ Use admin account for testing
- ❌ Disable security features
- ❌ Bypass allowlist enforcement

### DO:
- ✅ Use strong password (minimum 8 characters, recommended 16+)
- ✅ Log out when finished
- ✅ Review audit logs regularly
- ✅ Report any suspicious activity

---

## Need Help?

Refer to `ADMIN_LOGIN_FIX_COMPLETE.md` for:
- Detailed technical documentation
- Complete flow diagrams
- Database schema details
- Edge Function implementation
- Security architecture
- Troubleshooting guide

---

**Admin Portal Status**: ✅ Fully Functional and Secure

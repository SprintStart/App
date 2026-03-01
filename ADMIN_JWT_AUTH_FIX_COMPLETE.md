# Admin JWT Authentication Fix - Complete

## Problem Summary
Admin dashboard at `/admindashboard/teachers` was returning 401 "Invalid JWT" errors when calling admin edge functions, despite the admin route guard passing successfully.

**Root Causes Identified:**
1. Edge functions were using service role key to validate JWT tokens (incorrect)
2. Frontend was not consistently sending access_token in Authorization header
3. Edge functions were not properly extracting Bearer token
4. Database queries were using wrong Supabase client (auth client instead of service role)

---

## Solution Implemented

### 1. Frontend Changes

**File:** `src/components/admin/TeachersListPage.tsx`

**Changes Made:**
- Added explicit check for `session.access_token` availability
- Added debug logging to show token length (without exposing actual token)
- Improved error handling to show detailed error messages
- Removed unnecessary `apikey` header (not needed for edge functions)

**Before:**
```typescript
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  throw new Error('Not authenticated');
}

const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-teachers`,
  {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
  }
);
```

**After:**
```typescript
const { data: { session } } = await supabase.auth.getSession();
if (!session?.access_token) {
  throw new Error('No access token available');
}

console.log('[Teachers List] Access token length:', session.access_token.length);

const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-teachers`,
  {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  }
);

if (!response.ok) {
  const errorData = await response.json().catch(() => ({}));
  console.error('[Teachers List] Request failed:', response.status, errorData);
  throw new Error(errorData.error || errorData.details || 'Failed to load teachers');
}
```

---

### 2. Edge Function Pattern (Applied to All Admin Functions)

**Correct JWT Validation Pattern:**

```typescript
// 1. Check for Bearer token
const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
if (!authHeader?.startsWith('Bearer ')) {
  console.error('[Function Name] Missing or invalid auth header');
  return new Response(JSON.stringify({ error: 'Missing bearer token' }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const token = authHeader.replace('Bearer ', '');
console.log('[Function Name] Token length:', token.length);

// 2. Create ANON key client for user validation
const userClient = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: `Bearer ${token}` } }
});

// 3. Validate JWT token
const { data: { user }, error: authError } = await userClient.auth.getUser();

if (authError || !user) {
  console.error('[Function Name] Auth error:', authError?.message || 'No user');
  return new Response(JSON.stringify({
    error: 'Invalid JWT',
    details: authError?.message || 'No user found'
  }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

console.log('[Function Name] User validated:', user.id, user.email);

// 4. Create SERVICE ROLE client for DB queries
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// 5. Check admin allowlist
const { data: adminCheck } = await supabaseAdmin
  .from('admin_allowlist')
  .select('role')
  .eq('email', user.email)
  .eq('is_active', true)
  .maybeSingle();

if (!adminCheck) {
  console.error('[Function Name] User not in admin allowlist:', user.email);
  return new Response(JSON.stringify({ error: 'Forbidden - admin access required' }), {
    status: 403,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

console.log('[Function Name] Admin check passed');

// 6. Use supabaseAdmin for ALL database queries
const { data } = await supabaseAdmin.from('table_name').select('*');
```

---

### 3. Key Principles

**JWT Validation:**
- ✅ MUST use anon key client with Bearer token for `auth.getUser()`
- ✅ MUST extract token from `Authorization: Bearer <token>` header
- ✅ MUST check both lowercase and uppercase header variants
- ❌ NEVER use service role key for JWT validation
- ❌ NEVER use `supabase.auth.getUser(token)` with service role client

**Database Queries:**
- ✅ MUST use service role client for all DB operations
- ✅ MUST use `supabaseAdmin` variable for clarity
- ❌ NEVER use auth client for DB queries (lacks permissions)

**Logging:**
- ✅ MUST log token length (safe)
- ✅ MUST log user ID and email after validation
- ✅ MUST log admin check result
- ❌ NEVER log full token (security risk)

---

## Functions Fixed

All admin edge functions have been updated with the correct authentication pattern:

1. ✅ `admin-get-teachers` - Lists all teachers with filtering
2. ✅ `admin-get-audit-logs` - Retrieves audit log entries
3. ✅ `admin-get-teacher-detail` - Gets detailed teacher information
4. ✅ `admin-suspend-teacher` - Suspends teacher and unpublishes content
5. ✅ `admin-reactivate-teacher` - Reactivates teacher and restores content
6. ✅ `admin-grant-premium` - Grants premium access to teacher
7. ✅ `admin-revoke-premium` - Revokes premium access from teacher
8. ✅ `admin-send-password-reset` - Sends password reset email
9. ✅ `admin-set-password` - Sets new password for teacher
10. ✅ `admin-resend-verification` - Resends verification email

All functions deployed successfully to Supabase.

---

## Testing Checklist

### Pre-Deployment
- [x] All edge functions build without errors
- [x] Frontend builds without errors
- [x] TypeScript compilation passes

### Post-Deployment
- [ ] Admin can log in successfully
- [ ] Teachers page loads without 401 errors
- [ ] Teacher list displays correctly
- [ ] Teacher detail view loads
- [ ] Suspend/reactivate actions work
- [ ] Grant/revoke premium actions work
- [ ] Password reset actions work
- [ ] Audit logs display correctly
- [ ] Console logs show token validation steps
- [ ] No JWT errors in browser console
- [ ] No JWT errors in edge function logs

---

## Debug Logging

When testing, look for these console messages:

**Frontend (Browser Console):**
```
[Teachers List] Access token length: 234
[Teachers List] Teachers loaded: 5
```

**Edge Function (Supabase Logs):**
```
[Admin Get Teachers] Token length: 234
[Admin Get Teachers] User validated: uuid-here user@example.com
[Admin Get Teachers] Admin check passed, role: admin
```

**Error States to Check:**
```
[Admin Get Teachers] Missing or invalid auth header → 401
[Admin Get Teachers] Auth error: ... → 401
[Admin Get Teachers] User not in admin allowlist → 403
```

---

## Common Issues & Solutions

### Issue: Still getting 401 "Invalid JWT"
**Possible Causes:**
1. Using refresh_token instead of access_token
2. Token expired (session needs refresh)
3. Wrong Supabase project URL
4. Edge function not redeployed

**Solution:**
```typescript
// Check token expiry
const { data: { session }, error } = await supabase.auth.getSession();
if (error || !session) {
  // Refresh session
  const { data: { session: newSession } } = await supabase.auth.refreshSession();
  // Use newSession.access_token
}
```

### Issue: 403 "Forbidden - admin access required"
**Possible Causes:**
1. User email not in admin_allowlist table
2. admin_allowlist.is_active = false

**Solution:**
```sql
-- Check if user is in allowlist
SELECT * FROM admin_allowlist WHERE email = 'admin@example.com';

-- Add user if missing
INSERT INTO admin_allowlist (email, is_active, role)
VALUES ('admin@example.com', true, 'admin');
```

### Issue: Edge function returns 500
**Possible Causes:**
1. Database query using wrong client
2. Missing service role key environment variable

**Solution:**
- Ensure all DB queries use `supabaseAdmin` client
- Check Supabase project has SERVICE_ROLE_KEY configured

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend (Admin Dashboard)                                   │
│                                                              │
│  1. Get session.access_token                                │
│  2. Call Edge Function with Bearer token                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ Authorization: Bearer <access_token>
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Edge Function                                                │
│                                                              │
│  3. Extract Bearer token                                     │
│  4. Validate with ANON client + token → auth.getUser()      │
│     ✓ Returns user object                                   │
│                                                              │
│  5. Check admin_allowlist with SERVICE ROLE client          │
│     ✓ User is admin                                         │
│                                                              │
│  6. Execute DB queries with SERVICE ROLE client             │
│     ✓ Has full permissions                                  │
│                                                              │
│  7. Return data                                             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ 200 OK { data: ... }
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Frontend displays data                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Definition of Done

✅ All admin edge functions use correct JWT validation pattern
✅ Frontend sends access_token in Authorization header
✅ All functions check bearer token format
✅ User validation uses anon client
✅ Database queries use service role client
✅ Admin allowlist checked for authorization
✅ Proper error messages returned (401, 403, 500)
✅ Debug logging added (token length, user ID, admin status)
✅ All functions deployed to Supabase
✅ Build succeeds without errors
✅ No security vulnerabilities (tokens never logged)

---

## Related Files

### Frontend
- `src/components/admin/TeachersListPage.tsx` - Updated

### Edge Functions (All Updated)
- `supabase/functions/admin-get-teachers/index.ts`
- `supabase/functions/admin-get-audit-logs/index.ts`
- `supabase/functions/admin-get-teacher-detail/index.ts`
- `supabase/functions/admin-suspend-teacher/index.ts`
- `supabase/functions/admin-reactivate-teacher/index.ts`
- `supabase/functions/admin-grant-premium/index.ts`
- `supabase/functions/admin-revoke-premium/index.ts`
- `supabase/functions/admin-send-password-reset/index.ts`
- `supabase/functions/admin-set-password/index.ts`
- `supabase/functions/admin-resend-verification/index.ts`

### Shared Utilities (Created)
- `supabase/functions/_shared/admin-auth.ts` - Reusable auth pattern (for future use)

---

## Next Steps

1. Test admin dashboard in production environment
2. Verify all teacher management actions work correctly
3. Monitor edge function logs for any auth errors
4. Consider refactoring to use shared auth utility for consistency

---

**Status:** ✅ Complete
**Build Status:** ✅ Success
**Deployment Status:** ✅ All Functions Deployed
**Ready for Testing:** ✅ Yes

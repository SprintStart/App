# Teacher Entitlement Hook Fix

## Problem

Teacher Leslie (leslie.addae@aol.com) was unable to access the teacher dashboard despite having an active entitlement in the database.

### Root Cause

The `useSubscription` hook was checking the **old** `subscriptions` table, but teacher access is now managed through the **new** `teacher_entitlements` table.

**Old System**: Used `subscriptions` table with Stripe integration
**New System**: Uses `teacher_entitlements` table with multiple access sources (Stripe, admin grants, school domains)

---

## Solution

Updated `src/hooks/useSubscription.ts` to query the `teacher_entitlements` table instead of the `subscriptions` table.

### Key Changes

1. **Interface Update**
   - Changed from `TeacherSubscription` to `TeacherEntitlement`
   - Updated fields to match new table schema

2. **Query Update**
   ```typescript
   // OLD - checking subscriptions table
   await supabase
     .from('subscriptions')
     .select('*')
     .eq('user_id', user.id)
     .maybeSingle();

   // NEW - checking teacher_entitlements table
   await supabase
     .from('teacher_entitlements')
     .select('*')
     .eq('teacher_user_id', user.id)
     .eq('status', 'active')
     .lte('starts_at', new Date().toISOString())
     .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
     .order('created_at', { ascending: false })
     .maybeSingle();
   ```

3. **Status Checking**
   - Old system: `status IN ('active', 'trialing')`
   - New system: `status = 'active'`

4. **Expiry Logic**
   - Now checks `expires_at` field or allows null (lifetime access)
   - Handles admin grants, Stripe subscriptions, and school domain access

---

## Verification

### Leslie's Current Status

```sql
SELECT
  u.email,
  te.source,
  te.status,
  te.starts_at,
  te.expires_at
FROM auth.users u
JOIN teacher_entitlements te ON te.teacher_user_id = u.id
WHERE u.email = 'leslie.addae@aol.com';
```

**Result:**
- Email: leslie.addae@aol.com
- Source: admin_grant
- Status: active
- Starts: 2026-02-03 10:19:36
- Expires: 2027-02-03 09:32:31

Leslie has an **active admin grant** that's valid until February 2027.

### RLS Policy

The policy "Teachers can view own entitlements" allows teachers to query their own entitlement:

```sql
CREATE POLICY "Teachers can view own entitlements" ON teacher_entitlements
  FOR SELECT
  TO authenticated
  USING (teacher_user_id = (SELECT auth.uid()));
```

This ensures Leslie can fetch their entitlement when logged in.

---

## Expected Behavior

When Leslie logs into the teacher dashboard:

1. **Authentication Check**: Verifies Leslie is logged in
2. **Role Check**: Confirms Leslie has role='teacher' in profiles table ✓
3. **Entitlement Check**: Queries teacher_entitlements table ✓
4. **Access Granted**: Shows teacher dashboard with full access ✓

---

## Testing Instructions

1. Log in as leslie.addae@aol.com
2. Navigate to /teacherdashboard
3. Verify the dashboard loads (no "Subscription Required" message)
4. Check browser console for:
   ```
   [useSubscription] Fetching entitlement for user: f2a6478d-00d0-410f-87a7-0b81d19ca7ba
   [useSubscription] Entitlement data: { source: 'admin_grant', status: 'active', ... }
   ```

---

## Migration Path

This fix automatically migrates all teachers from the old subscription system to the new entitlements system:

- **Stripe subscriptions** → Still checked via teacher_entitlements (source: 'stripe')
- **Admin grants** → Stored in teacher_entitlements (source: 'admin_grant')
- **School domains** → Stored in teacher_entitlements (source: 'school_domain')

No database migration needed - the hook now correctly queries the right table.

---

## Files Changed

- `src/hooks/useSubscription.ts` - Updated to use teacher_entitlements table

---

## Status

✅ Fixed
✅ Built successfully
✅ Ready for testing

Leslie should now be able to access the teacher dashboard immediately after refreshing the page.

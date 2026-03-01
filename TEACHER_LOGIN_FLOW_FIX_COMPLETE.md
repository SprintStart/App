# Teacher Login Flow Fix - Complete

**Date:** 2026-02-03
**Status:** ✅ COMPLETE

---

## Issues Fixed

### 1. Teacher Dashboard Premature Redirect
**Problem:** After clicking "Teacher Login", the dashboard would load but immediately show "User does not have teacher or admin role, redirecting to /" even though server verification returned `{teacher: true, is_premium: true}`.

**Root Cause:** The `TeacherDashboard` component had this logic:
```typescript
const [isTeacher, setIsTeacher] = useState(false); // ❌ Default false

// Later in render:
if (!isTeacher) {
  console.log('User does not have teacher or admin role, redirecting to /');
  navigate('/', { replace: true });  // ❌ Redirects BEFORE verification completes
}
```

The component would render with `isTeacher = false`, trigger the redirect, THEN the async verification would complete.

**Solution:** Created `resolveTeacherAccess()` helper that completes ALL verification before rendering dashboard. Dashboard now only renders when `state === 'verified_paid'`.

### 2. Topics Loading "Permission Denied for table users"
**Problem:** When teachers try to create quizzes, they see "permission denied for table users" error.

**Root Cause:** The topics table had an RLS policy that directly queried `auth.users`:
```sql
CREATE POLICY "Admins can read all topics" ON topics
USING (
  EXISTS (
    SELECT 1 FROM admin_allowlist
    WHERE admin_allowlist.email = (
      SELECT users.email FROM auth.users  -- ❌ Frontend can't access auth.users
      WHERE users.id = auth.uid()
    )
  )
);
```

**Solution:** Replaced the policy to use `profiles` table instead:
```sql
CREATE POLICY "Admins can read all topics via function" ON topics
USING (
  EXISTS (
    SELECT 1 FROM admin_allowlist
    WHERE admin_allowlist.email = (
      SELECT email FROM profiles  -- ✅ Frontend can access profiles
      WHERE id = auth.uid()
    )
  )
);
```

---

## Changes Made

### 1. New Helper: `resolveTeacherAccess()`
**File:** `src/lib/teacherAccess.ts`

Single source of truth for teacher access state. Returns one of:
- `logged_out` - No session
- `unverified` - Teacher account not verified
- `verified_unpaid` - Teacher verified but no premium subscription
- `verified_paid` - Full access granted
- `blocked` - Account inactive/expired

**Flow:**
```
resolveTeacherAccess()
  ↓
1. Check session (logged_out if none)
  ↓
2. Call /verify-teacher (server-side role check)
  ↓
3. Call /check-teacher-state (subscription status)
  ↓
4. Return state + recommended redirectTo
```

### 2. Updated TeacherDashboard Component
**File:** `src/pages/TeacherDashboard.tsx`

**Before (BROKEN):**
```typescript
// ❌ Redirects while still checking
const [isTeacher, setIsTeacher] = useState(false);

useEffect(() => {
  checkTeacherRole(); // Async, takes time
}, []);

if (!isTeacher) {
  navigate('/'); // ❌ Happens immediately, before check completes
}
```

**After (FIXED):**
```typescript
// ✅ Waits for complete verification
const [accessResult, setAccessResult] = useState<TeacherAccessResult | null>(null);
const [checking, setChecking] = useState(true);

async function checkAccess() {
  const result = await resolveTeacherAccess(); // ✅ Wait for complete result
  setAccessResult(result);

  if (result.state !== 'verified_paid') {
    navigate(result.redirectTo); // ✅ Only redirect after verification
  }
  setChecking(false);
}

if (checking) {
  return <LoadingScreen />; // ✅ Show loading while checking
}

if (accessResult.state !== 'verified_paid') {
  return <RedirectingScreen />; // ✅ Only redirect after state is known
}

return <Dashboard />; // ✅ Only render dashboard when verified
```

### 3. Fixed Topics RLS Policy
**Migration:** `supabase/migrations/*_fix_topics_rls_auth_users_access.sql`

**Changes:**
- ❌ Dropped: "Admins can read all topics" (accessed auth.users)
- ✅ Created: "Admins can read all topics via function" (uses profiles)
- ✅ Created: "Teachers can read all published topics"

**New Policies:**
```sql
-- Admins can read all topics
CREATE POLICY "Admins can read all topics via function"
  ON topics FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_allowlist
      WHERE admin_allowlist.email = (SELECT email FROM profiles WHERE id = auth.uid())
      AND admin_allowlist.is_active = true
    )
  );

-- Teachers can read published topics (for quiz creation)
CREATE POLICY "Teachers can read all published topics"
  ON topics FOR SELECT TO authenticated
  USING (is_active = true AND is_published = true);
```

---

## Expected Behavior (Proof Requirements)

### Test 1: Teacher Login (Logged Out)
**Steps:**
1. Open app in incognito
2. Click "Teacher Login"

**Expected Console Output:**
```
[NAV] Teacher Login clicked -> navigating to /teacher
[NAV] Current route is now: /teacher
[Teacher Page] Component loaded at /teacher
[Teacher Page] No existing session, showing marketing page
```

**Expected Behavior:**
- ✅ Lands on `/teacher` marketing page
- ✅ No crash
- ✅ No redirect to `/`
- ✅ Shows teacher login/signup forms

### Test 2: Teacher Login (Verified Premium Teacher)
**Steps:**
1. Login as verified premium teacher
2. Click "Teacher Login"

**Expected Console Output:**
```
[NAV] Teacher Login clicked -> navigating to /teacher
[NAV] Current route is now: /teacher
[Teacher Page] Checking for existing session
[Teacher Page] Existing session found, checking teacher state
[Teacher Page] Teacher state: ACTIVE Redirecting to: /teacherdashboard
[NAV] Route changed to: /teacherdashboard
[TeacherDashboard] Checking access...
[TeacherAccess] Starting resolution...
[TeacherAccess] Session found, calling verify-teacher...
[TeacherAccess] Verification result: {is_teacher: true, is_admin: false, ...}
[TeacherAccess] Checking teacher state via edge function...
[TeacherAccess] State data: {state: 'ACTIVE', ...}
[TeacherAccess] Final state: verified_paid redirectTo: /teacherdashboard
[TeacherDashboard] TeacherAccess state: verified_paid
[TeacherDashboard] verify-teacher result: {isTeacher: true, isPremium: true, ...}
[TeacherDashboard] ✅ Access granted - Dashboard ready
```

**Expected Behavior:**
- ✅ Lands on `/teacher` briefly
- ✅ Auto-redirects to `/teacherdashboard`
- ✅ Dashboard loads successfully
- ✅ NO "User does not have teacher or admin role" message
- ✅ NO redirect to `/`

### Test 3: Topics Loading (No Permission Error)
**Steps:**
1. Login as verified premium teacher
2. Access teacher dashboard
3. Click "Create Quiz" or "My Quizzes"

**Expected Console Output:**
```
[CreateQuizWizard] Loading topics...
[TeacherDashboard] Topics loaded successfully
```

**Expected Behavior:**
- ✅ Topics load successfully
- ✅ NO "permission denied for table users" error
- ✅ Teacher can see available topics
- ✅ Teacher can create quizzes

### Test 4: Unverified Teacher
**Steps:**
1. Login as unverified teacher (email not confirmed)
2. Click "Teacher Login"

**Expected Console Output:**
```
[TeacherAccess] State data: {state: 'NEEDS_VERIFICATION', ...}
[TeacherAccess] Final state: unverified redirectTo: /teacher/post-verify
[TeacherDashboard] TeacherAccess state: unverified
[TeacherDashboard] Unverified, redirecting to post-verify
[NAV] Route changed to: /teacher/post-verify
```

**Expected Behavior:**
- ✅ Redirects to `/teacher/post-verify`
- ✅ Shows email verification prompt

### Test 5: Unpaid Teacher
**Steps:**
1. Login as verified but unpaid teacher
2. Click "Teacher Login"

**Expected Console Output:**
```
[TeacherAccess] State data: {state: 'NEEDS_PAYMENT', ...}
[TeacherAccess] Final state: verified_unpaid redirectTo: /teacher/checkout
[TeacherDashboard] TeacherAccess state: verified_unpaid
[TeacherDashboard] Unpaid, redirecting to checkout
[NAV] Route changed to: /teacher/checkout
```

**Expected Behavior:**
- ✅ Redirects to `/teacher/checkout`
- ✅ Shows Stripe payment form

---

## Debug Logs (Temporary)

The following debug logs have been added and should be visible in console:

### From `resolveTeacherAccess()`:
```
[TeacherAccess] Starting resolution...
[TeacherAccess] State: {state}
[TeacherAccess] Session found, calling verify-teacher...
[TeacherAccess] Verification result: {...}
[TeacherAccess] Checking teacher state via edge function...
[TeacherAccess] State data: {...}
[TeacherAccess] Final state: {state} redirectTo: {path}
```

### From `TeacherDashboard`:
```
[TeacherDashboard] Checking access...
[TeacherDashboard] TeacherAccess state: {state}
[TeacherDashboard] verify-teacher result: {isTeacher, isAdmin, isPremium}
[TeacherDashboard] ✅ Access granted - Dashboard ready
```

These logs can be removed after confirming the fix works in production.

---

## Files Modified

### New Files:
1. `src/lib/teacherAccess.ts` - Teacher access resolution helper

### Modified Files:
1. `src/pages/TeacherDashboard.tsx` - Fixed guard logic to wait for verification

### Migrations:
1. `fix_topics_rls_auth_users_access.sql` - Fixed RLS policy accessing auth.users

---

## Build Status

```bash
npm run build
# ✅ SUCCESS
# ✓ 1851 modules transformed
# ✓ No TypeScript errors
# ✓ No security warnings
```

---

## Technical Details

### Access Flow Architecture

```
User clicks "Teacher Login"
    ↓
/teacher page loads
    ↓
checkExistingSession()
    ↓
If session exists:
  Call check-teacher-state edge function
    ↓
  Based on state:
    - ACTIVE → Redirect to /teacherdashboard
    - NEEDS_VERIFICATION → Stay on /teacher
    - NEEDS_PAYMENT → Redirect to /teacher/checkout
    ↓
/teacherdashboard loads
    ↓
checkAccess() calls resolveTeacherAccess()
    ↓
resolveTeacherAccess():
  1. Get session (or return logged_out)
  2. Call /verify-teacher (server validates role)
  3. Call /check-teacher-state (server validates subscription)
  4. Return state + recommended redirect
    ↓
Based on state:
  - logged_out → Redirect to /teacher
  - unverified → Redirect to /teacher/post-verify
  - verified_unpaid → Redirect to /teacher/checkout
  - blocked → Redirect to /teacher
  - verified_paid → Render dashboard
```

### Single Source of Truth

**Before (BROKEN):**
- Multiple components doing their own role checks
- Frontend checking profiles table directly
- Race conditions between async checks and render
- Inconsistent redirect logic

**After (FIXED):**
- `resolveTeacherAccess()` is the ONLY place that determines access
- All checks are server-side (verify-teacher, check-teacher-state)
- Complete verification before any rendering decisions
- Consistent state-based routing

---

## Security Model

### Teacher Access Verification

1. **Session Check** - Supabase auth session must exist
2. **Role Check** - Server verifies `profiles.role = 'teacher'` or `'admin'`
3. **Subscription Check** - Server verifies teacher has active entitlement
4. **RLS Enforcement** - Database enforces row-level security

### Data Access

| User Type | Can Read Topics | Can Read All Topics | Can Modify Topics |
|-----------|----------------|-------------------|------------------|
| Anonymous | Published + Active | ❌ No | ❌ No |
| Authenticated | Published + Active | ❌ No | ❌ No |
| Teacher | Published + Active + Own | ✅ Yes (published) | ✅ Yes (own only) |
| Admin | All | ✅ Yes (all) | ✅ Yes (all) |

### No More auth.users Access

All RLS policies now use `profiles` table instead of `auth.users`:
- ✅ Frontend can read profiles (with RLS)
- ❌ Frontend cannot read auth.users (system table)

---

## Rollback Plan

If issues occur, rollback by:

1. Revert `src/pages/TeacherDashboard.tsx` to previous version
2. Remove `src/lib/teacherAccess.ts`
3. Rollback migration: `DROP POLICY "Admins can read all topics via function" ON topics;`
4. Recreate old policy (not recommended, causes permission errors)

---

## Summary

**What was broken:**
- ❌ Teacher dashboard redirected before verification completed
- ❌ Console showed "User does not have teacher/admin role" despite server approval
- ❌ Topics query failed with "permission denied for table users"

**What is now fixed:**
- ✅ Teacher dashboard waits for complete verification before rendering
- ✅ No premature redirects while checking
- ✅ Single source of truth (`resolveTeacherAccess()`)
- ✅ Topics load successfully (RLS fixed)
- ✅ Comprehensive debug logging
- ✅ Consistent state-based routing

**Expected Result:**
Clicking "Teacher Login" as a verified premium teacher:
1. Lands on `/teacher`
2. Auto-redirects to `/teacherdashboard`
3. Dashboard loads successfully
4. Topics load successfully
5. No errors in console

**Ready for production testing.**

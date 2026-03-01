# Admin Grant Premium - 401 Error Fix

## Problem
Admin "Grant Premium" button was failing with a 401 authentication error.

## Root Cause
The edge function was deployed with **`verify_jwt: true`** which causes Supabase's runtime to verify the JWT token BEFORE the function code runs. This verification was failing, preventing the function from executing.

## Solution
Deploy with **`verify_jwt: false`** and handle JWT verification in the function code:

```typescript
// Deploy with verify_jwt: false
mcp__supabase__deploy_edge_function({
  slug: "admin-grant-premium",
  verify_jwt: false  // ← CRITICAL
})

// Then verify JWT manually in code using anon key
const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: authHeader } }
});
const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

// Then use service role for database operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);
```

## Why This Works
- `verify_jwt: true` → Supabase runtime verifies JWT (was failing)
- `verify_jwt: false` → Your code verifies JWT using anon key (works correctly)
- Service role client bypasses RLS for database operations

## Files Changed
- `/supabase/functions/admin-grant-premium/index.ts` - Fixed authentication flow
- Migration `fix_teacher_entitlements_insert_issue.sql` - Added error handling to triggers

## Additional Fixes - Schools Page

### Fixed Teacher Count Display
**Problem:** Schools page showed "0 teachers" for all schools

**Root Cause:**
1. Database column is `name` but frontend used `school_name`
2. Teachers weren't being assigned to schools on signup (all had `school_id = null`)

**Solution:**
1. Fixed column name mismatch in AdminSchoolsPage component
2. Backfilled existing teachers with matching school domains
3. Created auto-assignment trigger for new teacher signups
4. Teachers now automatically assigned to schools based on email domain match

**Files Changed:**
- `src/components/admin/AdminSchoolsPage.tsx` - Fixed column name from `school_name` to `name`
- Migration `backfill_teacher_school_ids.sql` - Assigned existing teachers to schools
- Migration `auto_assign_teachers_to_schools.sql` - Auto-assignment trigger

**Testing Schools Page:**
1. Go to `/admindashboard/schools`
2. Verify teacher count is correct (not all zeros)
3. Click on teacher count number
4. Modal shows list of teachers for that school

## Testing Premium Grant
1. Go to `/admindashboard/teachers`
2. Click on any teacher row
3. Click "Grant Premium" button
4. Enter expiry days (365) and reason
5. Click "Grant" button
6. Should see "Premium access granted successfully!"

## Status
✅ FIXED and deployed

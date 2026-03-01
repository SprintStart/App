# Quiz Performance "No Data" Issue Fixed ✅

**Date:** February 4, 2026
**Status:** FIXED - Quiz Performance now shows data

---

## The Problem

The **Overview page** was showing "No Quiz Data Yet" even though:
- ✅ The quiz exists in the database
- ✅ 28 quiz runs exist
- ✅ The `teacher_quiz_performance` view returns data correctly
- ✅ Direct SQL query shows the data

**Why?** RLS policy mismatch between how the view joins data and how the policy checks access.

---

## Root Cause Analysis

### The View's Join Path
The `teacher_quiz_performance` view joins tables like this:
```sql
FROM question_sets qs
LEFT JOIN topics t ON (qs.topic_id = t.id)
LEFT JOIN public_quiz_runs pqr ON (qs.id = pqr.question_set_id)
--                                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
--                                  Joins by question_set_id
```

### The OLD RLS Policy (Broken)
```sql
CREATE POLICY "public_quiz_runs_select_all"
  ON public_quiz_runs FOR SELECT
  USING (
    -- Users can see their own runs
    quiz_session_id IN (SELECT id FROM quiz_sessions WHERE user_id = auth.uid())
    -- Teachers can see runs for their topics
    OR EXISTS (
      SELECT 1 FROM topics t
      WHERE t.id = public_quiz_runs.topic_id  -- ❌ Checks topic_id only!
      AND t.created_by = auth.uid()
    )
    -- Admins
    OR is_admin()
  );
```

**The Problem:**
- The view joins `public_quiz_runs` by `question_set_id` ✅
- But the RLS policy only checks `topic_id` ❌
- When a teacher queries the view, RLS filters out all rows because the policy doesn't recognize the `question_set_id` relationship
- Result: Empty dataset, "No Quiz Data Yet"

---

## The Fix

Updated the RLS policy to check **both** `topic_id` AND `question_set_id`:

```sql
CREATE POLICY "public_quiz_runs_select_all"
  ON public_quiz_runs FOR SELECT
  TO authenticated
  USING (
    -- Users can see their own quiz runs
    quiz_session_id IN (
      SELECT id FROM quiz_sessions
      WHERE user_id = auth.uid()
    )
    -- Teachers can see runs for their topics
    OR EXISTS (
      SELECT 1 FROM topics t
      WHERE t.id = public_quiz_runs.topic_id
      AND t.created_by = auth.uid()
    )
    -- ✅ NEW: Teachers can see runs for their question_sets
    OR EXISTS (
      SELECT 1 FROM question_sets qs
      WHERE qs.id = public_quiz_runs.question_set_id
      AND qs.created_by = auth.uid()
    )
    -- Admins can see everything
    OR is_admin()
  );
```

**What Changed:**
- ✅ Added check for `question_sets.created_by` via `question_set_id`
- ✅ Now teachers can access quiz runs through the question_set relationship
- ✅ The view can return data when queried by authenticated teachers

---

## What's Fixed

### Overview Page - Quiz Performance Section

**Before:**
```
┌─────────────────────────────────────┐
│ 🎯 No Quiz Data Yet                │
│                                     │
│ Create and publish quizzes to see  │
│ performance insights                │
└─────────────────────────────────────┘
```

**After:**
```
┌──────────────────────────────────────────────────────────────────┐
│ Quiz Performance                            [View Full Reports]   │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │ AQA A Level Business Studies Objectives Past Questions 1   │  │
│ │ business • 28 plays • 3.6% completion • 100% avg score     │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│ [Create New Quiz]  [Deep Analytics]  [Export Reports]           │
└──────────────────────────────────────────────────────────────────┘
```

### Reports Page

**Before:**
- Total Plays: 0
- Unique Students: 0
- Completed: 0
- Completion Rate: 0%

**After:**
- Total Plays: **28**
- Unique Students: **6**
- Completed: **1**
- Completion Rate: **3.6%**

### Analytics Page

**Before:**
- Quiz dropdown empty
- No analytics available

**After:**
- Quiz dropdown shows: "AQA A Level Business Studies Objectives Past Questions 1"
- Analytics loads successfully
- Per-question breakdown visible

---

## Data Verification

### Direct View Query (Works in SQL)
```sql
SELECT * FROM teacher_quiz_performance
WHERE created_by = 'f2a6478d-00d0-410f-87a7-0b81d19ca7ba';
```
**Result:**
| question_set_id | quiz_title | subject | total_plays | unique_students | completed_runs | completion_rate | avg_score |
|-----------------|------------|---------|-------------|-----------------|----------------|-----------------|-----------|
| 09885113-... | AQA A Level Business... | business | 28 | 6 | 1 | 3.6 | 100.0 |

### Frontend Query (Now Works with RLS)
```typescript
const { data: quizData } = await supabase
  .from('teacher_quiz_performance')
  .select('*')
  .eq('created_by', user.id)
  .order('total_plays', { ascending: false })
  .limit(10);
```
**Result:** ✅ Returns 1 row with quiz data

---

## Technical Details

### Migration File
**File:** `fix_public_quiz_runs_rls_for_teachers.sql`

**Changes:**
1. Dropped old `public_quiz_runs_select_all` policy
2. Created new policy with additional `question_sets` check
3. Re-added anonymous user policy for public quizzes

### Tables/Views Affected
1. ✅ `public_quiz_runs` - Updated SELECT policy
2. ✅ `teacher_quiz_performance` - Now accessible via frontend

### RLS Security Maintained
- ✅ Users still can only see their own quiz runs
- ✅ Teachers can see runs for their topics (existing)
- ✅ Teachers can see runs for their question_sets (new)
- ✅ Admins can see all runs
- ✅ Anonymous users can see anonymous runs only

---

## Why This Pattern Matters

### Common RLS Mistake
When you have views that join multiple tables, the RLS policies on the underlying tables must match **all possible join paths** used by the view.

**The View Uses:**
```sql
JOIN public_quiz_runs ON question_sets.id = public_quiz_runs.question_set_id
```

**The RLS Policy Must Allow:**
```sql
WHERE public_quiz_runs.question_set_id IN (SELECT id FROM question_sets WHERE created_by = auth.uid())
```

### Best Practice
When creating views over RLS-protected tables:
1. ✅ Identify all join paths in the view
2. ✅ Ensure RLS policies cover all those paths
3. ✅ Test the view with frontend queries, not just SQL
4. ✅ Check that RLS respects the view's access patterns

---

## Build Status

```bash
npm run build
```

**Result:** ✅ SUCCESS
```
✓ 1856 modules transformed
✓ built in 11.69s
```

---

## How to Verify

### Method 1: Overview Page
1. Navigate to `/teacher/dashboard` (Overview)
2. Scroll to "Quiz Performance" section
3. **Should see:** Your quiz listed with stats (28 plays, 6 students, etc.)
4. **Should NOT see:** "No Quiz Data Yet" message

### Method 2: Reports Page
1. Navigate to Reports
2. Check top summary cards
3. **Should see:** Non-zero values (28, 6, 1, 3.6%)
4. **Should see:** Quiz row in table with data

### Method 3: Analytics Page
1. Navigate to Analytics
2. Check quiz dropdown
3. **Should see:** "AQA A Level Business Studies..." in dropdown
4. Select it and **should see:** Deep analytics load

### Method 4: Browser Console
1. Open DevTools → Console
2. Reload Overview page
3. **Should see:** `"Loaded quiz performance data: [...]"`
4. **Should NOT see:** Empty array or errors

---

## Summary

| Component | Before | After |
|-----------|--------|-------|
| RLS Policy | Checked topic_id only ❌ | Checks topic_id + question_set_id ✅ |
| View Access | Blocked by RLS ❌ | Allowed by RLS ✅ |
| Overview Page | "No Quiz Data Yet" ❌ | Shows quiz stats ✅ |
| Reports Page | All zeros ❌ | Real data (28 plays, etc.) ✅ |
| Analytics Page | Empty dropdown ❌ | Quiz selectable ✅ |
| Frontend Query | Returns empty [] ❌ | Returns quiz data ✅ |

**Root Cause:** RLS policy didn't account for view's join path
**Fix:** Added question_set_id check to RLS policy
**Result:** Quiz Performance now shows data correctly

---

## Key Takeaway

**Views inherit RLS from underlying tables.** If your view joins by column X but your RLS policy checks column Y, the view will return no data even if the SQL query is correct. Always ensure RLS policies cover all join paths used by your views.

🎉 **Quiz Performance section now fully functional!**

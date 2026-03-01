# Quick Start: Apply Global Library Restructure

## Step 1: Apply Database Migration

1. Open your Supabase project dashboard
2. Navigate to SQL Editor
3. Open the file: `GLOBAL_RESTRUCTURE_MIGRATION.sql`
4. Copy the entire contents
5. Paste into Supabase SQL Editor
6. Click "Run"
7. Review the completion report in the output

**Expected Output:**
```
=================================================================
GLOBAL QUIZ LIBRARY RESTRUCTURE - COMPLETION REPORT
=================================================================

QUIZ DISTRIBUTION AFTER RESTRUCTURE:
  Total Quizzes: [number]
  Global Quizzes (non-curriculum): [number]
  Country/Exam Quizzes: [number]
  School Quizzes: [number]

VALIDATION:
  ✓ Scope validation trigger installed
  ✓ Global categories created
  ✓ Indexes optimized
  ✓ All timestamps preserved
  ✓ All analytics preserved

Global Quiz Library now contains ONLY non-curriculum content.
All structured exam content properly scoped to country/exam.
=================================================================
```

## Step 2: Deploy Frontend (Already Built)

The frontend has been updated and built. Deploy the `dist/` folder to production.

**Changed Files:**
- `src/pages/global/GlobalHome.tsx`
- `src/pages/global/GlobalQuizzesPage.tsx`
- `src/components/teacher-dashboard/PublishDestinationPicker.tsx`

**Changes:**
- Queries now filter by `exam_system_id IS NULL` instead of legacy fields
- UI descriptions updated to explain Global scope clearly
- Teacher publishing guidance improved

## Step 3: Verify

1. Visit `/explore/global`
   - Should show ONLY non-curriculum quizzes
   - Updated description visible

2. Visit `/exams/gcse` or `/exams/a-levels`
   - Should show previously "global" curriculum quizzes
   - Analytics preserved

3. Create a test quiz as teacher
   - See updated Global destination description
   - Verify clear guidance

## What Changed?

**Before:**
- Global library mixed curriculum and non-curriculum content
- GCSE, A-Level, BTEC quizzes appeared in Global
- Confusing for students browsing

**After:**
- Global contains ONLY: aptitude tests, career prep, life skills, general knowledge
- All curriculum content (GCSE, A-Level, BTEC, BECE, etc.) moved to proper exam routes
- Clear separation and better discoverability

## No Breaking Changes

- All URLs work automatically
- No routing logic changed
- No publishing flow changed
- All analytics preserved
- No data lost

## Questions?

See `GLOBAL_LIBRARY_RESTRUCTURE_COMPLETE.md` for full documentation.

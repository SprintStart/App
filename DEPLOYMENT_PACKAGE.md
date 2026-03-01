# Destination Scope Fix - Deployment Package

## Quick Summary

Fixed quiz publishing leakage where GH/BECE quizzes appeared on UK/GCSE pages and vice versa.

**Root Cause:** Missing destination filtering in country/exam queries + wrong question table.

**Solution:** Added explicit `destination_scope` field, fixed all queries, added DB constraints.

**Status:** ✅ Code complete, build successful, ready to deploy.

---

## 🚀 Deploy in 3 Steps

### Step 1: Apply Database Migration (5 minutes)

1. Open Supabase Dashboard → SQL Editor
2. Open file: `APPLY_THIS_MIGRATION.sql`
3. Copy entire file contents
4. Paste into SQL Editor
5. Click "Run"
6. Verify success message

**What it does:**
- Adds `destination_scope` field to `question_sets` table
- Backfills all existing quizzes with correct scope
- Adds DB constraints to prevent invalid combinations
- Creates integrity monitoring view
- Adds performance indexes

**Backfill preview:**
```sql
-- Run this AFTER migration to see results
SELECT
  destination_scope,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE approval_status = 'approved') as published
FROM question_sets
GROUP BY destination_scope;
```

Expected output:
```
destination_scope | total | published
------------------+-------+-----------
GLOBAL           |   XX  |    XX
COUNTRY_EXAM     |   XX  |    XX
SCHOOL_WALL      |   XX  |    XX
```

---

### Step 2: Deploy Frontend (1 minute)

Application is built and ready:

```bash
# Already completed:
npm run build  # ✅ Build successful

# Deploy dist/ folder to your hosting platform
# (Netlify, Vercel, etc.)
```

**Changes deployed:**
- Fixed global library to exclude country/exam quizzes
- Fixed exam pages to filter by country_code and exam_code
- Fixed question loading to use correct table (`topic_questions`)
- Updated quiz creation to set `destination_scope`
- Added Data Integrity page to Admin Portal

---

### Step 3: Verify (10 minutes)

1. **Check Admin Data Integrity:**
   - Login: `/admin/login`
   - Navigate to "Data Integrity"
   - Click "Refresh"
   - Verify: ✅ All systems healthy, zero invalid configurations

2. **Quick Smoke Test:**
   - Visit `/explore` - Should show only global quizzes
   - Visit `/exams/gcse/maths` - Should show only UK GCSE quizzes
   - Visit `/exams/wassce/mathematics` - Should show only GH WASSCE quizzes
   - Click any exam quiz - Questions should load

3. **Create Test Quiz:**
   - Login as teacher
   - Create quiz for "Country & Exam System"
   - Select: Ghana → WASSCE → Mathematics
   - Publish with 3 questions
   - Verify: Quiz appears ONLY on GH WASSCE pages, NOT on UK GCSE or /explore

**If all checks pass: ✅ Deployment successful!**

---

## 📋 What Changed

### Database
- **New field:** `destination_scope` ('GLOBAL', 'SCHOOL_WALL', 'COUNTRY_EXAM')
- **Constraints:** Enforce valid destination combinations
- **Indexes:** Optimized queries for each destination
- **View:** `question_sets_integrity_check` for monitoring

### Frontend (4 files)
1. `GlobalQuizzesPage.tsx` - Exclude country/exam quizzes from global library
2. `SubjectPage.tsx` - Filter topics by exam system
3. `TopicPage.tsx` - Filter quizzes by exam + fix question table
4. `CreateQuizWizard.tsx` - Set destination_scope on publish

### Admin Portal (3 files)
1. `DataIntegrityPage.tsx` - New monitoring dashboard
2. `AdminDashboard.tsx` - Added route
3. `AdminDashboardLayout.tsx` - Added menu item

---

## 🔍 How Destination Scopes Work

### GLOBAL Scope
**Where it appears:** `/explore` (global library)
**Fields:**
```
destination_scope = 'GLOBAL'
school_id = NULL
country_code = NULL
exam_code = NULL
```

### COUNTRY_EXAM Scope
**Where it appears:** `/exams/{exam}/{subject}` (exam-specific pages)
**Fields:**
```
destination_scope = 'COUNTRY_EXAM'
school_id = NULL
country_code = 'GH' (or 'GB', 'US', etc.)
exam_code = 'WASSCE' (or 'GCSE', 'SAT', etc.)
```

### SCHOOL_WALL Scope
**Where it appears:** `/{school_slug}` (school-specific walls)
**Fields:**
```
destination_scope = 'SCHOOL_WALL'
school_id = <uuid>
country_code = NULL
exam_code = NULL
```

**Database constraints prevent invalid combinations!**

---

## 🎯 Acceptance Test Results

Run the 10-minute testing checklist in `DESTINATION_SCOPE_FIX_COMPLETE.md`.

**Expected results:**
- ✅ Global quiz appears ONLY on /explore
- ✅ GH/BECE quiz appears ONLY on GH/BECE pages
- ✅ UK/GCSE quiz appears ONLY on UK/GCSE pages
- ✅ School quiz appears ONLY on its school wall
- ✅ No cross-contamination between destinations
- ✅ Questions load correctly for all exam quizzes
- ✅ Admin integrity monitor shows zero invalid configurations

---

## 📚 Documentation Files

- **DEPLOYMENT_PACKAGE.md** (this file) - Quick deployment guide
- **DESTINATION_SCOPE_FIX_COMPLETE.md** - Complete technical documentation
- **ROOT_CAUSE_ANALYSIS.md** - Detailed root cause analysis
- **APPLY_THIS_MIGRATION.sql** - Database migration to apply

---

## 🆘 Troubleshooting

### Issue: Migration fails with constraint violation
**Cause:** Existing quizzes have invalid combinations
**Fix:** Check which quizzes fail:
```sql
SELECT id, title, school_id, country_code, exam_code
FROM question_sets
WHERE school_id IS NOT NULL AND country_code IS NOT NULL;
```
Fix manually before re-running migration.

---

### Issue: Quizzes not showing on exam pages
**Cause:** Quiz published before migration, missing destination_scope
**Fix:** Republish quiz or run backfill:
```sql
-- Check current scope
SELECT id, title, destination_scope, country_code, exam_code
FROM question_sets
WHERE title LIKE '%your quiz title%';

-- If scope is wrong, update it
UPDATE question_sets
SET destination_scope = 'COUNTRY_EXAM'
WHERE id = '<quiz_id>';
```

---

### Issue: Admin Data Integrity shows warnings
**Cause:** Quizzes with zero questions (expected for drafts)
**Fix:** This is normal. Warnings are for information only. Only "INVALID" entries need fixing.

---

### Issue: Build fails
**Cause:** TypeScript errors
**Fix:**
```bash
npm run typecheck  # Check for type errors
npm run build      # Rebuild
```

---

## 📊 Monitoring

### Admin Data Integrity Dashboard
**Access:** `/admindashboard/data-integrity`
**Refresh:** Manual (click "Refresh" button)
**Shows:**
- Total quizzes
- Healthy count
- Invalid configurations (should be 0)
- Warnings (zero-question quizzes)

### Database View
```sql
-- Manual integrity check
SELECT *
FROM question_sets_integrity_check
WHERE integrity_status != 'OK'
ORDER BY created_at DESC;
```

### Expected Results
```
integrity_status = 'OK' for all published quizzes
```

---

## 🔄 Rollback Plan

If deployment fails:

1. **Revert frontend:** Deploy previous git commit
2. **Keep database changes:** Constraints prevent invalid data
3. **If constraints cause issues:**
   ```sql
   -- Remove constraints (keep data)
   ALTER TABLE question_sets DROP CONSTRAINT question_sets_global_scope_check;
   ALTER TABLE question_sets DROP CONSTRAINT question_sets_school_scope_check;
   ALTER TABLE question_sets DROP CONSTRAINT question_sets_country_exam_scope_check;
   ```

---

## ✅ Pre-Deployment Checklist

- [x] Code changes complete
- [x] Build successful (`npm run build`)
- [x] Migration SQL file ready (`APPLY_THIS_MIGRATION.sql`)
- [x] Documentation complete
- [x] Testing checklist prepared
- [x] Rollback plan documented

---

## 🚦 Deployment Status

**Build:** ✅ Successful (no errors)
**Migration:** 📋 Ready to apply
**Testing:** 📋 Ready to execute
**Documentation:** ✅ Complete

---

## 📞 Support

**Technical Details:** See `ROOT_CAUSE_ANALYSIS.md`
**Full Documentation:** See `DESTINATION_SCOPE_FIX_COMPLETE.md`
**Testing Guide:** See "10-Minute Manual Testing Checklist" in DESTINATION_SCOPE_FIX_COMPLETE.md

---

**Ready to deploy!** Start with Step 1 above.

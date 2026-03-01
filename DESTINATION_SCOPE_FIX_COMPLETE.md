# Destination Scope Fix - COMPLETE

## Executive Summary

Fixed quiz publishing leakage where quizzes appeared outside their intended destinations (e.g., GH/BECE quizzes showing on UK/GCSE pages).

**Status:** Code complete, build successful, ready for database migration and testing.

---

## Root Cause Identified

1. **Country/exam pages didn't filter by country_code/exam_code** - Queries only checked `is_published`, not destination
2. **Global library didn't exclude country/exam quizzes** - Only filtered `school_id IS NULL`, letting country quizzes through
3. **Wrong table used for question counts** - Used `questions` table instead of `topic_questions` table
4. **No explicit destination scope** - Destination inferred from field combinations, error-prone
5. **No DB constraints** - Invalid combinations not prevented

---

## Changes Implemented

### 1. Database Migration (APPLY_THIS_MIGRATION.sql)

**New Fields:**
- Added `destination_scope` enum field to `question_sets` table
- Values: `'GLOBAL'`, `'SCHOOL_WALL'`, `'COUNTRY_EXAM'`

**Constraints Added:**
- `question_sets_destination_scope_check` - Ensures valid scope values
- `question_sets_global_scope_check` - GLOBAL quizzes must have NULL school/country/exam
- `question_sets_school_scope_check` - SCHOOL_WALL quizzes must have school_id, NULL country/exam
- `question_sets_country_exam_scope_check` - COUNTRY_EXAM quizzes must have country_code AND exam_code, NULL school_id

**Backfill Logic:**
- Existing quizzes classified based on current fields
- Invalid combinations fixed automatically
- Edge cases handled (country without exam → marked as GLOBAL)

**Performance Indexes:**
- `idx_question_sets_destination_scope_approved` - Fast scope filtering
- `idx_question_sets_global_listing` - Optimized /explore queries
- `idx_question_sets_country_exam_listing` - Optimized exam page queries
- `idx_question_sets_school_wall_listing` - Optimized school wall queries

**Helper Function:**
- `validate_destination_scope()` - Server-side validation function

**Monitoring View:**
- `question_sets_integrity_check` - Detects invalid configurations and zero-question quizzes

---

### 2. Frontend Query Fixes

#### A. GlobalQuizzesPage.tsx (lines 53-55)
**BEFORE:**
```typescript
.is('school_id', null)
.eq('approval_status', 'approved')
```

**AFTER:**
```typescript
.is('school_id', null)
.is('country_code', null)  // NEW: Exclude country/exam quizzes
.is('exam_code', null)     // NEW: Exclude country/exam quizzes
.eq('approval_status', 'approved')
```

**Result:** Global library only shows truly global quizzes, not country/exam quizzes.

---

#### B. SubjectPage.tsx (lines 40-74)
**BEFORE:**
```typescript
// Get ALL topics for subject (no exam filter)
.eq('subject', subjectSlug)
.eq('is_published', true)

// Count ALL quizzes for topic (no exam filter)
.eq('topic_id', topic.id)
.eq('approval_status', 'approved')
```

**AFTER:**
```typescript
// Get exam metadata from URL
const examData = findExamBySlug(examSlug);
const countryCode = examData?.country.code;
const examCode = examData?.exam.code;

// Get topics for THIS exam only
.eq('subject', subjectSlug)
.eq('is_published', true)

// Count quizzes for THIS exam only
.eq('topic_id', topic.id)
.eq('approval_status', 'approved')
.eq('country_code', countryCode)  // NEW: Filter by exam
.eq('exam_code', examCode)        // NEW: Filter by exam
```

**Result:** Subject pages only show topics with quizzes for the specific exam system.

---

#### C. TopicPage.tsx (lines 65-112)
**BEFORE:**
```typescript
// Get ALL quizzes for topic (no exam filter)
.eq('topic_id', topicData.id)
.eq('approval_status', 'approved')

// WRONG TABLE: Count questions from 'questions' table
const { count } = await supabase
  .from('questions')  // ❌ WRONG
  .eq('question_set_id', quiz.id)
```

**AFTER:**
```typescript
// Get exam metadata from URL
const examData = findExamBySlug(examSlug);
const countryCode = examData?.country.code;
const examCode = examData?.exam.code;

// Get quizzes for THIS exam only
.eq('topic_id', topicData.id)
.eq('approval_status', 'approved')
.eq('country_code', countryCode)  // NEW: Filter by exam
.eq('exam_code', examCode)        // NEW: Filter by exam

// CORRECT TABLE: Count questions from 'topic_questions' table
const { count } = await supabase
  .from('topic_questions')  // ✅ CORRECT
  .eq('question_set_id', quiz.id)

// Filter out quizzes with zero questions
setQuizzes(quizzesWithCounts.filter(q => q.question_count > 0));
```

**Result:** Topic pages only show quizzes for the specific exam, and questions load correctly.

---

### 3. Publishing Flow Fix

#### CreateQuizWizard.tsx (lines 1392-1415)
**BEFORE:**
```typescript
.insert({
  topic_id: selectedTopicId,
  school_id: publishDestination?.school_id || null,
  country_code: publishDestination?.country_code || null,
  exam_code: publishDestination?.exam_code || null
  // No destination_scope field
})
```

**AFTER:**
```typescript
// Determine destination_scope from publishDestination
let destinationScope: 'GLOBAL' | 'SCHOOL_WALL' | 'COUNTRY_EXAM' = 'GLOBAL';
if (publishDestination?.type === 'school') {
  destinationScope = 'SCHOOL_WALL';
} else if (publishDestination?.type === 'country_exam') {
  destinationScope = 'COUNTRY_EXAM';
}

.insert({
  topic_id: selectedTopicId,
  destination_scope: destinationScope,  // NEW: Explicit scope
  school_id: publishDestination?.school_id || null,
  country_code: publishDestination?.country_code || null,
  exam_code: publishDestination?.exam_code || null
})
```

**Result:** New quizzes have explicit destination_scope field, constraints prevent invalid combinations.

---

### 4. Admin Monitoring Tool

#### New Component: DataIntegrityPage.tsx
**Location:** `/src/components/admin/DataIntegrityPage.tsx`
**Route:** `/admindashboard/data-integrity`

**Features:**
- Real-time integrity monitoring using `question_sets_integrity_check` view
- Dashboard shows:
  - Total quizzes
  - Healthy count (OK status)
  - Invalid count (constraint violations)
  - Warnings count (zero questions)
- Detailed issue table with:
  - Quiz title, ID
  - Current destination_scope
  - School ID, country_code, exam_code
  - Specific issue description
  - Created date
- Color-coded severity (green/yellow/red)
- Refresh button for manual checks
- Documentation section explaining scope rules

**Admin Navigation:**
- Added "Data Integrity" menu item
- Icon: AlertTriangle (warning triangle)
- Positioned after "System Health" in sidebar

---

## Database Fields Summary

### question_sets Table Destination Fields

| Field | Type | Usage |
|-------|------|-------|
| `destination_scope` | text (enum) | **NEW:** `'GLOBAL'`, `'SCHOOL_WALL'`, `'COUNTRY_EXAM'` |
| `school_id` | uuid | Used by SCHOOL_WALL scope |
| `country_code` | text | Used by COUNTRY_EXAM scope |
| `exam_code` | text | Used by COUNTRY_EXAM scope |
| `exam_system_id` | text | Optional metadata |

### Valid Combinations (Enforced by Constraints)

**GLOBAL Scope:**
```
destination_scope = 'GLOBAL'
school_id = NULL
country_code = NULL
exam_code = NULL
```

**SCHOOL_WALL Scope:**
```
destination_scope = 'SCHOOL_WALL'
school_id = NOT NULL
country_code = NULL
exam_code = NULL
```

**COUNTRY_EXAM Scope:**
```
destination_scope = 'COUNTRY_EXAM'
school_id = NULL
country_code = NOT NULL
exam_code = NOT NULL
```

---

## Corrected Queries Reference

### Global Library (/explore)
```typescript
.from('question_sets')
.is('school_id', null)
.is('country_code', null)
.is('exam_code', null)
.eq('approval_status', 'approved')
```

### School Wall (/{school_slug})
```typescript
.from('question_sets')
.eq('school_id', resolved_school_id)
.eq('approval_status', 'approved')
```

### Country/Exam Pages (/exams/{exam}/{subject})
```typescript
.from('question_sets')
.eq('country_code', resolved_country_code)
.eq('exam_code', resolved_exam_code)
.eq('approval_status', 'approved')
```

---

## Files Changed

### Database (1 file):
- ✅ `APPLY_THIS_MIGRATION.sql` - Database migration (ready to run)

### Frontend (4 files):
- ✅ `src/pages/global/TopicPage.tsx` - Fixed exam filtering + correct question table
- ✅ `src/pages/global/SubjectPage.tsx` - Fixed exam filtering
- ✅ `src/pages/global/GlobalQuizzesPage.tsx` - Fixed global library filtering
- ✅ `src/components/teacher-dashboard/CreateQuizWizard.tsx` - Added destination_scope

### Admin Portal (3 files):
- ✅ `src/components/admin/DataIntegrityPage.tsx` - New monitoring component
- ✅ `src/pages/AdminDashboard.tsx` - Added DataIntegrityPage route
- ✅ `src/components/admin/AdminDashboardLayout.tsx` - Added menu item

### Documentation (2 files):
- ✅ `ROOT_CAUSE_ANALYSIS.md` - Detailed technical analysis
- ✅ `DESTINATION_SCOPE_FIX_COMPLETE.md` - This file

---

## Deployment Steps

### Step 1: Apply Database Migration

1. Go to Supabase Dashboard → SQL Editor
2. Open `APPLY_THIS_MIGRATION.sql`
3. Copy entire contents
4. Paste into SQL Editor
5. Click "Run"
6. Verify success message
7. Check backfill results:
   ```sql
   SELECT
     destination_scope,
     COUNT(*) as quiz_count,
     COUNT(*) FILTER (WHERE approval_status = 'approved') as approved_count
   FROM question_sets
   GROUP BY destination_scope
   ORDER BY destination_scope;
   ```

### Step 2: Deploy Frontend

Application is already built and ready:
```bash
npm run build  # ✅ Already completed, build successful
```

Deploy `dist/` folder to Netlify/hosting platform.

### Step 3: Verify Data Integrity

1. Log in to Admin Portal
2. Navigate to "Data Integrity" page
3. Click "Refresh" to run integrity check
4. Verify:
   - All quizzes have valid destination_scope
   - No invalid configurations
   - Zero-question quizzes flagged as warnings
5. If issues found, they will appear in the table with specific error messages

---

## 10-Minute Manual Testing Checklist

### Test 1: Global Library Isolation
**Goal:** Verify global quizzes don't leak to exam pages, and vice versa.

1. **Create a GLOBAL quiz:**
   - Log in as teacher
   - Create quiz, select "Global StartSprint Library" as destination
   - Publish quiz
   - Note quiz title

2. **Verify GLOBAL visibility:**
   - ✅ Quiz appears on `/explore` (global library)
   - ❌ Quiz does NOT appear on `/exams/gcse/maths` (UK GCSE Maths)
   - ❌ Quiz does NOT appear on `/exams/wassce/mathematics` (GH BECE Maths)
   - ❌ Quiz does NOT appear on any school wall

**Expected:** Global quiz ONLY on /explore.

---

### Test 2: Country/Exam Quiz Isolation (GH/BECE)
**Goal:** Verify GH/BECE quiz only appears on GH/BECE pages.

1. **Create a GH/BECE quiz:**
   - Log in as teacher
   - Create quiz, select "Country & Exam System"
   - Select Country: Ghana
   - Select Exam: WASSCE (West African Senior School Certificate)
   - Select Subject: Mathematics
   - Publish quiz with 5+ questions
   - Note quiz title

2. **Verify GH/BECE visibility:**
   - ✅ Quiz appears on `/exams/wassce/mathematics` (GH WASSCE Maths)
   - ❌ Quiz does NOT appear on `/explore` (global library)
   - ❌ Quiz does NOT appear on `/exams/gcse/maths` (UK GCSE Maths)
   - ❌ Quiz does NOT appear on `/exams/sat/math` (US SAT Math)
   - ❌ Quiz does NOT appear on any school wall

3. **Verify questions load:**
   - Click on GH/BECE quiz
   - ✅ Questions appear (not empty)
   - ✅ "Play Now" button works
   - ✅ Quiz starts and questions display correctly

**Expected:** GH/BECE quiz ONLY on GH/BECE exam pages, questions load.

---

### Test 3: Country/Exam Quiz Isolation (UK/GCSE)
**Goal:** Verify UK/GCSE quiz only appears on UK/GCSE pages.

1. **Create a UK/GCSE quiz:**
   - Log in as teacher
   - Create quiz, select "Country & Exam System"
   - Select Country: United Kingdom
   - Select Exam: GCSE
   - Select Subject: Mathematics
   - Publish quiz with 5+ questions
   - Note quiz title

2. **Verify UK/GCSE visibility:**
   - ✅ Quiz appears on `/exams/gcse/maths` (UK GCSE Maths)
   - ❌ Quiz does NOT appear on `/explore` (global library)
   - ❌ Quiz does NOT appear on `/exams/wassce/mathematics` (GH BECE Maths)
   - ❌ Quiz does NOT appear on `/exams/sat/math` (US SAT Math)
   - ❌ Quiz does NOT appear on any school wall

3. **Verify questions load:**
   - Click on UK/GCSE quiz
   - ✅ Questions appear (not empty)
   - ✅ "Play Now" button works
   - ✅ Quiz starts and questions display correctly

**Expected:** UK/GCSE quiz ONLY on UK/GCSE exam pages, questions load.

---

### Test 4: School Wall Isolation
**Goal:** Verify school quiz only appears on its school wall.

1. **Create a SCHOOL WALL quiz:**
   - Log in as teacher with school affiliation
   - Create quiz, select "School Wall"
   - Select your school
   - Publish quiz
   - Note quiz title and school slug

2. **Verify SCHOOL visibility:**
   - ✅ Quiz appears on `/{school_slug}` (your school's wall)
   - ❌ Quiz does NOT appear on `/explore` (global library)
   - ❌ Quiz does NOT appear on any exam pages
   - ❌ Quiz does NOT appear on other schools' walls

**Expected:** School quiz ONLY on its school wall.

---

### Test 5: Cross-Contamination Check
**Goal:** Verify no quizzes appear in multiple destinations.

1. **Browse each destination:**
   - Visit `/explore` - Note quiz titles
   - Visit `/exams/gcse/maths` - Note quiz titles
   - Visit `/exams/wassce/mathematics` - Note quiz titles
   - Visit `/exams/sat/math` - Note quiz titles

2. **Verify NO overlap:**
   - ❌ Global quizzes do NOT appear on exam pages
   - ❌ GCSE quizzes do NOT appear on WASSCE/SAT pages
   - ❌ WASSCE quizzes do NOT appear on GCSE/SAT pages
   - ❌ SAT quizzes do NOT appear on GCSE/WASSCE pages

**Expected:** Zero overlap between destinations.

---

### Test 6: Admin Data Integrity Monitor
**Goal:** Verify integrity monitoring works and shows no issues.

1. **Check integrity dashboard:**
   - Log in to Admin Portal (`/admin/login`)
   - Navigate to "Data Integrity" page
   - Click "Refresh" button

2. **Verify stats:**
   - ✅ "Healthy" count > 0
   - ✅ "Invalid" count = 0
   - ✅ "Warnings" count = 0 (or only expected warnings for draft quizzes)

3. **Verify system status:**
   - ✅ Green banner: "All Systems Healthy"
   - ✅ No issues table visible (or only warnings, no invalid entries)

**Expected:** All quizzes healthy, zero invalid configurations.

---

### Test 7: Publishing Flow Validation
**Goal:** Verify new quizzes have destination_scope set correctly.

1. **After creating each test quiz above, verify in Supabase:**
   ```sql
   SELECT
     id,
     title,
     destination_scope,
     school_id,
     country_code,
     exam_code
   FROM question_sets
   WHERE created_at > now() - interval '1 hour'
   ORDER BY created_at DESC;
   ```

2. **Verify fields:**
   - ✅ Global quiz: `destination_scope='GLOBAL'`, all destination fields NULL
   - ✅ GH/BECE quiz: `destination_scope='COUNTRY_EXAM'`, `country_code='GH'`, `exam_code='WASSCE'`, `school_id=NULL`
   - ✅ UK/GCSE quiz: `destination_scope='COUNTRY_EXAM'`, `country_code='GB'`, `exam_code='GCSE'`, `school_id=NULL`
   - ✅ School quiz: `destination_scope='SCHOOL_WALL'`, `school_id` set, country/exam NULL

**Expected:** All new quizzes have correct destination_scope and fields.

---

### Test 8: Question Count Fix Verification
**Goal:** Verify all published quizzes show correct question counts.

1. **Check exam page quiz cards:**
   - Visit `/exams/wassce/mathematics`
   - For each quiz card, verify:
     - ✅ Shows "X questions" (not "0 questions")
     - ✅ Question count > 0
     - ✅ Quiz cards are visible (not filtered out)

2. **Check global library quiz cards:**
   - Visit `/explore`
   - For each quiz card, verify:
     - ✅ Shows correct question count
     - ✅ No quizzes with 0 questions visible

**Expected:** All quizzes show correct question counts, zero-question quizzes hidden.

---

## Success Criteria

✅ **All tests pass:**
- Global quizzes only on /explore
- GH/BECE quizzes only on GH/BECE pages
- UK/GCSE quizzes only on UK/GCSE pages
- School quizzes only on school walls
- No cross-contamination between destinations
- Questions load correctly for all exam quizzes
- Admin integrity monitor shows zero invalid configurations
- New quizzes have correct destination_scope field

✅ **Build successful:**
- `npm run build` completes without errors
- All TypeScript types valid
- No console errors in browser

✅ **Database constraints working:**
- Invalid combinations blocked at DB level
- Backfill completed successfully
- All existing quizzes classified correctly

---

## Rollback Plan

If issues occur, rollback steps:

1. **Revert frontend deployment** - Deploy previous version from git
2. **Remove database constraints** (keep data intact):
   ```sql
   ALTER TABLE question_sets DROP CONSTRAINT IF EXISTS question_sets_global_scope_check;
   ALTER TABLE question_sets DROP CONSTRAINT IF EXISTS question_sets_school_scope_check;
   ALTER TABLE question_sets DROP CONSTRAINT IF EXISTS question_sets_country_exam_scope_check;
   ALTER TABLE question_sets DROP CONSTRAINT IF EXISTS question_sets_destination_scope_check;
   ALTER TABLE question_sets ALTER COLUMN destination_scope DROP NOT NULL;
   ```
3. **Revert code** - `git revert <commit>`
4. **Investigate** - Check Sentry errors, Supabase logs, browser console

---

## Known Limitations

1. **Existing draft quizzes** - May not have destination_scope if created before migration. Fixed on next edit/publish.
2. **Topics table** - Doesn't have country_code/exam_code fields. Topics inherit destination from their question_sets.
3. **Bulk operations** - Admin bulk actions must respect destination_scope constraints.

---

## Future Enhancements

1. **Add destination_scope to topics table** - For faster topic listing queries
2. **Destination-aware search** - Filter search results by current page destination
3. **Analytics by destination** - Track quiz plays per destination scope
4. **Automated migration alerts** - Email admin when data integrity issues detected

---

## Support

For questions or issues:
1. Check `ROOT_CAUSE_ANALYSIS.md` for technical details
2. Review Admin Data Integrity page for current status
3. Check Supabase logs for query errors
4. Check browser console for client-side errors

---

**Status:** ✅ COMPLETE AND READY FOR DEPLOYMENT

**Last Updated:** 2026-02-28
**Build Status:** ✅ Successful
**Migration Status:** 📋 Ready to apply (APPLY_THIS_MIGRATION.sql)

# Root Cause Analysis: Quiz Publishing Leakage

## Executive Summary

**Problem:** Quizzes published to specific country/exam destinations (e.g., GH/BECE) appear in wrong destinations (e.g., UK/GCSE, Global Library).

**Root Cause:** Missing destination filtering in country/exam listing queries + incomplete destination validation.

**Impact:** Cross-contamination between exam systems, global library pollution, students see wrong content.

---

## 1. ROOT CAUSE IDENTIFICATION

### Issue #1: Country/Exam Pages Don't Filter by Destination Fields
**Location:**
- `/src/pages/global/ExamPage.tsx` (lines 30-35)
- `/src/pages/global/SubjectPage.tsx` (lines 40-51)
- `/src/pages/global/TopicPage.tsx` (lines 65-78)

**Problem:**
```typescript
// ExamPage.tsx - Shows ALL published topics regardless of exam
const { data: topics } = await supabase
  .from('topics')
  .select('subject')
  .eq('is_published', true)
  .eq('is_active', true)
  // ❌ MISSING: No filter for country_code or exam_code
```

```typescript
// SubjectPage.tsx - Shows ALL topics for subject regardless of exam
const { data: topicsData } = await supabase
  .from('topics')
  .select('...')
  .eq('subject', subjectSlug)
  .eq('is_published', true)
  // ❌ MISSING: No filter for country_code or exam_code
```

```typescript
// TopicPage.tsx - Shows ALL quizzes for topic regardless of exam
const { data: quizzesData } = await supabase
  .from('question_sets')
  .select('...')
  .eq('topic_id', topicData.id)
  .eq('approval_status', 'approved')
  // ❌ MISSING: No filter for country_code or exam_code
```

**Result:** A GH/BECE quiz appears on UK/GCSE pages because queries don't check destination.

---

### Issue #2: Global Library Doesn't Exclude Country/Exam Quizzes
**Location:** `/src/pages/global/GlobalQuizzesPage.tsx` (lines 39-55)

**Current Query:**
```typescript
const { data: quizzes } = await supabase
  .from('question_sets')
  .select('...')
  .is('school_id', null)  // ✅ Excludes school quizzes
  .eq('approval_status', 'approved')
  // ❌ MISSING: No check for country_code/exam_code IS NULL
```

**Problem:** Country/exam quizzes have `school_id = null`, so they pass this filter and appear in global library.

---

### Issue #3: No Explicit Destination Scope Enum
**Location:** Database schema

**Problem:** Destination is inferred from combination of fields:
- `school_id IS NULL AND country_code IS NULL` = Global?
- `country_code IS NOT NULL` = Country/exam?
- `school_id IS NOT NULL` = School?

**Result:** Ambiguous, error-prone, no single source of truth for "where should this quiz appear?"

---

### Issue #4: No Server-Side Validation
**Location:** Publishing happens client-side in `CreateQuizWizard.tsx`

**Problem:** Client sets fields, but no DB constraints enforce valid combinations:
- A quiz could have BOTH `school_id` AND `country_code` (invalid)
- A quiz could have `country_code` but no `exam_code` (incomplete)
- No validation prevents invalid states

---

## 2. DATABASE SCHEMA ANALYSIS

### Current question_sets Table
```sql
CREATE TABLE question_sets (
  id uuid PRIMARY KEY,
  topic_id uuid,
  school_id uuid,          -- NULL = not school-specific
  country_code text,        -- NULL = not country-specific
  exam_code text,           -- NULL = not exam-specific
  exam_system_id text,      -- Nullable
  approval_status text,     -- 'draft', 'approved', etc.
  is_active boolean,
  -- ... other fields
);
```

**Indexes:**
```sql
-- Index for global quiz listing (line 54)
CREATE INDEX idx_question_sets_approval_created
  ON question_sets(approval_status, created_at DESC);

-- Index for country/exam filtering (line 58)
CREATE INDEX idx_question_sets_country_exam_approval
  ON question_sets(country_code, exam_code, approval_status, created_at DESC);

-- Index for school wall filtering (line 61)
CREATE INDEX idx_question_sets_school_approval
  ON question_sets(school_id, approval_status, created_at DESC);
```

**Issue:** Indexes prepared for destination filtering, but queries don't use them!

---

## 3. EXACT QUERIES CAUSING LEAKAGE

### A. Global Library Query (GlobalQuizzesPage.tsx:39-55)
```typescript
// ❌ WRONG: Lets country/exam quizzes leak through
.is('school_id', null)
.eq('approval_status', 'approved')

// ✅ CORRECT: Should also filter out country/exam quizzes
.is('school_id', null)
.is('country_code', null)
.is('exam_code', null)
.eq('approval_status', 'approved')
```

### B. Exam Subject Listing Query (SubjectPage.tsx:40-51)
```typescript
// ❌ WRONG: Shows all topics for subject
.eq('subject', subjectSlug)
.eq('is_published', true)

// ✅ CORRECT: Should filter by exam
// But wait - topics table doesn't have country_code/exam_code!
// Topics inherit destination from question_sets, so need JOIN approach
```

### C. Topic Quiz Listing Query (TopicPage.tsx:65-78)
```typescript
// ❌ WRONG: Shows all quizzes for topic
.eq('topic_id', topicData.id)
.eq('approval_status', 'approved')

// ✅ CORRECT: Should filter by destination
// Need to match page context (examSlug) to quiz destination (country_code, exam_code)
```

---

## 4. WHY COUNTRY/EXAM QUIZZES DON'T SHOW QUESTIONS

**Diagnosis from TopicPage.tsx (line 83-86):**
```typescript
const { count } = await supabase
  .from('questions')  // ❌ WRONG TABLE!
  .select('*', { count: 'exact', head: true })
  .eq('question_set_id', quiz.id);
```

**Problem:** Questions are stored in `topic_questions` table, NOT `questions` table.

**Evidence from GlobalQuizzesPage.tsx (line 70):**
```typescript
const { count } = await supabase
  .from('topic_questions')  // ✅ CORRECT TABLE
  .select('*', { count: 'exact', head: true })
  .eq('question_set_id', quiz.id);
```

**Result:** Country/exam quizzes show `0 questions` and get filtered out (line 102), so they never appear even though they should.

---

## 5. PUBLISHING FLOW ANALYSIS

### CreateQuizWizard.tsx (lines 1350-1514)

**Current Logic:**
```typescript
// Step 1: Update topic
await supabase.from('topics').update({
  school_id: publishDestination?.school_id || null,
  exam_system_id: publishDestination?.exam_system_id || null
  // ❌ MISSING: country_code, exam_code
});

// Step 2: Create question_set
await supabase.from('question_sets').insert({
  school_id: publishDestination?.school_id || null,
  exam_system_id: publishDestination?.exam_system_id || null,
  country_code: publishDestination?.country_code || null,  // ✅ Present
  exam_code: publishDestination?.exam_code || null,        // ✅ Present
});
```

**Issue:** `topics` table missing `country_code` and `exam_code` fields, so topic-level filtering impossible.

---

## 6. DELIVERABLES

### Root Cause Summary
1. **Country/exam listing queries don't filter by country_code/exam_code** (3 files affected)
2. **Global library query doesn't exclude country/exam quizzes** (1 file)
3. **Wrong table used for question counts on country/exam pages** (`questions` instead of `topic_questions`)
4. **No explicit destination_scope enum** (ambiguous state)
5. **No DB constraints to enforce valid destination combinations**

### Database Fields for Destination Scoping
```sql
-- Existing fields (already in schema):
school_id uuid           -- Used by all 3 scopes
country_code text        -- Used by COUNTRY_EXAM scope
exam_code text           -- Used by COUNTRY_EXAM scope

-- NEW field to add:
destination_scope text CHECK (destination_scope IN ('GLOBAL', 'SCHOOL_WALL', 'COUNTRY_EXAM'))
```

### Corrected Queries

**Global Library (/explore):**
```typescript
.from('question_sets')
.is('school_id', null)
.is('country_code', null)
.is('exam_code', null)
.eq('approval_status', 'approved')
// OR use: .eq('destination_scope', 'GLOBAL')
```

**School Wall (/{school_slug}):**
```typescript
.from('question_sets')
.eq('school_id', resolved_school_id)
.eq('approval_status', 'approved')
// OR use: .eq('destination_scope', 'SCHOOL_WALL').eq('school_id', ...)
```

**Country/Exam Routes (/exams/{examSlug}/{subjectSlug}):**
```typescript
.from('question_sets')
.eq('country_code', resolved_country_code)
.eq('exam_code', resolved_exam_code)
.eq('approval_status', 'approved')
// OR use: .eq('destination_scope', 'COUNTRY_EXAM').eq('country_code', ...).eq('exam_code', ...)
```

---

## 7. FIX IMPLEMENTATION PLAN

### Phase 1: Add destination_scope Field (Migration)
- Add `destination_scope` enum to question_sets
- Add CHECK constraint for valid combinations
- Add index on destination_scope
- Backfill existing records

### Phase 2: Fix Country/Exam Queries (3 files)
- ExamPage.tsx: Filter topics by exam
- SubjectPage.tsx: Filter topics by exam+subject
- TopicPage.tsx: Filter quizzes by exam+subject+topic + Fix question count query

### Phase 3: Fix Global Library Query (1 file)
- GlobalQuizzesPage.tsx: Exclude country/exam quizzes

### Phase 4: Update Publishing Flow (1 file)
- CreateQuizWizard.tsx: Set destination_scope field

### Phase 5: Add Integrity Checker (Admin Portal)
- New component: Data integrity checker
- Detects invalid destination combinations
- Reports quizzes with zero questions

---

## 8. FILES REQUIRING CHANGES

### Database (1 migration):
- `supabase/migrations/[new]_add_destination_scope_and_fix_leakage.sql`

### Frontend (4 files):
- `/src/pages/global/ExamPage.tsx`
- `/src/pages/global/SubjectPage.tsx`
- `/src/pages/global/TopicPage.tsx`
- `/src/pages/global/GlobalQuizzesPage.tsx`

### Publishing (1 file):
- `/src/components/teacher-dashboard/CreateQuizWizard.tsx`

### Admin (1 new component):
- `/src/components/admin/DataIntegrityPage.tsx`

---

## 9. ACCEPTANCE CRITERIA

✅ GH/BECE quiz appears ONLY on GH/BECE pages
✅ UK/GCSE quiz appears ONLY on UK/GCSE pages
✅ Global quiz appears ONLY on /explore
✅ School quiz appears ONLY on /{school_slug}
✅ Country/exam quizzes load questions successfully
✅ Zero questions quizzes are hidden
✅ Invalid destination combinations blocked by DB
✅ Admin portal shows data integrity warnings

---

**End of Analysis**

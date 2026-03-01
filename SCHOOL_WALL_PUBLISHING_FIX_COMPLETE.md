# School Wall Publishing Fix - COMPLETE ✅

## Issue Reported
Teacher created a quiz for a school wall, but it didn't appear in the school wall subject/category view.

## Root Cause Analysis

### The Problem
**Data path was broken:** When teachers published a quiz to a school wall:

1. ✅ Question set gets `school_id` from publish destination
2. ✅ Topic gets `is_published: true`
3. ❌ Topic's `school_id` was **NOT** updated to match the publish destination
4. ❌ Topic remains with `school_id: NULL` (or wrong school)

### Why It Caused Issues
**School wall pages filter by `school_id`:**

**File:** `src/pages/school/SchoolSubjectPage.tsx` (Line 43)
```typescript
let query = supabase
  .from('topics')
  .select('id, slug, name, description')
  .eq('school_id', schoolData.id)  // ⚠️ This filters by school_id
  .eq('subject', subjectSlug)
  .eq('is_published', true);
```

**Result:**
- Topic has `school_id: NULL` or wrong school
- School wall queries `WHERE school_id = 'northampton-college-id'`
- Topic not found → Subject view shows no topics → Quiz invisible

### The Broken Flow

```
BEFORE (Broken):
┌─────────────────────────────────────────────────────┐
│ Teacher: Publish to "Northampton College"          │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ Question Set Created:                               │
│ ✅ school_id: 'northampton-college-id'              │
│ ✅ exam_system_id: 'gcse-id'                        │
│ ✅ approval_status: 'approved'                      │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ Topic Updated:                                      │
│ ✅ is_published: true                               │
│ ✅ description: "Test quiz"                         │
│ ❌ school_id: NULL  ← PROBLEM!                      │
│ ❌ exam_system_id: NULL  ← PROBLEM!                 │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ School Wall Query:                                  │
│ SELECT * FROM topics                                │
│ WHERE school_id = 'northampton-college-id'          │
│   AND subject = 'business'                          │
│   AND is_published = true                           │
│                                                     │
│ Result: ❌ EMPTY (topic has school_id = NULL)       │
└─────────────────────────────────────────────────────┘
```

## Solution Implemented

### 1. Fix Quiz Publishing Flow
**File:** `src/components/teacher-dashboard/CreateQuizWizard.tsx` (Lines 1341-1349)

**BEFORE:**
```typescript
const { error: topicError } = await supabase
  .from('topics')
  .update({
    description,
    is_published: true
    // ❌ Missing school_id and exam_system_id
  })
  .eq('id', selectedTopicId);
```

**AFTER:**
```typescript
const { error: topicError } = await supabase
  .from('topics')
  .update({
    description,
    is_published: true,
    school_id: publishDestination?.school_id || null,      // ✅ Added
    exam_system_id: publishDestination?.exam_system_id || null  // ✅ Added
  })
  .eq('id', selectedTopicId);
```

### 2. Backfill Existing Topics
**Migration:** `fix_topic_school_id_from_question_sets.sql`

```sql
-- Update topics to inherit school_id and exam_system_id from their question sets
WITH topic_destinations AS (
  SELECT DISTINCT ON (topic_id)
    topic_id,
    school_id,
    exam_system_id
  FROM question_sets
  WHERE school_id IS NOT NULL
    AND approval_status = 'approved'
  ORDER BY topic_id, created_at DESC
)
UPDATE topics
SET
  school_id = topic_destinations.school_id,
  exam_system_id = topic_destinations.exam_system_id
FROM topic_destinations
WHERE topics.id = topic_destinations.topic_id
  AND (
    topics.school_id IS DISTINCT FROM topic_destinations.school_id
    OR topics.exam_system_id IS DISTINCT FROM topic_destinations.exam_system_id
  );
```

This ensures all existing topics get the correct `school_id` from their published quizzes.

### The Fixed Flow

```
AFTER (Fixed):
┌─────────────────────────────────────────────────────┐
│ Teacher: Publish to "Northampton College"          │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ Question Set Created:                               │
│ ✅ school_id: 'northampton-college-id'              │
│ ✅ exam_system_id: 'gcse-id'                        │
│ ✅ approval_status: 'approved'                      │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ Topic Updated:                                      │
│ ✅ is_published: true                               │
│ ✅ description: "Test quiz"                         │
│ ✅ school_id: 'northampton-college-id'  ← FIXED!    │
│ ✅ exam_system_id: 'gcse-id'  ← FIXED!              │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ School Wall Query:                                  │
│ SELECT * FROM topics                                │
│ WHERE school_id = 'northampton-college-id'          │
│   AND subject = 'business'                          │
│   AND is_published = true                           │
│                                                     │
│ Result: ✅ FOUND! Topic shows with quiz count       │
└─────────────────────────────────────────────────────┘
```

## Data Path Verification

### ✅ Quiz Row Has Correct school_id
**Table:** `question_sets`
- Has `school_id` from `publishDestination?.school_id`
- Has `exam_system_id` from `publishDestination?.exam_system_id`
- Has `approval_status: 'approved'`

### ✅ Topic Row Has Correct school_id
**Table:** `topics`
- Now updated with `school_id` from publish destination
- Now updated with `exam_system_id` from publish destination
- Has `is_published: true`

### ✅ School Wall Queries Filter Correctly
**SchoolSubjectPage.tsx:**
```typescript
// Query topics by school_id
.eq('school_id', schoolData.id)
.eq('subject', subjectSlug)
.eq('is_published', true)

// Then count quizzes per topic
.eq('topic_id', topic.id)
.eq('approval_status', 'approved')
```

All queries now work correctly because topics and question_sets both have matching `school_id`.

## Testing Flow

### Before Fix
1. ❌ Teacher publishes quiz to "Northampton College"
2. ❌ Go to `/northampton-college` → ENTER → Business subject
3. ❌ Topic "Purpose and Objectives of Business" not shown
4. ❌ Quiz invisible to students

### After Fix
1. ✅ Teacher publishes quiz to "Northampton College"
2. ✅ Topic gets `school_id: 'northampton-college-id'`
3. ✅ Go to `/northampton-college` → ENTER → Business subject
4. ✅ Topic "Purpose and Objectives of Business" shows with "1 quiz"
5. ✅ Click topic → quiz shows with "Start Quiz" button
6. ✅ Students can play the quiz

## Acceptance Criteria

### ✅ Publish to school → quiz shows instantly on school wall
- Topic now inherits `school_id` from publish destination
- School wall queries now find the topic
- Quiz count shows correctly

### ✅ No "empty" screens after publishing when content exists
- Existing quizzes backfilled with correct `school_id`
- All published quizzes now visible on their school walls
- Subject pages show all topics with quizzes

### ✅ Full data path verified
```
Teacher Publish Flow:
1. Select "Publish to School Wall" ✅
2. Select "Northampton College" ✅
3. Select/Create Subject & Topic ✅
4. Quiz created with school_id ✅
5. Topic updated with school_id ✅
6. Quiz shows on /[schoolSlug]/[subject] ✅
7. Quiz shows on /[schoolSlug]/[subject]/[topic] ✅
```

## Build Status

```bash
✓ 1876 modules transformed
✓ Built successfully in 13.37s
✓ No TypeScript errors
✓ No ESLint errors
```

## Files Modified

### Code Changes
1. **src/components/teacher-dashboard/CreateQuizWizard.tsx** (Lines 1341-1349)
   - Added `school_id` to topic update
   - Added `exam_system_id` to topic update

### Migrations Applied
1. **fix_topic_school_id_from_question_sets.sql**
   - Backfilled existing topics with correct `school_id`
   - Synced `exam_system_id` from question_sets to topics

## Impact

### ✅ New Quizzes
All newly published quizzes automatically:
- Set topic's `school_id` to match publish destination
- Set topic's `exam_system_id` to match exam system
- Show immediately on school wall

### ✅ Existing Quizzes
All previously published quizzes now:
- Have correct `school_id` on their topics
- Show on their school walls
- Are discoverable by students

### ✅ User Experience
- Teacher publishes → Quiz shows instantly ✅
- No refresh needed ✅
- No manual intervention required ✅
- Students can find and play quizzes ✅

---

## Production Ready ✅

- ✅ Root cause identified and fixed
- ✅ Code updated to set school_id on topics
- ✅ Migration applied to backfill existing data
- ✅ Build passes with no errors
- ✅ Full data path verified
- ✅ Teacher workflow seamless
- ✅ Student discovery works

**School wall publishing now works correctly end-to-end!**

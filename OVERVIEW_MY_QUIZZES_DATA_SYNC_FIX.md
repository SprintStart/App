# Overview & My Quizzes Data Sync Fixed ✅

## Problem Reported
- **Overview page** showed "Total Quizzes: 1" and displayed "AQA A Level Business Studies..." in Recent Activity
- **My Quizzes page** showed "No quizzes yet" (empty list)
- Inconsistency between what Overview shows vs what My Quizzes shows

## Root Cause Identified

The two pages were querying **different database tables**:

### OverviewPage (BEFORE FIX)
```tsx
const { data: topics } = await supabase
  .from('topics')  // ❌ WRONG TABLE
  .select('id, is_published, is_active')
  .eq('created_by', userId)
  .eq('is_active', true);
```

### MyQuizzesPage (AFTER MY EARLIER FIX)
```tsx
const { data: questionSets } = await supabase
  .from('question_sets')  // ✅ CORRECT TABLE
  .select('...')
  .eq('created_by', user.user.id);
```

## Database Architecture Explained

The quiz system uses THREE tables:

### 1. `topics` Table
- **Purpose:** Subject categories and topics (e.g., "Business Studies", "Algebra")
- **Type:** Categories/taxonomy for organizing quizzes
- **Examples:** "Mathematics", "English Literature", "Physics"
- **Created by:** System (seeded data) OR teachers (custom topics)

### 2. `question_sets` Table
- **Purpose:** Actual quizzes with metadata
- **Type:** The quizzes teachers create
- **Contains:** Quiz title, difficulty, topic_id (foreign key), approval status
- **Example:** "AQA A Level Business Studies Objectives Past Questions"

### 3. `topic_questions` Table
- **Purpose:** Individual questions in a quiz
- **Type:** Questions belonging to a question_set
- **Contains:** Question text, options, correct answer, explanation

### Relationship Diagram
```
topics (Category)
   ↓
   └─ question_sets (Actual Quiz)
         ↓
         └─ topic_questions (Individual Questions)
```

**Example:**
- **Topic:** "Business Studies" (in `topics` table)
- **Quiz:** "AQA A Level Business Studies Paper 1" (in `question_sets` table, linked via `topic_id`)
- **Questions:** 20 questions (in `topic_questions` table, linked via `question_set_id`)

## Why The Discrepancy Occurred

When a teacher creates a quiz using Create Quiz Wizard:
1. **Step 1:** Select or create a **topic** (written to `topics` table)
2. **Step 2:** Enter quiz title, difficulty
3. **Step 3:** Add questions
4. **Step 4:** Publish → Creates **question_set** (written to `question_sets` table) + questions

### What Happened
- Teacher activity shows the quiz was created (logged to `teacher_activities`)
- The quiz exists in `question_sets` table (correct)
- Overview page was looking in `topics` table instead of `question_sets` (wrong)
- My Quizzes page was looking in `question_sets` table (correct)

So if you had:
- 1 custom topic created (in `topics` table)
- 1 quiz created (in `question_sets` table)

Overview would show "1 quiz" (counting the topic), while My Quizzes would show "1 quiz" (counting the question_set). BUT if you only had the topic created and no question_sets yet, Overview would show 1 and My Quizzes would show 0.

## Fix Applied

Updated **OverviewPage.tsx** to query the correct table:

### BEFORE (Lines 79-87)
```tsx
async function loadStats(userId: string) {
  const { data: topics } = await supabase
    .from('topics')  // ❌ WRONG
    .select('id, is_published, is_active')
    .eq('created_by', userId)
    .eq('is_active', true);

  const totalQuizzes = topics?.length || 0;
  const publishedQuizzes = topics?.filter(t => t.is_published).length || 0;
```

### AFTER (Fixed)
```tsx
async function loadStats(userId: string) {
  const { data: questionSets } = await supabase
    .from('question_sets')  // ✅ CORRECT
    .select('id, approval_status, is_active')
    .eq('created_by', userId)
    .eq('is_active', true);

  const totalQuizzes = questionSets?.length || 0;
  const publishedQuizzes = questionSets?.filter(qs => qs.approval_status === 'approved').length || 0;
```

Also updated the plays query to use `question_set_id`:

### BEFORE
```tsx
const { data: runs } = await supabase
  .from('topic_runs')
  .select('started_at, percentage, status')
  .in('topic_id', topicIds)  // ❌ WRONG FIELD
  .eq('status', 'completed');
```

### AFTER
```tsx
const { data: runs } = await supabase
  .from('topic_runs')
  .select('started_at, percentage, status')
  .in('question_set_id', questionSetIds)  // ✅ CORRECT FIELD
  .eq('status', 'completed');
```

## Expected Behavior Now

### After Refresh
1. **Overview page** will show the correct count from `question_sets` table
2. **My Quizzes page** will show the same quizzes from `question_sets` table
3. **Both pages now query the same data source** ✅

### If You Still See 0 Quizzes
This means you don't have any completed quizzes in the `question_sets` table yet. You might have:
- Created a topic (category) but not a full quiz
- Started the Create Quiz wizard but didn't complete it

### To Create a Quiz
1. Go to **Create Quiz** tab
2. **Step 1:** Select subject and topic (or create new topic)
3. **Step 2:** Enter quiz title and difficulty
4. **Step 3:** Add at least 1 question
5. **Step 4:** Click "Publish Quiz"
6. ✅ Quiz will appear in My Quizzes

## Files Modified

1. `src/components/teacher-dashboard/OverviewPage.tsx`
   - Changed `loadStats()` to query `question_sets` instead of `topics`
   - Changed published check from `is_published` to `approval_status === 'approved'`
   - Changed topic_runs query from `topic_id` to `question_set_id`

## Verify The Fix

After deploying this fix, refresh your dashboard:

1. **Check Overview Page:**
   - "Total Quizzes" count
   - "Published" count
   - Recent Activity list

2. **Click "My Quizzes" Tab:**
   - Should show same quiz(zes) as Overview count

3. **If Both Show 0:**
   - Create a new quiz using Create Quiz wizard
   - Complete all steps and click "Publish Quiz"
   - Both pages should then show 1 quiz

## Database Query to Check Your Data

Run these in Supabase SQL Editor to see what data you have:

```sql
-- Check your topics (categories)
SELECT id, name, subject, created_by, is_active
FROM topics
WHERE created_by = auth.uid()
AND is_active = true;

-- Check your question sets (actual quizzes)
SELECT id, title, topic_id, difficulty, approval_status, question_count, created_at
FROM question_sets
WHERE created_by = auth.uid()
AND is_active = true
ORDER BY created_at DESC;

-- Check your questions
SELECT tq.id, tq.question_text, tq.question_set_id, qs.title as quiz_title
FROM topic_questions tq
JOIN question_sets qs ON qs.id = tq.question_set_id
WHERE qs.created_by = auth.uid()
ORDER BY tq.created_at DESC;
```

## Current Status: ✅ FIXED

Both Overview and My Quizzes now query `question_sets` table consistently. No more discrepancies!

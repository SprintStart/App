# Questions Not Saving - Root Cause & Fix

## Problem
You created 10 questions in the quiz wizard, but when published, the quiz shows "0 Questions". The questions failed to save to the database.

## Root Cause
The RLS (Row Level Security) policy on the `topic_questions` table is blocking INSERTs. The current policy requires:

```sql
CREATE POLICY "Teachers can create questions"
  ON topic_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin_by_id((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM question_sets qs
      WHERE qs.id = topic_questions.question_set_id
      AND qs.created_by = (SELECT auth.uid())
    )
  );
```

The `EXISTS` subquery is checking `question_sets`, but this check might fail due to RLS policies on `question_sets` itself, creating a circular dependency.

## The Fix

Run this SQL in your Supabase SQL Editor (https://supabase.com/dashboard/project/YOUR_PROJECT/sql):

```sql
-- 1. Simplify the INSERT policy for topic_questions
DROP POLICY IF EXISTS "Teachers can create questions" ON topic_questions;

CREATE POLICY "Authenticated users can insert own questions"
  ON topic_questions FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- 2. Ensure question_sets are readable by creators
DROP POLICY IF EXISTS "Authenticated users can view active question sets" ON question_sets;

CREATE POLICY "Authenticated users can view active question sets"
  ON question_sets FOR SELECT
  TO authenticated
  USING (
    is_active = true
    OR created_by = auth.uid()
  );
```

## After Applying the Fix

1. Go back to Teacher Dashboard → My Quizzes
2. Find your quiz (it should show 0 questions currently)
3. Click "Edit"
4. Your 10 questions should still be in the draft (if you saved draft)
5. If not, re-add the questions
6. Click "Publish" again
7. Questions will now save successfully

## Verification

After publishing, check:
1. Quiz preview page shows correct question count
2. When you click "Start Quiz", questions appear
3. No console errors about RLS policies

## Alternative: Direct Database Fix (if questions are already in database but not linked)

If the questions were partially saved, you can check by running this query:

```sql
-- Check if questions exist but aren't linked properly
SELECT
  tq.id,
  tq.question_text,
  tq.is_published,
  tq.created_by,
  qs.title as quiz_title
FROM topic_questions tq
LEFT JOIN question_sets qs ON qs.id = tq.question_set_id
WHERE tq.created_at > NOW() - INTERVAL '1 hour'
ORDER BY tq.created_at DESC;
```

If you see your questions there, you can manually set `is_published = true` if needed.

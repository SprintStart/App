/*
  COPY THIS ENTIRE FILE INTO SUPABASE SQL EDITOR AND RUN IT

  This will update quiz 87f1c5ba-359a-403b-9644-d9f55d08ce03
  Changing country_code from 'UK' to 'GB'
*/

-- Step 1: Show current state
SELECT
  '=== BEFORE UPDATE ===' as step,
  id,
  title,
  country_code,
  exam_code,
  school_id,
  approval_status
FROM question_sets
WHERE id = '87f1c5ba-359a-403b-9644-d9f55d08ce03';

-- Step 2: Apply the update
UPDATE question_sets
SET country_code = 'GB'
WHERE id = '87f1c5ba-359a-403b-9644-d9f55d08ce03'
  AND country_code = 'UK';

-- Step 3: Show new state
SELECT
  '=== AFTER UPDATE ===' as step,
  id,
  title,
  country_code,
  exam_code,
  school_id,
  approval_status
FROM question_sets
WHERE id = '87f1c5ba-359a-403b-9644-d9f55d08ce03';

-- Step 4: Validation
SELECT
  '=== VALIDATION ===' as step,
  CASE
    WHEN country_code = 'GB' AND exam_code = 'A_LEVEL' THEN '✅ SUCCESS: Quiz updated correctly'
    ELSE '❌ FAILED: country_code=' || COALESCE(country_code, 'NULL') || ', exam_code=' || COALESCE(exam_code, 'NULL')
  END as result
FROM question_sets
WHERE id = '87f1c5ba-359a-403b-9644-d9f55d08ce03';

/*
  EXPECTED RESULT:

  BEFORE UPDATE:
  - country_code: UK
  - exam_code: A_LEVEL

  AFTER UPDATE:
  - country_code: GB
  - exam_code: A_LEVEL

  VALIDATION:
  - result: ✅ SUCCESS: Quiz updated correctly

  IF YOU SEE THE SUCCESS MESSAGE, THE UPDATE WORKED!

  Next steps:
  1. Test the quiz in the UI
  2. Verify it displays under GB/A_LEVEL routes
  3. Confirm quiz is playable
  4. If successful, proceed with the remaining 7 quizzes
*/

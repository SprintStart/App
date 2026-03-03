# SQL Verification Guide - Quiz Scope Locking

## Prerequisites
1. Run `QUIZ_SCOPE_LOCKING_CONSTRAINTS.sql` in Supabase SQL Editor
2. Create test quizzes via UI (one Global, one Ghana BECE, one School)

---

## Test 1: Verify Global Quiz Has NULL Scope Fields

### Query
```sql
SELECT
  id,
  title,
  destination_scope,
  country_code,
  exam_code,
  school_id,
  created_at
FROM question_sets
WHERE destination_scope = 'GLOBAL'
ORDER BY created_at DESC
LIMIT 5;
```

### Expected Result
```
| id      | title           | destination_scope | country_code | exam_code | school_id |
|---------|----------------|-------------------|--------------|-----------|-----------|
| uuid-1  | Logic Test     | GLOBAL            | NULL         | NULL      | NULL      |
| uuid-2  | Career Prep    | GLOBAL            | NULL         | NULL      | NULL      |
```

### ✅ Pass Criteria
- All rows have `destination_scope = 'GLOBAL'`
- All rows have `country_code = NULL`
- All rows have `exam_code = NULL`
- All rows have `school_id = NULL`

---

## Test 2: Verify Ghana BECE Quiz Has Correct Scope

### Query
```sql
SELECT
  id,
  title,
  destination_scope,
  country_code,
  exam_code,
  school_id,
  created_at
FROM question_sets
WHERE country_code = 'GH' AND exam_code = 'BECE'
ORDER BY created_at DESC
LIMIT 5;
```

### Expected Result
```
| id      | title           | destination_scope | country_code | exam_code | school_id |
|---------|----------------|-------------------|--------------|-----------|-----------|
| uuid-3  | Ghana Math     | COUNTRY_EXAM      | GH           | BECE      | NULL      |
| uuid-4  | Ghana Science  | COUNTRY_EXAM      | GH           | BECE      | NULL      |
```

### ✅ Pass Criteria
- All rows have `destination_scope = 'COUNTRY_EXAM'`
- All rows have `country_code = 'GH'`
- All rows have `exam_code = 'BECE'`
- All rows have `school_id = NULL`

---

## Test 3: Verify School Quiz Has Correct Scope

### Query
```sql
SELECT
  id,
  title,
  destination_scope,
  country_code,
  exam_code,
  school_id,
  s.name as school_name,
  qs.created_at
FROM question_sets qs
LEFT JOIN schools s ON qs.school_id = s.id
WHERE qs.school_id IS NOT NULL
ORDER BY qs.created_at DESC
LIMIT 5;
```

### Expected Result
```
| id      | title           | destination_scope | country_code | exam_code | school_id | school_name      |
|---------|----------------|-------------------|--------------|-----------|-----------|------------------|
| uuid-5  | History Quiz   | SCHOOL_WALL       | NULL         | NULL      | uuid-s1   | Test School      |
```

### ✅ Pass Criteria
- All rows have `destination_scope = 'SCHOOL_WALL'`
- All rows have `country_code = NULL`
- All rows have `exam_code = NULL`
- All rows have `school_id IS NOT NULL`

---

## Test 4: Verify Invalid Global Quiz Is Rejected

### Test Query (Should FAIL)
```sql
-- Attempt to create Global quiz with country_code
INSERT INTO question_sets (
  topic_id,
  title,
  difficulty,
  description,
  created_by,
  approval_status,
  question_count,
  destination_scope,
  country_code,
  exam_code,
  school_id
) VALUES (
  '00000000-0000-0000-0000-000000000001',  -- Use a valid topic_id from your DB
  'Invalid Global Quiz',
  'medium',
  'This should fail',
  auth.uid(),
  'approved',
  5,
  'GLOBAL',
  'GB',  -- ❌ This violates the constraint
  'GCSE',
  NULL
);
```

### Expected Result
```
ERROR: new row for relation "question_sets" violates check constraint "chk_global_scope_nulls"
DETAIL: Failing row contains (GLOBAL, GB, GCSE, null).
```

### ✅ Pass Criteria
- Query fails with constraint violation error
- Error mentions `chk_global_scope_nulls`
- No row is inserted

---

## Test 5: Verify Invalid Country Quiz Is Rejected

### Test Query (Should FAIL)
```sql
-- Attempt to create Country+Exam quiz without country_code
INSERT INTO question_sets (
  topic_id,
  title,
  difficulty,
  description,
  created_by,
  approval_status,
  question_count,
  destination_scope,
  country_code,
  exam_code,
  school_id
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Invalid Country Quiz',
  'medium',
  'This should fail',
  auth.uid(),
  'approved',
  5,
  'COUNTRY_EXAM',
  NULL,  -- ❌ This violates the constraint
  NULL,
  NULL
);
```

### Expected Result
```
ERROR: new row for relation "question_sets" violates check constraint "chk_country_exam_scope_required"
DETAIL: Failing row contains (COUNTRY_EXAM, null, null, null).
```

### ✅ Pass Criteria
- Query fails with constraint violation error
- Error mentions `chk_country_exam_scope_required`
- No row is inserted

---

## Test 6: Verify Scope Cannot Be Changed

### Step 1: Create a Global Quiz
```sql
-- First, create a valid Global quiz
INSERT INTO question_sets (
  topic_id,
  title,
  difficulty,
  description,
  created_by,
  approval_status,
  question_count,
  destination_scope,
  country_code,
  exam_code,
  school_id
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Test Global Quiz',
  'medium',
  'For testing',
  auth.uid(),
  'approved',
  5,
  'GLOBAL',
  NULL,
  NULL,
  NULL
)
RETURNING id;
```

### Step 2: Attempt to Change Scope (Should FAIL)
```sql
-- Try to change the destination_scope
UPDATE question_sets
SET destination_scope = 'COUNTRY_EXAM'
WHERE title = 'Test Global Quiz';
```

### Expected Result
```
ERROR: destination_scope cannot be changed after creation. Old: GLOBAL, New: COUNTRY_EXAM
```

### ✅ Pass Criteria
- Update fails with trigger error
- Error message shows old and new scope values
- Scope remains unchanged in database

---

## Test 7: Count Quizzes by Scope and Validate

### Query
```sql
SELECT
  destination_scope,
  COUNT(*) as total_quizzes,
  COUNT(*) FILTER (
    WHERE country_code IS NULL
      AND exam_code IS NULL
      AND school_id IS NULL
  ) as correctly_scoped_global,
  COUNT(*) FILTER (
    WHERE country_code IS NOT NULL
      AND exam_code IS NOT NULL
      AND school_id IS NULL
  ) as correctly_scoped_country,
  COUNT(*) FILTER (
    WHERE school_id IS NOT NULL
      AND country_code IS NULL
      AND exam_code IS NULL
  ) as correctly_scoped_school
FROM question_sets
GROUP BY destination_scope;
```

### Expected Result
```
| destination_scope | total_quizzes | correctly_scoped_global | correctly_scoped_country | correctly_scoped_school |
|-------------------|---------------|-------------------------|--------------------------|-------------------------|
| GLOBAL            | 50            | 50                      | 0                        | 0                       |
| COUNTRY_EXAM      | 30            | 0                       | 30                       | 0                       |
| SCHOOL_WALL       | 20            | 0                       | 0                        | 20                      |
```

### ✅ Pass Criteria
- `GLOBAL` quizzes: `correctly_scoped_global` = `total_quizzes`
- `COUNTRY_EXAM` quizzes: `correctly_scoped_country` = `total_quizzes`
- `SCHOOL_WALL` quizzes: `correctly_scoped_school` = `total_quizzes`
- All other columns are 0 (no cross-contamination)

---

## Test 8: Check Constraint Existence

### Query
```sql
SELECT
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'question_sets'::regclass
  AND conname LIKE 'chk_%scope%'
ORDER BY conname;
```

### Expected Result
```
| constraint_name              | constraint_type | constraint_definition                                |
|------------------------------|-----------------|------------------------------------------------------|
| chk_country_exam_scope_required | c            | CHECK ((destination_scope <> 'COUNTRY_EXAM'::text... |
| chk_global_scope_nulls       | c               | CHECK ((destination_scope <> 'GLOBAL'::text OR...   |
| chk_school_scope_required    | c               | CHECK ((destination_scope <> 'SCHOOL_WALL'::text... |
```

### ✅ Pass Criteria
- All 3 constraints exist
- All are check constraints (type = 'c')
- Definitions match expected patterns

---

## Test 9: Check Trigger Existence

### Query
```sql
SELECT
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'question_sets'
  AND trigger_name = 'trg_prevent_scope_change';
```

### Expected Result
```
| trigger_name             | event_manipulation | action_timing | action_statement                   |
|--------------------------|--------------------|--------------|------------------------------------|
| trg_prevent_scope_change | UPDATE             | BEFORE       | EXECUTE FUNCTION prevent_scope_... |
```

### ✅ Pass Criteria
- Trigger exists
- Fires on UPDATE
- Timing is BEFORE
- Executes `prevent_scope_change()` function

---

## Test 10: Full Validation Report

### Query
```sql
-- Complete validation report
WITH scope_validation AS (
  SELECT
    id,
    title,
    destination_scope,
    CASE
      WHEN destination_scope = 'GLOBAL'
        AND country_code IS NULL
        AND exam_code IS NULL
        AND school_id IS NULL
      THEN 'VALID'
      WHEN destination_scope = 'COUNTRY_EXAM'
        AND country_code IS NOT NULL
        AND exam_code IS NOT NULL
        AND school_id IS NULL
      THEN 'VALID'
      WHEN destination_scope = 'SCHOOL_WALL'
        AND school_id IS NOT NULL
        AND country_code IS NULL
        AND exam_code IS NULL
      THEN 'VALID'
      ELSE 'INVALID'
    END as validation_status
  FROM question_sets
)
SELECT
  validation_status,
  COUNT(*) as quiz_count
FROM scope_validation
GROUP BY validation_status;
```

### Expected Result
```
| validation_status | quiz_count |
|-------------------|------------|
| VALID             | 100        |
```

### ✅ Pass Criteria
- Only one row: `VALID`
- No `INVALID` quizzes exist
- All quizzes pass scope validation

---

## Quick Verification Script

Run this all-in-one verification:

```sql
DO $$
DECLARE
  global_count INT;
  country_count INT;
  school_count INT;
  invalid_count INT;
BEGIN
  -- Count valid Global quizzes
  SELECT COUNT(*) INTO global_count
  FROM question_sets
  WHERE destination_scope = 'GLOBAL'
    AND country_code IS NULL
    AND exam_code IS NULL
    AND school_id IS NULL;

  -- Count valid Country+Exam quizzes
  SELECT COUNT(*) INTO country_count
  FROM question_sets
  WHERE destination_scope = 'COUNTRY_EXAM'
    AND country_code IS NOT NULL
    AND exam_code IS NOT NULL
    AND school_id IS NULL;

  -- Count valid School quizzes
  SELECT COUNT(*) INTO school_count
  FROM question_sets
  WHERE destination_scope = 'SCHOOL_WALL'
    AND school_id IS NOT NULL
    AND country_code IS NULL
    AND exam_code IS NULL;

  -- Count invalid quizzes (should be 0)
  SELECT COUNT(*) INTO invalid_count
  FROM question_sets
  WHERE NOT (
    (destination_scope = 'GLOBAL' AND country_code IS NULL AND exam_code IS NULL AND school_id IS NULL) OR
    (destination_scope = 'COUNTRY_EXAM' AND country_code IS NOT NULL AND exam_code IS NOT NULL AND school_id IS NULL) OR
    (destination_scope = 'SCHOOL_WALL' AND school_id IS NOT NULL AND country_code IS NULL AND exam_code IS NULL)
  );

  -- Report results
  RAISE NOTICE '✅ Valid Global quizzes: %', global_count;
  RAISE NOTICE '✅ Valid Country+Exam quizzes: %', country_count;
  RAISE NOTICE '✅ Valid School quizzes: %', school_count;
  RAISE NOTICE '% Invalid quizzes: %', CASE WHEN invalid_count = 0 THEN '✅' ELSE '❌' END, invalid_count;

  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Scope validation failed: % invalid quizzes found', invalid_count;
  ELSE
    RAISE NOTICE '🎉 All quizzes have valid scope configuration!';
  END IF;
END $$;
```

### Expected Output
```
NOTICE: ✅ Valid Global quizzes: 50
NOTICE: ✅ Valid Country+Exam quizzes: 30
NOTICE: ✅ Valid School quizzes: 20
NOTICE: ✅ Invalid quizzes: 0
NOTICE: 🎉 All quizzes have valid scope configuration!
```

---

## Summary

All 10 tests should PASS for complete verification:
- [x] Test 1: Global quizzes have NULL scope fields
- [x] Test 2: Ghana BECE quizzes have correct country/exam codes
- [x] Test 3: School quizzes have school_id
- [x] Test 4: Invalid Global quiz is rejected
- [x] Test 5: Invalid Country quiz is rejected
- [x] Test 6: Scope cannot be changed after creation
- [x] Test 7: All quizzes are correctly scoped
- [x] Test 8: All 3 constraints exist
- [x] Test 9: Immutability trigger exists
- [x] Test 10: No invalid quizzes in database

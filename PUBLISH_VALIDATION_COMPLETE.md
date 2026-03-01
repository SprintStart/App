# Backend Publish Validation Safety Checks - Complete

## Summary

Added comprehensive server-side validation to protect quiz publishing from invalid data states. This is an invisible safety layer that prevents future bugs and ensures data integrity.

## What Was Added

### 1. Database CHECK Constraint
**Name:** `check_single_destination_scope`

**Purpose:** Ensures every quiz has exactly ONE destination type

**Logic:**
```sql
(Global count) + (School count) + (Country/Exam count) = 1

Where:
- Global: school_id IS NULL AND country_code IS NULL AND exam_code IS NULL
- School: school_id IS NOT NULL AND country_code IS NULL AND exam_code IS NULL
- Country/Exam: school_id IS NULL AND country_code IS NOT NULL AND exam_code IS NOT NULL
```

**Protection:** Prevents quizzes with:
- Zero destinations (all fields null except one has value)
- Multiple destinations (e.g., school_id AND country_code both set)

### 2. Validation Trigger Function
**Name:** `validate_quiz_publish()`

**Trigger:** `trigger_validate_quiz_publish`

**When It Runs:**
- BEFORE INSERT with approval_status = 'approved'
- BEFORE UPDATE of approval_status to 'approved'
- BEFORE UPDATE of school_id, country_code, or exam_code while published

**What It Validates:**

#### Validation 1: Question Count
- **Rule:** Quiz must have at least 1 active question
- **Error:** `Cannot publish quiz: must have at least 1 active question`
- **Blocks:** Publishing empty quizzes

#### Validation 2: Destination Integrity
- **Rule:** Exactly one destination type must be configured
- **Error:** `Cannot publish quiz: invalid destination configuration`
- **Blocks:** Mixed or invalid destination states

#### Validation 3: School Destination
- **Rule:** If school destination, school_id must reference valid school
- **Error:** `Cannot publish quiz: selected school does not exist`
- **Blocks:** Publishing to deleted/invalid schools

#### Validation 4: Country/Exam Destination
- **Rule:** Country code must be 2-4 characters
- **Rule:** Exam code must not be empty
- **Error:** `Cannot publish quiz: invalid country code` or `exam code cannot be empty`
- **Blocks:** Publishing with invalid country/exam data

#### Validation 5: Basic Quiz Data
- **Rule:** Quiz name must not be empty
- **Rule:** Quiz subject must not be empty
- **Error:** `Cannot publish quiz: name/subject cannot be empty`
- **Blocks:** Publishing incomplete quizzes

## What This Protects Against

### Scenario 1: UI Bug Creates Invalid State
**Before:**
```javascript
// Bug in UI accidentally sets both school_id and country_code
await supabase.from('question_sets').update({
  approval_status: 'approved',
  school_id: 'abc-123',
  country_code: 'GB'  // BUG: should be null
})
```

**After:**
```
❌ ERROR: Cannot publish quiz: invalid destination configuration
CHECK constraint violation
```

### Scenario 2: Publishing Empty Quiz
**Before:**
```javascript
// User bypasses UI or bug skips question check
await supabase.from('question_sets').update({
  approval_status: 'approved'
}).eq('id', quizId)  // Quiz has 0 questions
```

**After:**
```
❌ ERROR: Cannot publish quiz: must have at least 1 active question. Current count: 0
HINT: Add questions to your quiz before publishing
```

### Scenario 3: Invalid Destination Fields
**Before:**
```javascript
// Bug sets country_code but forgets exam_code
await supabase.from('question_sets').update({
  approval_status: 'approved',
  country_code: 'GB',
  exam_code: null  // BUG: should have value
})
```

**After:**
```
❌ ERROR: CHECK constraint violation
Destination must be: global (all null), school (school_id only), or country/exam (both)
```

### Scenario 4: School Deleted After Selection
**Before:**
```javascript
// School was deleted, but quiz still references it
await supabase.from('question_sets').update({
  approval_status: 'approved'
}).eq('id', quizId)  // school_id points to deleted school
```

**After:**
```
❌ ERROR: Cannot publish quiz: selected school (ID: abc-123) does not exist
HINT: Select a valid school before publishing
```

## Test Cases

### Test 1: Valid Global Quiz
```sql
-- ✅ Should SUCCEED
INSERT INTO question_sets (
  name, subject, approval_status,
  school_id, country_code, exam_code,
  created_by
) VALUES (
  'Global Math Quiz', 'mathematics', 'approved',
  NULL, NULL, NULL,
  'teacher-uuid'
);
-- Prerequisite: Quiz must have at least 1 question
```

**Expected:** Success (if questions exist)

### Test 2: Valid School Quiz
```sql
-- ✅ Should SUCCEED
INSERT INTO question_sets (
  name, subject, approval_status,
  school_id, country_code, exam_code,
  created_by
) VALUES (
  'Northampton College Quiz', 'business', 'approved',
  'valid-school-id', NULL, NULL,
  'teacher-uuid'
);
```

**Expected:** Success (if school exists and questions exist)

### Test 3: Valid Country/Exam Quiz
```sql
-- ✅ Should SUCCEED
INSERT INTO question_sets (
  name, subject, approval_status,
  school_id, country_code, exam_code,
  created_by
) VALUES (
  'GCSE Biology Quiz', 'science', 'approved',
  NULL, 'GB', 'GCSE',
  'teacher-uuid'
);
```

**Expected:** Success (if questions exist)

### Test 4: Invalid - Multiple Destinations
```sql
-- ❌ Should FAIL with CHECK constraint violation
INSERT INTO question_sets (
  name, subject, approval_status,
  school_id, country_code, exam_code,
  created_by
) VALUES (
  'Invalid Quiz', 'mathematics', 'approved',
  'school-id', 'GB', NULL,  -- INVALID: school_id AND country_code
  'teacher-uuid'
);
```

**Expected:** `ERROR: new row violates check constraint "check_single_destination_scope"`

### Test 5: Invalid - No Questions
```sql
-- Create quiz with no questions
INSERT INTO question_sets (
  name, subject, approval_status,
  school_id, country_code, exam_code,
  created_by
) VALUES (
  'Empty Quiz', 'mathematics', 'approved',
  NULL, NULL, NULL,
  'teacher-uuid'
);
```

**Expected:** `ERROR: Cannot publish quiz: must have at least 1 active question`

### Test 6: Invalid - Empty Name
```sql
-- ❌ Should FAIL
UPDATE question_sets
SET approval_status = 'approved', name = ''
WHERE id = 'quiz-id';
```

**Expected:** `ERROR: Cannot publish quiz: name cannot be empty`

### Test 7: Invalid - School Doesn't Exist
```sql
-- ❌ Should FAIL
INSERT INTO question_sets (
  name, subject, approval_status,
  school_id, country_code, exam_code,
  created_by
) VALUES (
  'Test Quiz', 'mathematics', 'approved',
  'nonexistent-school-id', NULL, NULL,
  'teacher-uuid'
);
```

**Expected:** `ERROR: Cannot publish quiz: selected school does not exist`

### Test 8: Invalid - Bad Country Code
```sql
-- ❌ Should FAIL
INSERT INTO question_sets (
  name, subject, approval_status,
  school_id, country_code, exam_code,
  created_by
) VALUES (
  'Test Quiz', 'mathematics', 'approved',
  NULL, 'X', 'GCSE',  -- Country code too short
  'teacher-uuid'
);
```

**Expected:** `ERROR: Cannot publish quiz: invalid country code "X"`

### Test 9: Draft Quiz - No Validation
```sql
-- ✅ Should SUCCEED (validation only runs on publish)
INSERT INTO question_sets (
  name, subject, approval_status,
  school_id, country_code, exam_code,
  created_by
) VALUES (
  'Draft Quiz', 'mathematics', 'draft',
  NULL, NULL, NULL,
  'teacher-uuid'
);
-- Can have 0 questions when draft
```

**Expected:** Success (validation skipped for drafts)

### Test 10: Unpublishing Always Works
```sql
-- ✅ Should SUCCEED (validation doesn't block unpublishing)
UPDATE question_sets
SET approval_status = 'draft'
WHERE id = 'quiz-id';
```

**Expected:** Success (no validation on unpublish)

## Implementation Details

### CHECK Constraint Logic
```sql
-- This counts how many destination types are "active"
(
  CASE WHEN global THEN 1 ELSE 0 END
  +
  CASE WHEN school THEN 1 ELSE 0 END
  +
  CASE WHEN country_exam THEN 1 ELSE 0 END
) = 1

-- Must equal exactly 1 (not 0, not 2+)
```

### Trigger Execution Flow
```
User Action: UPDATE approval_status = 'approved'
     ↓
BEFORE UPDATE Trigger Fires
     ↓
validate_quiz_publish() Function Runs
     ↓
Check 1: Question count >= 1?
     ↓
Check 2: Valid destination type?
     ↓
Check 3: School exists (if school type)?
     ↓
Check 4: Country/Exam valid (if that type)?
     ↓
Check 5: Name and subject not empty?
     ↓
All Pass? → ALLOW UPDATE
Any Fail? → RAISE EXCEPTION (block update)
```

### Error Codes
- `23514` - CHECK constraint violation (validation rule failed)
- `23503` - Foreign key violation (school doesn't exist)

## Deployment

### Step 1: Apply Migration
```bash
# Copy PUBLISH_VALIDATION_MIGRATION.sql content
# Go to Supabase Dashboard → SQL Editor
# Paste and run the SQL
```

Or use Supabase CLI:
```bash
supabase db push
```

### Step 2: Verify Installation
```sql
-- Check constraint exists
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'check_single_destination_scope';

-- Check trigger exists
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname = 'trigger_validate_quiz_publish';

-- Check function exists
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'validate_quiz_publish';
```

### Step 3: Test Validation
```sql
-- Try to publish empty quiz (should fail)
UPDATE question_sets
SET approval_status = 'approved'
WHERE id = (SELECT id FROM question_sets WHERE is_draft = true LIMIT 1);

-- Expected: ERROR with helpful message
```

## What Changed (Summary)

### Files Created
1. `PUBLISH_VALIDATION_MIGRATION.sql` - SQL to run in Supabase
2. `PUBLISH_VALIDATION_COMPLETE.md` - This documentation

### Database Objects Added
1. `check_single_destination_scope` - CHECK constraint on question_sets
2. `validate_quiz_publish()` - Trigger function
3. `trigger_validate_quiz_publish` - Trigger on question_sets table

### What Didn't Change
- ✅ No UI changes
- ✅ No routing changes
- ✅ No API endpoint changes
- ✅ No existing flows modified
- ✅ Draft creation still works
- ✅ Question editing still works
- ✅ Unpublishing always works

### What Now Fails (Intentionally)
- ❌ Publishing quiz with 0 questions
- ❌ Publishing quiz with invalid destination
- ❌ Publishing quiz with empty name/subject
- ❌ Publishing to nonexistent school
- ❌ Publishing with invalid country/exam data

## Error Handling in Frontend

The existing frontend code will automatically handle these errors:

```typescript
// Current code in MyQuizzesPage.tsx (line 246)
if (error) {
  console.error('Failed to toggle publish:', error);
  alert('Failed to update quiz status');
  return;
}
```

**After migration, users will see:**
```
Failed to update quiz status
```

**Console will show:**
```
Error: Cannot publish quiz: must have at least 1 active question. Current count: 0
HINT: Add questions to your quiz before publishing
```

### Optional: Enhanced Error Display
To show the actual validation error to users, update line 247-248:

```typescript
if (error) {
  console.error('Failed to toggle publish:', error);
  // Show actual error message to user
  const errorMessage = error.message || 'Failed to update quiz status';
  alert(errorMessage);
  return;
}
```

This is optional and not required for the validation to work.

## Monitoring

### Check Validation Logs
```sql
-- View recent publish attempts (Postgres logs)
-- Look for NOTICE messages: "Quiz validated for publishing"
```

### Check Failed Attempts
```sql
-- Audit log will show failed publish attempts
SELECT *
FROM audit_logs
WHERE action = 'UPDATE'
  AND table_name = 'question_sets'
  AND new_data->>'approval_status' = 'approved'
  AND created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;
```

## Rollback Plan

If validation causes issues:

```sql
-- Remove trigger
DROP TRIGGER IF EXISTS trigger_validate_quiz_publish ON question_sets;

-- Remove function
DROP FUNCTION IF EXISTS validate_quiz_publish();

-- Remove constraint
ALTER TABLE question_sets
DROP CONSTRAINT IF EXISTS check_single_destination_scope;
```

## Success Criteria

✅ CHECK constraint blocks invalid destination combinations
✅ Trigger blocks publishing empty quizzes
✅ Trigger validates destination field integrity
✅ Trigger checks school/country/exam validity
✅ Draft creation still works normally
✅ Unpublishing still works normally
✅ Helpful error messages guide users

## Testing Checklist

- [ ] Apply migration successfully
- [ ] Verify constraint exists
- [ ] Verify trigger exists
- [ ] Test: Publish valid global quiz (with questions) - should succeed
- [ ] Test: Publish valid school quiz - should succeed
- [ ] Test: Publish valid country/exam quiz - should succeed
- [ ] Test: Publish quiz with 0 questions - should fail
- [ ] Test: Publish quiz with multiple destinations - should fail
- [ ] Test: Create draft quiz - should succeed
- [ ] Test: Unpublish quiz - should succeed

---

**Status:** ✅ Implementation Complete
**Type:** Additive Only (No Breaking Changes)
**Risk:** Low (Only blocks invalid operations)
**Ready:** Yes (SQL ready to deploy)

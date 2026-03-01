# Backend Publish Validation - Quick Reference

## What Was Added

**Invisible safety layer that prevents publishing invalid quizzes**

## The 5 Validation Rules

1. **Minimum Questions:** Quiz must have ≥ 1 active question
2. **Single Destination:** Exactly ONE of: global, school, or country/exam
3. **School Validation:** If school type, school_id must reference valid school
4. **Country/Exam Validation:** If country/exam type, both fields required and valid
5. **Basic Data:** Name and subject must not be empty

## What Gets Blocked

```
❌ Publishing with 0 questions
❌ Publishing to invalid/deleted school
❌ Publishing with multiple destinations
❌ Publishing with empty name/subject
❌ Publishing with invalid country/exam data
```

## What Still Works

```
✅ Creating drafts (no validation)
✅ Editing questions
✅ Unpublishing quizzes
✅ All existing flows
```

## Deployment

### 1. Run SQL Migration
Copy contents of `PUBLISH_VALIDATION_MIGRATION.sql` and run in Supabase SQL Editor.

### 2. Verify
```sql
-- Check constraint exists
SELECT conname FROM pg_constraint WHERE conname = 'check_single_destination_scope';

-- Check trigger exists
SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_validate_quiz_publish';
```

### 3. Test
Try publishing a draft quiz with 0 questions - should fail with helpful error message.

## Database Objects Created

1. `check_single_destination_scope` - CHECK constraint
2. `validate_quiz_publish()` - Trigger function
3. `trigger_validate_quiz_publish` - BEFORE trigger

## Error Examples

### No Questions
```
ERROR: Cannot publish quiz: must have at least 1 active question. Current count: 0
HINT: Add questions to your quiz before publishing
```

### Invalid Destination
```
ERROR: Cannot publish quiz: invalid destination configuration
HINT: Quiz must have exactly one destination type (global, school, or country/exam)
```

### School Doesn't Exist
```
ERROR: Cannot publish quiz: selected school (ID: abc-123) does not exist
HINT: Select a valid school before publishing
```

## Rollback (If Needed)

```sql
DROP TRIGGER IF EXISTS trigger_validate_quiz_publish ON question_sets;
DROP FUNCTION IF EXISTS validate_quiz_publish();
ALTER TABLE question_sets DROP CONSTRAINT IF EXISTS check_single_destination_scope;
```

## Testing Checklist

- [ ] Run migration SQL
- [ ] Verify objects created
- [ ] Test: Publish quiz with questions → succeeds
- [ ] Test: Publish quiz without questions → fails
- [ ] Test: Create draft → succeeds
- [ ] Test: Unpublish → succeeds

---

**Impact:** Server-side only, no UI changes
**Risk:** Low - only blocks invalid operations
**Status:** Ready to deploy

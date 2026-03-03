# Country Code and Exam Code Columns - Status

## MIGRATION EXISTS ✅

The migration file **20260211221424_add_country_exam_fields_to_question_sets.sql** already exists and adds:

1. **country_code** (text, nullable)
   - ISO country code: GB, GH, US, CA, NG, IN, AU, INTL
   - NULL = global quiz

2. **exam_code** (text, nullable)
   - Exam system code: GCSE, A-Level, WASSCE, etc.
   - NULL = global quiz or not exam-specific

3. **description** (text, nullable)
   - Quiz description for preview cards

4. **timer_seconds** (integer, nullable)
   - Optional time limit per quiz

## QUERY VERIFICATION

The query you mentioned should work:
```sql
SELECT id, title, country_code, exam_code
FROM question_sets
WHERE id = '87f1c5ba-359a-403b-9644-d9f55d08ce03';
```

## IF COLUMNS ARE MISSING

If you're getting an error that these columns don't exist, it means the migration hasn't been applied to your database yet.

### Solution:
1. Open Supabase SQL Editor
2. Run the migration file: `supabase/migrations/20260211221424_add_country_exam_fields_to_question_sets.sql`
3. The columns will be created

### Alternative (Manual):
```sql
-- Add columns if missing
ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS country_code text;
ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS exam_code text;
ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS timer_seconds integer;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_question_sets_country_exam_approval
  ON question_sets(country_code, exam_code, approval_status, created_at DESC);
```

## CHECKING IF APPLIED

Run this query to check if columns exist:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'question_sets'
  AND column_name IN ('country_code', 'exam_code', 'description', 'timer_seconds')
ORDER BY column_name;
```

Expected result: 4 rows showing the columns exist.

## STATUS

- ✅ Migration file exists in project
- ✅ Migration uses IF NOT EXISTS (safe to run multiple times)
- ✅ Columns have proper indexes
- ✅ Documentation added as SQL comments

**Action Required**: Ensure migration has been applied to database.

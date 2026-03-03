# Single Quiz Taxonomy Update - Instructions

## Quiz to Update

**Quiz ID:** `87f1c5ba-359a-403b-9644-d9f55d08ce03`
**Title:** AQA A Level Business Studies Objectives Past Questions 2
**Current State:** country_code='UK', exam_code='A_LEVEL'
**Target State:** country_code='GB', exam_code='A_LEVEL'

## Why This Update?

This quiz has an incorrect country code 'UK' which should be 'GB' (the ISO standard code for United Kingdom/Great Britain).

## How to Apply

### Option 1: Via Supabase SQL Editor (Recommended)

1. Open your Supabase Dashboard
2. Go to SQL Editor
3. Copy and paste the following SQL:

```sql
-- View current state
SELECT
  id,
  title,
  country_code,
  exam_code,
  school_id,
  approval_status,
  is_active
FROM question_sets
WHERE id = '87f1c5ba-359a-403b-9644-d9f55d08ce03';

-- Apply update
UPDATE question_sets
SET country_code = 'GB'
WHERE id = '87f1c5ba-359a-403b-9644-d9f55d08ce03'
  AND country_code = 'UK';

-- Verify update
SELECT
  id,
  title,
  country_code,
  exam_code,
  school_id,
  approval_status,
  CASE
    WHEN country_code = 'GB' AND exam_code = 'A_LEVEL' THEN 'SUCCESS'
    ELSE 'FAILED'
  END as status
FROM question_sets
WHERE id = '87f1c5ba-359a-403b-9644-d9f55d08ce03';
```

4. Run the query
5. Verify the result shows `status = 'SUCCESS'`

### Option 2: Via psql Command Line

```bash
psql "$DATABASE_URL" <<EOF
UPDATE question_sets
SET country_code = 'GB'
WHERE id = '87f1c5ba-359a-403b-9644-d9f55d08ce03'
  AND country_code = 'UK';

SELECT
  country_code,
  exam_code,
  title
FROM question_sets
WHERE id = '87f1c5ba-359a-403b-9644-d9f55d08ce03';
EOF
```

## Expected Results

### Before Update
```
id: 87f1c5ba-359a-403b-9644-d9f55d08ce03
title: AQA A Level Business Studies Objectives Past Questions 2
country_code: UK
exam_code: A_LEVEL
school_id: NULL
approval_status: approved
is_active: true
```

### After Update
```
id: 87f1c5ba-359a-403b-9644-d9f55d08ce03
title: AQA A Level Business Studies Objectives Past Questions 2
country_code: GB ← CHANGED
exam_code: A_LEVEL
school_id: NULL
approval_status: approved
is_active: true
```

## Verification Steps

### 1. Database Check
Run this query to confirm:
```sql
SELECT country_code, exam_code, title
FROM question_sets
WHERE id = '87f1c5ba-359a-403b-9644-d9f55d08ce03';
```

Expected result:
- country_code = 'GB'
- exam_code = 'A_LEVEL'

### 2. UI Check (if applicable)

If your application has routing based on country_code, verify:
- Quiz no longer appears under 'UK' routes
- Quiz appears under 'GB' routes
- Quiz is playable
- All questions load correctly

### 3. Other Fields Unchanged

Verify these fields remain unchanged:
- ✅ approval_status = 'approved'
- ✅ is_active = true
- ✅ school_id = NULL
- ✅ exam_code = 'A_LEVEL' (already correct)
- ✅ title, description, questions (all unchanged)

## Rollback (if needed)

If something goes wrong, revert with:

```sql
UPDATE question_sets
SET country_code = 'UK'
WHERE id = '87f1c5ba-359a-403b-9644-d9f55d08ce03'
  AND country_code = 'GB';
```

## Why RLS Blocked the Script

The Node.js script using the anon key couldn't update because:
1. Anon key = unauthenticated access
2. RLS policies require authentication for UPDATE
3. Only the creator or admin can update question_sets
4. SQL Editor uses service role (bypasses RLS)

## Next Steps After Successful Update

1. ✅ Verify quiz displays correctly in UI
2. ✅ Test quiz playability
3. ✅ Check routing works with 'GB' code
4. ✅ If all successful, proceed with remaining 7 quizzes

## Remaining Quizzes (After This One)

After successfully updating this quiz, these 7 quizzes need GB/A_LEVEL mapping:

1. 47ed7d9f-9759-4a87-ac4e-02c6dc27dce8
2. f5486277-5792-4685-89e3-360ddc9ead24
3. 47b897e5-5054-4492-96b4-d7b87f1ae0bd
4. 09885113-e14a-4f56-abc0-ec7115b13f5b
5. e877d12b-4318-423a-bd0b-35c5d2617b86
6. ad9d37df-091d-43e9-9474-48dd7067f134
7. 3312edb0-57de-46b6-8215-3770e3bb3e3c

See `APPLY_APPROVED_TAXONOMY_MAPPINGS.sql` for bulk update script.

## Safety Notes

- ✅ This update only affects 1 quiz
- ✅ UPDATE uses WHERE clause with specific ID
- ✅ Additional safety check: `AND country_code = 'UK'`
- ✅ Won't affect any other quizzes
- ✅ Rollback available
- ✅ No triggers will interfere (only updated_at trigger exists)

## Questions?

If the update fails or behaves unexpectedly:
1. Check RLS policies on question_sets table
2. Verify quiz ownership (created_by field)
3. Ensure you're using SQL Editor (service role)
4. Check error messages for clues

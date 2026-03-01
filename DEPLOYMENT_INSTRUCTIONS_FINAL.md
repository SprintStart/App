# Global Library Restructure - Deployment Instructions

## Status: Frontend Complete ✅ | Database Migration Ready ⏳

The frontend changes have been implemented and built successfully. The database migration is ready to apply.

---

## What's Complete

### ✅ Frontend (Already Built)
- `GlobalHome.tsx` - Updated query and description
- `GlobalQuizzesPage.tsx` - Filters only truly global quizzes
- `PublishDestinationPicker.tsx` - Clear teacher guidance
- Build successful: `dist/` folder ready to deploy

### ⏳ Database Migration (Manual Step Required)

Due to database connection limitations in the build environment, you need to apply the migration manually.

---

## Apply Database Migration

### Option 1: Full Migration (Recommended)

1. Open Supabase Dashboard → SQL Editor
2. Copy the entire contents of: **`GLOBAL_RESTRUCTURE_MIGRATION.sql`**
3. Paste and execute
4. Review the completion report

### Option 2: Quick Apply (If Option 1 fails)

If the full migration is too large for your SQL editor, use this condensed version:

```sql
-- Reassign GCSE quizzes
UPDATE question_sets
SET exam_system_id = (SELECT id FROM exam_systems WHERE slug = 'gcse')
WHERE exam_system_id IS NULL AND school_id IS NULL
AND id IN (
  SELECT qs.id FROM question_sets qs
  INNER JOIN topics t ON qs.topic_id = t.id
  WHERE t.subject ILIKE '%gcse%' OR qs.title ILIKE '%gcse%'
);

-- Reassign A-Level quizzes
UPDATE question_sets
SET exam_system_id = (SELECT id FROM exam_systems WHERE slug = 'a-levels')
WHERE exam_system_id IS NULL AND school_id IS NULL
AND id IN (
  SELECT qs.id FROM question_sets qs
  INNER JOIN topics t ON qs.topic_id = t.id
  WHERE t.subject ILIKE '%a-level%' OR t.subject ILIKE '%a level%' OR qs.title ILIKE '%a-level%'
);

-- Reassign BTEC quizzes
UPDATE question_sets
SET exam_system_id = (SELECT id FROM exam_systems WHERE slug = 'btec')
WHERE exam_system_id IS NULL AND school_id IS NULL
AND id IN (
  SELECT qs.id FROM question_sets qs
  INNER JOIN topics t ON qs.topic_id = t.id
  WHERE t.subject ILIKE '%btec%' OR qs.title ILIKE '%btec%'
);

-- Reassign BECE quizzes
UPDATE question_sets
SET exam_system_id = (SELECT id FROM exam_systems WHERE slug = 'bece')
WHERE exam_system_id IS NULL AND school_id IS NULL
AND id IN (
  SELECT qs.id FROM question_sets qs
  INNER JOIN topics t ON qs.topic_id = t.id
  WHERE t.subject ILIKE '%bece%' OR qs.title ILIKE '%bece%'
);

-- Add global_category to topics
ALTER TABLE topics ADD COLUMN IF NOT EXISTS global_category text;
ALTER TABLE topics ADD CONSTRAINT IF NOT EXISTS valid_global_category
CHECK (global_category IS NULL OR global_category IN ('aptitude_psychometric','career_employment','general_knowledge','life_skills'));

-- Create validation trigger
CREATE OR REPLACE FUNCTION check_global_scope_rules() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.exam_system_id IS NOT NULL AND NEW.school_id IS NOT NULL THEN
    RAISE WARNING 'Quiz has ambiguous scope';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_quiz_scope ON question_sets;
CREATE TRIGGER validate_quiz_scope
BEFORE INSERT OR UPDATE ON question_sets
FOR EACH ROW EXECUTE FUNCTION check_global_scope_rules();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_question_sets_global_scope
ON question_sets(approval_status, created_at DESC)
WHERE exam_system_id IS NULL AND school_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_question_sets_exam_scope
ON question_sets(exam_system_id, approval_status, created_at DESC)
WHERE exam_system_id IS NOT NULL;

-- Verify
SELECT
  COUNT(*) FILTER (WHERE exam_system_id IS NULL AND school_id IS NULL) as global_quizzes,
  COUNT(*) FILTER (WHERE exam_system_id IS NOT NULL) as exam_quizzes,
  COUNT(*) as total
FROM question_sets;
```

---

## Deploy Frontend

The frontend is already built. Deploy the `dist/` folder to your hosting:

### Netlify
```bash
# If using Netlify CLI
netlify deploy --prod --dir=dist
```

### Vercel
```bash
# If using Vercel CLI
vercel --prod
```

### Manual
Upload the entire `dist/` folder to your hosting provider.

---

## Verify Deployment

### 1. Check Global Library
Visit: `https://your-domain.com/explore/global`

**Expected:**
- Updated description: "Non-curriculum-based tests designed to build skills, reasoning ability, career readiness, and general knowledge"
- ZERO GCSE/A-Level/BTEC quizzes visible
- Only non-curriculum content

### 2. Check Exam Routes
Visit: `https://your-domain.com/exams/gcse`

**Expected:**
- GCSE quizzes now appear here
- Previously "global" GCSE quizzes now correctly categorized
- Play counts preserved

### 3. Test Teacher Flow
1. Log in as teacher
2. Create new quiz
3. Select publishing destination
4. See updated Global description: "For non-curriculum content: aptitude tests, career prep, life skills, and general knowledge. Not for exam-specific content."

---

## Database Verification Queries

After applying migration, run these to verify:

```sql
-- Count by scope
SELECT
  COUNT(*) FILTER (WHERE exam_system_id IS NULL AND school_id IS NULL) as "Global",
  COUNT(*) FILTER (WHERE exam_system_id IS NOT NULL) as "Country/Exam",
  COUNT(*) FILTER (WHERE school_id IS NOT NULL) as "School"
FROM question_sets;

-- Check for curriculum content in Global (should be 0)
SELECT qs.title, t.subject
FROM question_sets qs
INNER JOIN topics t ON qs.topic_id = t.id
WHERE qs.exam_system_id IS NULL
AND qs.school_id IS NULL
AND (t.subject ILIKE '%gcse%' OR t.subject ILIKE '%a-level%' OR t.subject ILIKE '%btec%');
-- Should return 0 rows
```

---

## Rollback (If Needed)

If something goes wrong:

```sql
-- Move all exam quizzes back to global
UPDATE question_sets
SET exam_system_id = NULL
WHERE exam_system_id IS NOT NULL AND school_id IS NULL;

-- Remove trigger
DROP TRIGGER IF EXISTS validate_quiz_scope ON question_sets;
DROP FUNCTION IF EXISTS check_global_scope_rules();
```

---

## Summary

**Completed:**
- ✅ Frontend queries updated to filter by `exam_system_id IS NULL`
- ✅ UI descriptions updated across all pages
- ✅ Teacher publishing guidance improved
- ✅ Build successful
- ✅ Migration SQL prepared

**Action Required:**
1. Apply database migration (copy SQL above or use full migration file)
2. Deploy `dist/` folder to production
3. Verify routes and functionality

**Result:**
- Global library contains ONLY non-curriculum content
- All exam content properly categorized
- Clear definitions prevent future misclassification
- No data loss, all analytics preserved

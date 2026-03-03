# Global Quiz Taxonomy Correction - Quick Start Guide

## What Changed?

The Global Quiz Library now contains ONLY non-curriculum content organized into 4 categories:

1. 🧠 **Aptitude & Psychometric Tests** - Reasoning, logic, assessments
2. 💼 **Career & Employment Prep** - Interviews, workplace skills, CVs
3. 🌍 **General Knowledge & Trivia** - Capitals, sports, history, billionaire quizzes
4. 🎯 **Life Skills** - Driving theory, digital literacy, study skills

## Quick Deploy (3 Steps)

### 1. Run the SQL Script (2 minutes)
```bash
# In Supabase Dashboard > SQL Editor
# Copy and paste: GLOBAL_QUIZ_TAXONOMY_CORRECTION.sql
# Click Run
```

### 2. Check for Misclassified Quizzes (1 minute)
```sql
SELECT * FROM misclassified_global_quizzes;
```

If any rows returned, manually reassign them:
```sql
-- Example: Move GCSE quiz to UK/GCSE
UPDATE question_sets
SET
  country_id = (SELECT id FROM countries WHERE slug = 'uk'),
  exam_system_id = (SELECT id FROM exam_systems WHERE slug = 'gcse')
WHERE id = 'your-quiz-id-here';
```

### 3. Verify Zero Curriculum Content in Global
```sql
SELECT COUNT(*) FROM quiz_scope_classification
WHERE possibly_misclassified = true AND approval_status = 'approved';
-- Should return: 0
```

## What It Does

**Database:**
- Adds `global_category` column to topics
- Auto-categorizes existing global topics by name pattern
- Creates validation trigger to prevent future misclassification
- Adds performance indexes for fast filtering

**UI:**
- Category filter dropdown on Global Quiz Library page
- Category icons on quiz cards
- Updated description text
- No changes to country/exam/school pages

## What It Does NOT Do

- Delete any quizzes
- Reset analytics or play counts
- Change routing logic
- Modify publishing workflow
- Break any existing links
- Redesign schema

## Files Modified

- `src/pages/global/GlobalQuizzesPage.tsx` - Added category filter
- `src/pages/global/GlobalHome.tsx` - Updated TypeScript interface

## Files Created

- `GLOBAL_QUIZ_TAXONOMY_CORRECTION.sql` - Database migration script
- `GLOBAL_QUIZ_TAXONOMY_CORRECTION_COMPLETE.md` - Full documentation
- `GLOBAL_TAXONOMY_QUICK_START.md` - This file

## Validation Checklist

After deployment, verify:

- [ ] Global page loads
- [ ] Category filter appears
- [ ] No A-Level/GCSE/BECE quizzes in Global
- [ ] Country/exam pages unchanged
- [ ] Quiz play still works
- [ ] Analytics still working

## Scope Rules (Enforced by Database)

Each quiz must be **exactly one** of:

1. **GLOBAL**: `country_id IS NULL` AND `exam_system_id IS NULL` AND `school_id IS NULL`
2. **COUNTRY/EXAM**: `country_id` OR `exam_system_id` set, `school_id IS NULL`
3. **SCHOOL**: `school_id IS NOT NULL`

Database trigger prevents violations automatically.

## Rollback (If Needed)

```sql
-- Remove global_category column
ALTER TABLE topics DROP COLUMN IF EXISTS global_category CASCADE;

-- Drop validation trigger
DROP TRIGGER IF EXISTS enforce_quiz_scope ON question_sets;
DROP FUNCTION IF EXISTS validate_quiz_scope();

-- Drop views
DROP VIEW IF EXISTS misclassified_global_quizzes CASCADE;
DROP VIEW IF EXISTS quiz_scope_classification CASCADE;

-- Drop indexes
DROP INDEX IF EXISTS idx_topics_global_category;
DROP INDEX IF EXISTS idx_topics_global_category_active;
DROP INDEX IF EXISTS idx_question_sets_global_scope;
DROP INDEX IF EXISTS idx_question_sets_country_exam_scope;
DROP INDEX IF EXISTS idx_question_sets_school_scope;
```

## Support

For questions or issues, check `GLOBAL_QUIZ_TAXONOMY_CORRECTION_COMPLETE.md` for full documentation.

---

**Status:** Ready for deployment
**Risk Level:** Low (additive changes only)
**Estimated Time:** 5 minutes

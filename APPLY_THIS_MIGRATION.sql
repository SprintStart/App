/*
  # Add Destination Scope and Fix Quiz Publishing Leakage

  ## Root Cause
  Quizzes published to specific exam systems (GH/BECE, UK/GCSE, etc.) appear in wrong destinations
  because listing queries don't filter by country_code/exam_code fields.

  ## Changes

  ### 1. Add destination_scope Field
  - Add explicit `destination_scope` enum to question_sets table
  - Values: 'GLOBAL', 'SCHOOL_WALL', 'COUNTRY_EXAM'
  - Single source of truth for where a quiz should appear

  ### 2. Add Database Constraints
  - GLOBAL scope: school_id IS NULL, country_code IS NULL, exam_code IS NULL
  - SCHOOL_WALL scope: school_id IS NOT NULL, country_code IS NULL, exam_code IS NULL
  - COUNTRY_EXAM scope: country_code IS NOT NULL, exam_code IS NOT NULL, school_id IS NULL

  ### 3. Backfill Existing Data
  - Classify all existing quizzes into correct scope
  - Fix any quizzes with invalid destination combinations

  ### 4. Add Performance Indexes
  - Index on destination_scope for fast filtering
  - Composite indexes for each scope's query pattern

  ### 5. Security
  - No RLS changes (quizzes already have proper policies)
  - Constraints enforce data integrity at DB level

  ## Testing Required
  - Verify GH/BECE quizzes only appear on GH/BECE pages
  - Verify UK/GCSE quizzes only appear on UK/GCSE pages
  - Verify global quizzes only appear on /explore
  - Verify school quizzes only appear on /{school_slug}

  ## INSTRUCTIONS
  1. Go to Supabase Dashboard → SQL Editor
  2. Paste this entire file
  3. Click "Run"
  4. Verify success message
*/

-- Step 1: Add destination_scope column
ALTER TABLE question_sets
ADD COLUMN IF NOT EXISTS destination_scope text;

-- Step 2: Backfill destination_scope for existing records
-- GLOBAL: school_id IS NULL AND (country_code IS NULL OR country_code = '')
UPDATE question_sets
SET destination_scope = 'GLOBAL'
WHERE destination_scope IS NULL
  AND school_id IS NULL
  AND (country_code IS NULL OR country_code = '');

-- SCHOOL_WALL: school_id IS NOT NULL
UPDATE question_sets
SET destination_scope = 'SCHOOL_WALL'
WHERE destination_scope IS NULL
  AND school_id IS NOT NULL;

-- COUNTRY_EXAM: country_code IS NOT NULL AND exam_code IS NOT NULL
UPDATE question_sets
SET destination_scope = 'COUNTRY_EXAM'
WHERE destination_scope IS NULL
  AND country_code IS NOT NULL
  AND country_code != ''
  AND exam_code IS NOT NULL
  AND exam_code != '';

-- Handle edge case: quizzes with country but no exam (invalid, mark as GLOBAL)
UPDATE question_sets
SET destination_scope = 'GLOBAL',
    country_code = NULL,
    exam_code = NULL,
    exam_system_id = NULL
WHERE destination_scope IS NULL
  AND country_code IS NOT NULL
  AND (exam_code IS NULL OR exam_code = '');

-- Handle edge case: remaining NULL values (should not exist, mark as GLOBAL)
UPDATE question_sets
SET destination_scope = 'GLOBAL'
WHERE destination_scope IS NULL;

-- Step 3: Make destination_scope NOT NULL with check constraint
ALTER TABLE question_sets
ALTER COLUMN destination_scope SET NOT NULL;

ALTER TABLE question_sets
ADD CONSTRAINT question_sets_destination_scope_check
  CHECK (destination_scope IN ('GLOBAL', 'SCHOOL_WALL', 'COUNTRY_EXAM'));

-- Step 4: Add validation constraints for each scope
-- These constraints enforce the rules defined in requirements

-- GLOBAL quizzes must have NULL destination fields
ALTER TABLE question_sets
ADD CONSTRAINT question_sets_global_scope_check
  CHECK (
    destination_scope != 'GLOBAL' OR (
      school_id IS NULL AND
      (country_code IS NULL OR country_code = '') AND
      (exam_code IS NULL OR exam_code = '')
    )
  );

-- SCHOOL_WALL quizzes must have school_id and NULL country/exam
ALTER TABLE question_sets
ADD CONSTRAINT question_sets_school_scope_check
  CHECK (
    destination_scope != 'SCHOOL_WALL' OR (
      school_id IS NOT NULL AND
      (country_code IS NULL OR country_code = '') AND
      (exam_code IS NULL OR exam_code = '')
    )
  );

-- COUNTRY_EXAM quizzes must have country_code AND exam_code, NULL school_id
ALTER TABLE question_sets
ADD CONSTRAINT question_sets_country_exam_scope_check
  CHECK (
    destination_scope != 'COUNTRY_EXAM' OR (
      country_code IS NOT NULL AND
      country_code != '' AND
      exam_code IS NOT NULL AND
      exam_code != '' AND
      school_id IS NULL
    )
  );

-- Step 5: Add performance indexes
-- Index for fast destination scope filtering
CREATE INDEX IF NOT EXISTS idx_question_sets_destination_scope_approved
  ON question_sets(destination_scope, approval_status, created_at DESC)
  WHERE is_active = true;

-- Index for GLOBAL quiz listing (optimize /explore)
CREATE INDEX IF NOT EXISTS idx_question_sets_global_listing
  ON question_sets(approval_status, created_at DESC)
  WHERE is_active = true
    AND destination_scope = 'GLOBAL';

-- Index for COUNTRY_EXAM quiz listing (optimize /exams/{exam}/{subject})
CREATE INDEX IF NOT EXISTS idx_question_sets_country_exam_listing
  ON question_sets(country_code, exam_code, approval_status, created_at DESC)
  WHERE is_active = true
    AND destination_scope = 'COUNTRY_EXAM';

-- Index for SCHOOL_WALL quiz listing (optimize /{school_slug})
CREATE INDEX IF NOT EXISTS idx_question_sets_school_wall_listing
  ON question_sets(school_id, approval_status, created_at DESC)
  WHERE is_active = true
    AND destination_scope = 'SCHOOL_WALL';

-- Step 6: Create helper function for validation (used by app)
CREATE OR REPLACE FUNCTION validate_destination_scope(
  p_destination_scope text,
  p_school_id uuid,
  p_country_code text,
  p_exam_code text
) RETURNS boolean AS $$
BEGIN
  -- Validate GLOBAL scope
  IF p_destination_scope = 'GLOBAL' THEN
    RETURN p_school_id IS NULL
       AND (p_country_code IS NULL OR p_country_code = '')
       AND (p_exam_code IS NULL OR p_exam_code = '');
  END IF;

  -- Validate SCHOOL_WALL scope
  IF p_destination_scope = 'SCHOOL_WALL' THEN
    RETURN p_school_id IS NOT NULL
       AND (p_country_code IS NULL OR p_country_code = '')
       AND (p_exam_code IS NULL OR p_exam_code = '');
  END IF;

  -- Validate COUNTRY_EXAM scope
  IF p_destination_scope = 'COUNTRY_EXAM' THEN
    RETURN p_country_code IS NOT NULL
       AND p_country_code != ''
       AND p_exam_code IS NOT NULL
       AND p_exam_code != ''
       AND p_school_id IS NULL;
  END IF;

  -- Invalid scope
  RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER;

-- Step 7: Create view for data integrity monitoring
CREATE OR REPLACE VIEW question_sets_integrity_check AS
SELECT
  id,
  title,
  destination_scope,
  school_id,
  country_code,
  exam_code,
  approval_status,
  created_at,
  CASE
    WHEN destination_scope = 'GLOBAL' AND (school_id IS NOT NULL OR country_code IS NOT NULL OR exam_code IS NOT NULL)
      THEN 'INVALID: GLOBAL quiz has destination fields'
    WHEN destination_scope = 'SCHOOL_WALL' AND (school_id IS NULL OR country_code IS NOT NULL OR exam_code IS NOT NULL)
      THEN 'INVALID: SCHOOL_WALL quiz missing school_id or has country/exam'
    WHEN destination_scope = 'COUNTRY_EXAM' AND (country_code IS NULL OR exam_code IS NULL OR school_id IS NOT NULL)
      THEN 'INVALID: COUNTRY_EXAM quiz missing country/exam or has school_id'
    WHEN NOT EXISTS (
      SELECT 1 FROM topic_questions WHERE question_set_id = question_sets.id
    )
      THEN 'WARNING: Quiz has zero questions'
    ELSE 'OK'
  END as integrity_status
FROM question_sets
WHERE is_active = true;

-- Grant access to view for authenticated users and service role
GRANT SELECT ON question_sets_integrity_check TO authenticated, service_role;

-- Step 8: Add comment for documentation
COMMENT ON COLUMN question_sets.destination_scope IS
  'Defines where this quiz appears: GLOBAL (/explore), SCHOOL_WALL (/{school_slug}), COUNTRY_EXAM (/exams/{exam}/{subject})';

COMMENT ON CONSTRAINT question_sets_destination_scope_check ON question_sets IS
  'Ensures destination_scope is one of: GLOBAL, SCHOOL_WALL, COUNTRY_EXAM';

COMMENT ON CONSTRAINT question_sets_global_scope_check ON question_sets IS
  'GLOBAL quizzes must have NULL school_id, country_code, and exam_code';

COMMENT ON CONSTRAINT question_sets_school_scope_check ON question_sets IS
  'SCHOOL_WALL quizzes must have school_id and NULL country_code/exam_code';

COMMENT ON CONSTRAINT question_sets_country_exam_scope_check ON question_sets IS
  'COUNTRY_EXAM quizzes must have country_code AND exam_code, with NULL school_id';

-- Verification Query: Run this to see backfill results
SELECT
  destination_scope,
  COUNT(*) as quiz_count,
  COUNT(*) FILTER (WHERE approval_status = 'approved') as approved_count
FROM question_sets
GROUP BY destination_scope
ORDER BY destination_scope;

/*
  # Enforce Quiz Scope Locking Constraints

  Run this in your Supabase SQL Editor to add database-level validation
  that prevents quizzes from leaking between scopes.

  CRITICAL: This ensures:
  - GLOBAL quizzes have NULL country_code, exam_code, school_id
  - COUNTRY_EXAM quizzes have country_code + exam_code, NULL school_id
  - SCHOOL quizzes have school_id, NULL country_code and exam_code
  - destination_scope cannot be changed after creation
*/

-- Drop existing constraints if they exist
DO $$ BEGIN
  ALTER TABLE question_sets DROP CONSTRAINT IF EXISTS chk_global_scope_nulls;
  ALTER TABLE question_sets DROP CONSTRAINT IF EXISTS chk_country_exam_scope_required;
  ALTER TABLE question_sets DROP CONSTRAINT IF EXISTS chk_school_scope_required;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- GLOBAL scope: Must have NULL country_code, exam_code, school_id
ALTER TABLE question_sets
ADD CONSTRAINT chk_global_scope_nulls
CHECK (
  destination_scope != 'GLOBAL' OR (
    country_code IS NULL AND
    exam_code IS NULL AND
    school_id IS NULL
  )
);

-- COUNTRY_EXAM scope: Must have country_code AND exam_code, NULL school_id
ALTER TABLE question_sets
ADD CONSTRAINT chk_country_exam_scope_required
CHECK (
  destination_scope != 'COUNTRY_EXAM' OR (
    country_code IS NOT NULL AND
    exam_code IS NOT NULL AND
    school_id IS NULL
  )
);

-- SCHOOL_WALL scope: Must have school_id, NULL country_code and exam_code
ALTER TABLE question_sets
ADD CONSTRAINT chk_school_scope_required
CHECK (
  destination_scope != 'SCHOOL_WALL' OR (
    school_id IS NOT NULL AND
    country_code IS NULL AND
    exam_code IS NULL
  )
);

-- Create immutable trigger: prevent changing destination_scope after creation
CREATE OR REPLACE FUNCTION prevent_scope_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.destination_scope IS DISTINCT FROM NEW.destination_scope THEN
    RAISE EXCEPTION 'destination_scope cannot be changed after creation. Old: %, New: %', OLD.destination_scope, NEW.destination_scope;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trg_prevent_scope_change ON question_sets;

-- Create trigger
CREATE TRIGGER trg_prevent_scope_change
BEFORE UPDATE ON question_sets
FOR EACH ROW
EXECUTE FUNCTION prevent_scope_change();

-- Add index for scope validation queries
CREATE INDEX IF NOT EXISTS idx_question_sets_destination_scope_validation
ON question_sets(destination_scope, country_code, exam_code, school_id);

-- Verification: Count quizzes by scope
SELECT
  destination_scope,
  COUNT(*) as quiz_count,
  COUNT(*) FILTER (WHERE country_code IS NULL AND exam_code IS NULL AND school_id IS NULL) as correct_global,
  COUNT(*) FILTER (WHERE country_code IS NOT NULL AND exam_code IS NOT NULL AND school_id IS NULL) as correct_country_exam,
  COUNT(*) FILTER (WHERE school_id IS NOT NULL AND country_code IS NULL AND exam_code IS NULL) as correct_school
FROM question_sets
GROUP BY destination_scope;

SELECT 'Scope locking constraints applied successfully!' as status;

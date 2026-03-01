-- =====================================================
-- BACKEND PUBLISH VALIDATION SAFETY CHECKS
-- Copy this entire file and paste into Supabase SQL Editor
-- =====================================================

-- STEP 1: Add CHECK constraint for destination scope integrity
ALTER TABLE question_sets
DROP CONSTRAINT IF EXISTS check_single_destination_scope;

ALTER TABLE question_sets
ADD CONSTRAINT check_single_destination_scope
CHECK (
  (
    CASE WHEN school_id IS NULL AND country_code IS NULL AND exam_code IS NULL THEN 1 ELSE 0 END
    +
    CASE WHEN school_id IS NOT NULL AND country_code IS NULL AND exam_code IS NULL THEN 1 ELSE 0 END
    +
    CASE WHEN school_id IS NULL AND country_code IS NOT NULL AND exam_code IS NOT NULL THEN 1 ELSE 0 END
  ) = 1
);

-- STEP 2: Create validation function for publish
CREATE OR REPLACE FUNCTION validate_quiz_publish()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  question_count INTEGER;
  destination_type TEXT;
BEGIN
  IF NEW.approval_status = 'approved' THEN

    -- Check question count
    SELECT COUNT(*)
    INTO question_count
    FROM questions
    WHERE question_set_id = NEW.id
      AND is_active = true;

    IF question_count < 1 THEN
      RAISE EXCEPTION 'Cannot publish quiz: must have at least 1 active question. Current count: %', question_count
        USING HINT = 'Add questions to your quiz before publishing',
              ERRCODE = '23514';
    END IF;

    -- Determine destination type
    IF NEW.school_id IS NOT NULL AND NEW.country_code IS NULL AND NEW.exam_code IS NULL THEN
      destination_type := 'school';
    ELSIF NEW.school_id IS NULL AND NEW.country_code IS NOT NULL AND NEW.exam_code IS NOT NULL THEN
      destination_type := 'country_exam';
    ELSIF NEW.school_id IS NULL AND NEW.country_code IS NULL AND NEW.exam_code IS NULL THEN
      destination_type := 'global';
    ELSE
      RAISE EXCEPTION 'Cannot publish quiz: invalid destination configuration. School: %, Country: %, Exam: %',
        NEW.school_id, NEW.country_code, NEW.exam_code
        USING HINT = 'Quiz must have exactly one destination type (global, school, or country/exam)',
              ERRCODE = '23514';
    END IF;

    -- Validate school destination
    IF destination_type = 'school' THEN
      IF NOT EXISTS (SELECT 1 FROM schools WHERE id = NEW.school_id) THEN
        RAISE EXCEPTION 'Cannot publish quiz: selected school (ID: %) does not exist', NEW.school_id
          USING HINT = 'Select a valid school before publishing',
                ERRCODE = '23503';
      END IF;
    END IF;

    -- Validate country/exam destination
    IF destination_type = 'country_exam' THEN
      IF LENGTH(NEW.country_code) < 2 OR LENGTH(NEW.country_code) > 4 THEN
        RAISE EXCEPTION 'Cannot publish quiz: invalid country code "%"', NEW.country_code
          USING HINT = 'Country code must be 2-4 characters (e.g., GB, US, INTL)',
                ERRCODE = '23514';
      END IF;

      IF LENGTH(TRIM(NEW.exam_code)) < 1 THEN
        RAISE EXCEPTION 'Cannot publish quiz: exam code cannot be empty'
          USING HINT = 'Select a valid exam system before publishing',
                ERRCODE = '23514';
      END IF;
    END IF;

    -- Ensure quiz has a name
    IF NEW.name IS NULL OR LENGTH(TRIM(NEW.name)) < 1 THEN
      RAISE EXCEPTION 'Cannot publish quiz: name cannot be empty'
        USING HINT = 'Provide a descriptive name for your quiz',
              ERRCODE = '23514';
    END IF;

    -- Ensure quiz has a subject
    IF NEW.subject IS NULL OR LENGTH(TRIM(NEW.subject)) < 1 THEN
      RAISE EXCEPTION 'Cannot publish quiz: subject cannot be empty'
        USING HINT = 'Select a subject for your quiz',
              ERRCODE = '23514';
    END IF;

    RAISE NOTICE 'Quiz "%" (ID: %) validated for publishing. Type: %, Questions: %',
      NEW.name, NEW.id, destination_type, question_count;
  END IF;

  RETURN NEW;
END;
$$;

-- STEP 3: Attach trigger to question_sets
DROP TRIGGER IF EXISTS trigger_validate_quiz_publish ON question_sets;

CREATE TRIGGER trigger_validate_quiz_publish
  BEFORE INSERT OR UPDATE OF approval_status, school_id, country_code, exam_code
  ON question_sets
  FOR EACH ROW
  EXECUTE FUNCTION validate_quiz_publish();

-- STEP 4: Add helpful comments
COMMENT ON CONSTRAINT check_single_destination_scope ON question_sets IS
  'Ensures quiz has exactly ONE destination: global (all NULL), school (school_id only), or country/exam (country_code + exam_code)';

COMMENT ON FUNCTION validate_quiz_publish() IS
  'Validates quiz before publishing: checks question count >= 1, verifies destination integrity, and enforces business rules';

COMMENT ON TRIGGER trigger_validate_quiz_publish ON question_sets IS
  'Runs validation checks before publishing a quiz to prevent invalid data states';

-- STEP 5: Success message
DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Publish Validation Safety Checks Installed';
  RAISE NOTICE '==============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Active Protections:';
  RAISE NOTICE '  ✓ CHECK constraint: single destination scope';
  RAISE NOTICE '  ✓ Trigger: validate_quiz_publish()';
  RAISE NOTICE '  ✓ Minimum 1 question required';
  RAISE NOTICE '  ✓ Destination field integrity enforced';
  RAISE NOTICE '  ✓ School/Country/Exam validation active';
  RAISE NOTICE '';
END $$;

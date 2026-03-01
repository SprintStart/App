/*
  # Allow Custom Subjects for Teachers

  ## Changes Made
  
  1. **Remove Subject Constraint**
     - Drop the CHECK constraint on topics.subject that restricts to predefined subjects
     - Allow teachers to create custom subjects as free text
     - Teachers can now use any subject name they want

  2. **Benefits**
     - Teachers can create custom subjects for their specific curriculum
     - Preserves the actual custom subject name in the database
     - No more forcing custom subjects to 'other'

  ## Security
  - Existing RLS policies remain unchanged
  - Teachers can only create topics for themselves (created_by check)
*/

-- Drop the CHECK constraint that limits subjects to predefined list
ALTER TABLE topics DROP CONSTRAINT IF EXISTS valid_subject;

-- Add a NOT NULL constraint to ensure subject is always provided
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'topics_subject_not_null'
    AND table_name = 'topics'
  ) THEN
    ALTER TABLE topics ALTER COLUMN subject SET NOT NULL;
  END IF;
END $$;

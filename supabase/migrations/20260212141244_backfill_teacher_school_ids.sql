/*
  # Backfill Teacher School IDs
  
  1. Updates
    - Assigns teachers to schools based on email domain matching
    - Updates all existing teachers with NULL school_id
  
  2. Changes
    - Matches teacher email domains with school.email_domains
    - Sets school_id for matched teachers
    - Logs unmatched teachers for review
*/

-- Update teachers with matching school domains
UPDATE profiles 
SET school_id = schools.id
FROM schools
WHERE 
  profiles.role = 'teacher'
  AND profiles.school_id IS NULL
  AND schools.is_active = true
  AND EXISTS (
    SELECT 1 
    FROM unnest(schools.email_domains) AS domain
    WHERE profiles.email LIKE '%@' || domain
  );

-- Show updated count
DO $$
DECLARE
  updated_count INTEGER;
  remaining_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM profiles
  WHERE role = 'teacher' AND school_id IS NOT NULL;
  
  SELECT COUNT(*) INTO remaining_count
  FROM profiles
  WHERE role = 'teacher' AND school_id IS NULL;
  
  RAISE NOTICE 'Teachers assigned to schools: %', updated_count;
  RAISE NOTICE 'Teachers without school assignment: %', remaining_count;
END $$;

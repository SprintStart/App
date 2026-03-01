/*
  # Auto-assign Teachers to Schools on Signup
  
  1. New Functions
    - Function to automatically assign teachers to schools based on email domain
    - Runs when a new teacher profile is created or updated
  
  2. Changes
    - Creates trigger on profiles table
    - Matches email domain with school.email_domains
    - Sets school_id automatically
*/

-- Function to auto-assign teacher to school based on email domain
CREATE OR REPLACE FUNCTION auto_assign_teacher_to_school()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process teachers with no school_id
  IF NEW.role = 'teacher' AND NEW.school_id IS NULL THEN
    -- Find matching active school
    SELECT id INTO NEW.school_id
    FROM schools
    WHERE 
      is_active = true
      AND EXISTS (
        SELECT 1 
        FROM unnest(email_domains) AS domain
        WHERE NEW.email LIKE '%@' || domain
      )
    LIMIT 1;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for INSERT
DROP TRIGGER IF EXISTS trigger_auto_assign_teacher_school_insert ON profiles;
CREATE TRIGGER trigger_auto_assign_teacher_school_insert
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_teacher_to_school();

-- Create trigger for UPDATE (in case email changes)
DROP TRIGGER IF EXISTS trigger_auto_assign_teacher_school_update ON profiles;
CREATE TRIGGER trigger_auto_assign_teacher_school_update
  BEFORE UPDATE OF email, role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_teacher_to_school();

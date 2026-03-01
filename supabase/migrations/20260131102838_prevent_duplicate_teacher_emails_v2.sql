/*
  # Prevent Duplicate Teacher Email Signups

  ## Overview
  Adds database-level constraints to prevent duplicate teacher registrations.

  ## Changes
  
  ### 1. Create Profiles Table
  - Creates profiles table if it doesn't exist
  - Links to auth.users for authentication
  
  ### 2. Email Normalization Function
  - Creates a function to normalize emails (lowercase + trim)
  - Ensures consistent email comparisons
  
  ### 3. Email Column and Constraints
  - Add email column to profiles
  - Add unique constraint on email for teachers (case-insensitive)
  - Index for fast email lookups
  
  ### 4. Sync Function
  - Automatically sync email from auth.users to profiles
  - Backfill existing profiles
  
  ### 5. Security
  - Enable RLS on profiles table
  - Teachers can view and update their own profile
  - Admins can view all profiles
  
  ## Notes
  - Auth.users already enforces email uniqueness
  - This adds an additional layer of protection at the application level
  - Supports the frontend email validation check
*/

-- Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  role text DEFAULT 'teacher' CHECK (role IN ('teacher', 'admin')),
  email text,
  subscription_status text DEFAULT 'inactive' CHECK (subscription_status IN ('active', 'inactive', 'trial', 'cancelled')),
  subscription_end_date timestamptz,
  payment_method_id text,
  school_id uuid,
  school_name text,
  subjects_taught text[],
  date_of_birth date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create function to normalize email addresses
CREATE OR REPLACE FUNCTION normalize_email(email text)
RETURNS text AS $$
BEGIN
  IF email IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN lower(trim(email));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Backfill existing profiles with emails from auth.users
DO $$
BEGIN
  UPDATE profiles p
  SET email = u.email
  FROM auth.users u
  WHERE p.id = u.id AND p.email IS NULL;
EXCEPTION
  WHEN undefined_table THEN
    -- auth.users doesn't exist or profiles doesn't exist, skip
    NULL;
END $$;

-- Create unique index on normalized email for teachers
DROP INDEX IF EXISTS idx_profiles_teacher_email_unique;
CREATE UNIQUE INDEX idx_profiles_teacher_email_unique 
ON profiles (normalize_email(email)) 
WHERE role = 'teacher' AND email IS NOT NULL;

-- Add index for email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON profiles (lower(email)) WHERE email IS NOT NULL;

-- Create function to sync email from auth.users to profiles
CREATE OR REPLACE FUNCTION sync_profile_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Update profile email when auth.users email is set
  IF NEW.email IS NOT NULL THEN
    UPDATE profiles 
    SET email = NEW.email,
        updated_at = now()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to sync email from auth.users (if not already exists)
DO $$
BEGIN
  -- Drop trigger if it exists
  DROP TRIGGER IF EXISTS trigger_sync_profile_email ON auth.users;
  
  -- Create the trigger
  CREATE TRIGGER trigger_sync_profile_email
    AFTER INSERT OR UPDATE OF email ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION sync_profile_email();
EXCEPTION
  WHEN undefined_table THEN
    -- auth.users table doesn't exist in this schema, skip
    NULL;
END $$;
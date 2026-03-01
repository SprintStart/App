/*
  # Fix Authentication Profile Creation Trigger
  
  ## Problem
  Teacher signup is failing with 500 error: "Database error saving new user"
  
  Root cause: No trigger exists to CREATE a profile when a new user signs up.
  The existing `trigger_sync_profile_email` only UPDATES profiles, but the profile
  doesn't exist yet on signup.
  
  ## Solution
  1. Create `handle_new_user()` function that inserts a new profile when auth.users record is created
  2. Create trigger on auth.users AFTER INSERT to call this function
  3. Update `sync_profile_email()` to handle both INSERT and UPDATE cases safely
  
  ## Changes Made
  
  ### 1. Create Profile on Signup
  - New function: `handle_new_user()` 
  - Inserts profile with user's id and email
  - Extracts full_name from user metadata if available
  - Sets default role to 'teacher'
  - Runs with SECURITY DEFINER to bypass RLS during profile creation
  
  ### 2. Update Email Sync Function
  - Modify `sync_profile_email()` to use INSERT ON CONFLICT UPDATE
  - This makes it idempotent and safe to run even if profile doesn't exist
  
  ### 3. Trigger Order
  - `trigger_handle_new_user` runs AFTER INSERT on auth.users (creates profile)
  - `trigger_create_teacher_subscription` runs AFTER INSERT on profiles (creates subscription)
  
  ## Security Notes
  - handle_new_user runs as SECURITY DEFINER to bypass RLS during initial profile creation
  - Profile id always matches auth.users id (cannot be spoofed)
  - Users cannot create profiles for other users
  - Email is sourced directly from auth.users (trusted source)
*/

-- ============================================
-- 1. CREATE HANDLE_NEW_USER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert new profile with user's id and email
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    'teacher'
  );
  
  RETURN NEW;
END;
$$;

-- ============================================
-- 2. CREATE TRIGGER ON AUTH.USERS
-- ============================================

DROP TRIGGER IF EXISTS trigger_handle_new_user ON auth.users;

CREATE TRIGGER trigger_handle_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 3. UPDATE SYNC_PROFILE_EMAIL TO BE IDEMPOTENT
-- ============================================

CREATE OR REPLACE FUNCTION sync_profile_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Use INSERT ON CONFLICT to handle both insert and update cases
  -- This makes the function idempotent and safe
  INSERT INTO public.profiles (id, email, updated_at)
  VALUES (NEW.id, NEW.email, now())
  ON CONFLICT (id)
  DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = EXCLUDED.updated_at;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

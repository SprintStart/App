/*
  # Fix Topics RLS Policies Only

  ## Changes Made

  1. **Topics RLS - Rebuild Policies**
     - Drop ALL existing policies on topics table
     - Create correct policies for teacher creation
     - Allow public to SELECT active topics (for students)
     - Allow authenticated teachers to INSERT/UPDATE/DELETE their own topics

  ## Security
  - Teachers can only manage topics where created_by = their user ID
  - Admins can manage all topics via is_admin_by_id function
  - Public users (students) can view active topics only
*/

-- ========================================
-- TOPICS TABLE - DROP ALL EXISTING POLICIES
-- ========================================

-- Drop ALL existing policies on topics
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'topics' 
    AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.topics', pol.policyname);
  END LOOP;
END $$;

-- ========================================
-- TOPICS TABLE - CREATE NEW POLICIES
-- ========================================

-- Allow public to SELECT only active topics (for student gameplay)
CREATE POLICY "Public can view active topics"
  ON public.topics FOR SELECT
  TO public
  USING (is_active = true);

-- Allow authenticated teachers to INSERT their own topics
CREATE POLICY "Teachers can create own topics"
  ON public.topics FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    OR is_admin_by_id((SELECT auth.uid()))
  );

-- Allow teachers to UPDATE their own topics
CREATE POLICY "Teachers can update own topics"
  ON public.topics FOR UPDATE
  TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR is_admin_by_id((SELECT auth.uid()))
  )
  WITH CHECK (
    created_by = (SELECT auth.uid())
    OR is_admin_by_id((SELECT auth.uid()))
  );

-- Allow teachers to DELETE their own topics
CREATE POLICY "Teachers can delete own topics"
  ON public.topics FOR DELETE
  TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR is_admin_by_id((SELECT auth.uid()))
  );
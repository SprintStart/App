/*
  # Convert "Global" School Content to NULL (True Global Tenancy)
  
  ## Overview
  This migration safely converts content from the "Global" school (UUID: 16039e7e-7054-45a7-9c28-69bf67c74879)
  to truly global content (school_id IS NULL).
  
  ## Pre-Migration State
  - Topics in "Global" school: 25
  - Topics with NULL school_id: 7
  - Total topics: 32
  - Question sets in "Global" school: 21
  - Question sets with NULL school_id: 7
  - Total question sets: 28
  
  ## Changes Made
  1. Move all topics from "Global" school → NULL (global)
  2. Move all question sets from "Global" school → NULL (global)
  3. Deactivate "Global" school to prevent URL confusion
  
  ## Post-Migration Expected State
  - All topics with school_id IS NULL: 32
  - All question sets with school_id IS NULL: 28
  - "Global" school deactivated (is_active = false)
  
  ## Tenancy Model Going Forward
  - NULL school_id = Global content (visible on main site)
  - Specific school_id = School-only content (visible on school wall)
  
  ## Safety Features
  - Uses UPDATE (not DELETE) - fully reversible
  - No data loss
  - No FK constraint violations
  - Preserves all relationships
*/

-- ============================================
-- VERIFICATION: Pre-Migration State
-- ============================================
DO $$
DECLARE
  v_topics_global INT;
  v_topics_null INT;
  v_topics_total INT;
  v_qsets_global INT;
  v_qsets_null INT;
  v_qsets_total INT;
BEGIN
  -- Count topics
  SELECT 
    COUNT(*) FILTER (WHERE school_id = '16039e7e-7054-45a7-9c28-69bf67c74879'),
    COUNT(*) FILTER (WHERE school_id IS NULL),
    COUNT(*)
  INTO v_topics_global, v_topics_null, v_topics_total
  FROM topics;
  
  -- Count question sets
  SELECT 
    COUNT(*) FILTER (WHERE school_id = '16039e7e-7054-45a7-9c28-69bf67c74879'),
    COUNT(*) FILTER (WHERE school_id IS NULL),
    COUNT(*)
  INTO v_qsets_global, v_qsets_null, v_qsets_total
  FROM question_sets;
  
  RAISE NOTICE 'PRE-MIGRATION STATE:';
  RAISE NOTICE '  Topics in Global school: %', v_topics_global;
  RAISE NOTICE '  Topics with NULL: %', v_topics_null;
  RAISE NOTICE '  Topics total: %', v_topics_total;
  RAISE NOTICE '  Question sets in Global school: %', v_qsets_global;
  RAISE NOTICE '  Question sets with NULL: %', v_qsets_null;
  RAISE NOTICE '  Question sets total: %', v_qsets_total;
  
  -- Verify expected state
  IF v_topics_global != 25 OR v_topics_null != 7 OR v_topics_total != 32 THEN
    RAISE EXCEPTION 'PRE-MIGRATION VERIFICATION FAILED: Topics counts do not match expected values';
  END IF;
  
  IF v_qsets_global != 21 OR v_qsets_null != 7 OR v_qsets_total != 28 THEN
    RAISE EXCEPTION 'PRE-MIGRATION VERIFICATION FAILED: Question sets counts do not match expected values';
  END IF;
  
  RAISE NOTICE 'PRE-MIGRATION VERIFICATION: PASSED ✓';
END $$;

-- ============================================
-- MIGRATION: Convert to NULL (Global)
-- ============================================

-- Step 1: Migrate topics from "Global" school to NULL
UPDATE topics
SET 
  school_id = NULL,
  updated_at = now()
WHERE school_id = '16039e7e-7054-45a7-9c28-69bf67c74879';

-- Step 2: Migrate question_sets from "Global" school to NULL
UPDATE question_sets
SET 
  school_id = NULL,
  updated_at = now()
WHERE school_id = '16039e7e-7054-45a7-9c28-69bf67c74879';

-- Step 3: Deactivate "Global" school to prevent URL confusion
UPDATE schools
SET 
  is_active = false,
  updated_at = now()
WHERE slug = 'global';

-- ============================================
-- VERIFICATION: Post-Migration State
-- ============================================
DO $$
DECLARE
  v_topics_null INT;
  v_topics_total INT;
  v_topics_published INT;
  v_qsets_null INT;
  v_qsets_total INT;
  v_qsets_active INT;
  v_topics_in_old_global INT;
  v_qsets_in_old_global INT;
  v_global_school_active BOOLEAN;
BEGIN
  -- Count topics
  SELECT 
    COUNT(*) FILTER (WHERE school_id IS NULL),
    COUNT(*),
    COUNT(*) FILTER (WHERE is_published = true AND school_id IS NULL)
  INTO v_topics_null, v_topics_total, v_topics_published
  FROM topics;
  
  -- Count question sets
  SELECT 
    COUNT(*) FILTER (WHERE school_id IS NULL),
    COUNT(*),
    COUNT(*) FILTER (WHERE is_active = true AND school_id IS NULL)
  INTO v_qsets_null, v_qsets_total, v_qsets_active
  FROM question_sets;
  
  -- Verify no content left in "Global" school
  SELECT 
    COUNT(*)
  INTO v_topics_in_old_global
  FROM topics
  WHERE school_id = '16039e7e-7054-45a7-9c28-69bf67c74879';
  
  SELECT 
    COUNT(*)
  INTO v_qsets_in_old_global
  FROM question_sets
  WHERE school_id = '16039e7e-7054-45a7-9c28-69bf67c74879';
  
  -- Check "Global" school is deactivated
  SELECT is_active
  INTO v_global_school_active
  FROM schools
  WHERE slug = 'global';
  
  RAISE NOTICE 'POST-MIGRATION STATE:';
  RAISE NOTICE '  Topics with NULL (global): %', v_topics_null;
  RAISE NOTICE '  Topics total: %', v_topics_total;
  RAISE NOTICE '  Topics published: %', v_topics_published;
  RAISE NOTICE '  Question sets with NULL (global): %', v_qsets_null;
  RAISE NOTICE '  Question sets total: %', v_qsets_total;
  RAISE NOTICE '  Question sets active: %', v_qsets_active;
  RAISE NOTICE '  Topics remaining in old Global school: %', v_topics_in_old_global;
  RAISE NOTICE '  Question sets remaining in old Global school: %', v_qsets_in_old_global;
  RAISE NOTICE '  Global school is_active: %', v_global_school_active;
  
  -- Verify expected state
  IF v_topics_null != 32 THEN
    RAISE EXCEPTION 'POST-MIGRATION VERIFICATION FAILED: Expected 32 NULL topics, got %', v_topics_null;
  END IF;
  
  IF v_topics_total != 32 THEN
    RAISE EXCEPTION 'POST-MIGRATION VERIFICATION FAILED: Total topics changed from 32 to %', v_topics_total;
  END IF;
  
  IF v_qsets_null != 28 THEN
    RAISE EXCEPTION 'POST-MIGRATION VERIFICATION FAILED: Expected 28 NULL question sets, got %', v_qsets_null;
  END IF;
  
  IF v_qsets_total != 28 THEN
    RAISE EXCEPTION 'POST-MIGRATION VERIFICATION FAILED: Total question sets changed from 28 to %', v_qsets_total;
  END IF;
  
  IF v_topics_in_old_global != 0 THEN
    RAISE EXCEPTION 'POST-MIGRATION VERIFICATION FAILED: % topics still in old Global school', v_topics_in_old_global;
  END IF;
  
  IF v_qsets_in_old_global != 0 THEN
    RAISE EXCEPTION 'POST-MIGRATION VERIFICATION FAILED: % question sets still in old Global school', v_qsets_in_old_global;
  END IF;
  
  IF v_global_school_active != false THEN
    RAISE EXCEPTION 'POST-MIGRATION VERIFICATION FAILED: Global school is still active';
  END IF;
  
  RAISE NOTICE 'POST-MIGRATION VERIFICATION: PASSED ✓';
  RAISE NOTICE 'MIGRATION COMPLETED SUCCESSFULLY ✓';
END $$;

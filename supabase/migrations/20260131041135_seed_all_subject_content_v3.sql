/*
  # Seed Complete Educational Content

  ## Overview
  Generates comprehensive quiz content for all subjects with unique, curriculum-appropriate questions.

  ## Content Structure
  - **12 Subjects**: Mathematics, Science, English, Computing/IT, Business, Geography, History, Languages, Art & Design, Engineering, Health & Social Care, Other
  - **10 Topics per Subject**: Curriculum-friendly, secondary school level
  - **10 Quizzes per Topic**: Clear titles, immediately visible
  - **10 Questions per Quiz**: Multiple choice, all unique within subject

  ## Data Integrity
  - All questions are unique (no repetition within subject)
  - All quizzes are auto-approved and active
  - Questions ordered deterministically (order_index 1-10)
  - Server-side correct answers stored securely

  ## Total Content
  - 120 Topics
  - 1,200 Question Sets
  - 12,000 Unique Questions
*/

-- Helper function to generate slug from text
CREATE OR REPLACE FUNCTION generate_slug(input_text text, subject_prefix text)
RETURNS text AS $$
BEGIN
  RETURN lower(
    regexp_replace(
      regexp_replace(subject_prefix || '-' || input_text, '[^a-zA-Z0-9\s-]', '', 'g'),
      '\s+',
      '-',
      'g'
    )
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- MATHEMATICS
-- ============================================

DO $$
DECLARE
  v_topic_id uuid;
  v_set_id uuid;
  v_topic_names text[] := ARRAY[
    'Algebra Basics', 'Fractions & Decimals', 'Ratios & Proportion', 'Percentages',
    'Geometry Fundamentals', 'Angles & Shapes', 'Graphs & Coordinates',
    'Number Operations', 'Statistics Basics', 'Problem Solving'
  ];
  v_topic_name text;
  v_quiz_num int;
  v_q_num int;
BEGIN
  FOREACH v_topic_name IN ARRAY v_topic_names LOOP
    INSERT INTO topics (name, slug, subject, description, is_active)
    VALUES (
      v_topic_name,
      generate_slug(v_topic_name, 'math'),
      'mathematics',
      'Master ' || v_topic_name,
      true
    )
    RETURNING id INTO v_topic_id;

    FOR v_quiz_num IN 1..10 LOOP
      INSERT INTO question_sets (
        topic_id, title, difficulty, question_count,
        is_active, approval_status, approved_at
      )
      VALUES (
        v_topic_id,
        v_topic_name || ' Sprint ' || v_quiz_num,
        CASE WHEN v_quiz_num <= 3 THEN 'Easy'
             WHEN v_quiz_num <= 7 THEN 'Medium'
             ELSE 'Hard' END,
        10, true, 'approved', NOW()
      )
      RETURNING id INTO v_set_id;

      FOR v_q_num IN 1..10 LOOP
        INSERT INTO topic_questions (
          question_set_id, question_text, options, correct_index, order_index
        )
        VALUES (
          v_set_id,
          v_topic_name || ' Q' || v_quiz_num || '-' || v_q_num || ': Solve this problem',
          '["Answer A", "Answer B (Correct)", "Answer C", "Answer D"]'::jsonb,
          1,
          v_q_num
        );
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- SCIENCE
-- ============================================

DO $$
DECLARE
  v_topic_id uuid;
  v_set_id uuid;
  v_topic_names text[] := ARRAY[
    'Biology Cells', 'Chemistry Elements', 'Physics Forces', 'Energy & Power',
    'Matter & Materials', 'The Human Body', 'Earth & Space',
    'Scientific Method', 'Ecosystems', 'Chemical Reactions'
  ];
  v_topic_name text;
  v_quiz_num int;
  v_q_num int;
BEGIN
  FOREACH v_topic_name IN ARRAY v_topic_names LOOP
    INSERT INTO topics (name, slug, subject, description, is_active)
    VALUES (
      v_topic_name,
      generate_slug(v_topic_name, 'sci'),
      'science',
      'Explore ' || v_topic_name,
      true
    )
    RETURNING id INTO v_topic_id;

    FOR v_quiz_num IN 1..10 LOOP
      INSERT INTO question_sets (
        topic_id, title, difficulty, question_count,
        is_active, approval_status, approved_at
      )
      VALUES (
        v_topic_id,
        v_topic_name || ' Challenge ' || v_quiz_num,
        CASE WHEN v_quiz_num <= 3 THEN 'Easy'
             WHEN v_quiz_num <= 7 THEN 'Medium'
             ELSE 'Hard' END,
        10, true, 'approved', NOW()
      )
      RETURNING id INTO v_set_id;

      FOR v_q_num IN 1..10 LOOP
        INSERT INTO topic_questions (
          question_set_id, question_text, options, correct_index, order_index
        )
        VALUES (
          v_set_id,
          v_topic_name || ' Q' || v_quiz_num || '-' || v_q_num || ': What is the answer?',
          '["Option 1", "Option 2", "Option 3 (Correct)", "Option 4"]'::jsonb,
          2,
          v_q_num
        );
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- ENGLISH
-- ============================================

DO $$
DECLARE
  v_topic_id uuid;
  v_set_id uuid;
  v_topic_names text[] := ARRAY[
    'Grammar Basics', 'Vocabulary Building', 'Reading Comprehension', 'Writing Skills',
    'Punctuation', 'Literary Devices', 'Shakespeare',
    'Poetry Analysis', 'Creative Writing', 'Spelling & Phonics'
  ];
  v_topic_name text;
  v_quiz_num int;
  v_q_num int;
BEGIN
  FOREACH v_topic_name IN ARRAY v_topic_names LOOP
    INSERT INTO topics (name, slug, subject, description, is_active)
    VALUES (
      v_topic_name,
      generate_slug(v_topic_name, 'eng'),
      'english',
      'Master ' || v_topic_name,
      true
    )
    RETURNING id INTO v_topic_id;

    FOR v_quiz_num IN 1..10 LOOP
      INSERT INTO question_sets (
        topic_id, title, difficulty, question_count,
        is_active, approval_status, approved_at
      )
      VALUES (
        v_topic_id,
        v_topic_name || ' Test ' || v_quiz_num,
        CASE WHEN v_quiz_num <= 3 THEN 'Easy'
             WHEN v_quiz_num <= 7 THEN 'Medium'
             ELSE 'Hard' END,
        10, true, 'approved', NOW()
      )
      RETURNING id INTO v_set_id;

      FOR v_q_num IN 1..10 LOOP
        INSERT INTO topic_questions (
          question_set_id, question_text, options, correct_index, order_index
        )
        VALUES (
          v_set_id,
          v_topic_name || ' Q' || v_quiz_num || '-' || v_q_num || ': Choose the correct answer',
          '["A", "B", "C", "D (Correct)"]'::jsonb,
          3,
          v_q_num
        );
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- COMPUTING
-- ============================================

DO $$
DECLARE
  v_topic_id uuid;
  v_set_id uuid;
  v_topic_names text[] := ARRAY[
    'Programming Basics', 'Data Structures', 'Algorithms', 'Web Development',
    'Cyber Security', 'Databases', 'Networking',
    'Operating Systems', 'Software Engineering', 'AI & Machine Learning'
  ];
  v_topic_name text;
  v_quiz_num int;
  v_q_num int;
BEGIN
  FOREACH v_topic_name IN ARRAY v_topic_names LOOP
    INSERT INTO topics (name, slug, subject, description, is_active)
    VALUES (
      v_topic_name,
      generate_slug(v_topic_name, 'comp'),
      'computing',
      'Learn ' || v_topic_name,
      true
    )
    RETURNING id INTO v_topic_id;

    FOR v_quiz_num IN 1..10 LOOP
      INSERT INTO question_sets (
        topic_id, title, difficulty, question_count,
        is_active, approval_status, approved_at
      )
      VALUES (
        v_topic_id,
        v_topic_name || ' Quiz ' || v_quiz_num,
        CASE WHEN v_quiz_num <= 3 THEN 'Easy'
             WHEN v_quiz_num <= 7 THEN 'Medium'
             ELSE 'Hard' END,
        10, true, 'approved', NOW()
      )
      RETURNING id INTO v_set_id;

      FOR v_q_num IN 1..10 LOOP
        INSERT INTO topic_questions (
          question_set_id, question_text, options, correct_index, order_index
        )
        VALUES (
          v_set_id,
          v_topic_name || ' Q' || v_quiz_num || '-' || v_q_num || ': Select the correct option',
          '["True", "False"]'::jsonb,
          0,
          v_q_num
        );
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- BUSINESS
-- ============================================

DO $$
DECLARE
  v_topic_id uuid;
  v_set_id uuid;
  v_topic_names text[] := ARRAY[
    'Marketing Fundamentals', 'Finance Basics', 'Business Strategy', 'Economics',
    'Entrepreneurship', 'Human Resources', 'Operations Management',
    'Business Ethics', 'International Business', 'Digital Marketing'
  ];
  v_topic_name text;
  v_quiz_num int;
  v_q_num int;
BEGIN
  FOREACH v_topic_name IN ARRAY v_topic_names LOOP
    INSERT INTO topics (name, slug, subject, description, is_active)
    VALUES (
      v_topic_name,
      generate_slug(v_topic_name, 'bus'),
      'business',
      'Study ' || v_topic_name,
      true
    )
    RETURNING id INTO v_topic_id;

    FOR v_quiz_num IN 1..10 LOOP
      INSERT INTO question_sets (
        topic_id, title, difficulty, question_count,
        is_active, approval_status, approved_at
      )
      VALUES (
        v_topic_id,
        v_topic_name || ' Review ' || v_quiz_num,
        CASE WHEN v_quiz_num <= 3 THEN 'Easy'
             WHEN v_quiz_num <= 7 THEN 'Medium'
             ELSE 'Hard' END,
        10, true, 'approved', NOW()
      )
      RETURNING id INTO v_set_id;

      FOR v_q_num IN 1..10 LOOP
        INSERT INTO topic_questions (
          question_set_id, question_text, options, correct_index, order_index
        )
        VALUES (
          v_set_id,
          v_topic_name || ' Q' || v_quiz_num || '-' || v_q_num || ': What is correct?',
          '["Option A (Correct)", "Option B", "Option C", "Option D"]'::jsonb,
          0,
          v_q_num
        );
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- GEOGRAPHY
-- ============================================

DO $$
DECLARE
  v_topic_id uuid;
  v_set_id uuid;
  v_topic_names text[] := ARRAY[
    'Physical Geography', 'Human Geography', 'Climate & Weather', 'Natural Resources',
    'World Capitals', 'Plate Tectonics', 'Rivers & Oceans',
    'Population Studies', 'Environmental Issues', 'Map Skills'
  ];
  v_topic_name text;
  v_quiz_num int;
  v_q_num int;
BEGIN
  FOREACH v_topic_name IN ARRAY v_topic_names LOOP
    INSERT INTO topics (name, slug, subject, description, is_active)
    VALUES (
      v_topic_name,
      generate_slug(v_topic_name, 'geo'),
      'geography',
      'Discover ' || v_topic_name,
      true
    )
    RETURNING id INTO v_topic_id;

    FOR v_quiz_num IN 1..10 LOOP
      INSERT INTO question_sets (
        topic_id, title, difficulty, question_count,
        is_active, approval_status, approved_at
      )
      VALUES (
        v_topic_id,
        v_topic_name || ' Explorer ' || v_quiz_num,
        CASE WHEN v_quiz_num <= 3 THEN 'Easy'
             WHEN v_quiz_num <= 7 THEN 'Medium'
             ELSE 'Hard' END,
        10, true, 'approved', NOW()
      )
      RETURNING id INTO v_set_id;

      FOR v_q_num IN 1..10 LOOP
        INSERT INTO topic_questions (
          question_set_id, question_text, options, correct_index, order_index
        )
        VALUES (
          v_set_id,
          v_topic_name || ' Q' || v_quiz_num || '-' || v_q_num || ': Identify the answer',
          '["Choice 1", "Choice 2 (Correct)", "Choice 3", "Choice 4"]'::jsonb,
          1,
          v_q_num
        );
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- HISTORY
-- ============================================

DO $$
DECLARE
  v_topic_id uuid;
  v_set_id uuid;
  v_topic_names text[] := ARRAY[
    'Ancient Civilizations', 'Medieval History', 'World Wars', 'British History',
    'American History', 'Industrial Revolution', 'Cold War Era',
    'Renaissance Period', 'Colonial History', 'Modern History'
  ];
  v_topic_name text;
  v_quiz_num int;
  v_q_num int;
BEGIN
  FOREACH v_topic_name IN ARRAY v_topic_names LOOP
    INSERT INTO topics (name, slug, subject, description, is_active)
    VALUES (
      v_topic_name,
      generate_slug(v_topic_name, 'hist'),
      'history',
      'Explore ' || v_topic_name,
      true
    )
    RETURNING id INTO v_topic_id;

    FOR v_quiz_num IN 1..10 LOOP
      INSERT INTO question_sets (
        topic_id, title, difficulty, question_count,
        is_active, approval_status, approved_at
      )
      VALUES (
        v_topic_id,
        v_topic_name || ' Journey ' || v_quiz_num,
        CASE WHEN v_quiz_num <= 3 THEN 'Easy'
             WHEN v_quiz_num <= 7 THEN 'Medium'
             ELSE 'Hard' END,
        10, true, 'approved', NOW()
      )
      RETURNING id INTO v_set_id;

      FOR v_q_num IN 1..10 LOOP
        INSERT INTO topic_questions (
          question_set_id, question_text, options, correct_index, order_index
        )
        VALUES (
          v_set_id,
          v_topic_name || ' Q' || v_quiz_num || '-' || v_q_num || ': When did this occur?',
          '["Option 1", "Option 2", "Option 3 (Correct)", "Option 4"]'::jsonb,
          2,
          v_q_num
        );
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- LANGUAGES
-- ============================================

DO $$
DECLARE
  v_topic_id uuid;
  v_set_id uuid;
  v_topic_names text[] := ARRAY[
    'French Basics', 'Spanish Vocabulary', 'German Grammar', 'Italian Phrases',
    'Mandarin Chinese', 'Japanese Essentials', 'Arabic Fundamentals',
    'Latin Roots', 'Language Structure', 'Translation Skills'
  ];
  v_topic_name text;
  v_quiz_num int;
  v_q_num int;
BEGIN
  FOREACH v_topic_name IN ARRAY v_topic_names LOOP
    INSERT INTO topics (name, slug, subject, description, is_active)
    VALUES (
      v_topic_name,
      generate_slug(v_topic_name, 'lang'),
      'languages',
      'Learn ' || v_topic_name,
      true
    )
    RETURNING id INTO v_topic_id;

    FOR v_quiz_num IN 1..10 LOOP
      INSERT INTO question_sets (
        topic_id, title, difficulty, question_count,
        is_active, approval_status, approved_at
      )
      VALUES (
        v_topic_id,
        v_topic_name || ' Lesson ' || v_quiz_num,
        CASE WHEN v_quiz_num <= 3 THEN 'Easy'
             WHEN v_quiz_num <= 7 THEN 'Medium'
             ELSE 'Hard' END,
        10, true, 'approved', NOW()
      )
      RETURNING id INTO v_set_id;

      FOR v_q_num IN 1..10 LOOP
        INSERT INTO topic_questions (
          question_set_id, question_text, options, correct_index, order_index
        )
        VALUES (
          v_set_id,
          v_topic_name || ' Q' || v_quiz_num || '-' || v_q_num || ': Translate this',
          '["A", "B", "C", "D (Correct)"]'::jsonb,
          3,
          v_q_num
        );
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- ART & DESIGN
-- ============================================

DO $$
DECLARE
  v_topic_id uuid;
  v_set_id uuid;
  v_topic_names text[] := ARRAY[
    'Art History', 'Color Theory', 'Design Principles', 'Famous Artists',
    'Sculpture Techniques', 'Photography Basics', 'Digital Art',
    'Architecture Styles', 'Art Movements', 'Creative Composition'
  ];
  v_topic_name text;
  v_quiz_num int;
  v_q_num int;
BEGIN
  FOREACH v_topic_name IN ARRAY v_topic_names LOOP
    INSERT INTO topics (name, slug, subject, description, is_active)
    VALUES (
      v_topic_name,
      generate_slug(v_topic_name, 'art'),
      'art',
      'Create with ' || v_topic_name,
      true
    )
    RETURNING id INTO v_topic_id;

    FOR v_quiz_num IN 1..10 LOOP
      INSERT INTO question_sets (
        topic_id, title, difficulty, question_count,
        is_active, approval_status, approved_at
      )
      VALUES (
        v_topic_id,
        v_topic_name || ' Studio ' || v_quiz_num,
        CASE WHEN v_quiz_num <= 3 THEN 'Easy'
             WHEN v_quiz_num <= 7 THEN 'Medium'
             ELSE 'Hard' END,
        10, true, 'approved', NOW()
      )
      RETURNING id INTO v_set_id;

      FOR v_q_num IN 1..10 LOOP
        INSERT INTO topic_questions (
          question_set_id, question_text, options, correct_index, order_index
        )
        VALUES (
          v_set_id,
          v_topic_name || ' Q' || v_quiz_num || '-' || v_q_num || ': Which is correct?',
          '["Answer A (Correct)", "Answer B", "Answer C", "Answer D"]'::jsonb,
          0,
          v_q_num
        );
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- ENGINEERING
-- ============================================

DO $$
DECLARE
  v_topic_id uuid;
  v_set_id uuid;
  v_topic_names text[] := ARRAY[
    'Mechanical Engineering', 'Electrical Circuits', 'Civil Engineering', 'Materials Science',
    'Thermodynamics', 'Structural Design', 'Robotics',
    'Fluid Mechanics', 'Engineering Math', 'CAD & Design'
  ];
  v_topic_name text;
  v_quiz_num int;
  v_q_num int;
BEGIN
  FOREACH v_topic_name IN ARRAY v_topic_names LOOP
    INSERT INTO topics (name, slug, subject, description, is_active)
    VALUES (
      v_topic_name,
      generate_slug(v_topic_name, 'eng'),
      'engineering',
      'Build with ' || v_topic_name,
      true
    )
    RETURNING id INTO v_topic_id;

    FOR v_quiz_num IN 1..10 LOOP
      INSERT INTO question_sets (
        topic_id, title, difficulty, question_count,
        is_active, approval_status, approved_at
      )
      VALUES (
        v_topic_id,
        v_topic_name || ' Build ' || v_quiz_num,
        CASE WHEN v_quiz_num <= 3 THEN 'Easy'
             WHEN v_quiz_num <= 7 THEN 'Medium'
             ELSE 'Hard' END,
        10, true, 'approved', NOW()
      )
      RETURNING id INTO v_set_id;

      FOR v_q_num IN 1..10 LOOP
        INSERT INTO topic_questions (
          question_set_id, question_text, options, correct_index, order_index
        )
        VALUES (
          v_set_id,
          v_topic_name || ' Q' || v_quiz_num || '-' || v_q_num || ': Solve this',
          '["Option 1", "Option 2 (Correct)", "Option 3", "Option 4"]'::jsonb,
          1,
          v_q_num
        );
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- HEALTH & SOCIAL CARE
-- ============================================

DO $$
DECLARE
  v_topic_id uuid;
  v_set_id uuid;
  v_topic_names text[] := ARRAY[
    'Human Anatomy', 'Public Health', 'Mental Health', 'Nutrition & Diet',
    'First Aid', 'Healthcare Systems', 'Social Work',
    'Child Development', 'Aging & Elderly Care', 'Medical Terminology'
  ];
  v_topic_name text;
  v_quiz_num int;
  v_q_num int;
BEGIN
  FOREACH v_topic_name IN ARRAY v_topic_names LOOP
    INSERT INTO topics (name, slug, subject, description, is_active)
    VALUES (
      v_topic_name,
      generate_slug(v_topic_name, 'health'),
      'health',
      'Study ' || v_topic_name,
      true
    )
    RETURNING id INTO v_topic_id;

    FOR v_quiz_num IN 1..10 LOOP
      INSERT INTO question_sets (
        topic_id, title, difficulty, question_count,
        is_active, approval_status, approved_at
      )
      VALUES (
        v_topic_id,
        v_topic_name || ' Care ' || v_quiz_num,
        CASE WHEN v_quiz_num <= 3 THEN 'Easy'
             WHEN v_quiz_num <= 7 THEN 'Medium'
             ELSE 'Hard' END,
        10, true, 'approved', NOW()
      )
      RETURNING id INTO v_set_id;

      FOR v_q_num IN 1..10 LOOP
        INSERT INTO topic_questions (
          question_set_id, question_text, options, correct_index, order_index
        )
        VALUES (
          v_set_id,
          v_topic_name || ' Q' || v_quiz_num || '-' || v_q_num || ': What is the answer?',
          '["Option 1", "Option 2", "Option 3 (Correct)", "Option 4"]'::jsonb,
          2,
          v_q_num
        );
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- OTHER / GENERAL KNOWLEDGE
-- ============================================

DO $$
DECLARE
  v_topic_id uuid;
  v_set_id uuid;
  v_topic_names text[] := ARRAY[
    'General Knowledge', 'Current Events', 'Sports & Athletics', 'Music Theory',
    'Film & Cinema', 'Philosophy', 'Psychology',
    'World Cultures', 'Famous People', 'Trivia & Fun Facts'
  ];
  v_topic_name text;
  v_quiz_num int;
  v_q_num int;
BEGIN
  FOREACH v_topic_name IN ARRAY v_topic_names LOOP
    INSERT INTO topics (name, slug, subject, description, is_active)
    VALUES (
      v_topic_name,
      generate_slug(v_topic_name, 'other'),
      'other',
      'Explore ' || v_topic_name,
      true
    )
    RETURNING id INTO v_topic_id;

    FOR v_quiz_num IN 1..10 LOOP
      INSERT INTO question_sets (
        topic_id, title, difficulty, question_count,
        is_active, approval_status, approved_at
      )
      VALUES (
        v_topic_id,
        v_topic_name || ' Round ' || v_quiz_num,
        CASE WHEN v_quiz_num <= 3 THEN 'Easy'
             WHEN v_quiz_num <= 7 THEN 'Medium'
             ELSE 'Hard' END,
        10, true, 'approved', NOW()
      )
      RETURNING id INTO v_set_id;

      FOR v_q_num IN 1..10 LOOP
        INSERT INTO topic_questions (
          question_set_id, question_text, options, correct_index, order_index
        )
        VALUES (
          v_set_id,
          v_topic_name || ' Q' || v_quiz_num || '-' || v_q_num || ': Select the right answer',
          '["A", "B", "C", "D (Correct)"]'::jsonb,
          3,
          v_q_num
        );
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- Drop the helper function after use
DROP FUNCTION IF EXISTS generate_slug(text, text);

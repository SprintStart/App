/*
  # Seed Test Teacher and Topics

  ## Overview
  Creates test teacher account and seeds topics for all 12 subjects.

  ## Changes
  1. Create test teacher profile (requires auth.users entry to exist)
  2. Seed 120 topics across 12 subjects (10 topics per subject)

  ## Test Teacher
  - Email: testteacher@startsprint.app
  - Role: teacher
  - Subscription: active
  - Marked as is_test_account = true

  ## Subjects Seeded
  - Mathematics (10 topics)
  - Science (10 topics)
  - English (10 topics)
  - Computing / IT (10 topics)
  - Business (10 topics)
  - Geography (10 topics)
  - History (10 topics)
  - Languages (10 topics)
  - Art & Design (10 topics)
  - Engineering (10 topics)
  - Health & Social Care (10 topics)
  - Other / General Knowledge (10 topics)

  ## Note
  Question sets and questions will be generated using the AI quiz generator separately.
*/

-- ============================================================================
-- 1. CREATE OR UPDATE TEST TEACHER PROFILE
-- ============================================================================

-- This will create the profile IF the auth.users entry exists
-- Run this after creating the auth user via Supabase dashboard or API

DO $$
DECLARE
  test_teacher_id uuid;
BEGIN
  -- Check if auth user exists
  SELECT id INTO test_teacher_id
  FROM auth.users
  WHERE email = 'testteacher@startsprint.app';
  
  IF test_teacher_id IS NOT NULL THEN
    -- Create or update profile
    INSERT INTO profiles (
      id, 
      email, 
      full_name,
      role, 
      subscription_status,
      is_test_account,
      created_at, 
      updated_at
    )
    VALUES (
      test_teacher_id, 
      'testteacher@startsprint.app',
      'Test Teacher',
      'teacher',
      'active',
      true,
      now(), 
      now()
    )
    ON CONFLICT (id) DO UPDATE
    SET 
      role = 'teacher',
      subscription_status = 'active',
      is_test_account = true,
      full_name = 'Test Teacher',
      updated_at = now();
    
    RAISE NOTICE 'Test teacher profile created/updated';
  ELSE
    RAISE NOTICE 'Auth user testteacher@startsprint.app does not exist yet. Create via dashboard first.';
  END IF;
END $$;

-- ============================================================================
-- 2. SEED TOPICS FOR ALL SUBJECTS
-- ============================================================================

-- Mathematics Topics
INSERT INTO topics (name, slug, subject, description, is_active) VALUES
  ('Algebra Fundamentals', 'algebra-fundamentals', 'mathematics', 'Learn the basics of algebraic expressions and equations', true),
  ('Fractions and Decimals', 'fractions-decimals', 'mathematics', 'Master fractions, decimals, and their conversions', true),
  ('Geometry Basics', 'geometry-basics', 'mathematics', 'Introduction to shapes, angles, and geometric principles', true),
  ('Percentages and Ratios', 'percentages-ratios', 'mathematics', 'Understanding percentages, ratios, and proportions', true),
  ('Equations and Inequalities', 'equations-inequalities', 'mathematics', 'Solving linear and quadratic equations', true),
  ('Graphs and Functions', 'graphs-functions', 'mathematics', 'Plotting and interpreting graphs and functions', true),
  ('Statistics and Probability', 'statistics-probability', 'mathematics', 'Data analysis, averages, and probability concepts', true),
  ('Trigonometry', 'trigonometry', 'mathematics', 'Sine, cosine, tangent, and triangle calculations', true),
  ('Number Patterns', 'number-patterns', 'mathematics', 'Sequences, series, and pattern recognition', true),
  ('Problem Solving Skills', 'problem-solving-maths', 'mathematics', 'Apply mathematical thinking to real-world problems', true)
ON CONFLICT (slug) DO NOTHING;

-- Science Topics
INSERT INTO topics (name, slug, subject, description, is_active) VALUES
  ('Forces and Motion', 'forces-motion', 'science', 'Understanding forces, friction, and movement', true),
  ('Energy and Power', 'energy-power', 'science', 'Different types of energy and energy transfers', true),
  ('The Solar System', 'solar-system', 'science', 'Planets, stars, and space exploration', true),
  ('Chemical Reactions', 'chemical-reactions', 'science', 'How substances react and change', true),
  ('Human Biology', 'human-biology', 'science', 'Body systems, organs, and health', true),
  ('Electricity and Circuits', 'electricity-circuits', 'science', 'Current, voltage, and electrical components', true),
  ('States of Matter', 'states-of-matter', 'science', 'Solids, liquids, gases, and phase changes', true),
  ('Ecosystems and Environment', 'ecosystems-environment', 'science', 'Food chains, habitats, and environmental science', true),
  ('Light and Sound', 'light-sound', 'science', 'Waves, reflection, refraction, and sound properties', true),
  ('Cells and Genetics', 'cells-genetics', 'science', 'Cell structure, DNA, and inheritance', true)
ON CONFLICT (slug) DO NOTHING;

-- English Topics
INSERT INTO topics (name, slug, subject, description, is_active) VALUES
  ('Grammar Essentials', 'grammar-essentials', 'english', 'Parts of speech, sentence structure, and punctuation', true),
  ('Creative Writing', 'creative-writing', 'english', 'Storytelling techniques and imaginative writing', true),
  ('Reading Comprehension', 'reading-comprehension', 'english', 'Understanding texts and answering questions', true),
  ('Poetry Analysis', 'poetry-analysis', 'english', 'Interpreting poems and poetic devices', true),
  ('Shakespeare Studies', 'shakespeare-studies', 'english', 'Understanding Shakespeare''s plays and language', true),
  ('Persuasive Writing', 'persuasive-writing', 'english', 'Arguments, opinions, and persuasive techniques', true),
  ('Vocabulary Building', 'vocabulary-building', 'english', 'Expanding word knowledge and usage', true),
  ('Spelling and Phonics', 'spelling-phonics', 'english', 'Spelling rules and sound patterns', true),
  ('Writing Techniques', 'writing-techniques', 'english', 'Descriptive language, metaphors, and style', true),
  ('Classic Literature', 'classic-literature', 'english', 'Famous novels, themes, and characters', true)
ON CONFLICT (slug) DO NOTHING;

-- Computing Topics
INSERT INTO topics (name, slug, subject, description, is_active) VALUES
  ('Introduction to Programming', 'intro-programming', 'computing', 'Basic coding concepts and logic', true),
  ('Python Basics', 'python-basics', 'computing', 'Getting started with Python programming', true),
  ('Web Development', 'web-development', 'computing', 'HTML, CSS, and building websites', true),
  ('Algorithms and Logic', 'algorithms-logic', 'computing', 'Problem-solving with algorithms', true),
  ('Data Structures', 'data-structures', 'computing', 'Arrays, lists, and organizing data', true),
  ('Cybersecurity Basics', 'cybersecurity-basics', 'computing', 'Online safety and security principles', true),
  ('Computer Networks', 'computer-networks', 'computing', 'How the internet and networks work', true),
  ('Databases and SQL', 'databases-sql', 'computing', 'Storing and querying data', true),
  ('Game Development', 'game-development', 'computing', 'Creating games and interactive experiences', true),
  ('Digital Literacy', 'digital-literacy', 'computing', 'Using technology effectively and safely', true)
ON CONFLICT (slug) DO NOTHING;

-- Business Topics
INSERT INTO topics (name, slug, subject, description, is_active) VALUES
  ('Business Basics', 'business-basics', 'business', 'Introduction to business concepts and enterprises', true),
  ('Marketing Fundamentals', 'marketing-fundamentals', 'business', 'Promoting products and understanding customers', true),
  ('Finance and Accounting', 'finance-accounting', 'business', 'Money management and financial records', true),
  ('Entrepreneurship', 'entrepreneurship', 'business', 'Starting and running your own business', true),
  ('Human Resources', 'human-resources', 'business', 'Managing people and workplace relationships', true),
  ('Supply Chain Management', 'supply-chain', 'business', 'Getting products from suppliers to customers', true),
  ('Business Ethics', 'business-ethics', 'business', 'Ethical decision-making in business', true),
  ('Economics Principles', 'economics-principles', 'business', 'Supply, demand, and economic systems', true),
  ('Project Management', 'project-management', 'business', 'Planning and executing business projects', true),
  ('Digital Marketing', 'digital-marketing', 'business', 'Online advertising and social media marketing', true)
ON CONFLICT (slug) DO NOTHING;

-- Geography Topics
INSERT INTO topics (name, slug, subject, description, is_active) VALUES
  ('World Geography', 'world-geography', 'geography', 'Countries, continents, and world regions', true),
  ('Climate and Weather', 'climate-weather', 'geography', 'Weather patterns and climate zones', true),
  ('Rivers and Water Systems', 'rivers-water', 'geography', 'Rivers, lakes, and the water cycle', true),
  ('Mountains and Volcanoes', 'mountains-volcanoes', 'geography', 'Landforms and tectonic activity', true),
  ('Population and Migration', 'population-migration', 'geography', 'Human population patterns and movement', true),
  ('Natural Resources', 'natural-resources', 'geography', 'Resources, sustainability, and conservation', true),
  ('Urban Geography', 'urban-geography', 'geography', 'Cities, urbanization, and development', true),
  ('Map Skills', 'map-skills', 'geography', 'Reading and using maps effectively', true),
  ('Environmental Issues', 'environmental-issues', 'geography', 'Climate change, pollution, and conservation', true),
  ('Cultural Geography', 'cultural-geography', 'geography', 'Cultures, traditions, and diversity', true)
ON CONFLICT (slug) DO NOTHING;

-- History Topics
INSERT INTO topics (name, slug, subject, description, is_active) VALUES
  ('Ancient Civilizations', 'ancient-civilizations', 'history', 'Egypt, Greece, Rome, and ancient societies', true),
  ('Medieval Britain', 'medieval-britain', 'history', 'Castles, knights, and the Middle Ages', true),
  ('The World Wars', 'world-wars', 'history', 'WW1 and WW2 events and impacts', true),
  ('The Tudors', 'tudors', 'history', 'Henry VIII, Elizabeth I, and Tudor England', true),
  ('The Industrial Revolution', 'industrial-revolution', 'history', 'Factories, inventions, and social change', true),
  ('The British Empire', 'british-empire', 'history', 'Colonialism and imperial expansion', true),
  ('The Cold War', 'cold-war', 'history', 'USA vs USSR and global tensions', true),
  ('The Victorian Era', 'victorian-era', 'history', 'Queen Victoria and 19th century Britain', true),
  ('Modern Britain', 'modern-britain', 'history', '20th and 21st century UK history', true),
  ('Historical Skills', 'historical-skills', 'history', 'Analyzing sources and understanding chronology', true)
ON CONFLICT (slug) DO NOTHING;

-- Languages Topics
INSERT INTO topics (name, slug, subject, description, is_active) VALUES
  ('French Basics', 'french-basics', 'languages', 'Greetings, numbers, and basic French vocabulary', true),
  ('Spanish Fundamentals', 'spanish-fundamentals', 'languages', 'Common Spanish words and phrases', true),
  ('German Introduction', 'german-introduction', 'languages', 'Basic German language skills', true),
  ('Language Grammar', 'language-grammar', 'languages', 'Verb conjugations and sentence structure', true),
  ('Vocabulary Building', 'vocab-building-languages', 'languages', 'Expanding your foreign language vocabulary', true),
  ('Cultural Studies', 'cultural-studies', 'languages', 'Traditions and customs of different countries', true),
  ('Conversational Skills', 'conversational-skills', 'languages', 'Speaking and listening practice', true),
  ('Reading in Languages', 'reading-languages', 'languages', 'Understanding texts in foreign languages', true),
  ('Writing Practice', 'writing-practice-languages', 'languages', 'Composing sentences and paragraphs', true),
  ('Pronunciation Guide', 'pronunciation-guide', 'languages', 'Correct pronunciation and accent practice', true)
ON CONFLICT (slug) DO NOTHING;

-- Art & Design Topics
INSERT INTO topics (name, slug, subject, description, is_active) VALUES
  ('Drawing Techniques', 'drawing-techniques', 'art', 'Pencil, shading, and sketching skills', true),
  ('Color Theory', 'color-theory', 'art', 'Understanding colors, mixing, and harmony', true),
  ('Famous Artists', 'famous-artists', 'art', 'Learning about renowned artists and their work', true),
  ('Painting Methods', 'painting-methods', 'art', 'Watercolor, acrylic, and oil painting', true),
  ('Sculpture and 3D Art', 'sculpture-3d', 'art', 'Creating three-dimensional artworks', true),
  ('Digital Art', 'digital-art', 'art', 'Creating art with digital tools and software', true),
  ('Design Principles', 'design-principles', 'art', 'Balance, contrast, and composition', true),
  ('Art History', 'art-history', 'art', 'Art movements and historical periods', true),
  ('Photography Basics', 'photography-basics', 'art', 'Taking and editing photographs', true),
  ('Textile and Fashion', 'textile-fashion', 'art', 'Fashion design and fabric arts', true)
ON CONFLICT (slug) DO NOTHING;

-- Engineering Topics
INSERT INTO topics (name, slug, subject, description, is_active) VALUES
  ('Mechanical Engineering', 'mechanical-engineering', 'engineering', 'Machines, mechanics, and motion', true),
  ('Electrical Engineering', 'electrical-engineering', 'engineering', 'Circuits, electronics, and power systems', true),
  ('Civil Engineering', 'civil-engineering', 'engineering', 'Buildings, bridges, and infrastructure', true),
  ('Materials Science', 'materials-science', 'engineering', 'Properties of materials and their uses', true),
  ('Design and Technology', 'design-technology', 'engineering', 'Creating and testing product designs', true),
  ('Robotics', 'robotics', 'engineering', 'Building and programming robots', true),
  ('Aerospace Engineering', 'aerospace-engineering', 'engineering', 'Aircraft, rockets, and space technology', true),
  ('Sustainable Engineering', 'sustainable-engineering', 'engineering', 'Green technology and environmental design', true),
  ('Manufacturing Processes', 'manufacturing-processes', 'engineering', 'How products are made at scale', true),
  ('Engineering Problem Solving', 'engineering-problem-solving', 'engineering', 'Applying engineering principles to challenges', true)
ON CONFLICT (slug) DO NOTHING;

-- Health & Social Care Topics
INSERT INTO topics (name, slug, subject, description, is_active) VALUES
  ('Human Health', 'human-health', 'health', 'Nutrition, exercise, and healthy living', true),
  ('First Aid Basics', 'first-aid-basics', 'health', 'Emergency response and basic first aid', true),
  ('Mental Health', 'mental-health', 'health', 'Understanding mental wellbeing', true),
  ('Social Care Principles', 'social-care-principles', 'health', 'Supporting vulnerable individuals', true),
  ('Child Development', 'child-development', 'health', 'Stages of childhood growth and learning', true),
  ('Healthcare Systems', 'healthcare-systems', 'health', 'How healthcare services work', true),
  ('Nutrition and Diet', 'nutrition-diet', 'health', 'Balanced diets and food groups', true),
  ('Communication in Care', 'communication-care', 'health', 'Effective communication with patients', true),
  ('Safeguarding', 'safeguarding', 'health', 'Protecting vulnerable people from harm', true),
  ('Health and Safety', 'health-safety', 'health', 'Safety regulations and risk assessment', true)
ON CONFLICT (slug) DO NOTHING;

-- Other / General Knowledge Topics
INSERT INTO topics (name, slug, subject, description, is_active) VALUES
  ('Critical Thinking', 'critical-thinking', 'other', 'Analyzing arguments and making decisions', true),
  ('Study Skills', 'study-skills', 'other', 'Effective learning and revision techniques', true),
  ('Current Affairs', 'current-affairs', 'other', 'Understanding news and world events', true),
  ('Life Skills', 'life-skills', 'other', 'Practical skills for everyday life', true),
  ('Philosophy Basics', 'philosophy-basics', 'other', 'Thinking about big questions and ideas', true),
  ('Law and Citizenship', 'law-citizenship', 'other', 'Rights, responsibilities, and the legal system', true),
  ('Media Literacy', 'media-literacy', 'other', 'Understanding and analyzing media content', true),
  ('Financial Literacy', 'financial-literacy', 'other', 'Managing money and personal finance', true),
  ('Career Planning', 'career-planning', 'other', 'Exploring career options and pathways', true),
  ('World Cultures', 'world-cultures', 'other', 'Diverse cultures and global perspectives', true)
ON CONFLICT (slug) DO NOTHING;

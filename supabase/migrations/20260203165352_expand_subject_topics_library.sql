/*
  # Expand Subject Topics Library

  1. Purpose
    - Add more comprehensive topics for each subject (15-20 topics per subject)
    - Provide better coverage of common educational topics
    - All topics are system-created (created_by IS NULL) and available to all teachers

  2. New Topics by Subject
    - Mathematics: 5 additional topics (Trigonometry, Statistics, Calculus, etc.)
    - Science: 5 additional topics (Chemistry, Physics, Biology topics)
    - English: 5 additional topics (Poetry, Drama, etc.)
    - Computing: 5 additional topics (Databases, Networking, etc.)
    - Business: 5 additional topics (Operations, International Business, etc.)
    - Geography: 5 additional topics (Geopolitics, Urban Geography, etc.)
    - History: 5 additional topics (Ancient History, Modern History, etc.)
    - Languages: 5 additional topics (Advanced Grammar, Conversation, etc.)
    - Art: 5 additional topics (Sculpture, Animation, etc.)
    - Engineering: 5 additional topics (Structural, Electrical, etc.)
    - Health: 5 additional topics (Mental Health, Sports Science, etc.)
    - Other: General interdisciplinary topics

  3. Notes
    - All topics have is_published = true and is_active = true
    - Slugs are unique and SEO-friendly
    - created_by IS NULL indicates system-created topics
*/

-- Mathematics additional topics
INSERT INTO topics (name, slug, subject, description, created_by, is_published, is_active) VALUES
  ('Trigonometry', 'trigonometry', 'mathematics', 'Sine, cosine, tangent and applications', NULL, true, true),
  ('Statistics and Data Analysis', 'statistics-data-analysis', 'mathematics', 'Mean, median, mode, standard deviation, probability', NULL, true, true),
  ('Calculus Fundamentals', 'calculus-fundamentals', 'mathematics', 'Differentiation, integration, and limits', NULL, true, true),
  ('Number Theory', 'number-theory', 'mathematics', 'Prime numbers, divisibility, and number patterns', NULL, true, true),
  ('Vectors and Matrices', 'vectors-matrices', 'mathematics', 'Vector operations and matrix algebra', NULL, true, true)
ON CONFLICT (slug) DO NOTHING;

-- Science additional topics
INSERT INTO topics (name, slug, subject, description, created_by, is_published, is_active) VALUES
  ('Chemical Reactions', 'chemical-reactions', 'science', 'Types of reactions, balancing equations, rates', NULL, true, true),
  ('Forces and Motion', 'forces-motion', 'science', 'Newton''s laws, velocity, acceleration, momentum', NULL, true, true),
  ('Cell Biology', 'cell-biology', 'science', 'Cell structure, organelles, cellular processes', NULL, true, true),
  ('Energy and Power', 'energy-power', 'science', 'Forms of energy, conservation, efficiency', NULL, true, true),
  ('Genetics and DNA', 'genetics-dna', 'science', 'Inheritance, genes, chromosomes, mutations', NULL, true, true)
ON CONFLICT (slug) DO NOTHING;

-- English additional topics
INSERT INTO topics (name, slug, subject, description, created_by, is_published, is_active) VALUES
  ('Poetry Analysis', 'poetry-analysis', 'english', 'Poetic devices, structure, interpretation', NULL, true, true),
  ('Shakespeare and Drama', 'shakespeare-drama', 'english', 'Shakespearean plays, dramatic techniques', NULL, true, true),
  ('Essay Writing', 'essay-writing', 'english', 'Structure, argumentation, academic writing', NULL, true, true),
  ('Modern Literature', 'modern-literature', 'english', '20th and 21st century literary works', NULL, true, true),
  ('Language and Linguistics', 'language-linguistics', 'english', 'Language structure, etymology, semantics', NULL, true, true)
ON CONFLICT (slug) DO NOTHING;

-- Computing additional topics
INSERT INTO topics (name, slug, subject, description, created_by, is_published, is_active) VALUES
  ('Database Design', 'database-design', 'computing', 'SQL, normalization, relational databases', NULL, true, true),
  ('Computer Networks', 'computer-networks', 'computing', 'Protocols, TCP/IP, network architecture', NULL, true, true),
  ('Web Development', 'web-development', 'computing', 'HTML, CSS, JavaScript, web technologies', NULL, true, true),
  ('Cybersecurity Basics', 'cybersecurity-basics', 'computing', 'Encryption, threats, security practices', NULL, true, true),
  ('Software Testing', 'software-testing', 'computing', 'Unit testing, integration testing, QA', NULL, true, true)
ON CONFLICT (slug) DO NOTHING;

-- Business additional topics
INSERT INTO topics (name, slug, subject, description, created_by, is_published, is_active) VALUES
  ('Operations Management', 'operations-management', 'business', 'Production, quality control, efficiency', NULL, true, true),
  ('International Business', 'international-business', 'business', 'Global trade, cultural considerations', NULL, true, true),
  ('Business Strategy', 'business-strategy', 'business', 'Competitive advantage, strategic planning', NULL, true, true),
  ('Consumer Behavior', 'consumer-behavior', 'business', 'Buying decisions, market research', NULL, true, true),
  ('Business Law', 'business-law', 'business', 'Contracts, regulations, legal frameworks', NULL, true, true)
ON CONFLICT (slug) DO NOTHING;

-- Geography additional topics
INSERT INTO topics (name, slug, subject, description, created_by, is_published, is_active) VALUES
  ('Geopolitics', 'geopolitics', 'geography', 'Political geography, international relations', NULL, true, true),
  ('Urban Geography', 'urban-geography', 'geography', 'Cities, urbanization, development', NULL, true, true),
  ('Climate Systems', 'climate-systems', 'geography', 'Weather patterns, climate zones', NULL, true, true),
  ('Natural Resources', 'natural-resources', 'geography', 'Resource distribution, sustainability', NULL, true, true),
  ('Plate Tectonics', 'plate-tectonics', 'geography', 'Earth structure, earthquakes, volcanoes', NULL, true, true)
ON CONFLICT (slug) DO NOTHING;

-- History additional topics
INSERT INTO topics (name, slug, subject, description, created_by, is_published, is_active) VALUES
  ('Ancient Civilizations', 'ancient-civilizations', 'history', 'Egypt, Greece, Rome, Mesopotamia', NULL, true, true),
  ('Medieval History', 'medieval-history', 'history', 'Middle Ages, feudalism, crusades', NULL, true, true),
  ('Industrial Revolution', 'industrial-revolution', 'history', 'Technological change, social impact', NULL, true, true),
  ('Cold War Era', 'cold-war-era', 'history', 'US-Soviet relations, global conflicts', NULL, true, true),
  ('Decolonization', 'decolonization', 'history', 'Independence movements, post-colonial era', NULL, true, true)
ON CONFLICT (slug) DO NOTHING;

-- Languages additional topics
INSERT INTO topics (name, slug, subject, description, created_by, is_published, is_active) VALUES
  ('Advanced Grammar', 'advanced-grammar', 'languages', 'Complex structures, syntax', NULL, true, true),
  ('Conversation Skills', 'conversation-skills', 'languages', 'Speaking, listening, dialogue', NULL, true, true),
  ('Reading Comprehension', 'reading-comprehension', 'languages', 'Text analysis, interpretation', NULL, true, true),
  ('Writing Practice', 'writing-practice', 'languages', 'Composition, style, expression', NULL, true, true),
  ('Culture and Context', 'culture-context', 'languages', 'Cultural understanding, idioms', NULL, true, true)
ON CONFLICT (slug) DO NOTHING;

-- Art additional topics
INSERT INTO topics (name, slug, subject, description, created_by, is_published, is_active) VALUES
  ('Sculpture and Ceramics', 'sculpture-ceramics', 'art', '3D art forms, modeling, pottery', NULL, true, true),
  ('Animation and Motion', 'animation-motion', 'art', 'Frame-by-frame, digital animation', NULL, true, true),
  ('Graphic Design', 'graphic-design', 'art', 'Visual communication, branding', NULL, true, true),
  ('Art Criticism', 'art-criticism', 'art', 'Analysis, interpretation, evaluation', NULL, true, true),
  ('Contemporary Art', 'contemporary-art', 'art', 'Modern movements, current trends', NULL, true, true)
ON CONFLICT (slug) DO NOTHING;

-- Engineering additional topics
INSERT INTO topics (name, slug, subject, description, created_by, is_published, is_active) VALUES
  ('Structural Engineering', 'structural-engineering', 'engineering', 'Buildings, bridges, load analysis', NULL, true, true),
  ('Electrical Circuits', 'electrical-circuits', 'engineering', 'Current, voltage, resistance, circuits', NULL, true, true),
  ('Materials Science', 'materials-science', 'engineering', 'Properties, selection, testing', NULL, true, true),
  ('Fluid Mechanics', 'fluid-mechanics', 'engineering', 'Flow, pressure, hydraulics', NULL, true, true),
  ('Control Systems', 'control-systems', 'engineering', 'Feedback, automation, regulation', NULL, true, true)
ON CONFLICT (slug) DO NOTHING;

-- Health additional topics
INSERT INTO topics (name, slug, subject, description, created_by, is_published, is_active) VALUES
  ('Mental Health Awareness', 'mental-health-awareness', 'health', 'Wellbeing, stress, mental conditions', NULL, true, true),
  ('Sports Science', 'sports-science', 'health', 'Exercise physiology, performance', NULL, true, true),
  ('First Aid Basics', 'first-aid-basics', 'health', 'Emergency response, CPR, treatment', NULL, true, true),
  ('Public Health', 'public-health', 'health', 'Epidemiology, disease prevention', NULL, true, true),
  ('Anatomy and Physiology', 'anatomy-physiology', 'health', 'Human body systems, functions', NULL, true, true)
ON CONFLICT (slug) DO NOTHING;

-- Other interdisciplinary topics
INSERT INTO topics (name, slug, subject, description, created_by, is_published, is_active) VALUES
  ('Critical Thinking', 'critical-thinking', 'other', 'Logic, reasoning, analysis', NULL, true, true),
  ('Environmental Studies', 'environmental-studies', 'other', 'Ecology, conservation, sustainability', NULL, true, true),
  ('Philosophy Basics', 'philosophy-basics', 'other', 'Ethics, logic, metaphysics', NULL, true, true),
  ('Study Skills', 'study-skills', 'other', 'Time management, note-taking, revision', NULL, true, true),
  ('Personal Finance', 'personal-finance', 'other', 'Budgeting, saving, investing', NULL, true, true)
ON CONFLICT (slug) DO NOTHING;

/*
  # Complete Subject and Topic Taxonomy
  
  ## Overview
  Seeds the complete StartSprint curriculum with 9 subjects and 90 topics (10 per subject).
  This is the final, production-ready taxonomy for the educational quiz platform.
  
  ## Structure
  - 9 core subjects (aligned with UK secondary education)
  - 10 topics per subject (90 topics total)
  - All topics are non-overlapping and school-ready
  
  ## Subjects
  1. Mathematics
  2. Science
  3. English
  4. Computing / IT
  5. Business
  6. Geography
  7. History
  8. Languages
  9. Art & Design
  
  ## Changes
  1. Deactivate old topics not in the taxonomy
  2. Insert all 9 subjects with their 90 topics
  3. Ensure no duplicates using slug-based uniqueness
*/

-- Deactivate topics not part of the new taxonomy
UPDATE topics
SET is_active = false
WHERE slug NOT IN (
  -- Mathematics topics
  'number-operations', 'fractions-decimals', 'percentages', 'ratios-proportion',
  'algebra-basics', 'linear-equations', 'geometry-fundamentals', 'angles-shapes',
  'data-handling-statistics', 'problem-solving',
  
  -- Science topics
  'scientific-skills-lab-safety', 'forces-motion', 'energy-electricity', 'states-of-matter',
  'chemical-reactions', 'acids-bases-salts', 'cell-biology', 'human-body-systems',
  'ecosystems-environment', 'earth-space-science',
  
  -- English topics
  'reading-comprehension', 'vocabulary-development', 'grammar-fundamentals', 'sentence-structure',
  'punctuation', 'writing-techniques', 'persuasive-writing', 'creative-writing',
  'poetry-analysis', 'language-devices',
  
  -- Computing topics
  'computer-systems', 'input-output-storage', 'data-representation', 'algorithms',
  'programming-basics', 'cyber-security', 'networks-internet', 'databases',
  'software-applications', 'digital-ethics',
  
  -- Business topics
  'purpose-of-business', 'types-of-business-ownership', 'entrepreneurship', 'market-research',
  'marketing-mix', 'finance-basics', 'profit-cost-revenue', 'operations-management',
  'human-resources', 'ethics-sustainability',
  
  -- Geography topics
  'map-skills', 'weather-climate', 'rivers-coasts', 'natural-hazards',
  'urban-environments', 'rural-environments', 'population-migration', 'economic-geography',
  'resources-energy', 'environmental-challenges',
  
  -- History topics
  'chronology-timelines', 'medieval-britain', 'the-tudors', 'the-stuarts',
  'industrial-revolution', 'british-empire', 'world-war-i', 'world-war-ii',
  'post-war-britain', 'historical-skills-sources',
  
  -- Languages topics
  'greetings-introductions', 'numbers-dates', 'family-relationships', 'daily-routines',
  'food-drink', 'travel-directions', 'school-education', 'hobbies-free-time',
  'health-wellbeing', 'cultural-awareness',
  
  -- Art & Design topics
  'elements-of-art', 'colour-theory', 'drawing-techniques', 'painting-techniques',
  'sculpture-3d-art', 'graphic-design', 'typography', 'art-movements',
  'famous-artists', 'creative-processes'
);

-- 1. MATHEMATICS (10 topics)
INSERT INTO topics (name, slug, description, subject, is_active) VALUES
  ('Number Operations', 'number-operations', 'Addition, subtraction, multiplication and division of whole numbers and integers', 'mathematics', true),
  ('Fractions & Decimals', 'fractions-decimals', 'Understanding and working with fractions, decimals and their conversions', 'mathematics', true),
  ('Percentages', 'percentages', 'Calculating percentages, percentage increase/decrease and applications', 'mathematics', true),
  ('Ratios & Proportion', 'ratios-proportion', 'Simplifying ratios, solving proportion problems and scaling', 'mathematics', true),
  ('Algebra Basics', 'algebra-basics', 'Algebraic expressions, simplification and substitution', 'mathematics', true),
  ('Linear Equations', 'linear-equations', 'Solving linear equations and inequalities', 'mathematics', true),
  ('Geometry Fundamentals', 'geometry-fundamentals', 'Properties of 2D and 3D shapes, perimeter, area and volume', 'mathematics', true),
  ('Angles & Shapes', 'angles-shapes', 'Angle properties, parallel lines, triangles and polygons', 'mathematics', true),
  ('Data Handling & Statistics', 'data-handling-statistics', 'Collecting, presenting and interpreting data, averages and range', 'mathematics', true),
  ('Problem Solving', 'problem-solving', 'Multi-step problems and mathematical reasoning', 'mathematics', true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  subject = EXCLUDED.subject,
  is_active = EXCLUDED.is_active;

-- 2. SCIENCE (10 topics)
INSERT INTO topics (name, slug, description, subject, is_active) VALUES
  ('Scientific Skills & Lab Safety', 'scientific-skills-lab-safety', 'Scientific method, experiments, safety and equipment use', 'science', true),
  ('Forces & Motion', 'forces-motion', 'Contact and non-contact forces, motion, speed and acceleration', 'science', true),
  ('Energy & Electricity', 'energy-electricity', 'Energy transfers, conservation, circuits and electricity', 'science', true),
  ('States of Matter', 'states-of-matter', 'Solids, liquids, gases and changes of state', 'science', true),
  ('Chemical Reactions', 'chemical-reactions', 'Types of reactions, reactants, products and equations', 'science', true),
  ('Acids, Bases & Salts', 'acids-bases-salts', 'Properties of acids and bases, pH scale and neutralisation', 'science', true),
  ('Cell Biology', 'cell-biology', 'Cell structure, function, specialisation and organisation', 'science', true),
  ('Human Body Systems', 'human-body-systems', 'Digestive, respiratory, circulatory and nervous systems', 'science', true),
  ('Ecosystems & Environment', 'ecosystems-environment', 'Food chains, habitats, adaptation and environmental impact', 'science', true),
  ('Earth & Space Science', 'earth-space-science', 'Solar system, Earth structure, rocks and the water cycle', 'science', true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  subject = EXCLUDED.subject,
  is_active = EXCLUDED.is_active;

-- 3. ENGLISH (10 topics)
INSERT INTO topics (name, slug, description, subject, is_active) VALUES
  ('Reading Comprehension', 'reading-comprehension', 'Understanding texts, inference and retrieval skills', 'english', true),
  ('Vocabulary Development', 'vocabulary-development', 'Word meanings, context, synonyms and antonyms', 'english', true),
  ('Grammar Fundamentals', 'grammar-fundamentals', 'Parts of speech, tenses and subject-verb agreement', 'english', true),
  ('Sentence Structure', 'sentence-structure', 'Simple, compound and complex sentences', 'english', true),
  ('Punctuation', 'punctuation', 'Correct use of commas, apostrophes, colons and semicolons', 'english', true),
  ('Writing Techniques', 'writing-techniques', 'Planning, structuring and improving written work', 'english', true),
  ('Persuasive Writing', 'persuasive-writing', 'Arguments, opinions, rhetorical devices and formal letters', 'english', true),
  ('Creative Writing', 'creative-writing', 'Narrative techniques, description and characterisation', 'english', true),
  ('Poetry Analysis', 'poetry-analysis', 'Understanding form, structure, language and meaning', 'english', true),
  ('Language Devices', 'language-devices', 'Metaphor, simile, alliteration and other literary techniques', 'english', true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  subject = EXCLUDED.subject,
  is_active = EXCLUDED.is_active;

-- 4. COMPUTING / IT (10 topics)
INSERT INTO topics (name, slug, description, subject, is_active) VALUES
  ('Computer Systems', 'computer-systems', 'Hardware components, von Neumann architecture and CPU', 'computing', true),
  ('Input, Output & Storage', 'input-output-storage', 'Types of input/output devices and storage media', 'computing', true),
  ('Data Representation', 'data-representation', 'Binary, hexadecimal, character encoding and file sizes', 'computing', true),
  ('Algorithms', 'algorithms', 'Designing, representing and evaluating algorithms', 'computing', true),
  ('Programming Basics', 'programming-basics', 'Variables, data types, selection and iteration', 'computing', true),
  ('Cyber Security', 'cyber-security', 'Threats, prevention, malware and safe online practices', 'computing', true),
  ('Networks & Internet', 'networks-internet', 'Network types, protocols, topologies and connectivity', 'computing', true),
  ('Databases', 'databases', 'Data storage, queries, relationships and data management', 'computing', true),
  ('Software & Applications', 'software-applications', 'Types of software, operating systems and applications', 'computing', true),
  ('Digital Ethics', 'digital-ethics', 'Privacy, copyright, digital footprint and responsible use', 'computing', true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  subject = EXCLUDED.subject,
  is_active = EXCLUDED.is_active;

-- 5. BUSINESS (10 topics)
INSERT INTO topics (name, slug, description, subject, is_active) VALUES
  ('Purpose of Business', 'purpose-of-business', 'Objectives, stakeholders and business aims', 'business', true),
  ('Types of Business Ownership', 'types-of-business-ownership', 'Sole traders, partnerships, LTDs and PLCs', 'business', true),
  ('Entrepreneurship', 'entrepreneurship', 'Business ideas, risk, innovation and enterprise', 'business', true),
  ('Market Research', 'market-research', 'Primary and secondary research, sampling and analysis', 'business', true),
  ('Marketing Mix', 'marketing-mix', 'Product, price, place and promotion strategies', 'business', true),
  ('Finance Basics', 'finance-basics', 'Cash flow, budgeting and sources of finance', 'business', true),
  ('Profit, Cost & Revenue', 'profit-cost-revenue', 'Calculations, break-even and financial statements', 'business', true),
  ('Operations Management', 'operations-management', 'Production, quality, supply chains and efficiency', 'business', true),
  ('Human Resources', 'human-resources', 'Recruitment, training, motivation and workforce planning', 'business', true),
  ('Ethics & Sustainability', 'ethics-sustainability', 'Corporate responsibility, environmental impact and ethical practices', 'business', true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  subject = EXCLUDED.subject,
  is_active = EXCLUDED.is_active;

-- 6. GEOGRAPHY (10 topics)
INSERT INTO topics (name, slug, description, subject, is_active) VALUES
  ('Map Skills', 'map-skills', 'Grid references, scale, symbols and map reading', 'geography', true),
  ('Weather & Climate', 'weather-climate', 'Atmospheric processes, climate zones and weather patterns', 'geography', true),
  ('Rivers & Coasts', 'rivers-coasts', 'River processes, landforms, coastal erosion and deposition', 'geography', true),
  ('Natural Hazards', 'natural-hazards', 'Earthquakes, volcanoes, tropical storms and their impacts', 'geography', true),
  ('Urban Environments', 'urban-environments', 'Urbanisation, city structure and urban challenges', 'geography', true),
  ('Rural Environments', 'rural-environments', 'Rural landscapes, farming and countryside changes', 'geography', true),
  ('Population & Migration', 'population-migration', 'Population distribution, density, growth and migration patterns', 'geography', true),
  ('Economic Geography', 'economic-geography', 'Development, trade, globalisation and economic sectors', 'geography', true),
  ('Resources & Energy', 'resources-energy', 'Renewable and non-renewable resources and energy security', 'geography', true),
  ('Environmental Challenges', 'environmental-challenges', 'Climate change, deforestation and conservation', 'geography', true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  subject = EXCLUDED.subject,
  is_active = EXCLUDED.is_active;

-- 7. HISTORY (10 topics)
INSERT INTO topics (name, slug, description, subject, is_active) VALUES
  ('Chronology & Timelines', 'chronology-timelines', 'Understanding historical periods, dates and sequences', 'history', true),
  ('Medieval Britain', 'medieval-britain', '1066-1485: Norman Conquest, feudalism and the Plantagenets', 'history', true),
  ('The Tudors', 'the-tudors', '1485-1603: Henry VIII, Reformation and Elizabeth I', 'history', true),
  ('The Stuarts', 'the-stuarts', '1603-1714: Civil War, Commonwealth and Restoration', 'history', true),
  ('Industrial Revolution', 'industrial-revolution', '1750-1900: Industrialisation, urbanisation and social change', 'history', true),
  ('British Empire', 'british-empire', 'Expansion, impact, trade and colonialism', 'history', true),
  ('World War I', 'world-war-i', '1914-1918: Causes, key battles, trench warfare and consequences', 'history', true),
  ('World War II', 'world-war-ii', '1939-1945: Global conflict, Holocaust and home front', 'history', true),
  ('Post-War Britain', 'post-war-britain', '1945-present: Welfare state, social change and modern Britain', 'history', true),
  ('Historical Skills & Sources', 'historical-skills-sources', 'Analysing evidence, interpretation and historical enquiry', 'history', true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  subject = EXCLUDED.subject,
  is_active = EXCLUDED.is_active;

-- 8. LANGUAGES (10 topics)
INSERT INTO topics (name, slug, description, subject, is_active) VALUES
  ('Greetings & Introductions', 'greetings-introductions', 'Basic greetings, introducing yourself and others', 'languages', true),
  ('Numbers & Dates', 'numbers-dates', 'Counting, telling time, days, months and years', 'languages', true),
  ('Family & Relationships', 'family-relationships', 'Describing family members and personal relationships', 'languages', true),
  ('Daily Routines', 'daily-routines', 'Describing everyday activities and habits', 'languages', true),
  ('Food & Drink', 'food-drink', 'Meals, ordering food, preferences and restaurants', 'languages', true),
  ('Travel & Directions', 'travel-directions', 'Transport, giving directions and navigating places', 'languages', true),
  ('School & Education', 'school-education', 'School subjects, timetables and educational vocabulary', 'languages', true),
  ('Hobbies & Free Time', 'hobbies-free-time', 'Sports, interests, activities and entertainment', 'languages', true),
  ('Health & Wellbeing', 'health-wellbeing', 'Body parts, illnesses, fitness and healthy living', 'languages', true),
  ('Cultural Awareness', 'cultural-awareness', 'Customs, celebrations, traditions and cultural differences', 'languages', true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  subject = EXCLUDED.subject,
  is_active = EXCLUDED.is_active;

-- 9. ART & DESIGN (10 topics)
INSERT INTO topics (name, slug, description, subject, is_active) VALUES
  ('Elements of Art', 'elements-of-art', 'Line, shape, form, texture, space and value', 'art', true),
  ('Colour Theory', 'colour-theory', 'Primary, secondary, tertiary colours and colour relationships', 'art', true),
  ('Drawing Techniques', 'drawing-techniques', 'Pencil, charcoal, pen and observational drawing', 'art', true),
  ('Painting Techniques', 'painting-techniques', 'Watercolour, acrylic, oil and mixed media', 'art', true),
  ('Sculpture & 3D Art', 'sculpture-3d-art', 'Clay, construction, carving and installation art', 'art', true),
  ('Graphic Design', 'graphic-design', 'Layout, composition, logos and visual communication', 'art', true),
  ('Typography', 'typography', 'Font styles, hierarchy and text in design', 'art', true),
  ('Art Movements', 'art-movements', 'Impressionism, Cubism, Pop Art and contemporary movements', 'art', true),
  ('Famous Artists', 'famous-artists', 'Study of influential artists and their techniques', 'art', true),
  ('Creative Processes', 'creative-processes', 'Brainstorming, experimentation, refinement and evaluation', 'art', true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  subject = EXCLUDED.subject,
  is_active = EXCLUDED.is_active;

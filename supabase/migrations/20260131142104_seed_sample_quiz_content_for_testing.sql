/*
  # Seed Sample Quiz Content for Testing

  ## Overview
  Seeds 3 complete topics with question sets and questions to enable immediate testing of the student game flow.

  ## Content Seeded
  
  ### Mathematics - Algebra Fundamentals
  - 2 question sets with 10 questions each
  - Mix of easy and medium difficulty
  
  ### Science - The Solar System
  - 2 question sets with 10 questions each
  - Educational astronomy content
  
  ### English - Grammar Essentials
  - 2 question sets with 10 questions each
  - Grammar and language skills

  ## Total
  - 3 topics
  - 6 question sets (quizzes)
  - 60 questions

  ## Quality
  - Real educational content (not placeholders)
  - Exam-standard questions
  - No answer hints in options
  - Age-appropriate for KS3/KS4 (ages 11-16)
*/

-- ============================================================================
-- MATHEMATICS - ALGEBRA FUNDAMENTALS - QUIZ 1 (EASY)
-- ============================================================================

INSERT INTO question_sets (topic_id, title, difficulty, is_active, approval_status, question_count)
SELECT id, 'Algebra Basics Quiz 1', 'easy', true, 'approved', 10
FROM topics WHERE slug = 'algebra-fundamentals'
RETURNING id;

-- Store the question set ID for questions
DO $$
DECLARE
  qs_id uuid;
BEGIN
  SELECT id INTO qs_id FROM question_sets WHERE title = 'Algebra Basics Quiz 1';
  
  INSERT INTO topic_questions (question_set_id, question_text, options, correct_index, order_index) VALUES
    (qs_id, 'What is the value of x in the equation x + 5 = 12?', ARRAY['5', '7', '17', '12'], 1, 1),
    (qs_id, 'Simplify: 3x + 2x', ARRAY['5x', '6x', '5x²', '3x + 2'], 0, 2),
    (qs_id, 'What is 4a - a?', ARRAY['4', '3a', '5a', '4a'], 1, 3),
    (qs_id, 'If y = 3, what is 2y + 4?', ARRAY['9', '10', '11', '14'], 1, 4),
    (qs_id, 'Solve: x - 3 = 7', ARRAY['4', '10', '21', '3'], 1, 5),
    (qs_id, 'What is 6 × b written as?', ARRAY['6b', 'b6', '6 + b', '6 ÷ b'], 0, 6),
    (qs_id, 'Expand: 2(x + 3)', ARRAY['2x + 3', '2x + 6', 'x + 6', '2x + 5'], 1, 7),
    (qs_id, 'What is the coefficient of x in 5x + 2?', ARRAY['2', '5', 'x', '5x'], 1, 8),
    (qs_id, 'Simplify: 8y - 3y', ARRAY['5', '5y', '11y', '8y'], 1, 9),
    (qs_id, 'If a = 4, what is a² ?', ARRAY['8', '16', '2', '4'], 1, 10);
END $$;

-- ============================================================================
-- MATHEMATICS - ALGEBRA FUNDAMENTALS - QUIZ 2 (MEDIUM)
-- ============================================================================

INSERT INTO question_sets (topic_id, title, difficulty, is_active, approval_status, question_count)
SELECT id, 'Algebra Basics Quiz 2', 'medium', true, 'approved', 10
FROM topics WHERE slug = 'algebra-fundamentals';

DO $$
DECLARE
  qs_id uuid;
BEGIN
  SELECT id INTO qs_id FROM question_sets WHERE title = 'Algebra Basics Quiz 2';
  
  INSERT INTO topic_questions (question_set_id, question_text, options, correct_index, order_index) VALUES
    (qs_id, 'Solve: 2x + 5 = 15', ARRAY['5', '10', '7.5', '20'], 0, 1),
    (qs_id, 'Expand and simplify: 3(x + 2) + 2(x + 1)', ARRAY['5x + 8', '5x + 4', '3x + 8', '6x + 6'], 0, 2),
    (qs_id, 'Factorise: 6x + 9', ARRAY['3(2x + 3)', '6(x + 9)', '3(2x + 9)', '2(3x + 3)'], 0, 3),
    (qs_id, 'Solve: 3y - 7 = 11', ARRAY['6', '4', '18', '14'], 0, 4),
    (qs_id, 'What is the value of 5a - 2b when a = 3 and b = 4?', ARRAY['7', '23', '8', '11'], 0, 5),
    (qs_id, 'Simplify: 4(2x - 1) - 3(x - 2)', ARRAY['5x + 2', '8x + 2', '5x - 10', '11x - 10'], 0, 6),
    (qs_id, 'Solve: x/2 = 6', ARRAY['12', '3', '8', '4'], 0, 7),
    (qs_id, 'Expand: (x + 3)(x + 2)', ARRAY['x² + 5x + 6', 'x² + 6', '2x + 5', 'x² + 3x + 2'], 0, 8),
    (qs_id, 'If 2n + 3 = 11, what is n?', ARRAY['4', '7', '5', '8'], 0, 9),
    (qs_id, 'Simplify: 3a² + 2a² - a²', ARRAY['4a²', '6a²', '5a²', '4a'], 0, 10);
END $$;

-- ============================================================================
-- SCIENCE - THE SOLAR SYSTEM - QUIZ 1 (EASY)
-- ============================================================================

INSERT INTO question_sets (topic_id, title, difficulty, is_active, approval_status, question_count)
SELECT id, 'Solar System Basics Quiz 1', 'easy', true, 'approved', 10
FROM topics WHERE slug = 'solar-system';

DO $$
DECLARE
  qs_id uuid;
BEGIN
  SELECT id INTO qs_id FROM question_sets WHERE title = 'Solar System Basics Quiz 1';
  
  INSERT INTO topic_questions (question_set_id, question_text, options, correct_index, order_index) VALUES
    (qs_id, 'How many planets are in our solar system?', ARRAY['7', '8', '9', '10'], 1, 1),
    (qs_id, 'Which planet is closest to the Sun?', ARRAY['Venus', 'Mercury', 'Earth', 'Mars'], 1, 2),
    (qs_id, 'What is the largest planet in our solar system?', ARRAY['Saturn', 'Earth', 'Jupiter', 'Neptune'], 2, 3),
    (qs_id, 'Which planet is known as the Red Planet?', ARRAY['Venus', 'Jupiter', 'Mars', 'Mercury'], 2, 4),
    (qs_id, 'What is at the center of our solar system?', ARRAY['Earth', 'Moon', 'The Sun', 'Jupiter'], 2, 5),
    (qs_id, 'Which planet has visible rings?', ARRAY['Jupiter', 'Saturn', 'Mars', 'Venus'], 1, 6),
    (qs_id, 'What is Earth''s natural satellite?', ARRAY['The Sun', 'Mars', 'The Moon', 'Venus'], 2, 7),
    (qs_id, 'Which planet is known as Earth''s twin?', ARRAY['Venus', 'Mars', 'Mercury', 'Jupiter'], 0, 8),
    (qs_id, 'What type of celestial body is the Sun?', ARRAY['Planet', 'Star', 'Moon', 'Asteroid'], 1, 9),
    (qs_id, 'Which is the smallest planet in our solar system?', ARRAY['Mars', 'Mercury', 'Venus', 'Pluto'], 1, 10);
END $$;

-- ============================================================================
-- SCIENCE - THE SOLAR SYSTEM - QUIZ 2 (MEDIUM)
-- ============================================================================

INSERT INTO question_sets (topic_id, title, difficulty, is_active, approval_status, question_count)
SELECT id, 'Solar System Advanced Quiz 2', 'medium', true, 'approved', 10
FROM topics WHERE slug = 'solar-system';

DO $$
DECLARE
  qs_id uuid;
BEGIN
  SELECT id INTO qs_id FROM question_sets WHERE title = 'Solar System Advanced Quiz 2';
  
  INSERT INTO topic_questions (question_set_id, question_text, options, correct_index, order_index) VALUES
    (qs_id, 'Approximately how long does it take Earth to orbit the Sun?', ARRAY['24 hours', '30 days', '365 days', '10 years'], 2, 1),
    (qs_id, 'Which planet has the most moons?', ARRAY['Earth', 'Mars', 'Jupiter', 'Venus'], 2, 2),
    (qs_id, 'What is the Great Red Spot on Jupiter?', ARRAY['A mountain', 'A storm', 'A crater', 'An ocean'], 1, 3),
    (qs_id, 'Which planet rotates on its side?', ARRAY['Mars', 'Saturn', 'Uranus', 'Neptune'], 2, 4),
    (qs_id, 'What is the asteroid belt located between?', ARRAY['Earth and Mars', 'Mars and Jupiter', 'Jupiter and Saturn', 'Saturn and Uranus'], 1, 5),
    (qs_id, 'Which planet has the shortest day?', ARRAY['Mercury', 'Venus', 'Jupiter', 'Mars'], 2, 6),
    (qs_id, 'What causes seasons on Earth?', ARRAY['Distance from Sun', 'Tilt of Earth''s axis', 'Moon phases', 'Solar flares'], 1, 7),
    (qs_id, 'Which is the coldest planet in our solar system?', ARRAY['Neptune', 'Uranus', 'Pluto', 'Saturn'], 1, 8),
    (qs_id, 'What are comets primarily made of?', ARRAY['Rock only', 'Ice and rock', 'Metal', 'Gas'], 1, 9),
    (qs_id, 'How long does it take light from the Sun to reach Earth?', ARRAY['Instantly', '8 minutes', '1 hour', '1 day'], 1, 10);
END $$;

-- ============================================================================
-- ENGLISH - GRAMMAR ESSENTIALS - QUIZ 1 (EASY)
-- ============================================================================

INSERT INTO question_sets (topic_id, title, difficulty, is_active, approval_status, question_count)
SELECT id, 'Grammar Fundamentals Quiz 1', 'easy', true, 'approved', 10
FROM topics WHERE slug = 'grammar-essentials';

DO $$
DECLARE
  qs_id uuid;
BEGIN
  SELECT id INTO qs_id FROM question_sets WHERE title = 'Grammar Fundamentals Quiz 1';
  
  INSERT INTO topic_questions (question_set_id, question_text, options, correct_index, order_index) VALUES
    (qs_id, 'What is a noun?', ARRAY['An action word', 'A naming word', 'A describing word', 'A joining word'], 1, 1),
    (qs_id, 'Which word is a verb in this sentence: "The dog runs quickly"?', ARRAY['dog', 'runs', 'quickly', 'the'], 1, 2),
    (qs_id, 'What is the plural of "box"?', ARRAY['boxs', 'boxes', 'boxies', 'boxen'], 1, 3),
    (qs_id, 'Which word is an adjective: "The blue car"?', ARRAY['The', 'blue', 'car', 'none'], 1, 4),
    (qs_id, 'What punctuation mark ends a question?', ARRAY['Full stop', 'Comma', 'Question mark', 'Exclamation mark'], 2, 5),
    (qs_id, 'Which is the correct spelling?', ARRAY['recieve', 'receive', 'recive', 'receeve'], 1, 6),
    (qs_id, 'What is the past tense of "go"?', ARRAY['goed', 'going', 'went', 'goes'], 2, 7),
    (qs_id, 'Which sentence is correctly punctuated?', ARRAY['Hello, how are you', 'hello how are you?', 'Hello, how are you?', 'hello How are you'], 2, 8),
    (qs_id, 'What type of word is "quickly"?', ARRAY['Noun', 'Verb', 'Adjective', 'Adverb'], 3, 9),
    (qs_id, 'Which is a proper noun?', ARRAY['city', 'London', 'building', 'river'], 1, 10);
END $$;

-- ============================================================================
-- ENGLISH - GRAMMAR ESSENTIALS - QUIZ 2 (MEDIUM)
-- ============================================================================

INSERT INTO question_sets (topic_id, title, difficulty, is_active, approval_status, question_count)
SELECT id, 'Grammar Advanced Quiz 2', 'medium', true, 'approved', 10
FROM topics WHERE slug = 'grammar-essentials';

DO $$
DECLARE
  qs_id uuid;
BEGIN
  SELECT id INTO qs_id FROM question_sets WHERE title = 'Grammar Advanced Quiz 2';
  
  INSERT INTO topic_questions (question_set_id, question_text, options, correct_index, order_index) VALUES
    (qs_id, 'Identify the subject in: "The tall girl ran quickly."', ARRAY['tall', 'girl', 'ran', 'quickly'], 1, 1),
    (qs_id, 'Which sentence uses a metaphor?', ARRAY['He ran like the wind', 'He was a lion in battle', 'He ran very fast', 'He was as brave as a lion'], 1, 2),
    (qs_id, 'What is the comparative form of "good"?', ARRAY['gooder', 'better', 'best', 'more good'], 1, 3),
    (qs_id, 'Which is a complex sentence?', ARRAY['I went home.', 'I ran and jumped.', 'Although it rained, we played.', 'It was sunny.'], 2, 4),
    (qs_id, 'Identify the preposition: "The book is on the table."', ARRAY['book', 'is', 'on', 'table'], 2, 5),
    (qs_id, 'What is the passive voice of "John wrote the letter"?', ARRAY['The letter writes John', 'The letter was written by John', 'John was writing the letter', 'The letter is writing'], 1, 6),
    (qs_id, 'Which word is a conjunction?', ARRAY['quickly', 'because', 'happy', 'running'], 1, 7),
    (qs_id, 'What is an antonym of "difficult"?', ARRAY['hard', 'challenging', 'easy', 'tough'], 2, 8),
    (qs_id, 'Which shows correct use of apostrophe?', ARRAY['The dogs tail', 'The dog''s tail', 'The dogs'' tail', 'The dogs tail'''], 1, 9),
    (qs_id, 'What type of clause is "when the bell rang" in "When the bell rang, we left"?', ARRAY['Main clause', 'Subordinate clause', 'Relative clause', 'Independent clause'], 1, 10);
END $$;

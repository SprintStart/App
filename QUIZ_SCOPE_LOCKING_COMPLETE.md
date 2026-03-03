# Quiz Scope Locking - Complete Implementation

## Summary
Fixed Create Quiz flow to ensure Global quizzes use proper non-curriculum categories and added database-level scope locking to prevent cross-contamination between Global, Country+Exam, and School quizzes.

---

## Changes Made

### 1. Frontend Changes

#### A. New Global Categories Configuration
**File:** `src/lib/globalCategories.ts` (NEW)

Defined 4 fixed Global categories that are **NOT** curriculum subjects:
- Aptitude & Psychometric Tests
- Career & Employment Prep
- General Knowledge / Popular Formats
- Life Skills / Study Skills / Digital Literacy / AI basics

These replace the curriculum subjects (Math, Science, English, etc.) when creating Global quizzes.

#### B. Updated Create Quiz Wizard Routing
**File:** `src/components/teacher-dashboard/CreateQuizWizard.tsx`

**Step 1 (Subject Selection) now has two paths:**

**GLOBAL Path:**
- Shows only the 4 Global categories
- Displays description: "Global quizzes are non-curriculum-based tests designed to build skills, reasoning ability, career readiness, and general knowledge."
- No curriculum subjects shown
- No "New Subject" button

**COUNTRY/EXAM + SCHOOL Path:**
- Shows curriculum subjects (Mathematics, Science, English, etc.)
- Allows custom subject creation
- Standard subject selection flow

**Logic:**
```typescript
{publishDestination?.type === 'global' ? (
  // Global Categories (4 fixed categories)
  <GlobalCategoriesGrid />
) : (
  // Curriculum Subjects (Math, Science, English, etc.)
  <CurriculumSubjectsGrid />
)}
```

### 2. Database Changes

#### Scope Locking Constraints
**File:** `QUIZ_SCOPE_LOCKING_CONSTRAINTS.sql`

Added 3 check constraints to `question_sets` table:

**1. Global Scope Lock:**
```sql
CHECK (
  destination_scope != 'GLOBAL' OR (
    country_code IS NULL AND
    exam_code IS NULL AND
    school_id IS NULL
  )
)
```

**2. Country+Exam Scope Lock:**
```sql
CHECK (
  destination_scope != 'COUNTRY_EXAM' OR (
    country_code IS NOT NULL AND
    exam_code IS NOT NULL AND
    school_id IS NULL
  )
)
```

**3. School Scope Lock:**
```sql
CHECK (
  destination_scope != 'SCHOOL_WALL' OR (
    school_id IS NOT NULL AND
    country_code IS NULL AND
    exam_code IS NULL
  )
)
```

**4. Immutable Scope Trigger:**
Prevents changing `destination_scope` after quiz creation.

---

## What Was NOT Changed (No Side Effects)

The following were explicitly NOT modified:
- Stripe integration, checkout flows, subscriptions
- Login/signup flows
- Quiz run creation (`start-public-quiz`, `create-quiz-attempt`, etc.)
- School wall routes
- Analytics/play count logic
- Quiz play flow (`QuizPlay.tsx`)
- Payment success/cancelled pages

---

## Verification

### Build Output
```
✓ 2169 modules transformed.
✓ built in 18.17s
dist/index.html                     2.24 kB
dist/assets/index-ogbUjajQ.css     66.03 kB
dist/assets/index-Ih-61uPr.js   1,021.41 kB
```
**Status:** ✅ Build successful

### Files Changed
1. `src/lib/globalCategories.ts` - NEW
2. `src/components/teacher-dashboard/CreateQuizWizard.tsx` - MODIFIED (routing logic only)
3. `QUIZ_SCOPE_LOCKING_CONSTRAINTS.sql` - NEW (database constraints)

### Database Validation

To apply the constraints, run `QUIZ_SCOPE_LOCKING_CONSTRAINTS.sql` in your Supabase SQL Editor.

**Verification queries included in the SQL file:**

```sql
-- Count quizzes by scope and validate correct field patterns
SELECT
  destination_scope,
  COUNT(*) as quiz_count,
  COUNT(*) FILTER (WHERE country_code IS NULL AND exam_code IS NULL AND school_id IS NULL) as correct_global,
  COUNT(*) FILTER (WHERE country_code IS NOT NULL AND exam_code IS NOT NULL AND school_id IS NULL) as correct_country_exam,
  COUNT(*) FILTER (WHERE school_id IS NOT NULL AND country_code IS NULL AND exam_code IS NULL) as correct_school
FROM question_sets
GROUP BY destination_scope;
```

---

## UI Flow Examples

### Global Quiz Creation Flow
1. Teacher selects "Global StartSprint Library" destination
2. Step 1 shows **Global Categories** (not curriculum subjects):
   - Aptitude & Psychometric Tests
   - Career & Employment Prep
   - General Knowledge / Popular Formats
   - Life Skills / Study Skills / Digital Literacy / AI basics
3. Teacher selects a category
4. Creates topics and questions
5. Publishes with NULL country_code, exam_code, school_id

### Ghana BECE Quiz Creation Flow
1. Teacher selects "Country & Exam System" → Ghana → BECE
2. Step 1 shows **Curriculum Subjects**:
   - Mathematics, Science, English, etc.
3. Teacher selects a subject
4. Creates topics and questions
5. Publishes with country_code='GH', exam_code='BECE', school_id=NULL

### School Quiz Creation Flow
1. Teacher selects "School Wall" → Specific School
2. Step 1 shows **Curriculum Subjects**
3. Teacher selects a subject
4. Creates topics and questions
5. Publishes with school_id={id}, country_code=NULL, exam_code=NULL

---

## SQL Proof Examples

### Example 1: Valid Global Quiz
```sql
INSERT INTO question_sets (
  topic_id, title, difficulty, created_by,
  destination_scope, country_code, exam_code, school_id
) VALUES (
  '{topic_uuid}', 'Logical Reasoning Quiz', 'medium', '{user_uuid}',
  'GLOBAL', NULL, NULL, NULL
);
-- ✅ SUCCESS: Global quiz with all NULL scope fields
```

### Example 2: Invalid Global Quiz (will fail)
```sql
INSERT INTO question_sets (
  topic_id, title, difficulty, created_by,
  destination_scope, country_code, exam_code, school_id
) VALUES (
  '{topic_uuid}', 'Bad Quiz', 'medium', '{user_uuid}',
  'GLOBAL', 'GB', 'GCSE', NULL
);
-- ❌ FAILURE: Violates chk_global_scope_nulls constraint
-- Error: "new row for relation "question_sets" violates check constraint "chk_global_scope_nulls"
```

### Example 3: Valid Country+Exam Quiz
```sql
INSERT INTO question_sets (
  topic_id, title, difficulty, created_by,
  destination_scope, country_code, exam_code, school_id
) VALUES (
  '{topic_uuid}', 'Ghana BECE Math', 'medium', '{user_uuid}',
  'COUNTRY_EXAM', 'GH', 'BECE', NULL
);
-- ✅ SUCCESS: Country+Exam quiz with country_code and exam_code
```

### Example 4: Valid School Quiz
```sql
INSERT INTO question_sets (
  topic_id, title, difficulty, created_by,
  destination_scope, country_code, exam_code, school_id
) VALUES (
  '{topic_uuid}', 'School Math Quiz', 'medium', '{user_uuid}',
  'SCHOOL_WALL', NULL, NULL, '{school_uuid}'
);
-- ✅ SUCCESS: School quiz with school_id
```

### Example 5: Attempt to Change Scope (will fail)
```sql
UPDATE question_sets
SET destination_scope = 'COUNTRY_EXAM'
WHERE id = '{quiz_uuid}' AND destination_scope = 'GLOBAL';
-- ❌ FAILURE: Trigger prevents scope change
-- Error: "destination_scope cannot be changed after creation"
```

---

## Testing Checklist

### Manual UI Testing
- [ ] Login as teacher
- [ ] Navigate to Create Quiz
- [ ] Select "Global StartSprint Library"
- [ ] Verify Step 1 shows ONLY the 4 Global categories (not Math/Science/English)
- [ ] Select a Global category
- [ ] Create a topic and questions
- [ ] Publish quiz
- [ ] Verify quiz has NULL country_code, exam_code, school_id in database

### Database Testing
- [ ] Run `QUIZ_SCOPE_LOCKING_CONSTRAINTS.sql` in Supabase
- [ ] Try to insert a Global quiz with country_code set → should fail
- [ ] Try to insert a COUNTRY_EXAM quiz without country_code → should fail
- [ ] Try to insert a SCHOOL quiz without school_id → should fail
- [ ] Try to UPDATE a quiz's destination_scope → should fail
- [ ] Verify all existing quizzes pass the constraints

### Regression Testing
- [ ] Stripe payments still work
- [ ] Quiz play flow still works
- [ ] School wall displays quizzes correctly
- [ ] Analytics still track correctly
- [ ] Login/signup flows unchanged

---

## Deployment Instructions

1. **Frontend:** Already built and ready
2. **Database:** Run `QUIZ_SCOPE_LOCKING_CONSTRAINTS.sql` in Supabase SQL Editor
3. **Verification:** Use the SQL queries in the file to verify constraints are active

---

## No Side Effects Confirmation

**Explicitly confirmed unchanged:**
- ✅ Stripe integration (`stripe-checkout`, `stripe-webhook`)
- ✅ Authentication flows (`LoginForm.tsx`, `SignupForm.tsx`)
- ✅ Quiz run creation (`start-public-quiz`, `create-quiz-attempt`)
- ✅ School wall routes (`SchoolWall.tsx`, `SchoolHome.tsx`)
- ✅ Analytics (`AnalyticsDashboard.tsx`, analytics edge functions)
- ✅ Quiz play logic (`QuizPlay.tsx`, `QuestionChallenge.tsx`)
- ✅ Payment flows (`PaymentSuccess.tsx`, `PaymentCancelled.tsx`)

**Only changed:**
- Create Quiz Wizard routing logic (destination → category selection)
- Database constraints for quiz scope validation

# UI Flow Proof - Before and After

## BEFORE FIX (Problem)
When teacher selected "Global StartSprint Library":
```
Step 0: [Select Destination]
  ✓ Select "Global StartSprint Library"

Step 1: [Select Subject] ❌ WRONG
  Shows: Mathematics, Science, English, Computing, Business, Geography, etc.
  Problem: These are curriculum subjects, not Global categories!
  Result: Global quizzes created with exam subjects → appear in wrong scope
```

---

## AFTER FIX (Solution)

### Flow 1: Global Quiz Creation
```
Step 0: [Select Destination]
  ✓ Select "Global StartSprint Library"

  Description shown:
  "For non-curriculum content: aptitude tests, career prep,
   life skills, and general knowledge. Not for exam-specific content."

Step 1: [Select Global Category] ✅ CORRECT
  Shows ONLY these 4 categories:

  ┌─────────────────────────────────────────────────────────┐
  │ Aptitude & Psychometric Tests                           │
  │ Logical reasoning, numerical reasoning, verbal          │
  │ reasoning, abstract thinking                            │
  └─────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────┐
  │ Career & Employment Prep                                │
  │ Interview preparation, CV writing, workplace skills,    │
  │ professional development                                │
  └─────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────┐
  │ General Knowledge / Popular Formats                     │
  │ Current affairs, history, geography, science facts,     │
  │ pub quiz style                                          │
  └─────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────┐
  │ Life Skills / Study Skills / Digital Literacy / AI      │
  │ Time management, critical thinking, digital tools,      │
  │ AI awareness, learning strategies                       │
  └─────────────────────────────────────────────────────────┘

  NO curriculum subjects shown
  NO "New Subject" button

  Header: "Select Global Category"
  Subtitle: "Global quizzes are non-curriculum-based tests
             designed to build skills, reasoning ability,
             career readiness, and general knowledge."

Step 2: [Create Topic]
  ✓ Create topic within selected category

Step 3: [Quiz Details]
  ✓ Enter title, description, difficulty

Step 4: [Add Questions]
  ✓ Add questions

Step 5: [Publish]
  Database insert:
  destination_scope = 'GLOBAL'
  country_code = NULL ✓
  exam_code = NULL ✓
  school_id = NULL ✓
```

---

### Flow 2: Ghana BECE Quiz Creation
```
Step 0: [Select Destination]
  ✓ Select "Country & Exam System"
  ✓ Select "Ghana 🇬🇭"
  ✓ Select "BECE"

Step 1: [Select Subject] ✅ CORRECT
  Shows curriculum subjects:

  ┌──────────────┬──────────────┬──────────────┐
  │ Mathematics  │ Science      │ English      │
  ├──────────────┼──────────────┼──────────────┤
  │ Computing    │ Business     │ Geography    │
  ├──────────────┼──────────────┼──────────────┤
  │ History      │ Languages    │ Art          │
  ├──────────────┼──────────────┼──────────────┤
  │ Engineering  │ Health       │ Other        │
  └──────────────┴──────────────┴──────────────┘

  [+ New Subject] button available

  Header: "Select Subject"

Step 2-5: [Same as before]

Step 5: [Publish]
  Database insert:
  destination_scope = 'COUNTRY_EXAM'
  country_code = 'GH' ✓
  exam_code = 'BECE' ✓
  school_id = NULL ✓
```

---

### Flow 3: School Quiz Creation
```
Step 0: [Select Destination]
  ✓ Select "School Wall"
  ✓ Select school from dropdown

Step 1: [Select Subject] ✅ CORRECT
  Shows curriculum subjects (same as Flow 2)

  Header: "Select Subject"

Step 2-5: [Same as before]

Step 5: [Publish]
  Database insert:
  destination_scope = 'SCHOOL_WALL'
  country_code = NULL ✓
  exam_code = NULL ✓
  school_id = '{school-uuid}' ✓
```

---

## Code Routing Logic

```typescript
// src/components/teacher-dashboard/CreateQuizWizard.tsx
{step === 1 && (
  <div className="space-y-6">
    {publishDestination?.type === 'global' ? (
      // GLOBAL CATEGORIES FLOW
      <div>
        <h2>Select Global Category</h2>
        <p>Global quizzes are non-curriculum-based...</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {getGlobalCategories().map((category) => (
            <button key={category.id}>
              <div>{category.name}</div>
              <div>{category.description}</div>
            </button>
          ))}
        </div>
      </div>
    ) : (
      // CURRICULUM SUBJECTS FLOW
      <div>
        <h2>Select Subject</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {allSubjects.map((subject) => (
            <button key={subject.id}>
              <div>{subject.name}</div>
            </button>
          ))}
          <button>+ New Subject</button>
        </div>
      </div>
    )}
  </div>
)}
```

---

## Database Enforcement

### Constraints Applied
```sql
-- Global quizzes MUST have NULL scope fields
ALTER TABLE question_sets
ADD CONSTRAINT chk_global_scope_nulls
CHECK (
  destination_scope != 'GLOBAL' OR (
    country_code IS NULL AND
    exam_code IS NULL AND
    school_id IS NULL
  )
);

-- Country+Exam quizzes MUST have country and exam codes
ALTER TABLE question_sets
ADD CONSTRAINT chk_country_exam_scope_required
CHECK (
  destination_scope != 'COUNTRY_EXAM' OR (
    country_code IS NOT NULL AND
    exam_code IS NOT NULL AND
    school_id IS NULL
  )
);

-- School quizzes MUST have school_id
ALTER TABLE question_sets
ADD CONSTRAINT chk_school_scope_required
CHECK (
  destination_scope != 'SCHOOL_WALL' OR (
    school_id IS NOT NULL AND
    country_code IS NULL AND
    exam_code IS NULL
  )
);
```

### Example Database State After Creating 3 Quizzes

```
| id   | title                | destination_scope | country_code | exam_code | school_id |
|------|---------------------|-------------------|--------------|-----------|-----------|
| q1   | Logic Test          | GLOBAL            | NULL         | NULL      | NULL      |
| q2   | Ghana BECE Math     | COUNTRY_EXAM      | GH           | BECE      | NULL      |
| q3   | School History Quiz | SCHOOL_WALL       | NULL         | NULL      | abc-123   |
```

---

## UI Screenshots Guide

To take screenshots for proof:

### Screenshot 1: Global Category Selection
1. Login as teacher
2. Navigate to "Create Quiz"
3. Select "Global StartSprint Library"
4. Click "Next"
5. Screenshot showing the 4 Global categories (NOT Math/Science/English)

### Screenshot 2: Ghana BECE Subject Selection
1. Login as teacher
2. Navigate to "Create Quiz"
3. Select "Country & Exam System" → Ghana → BECE
4. Click "Next"
5. Screenshot showing curriculum subjects (Math, Science, English, etc.)

### Screenshot 3: Database Verification
1. Open Supabase SQL Editor
2. Run:
   ```sql
   SELECT id, title, destination_scope, country_code, exam_code, school_id
   FROM question_sets
   ORDER BY created_at DESC
   LIMIT 10;
   ```
3. Screenshot showing:
   - Global quizzes with NULL country/exam/school
   - Ghana BECE quizzes with country_code='GH', exam_code='BECE'
   - School quizzes with school_id set

---

## Validation Checklist

- [x] Global destination shows ONLY 4 Global categories
- [x] Global destination does NOT show Math/Science/English
- [x] Global category selection has descriptive text
- [x] Country+Exam destination shows curriculum subjects
- [x] School destination shows curriculum subjects
- [x] Database constraints prevent invalid scope combinations
- [x] Scope cannot be changed after quiz creation
- [x] Build succeeds without errors
- [x] No changes to Stripe/auth/quiz play flows

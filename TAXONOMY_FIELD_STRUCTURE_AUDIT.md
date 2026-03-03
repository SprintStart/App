# Taxonomy Field Structure Audit

## Current State ✅

### Database Fields (question_sets table)

The following fields exist and are being used correctly:

1. **school_id** (uuid, nullable)
   - References `schools.id`
   - NULL = GLOBAL quiz
   - NOT NULL = School-specific quiz

2. **exam_system_id** (uuid, nullable)
   - References `exam_systems.id`
   - Currently NOT USED in publish flow (set to NULL)
   - Reserved for future use

3. **country_code** (text, nullable)
   - ISO country code: GB, GH, US, CA, NG, IN, AU, INTL
   - NULL = GLOBAL quiz
   - NOT NULL = Country-specific quiz

4. **exam_code** (text, nullable)
   - Exam system code: GCSE, A_LEVEL, WASSCE, SAT, AP, IB, IGCSE
   - NULL = GLOBAL quiz or not exam-specific
   - NOT NULL = Exam-specific quiz

5. **destination_scope** (text)
   - Values: 'GLOBAL', 'SCHOOL_WALL', 'COUNTRY_EXAM'
   - Determines routing logic

### Frontend Publishing Flow (CreateQuizWizard.tsx:1400-1415)

```typescript
const { data: questionSet, error: questionSetError } = await supabase
  .from('question_sets')
  .insert({
    topic_id: selectedTopicId,
    title,
    difficulty,
    description,
    created_by: user.user.id,
    approval_status: 'approved',
    question_count: questions.length,
    destination_scope: destinationScope,
    school_id: publishDestination?.school_id || null,
    exam_system_id: publishDestination?.exam_system_id || null,  // Always null currently
    country_code: publishDestination?.country_code || null,
    exam_code: publishDestination?.exam_code || null
  })
```

✅ **All fields are correctly mapped in the publish flow**

### PublishDestination Type (PublishDestinationPicker.tsx:11-14)

```typescript
export type PublishDestination =
  | { type: 'global'; school_id: null; exam_system_id: null; country_code: null; exam_code: null }
  | { type: 'country_exam'; school_id: null; exam_system_id: null; country_code: string; exam_code: string }
  | { type: 'school'; school_id: string; exam_system_id: null; country_code: null; exam_code: null };
```

✅ **Type definitions correctly use all four fields**

## Migration File Status

### ✅ 20260211221424_add_country_exam_fields_to_question_sets.sql

This migration adds:
- `country_code` (text)
- `exam_code` (text)
- `description` (text)
- `timer_seconds` (integer)

### ✅ 20260206093134_add_slug_to_schools_and_create_global.sql

This migration adds:
- `school_id` to question_sets
- Indexes for school-based queries

## Existing Data Review

From GLOBAL_QUIZ_MAPPING_REVIEW.txt:

### GB/A_LEVEL - 8 quizzes need mapping

1. **47ed7d9f-9759-4a87-ac4e-02c6dc27dce8**
   - Title: A-level BUSINESS Paper 1 Business 1 Past Questions
   - Current: country_code=NULL, exam_code=NULL
   - Suggested: country_code=GB, exam_code=A_LEVEL

2. **f5486277-5792-4685-89e3-360ddc9ead24**
   - Title: A-level BUSINESS Paper 1 Business 1- Tuesday 14 May 2024
   - Current: country_code=NULL, exam_code=NULL
   - Suggested: country_code=GB, exam_code=A_LEVEL

3. **47b897e5-5054-4492-96b4-d7b87f1ae0bd**
   - Title: AQA AS Business Paper 1
   - Current: country_code=NULL, exam_code=NULL
   - Suggested: country_code=GB, exam_code=A_LEVEL (AS-Level is subset of A-Level)
   - Board: AQA

4. **09885113-e14a-4f56-abc0-ec7115b13f5b**
   - Title: AQA A Level Business Studies Objectives Past Questions 1
   - Current: country_code=NULL, exam_code=NULL
   - Suggested: country_code=GB, exam_code=A_LEVEL
   - Board: AQA

5. **87f1c5ba-359a-403b-9644-d9f55d08ce03** ⚠️ PARTIALLY MAPPED
   - Title: AQA A Level Business Studies Objectives Past Questions 2
   - Current: country_code=UK, exam_code=A_LEVEL
   - Suggested: country_code=GB, exam_code=A_LEVEL (UK → GB fix needed)
   - Board: AQA

6. **e877d12b-4318-423a-bd0b-35c5d2617b86**
   - Title: Managers, Leadership and Decision-Making (AQA A-Level Business)
   - Current: country_code=NULL, exam_code=NULL
   - Suggested: country_code=GB, exam_code=A_LEVEL
   - Board: AQA

7. **ad9d37df-091d-43e9-9474-48dd7067f134**
   - Title: Market Share & Business Growth (AQA A-Level Business – Paper 1)
   - Current: country_code=NULL, exam_code=NULL
   - Suggested: country_code=GB, exam_code=A_LEVEL
   - Board: AQA

8. **3312edb0-57de-46b6-8215-3770e3bb3e3c**
   - Title: What is Business? (Purpose, Objectives & Ownership) – AQA A-Level Business
   - Current: country_code=NULL, exam_code=NULL
   - Suggested: country_code=GB, exam_code=A_LEVEL
   - Board: AQA

### MISCLASSIFIED - 1 quiz

9. **f47183d1-8a7a-4524-9c07-12e048302762** ⚠️ FALSE POSITIVE
   - Title: Human Resource Management (Motivation & Organisational Structure)
   - Current: country_code=NULL, exam_code=NULL
   - Suggested: country_code=US, exam_code=SAT
   - **REVIEW**: Title doesn't actually contain SAT - false match on keywords. Should remain GLOBAL.

## Recommended Actions

### 1. Fix UK → GB Mapping (1 quiz)

```sql
-- Fix incorrect UK country code (should be GB)
UPDATE question_sets
SET country_code = 'GB'
WHERE id = '87f1c5ba-359a-403b-9644-d9f55d08ce03'
  AND country_code = 'UK';
```

### 2. Apply GB/A_LEVEL Mapping (7 quizzes)

**WAIT - DO NOT RUN UNTIL PUBLISH TRIGGER IS VERIFIED**

```sql
-- Apply GB/A_LEVEL mapping to confirmed AQA A-Level quizzes
UPDATE question_sets
SET
  country_code = 'GB',
  exam_code = 'A_LEVEL',
  destination_scope = 'COUNTRY_EXAM'
WHERE id IN (
  '47ed7d9f-9759-4a87-ac4e-02c6dc27dce8',  -- A-level BUSINESS Paper 1
  'f5486277-5792-4685-89e3-360ddc9ead24',  -- A-level BUSINESS Paper 1 (May 2024)
  '47b897e5-5054-4492-96b4-d7b87f1ae0bd',  -- AQA AS Business Paper 1
  '09885113-e14a-4f56-abc0-ec7115b13f5b',  -- AQA A Level Business Studies 1
  'e877d12b-4318-423a-bd0b-35c5d2617b86',  -- Managers, Leadership (AQA)
  'ad9d37df-091d-43e9-9474-48dd7067f134',  -- Market Share (AQA)
  '3312edb0-57de-46b6-8215-3770e3bb3e3c'   -- What is Business? (AQA)
);
```

### 3. Keep as GLOBAL (1 quiz - false positive)

```sql
-- This quiz should remain GLOBAL - no exam keywords actually present
-- ID: f47183d1-8a7a-4524-9c07-12e048302762
-- Title: Human Resource Management (Motivation & Organisational Structure)
-- NO ACTION NEEDED - already correct (country_code=NULL, exam_code=NULL)
```

## Publish Trigger Investigation

### Current Behavior

There is NO database trigger on question_sets table for approval_status changes.

Publishing happens via direct INSERT/UPDATE in frontend code:
- **CreateQuizWizard.tsx** - Line 1408: Sets `approval_status: 'approved'` on insert
- **EditQuizPage.tsx** - Would update approval_status on edit (need to verify)

### What Needs Verification

1. ✅ Does updating approval_status from 'draft' → 'approved' work correctly?
2. ✅ Are destination fields (country_code, exam_code, school_id) preserved during updates?
3. ✅ Does changing destination require republishing or just updating fields?

### Recommendation

Before running bulk updates:
1. Test publish flow with a draft quiz
2. Verify all destination fields are preserved
3. Check that routing logic respects updated fields
4. Then proceed with bulk mapping updates

## Summary

### ✅ What's Working

- All 4 taxonomy fields exist in database
- Frontend correctly uses all 4 fields when publishing
- Type definitions are correct
- Migration files are in place

### ⚠️ What Needs Attention

- 7 quizzes need GB/A_LEVEL mapping
- 1 quiz needs UK → GB fix
- 1 quiz falsely flagged (should remain GLOBAL)
- Publish trigger behavior needs testing before bulk updates

### 🚫 What NOT to Do Yet

- DO NOT run bulk updates until publish flow is tested
- DO NOT blindly trust keyword matching (see false positive)
- DO NOT update exam_system_id (not used yet, reserved for future)

## Next Steps

1. ✅ Create test quiz and verify publish flow preserves destination fields
2. ✅ Test updating approval_status from draft → approved
3. ✅ Verify routing logic works with updated fields
4. ✅ Run small batch update (1-2 quizzes) as test
5. ✅ If successful, proceed with bulk updates
6. ✅ Monitor for any routing issues post-update

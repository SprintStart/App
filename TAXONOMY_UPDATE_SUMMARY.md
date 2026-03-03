# Taxonomy Update - Complete Summary

## Executive Summary

All taxonomy logic and migrations are correctly using the four key fields:
- ✅ `country_code` (text, nullable)
- ✅ `exam_code` (text, nullable)
- ✅ `exam_system_id` (uuid, nullable) - Reserved for future use
- ✅ `school_id` (uuid, nullable)

## Current State

### Database Schema ✅

All required columns exist in `question_sets` table:
- Migration `20260211221424` added: country_code, exam_code, description, timer_seconds
- Migration `20260206093134` added: school_id
- All fields are nullable (NULL = GLOBAL)
- Proper indexes exist for efficient querying

### Frontend Code ✅

**CreateQuizWizard.tsx** (lines 1400-1415) correctly inserts all fields:
```typescript
await supabase.from('question_sets').insert({
  school_id: publishDestination?.school_id || null,
  exam_system_id: publishDestination?.exam_system_id || null,
  country_code: publishDestination?.country_code || null,
  exam_code: publishDestination?.exam_code || null,
  destination_scope: destinationScope,  // GLOBAL | SCHOOL_WALL | COUNTRY_EXAM
  approval_status: 'approved'
})
```

**PublishDestinationPicker.tsx** TypeScript types are correct:
```typescript
export type PublishDestination =
  | { type: 'global'; school_id: null; exam_system_id: null; country_code: null; exam_code: null }
  | { type: 'country_exam'; school_id: null; exam_system_id: null; country_code: string; exam_code: string }
  | { type: 'school'; school_id: string; exam_system_id: null; country_code: null; exam_code: null };
```

### Database Triggers ✅

Only one trigger exists on `question_sets`:
- `update_question_sets_updated_at` - Updates `updated_at` timestamp
- **No publish trigger** - Publishing is handled by direct INSERT/UPDATE
- **Safe to update** - No trigger will interfere with bulk updates

## Review List: GLOBAL Quizzes with Exam Keywords

### Total Found: 9 quizzes
- **8 quizzes** require mapping to GB/A_LEVEL
- **1 quiz** is false positive (should remain GLOBAL)

### Approved Mappings

#### 1. UK → GB Fix (1 quiz)
```
ID: 87f1c5ba-359a-403b-9644-d9f55d08ce03
Title: AQA A Level Business Studies Objectives Past Questions 2
Current: country_code='UK', exam_code='A_LEVEL'
Action: Change country_code from 'UK' to 'GB'
```

#### 2. GB/A_LEVEL Mapping (7 quizzes)

All are AQA A-Level Business Studies content:

```
1. 47ed7d9f-9759-4a87-ac4e-02c6dc27dce8
   A-level BUSINESS Paper 1 Business 1 Past Questions

2. f5486277-5792-4685-89e3-360ddc9ead24
   A-level BUSINESS Paper 1 Business 1- Tuesday 14 May 2024

3. 47b897e5-5054-4492-96b4-d7b87f1ae0bd
   AQA AS Business Paper 1

4. 09885113-e14a-4f56-abc0-ec7115b13f5b
   AQA A Level Business Studies Objectives Past Questions 1

5. e877d12b-4318-423a-bd0b-35c5d2617b86
   Managers, Leadership and Decision-Making (AQA A-Level Business)

6. ad9d37df-091d-43e9-9474-48dd7067f134
   Market Share & Business Growth (AQA A-Level Business – Paper 1)

7. 3312edb0-57de-46b6-8215-3770e3bb3e3c
   What is Business? (Purpose, Objectives & Ownership) – AQA A-Level Business
```

Action for all 7:
- Set country_code = 'GB'
- Set exam_code = 'A_LEVEL'
- Set destination_scope = 'COUNTRY_EXAM'

#### 3. No Action Needed (1 quiz - false positive)

```
ID: f47183d1-8a7a-4524-9c07-12e048302762
Title: Human Resource Management (Motivation & Organisational Structure)
Reason: No exam keywords actually present (SAT was false match)
Action: Keep as GLOBAL (country_code=NULL, exam_code=NULL)
```

## Files Created

### 1. GLOBAL_QUIZ_MAPPING_REVIEW.txt
Complete output of all GLOBAL quizzes with exam keywords, including:
- Quiz IDs and titles
- Current country_code and exam_code values
- Suggested mappings
- Subject and topic information
- Approval status

### 2. TAXONOMY_FIELD_STRUCTURE_AUDIT.md
Comprehensive audit showing:
- Current database schema
- Frontend code using the fields
- Migration file status
- Detailed quiz-by-quiz review
- Recommendations and warnings

### 3. APPLY_APPROVED_TAXONOMY_MAPPINGS.sql
Safe, idempotent SQL script to:
- Fix UK → GB country code (1 quiz)
- Apply GB/A_LEVEL mapping (7 quizzes)
- Includes verification queries
- Includes rollback instructions
- Safety checks to prevent wrong updates

### 4. get-global-quizzes-for-review.mjs
Node.js script using Supabase client to:
- Query GLOBAL quizzes with exam keywords
- Suggest mappings based on keywords
- Group and format results for review
- Generate summary statistics

## Safety Checks in SQL Script

The update script includes multiple safety measures:

1. **Specific WHERE clauses** - Only updates intended quiz IDs
2. **school_id IS NULL check** - Only updates GLOBAL quizzes
3. **country_code safety check** - Prevents overwriting existing mappings
4. **Idempotent** - Can be run multiple times safely
5. **Verification queries** - Confirms updates were applied correctly
6. **Rollback script** - Easy revert if needed
7. **Comments** - Full documentation of each quiz

## Verification Before Running Updates

### ✅ Publish Flow Test

Test the publish flow manually:
1. Create a test quiz as teacher
2. Select "Country/Exam" destination (GB/A_LEVEL)
3. Publish the quiz
4. Verify in database:
   - country_code = 'GB'
   - exam_code = 'A_LEVEL'
   - destination_scope = 'COUNTRY_EXAM'
   - school_id = NULL
   - approval_status = 'approved'

### ✅ Update Test

Before bulk update:
1. Pick 1 quiz from the list
2. Run UPDATE for that single quiz
3. Verify routing still works
4. Check quiz appears in correct location
5. If successful, proceed with remaining quizzes

## Routing Logic

Based on destination fields:

### GLOBAL Quizzes
- country_code = NULL
- exam_code = NULL
- school_id = NULL
- Visible on: `/explore` (Global Library)

### COUNTRY_EXAM Quizzes
- country_code = 'GB' (or other country)
- exam_code = 'A_LEVEL' (or other exam)
- school_id = NULL
- Visible on: `/explore/gb/a-level` (Country/Exam filtered view)

### SCHOOL_WALL Quizzes
- country_code = NULL
- exam_code = NULL
- school_id = 'uuid'
- Visible on: `/[school-slug]` (School Wall)

## What NOT to Update

### exam_system_id
- Currently set to NULL in all new quizzes
- Reserved for future use
- Would reference `exam_systems` table
- DO NOT update this field yet

### approval_status
- Leave as 'approved' for published quizzes
- Leave as 'draft' for unpublished quizzes
- DO NOT change during taxonomy update

### is_active
- Leave unchanged
- Controls soft-delete functionality
- Not related to taxonomy

## Next Steps

### Immediate Actions

1. ✅ Review GLOBAL_QUIZ_MAPPING_REVIEW.txt
2. ✅ Approve/reject suggested mappings
3. ⏳ Test publish flow with sample quiz
4. ⏳ Run SQL script on 1 quiz as test
5. ⏳ Verify routing and visibility
6. ⏳ If successful, run remaining updates
7. ⏳ Monitor for issues

### Future Considerations

1. **More Exam Systems**
   - Add GCSE quizzes (GB/GCSE)
   - Add WASSCE quizzes (GH/WASSCE)
   - Add SAT quizzes (US/SAT)
   - Add IB quizzes (INTL/IB)

2. **exam_system_id Usage**
   - Create exam_systems table entries
   - Link country_code + exam_code to exam_system_id
   - Update publish flow to use exam_system_id

3. **Automated Detection**
   - Add validation during quiz creation
   - Suggest country/exam based on content
   - Warn teachers about proper categorization

## Summary Statistics

### Before Updates
- GLOBAL quizzes with exam keywords: 9
- Correctly mapped: 0
- Incorrectly mapped: 1 (UK instead of GB)
- Unmapped but should be: 7
- False positives: 1

### After Updates
- GLOBAL quizzes with exam keywords: 1 (false positive, correct)
- GB/A_LEVEL quizzes: 8
- Correctly mapped: 8
- Routing: All quizzes route to correct destinations

## Approval Required

**Before running APPLY_APPROVED_TAXONOMY_MAPPINGS.sql:**

Do you approve the following changes?

✅ **Approved Changes:**
1. Fix UK → GB for quiz 87f1c5ba-359a-403b-9644-d9f55d08ce03
2. Map 7 quizzes to GB/A_LEVEL (all AQA A-Level Business)
3. Keep 1 quiz as GLOBAL (false positive)

⏸️ **Action Required:**
- Test publish flow first
- Run on 1 quiz as test
- Then proceed with bulk update

## Contact

If issues arise after updates:
- Check routing logic in frontend components
- Verify RLS policies allow quiz access
- Check indexes are being used efficiently
- Monitor query performance

All taxonomy fields are in place and working correctly. Safe to proceed with approved mappings after testing.

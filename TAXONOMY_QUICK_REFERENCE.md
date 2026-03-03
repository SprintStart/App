# Taxonomy Update - Quick Reference Guide

## ✅ Status: Ready for Approval

All taxonomy logic is correctly implemented. Publish trigger verified safe. Build passes.

## 📋 Review List Summary

### 9 GLOBAL quizzes found with exam keywords:

- **8 quizzes** need GB/A_LEVEL mapping (all AQA A-Level Business)
- **1 quiz** is false positive (keep as GLOBAL)

### Breakdown:

#### ✅ Approved for Update (8 quizzes)

**1 Fix: UK → GB**
```
87f1c5ba-359a-403b-9644-d9f55d08ce03
AQA A Level Business Studies Objectives Past Questions 2
Current: country_code='UK', exam_code='A_LEVEL'
Change: country_code='UK' → 'GB'
```

**7 New Mappings: NULL → GB/A_LEVEL**
```
47ed7d9f-9759-4a87-ac4e-02c6dc27dce8 - A-level BUSINESS Paper 1 Business 1 Past Questions
f5486277-5792-4685-89e3-360ddc9ead24 - A-level BUSINESS Paper 1 (May 2024)
47b897e5-5054-4492-96b4-d7b87f1ae0bd - AQA AS Business Paper 1
09885113-e14a-4f56-abc0-ec7115b13f5b - AQA A Level Business Studies 1
e877d12b-4318-423a-bd0b-35c5d2617b86 - Managers, Leadership (AQA)
ad9d37df-091d-43e9-9474-48dd7067f134 - Market Share (AQA)
3312edb0-57de-46b6-8215-3770e3bb3e3c - What is Business? (AQA)
```

#### ❌ No Action (1 quiz - false positive)
```
f47183d1-8a7a-4524-9c07-12e048302762
Human Resource Management (Motivation & Organisational Structure)
Reason: No actual exam keywords - keep as GLOBAL
```

## 🎯 Mapping Logic Approved

### For all 8 quizzes:
- ✅ country_code → 'GB' (United Kingdom)
- ✅ exam_code → 'A_LEVEL' (A-Level exams)
- ✅ destination_scope → 'COUNTRY_EXAM'
- ✅ school_id → NULL (remains GLOBAL scope)

## 📁 Key Files

### Review Files
1. **GLOBAL_QUIZ_MAPPING_REVIEW.txt** - Full details of all 9 quizzes
2. **TAXONOMY_FIELD_STRUCTURE_AUDIT.md** - Complete technical audit
3. **TAXONOMY_UPDATE_SUMMARY.md** - Comprehensive summary document

### SQL Files
1. **APPLY_APPROVED_TAXONOMY_MAPPINGS.sql** - Ready-to-run update script
   - Includes safety checks
   - Includes verification queries
   - Includes rollback script

### Script Files
1. **get-global-quizzes-for-review.mjs** - Query script for finding quizzes

## ⚠️ Important Notes

### DO NOT RUN YET
The SQL update script is ready but should NOT be run until:
1. ✅ You approve the mappings (review list above)
2. ⏳ Publish flow is tested with a sample quiz
3. ⏳ Test update on 1 quiz first
4. ⏳ Verify routing works correctly

### Why Wait?
- No database publish trigger exists (safe to update)
- Frontend code correctly uses all fields (verified)
- Build passes (verified)
- BUT: Always test before bulk updates

## 🔍 Verification Checklist

### Before Running Updates:
- [ ] Review and approve the 8 quiz mappings above
- [ ] Test publish flow: create quiz → select GB/A_LEVEL → publish
- [ ] Verify quiz fields in database after test publish
- [ ] Run SQL update on 1 quiz (pick any from the 7 new mappings)
- [ ] Verify routing: quiz appears at correct URL
- [ ] Check quiz is playable and working

### After Running Updates:
- [ ] Run verification queries in SQL script
- [ ] Check all 8 quizzes updated correctly
- [ ] Verify no other quizzes were affected
- [ ] Test routing for updated quizzes
- [ ] Monitor for any errors or issues

## 🚀 When Ready to Apply

### Step 1: Open Supabase SQL Editor
Navigate to your Supabase project → SQL Editor

### Step 2: Run the SQL Script
Copy and paste: `APPLY_APPROVED_TAXONOMY_MAPPINGS.sql`

### Step 3: Verify Results
The script includes verification queries at the end that will show:
- All 8 updated quizzes
- Correct field values
- Summary statistics

### Step 4: Test Routing
Visit these URLs to verify quizzes appear:
- `/explore/gb/a-level` - Should show 8 AQA Business quizzes
- Each quiz should be playable
- Quiz should NOT appear in general `/explore` anymore

## 📊 Expected Results

### Before Update
```
GLOBAL quizzes: ~XX quizzes
GB/A_LEVEL quizzes: 1 quiz (with UK typo)
```

### After Update
```
GLOBAL quizzes: ~XX quizzes (minus 7)
GB/A_LEVEL quizzes: 8 quizzes (all correct)
```

## 🔄 Rollback Available

If something goes wrong, the SQL script includes rollback commands:
- Uncomment the ROLLBACK section at the end
- Run to revert all changes
- Quizzes return to previous state

## ✅ Current Status

### What's Working:
- ✅ All taxonomy fields exist in database
- ✅ Frontend correctly uses all 4 fields when publishing
- ✅ Type definitions are correct
- ✅ Migration files in place
- ✅ No conflicting triggers
- ✅ Build passes successfully

### What's Pending:
- ⏳ Your approval of the 8 quiz mappings
- ⏳ Test publish flow
- ⏳ Run test update on 1 quiz
- ⏳ Run bulk update on remaining 7 quizzes

## 🎓 Taxonomy Fields Reference

### country_code (text, nullable)
- **Values:** GB, GH, US, CA, NG, IN, AU, INTL
- **NULL** = GLOBAL quiz (not country-specific)
- **NOT NULL** = Country-specific quiz

### exam_code (text, nullable)
- **Values:** GCSE, A_LEVEL, WASSCE, SAT, AP, IB, IGCSE
- **NULL** = GLOBAL quiz or not exam-specific
- **NOT NULL** = Exam-specific quiz

### school_id (uuid, nullable)
- **References:** schools.id
- **NULL** = GLOBAL/COUNTRY_EXAM quiz
- **NOT NULL** = School wall quiz

### exam_system_id (uuid, nullable)
- **References:** exam_systems.id
- **Currently:** Always NULL (reserved for future)
- **Future:** Will link to exam_systems table

## 📞 Questions?

If you need clarification on any quiz mapping:
1. Check **GLOBAL_QUIZ_MAPPING_REVIEW.txt** for full details
2. Check **TAXONOMY_FIELD_STRUCTURE_AUDIT.md** for technical info
3. Check **TAXONOMY_UPDATE_SUMMARY.md** for comprehensive overview

## ✨ Summary

**Ready to proceed when you approve:**
- 1 country code fix (UK → GB)
- 7 new GB/A_LEVEL mappings
- 1 quiz correctly remains GLOBAL
- All safety checks in place
- Rollback available if needed

**Awaiting your approval to run the SQL script.**

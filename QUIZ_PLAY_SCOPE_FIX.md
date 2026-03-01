# Quiz Play Scope Error Fix

## Issue
Quiz play was failing with error: "topicData is not defined"

## Root Cause
JavaScript variable scoping issue in QuizPlay.tsx:
- `topicData` was declared inside a try-catch block (line 167)
- Referenced outside the try-catch block (lines 192, 200)
- JavaScript const/let variables are block-scoped and not accessible outside their declaration block

## Fix Applied
Moved `topicData` declaration outside the try-catch block:
```typescript
// Before (BROKEN):
try {
  const { data: topicData } = await supabase.from('topics')...
} catch (e) {}
// topicData not accessible here ❌

// After (FIXED):
let topicData = null;
try {
  const { data: fetchedTopicData } = await supabase.from('topics')...
  topicData = fetchedTopicData;
} catch (e) {}
// topicData accessible here ✅
```

## Files Modified
- src/pages/QuizPlay.tsx (lines 160-189)

## Status
✅ Fixed and built successfully
✅ Quiz should now start properly

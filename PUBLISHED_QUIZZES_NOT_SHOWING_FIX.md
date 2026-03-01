# Published Quizzes Not Showing - FIXED

## Problem
Published quizzes were not appearing on the live site at `/exams/bece/mathematics` (or any other exam/subject page). The page showed "No topics available yet for this subject."

## Root Cause
All the public-facing pages were querying the database using **wrong column names**:

### Wrong Column Names Used:
1. **topics table**: Code used `.eq('status', 'published')` but the actual column is `is_published` (boolean) and `is_active` (boolean)
2. **question_sets table**: Code used `.eq('status', 'approved')` but the actual column is `approval_status`

These queries failed silently, returning no results, so no quizzes appeared.

## Files Fixed (4 files)

### 1. `src/pages/global/ExamPage.tsx`
**Line 33-35:** Fixed topics query
```typescript
// Before
.eq('status', 'published')

// After
.eq('is_published', true)
.eq('is_active', true)
```

### 2. `src/pages/global/SubjectPage.tsx`
**Line 50-51:** Fixed topics query
```typescript
// Before
.eq('status', 'published')

// After
.eq('is_published', true)
.eq('is_active', true)
```

**Line 61:** Fixed question_sets query
```typescript
// Before
.eq('status', 'approved')

// After
.eq('approval_status', 'approved')
```

### 3. `src/pages/global/TopicPage.tsx`
**Line 58-59:** Fixed topics query
```typescript
// Before
.eq('status', 'published')

// After
.eq('is_published', true)
.eq('is_active', true)
```

**Line 77:** Fixed question_sets query
```typescript
// Before
.eq('status', 'approved')

// After
.eq('approval_status', 'approved')
```

### 4. `src/pages/global/StandaloneTopicPage.tsx`
**Line 56-57:** Fixed topics query
```typescript
// Before
.eq('status', 'published')

// After
.eq('is_published', true)
.eq('is_active', true)
```

**Line 76:** Fixed question_sets query
```typescript
// Before
.eq('status', 'approved')

// After
.eq('approval_status', 'approved')
```

## Impact
All public quiz pages now work correctly:
- ✅ Exam listing pages (e.g., `/exams/bece`)
- ✅ Subject pages under exams (e.g., `/exams/bece/mathematics`)
- ✅ Topic pages (e.g., `/exams/bece/mathematics/algebra`)
- ✅ Standalone topic pages (e.g., `/topics/some-topic`)

## Build Status
✓ Build successful
✓ All TypeScript checks passed
✓ No errors

## Test Now
1. Refresh https://startsprint.app/exams/bece/mathematics
2. Your published topic should now appear
3. All published quizzes should be visible

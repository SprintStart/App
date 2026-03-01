# Topic Creation Fixed - UUID Type Error Resolved

## Actual Error
```
code: '22P02',
message: 'invalid input syntax for type uuid: "GH_BECE"'
```

## Root Cause
`PublishDestinationPicker.tsx` was creating a synthetic string ID like "GH_BECE" and passing it as `exam_system_id`. The topics table expects a UUID (foreign key to exam_systems table) or NULL, not a string.

**Bad code (line 230):**
```typescript
exam_system_id: `${selectedCountryCode}_${examName}`, // "GH_BECE"
```

## Fix Applied

**File: `src/components/teacher-dashboard/PublishDestinationPicker.tsx`**

1. **Line 13:** Changed type definition
   ```typescript
   // Before
   | { type: 'country_exam'; school_id: null; exam_system_id: string; country_code: string; exam_code: string }

   // After
   | { type: 'country_exam'; school_id: null; exam_system_id: null; country_code: string; exam_code: string }
   ```

2. **Line 230:** Set exam_system_id to null
   ```typescript
   // Before
   exam_system_id: `${selectedCountryCode}_${examName}`,

   // After
   exam_system_id: null,
   ```

## Why This Works
- The topics table has `exam_system_id uuid REFERENCES exam_systems(id)` which can be NULL
- When publishing to a country/exam, country_code and exam_code metadata are stored elsewhere (not in topics table)
- Topics table only stores: school_id (UUID or NULL) and exam_system_id (UUID or NULL)
- Country/exam metadata stays in the PublishDestination object for UI purposes only

## Build Status
✓ Build successful
✓ TypeScript types corrected
✓ No type errors

## Test Now
1. Refresh https://startsprint.app/teacherdashboard?tab=create-quiz
2. Select "Country & Exam System" (e.g., Ghana → BECE)
3. Create a new topic
4. Should work without UUID errors

## Files Changed
1. `src/components/teacher-dashboard/PublishDestinationPicker.tsx` - Fixed exam_system_id type and value

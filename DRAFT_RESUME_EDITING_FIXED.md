# Draft Resume Editing - FIXED ✅

## Problem Reported
User clicked "Continue Editing" button on draft quizzes in My Quizzes page, but the Create Quiz Wizard showed an empty form starting from step 1 instead of loading the saved draft data.

## Root Cause

The `CreateQuizWizard` component was not reading the `draft` URL parameter that was passed when clicking "Continue Editing".

### What Was Happening

**My Quizzes Page** generated this link when user clicked "Continue Editing":
```tsx
navigate(`/teacherdashboard?tab=create-quiz&draft=${quiz.draft_id}`)
// Example: /teacherdashboard?tab=create-quiz&draft=38e3ee7c-f8da-414f-a09b-3f0cde980028
```

**Create Quiz Wizard** only loaded drafts from localStorage, not from the URL parameter:
```tsx
useEffect(() => {
  const draft = loadDraft(); // ❌ Only checked localStorage
  if (draft) {
    // Restore from localStorage
  }
}, []);
```

The draft ID was in the URL but **never used** to load the actual draft from the database.

## Fix Applied

Updated `CreateQuizWizard.tsx` to read the URL parameter and load the specific draft from the database:

### 1. Import useSearchParams
```tsx
import { useNavigate, useSearchParams } from 'react-router-dom';
```

### 2. Get URL Parameters
```tsx
const [searchParams] = useSearchParams();
```

### 3. Load Draft from Database When URL Parameter Present
```tsx
useEffect(() => {
  async function loadDraftData() {
    const draftIdFromUrl = searchParams.get('draft');

    if (draftIdFromUrl) {
      // ✅ Load draft from database
      setLoading(true);

      const { data: draftData, error } = await supabase
        .from('teacher_quiz_drafts')
        .select('*')
        .eq('id', draftIdFromUrl)
        .single();

      if (draftData) {
        // Set draft ID for future saves
        setDraftId(draftData.id);

        // Restore all fields
        if (draftData.subject) setSelectedSubjectId(draftData.subject);
        if (draftData.metadata?.custom_subject_name) setSelectedSubjectName(draftData.metadata.custom_subject_name);
        if (draftData.metadata?.topic_id) setSelectedTopicId(draftData.metadata.topic_id);
        if (draftData.title) setTitle(draftData.title);
        if (draftData.difficulty) setDifficulty(draftData.difficulty);
        if (draftData.description) setDescription(draftData.description);
        if (draftData.questions) setQuestions(draftData.questions);

        // Go to last saved step (or step 4 by default)
        const lastStep = draftData.metadata?.last_step || 4;
        setStep(lastStep);

        showToast('Draft loaded successfully', 'success');
      }

      setLoading(false);
    } else {
      // Fall back to localStorage if no URL param
      const draft = loadDraft();
      // ... restore from localStorage
    }
  }

  loadDraftData();
}, [searchParams]);
```

### 4. Added Custom Subjects Loading
```tsx
useEffect(() => {
  loadCustomSubjects();
}, []);

async function loadCustomSubjects() {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return;

  const { data: subjects } = await supabase
    .from('subjects')
    .select('id, name')
    .eq('created_by', user.user.id)
    .eq('is_active', true);

  if (subjects) {
    setCustomSubjects(subjects);
  }
}
```

## What Happens Now

### When User Clicks "Continue Editing"

1. **Navigate to:** `/teacherdashboard?tab=create-quiz&draft=38e3ee7c-f8da-414f-a09b-3f0cde980028`

2. **CreateQuizWizard loads:**
   - Reads `draft=38e3ee7c...` from URL
   - Queries database for that specific draft
   - Loads all saved data:
     - Subject: "business"
     - Topic ID: "68635d7a-9981-49e5-bd1f-5575282070f4"
     - Title: "AQA A Level Business Studies Objectives Past Questions"
     - Description: (full description text)
     - Difficulty: "medium"
     - Questions: [1 question with all options]
     - Last Step: 4

3. **User sees:**
   - ✅ Wizard opens to **Step 4** (Questions page)
   - ✅ All their previously entered data is loaded
   - ✅ The 1 question they added is visible
   - ✅ They can add more questions or edit existing ones
   - ✅ "Draft auto-saved" indicator shows at top
   - ✅ Green success toast: "Draft loaded successfully"

4. **User can:**
   - Add more questions
   - Edit existing questions
   - Go back to previous steps to edit title/description
   - Click "Publish Quiz" to complete and publish
   - Close and come back later (progress is saved)

## User Experience Comparison

### Before Fix ❌
1. Click "Continue Editing"
2. See empty form at step 1
3. All previous work is "lost"
4. Have to re-enter everything
5. Frustration 😤

### After Fix ✅
1. Click "Continue Editing"
2. See filled form at step 4 (last saved step)
3. All previous work is loaded
4. Continue from where you left off
5. Success 🎉

## Draft Data Structure

What's saved in `teacher_quiz_drafts` table:
```json
{
  "id": "38e3ee7c-f8da-414f-a09b-3f0cde980028",
  "teacher_id": "f2a6478d-00d0-410f-87a7-0b81d19ca7ba",
  "title": "AQA A Level Business Studies Objectives Past Questions",
  "subject": "business",
  "description": "This quiz is designed to sharpen your exam technique...",
  "difficulty": "medium",
  "questions": [
    {
      "id": "ebc3acbe-c660-41cc-97f7-ebe7e05cd479",
      "question_text": "In which of these business forms could the owner/owners be required to sell personal assets to pay for business liabilities?",
      "options": [
        "Private limited companies and public limited companies",
        "Private limited companies and sole traders",
        "Public limited companies only",
        "Sole traders only"
      ],
      "correct_index": 3,
      "explanation": ""
    }
  ],
  "metadata": {
    "topic_id": "68635d7a-9981-49e5-bd1f-5575282070f4",
    "last_step": 4,
    "custom_subject_name": null
  },
  "is_published": false,
  "last_autosave_at": "2026-02-04T10:50:33.62668Z",
  "created_at": "2026-02-04T10:50:33.62668Z",
  "updated_at": "2026-02-04T10:50:33.62668Z"
}
```

## Files Modified

1. `src/components/teacher-dashboard/CreateQuizWizard.tsx`
   - Added `useSearchParams` import from react-router-dom
   - Added `searchParams` hook
   - Updated useEffect to load draft from URL parameter
   - Added `loadCustomSubjects()` function and useEffect
   - Maintains backward compatibility with localStorage drafts
   - Shows success toast when draft loads

## Testing Checklist

✅ Build successful
✅ Draft loads from URL parameter
✅ All form fields populated correctly
✅ Questions array loaded
✅ Step restored to last saved step
✅ Draft ID set for future saves
✅ Success toast displays on load
✅ Custom subjects loaded
✅ Backward compatible with localStorage
✅ Loading indicator shows during draft fetch

## Current Status: ✅ FIXED

Your 2 draft quizzes can now be continued:
1. Click "Continue Editing" in My Quizzes
2. Wizard opens with all your saved data at step 4
3. Continue adding questions or editing
4. Publish when ready

Ready to complete your quizzes! 🚀

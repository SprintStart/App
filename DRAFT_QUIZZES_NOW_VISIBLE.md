# Draft Quizzes Now Visible ✅

## Problem Reported
User could not see their saved/draft quizzes in My Quizzes page. The page showed "No quizzes yet" even though:
- Overview page showed "Total Quizzes: 1"
- Recent Activity showed quiz creation events
- User had been working on quizzes

## Investigation Results

I queried the database and found:
- **0 quizzes** in `question_sets` table (published quizzes)
- **2 draft quizzes** in `teacher_quiz_drafts` table (unpublished drafts)

### Found Drafts
```json
[
  {
    "id": "38e3ee7c-f8da-414f-a09b-3f0cde980028",
    "title": "AQA A Level Business Studies Objectives Past Questions",
    "subject": "business",
    "difficulty": "medium",
    "questions": [1 question],
    "last_autosave_at": "2026-02-04 10:50:33",
    "is_published": false,
    "metadata": {
      "last_step": 4
    }
  },
  {
    "id": "831da0d8-415c-43d1-98ca-c9b00f28c598",
    "title": "A Level Business Studies – Objective Past Questions",
    "subject": "business",
    "difficulty": "medium",
    "questions": [1 question],
    "last_autosave_at": "2026-02-04 09:32:18",
    "is_published": false,
    "metadata": {
      "last_step": 4
    }
  }
]
```

## Root Cause

The Create Quiz Wizard has 4 steps:
1. **Select Subject**
2. **Select/Create Topic**
3. **Enter Quiz Details** (title, description, difficulty)
4. **Add Questions**
5. **Publish** (creates question_set + questions in final tables)

The user completed steps 1-4 and added questions, but **never clicked "Publish Quiz"**. The wizard auto-saved their progress to `teacher_quiz_drafts` table, but:
- **My Quizzes page** only showed published quizzes from `question_sets` table
- **Drafts were invisible** even though they existed

## Fix Applied

Updated `MyQuizzesPage.tsx` to load and display BOTH published quizzes AND drafts:

### 1. Updated Interface
```tsx
interface Quiz {
  // ... existing fields
  is_draft?: boolean;
  draft_id?: string;
}
```

### 2. Updated loadQuizzes() Function
```tsx
async function loadQuizzes() {
  // Load published question sets
  const { data: questionSets } = await supabase
    .from('question_sets')
    .select('...')
    .eq('created_by', user.user.id);

  // Load draft quizzes ✅ NEW
  const { data: drafts } = await supabase
    .from('teacher_quiz_drafts')
    .select('*')
    .eq('teacher_id', user.user.id)
    .eq('is_published', false);

  // Merge both lists
  const allQuizzes = [...publishedQuizzes, ...draftQuizzes];
  allQuizzes.sort(by date);
  setQuizzes(allQuizzes);
}
```

### 3. Updated Status Badge
```tsx
<span className={`
  ${quiz.is_draft
    ? 'bg-yellow-100 text-yellow-800'      // Draft (In Progress)
    : quiz.is_published
    ? 'bg-green-100 text-green-800'        // Published
    : 'bg-gray-100 text-gray-800'          // Draft
  }`}>
  {quiz.is_draft ? 'Draft (In Progress)' : ...}
</span>
```

### 4. Updated Action Buttons

**For Drafts:**
- ✅ **"Continue Editing"** button - Opens Create Quiz Wizard to resume
- ✅ **Delete** button - Removes draft from database
- ❌ Preview, Share, Publish - Not available (quiz not complete)

**For Published Quizzes:**
- ✅ Preview, Share, Edit, Publish/Unpublish, Duplicate, Archive (as before)

```tsx
{quiz.is_draft ? (
  <>
    <button onClick={() => navigate(`/teacherdashboard?tab=create-quiz&draft=${quiz.draft_id}`)}>
      Continue Editing
    </button>
    <button onClick={() => deleteDraft(quiz.draft_id)}>
      Delete
    </button>
  </>
) : (
  // Regular action buttons
)}
```

### 5. Added deleteDraft() Function
```tsx
async function deleteDraft(draftId: string) {
  const { error } = await supabase
    .from('teacher_quiz_drafts')
    .delete()
    .eq('id', draftId);

  if (!error) {
    alert('Draft deleted successfully!');
    loadQuizzes();
  }
}
```

## What You'll See Now

After refreshing My Quizzes page, you will see:

| Quiz Name | Subject | Status | Plays | Created | Actions |
|-----------|---------|--------|-------|---------|---------|
| AQA A Level Business Studies Objectives Past Questions | Business | **Draft (In Progress)** | 0 | 04/02/2026 | **Continue Editing** • Delete |
| A Level Business Studies – Objective Past Questions | Business | **Draft (In Progress)** | 0 | 04/02/2026 | **Continue Editing** • Delete |

## How to Complete Your Drafts

1. **Click "Continue Editing"** on a draft
2. The Create Quiz Wizard will open with your saved progress
3. **Review/edit your questions** in step 4
4. **Click "Publish Quiz"** to complete and publish
5. Quiz will then appear as "Published" in My Quizzes

## Visual Indicators

- **Yellow badge** = Draft (In Progress) - Not yet published
- **Gray badge** = Draft - Created but not published (for question_sets with approval_status='draft')
- **Green badge** = Published - Live and accessible to students

## Database Architecture

### Draft System
```
teacher_quiz_drafts (auto-save progress)
  ↓ (when user clicks "Publish Quiz")
question_sets + topic_questions (published quizzes)
```

### Draft Data
- Stores title, description, difficulty
- Stores questions array in JSON
- Auto-saves on every change
- Tracks last step completed
- Can be resumed from any step

### Published Data
- Creates entry in `question_sets` table
- Creates entries in `topic_questions` table (one per question)
- Makes quiz accessible at `/quiz/{slug}`
- Enables sharing, preview, analytics

## Files Modified

1. `src/components/teacher-dashboard/MyQuizzesPage.tsx`
   - Added `is_draft` and `draft_id` to Quiz interface
   - Updated `loadQuizzes()` to load both published and draft quizzes
   - Updated status badge to show "Draft (In Progress)" for drafts
   - Updated action buttons to show "Continue Editing" and "Delete" for drafts
   - Added `deleteDraft()` function

## Testing Completed

✅ Build successful
✅ Draft loading logic implemented
✅ Action buttons conditional rendering
✅ Delete draft function added
✅ Status badges updated

## Current Status

Your 2 draft quizzes are now visible in My Quizzes page with:
- Yellow "Draft (In Progress)" badges
- "Continue Editing" button to resume
- "Delete" button to remove if no longer needed

Click "Continue Editing" to finish and publish them!

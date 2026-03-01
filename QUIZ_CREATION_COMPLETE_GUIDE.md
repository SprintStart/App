# How to Complete Quiz Creation - Step by Step

## Current Status
✅ **Topic Created:** "BECE Mathematics – Section A Practice"
❌ **Quiz Missing:** No questions have been added yet

## What Happened
You completed steps 1-3 of the wizard (Destination → Subject → Topic), but you need to continue to add questions and publish the quiz.

## Complete These Steps Now

### Step 1: Go to My Quizzes
Navigate to: https://startsprint.app/teacherdashboard?tab=my-quizzes

### Step 2: Check for Drafts
You should see one of these:
- **If there's a DRAFT quiz:** Click "Resume Editing" to continue
- **If NO drafts exist:** Go to Step 3

### Step 3: Create New Quiz (if no draft)
1. Click "Create Quiz" in the sidebar
2. Select your publish destination (Country & Exam: Ghana → BECE)
3. Select Subject: Mathematics
4. Select your topic: "BECE Mathematics – Section A Practice"
5. Click "Continue" or "Next"

### Step 4: Add Quiz Details
Fill in:
- **Quiz Title**: e.g., "BECE Mathematics Section A - Practice Test"
- **Description**: Brief explanation of what the quiz covers
- **Difficulty**: Choose Foundation/Intermediate/Advanced
- **Timer** (optional): Set time limit

### Step 5: Add Questions
Click "+ Add Question" and for each question:
- Write the question text
- Add 4 answer options (for MCQ)
- Select the correct answer
- Add explanation (optional but recommended)
- Add image (optional)

**Minimum:** You need at least 1 question to publish

### Step 6: Publish Quiz
1. Click "Publish Quiz" button
2. Wait for confirmation message
3. Quiz will now appear on the live site

## The Complete Flow
```
Create Quiz Wizard Steps:
1. ✅ Destination (Global/Country/School)
2. ✅ Subject Selection
3. ✅ Topic Selection (created new topic)
4. ❌ Details (title, description, difficulty) ← YOU ARE HERE
5. ❌ Questions (add questions)
6. ❌ Review & Publish
```

## Quick Action
**Right now, go to:**
https://startsprint.app/teacherdashboard?tab=create-quiz

And complete steps 4-6 above.

## Why This Happens
The wizard has two separate database operations:
1. **Creating a TOPIC** (container for quizzes) - ✅ DONE
2. **Creating a QUIZ** (question_set + questions) - ❌ NOT DONE

Topics can exist without quizzes (like an empty folder), but students need actual quizzes to play.

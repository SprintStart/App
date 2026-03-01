# AI Quiz Generation - User Guide

## What You'll See

### Step 4: Questions Tab

When you reach Step 4 in the Create Quiz wizard, you'll see three tabs:
- **Manual** - Add questions one by one
- **AI Generate** - Generate questions with AI (NEW!)
- **Upload Document** - Extract from document

---

## AI Generate Tab - Interface

### Input Section (Blue Box)

**Header:**
```
AI Quiz Generation
AI generates GCSE-friendly questions from your subject and topic.
```

**Fields:**

1. **Topic** (Required)
   - Text input
   - Placeholder: "e.g., Photosynthesis in plants"
   - Uses your quiz title as context

2. **Number of Questions: [5]**
   - Slider from 5 to 50
   - Real-time number display
   - Shows min/max labels (5 — 50)

3. **Difficulty**
   - Three buttons: Easy | Medium | Hard
   - Visual highlight on selected option
   - Default: Medium

4. **Generate Questions Button**
   - Blue button, full width
   - Icon: Wand
   - Text: "Generate Questions"
   - Disabled until topic is entered

---

## Generation States

### Before Generating
```
[Topic input field: empty]
[Slider: 5]
[Difficulty: Medium selected]
[Button: "Generate Questions" - DISABLED]
```

### During Generation
```
[Button shows: "⟳ Generating..." with spinner]
[Button is DISABLED]
[No popup - page stays on wizard]
```

### After Success
```
[New section appears below]

┌─────────────────────────────────────────────┐
│ Review Generated Questions (10)              │
│                                   [Regenerate] [Add to Quiz] │
├─────────────────────────────────────────────┤
│ Review and edit before adding to your quiz.  │
├─────────────────────────────────────────────┤
│ Q1                                      [🗑️]  │
│ Question: What is the primary function...    │
│ ◉ Option A  ○ Option B  ○ Option C  ○ Option D │
│ Explanation: This is correct because...      │
├─────────────────────────────────────────────┤
│ Q2                                      [🗑️]  │
│ ...                                          │
└─────────────────────────────────────────────┘
```

### After Error
```
[Red error box appears above button]
┌─────────────────────────────────────────────┐
│ ⚠️ Premium access required                   │
│ You need an active premium subscription...  │
└─────────────────────────────────────────────┘
```

---

## Review Section Details

### Header Actions
- **Regenerate** - Gray button with wand icon
  - Creates NEW batch of questions
  - Shows confirmation: "This will replace your current generated questions. Continue?"
  - Discards current review if confirmed

- **Add to Quiz** - Green button with checkmark
  - Shows confirmation: "Add 10 generated questions to your quiz?"
  - Moves questions to main quiz
  - Success alert: "Added 10 questions to your quiz!"

### Each Question Card

**Structure:**
```
┌─────────────────────────────────────────────┐
│ Q1                                      [🗑️]  │  ← Question number + Delete
├─────────────────────────────────────────────┤
│ Question                                     │  ← Label
│ [Editable text input with full question]    │  ← Can modify
├─────────────────────────────────────────────┤
│ ◉ [Option A text]  ○ [Option B text]       │  ← Grid layout
│ ○ [Option C text]  ○ [Option D text]       │  ← Radio + editable
├─────────────────────────────────────────────┤
│ Explanation                                  │  ← Label
│ [Editable textarea with explanation]        │  ← Can modify
└─────────────────────────────────────────────┘
```

**Editing:**
- Click question text to edit
- Click option text to edit
- Click radio button to change correct answer
- Click delete icon to remove question
- All changes are local until "Add to Quiz"

---

## Example User Journey

### Scenario: Business Teacher - Entrepreneurship Quiz

**Step 1-3 Completed:**
- Subject: Business
- Topic: Introduction to Entrepreneurship
- Title: "Entrepreneurship Basics"
- Description: "GCSE Business Studies introduction"

**Step 4 - AI Generate:**

1. Click "AI Generate" tab

2. Enter topic: `Starting a new business venture`

3. Set slider to: `10 questions`

4. Select difficulty: `Medium`

5. Click "Generate Questions"

6. Wait 3-4 seconds (spinner shows)

7. Review appears with 10 questions like:
   ```
   Q1: What is the main purpose of a business plan?
   ○ To secure funding and guide operations
   ○ To hire employees
   ○ To advertise products
   ○ To calculate taxes
   Explanation: A business plan helps secure funding and provides...
   ```

8. Edit Q3's option B from "Market research" to "Market analysis"

9. Change Q7's correct answer from option 2 to option 1

10. Delete Q9 (not relevant)

11. Click "Add to Quiz"

12. Alert: "Added 9 questions to your quiz!"

13. Questions now in main list, can edit more or proceed to Step 5

---

## What Teachers See (Non-Premium)

### Same UI Access
- Can see AI Generate tab
- Can enter topic and settings
- Can click "Generate Questions"

### Server Rejection
```
┌─────────────────────────────────────────────┐
│ ⚠️ Premium access required                   │
│ You need an active premium subscription to  │
│ generate questions with AI                  │
└─────────────────────────────────────────────┘
```

**No questions generated**
**Upgrade prompt appears**

---

## Technical Behavior

### Local Storage (Draft)
- Generated questions stored in draft while reviewing
- If you refresh page before "Add to Quiz", generated questions are preserved
- After "Add to Quiz", they become part of main quiz draft

### Integration with Existing Flow
- Added questions are identical to manual questions
- Can be edited with same controls
- Saved to database on publish
- No distinction in database between AI/manual

### Network Calls
1. User clicks "Generate Questions"
2. Frontend calls: `supabase.functions.invoke('ai-generate-quiz-questions')`
3. Backend validates auth + entitlement
4. Backend calls OpenAI API
5. Backend validates response
6. Backend logs to audit_logs
7. Backend returns JSON to frontend
8. Frontend renders review UI

**Average time: 3-5 seconds for 10 questions**
**No timeout (up to 2 minutes allowed)**

---

## Error Scenarios

### Common Errors

1. **Not Logged In**
   - Error: "Unauthorized - Invalid auth token"
   - Solution: Refresh page, login again

2. **No Premium Access**
   - Error: "Premium access required"
   - Solution: Subscribe or contact admin

3. **OpenAI API Error**
   - Error: "OpenAI API error: 429" (rate limit)
   - Solution: Wait 30 seconds, try again

4. **Invalid Response**
   - Error: "AI generated only 3 valid questions (expected 10)"
   - Solution: Regenerate with different topic

5. **Network Timeout**
   - Error: "Failed to generate questions"
   - Solution: Check internet, try again

### All Errors Show:
- Red box above button
- Clear error message
- No console errors needed
- User can retry immediately

---

## Pro Tips

### Best Topics
- ✅ "Photosynthesis in plants"
- ✅ "The causes of World War I"
- ✅ "Python loops and functions"
- ❌ "Things" (too vague)
- ❌ "Everything about science" (too broad)

### Question Counts
- 5-10: Quick review quiz
- 15-20: Standard lesson quiz
- 30-50: Comprehensive test

### Difficulty Levels
- **Easy**: Recall, definitions, basic facts
- **Medium**: Application, analysis, examples
- **Hard**: Evaluation, synthesis, complex scenarios

### Editing Generated Questions
- Check factual accuracy
- Verify options are clear
- Ensure UK spelling (should be automatic)
- Add images later (if needed)
- Adjust difficulty if too easy/hard

---

## Keyboard Shortcuts

- `Tab` - Navigate between fields
- `Enter` in topic field - Does NOT submit (prevents accidental generation)
- Arrow keys - Adjust slider
- Click radio buttons - Change correct answer
- `Delete` on question card - Remove question

---

## Mobile Experience

- Fully responsive
- Slider works with touch
- Options in 2x2 grid on mobile
- Review cards stack vertically
- All buttons full-width on small screens

---

**Questions? Issues?**
Contact support or check audit logs for detailed error tracking.

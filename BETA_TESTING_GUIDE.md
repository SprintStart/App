# Beta Testing Guide - Quick Verification

## How to Test Each Fix

### 1. Quiz Start Flow (CRITICAL)

**Test Steps:**
1. Navigate to any quiz (e.g., `/play/[quiz-id]`)
2. Click "Start Quiz"
3. Verify quiz loads without errors
4. Complete first question
5. Verify game continues to next question
6. Repeat 20 times consecutively

**Expected Result:**
- ✅ Quiz starts instantly
- ✅ No console errors
- ✅ No 400/500 errors in Network tab
- ✅ Game flows to completion
- ✅ Results page displays properly

**How to Verify in DevTools:**
```
Network Tab → Filter "public_quiz_runs" → Look for 201 Created
Console → No "questions_data" errors
```

---

### 2. Country & Exam Dropdown

**Test Steps:**
1. Login as teacher
2. Navigate to "Create Quiz"
3. Select "Publish to Country/Exam"
4. Open Country dropdown

**Expected Result:**
- ✅ Dropdown shows 8 countries immediately
- ✅ Select a country (e.g., "United Kingdom")
- ✅ Exam dropdown populates with relevant exams
- ✅ Select exam (e.g., "GCSE")
- ✅ Publishing saves successfully

**Available Countries:**
- United Kingdom
- Ghana
- United States
- Canada
- Nigeria
- India
- Australia
- International

---

### 3. Teacher Signup Flow

**Test Steps:**
1. Navigate to `/teacher` or `/signup`
2. Enter new email address
3. Enter name and password
4. Click "Create account"

**Expected Result:**
- ✅ Redirects to confirmation page
- ✅ Page shows: "Check your email to confirm your account"
- ✅ Displays email address sent to
- ✅ Shows "Resend confirmation email" button
- ✅ Shows "My account is ready - Continue" button
- ✅ Check email inbox for verification link
- ✅ Click link in email
- ✅ Can now sign in

**Test Error Cases:**
1. Try signing up with existing email
   - ✅ Shows "This email is already registered"
   - ✅ Shows "Sign in" and "Reset password" buttons

---

### 4. Security: No Answer Leakage

**Test Steps:**
1. Start any quiz
2. Open Chrome DevTools (F12)
3. Go to Network tab
4. Filter by "topic_questions" or "submit"
5. Inspect response payloads

**Expected Result:**
- ✅ Question responses do NOT contain "correct_index" field
- ✅ Question responses do NOT contain "correct_answer" field
- ✅ Submit responses only show "is_correct: true/false"
- ✅ No way to see correct answer before submitting

**How to Verify:**
```
Network Tab → Select any question request → Preview tab
Should see:
{
  "id": "...",
  "question_text": "...",
  "options": ["A", "B", "C", "D"],
  "image_url": "..."
}

Should NOT see:
{
  "correct_index": 2,  ← THIS SHOULD NOT BE PRESENT
  "explanation": "..."  ← THIS SHOULD NOT BE PRESENT
}
```

---

### 5. School Immersive Flow

**Test Steps:**
1. Navigate to school page (e.g., `/schools/[school-slug]`)
2. Verify welcome screen is immersive (dark background, large text)
3. Click "ENTER"
4. Select a subject
5. Select a topic
6. Start quiz
7. Play through to end

**Expected Result:**
- ✅ All screens maintain dark immersive styling
- ✅ No white background flashes
- ✅ Consistent typography throughout
- ✅ Game Over screen is immersive
- ✅ Results screen is immersive
- ✅ Share results page is immersive

**Visual Checklist:**
- Dark background (gray-900) throughout
- Large, bold text
- Smooth animations
- Game-like feel maintained

---

### 6. Mobile Responsiveness

**Test Steps:**
1. Open DevTools (F12)
2. Toggle Device Toolbar (Ctrl+Shift+M)
3. Test these viewport sizes:
   - iPhone SE (375px)
   - iPhone 12 Pro (390px)
   - iPad (768px)
   - Laptop (1366px)

**Expected Result:**
- ✅ No horizontal scroll
- ✅ Buttons are tappable (not too small)
- ✅ Text is readable
- ✅ Layout stacks properly on mobile
- ✅ Images scale correctly

---

## Quick Smoke Test (5 Minutes)

Run this sequence to verify all critical paths:

```
1. Student Quiz Flow (2 min)
   ├─ Navigate to /explore
   ├─ Select a subject
   ├─ Select a topic
   ├─ Start quiz
   ├─ Answer 3 questions
   └─ Verify results page

2. Teacher Signup (1 min)
   ├─ Navigate to /teacher
   ├─ Click "Sign up"
   ├─ Enter test email
   └─ Verify confirmation page

3. Teacher Create Quiz (2 min)
   ├─ Login as teacher
   ├─ Navigate to "Create Quiz"
   ├─ Select "Country/Exam" destination
   ├─ Open country dropdown
   ├─ Select country
   └─ Verify exams load
```

---

## Network Tab Security Check

**Critical Check:** Verify no answer leakage

```
1. Start any quiz
2. Open Network tab
3. Click "Preserve log"
4. Complete one question
5. Search network log for "correct_index"
   → Should find: 0 results
6. Search for "correct_answer"
   → Should find: 0 results
```

---

## Error Scenarios to Test

### Quiz Start Errors
- ❌ Quiz with 0 questions → Should show "No questions available"
- ❌ Deleted quiz → Should show "Quiz not found"
- ❌ Network timeout → Should show "Failed to start quiz"

### Teacher Signup Errors
- ❌ Email already exists → Shows "already registered" with Sign in/Reset buttons
- ❌ Invalid email format → Shows "Please enter a valid email"
- ❌ Weak password → Supabase shows password requirements

### Answer Submission Errors
- ❌ Network failure → Should show "Failed to submit answer"
- ❌ Run expired → Should show "Quiz has ended"

---

## Production Readiness Checklist

Before going live:

- [ ] Run quiz start test 20 times consecutively - all succeed
- [ ] Verify Network tab shows no correct answers
- [ ] Test teacher signup and email verification
- [ ] Test country/exam dropdown loads
- [ ] Test mobile viewport (375px, 768px, 1366px)
- [ ] Test immersive flow end-to-end
- [ ] Verify no console errors during normal use
- [ ] Check Supabase RLS policies enabled
- [ ] Verify email service configured
- [ ] Test "Game Over" flow (fail 2 attempts)
- [ ] Test "Quiz Complete" flow (answer all correctly)

---

## Expected Performance

### Page Load Times
- Quiz start: < 2 seconds
- Question load: < 500ms
- Answer submit: < 1 second
- Results page: < 1 second

### Network Requests
- Quiz start: 3-4 requests (session, questions, run)
- Per question: 1 request (submit answer)
- No polling or unnecessary requests

---

## Common Issues & Solutions

### "questions_data null" Error
**Fixed:** Migration applied, RPC function updated
**Verify:** Check `start_quiz_run` function exists in database

### Country Dropdown Not Loading
**Fixed:** Uses static config, no DB queries needed
**Verify:** Check `staticCountryExamConfig.ts` imported correctly

### Email Not Received
**Check:**
1. Supabase Auth settings configured
2. Email templates enabled
3. SMTP provider connected
4. Check spam folder

### Quiz Not Starting
**Check:**
1. Network tab for 400/500 errors
2. Console for JavaScript errors
3. Supabase logs for RLS violations
4. Verify quiz has published questions

---

## Beta Feedback Collection

Ask beta testers to report:

1. **Quiz Start Issues**
   - Did quiz start immediately?
   - Any error messages?
   - How many times did you retry?

2. **User Experience**
   - Was signup process clear?
   - Did you receive verification email?
   - Was quiz gameplay smooth?
   - Any confusing UI elements?

3. **Mobile Experience**
   - What device/browser used?
   - Any layout issues?
   - Were buttons easy to tap?
   - Any text too small to read?

4. **Performance**
   - Any slow page loads?
   - Any lag during gameplay?
   - Any freezing or crashes?

---

## Support Resources

**Logs to Check:**
- Supabase Edge Function Logs
- Browser Console (F12)
- Network Tab (F12 → Network)
- Supabase Database Logs

**Key Tables to Monitor:**
- `public_quiz_runs` - Quiz gameplay
- `topic_run_answers` - Answer submissions
- `quiz_sessions` - User sessions
- `audit_logs` - Admin actions

**Critical RPC Functions:**
- `start_quiz_run` - Creates quiz runs
- `submit_topic_answer` - Validates answers

---

## Success Metrics

Track these KPIs during beta:

- Quiz completion rate: Target > 70%
- Quiz start success rate: Target 100%
- Signup conversion: Target > 80%
- Email verification rate: Target > 60%
- Mobile usage: Track device breakdown
- Average questions per session: Target > 5

---

## Emergency Rollback

If critical issues discovered:

1. Revert last migration:
   ```sql
   -- List applied migrations
   SELECT * FROM supabase_migrations.schema_migrations
   ORDER BY version DESC LIMIT 5;

   -- Document issue and notify team
   ```

2. Disable affected features via feature flags
3. Communicate with beta users
4. Apply hotfix when ready

---

## READY TO TEST 🧪

All fixes implemented and verified. Build successful. Security hardened. Begin beta testing!

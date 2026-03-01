# AI Quiz Generation - Testing Guide

## Quick Verification Steps

### 1. Open Browser Console
**Before testing, open DevTools:**
- Chrome/Edge: Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
- Click "Console" tab
- Keep it open during testing

### 2. Login as Teacher
1. Go to your app URL
2. Click "Teachers" or navigate to `/teacher`
3. Login with teacher credentials
4. Ensure you have premium/active subscription

---

## Test 1: Normal AI Generation (Happy Path)

### Steps:
1. Navigate to: **Teacher Dashboard → Create Quiz**
2. **Step 1 - Subject**: Select "Science"
3. **Step 2 - Topic**: Select any topic (or create new one)
4. **Step 3 - Details**:
   - Title: "Test Quiz"
   - Difficulty: Medium
   - Description: "Testing AI generation"
   - Click "Next: Add Questions"
5. **Step 4 - Questions**: Click "AI Generate" tab
6. Enter:
   - Topic: "Photosynthesis in plants"
   - Number of Questions: 5
   - Difficulty: Medium
7. Click **"Generate Questions"** button

### ✅ Expected Results:

**Console Output** (Check exact order):
```
[AI Generate] Step 1: Getting session...
[AI Generate] Session check: { hasSession: true, hasAccessToken: true, ... }
[AI Generate] Token expiry check: { isExpired: false, secondsUntilExpiry: 3456 }
[AI Generate] Step 2: Making first API call...
[AI Generate] Request start: 2026-02-04T12:34:56.789Z
[AI Generate] Has access token: true
[AI Generate] Request to: https://xxx.supabase.co/functions/v1/ai-generate-quiz-questions
[AI Generate] Response status: 200
[AI Generate] Response ok: true
[AI Generate] Response data: { hasItems: true, hasError: false, ... }
[AI Generate] ✅ Success: Generated 5 questions
```

**UI Changes**:
- Loading spinner appears during generation
- "Generating..." text shows
- After 5-10 seconds, questions appear in "Review Generated Questions" panel
- Each question shows:
  - Question text
  - 4 options
  - Radio buttons to change correct answer
  - Explanation
  - Trash icon to delete
- Green toast notification: "Successfully generated 5 questions!"
- **Regenerate** and **Add to Quiz** buttons visible

**Network Tab** (DevTools → Network):
- Filter: `ai-generate-quiz`
- Request Method: `POST`
- Status: `200`
- Request Headers:
  - `Authorization: Bearer eyJhbG...` ✅
  - `apikey: eyJhbG...` ✅
  - `Content-Type: application/json` ✅
- Response Body:
  ```json
  {
    "items": [
      {
        "type": "mcq",
        "question": "What is the primary function...",
        "options": ["...", "...", "...", "..."],
        "correctIndex": 2,
        "explanation": "..."
      }
    ]
  }
  ```

### ❌ What Should NOT Happen:
- ❌ No redirect to login page
- ❌ No "Session expired" error
- ❌ No page reload
- ❌ No console errors

---

## Test 2: Token Refresh (Expired Token)

**Note**: This is harder to test naturally. You can:
- Wait 1 hour for token to expire, OR
- Manually expire token (advanced)

### If Token is Expired:

**Expected Console Output**:
```
[AI Generate] Step 1: Getting session...
[AI Generate] Token expiry check: { isExpired: true, secondsUntilExpiry: -123 }
[AI Generate] Step 2: Making first API call...
[AI Generate] Response status: 401
[AI Generate] Step 3: Got 401, attempting token refresh...
[AI Generate] Refresh result: { success: true, hasNewToken: true }
[AI Generate] Token refreshed successfully, retrying request...
[AI Generate] Retry response status: 200
[AI Generate] ✅ Success: Generated 5 questions
```

**UI Behavior**:
- Slightly longer loading time (token refresh + retry)
- Questions still appear successfully
- NO error message shown to user
- NO redirect

---

## Test 3: Session Completely Expired (Manual Test)

### Steps to Simulate:
1. Open DevTools → Application tab (Chrome) or Storage tab (Firefox)
2. Under Storage → Local Storage → your domain
3. Find keys starting with `sb-` and delete them
4. Refresh page
5. Try to generate questions

**Expected Console Output**:
```
[AI Generate] Step 1: Getting session...
[AI Generate] Session check: { hasSession: false, hasError: false }
No session found
```

OR if session exists but refresh fails:
```
[AI Generate] Step 3: Got 401, attempting token refresh...
[AI Generate] Refresh result: { success: false, error: true }
[AI Generate] Token refresh failed
```

**UI Behavior**:
- Red error box appears:
  - Icon: ⚠️ AlertCircle
  - Message: "Your session has expired. Please log in again."
  - **3 Buttons**:
    - [Retry] - Blue button
    - [Back to Dashboard] - Gray button
    - [Login] - Red button
- ❌ NO automatic redirect
- ❌ Page stays on Create Quiz

**User Actions**:
- Click **Retry**: Attempts generation again (will fail again if session still expired)
- Click **Back to Dashboard**: Navigates to `/teacherdashboard`
- Click **Login**: Navigates to `/teacher` login page

---

## Test 4: No Premium Subscription (403 Error)

### Steps:
1. Login as teacher WITHOUT premium subscription
2. Try to generate questions

**Expected Console Output**:
```
[AI Generate] Step 1: Getting session...
[AI Generate] Session check: { hasSession: true, hasAccessToken: true }
[AI Generate] Step 2: Making first API call...
[AI Generate] Response status: 403
[AI Generate] Response data: { errorCode: 'premium_required' }
[AI Generate] Error after all attempts: { status: 403, errorCode: 'premium_required' }
```

**UI Behavior**:
- Red error box appears
- Message: "Premium subscription required to use AI generation. Please upgrade your account."
- ❌ NO Retry/Login buttons shown (not an auth issue)
- ❌ NO automatic redirect
- User stays on Create Quiz page

**What Should NOT Happen**:
- ❌ Token refresh should NOT be attempted (403 is permission, not auth)
- ❌ No retry loop

---

## Test 5: Full Quiz Creation Flow

### Steps:
1. Complete Test 1 (generate 5 questions)
2. Click **"Add to Quiz"** button
3. Questions should move to main quiz questions list
4. Add 2 more manual questions
5. Click **"Next: Review"**
6. Review all 7 questions (5 AI + 2 manual)
7. Click **"Publish Quiz"**

**Expected Results**:
- All 7 questions visible in Review
- AI-generated questions have explanations
- Manual questions show as added
- Publish succeeds
- Navigate to "My Quizzes" tab
- New quiz appears in list
- Click quiz to preview
- All questions work in preview mode

---

## Test 6: Edit Generated Questions Before Adding

### Steps:
1. Generate 5 questions
2. In review panel, **edit question text** of question 1
3. Change **correct answer** of question 2 (click different radio button)
4. **Delete** question 3 (click trash icon)
5. Edit **explanation** of question 4
6. Click "Add to Quiz"

**Expected Results**:
- Only 4 questions added (1 deleted)
- Question 1 has edited text
- Question 2 has new correct answer
- Question 4 has edited explanation
- All edits preserved

---

## Test 7: Multiple Generation Attempts

### Steps:
1. Generate 5 questions (topic: "Photosynthesis")
2. Review questions
3. Click **"Regenerate"** button
4. Confirm replacement

**Expected Results**:
- Confirmation dialog: "This will replace your current generated questions. Continue?"
- Click OK
- New generation starts
- New set of 5 questions replaces old ones
- NO errors
- NO redirect

---

## Debugging Checklist

If something fails, check:

### Console Errors
- Look for red errors in console
- Check if any JS exceptions
- Note the exact error message

### Network Errors
- DevTools → Network tab
- Filter: `ai-generate`
- Check Status Code:
  - 200 = Success
  - 401 = Auth issue (should auto-retry)
  - 403 = Permission issue (no premium)
  - 500 = Server error
- Click request → Headers → View:
  - Request Headers (Authorization present?)
  - Response Headers
  - Response body

### Session Issues
- DevTools → Application → Local Storage
- Check for `sb-` keys
- Check `supabase.auth.session` value
- Check token expiry timestamp

---

## Success Criteria Summary

✅ **Must Work**:
- AI generation completes successfully
- Questions appear in review panel
- Questions can be edited
- Questions can be added to quiz
- Quiz can be published
- No unexpected redirects
- Token auto-refresh works silently

✅ **Error Handling**:
- Expired session shows clear message + action buttons
- No premium shows upgrade message
- Network errors show retry option
- No automatic redirects on errors

✅ **Console Logs**:
- Clear step-by-step logs
- Session info logged (boolean only, no full tokens)
- Request/response status logged
- Success/failure clearly marked

---

## Common Issues & Solutions

### Issue: "Session expired" on every attempt
**Solution**:
- Check if teacher is actually logged in
- Check Local Storage has `sb-` session keys
- Try logout and login again

### Issue: "Premium required" but you have premium
**Solution**:
- Check `teacher_entitlements` table in database
- Verify `status = 'active'`
- Verify `expires_at` is null or in future
- Check console for entitlement check result

### Issue: Network request fails immediately
**Solution**:
- Check VITE_SUPABASE_URL in .env
- Check VITE_SUPABASE_ANON_KEY in .env
- Check edge function is deployed
- Check OPENAI_API_KEY is set in Supabase

### Issue: Questions never appear
**Solution**:
- Check Network tab response body
- Check console for response parsing errors
- Check response has `items` array
- Check each item has required fields

---

## Quick Test Command

Run all tests in this order:
1. Test 1 (Happy Path) - MUST PASS
2. Test 5 (Full Flow) - MUST PASS
3. Test 6 (Edit Questions) - MUST PASS
4. Test 7 (Regenerate) - SHOULD PASS

If all pass, AI generation is working correctly!

---

## What to Report

If you find a bug, report:
1. Which test failed
2. Console output (full logs)
3. Network request/response (screenshot)
4. Error message shown to user
5. Expected vs Actual behavior

This helps debug quickly!

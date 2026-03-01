# Evidence Checklist for Testing

## Required Screenshots for Proof

### 1. Redirect Loop Fix
**Screenshot Required:**
- Browser console after navigating to `/teacherdashboard`
- Must show:
  ```
  [TeacherDashboardProvider] 🔍 ACCESS CHECK #1 - User: [userid]
  [TeacherDashboardProvider] verify-teacher called: 1
  [TeacherDashboardProvider] ✅ Access granted (Check #1)
  ```

**Pass Criteria:** Counter shows `#1` only, not `#2` or higher

---

### 2. Topic Creation Fix (RLS)
**Screenshot Required:**
- Create Quiz tab → Select Subject → Click "Create Topic" dialog
- Enter topic name → Submit
- Console must show NO 403 errors
- Topic appears in dropdown

**Pass Criteria:**
- Console shows 201 or 200 status for INSERT
- No error messages
- Topic visible in UI immediately

---

### 3. AI Generator Working
**Screenshot Required:**
- AI Generator page with filled form
- Click "Generate Quiz with AI"
- Console showing:
  ```
  [AI Generator] Starting quiz generation...
  [AI Generator] Session verified, calling edge function...
  [AI Generator] Success! Generated 10 questions
  ```
- Network tab showing `ai-generate-quiz-questions` with status 200

**Pass Criteria:**
- No 401 errors
- Status 200 from edge function
- Questions loaded into Create Quiz wizard

---

### 4. Draft Persistence
**Screenshot Required:**
- Create Quiz page with 2 questions added
- Browser refresh (F5)
- Questions still present after reload

**Pass Criteria:**
- Draft restores exactly
- No data loss
- Console shows: `[QuizDraft] Loaded draft from localStorage`

---

### 5. Logout Clears Everything
**Screenshot Required:**
- Console after clicking Logout showing:
  ```
  [Logout] Removed: sb-[...]
  [Logout] Removed: startsprint:createQuizDraft:[userId]
  [Logout] Cleared 5 localStorage keys
  [Logout] Successfully signed out
  [Logout] Session after logout: null (SUCCESS)
  ```

**Pass Criteria:**
- All draft keys removed
- Session null
- Redirect to `/teacher` works

---

### 6. Zero 401/403 Errors
**Screenshot Required:**
- Console after:
  1. Login
  2. Navigate to all tabs
  3. Create a topic
  4. Use AI generator
  5. Save draft

**Pass Criteria:**
- Console filter for "401" → 0 results
- Console filter for "403" → 0 results
- All network requests show 200/201

---

## Quick Test Script

Run these commands in browser console to verify:

```javascript
// 1. Check session persists
console.log('Session exists:', !!localStorage.getItem('sb-startsprint-auth-token'));

// 2. Check draft keys
console.log('Draft keys:', Object.keys(localStorage).filter(k => k.includes('createQuizDraft')));

// 3. Check Supabase config
console.log('Supabase keys:', Object.keys(localStorage).filter(k => k.startsWith('sb-')));

// 4. Verify verification count
// Navigate to dashboard and look for "verify-teacher called: 1" in console
```

---

## Manual Testing Checklist

- [ ] Login as teacher
- [ ] Console shows `ACCESS CHECK #1` only
- [ ] Navigate to Create Quiz
- [ ] Create a new topic (no 403)
- [ ] Topic appears in dropdown
- [ ] Fill in quiz details
- [ ] Add 2 manual questions
- [ ] Refresh page
- [ ] Draft restores
- [ ] Go to AI Generator
- [ ] Generate 10 questions (no 401)
- [ ] Questions load into wizard
- [ ] Complete quiz to Step 5 (Review)
- [ ] Publish quiz
- [ ] Logout
- [ ] Console shows draft keys cleared
- [ ] Visit `/teacherdashboard` → redirects to `/teacher`

---

## Expected Network Calls

When using the teacher dashboard, these calls should succeed:

| Endpoint | Method | Expected Status |
|----------|--------|----------------|
| `/rest/v1/teacher_entitlements` | GET | 200 |
| `/rest/v1/topics` | POST | 201 |
| `/rest/v1/topics` | SELECT | 200 |
| `/functions/v1/ai-generate-quiz-questions` | POST | 200 |
| `/rest/v1/question_sets` | POST | 201 |
| `/rest/v1/topic_questions` | POST | 201 |

All should return success codes, no 401/403/500 errors.

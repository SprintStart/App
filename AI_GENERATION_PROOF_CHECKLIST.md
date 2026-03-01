# AI Generation 401 Fix - Proof Required Checklist

## What Changed

### ✅ Switched from supabase.functions.invoke() to fetch()
**Why:** Full control over headers. The Supabase JS client may have issues passing custom headers.

**Before:**
```typescript
const response = await supabase.functions.invoke('ai-generate-quiz-questions', {
  headers: { Authorization: `Bearer ${token}`, apikey: key }
});
```

**After:**
```typescript
const response = await fetch(`${url}/functions/v1/ai-generate-quiz-questions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
    'apikey': supabaseAnonKey
  },
  body: JSON.stringify(payload)
});
```

### ✅ Enhanced Logging
**Console will now show:**
- Session info (has access token, user ID, expiry)
- Request URL
- Request headers (truncated for security)
- Request body
- Response status (200, 401, 403)
- Response data (items or error)

### ✅ Edge Function Logs Headers
**Function logs will show:**
- What headers arrived (hasAuthorization, hasApiKey)
- Auth header format
- User authentication result
- Entitlement check result

## Testing Steps

### Step 1: Open Browser DevTools FIRST
1. Go to: https://startsprint.app/teacherdashboard?tab=create-quiz
2. Press F12
3. Go to **Console** tab → Clear (🚫)
4. Go to **Network** tab → Clear (🚫) → Check "Preserve log" ✅

### Step 2: Trigger AI Generation
1. Complete Steps 1-3 (Subject, Topic, Details)
2. Go to Step 4 → Click **"AI Generate"** tab
3. Enter: `Entrepreneurship basics`
4. Count: `5`, Difficulty: `Medium`
5. Click **"Generate Questions"**

### Step 3: Check Console Output

**Expected in Console:**
```
[AI Generate] Session info: {
  hasSession: true,
  hasAccessToken: true,
  tokenPrefix: "eyJhbGciOiJIUzI1NiIs...",  ← MUST start with "eyJ" (JWT)
  user: "f2a6478d-...",
  expiresAt: 1738757234
}

[AI Generate] Using fetch() for full header control

[AI Generate] Request headers: {
  Content-Type: "application/json",
  Authorization: "Bearer eyJhbGciOiJIUzI1NiIs...",
  apikey: "eyJhbGciOiJIUzI1NiIsInR5cC..."
}

[AI Generate] Response received: {
  status: 200,  ← SHOULD BE 200, not 401
  statusText: "OK",
  ok: true
}

[AI Generate] Response data: {
  hasItems: true,
  hasError: false
}

[AI Generate] Success: Generated 5 questions
```

**If 401, console will show:**
```
[AI Generate] Response received: {
  status: 401,  ← FAILURE
  statusText: "Unauthorized",
  ok: false
}

[AI Generate] Response data: {
  hasItems: false,
  hasError: true,
  errorCode: "missing_auth" or "invalid_auth",
  errorMessage: "..."
}
```

### Step 4: Check Network Request

**In Network tab:**
1. Find POST to `ai-generate-quiz-questions`
2. Click it
3. Go to **Headers** tab
4. Scroll to **Request Headers** section

**✅ REQUIRED SCREENSHOT #1: Request Headers**

Must show:
```
Request URL: https://quhugpgfrnzvqugwibfp.supabase.co/functions/v1/ai-generate-quiz-questions
Request Method: POST
Status Code: 200 OK (or 401 Unauthorized if still broken)

Request Headers:
  authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  content-type: application/json
```

**If either authorization or apikey is MISSING → that's the bug**

5. Go to **Response** tab

**✅ REQUIRED SCREENSHOT #2: Response Body**

If 200 OK:
```json
{
  "items": [
    {
      "type": "mcq",
      "question": "What is...",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 0,
      "explanation": "..."
    },
    ...
  ]
}
```

If 401:
```json
{
  "error": "missing_auth" or "invalid_auth",
  "message": "Missing Authorization bearer token" or "Invalid or expired token"
}
```

If 403:
```json
{
  "error": "premium_required",
  "message": "Premium subscription required for AI generation"
}
```

### Step 5: Check Edge Function Logs

1. Go to: https://supabase.com/dashboard/project/quhugpgfrnzvqugwibfp
2. Click "Edge Functions" in sidebar
3. Click "ai-generate-quiz-questions"
4. Click "Logs" tab
5. Look for most recent logs

**✅ REQUIRED SCREENSHOT #3: Edge Function Logs**

If working:
```
[AI Generate] Request headers: {
  hasAuthorization: true,
  hasApiKey: true,
  contentType: "application/json",
  origin: "https://startsprint.app"
}

[AI Generate] Received request with Authorization header
[AI Generate] Auth header format: Bearer eyJhbGciOiJI...
[AI Generate] Has apikey header: true
[AI Generate] Authenticated user: f2a6478d-... (teacher@example.com)
[AI Generate] Entitlement check result: active
[AI Generate] Success: Generated 5 questions in 3542ms
```

If failing at auth:
```
[AI Generate] Request headers: {
  hasAuthorization: false,  ← PROBLEM
  hasApiKey: true,
  ...
}

[AI Generate] Missing Authorization header
[AI Generate] Available headers: ["content-type", "apikey", "x-client-info", ...]
```

OR:
```
[AI Generate] Received request with Authorization header
[AI Generate] Auth verification failed: Invalid JWT
```

## Diagnosis Guide

### Scenario A: Console shows "tokenPrefix: sb-..."
**Problem:** Using refresh token instead of access token
**Fix:** Check session.access_token vs session.refresh_token

### Scenario B: Network tab shows no Authorization header
**Problem:** Headers not being sent by browser
**Fix:** Check CORS, check fetch() call

### Scenario C: Network tab shows Authorization but edge function logs say missing
**Problem:** Header being stripped (rare)
**Fix:** Check edge function CORS, check header name casing

### Scenario D: Edge function logs show "Auth verification failed"
**Problem:** Token is expired or malformed
**Fix:** Re-login, check token expiry

### Scenario E: 403 Premium Required
**Problem:** User doesn't have active entitlement
**Fix:** Grant premium via admin portal OR test with different user

## Quick Manual Test (Optional)

Copy your access token from console, then run:

```bash
TOKEN="<paste from console>"

curl -v -X POST \
  https://quhugpgfrnzvqugwibfp.supabase.co/functions/v1/ai-generate-quiz-questions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1aHVncGdmcm56dnF1Z3dpYmZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4Mjk2MTAsImV4cCI6MjA4NTQwNTYxMH0.jzbvDz4Tg32ncuU-fFIvSjSU_NVyIt-JqJk3QMN8CUU" \
  -d '{
    "subject": "Business",
    "topic": "Entrepreneurship basics",
    "quiz_title": "Test",
    "quiz_description": "Test",
    "difficulty": "medium",
    "count": 5,
    "types": ["mcq"],
    "curriculum": "uk",
    "language": "en-GB"
  }'
```

This bypasses the frontend and tests the function directly.

## Definition of Done

### ✅ Must Have:
1. **Screenshot** of Network request showing both headers present
2. **Screenshot** of Network response showing 200 OK + questions JSON
3. **Screenshot** of Edge Function logs showing auth success
4. Questions render in UI with edit controls
5. "Add to Quiz" button adds them to main quiz
6. No alert() popups - errors show in red box

### ❌ Known Issues (Expected):
- 403 if user doesn't have premium entitlement (CORRECT behavior)
- OpenAI rate limits if testing too quickly

### ✅ Not Changed:
- Stripe checkout (still working)
- Other edge functions (unaffected)
- verify_jwt still ON (as required)

## Summary

**Deployed:**
- Frontend: Now uses fetch() with explicit headers
- Edge Function: Already has auth validation + logging
- Build: ✅ 772.52 kB

**What to send me:**
1. Console output (screenshot or text)
2. Network request headers (screenshot)
3. Network response (screenshot)
4. Edge function logs (screenshot)

With these 4 pieces of proof, I can diagnose the exact issue.

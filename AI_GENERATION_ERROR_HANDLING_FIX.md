# AI Generation 401 Fix - Implementation Complete

## Changes Deployed

### 1. Frontend: Switched to fetch() for Full Header Control

**File:** `src/components/teacher-dashboard/CreateQuizWizard.tsx`

**Key change:** Replaced `supabase.functions.invoke()` with direct `fetch()` call.

**Why:** The Supabase JS client's `invoke()` method may not properly pass custom headers. Using `fetch()` gives us complete control.

**Code:**
```typescript
// Get session
const { data: { session } } = await supabase.auth.getSession();
if (!session?.access_token) {
  throw new Error("No access token");
}

// Build request
const functionUrl = `${SUPABASE_URL}/functions/v1/ai-generate-quiz-questions`;
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${session.access_token}`,  // ← Access token
  'apikey': SUPABASE_ANON_KEY                          // ← Anon key
};

// Make request
const response = await fetch(functionUrl, {
  method: 'POST',
  headers: headers,
  body: JSON.stringify(payload)
});

// Handle response
const data = await response.json();
if (!response.ok || data.error) {
  // Handle error
}
```

### 2. Edge Function: Header Logging (Already Deployed)

**File:** `supabase/functions/ai-generate-quiz-questions/index.ts`

**Logs show:**
- Whether Authorization header is present
- Whether apikey header is present
- User authentication result
- Premium entitlement check result

### 3. Console Logging Added

**Frontend now logs:**
- Session info (token prefix, user ID, expiry)
- Request URL and headers (truncated)
- Request body
- Response status and data
- Success/error messages

## How to Test

### 1. Open DevTools
- Go to https://startsprint.app/teacherdashboard?tab=create-quiz
- Press F12
- Open Console tab (clear it)
- Open Network tab (clear it, check "Preserve log")

### 2. Try AI Generation
- Complete Steps 1-3 in wizard
- Go to Step 4 → AI Generate tab
- Enter topic, count, difficulty
- Click "Generate Questions"

### 3. Check Results

**In Console:**
- Look for `[AI Generate]` logs
- Check session has `tokenPrefix: "eyJ..."`
- Check response status (200 = success, 401 = auth fail, 403 = no premium)

**In Network tab:**
- Click POST request to `ai-generate-quiz-questions`
- Headers tab → Request Headers section
- **VERIFY:** `authorization: Bearer ...` is present
- **VERIFY:** `apikey: ...` is present

**In Edge Function Logs (Supabase dashboard):**
- Go to Edge Functions → ai-generate-quiz-questions → Logs
- Check if headers arrived
- Check if auth validation passed

## Expected Outcomes

### Success (200 OK):
```
Console: "Success: Generated 5 questions"
Network: Status 200, response has "items" array
UI: Questions appear in review section
```

### Auth Failure (401):
```
Console: "Session expired. Please login again."
Network: Status 401, error: "missing_auth" or "invalid_auth"
Edge Logs: "Missing Authorization header" OR "Auth verification failed"
```

### No Premium (403):
```
Console: "Premium subscription required"
Network: Status 403, error: "premium_required"
Edge Logs: "Entitlement check result: none"
```

## What I Need From You

**To diagnose if still failing, send 3 screenshots:**

1. **Browser Console** showing [AI Generate] logs
2. **Browser Network tab** showing request headers (authorization + apikey)
3. **Edge Function Logs** (Supabase dashboard) showing what the function received

These will tell me exactly where the auth is breaking.

## Build Status

✅ Frontend built: 772.52 kB
✅ Edge function deployed with logging
✅ verify_jwt: ON (kept secure as required)
✅ No changes to Stripe or other working APIs

## Quick Debug Commands

**Check session in browser console:**
```javascript
const { data } = await supabase.auth.getSession();
console.log('Token:', data.session?.access_token?.substring(0, 50));
console.log('Expires:', new Date(data.session?.expires_at * 1000));
```

**Test edge function with curl:**
```bash
TOKEN="<your_access_token>"
curl -X POST https://quhugpgfrnzvqugwibfp.supabase.co/functions/v1/ai-generate-quiz-questions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1aHVncGdmcm56dnF1Z3dpYmZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4Mjk2MTAsImV4cCI6MjA4NTQwNTYxMH0.jzbvDz4Tg32ncuU-fFIvSjSU_NVyIt-JqJk3QMN8CUU" \
  -d '{"subject":"Business","topic":"Entrepreneurship","quiz_title":"Test","quiz_description":"Test","difficulty":"medium","count":5,"types":["mcq"],"curriculum":"uk","language":"en-GB"}'
```

## Common Issues

### "tokenPrefix: sb-..." in console
→ Using refresh token instead of access token (BUG in code)

### Network shows no Authorization header
→ Headers not being sent by fetch() (Check browser CORS)

### Edge function logs "Missing Authorization header"
→ Header being stripped or not sent (Need browser network screenshot)

### "Auth verification failed"
→ Token expired or malformed (Re-login, check expiry time)

### 403 Premium Required
→ User doesn't have entitlement (Grant via admin OR test with premium user)

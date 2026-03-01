# AI Generation Debug Guide - Get Proof of Headers

## What I Just Did

### 1. Frontend Changes (CreateQuizWizard.tsx)
Added detailed logging and explicit `apikey` header:

```typescript
// Now passing BOTH Authorization and apikey headers explicitly
const response = await supabase.functions.invoke('ai-generate-quiz-questions', {
  body: { /* ... */ },
  headers: {
    Authorization: `Bearer ${session.access_token}`,
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY  // ← ADDED THIS
  }
});
```

### 2. Edge Function Changes
Added comprehensive header logging to see what actually arrives.

### 3. Deployment Status
- ✅ Edge Function: DEPLOYED with enhanced logging
- ✅ Frontend: BUILT (772.46 kB) with explicit headers
- ✅ Ready for testing

## Step-by-Step Testing Instructions

### Step 1: Open DevTools BEFORE Testing
1. Navigate to: `https://startsprint.app/teacherdashboard?tab=create-quiz`
2. Press `F12` (or Right-click → Inspect)
3. Go to **Console** tab - clear it
4. Go to **Network** tab - clear it, check "Preserve log"

### Step 2: Try AI Generation
1. Complete Steps 1-3 (Subject, Topic, Details)
2. Go to Step 4 → Click **"AI Generate"** tab
3. Enter topic: `Entrepreneurship basics`
4. Set count: `5`, difficulty: `Medium`
5. Click **"Generate Questions"**

### Step 3: Check Console Logs
**Expected output:**
```
[AI Generate] Session info: {
  hasSession: true,
  hasAccessToken: true,
  tokenPrefix: "eyJhbGciOiJIUzI1NiIs...",
  user: "...",
  expiresAt: ...
}
[AI Generate] Starting generation with auth token
[AI Generate] Supabase URL: https://quhugpgfrnzvqugwibfp.supabase.co
[AI Generate] Has anon key: true
```

### Step 4: Check Network Request Headers
1. In Network tab, find POST to `ai-generate-quiz-questions`
2. Click it → **Headers** tab → scroll to **Request Headers**

**REQUIRED SCREENSHOT 1: Show these headers:**
- `Authorization: Bearer eyJhbGc...`
- `apikey: eyJhbGc...`
- `Content-Type: application/json`

### Step 5: Check Response
Click **Response** tab

**REQUIRED SCREENSHOT 2: Show response body**
- If 200: `{"items": [...]}`
- If 401/403: `{"error": "...", "message": "..."}`

### Step 6: Check Edge Function Logs
1. Go to Supabase Dashboard
2. Edge Functions → ai-generate-quiz-questions → Logs

**REQUIRED SCREENSHOT 3: Show function logs**

## What I Need From You

**3 Screenshots:**
1. Browser Network tab showing request headers (Authorization + apikey)
2. Browser Network tab showing response (status + body)
3. Supabase Edge Function logs showing what headers arrived

With these, I can see exactly where the auth is failing and fix it.

## Quick Debug: Check Your Access Token

In Console, run:
```javascript
const session = await supabase.auth.getSession();
console.log('Token:', session.data.session?.access_token.substring(0, 50));
console.log('Expires:', new Date(session.data.session?.expires_at * 1000));
```

If token starts with `"sb-"` → WRONG (that's refresh token)
If token starts with `"eyJ"` → CORRECT (that's JWT access token)

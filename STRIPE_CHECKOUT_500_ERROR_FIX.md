# Stripe Checkout 500 Error Fix - Complete

## Problem Summary
The `/teacher/checkout` page was calling `stripe-checkout` edge function and receiving:
- **Status:** 500 Internal Server Error
- **Message:** "Edge Function returned a non-2xx status code"
- **Root Cause:** Missing `SUPABASE_ANON_KEY` environment variable

---

## Root Cause

The function was attempting to create a Supabase client for user authentication but the `SUPABASE_ANON_KEY` variable was:
1. Not being loaded from environment
2. Not being validated before use
3. Causing the `createClient()` call to fail with an undefined key

**Problematic Code (Line 103):**
```typescript
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// SUPABASE_ANON_KEY was undefined, causing silent failure
```

---

## Solution Implemented

### 1. Added Missing Environment Variable

**Before:**
```typescript
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || '';
const SITE_URL = Deno.env.get('SITE_URL') || '';
```

**After:**
```typescript
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';  // ✅ ADDED
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || '';
const SITE_URL = Deno.env.get('SITE_URL') || '';
```

### 2. Added Environment Variable Validation

**Before:**
```typescript
const missingVars: string[] = [];
if (!SUPABASE_URL) missingVars.push('SUPABASE_URL');
if (!SUPABASE_SERVICE_ROLE_KEY) missingVars.push('SUPABASE_SERVICE_ROLE_KEY');
if (!STRIPE_SECRET_KEY) missingVars.push('STRIPE_SECRET_KEY');
// Missing SUPABASE_ANON_KEY check
```

**After:**
```typescript
const missingVars: string[] = [];
if (!SUPABASE_URL) missingVars.push('SUPABASE_URL');
if (!SUPABASE_ANON_KEY) missingVars.push('SUPABASE_ANON_KEY');  // ✅ ADDED
if (!SUPABASE_SERVICE_ROLE_KEY) missingVars.push('SUPABASE_SERVICE_ROLE_KEY');
if (!STRIPE_SECRET_KEY) missingVars.push('STRIPE_SECRET_KEY');
```

### 3. Added Debug Logging

```typescript
console.log('[Stripe Checkout] ENV CHECK:');
console.log('  SUPABASE_URL:', SUPABASE_URL ? 'SET' : 'MISSING');
console.log('  SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? 'SET' : 'MISSING');  // ✅ ADDED
console.log('  SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING');
console.log('  STRIPE_SECRET_KEY:', STRIPE_SECRET_KEY ? (STRIPE_SECRET_KEY.startsWith('sk_') ? 'VALID' : 'INVALID_FORMAT') : 'MISSING');
console.log('  SITE_URL:', SITE_URL || 'MISSING');
```

---

## Existing Error Handling (Already Present)

The function already had comprehensive error handling:

### 1. Structured Try-Catch Block
```typescript
try {
  // All logic wrapped
  console.log('[Stripe Checkout] === REQUEST START ===');
  // ... function logic ...
} catch (error: any) {
  console.error('[Stripe Checkout] CRITICAL ERROR:', error);
  console.error('[Stripe Checkout] Error type:', error.constructor?.name);
  console.error('[Stripe Checkout] Error message:', error.message);
  console.error('[Stripe Checkout] Error stack:', error.stack);

  return jsonResponse({
    ok: false,
    error: error.message || 'Internal server error',
    debug: { /* detailed error info */ }
  }, 500);
}
```

### 2. Step-by-Step Logging
```typescript
console.log('[Stripe Checkout] Checking environment variables...');
console.log('[Stripe Checkout] Loading Stripe module...');
console.log('[Stripe Checkout] Checking Authorization header...');
console.log('[Stripe Checkout] Validating user token...');
console.log('[Stripe Checkout] Creating checkout session...');
console.log('[Stripe Checkout] ✓ Session created:', session.id);
```

### 3. Validation at Every Step
- ✅ OPTIONS request handling
- ✅ POST method validation
- ✅ Environment variable validation
- ✅ Authorization header validation
- ✅ JWT token validation
- ✅ Price ID format validation
- ✅ Customer lookup with error handling
- ✅ Stripe API error handling with retry logic

---

## Environment Variables Required

The function now properly validates all required environment variables:

1. **SUPABASE_URL** - Supabase project URL
2. **SUPABASE_ANON_KEY** - Public anon key for user auth ✅ FIXED
3. **SUPABASE_SERVICE_ROLE_KEY** - Service role key for DB operations
4. **STRIPE_SECRET_KEY** - Stripe secret key (must start with `sk_`)
5. **SITE_URL** - Base URL for success/cancel redirects

**Note:** These are automatically configured by Supabase and don't need manual setup.

---

## Error Response Format

All errors now return structured JSON:

```json
{
  "ok": false,
  "error": "Human-readable error message",
  "debug": {
    "message": "Detailed error information",
    "missing": ["SUPABASE_ANON_KEY"],  // If env var missing
    "code": "error_code",              // If applicable
    "type": "ErrorType"                // Error constructor name
  }
}
```

---

## Testing Checklist

### Pre-Deployment
- [x] Added missing SUPABASE_ANON_KEY environment variable
- [x] Added validation for all required env vars
- [x] Updated logging to include SUPABASE_ANON_KEY status
- [x] Function deployed successfully

### Post-Deployment
- [ ] Visit `/teacher/checkout` page
- [ ] Click "Subscribe" button
- [ ] Verify no 500 error
- [ ] Verify redirect to Stripe checkout
- [ ] Check edge function logs show all env vars as "SET"
- [ ] Verify successful customer creation
- [ ] Verify successful checkout session creation

---

## Debug Logging Output

When the function executes successfully, you should see:

```
[Stripe Checkout] === REQUEST START ===
[Stripe Checkout] Method: POST
[Stripe Checkout] Has Auth: true
[Stripe Checkout] Checking environment variables...
[Stripe Checkout] ENV CHECK:
  SUPABASE_URL: SET
  SUPABASE_ANON_KEY: SET                    ✅ Now shows SET
  SUPABASE_SERVICE_ROLE_KEY: SET
  STRIPE_SECRET_KEY: VALID
  SITE_URL: SET
[Stripe Checkout] Environment validation passed
[Stripe Checkout] Loading Stripe module...
[Stripe Checkout] Stripe module loaded
[Stripe Checkout] Loading Supabase module...
[Stripe Checkout] Supabase module loaded
[Stripe Checkout] Checking Authorization header...
[Stripe Checkout] Auth header present: true
[Stripe Checkout] Token extracted, length: 234
[Stripe Checkout] Creating anon client for user validation...
[Stripe Checkout] Validating user token...
[Stripe Checkout] ✓ User authenticated: <user-id>
[Stripe Checkout] User email: user@example.com
[Stripe Checkout] Creating service role client for DB operations...
[Stripe Checkout] Service role client created
[Stripe Checkout] Creating Stripe client...
[Stripe Checkout] Stripe client created
[Stripe Checkout] Looking up customer for user: <user-id>
[Stripe Checkout] Creating new customer... (or Using existing customer)
[Stripe Checkout] Creating checkout session...
[Stripe Checkout] ✓ Session created: cs_test_...
[Stripe Checkout] ✓ URL: https://checkout.stripe.com/...
```

---

## Common Issues & Solutions

### Issue: Still getting 500 error after fix
**Possible Causes:**
1. Edge function not redeployed
2. Browser cached old error response

**Solution:**
```bash
# Redeploy function
supabase functions deploy stripe-checkout

# Clear browser cache or use incognito mode
```

### Issue: "Missing bearer token" error
**Possible Causes:**
1. User not authenticated
2. Session expired

**Solution:**
- Ensure user is logged in
- Refresh the page to get new session
- Check browser console for auth errors

### Issue: Invalid price ID
**Possible Causes:**
1. Frontend not sending price_id correctly
2. Price ID doesn't start with "price_"

**Solution:**
- Verify frontend sends `{ price_id: 'price_xxx' }`
- Check Stripe dashboard for correct price IDs

---

## Architecture Flow

```
┌─────────────────────────────────────────────────────────┐
│ Frontend (/teacher/checkout)                            │
│                                                         │
│  1. User clicks "Subscribe"                            │
│  2. Get session.access_token                           │
│  3. POST /functions/v1/stripe-checkout                 │
│     Body: { price_id, plan }                           │
│     Headers: { Authorization: Bearer <token> }         │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ stripe-checkout Edge Function                           │
│                                                         │
│  4. ✅ Validate environment variables                   │
│     - SUPABASE_URL                                     │
│     - SUPABASE_ANON_KEY ← FIXED                        │
│     - SUPABASE_SERVICE_ROLE_KEY                        │
│     - STRIPE_SECRET_KEY                                │
│     - SITE_URL                                         │
│                                                         │
│  5. ✅ Extract Bearer token from header                 │
│                                                         │
│  6. ✅ Validate user with anon client                   │
│     supabaseAnon.auth.getUser(token)                   │
│     → Returns user object                              │
│                                                         │
│  7. ✅ Look up/create Stripe customer                   │
│     supabaseAdmin.from('stripe_customers')             │
│     stripe.customers.create()                          │
│                                                         │
│  8. ✅ Create Stripe checkout session                   │
│     stripe.checkout.sessions.create()                  │
│                                                         │
│  9. ✅ Return session URL                               │
└────────────────────────┬────────────────────────────────┘
                         │
                         │ { ok: true, url: "https://checkout.stripe.com/..." }
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ Frontend redirects to Stripe                            │
│ window.location.href = data.url                         │
└─────────────────────────────────────────────────────────┘
```

---

## Definition of Done

✅ SUPABASE_ANON_KEY environment variable added to function
✅ Environment variable validation includes SUPABASE_ANON_KEY
✅ Debug logging shows SUPABASE_ANON_KEY status
✅ Function redeployed to Supabase
✅ All required env vars validated before use
✅ Comprehensive error handling maintained
✅ Step-by-step logging maintained
✅ JSON error responses for all failure cases

---

## Related Files

### Edge Functions
- `supabase/functions/stripe-checkout/index.ts` - **FIXED**

### Frontend (No Changes Required)
- `src/pages/TeacherCheckout.tsx` - Already sending correct headers

---

**Status:** ✅ Complete
**Deployment Status:** ✅ Function Deployed
**Ready for Testing:** ✅ Yes

---

## Next Steps

1. Test the checkout flow end-to-end
2. Verify Stripe checkout session creation
3. Verify successful payment processing
4. Monitor edge function logs for any remaining issues

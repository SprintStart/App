# Token Rewards System - Technical Documentation

## Overview

The Token Rewards System is a stateless, device-based gamification feature that awards students with redeemable tokens after completing quizzes. Tokens unlock special in-app features without requiring student accounts or authentication.

**Status**: FEATURE_TOKENS = false (disabled by default)

---

## Architecture

### Design Principles

1. **Stateless**: No database storage for tokens; all validation is cryptographic
2. **No Identity Required**: Works for anonymous students without accounts
3. **Server-Side Security**: HMAC signing and validation happens server-side only
4. **Device-Based**: Caps enforced via localStorage per device
5. **Additive**: Can be enabled/disabled via feature flag with zero impact
6. **Isolated**: No changes to existing quiz, publishing, or routing flows

---

## Token Flow

### 1. Token Issuance

**Trigger**: Student completes quiz (EndScreen displayed)

**Process**:
1. After 3.5 seconds (after feedback overlay), modal appears (if FEATURE_TOKENS = true)
2. Client generates device nonce (16-byte random)
3. Client calls `POST /functions/v1/issue-token` with:
   - `quizId` (optional)
   - `runId` (optional)
   - `deviceNonce` (required)
4. Server validates request
5. Server checks daily cap (future enhancement)
6. Server generates:
   - Random token (format: SS-XXXXXX, 6 uppercase alphanumeric chars)
   - Random reward type (challenge_mode, bonus_quiz, premium_skin, power_up)
   - Expiry timestamp (default: 24 hours from now)
   - HMAC signature = HMAC-SHA256(secret, token:expiresAt:rewardType:deviceNonce)
7. Server returns: `{ token, signature, expiresAt, rewardType }`
8. Client stores in localStorage with deviceNonce
9. Client increments daily count in localStorage

**Edge Function**: `supabase/functions/issue-token/index.ts`

### 2. Token Storage

**Location**: Browser localStorage

**Keys**:
- `ss_tokens`: Array of issued tokens (auto-cleaned on expiry)
- `ss_token_daily_count`: Number of tokens issued today
- `ss_token_daily_reset`: Timestamp of last reset (midnight)
- `ss_token_unlocks`: Array of used tokens with timestamps

**Format**:
```typescript
interface TokenData {
  token: string;           // SS-XXXXXX
  signature: string;       // HMAC hex string
  expiresAt: string;       // ISO timestamp
  rewardType: string;      // challenge_mode|bonus_quiz|premium_skin|power_up
  issuedAt: number;        // Unix timestamp (client-added)
  deviceNonce: string;     // 32-char hex (client-added)
}
```

### 3. Token Validation

**Trigger**: Student clicks "Use Token" in modal or token redemption flow

**Process**:
1. Client calls `POST /functions/v1/validate-token` with:
   - `token`
   - `signature`
   - `expiresAt`
   - `rewardType`
   - `deviceNonce`
2. Server validates:
   - Token format (SS-XXXXXX, 8 chars minimum)
   - Expiry (must be future timestamp)
   - Signature = HMAC-SHA256(secret, token:expiresAt:rewardType:deviceNonce)
   - Not already used (in-memory Map with 25-hour TTL)
3. Server marks token as used (stores hash in memory)
4. Server returns: `{ ok: true, rewardType }`
5. Client stores unlock in localStorage
6. Client removes token from `ss_tokens`

**Edge Function**: `supabase/functions/validate-token/index.ts`

### 4. Reward Activation

**Current State**: Modal shows success message only

**Future Enhancement**: Implement actual reward logic per type:
- `challenge_mode`: Load harder question sets
- `bonus_quiz`: Grant 5 extra questions
- `premium_skin`: Apply theme for 24 hours (check `hasActiveUnlock('premium_skin')`)
- `power_up`: Show boost animation or hint on next question

---

## Security Model

### Threat Analysis

| Threat | Mitigation |
|--------|-----------|
| Token forgery | HMAC signature validated server-side; secret never in client |
| Token replay | Used tokens stored in-memory (hash only); 25-hour cleanup |
| Token sharing | Device nonce required; tokens tied to issuing device |
| Expiry bypass | Expiry checked server-side against current time |
| Daily cap bypass | Enforced client-side (localStorage); future: server-side tracking |
| Signature extraction | Signature is derived, not predictable; secret server-only |

### Cryptographic Details

**Algorithm**: HMAC-SHA-256

**Secret**: Environment variable `TOKEN_SECRET` (defaults to dev secret in code)

**Signature Input**: `token:expiresAt:rewardType:deviceNonce`

**Signature Output**: 64-character hex string

**Example**:
```
Token: SS-A1B2C3
Expires: 2026-03-03T12:00:00.000Z
Reward: challenge_mode
Nonce: a1b2c3d4e5f6...
Signature: HMAC-SHA256(secret, "SS-A1B2C3:2026-03-03T12:00:00.000Z:challenge_mode:a1b2c3d4e5f6...")
```

### Security Hardening Checklist

- [x] HMAC secret stored server-side only
- [x] No service role key exposed to client
- [x] Token format validation (regex: `^SS-[A-Z0-9]{6,}$`)
- [x] Expiry validation server-side
- [x] Signature verification server-side
- [x] Used token tracking (in-memory, hash-only)
- [ ] Rate limiting on issue-token endpoint (future)
- [ ] Server-side daily cap tracking per IP/device fingerprint (future)
- [ ] Token usage analytics (future)

---

## Configuration

### Feature Flag

**File**: `src/lib/featureFlags.ts`

```typescript
export const FEATURE_TOKENS = false;  // DEFAULT: OFF
```

**Behavior**:
- `false`: No modal appears, no token calls, no admin panel visible
- `true`: Token system fully active

### Admin Settings

**Location**: `/admindashboard/settings` → Token Rewards System panel (visible only if FEATURE_TOKENS = true)

**Settings**:
1. **Enable Token System**: Toggle on/off (UI-only, does not override flag)
2. **Token Expiry (Hours)**: 1-168 hours (default: 24)
3. **Daily Cap Per Device**: 1-20 tokens (default: 3)

**Storage**: localStorage key `token_settings` (admin-side only, not enforced yet)

**Future**: Store in Supabase table for server-side enforcement

---

## Database Impact

**Current**: ZERO

**Future** (optional, if analytics needed):
- `token_issuances` table: Log token generation events
- `token_redemptions` table: Log token usage events
- Columns: `token_hash`, `issued_at`, `redeemed_at`, `reward_type`, `device_fingerprint`, `ip_address`

**Migration**: Not created yet (deferred to post-freeze)

---

## Rollback Plan

### Immediate Rollback (<2 minutes)

1. Set `FEATURE_TOKENS = false` in `src/lib/featureFlags.ts`
2. Run `npm run build`
3. Deploy to Netlify

**Result**:
- No modal appears on EndScreen
- No calls to issue-token or validate-token
- TokenSettingsPanel hidden in admin dashboard
- Zero user-facing impact

### Verification

**Test**:
1. Complete any quiz
2. Observe EndScreen
3. Confirm no token modal appears after 3.5 seconds

**Edge Functions**:
- `issue-token` and `validate-token` remain deployed but receive zero traffic
- Can be deleted manually if needed (no dependencies)

### Full Removal (if needed)

**Delete Files**:
- `src/lib/tokenStorage.ts`
- `src/components/TokenRewardModal.tsx`
- `src/components/admin/TokenSettingsPanel.tsx`
- `supabase/functions/issue-token/index.ts`
- `supabase/functions/validate-token/index.ts`

**Revert Changes**:
- `src/lib/featureFlags.ts`: Remove `FEATURE_TOKENS` line
- `src/components/EndScreen.tsx`: Remove import, state, useEffect, and modal render
- `src/pages/AdminDashboard.tsx`: Remove import and panel render

**Time**: <5 minutes

---

## Testing Guide

### Enable Feature

1. Set `FEATURE_TOKENS = true` in `src/lib/featureFlags.ts`
2. Rebuild and deploy

### Test Token Issuance

1. Play any quiz as anonymous user
2. Complete quiz (correct or game over)
3. Wait 3.5 seconds after EndScreen loads
4. Verify modal appears with:
   - Token code (SS-XXXXXX)
   - Reward type and description
   - "Use Token Now" and "Save for Later" buttons

### Test Token Validation

1. Click "Use Token Now"
2. Verify success message appears
3. Verify modal closes
4. Check localStorage:
   - Token removed from `ss_tokens`
   - Unlock added to `ss_token_unlocks`

### Test Daily Cap

1. Complete 3 quizzes (default cap)
2. On 4th quiz completion, verify error: "Daily token limit reached"

### Test Expiry

1. Issue token
2. Manually edit `expiresAt` in localStorage to past date
3. Click "Use Token"
4. Verify error: "Token expired"

### Test Replay Attack

1. Issue token
2. Use token successfully
3. Attempt to use same token again (re-submit to validate-token)
4. Verify error: "Token already used"

### Test Admin Panel

1. Log in as admin
2. Navigate to `/admindashboard/settings`
3. Verify "Token Rewards System" panel appears (only if FEATURE_TOKENS = true)
4. Adjust settings and save
5. Verify settings persist in localStorage

---

## API Reference

### POST /functions/v1/issue-token

**Request**:
```json
{
  "quizId": "uuid-optional",
  "runId": "uuid-optional",
  "deviceNonce": "32-char-hex-required"
}
```

**Response** (200):
```json
{
  "token": "SS-A1B2C3",
  "signature": "64-char-hex",
  "expiresAt": "2026-03-03T12:00:00.000Z",
  "rewardType": "challenge_mode"
}
```

**Errors**:
- 400: Invalid device nonce
- 500: Internal server error

### POST /functions/v1/validate-token

**Request**:
```json
{
  "token": "SS-A1B2C3",
  "signature": "64-char-hex",
  "expiresAt": "2026-03-03T12:00:00.000Z",
  "rewardType": "challenge_mode",
  "deviceNonce": "32-char-hex"
}
```

**Response** (200):
```json
{
  "ok": true,
  "rewardType": "challenge_mode"
}
```

**Errors**:
- 400: Missing fields, invalid format, expired, already used
- 403: Invalid signature
- 500: Internal server error

---

## Future Enhancements (Post-Freeze)

### Phase 2 (Analytics)

- [ ] Log token issuance to database
- [ ] Log token redemption to database
- [ ] Admin dashboard: Token analytics (issued, redeemed, expired, by reward type)
- [ ] Teacher dashboard: Student engagement via tokens

### Phase 3 (Advanced Features)

- [ ] Server-side daily cap enforcement (IP + device fingerprint)
- [ ] Rate limiting on issue-token (max 10/minute per IP)
- [ ] Token trading/gifting between students (requires accounts)
- [ ] Special tokens for achievements (e.g., 10-quiz streak)
- [ ] Seasonal/limited-time reward types

### Phase 4 (Reward Implementation)

- [ ] Implement challenge_mode quiz loading
- [ ] Implement bonus_quiz 5-question flow
- [ ] Implement premium_skin theming system
- [ ] Implement power_up hint/boost logic

---

## Maintenance

### Monitoring

**Metrics to Track** (future):
- Token issuance rate (per hour/day)
- Token redemption rate
- Expiry rate (tokens not used)
- Error rate (validation failures)
- Daily cap hit rate

**Alerts** (future):
- Issue-token error rate >5%
- Validate-token 403 rate >10% (signature failures)
- Sudden spike in issuance (abuse detection)

### Secret Rotation

**Process**:
1. Generate new `TOKEN_SECRET` value
2. Update Supabase Edge Function secrets
3. Redeploy issue-token and validate-token functions
4. Existing tokens will fail validation (acceptable, 24-hour TTL)

**Frequency**: Every 90 days or on suspected compromise

---

## Files Modified

### New Files (6)
1. `src/lib/tokenStorage.ts` - LocalStorage management
2. `src/components/TokenRewardModal.tsx` - Student-facing modal
3. `src/components/admin/TokenSettingsPanel.tsx` - Admin configuration panel
4. `supabase/functions/issue-token/index.ts` - Token generation + signing
5. `supabase/functions/validate-token/index.ts` - Signature verification
6. `TOKENS_MODEL.md` - This documentation

### Modified Files (3)
1. `src/lib/featureFlags.ts` - Added FEATURE_TOKENS flag
2. `src/components/EndScreen.tsx` - Integrated modal (flag-gated)
3. `src/pages/AdminDashboard.tsx` - Integrated settings panel (flag-gated)

### Routes Impacted
**ZERO** - No new routes, no changes to existing routes

---

## Support & Troubleshooting

### Common Issues

**Issue**: Modal doesn't appear after quiz completion
- Check: FEATURE_TOKENS = true?
- Check: 3.5 second delay elapsed?
- Check: Browser console for errors

**Issue**: "Daily token limit reached" immediately
- Check: localStorage `ss_token_daily_count` value
- Clear: localStorage to reset (dev only)

**Issue**: "Invalid signature" error
- Check: TOKEN_SECRET matches between issue and validate functions
- Check: deviceNonce stored correctly with token

**Issue**: Token appears used when it wasn't
- Issue: In-memory Map persists across edge function warm starts
- Resolution: Wait 25 hours or restart edge function

### Debug Mode

**Enable**:
1. Open browser console
2. Run: `localStorage.setItem('debug_tokens', 'true')`
3. Reload page

**Output**:
- Token issuance requests/responses
- Token validation requests/responses
- LocalStorage operations

---

## Compliance & Privacy

**Data Collection**: None (stateless, no PII)

**GDPR**: Not applicable (no personal data stored server-side)

**COPPA**: Compliant (no student accounts, no data collection)

**Accessibility**: Modal is keyboard-navigable and screen-reader friendly

---

## Changelog

**2026-03-02**: Initial implementation (v1.0)
- FEATURE_TOKENS = false by default
- Stateless token system with HMAC validation
- Device-based daily caps
- 4 reward types (not yet implemented)
- Admin configuration panel
- Full documentation

---

## Contact

For questions or issues with the token system:
- Review this documentation first
- Check FREEZE_PROTOCOL.md for allowed changes
- Only P0 bugs (crashes, security) can be fixed during freeze

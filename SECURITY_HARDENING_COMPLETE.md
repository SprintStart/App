# Security Hardening Complete - Ready for Manual Deployment

## ✅ Security Updates Applied

### 1. Secret Header Authentication
- **Requirement**: All requests must include `X-Health-Secret` header
- **Rejection**: 401 Unauthorized if missing or incorrect
- **Environment Variable**: `HEALTHCHECK_SECRET` (must be set in Supabase)

### 2. Rate Limiting
- **Limit**: 1 request per minute per IP address
- **Response**: 429 Too Many Requests with Retry-After header
- **Protection**: Prevents abuse and DoS attempts
- **Auto-cleanup**: Removes old rate limit entries after 5 minutes

### 3. Environment Validation
- Validates all required environment variables on startup
- Clear error messages for missing configuration
- Fails fast with proper HTTP status codes

---

## 🚀 Manual Deployment Required

The edge function **cannot be auto-deployed** due to tool limitations. Follow these steps:

### Option 1: Supabase CLI (Recommended)

```bash
# 1. Generate a secret
SECRET=$(openssl rand -hex 32)
echo "Your health check secret: $SECRET"

# 2. Deploy function
supabase functions deploy run-health-checks --no-verify-jwt

# 3. Set environment variable
supabase secrets set HEALTHCHECK_SECRET=$SECRET
```

### Option 2: Supabase Dashboard

1. **Generate Secret**:
   ```bash
   openssl rand -hex 32
   ```
   Save this value - you'll need it 3 times.

2. **Deploy Function**:
   - Go to: https://supabase.com/dashboard/project/quhugpgfrnzvqugwibfp/functions
   - Create/update `run-health-checks` function
   - Copy entire contents of `supabase/functions/run-health-checks/index.ts`
   - Paste into editor
   - Verify JWT: OFF
   - Deploy

3. **Set Environment Variable**:
   - Go to: Project Settings → Edge Functions → Secrets
   - Add: `HEALTHCHECK_SECRET` = your generated secret
   - Save

4. **Update Frontend**:
   - Edit `.env` file
   - Set: `VITE_HEALTHCHECK_SECRET=your_generated_secret`
   - Rebuild: `npm run build`

---

## Testing Complete: Manual deployment and verification required


# PRODUCTION DEPLOYMENT - STEP BY STEP MANUAL

## 1️⃣ DATABASE MIGRATIONS

### Step 1.1: Add Monitoring Hardening Columns

**Go to:** Supabase Dashboard → SQL Editor → New Query

**Copy and paste this SQL:**

```sql
-- Add columns to health_checks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_checks' AND column_name = 'check_category'
  ) THEN
    ALTER TABLE health_checks ADD COLUMN check_category text DEFAULT 'route';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_checks' AND column_name = 'is_critical'
  ) THEN
    ALTER TABLE health_checks ADD COLUMN is_critical boolean DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_checks' AND column_name = 'performance_baseline_ms'
  ) THEN
    ALTER TABLE health_checks ADD COLUMN performance_baseline_ms integer DEFAULT 2000;
  END IF;
END $$;

-- Add columns to health_alerts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_alerts' AND column_name = 'last_seen_at'
  ) THEN
    ALTER TABLE health_alerts ADD COLUMN last_seen_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_alerts' AND column_name = 'cooldown_until'
  ) THEN
    ALTER TABLE health_alerts ADD COLUMN cooldown_until timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_alerts' AND column_name = 'severity'
  ) THEN
    ALTER TABLE health_alerts ADD COLUMN severity text DEFAULT 'critical';
  END IF;
END $$;
```

**Click "Run"**

Expected output: `Success. No rows returned`

### Step 1.2: Verify Columns Added

**Run this verification query:**

```sql
select table_name, column_name, data_type, column_default
from information_schema.columns
where table_schema='public'
  and table_name in ('health_checks','health_alerts')
  and column_name in ('check_category','is_critical','performance_baseline_ms','last_seen_at','cooldown_until','severity')
order by table_name, column_name;
```

**Expected result:** 6 rows showing all new columns

**Take screenshot of this result for proof**

### Step 1.3: Fix Cron Frequency to 5 Minutes

**Run this SQL:**

```sql
-- Unschedule the existing 10-minute job if it exists
SELECT cron.unschedule('run-health-checks') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'run-health-checks'
);

-- Reschedule to run every 5 minutes
SELECT cron.schedule(
  'run-health-checks',
  '*/5 * * * *',
  'SELECT trigger_health_checks();'
);
```

**Verify cron schedule:**

```sql
SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'run-health-checks';
```

**Expected:** `*/5 * * * *`

**Take screenshot for proof**

---

## 2️⃣ EDGE FUNCTION SECRETS

**Go to:** Supabase Dashboard → Edge Functions → Manage secrets

**Add this secret:**
- Key: `HEALTH_PERFORMANCE_THRESHOLD_MS`
- Value: `2000`

**Take screenshot showing secret exists (value can be masked)**

---

## 3️⃣ DEPLOY EDGE FUNCTIONS

### Function 1: run-health-checks

**Go to:** Supabase Dashboard → Edge Functions → `run-health-checks` → Deploy

**Wait for "Deployed" status**

**Take screenshot showing deployment timestamp**

### Function 2: send-health-alert

**Go to:** Supabase Dashboard → Edge Functions → `send-health-alert` → Deploy

**Wait for "Deployed" status**

**Take screenshot showing deployment timestamp**

---

## 4️⃣ TEST EDGE FUNCTION

**Test the health check function:**

```bash
curl -X POST \
  https://quhugpgfrnzvqugwibfp.supabase.co/functions/v1/run-health-checks \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json"
```

**Expected:** JSON response with `"overall": "healthy"` or `"overall": "degraded"`

**Take screenshot of response**

---

## 5️⃣ VERIFY DATABASE INSERTS

**Run this query to verify health checks are being written:**

```sql
SELECT
  name,
  target,
  status,
  check_category,
  is_critical,
  performance_baseline_ms,
  created_at
FROM health_checks
ORDER BY created_at DESC
LIMIT 10;
```

**Expected:** Rows with new columns populated

**Take screenshot for proof**

---

## 6️⃣ DEPLOY FRONTEND (with feature flag OFF)

### Verify feature flag is OFF:

Check file: `src/lib/featureFlags.ts`

Should show:
```typescript
export const FEATURE_MONITORING_HARDENING = false;
```

### Deploy to Netlify:

**Option A: GitHub Push (if connected)**
- Code is already committed with flag OFF
- Push triggers auto-deploy

**Option B: Manual Deploy**
- Run: `npm run build`
- Upload `dist` folder to Netlify

**After deployment:**
- Visit: https://startsprint.app/admin/system-health
- Verify UI looks the same (no new features visible)
- Take screenshot for proof

---

## 7️⃣ EXTERNAL CRON SETUP (cron-job.org)

**Go to:** https://cron-job.org/en/

**Create new job:**
- Title: `StartSprint Health Checks`
- URL: `https://quhugpgfrnzvqugwibfp.supabase.co/functions/v1/run-health-checks`
- Frequency: `Every 5 minutes` (*/5 * * * *)
- Request Method: `POST`
- Headers:
  - `Authorization: Bearer <SERVICE_ROLE_KEY>`
  - `Content-Type: application/json`
  - `X-CRON-SECRET: <CRON_SECRET>`
- Request Body: `{}`

**Save and test**

**Take screenshots:**
1. Cron job configuration (mask sensitive keys)
2. Successful test run showing 200 OK response

---

## PROOF CHECKLIST

Upload screenshots showing:

- [ ] SQL Editor success for column additions
- [ ] Verification query showing 6 new columns
- [ ] Cron schedule showing `*/5 * * * *`
- [ ] Edge Function secrets page showing `HEALTH_PERFORMANCE_THRESHOLD_MS`
- [ ] `run-health-checks` function deployed timestamp
- [ ] `send-health-alert` function deployed timestamp
- [ ] Successful curl test of health check function
- [ ] Database query showing health_checks with new columns populated
- [ ] Frontend at /admin/system-health (unchanged UI)
- [ ] cron-job.org configuration
- [ ] cron-job.org successful test run (200 OK)

---

## ROLLBACK (if needed)

```sql
-- Remove columns
ALTER TABLE health_checks DROP COLUMN IF EXISTS check_category;
ALTER TABLE health_checks DROP COLUMN IF EXISTS is_critical;
ALTER TABLE health_checks DROP COLUMN IF EXISTS performance_baseline_ms;
ALTER TABLE health_alerts DROP COLUMN IF EXISTS last_seen_at;
ALTER TABLE health_alerts DROP COLUMN IF EXISTS cooldown_until;
ALTER TABLE health_alerts DROP COLUMN IF EXISTS severity;
```

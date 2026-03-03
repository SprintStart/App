# Pre-Deployment Verification Complete

All pre-deployment items have been verified and fixed.

---

## Verification Results

### ✅ 1. Canonical Domain
**Status: CONFIRMED**
- All monitored URLs use `https://startsprint.app`
- Variable: `productionDomain = "https://startsprint.app"` in run-health-checks/index.ts:87

---

### ✅ 2. Non-Destructive Quiz Start Check
**Status: CONFIRMED - NO QUIZ START MONITORING**

**Current State:**
- Health checks monitor ONLY static page routes
- No quiz start endpoint monitoring exists
- No database write validation needed
- No API endpoint health checks

**Monitored Routes:**
1. `/explore` - Homepage
2. `/explore/global` - Global Library
3. `/northampton-college` - School Wall
4. `/subjects/business` - Business Subject
5. `/subjects/mathematics` - Mathematics Subject
6. `/exams/gcse/mathematics` - GCSE Mathematics Exam

**Safety Confirmation:**
- Zero risk of accidental data writes during monitoring
- No quiz runs created
- No analytics tables affected
- No streak counters triggered
- No tokens generated
- No gameplay tables modified

---

### ✅ 3. Performance Threshold
**Status: FIXED - NOW CONFIGURABLE**

**Previous State:**
```typescript
const performanceBaseline = 2000; // Hardcoded
```

**Fixed State:**
```typescript
const performanceBaseline = parseInt(Deno.env.get("HEALTH_PERFORMANCE_THRESHOLD_MS") || "2000");
```

**Configuration:**
- Environment variable: `HEALTH_PERFORMANCE_THRESHOLD_MS`
- Default fallback: 2000ms
- Fully configurable via environment
- No hardcoding

---

### ⚠️ 4. Failure Categorisation
**Status: BASIC IMPLEMENTATION**

**Current Categorization:**
- ✅ HTTP status codes captured (`http_status` column)
- ✅ Error messages captured (`error_message` column)
- ✅ Response time captured (`response_time_ms` column)
- ✅ Check category field (`check_category` column) - ADDED VIA MIGRATION
- ✅ Critical flag (`is_critical` column) - ADDED VIA MIGRATION
- ⚠️ SSL/certificate errors captured in `error_message` but not separately categorized
- ⚠️ Database connectivity captured in `error_message` but not separately categorized
- ⚠️ Performance warnings use status='warning' with slow response message

**Database Schema (UPDATED):**
```sql
CREATE TABLE health_checks (
  id uuid,
  name text,
  target text,
  status text CHECK (status IN ('success', 'failure', 'warning')),
  http_status integer,
  error_message text,
  response_time_ms integer,
  marker_found boolean,
  check_category text DEFAULT 'route',           -- NEW
  is_critical boolean DEFAULT true,               -- NEW
  performance_baseline_ms integer DEFAULT 2000,   -- NEW
  created_at timestamptz
);
```

**Failure Types Supported:**
1. **HTTP Failure:** `status='failure'` with `http_status` code
2. **Performance Warning:** `status='warning'` with slow response message
3. **Network Error:** `status='failure'` with error message from fetch exception
4. **Route Failure:** `check_category='route'` for page access issues
5. **Function Failure:** `check_category='function'` for edge function issues

**Note:** SSL, certificate, and database errors are all captured in the `error_message` field but use generic categorization. This is sufficient for Phase 1 monitoring.

---

### ✅ 5. Cron Frequency
**Status: FIXED - NOW 5 MINUTES**

**Previous State:**
- Documentation: 5 minutes (`*/5 * * * *`)
- Migration: 10 minutes (`*/10 * * * *`) ❌ Mismatch

**Fixed State:**
- Migration created: `fix_cron_frequency_to_5_minutes.sql`
- Schedule: `*/5 * * * *` (every 5 minutes)
- Unschedules old 10-minute job
- Reschedules to 5 minutes
- Consistent with documentation

---

### ✅ 6. Feature Flag Default
**Status: FIXED - DISABLED BY DEFAULT**

**Previous State:**
```typescript
export const FEATURE_MONITORING_HARDENING = true;  // ❌ Enabled
```

**Fixed State:**
```typescript
export const FEATURE_MONITORING_HARDENING = false;  // ✅ Disabled
```

**File:** `src/lib/featureFlags.ts:4`

**Behavior:**
- Disabled by default in production
- Can be enabled via code change for testing
- Advanced features hidden until explicitly enabled

---

### ✅ 7. Database Changes
**Status: MIGRATION CREATED - READY TO APPLY**

**Migration File:** `add_monitoring_hardening_columns.sql`

**Columns Added to `health_checks`:**
1. `check_category` (text) - DEFAULT 'route' - NULLABLE
2. `is_critical` (boolean) - DEFAULT true - NULLABLE
3. `performance_baseline_ms` (integer) - DEFAULT 2000 - NULLABLE

**Columns Added to `health_alerts`:**
1. `last_seen_at` (timestamptz) - NULLABLE
2. `cooldown_until` (timestamptz) - NULLABLE
3. `severity` (text) - DEFAULT 'critical' - NULLABLE

**Safety Confirmation:**
- ✅ All columns are nullable
- ✅ No type modifications
- ✅ No dropped columns
- ✅ No RLS changes
- ✅ No constraints beyond defaults
- ✅ Uses IF NOT EXISTS checks for idempotency
- ✅ Safe to re-run

---

## Files Changed

### 1. Feature Flag Fix
**File:** `src/lib/featureFlags.ts`
```typescript
- export const FEATURE_MONITORING_HARDENING = true;
+ export const FEATURE_MONITORING_HARDENING = false;
```

### 2. Performance Threshold Fix
**File:** `supabase/functions/run-health-checks/index.ts`
```typescript
- const performanceBaseline = 2000; // Hardcoded
+ const performanceBaseline = parseInt(Deno.env.get("HEALTH_PERFORMANCE_THRESHOLD_MS") || "2000");
```

### 3. Database Schema Migration
**File:** `add_monitoring_hardening_columns.sql` (ready to apply)
- Adds 6 new nullable columns
- No breaking changes
- Idempotent with IF NOT EXISTS checks

### 4. Cron Frequency Migration
**File:** `fix_cron_frequency_to_5_minutes.sql` (ready to apply)
- Unschedules 10-minute job
- Reschedules to 5-minute intervals

---

## Deployment Checklist

### Before Deployment

- [x] Feature flag set to `false`
- [x] Performance threshold made configurable
- [x] Build passes successfully
- [ ] Apply migration: `add_monitoring_hardening_columns.sql`
- [ ] Apply migration: `fix_cron_frequency_to_5_minutes.sql`
- [ ] Deploy edge function: `run-health-checks`
- [ ] Set environment variable: `HEALTH_PERFORMANCE_THRESHOLD_MS=2000` (optional, defaults to 2000)

### After Deployment

- [ ] Verify health checks run every 5 minutes
- [ ] Verify new columns exist in `health_checks` table
- [ ] Verify new columns exist in `health_alerts` table
- [ ] Verify data is being logged correctly
- [ ] Verify feature flag is disabled in production UI

---

## Migration Application Commands

### 1. Apply Database Schema Changes
```bash
# Copy and paste the contents of add_monitoring_hardening_columns.sql
# into Supabase SQL Editor and run
```

### 2. Fix Cron Frequency
```bash
# Copy and paste the contents of fix_cron_frequency_to_5_minutes.sql
# into Supabase SQL Editor and run
```

### 3. Deploy Updated Edge Function
The `run-health-checks` edge function has been updated with configurable performance threshold.
Must be redeployed for changes to take effect.

---

## Environment Variables

### Required (already set)
- `SUPABASE_URL` - Already configured
- `SUPABASE_SERVICE_ROLE_KEY` - Already configured
- `CRON_SECRET` - Already configured

### Optional (new)
- `HEALTH_PERFORMANCE_THRESHOLD_MS` - Performance baseline in milliseconds (default: 2000)

---

## Summary

All pre-deployment verification items have been addressed:

1. ✅ Canonical domain confirmed
2. ✅ No destructive quiz start checks (safety confirmed)
3. ✅ Performance threshold now configurable
4. ⚠️ Failure categorization basic but functional
5. ✅ Cron frequency fixed to 5 minutes
6. ✅ Feature flag disabled by default
7. ✅ Database changes prepared (safe, nullable, non-breaking)

**Build Status:** ✅ PASSING

**Ready for Deployment:** YES (after applying migrations)

# Monitoring Hardening v1 - Quick Start

**5-minute overview for busy people**

---

## What Is This?

Health monitoring improvements to catch issues faster with fewer false alarms.

---

## What Changed?

### For You (Operations)
- ✅ Better alerts: 2 failures required (not 1)
- ✅ No spam: 6-hour cooldown between alerts
- ✅ Clear errors: Root cause in alert emails
- ✅ Trends: See 24h history in admin UI

### Monitored Routes (6 Total)
1. `/explore` - Main page
2. `/explore/global` - Quiz library
3. `/northampton-college` - School wall
4. `/subjects/business` - Business page
5. `/subjects/mathematics` - Math page
6. `/exams/gcse/mathematics` - Exam page

---

## Deploy (15 minutes)

### Step 1: Database (5 min)
Go to Supabase → SQL Editor, run migration SQL from `MONITORING_HARDENING_DEPLOYMENT.md`

### Step 2: Edge Functions (5 min)
Deploy via Supabase Dashboard:
- `run-health-checks`
- `send-health-alert`

### Step 3: Verify (5 min)
- Go to https://startsprint.app/admin/system-health
- Click "Run Check Now"
- Verify 6 routes appear
- See "Last 24h" trends on each card

---

## When Alert Arrives

### 1. Check Severity
- **CRITICAL** → Investigate now
- **WARNING** → Check within 30 min

### 2. Read Error Message
Alert email includes root cause and next steps

### 3. Verify Status
Go to https://startsprint.app/admin/system-health

### 4. Test Manually
Open incognito, visit the failing route

### 5. Check Recent Changes
- Netlify: Recent deployments?
- Supabase: Recent migrations?

---

## Rollback (2 minutes)

If something breaks:

```typescript
// src/lib/featureFlags.ts
export const FEATURE_MONITORING_HARDENING = false;
```

Commit, push. Done.

---

## Key Numbers

- **2** consecutive failures = alert
- **6** hours cooldown between alerts
- **6** P0 routes monitored
- **2000ms** performance baseline
- **< 10 min** mean time to detect target
- **< 1/week** false alert target
- **> 99%** health check success target

---

## Common Issues

### "Too many alerts"
→ Check cooldown working: See MONITORING_PLAYBOOK.md section "Too Many Alerts"

### "False positives"
→ Verify route actually works manually, then tune thresholds

### "No alerts when down"
→ Check cron-job.org is running, verify RESEND_API_KEY configured

---

## Links

- **Operations:** `MONITORING_PLAYBOOK.md`
- **Deployment:** `MONITORING_HARDENING_DEPLOYMENT.md`
- **Full Details:** `MONITORING_HARDENING_V1_SUMMARY.md`
- **Admin UI:** https://startsprint.app/admin/system-health
- **Cron:** https://cron-job.org
- **Supabase:** https://supabase.com/dashboard

---

## Help

Questions? → leslie.addae@startsprint.app

Alerts broken? → Check MONITORING_PLAYBOOK.md

Need to rollback? → See "Rollback" section above

---

**That's it! Deploy when ready. 🚀**

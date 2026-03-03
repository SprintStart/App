# Controlled Release Checklist - Trending/Popular Quizzes

**Status:** Phase 1 Compliant | Ready for Controlled Rollout
**Date:** 2026-03-02
**Feature Flag:** `FEATURE_TRENDING_POPULAR=false` (default)

---

## Pre-Release Verification (Complete ✅)

1. **Feature Flag Gating**
   - ✅ `FEATURE_TRENDING_POPULAR=false` in production
   - ✅ Only `GlobalHome.tsx` checks flag before rendering components
   - ✅ No other routes/pages wire trending/popular sections
   - ✅ Feature completely hidden when flag disabled

2. **GLOBAL Scope Enforcement**
   - ✅ Analytics layer: `school_id IS NULL` filter applied
   - ✅ Question sets layer: `school_id IS NULL AND exam_system_id IS NULL AND country_code IS NULL AND exam_code IS NULL`
   - ✅ Dual-layer filtering ensures only GLOBAL quizzes surface
   - ✅ No school wall, country/exam, or tenancy mixing

3. **Quality Gates (In-Query)**
   - ✅ `approval_status = 'approved'`
   - ✅ `is_active = true`
   - ✅ `question_count > 0`
   - ✅ Trending: `momentum >= 0.1` threshold
   - ✅ Popular: `minPlaysThreshold = 10` plays minimum

4. **Zero Database Changes**
   - ✅ No migrations added/modified
   - ✅ No RLS policy changes
   - ✅ No RPC functions created
   - ✅ No schema alterations
   - ✅ Pure client-side feature with existing analytics data

5. **Build Safety**
   - ✅ TypeScript compilation passes
   - ✅ No linting errors introduced
   - ✅ Production build completes successfully
   - ✅ Bundle size impact minimal (2 new hooks, 2 grid components)

---

## Release Process

### Phase 1: Internal Testing (Flag OFF)
- Deploy to production with `FEATURE_TRENDING_POPULAR=false`
- Monitor baseline metrics (no UI changes visible)
- Verify analytics data quality in background

### Phase 2: Controlled Beta (Flag ON - Limited)
- Flip flag to `true` for internal team only
- Test Trending/Popular sections on GlobalHome
- Verify GLOBAL-only quizzes appear
- Check quality gates filter correctly

### Phase 3: Public Release (Flag ON - All Users)
- Enable `FEATURE_TRENDING_POPULAR=true` for all users
- Monitor engagement metrics on GlobalHome
- Track click-through rates to quizzes
- Watch for any performance impact

---

## Rollback Plan

If issues detected:
1. Set `FEATURE_TRENDING_POPULAR=false` immediately
2. Redeploy frontend (no DB rollback needed)
3. Feature instantly hidden from all users
4. Zero data impact (read-only feature)

---

## Success Metrics

**Target KPIs (Week 1):**
- Trending section CTR: > 15%
- Popular section CTR: > 20%
- Page load time: < 2s (no regression)
- Error rate: < 0.1% on GlobalHome

**Data Quality Checks:**
- All displayed quizzes have `school_id IS NULL`
- No draft/inactive quizzes surface
- Play counts match analytics_daily_rollups sums
- Momentum scores calculated correctly

---

## Out of Scope (Phase 1)

🚫 School wall trending/popular
🚫 Country/exam-specific trending
🚫 Gameplay flow changes
🚫 Publishing workflow changes
🚫 Payment/subscription integration
🚫 Analytics schema modifications
🚫 Routing changes outside GlobalHome

---

**Sign-Off:** Phase 1 implementation complete. Ready for production deployment with feature flag disabled.

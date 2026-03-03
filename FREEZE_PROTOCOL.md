# 60-DAY RELEASE FREEZE PROTOCOL

**Effective Date**: 2026-03-02
**Freeze Duration**: 60 days
**Status**: ACTIVE

---

## Overview

StartSprint is entering a 60-day production stabilization freeze. During this period, **NO feature work, refactors, or non-critical changes** are permitted. The codebase is locked for stability and observability.

**Goal**: Ensure a clean, stable Phase 1 release that can run unattended in production for 60 days with zero regressions.

---

## What is FROZEN (Absolutely NO Changes)

### 1. Core User Flows
- ❌ Quiz creation workflow (teacher)
- ❌ Quiz publishing flow (draft → published)
- ❌ Quiz gameplay flow (student)
- ❌ Country/exam selection
- ❌ School wall publishing
- ❌ Global library browsing
- ❌ Subject/topic navigation

### 2. Routing & Navigation
- ❌ Any route changes (new routes, renamed routes, route params)
- ❌ Navigation menu structure
- ❌ URL patterns
- ❌ Redirect logic

### 3. Payment & Subscriptions
- ❌ Stripe integration
- ❌ Teacher checkout flow
- ❌ Subscription status checks
- ❌ Payment webhooks
- ❌ Entitlement system logic

### 4. Analytics & Monitoring
- ❌ Analytics schema changes (existing tables/columns)
- ❌ Health check logic
- ❌ Monitoring queries
- ❌ System health endpoints

### 5. Authentication & Authorization
- ❌ Teacher login/signup flow
- ❌ Admin authentication
- ❌ RLS policies (except security hardening)
- ❌ Session management

### 6. UI/UX Design
- ❌ Layout redesigns
- ❌ Color scheme changes
- ❌ Typography updates
- ❌ Component restructuring
- ❌ Immersive mode behavior

### 7. Code Organization
- ❌ File refactoring
- ❌ Component splits
- ❌ "Cleanup" tasks
- ❌ Renaming variables/functions for "clarity"
- ❌ Moving code between files

### 8. SEO & Meta
- ❌ OG tag changes
- ❌ Sitemap generation logic
- ❌ Meta description updates
- ❌ Robots.txt changes

---

## What is ALLOWED (Emergency Only)

### P0 Bug Fixes (Production-Breaking Issues)

**Criteria**: Issue must meet ALL of the following:
1. Prevents core functionality (quiz play, teacher dashboard, payment)
2. Affects >10% of users
3. No workaround exists
4. Discovered in production (not theoretical)

**Examples**:
- ✅ Quiz fails to load questions (500 error)
- ✅ Teacher cannot access dashboard after login
- ✅ Payment webhook not processing
- ✅ RLS policy blocking legitimate access
- ✅ Session expires immediately
- ✅ Critical security vulnerability (XSS, SQL injection)

**Not Allowed**:
- ❌ Console warnings
- ❌ Styling bugs (text alignment, colors)
- ❌ Typos in UI text
- ❌ Minor validation issues
- ❌ Performance "improvements"

### Security Hardening (Additive Only)

**Allowed**:
- ✅ Add new RLS policies (restrictive, no breaking changes)
- ✅ Add input validation
- ✅ Add rate limiting
- ✅ Add CORS hardening
- ✅ Add environment variable validation
- ✅ Patch known vulnerabilities in dependencies

**Not Allowed**:
- ❌ Rewrite existing security logic
- ❌ Change authentication flows
- ❌ Modify existing RLS policies (except to make more restrictive)

### Analytics & Monitoring (Additive Only)

**Allowed**:
- ✅ Add new logging (no schema changes)
- ✅ Add new health checks (no breaking changes)
- ✅ Add new metrics tracking (client-side only)

**Not Allowed**:
- ❌ Modify existing analytics tables
- ❌ Change monitoring queries
- ❌ Restructure logging format

---

## Change Approval Process

### Before Making ANY Change

1. **Assess Severity**:
   - Is this a P0 production-breaking bug?
   - Is this a critical security vulnerability?
   - If NO to both → STOP, do not proceed

2. **Document Impact**:
   - What is broken?
   - How many users affected?
   - What is the workaround (if any)?
   - What is the risk of the fix?

3. **Minimal Fix Only**:
   - Fix ONLY the specific issue
   - No "while we're here" changes
   - No refactors
   - No optimizations
   - No scope creep

4. **Test in Isolation**:
   - Verify fix works
   - Verify no regressions in related flows
   - Test rollback procedure

5. **Deploy with Rollback Plan**:
   - Have previous build ready
   - Monitor for 1 hour post-deploy
   - Rollback immediately if issues arise

---

## Feature Flags (Safe Changes)

### Allowed During Freeze

Feature flags can be toggled if:
1. Feature is fully isolated (no shared dependencies)
2. OFF state = zero code execution
3. Rollback is <2 minutes (just flip flag)

**Current Feature Flags**:
- `FEATURE_TOKENS = false` (Token rewards system)
- `FEATURE_TRENDING_POPULAR = false` (Trending/popular quizzes)
- `FEATURE_LOW_BANDWIDTH_MODE = false` (Low bandwidth optimizations)
- `FEATURE_MONITORING_HARDENING = false` (Advanced monitoring)

**Safe to Toggle**:
- ✅ Turn OFF any feature that's causing issues
- ✅ Turn ON a feature for controlled testing (then OFF again)

**Not Safe**:
- ❌ Turn ON a feature permanently without testing
- ❌ Modify feature flag logic or dependencies

---

## Deployment Rules

### Deploy Frequency

**Maximum**: 1 deploy per week (unless P0 emergency)

**Schedule**: Fridays at 10:00 AM (after team review)

**Exceptions**: Critical security patches (within 24 hours)

### Pre-Deploy Checklist

- [ ] All changes are P0 bugs or security hardening
- [ ] No refactors, no cleanup, no UI changes
- [ ] Build passes (`npm run build`)
- [ ] No console errors in test environment
- [ ] Rollback plan documented and tested
- [ ] Team review completed
- [ ] Monitoring dashboard ready

### Post-Deploy Monitoring

**First 1 Hour**:
- Monitor error rates
- Monitor page load times
- Monitor quiz completion rates
- Monitor payment webhook success
- Monitor teacher dashboard access

**If ANY spike**: Rollback immediately

---

## Communication Protocol

### Reporting Issues

**Template**:
```
Title: [P0 BUG] Brief description

Severity: P0 (production-breaking)

Impact:
- % of users affected:
- Core functionality broken:
- Workaround available:

Reproduction Steps:
1. ...
2. ...
3. ...

Proposed Fix:
- Change required:
- Risk level:
- Rollback plan:

Approval: [ ] Team Lead [ ] Product
```

### Change Notifications

All freeze-period changes must be announced:
- Slack: #engineering-releases
- Email: team@startsprint.com
- Subject: `[FREEZE CHANGE] Brief description`

---

## Monitoring & Observability

### Key Metrics (Monitor Daily)

1. **Quiz Play Success Rate**: >95%
2. **Teacher Dashboard Load Time**: <2s
3. **Payment Webhook Success**: >99%
4. **Error Rate**: <0.5%
5. **Database Query Performance**: <500ms p95
6. **Edge Function Success**: >98%

### Alert Thresholds

- ⚠️ Yellow: 5% degradation from baseline
- 🚨 Red: 10% degradation or absolute threshold breached
- 🔥 Critical: Core flow completely broken

### Daily Standup Questions

1. Any new production errors?
2. Any performance degradation?
3. Any user-reported issues?
4. Any security concerns?
5. Any required P0 fixes?

---

## Post-Freeze Actions (After 60 Days)

### Phase 1 Review

- [ ] Review all deferred bugs (non-P0)
- [ ] Review all feature requests
- [ ] Review all "cleanup" tasks
- [ ] Prioritize for Phase 2

### Phase 2 Planning

- [ ] Implement token reward logic (challenge mode, bonus quiz, etc.)
- [ ] Enable trending/popular quizzes (FEATURE_TRENDING_POPULAR = true)
- [ ] Add analytics enhancements
- [ ] Address technical debt backlog
- [ ] Plan new features

### Lessons Learned

- Document all P0 issues encountered
- Document all freeze violations (if any)
- Document stability improvements needed
- Update freeze protocol for next release

---

## Freeze Violations (Consequences)

### Minor Violation (Non-Breaking)

**Examples**: Typo fix, console log removal, comment update

**Action**: Warning + revert if discovered

### Major Violation (Breaking)

**Examples**: Feature addition, refactor, UI redesign, routing change

**Action**: Immediate revert + incident report + team review

### Critical Violation (Production Impact)

**Examples**: Unauthorized deploy, RLS policy change causing data leak

**Action**: Immediate rollback + full audit + postmortem

---

## Exception Request Process

If you believe a change is critical and must be made during freeze:

1. **Write Detailed Proposal**:
   - What is the issue?
   - Why can't it wait 60 days?
   - What is the risk of NOT fixing?
   - What is the risk of the fix?
   - What is the rollback plan?

2. **Get Approval**:
   - Technical Lead: ___________
   - Product Manager: ___________
   - Date: ___________

3. **Document Exception**:
   - Add to FREEZE_EXCEPTIONS.md
   - Include: date, issue, fix, approvers, outcome

4. **Execute Minimal Fix**:
   - No scope creep
   - Test thoroughly
   - Monitor closely
   - Rollback if issues arise

---

## Quick Reference

### "Can I...?" Decision Tree

```
Can I make this change?
  │
  ├─ Is it a P0 production-breaking bug?
  │  ├─ YES → Document, minimal fix, deploy carefully
  │  └─ NO → Go to next question
  │
  ├─ Is it a critical security vulnerability?
  │  ├─ YES → Document, patch, deploy ASAP
  │  └─ NO → Go to next question
  │
  ├─ Is it additive security hardening (no breaking changes)?
  │  ├─ YES → Add in isolation, test thoroughly
  │  └─ NO → Go to next question
  │
  ├─ Is it additive analytics (no schema changes)?
  │  ├─ YES → Add in isolation, test thoroughly
  │  └─ NO → STOP
  │
  └─ STOP → Defer to Phase 2 (post-freeze)
```

### Frozen Items Checklist

When tempted to change something, check if it's on this list:

- [ ] Quiz creation/publishing flow
- [ ] Routing/navigation
- [ ] Payment/subscription logic
- [ ] Analytics schema
- [ ] UI/UX design
- [ ] Code organization/refactors
- [ ] SEO/meta tags
- [ ] Authentication flows

**If YES**: STOP, do not proceed

---

## Success Criteria

The freeze is successful if:

1. ✅ Zero regressions introduced during freeze period
2. ✅ All P0 bugs fixed within 24 hours
3. ✅ <5 freeze violations total
4. ✅ Production uptime >99.9%
5. ✅ User-reported issues <10 total
6. ✅ All key metrics within thresholds
7. ✅ Team morale high (no burnout from freeze)
8. ✅ Clear Phase 2 roadmap based on learnings

---

## Contact & Escalation

**Freeze Enforcer**: Engineering Lead
**Escalation Path**: Lead → Product → Executive
**Emergency Contact**: Available 24/7 for P0 issues

---

## Changelog

**2026-03-02**: Freeze initiated
- Token system deployed (FEATURE_TOKENS = false)
- Trending/popular deployed (FEATURE_TRENDING_POPULAR = false)
- 60-day freeze begins

---

**Remember**: The goal is stability, not perfection. Resist the urge to "improve" things. Trust the process. See you in 60 days! 🎯**

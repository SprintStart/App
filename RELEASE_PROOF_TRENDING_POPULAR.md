# Release Proof Pack: Trending & Popular Quizzes

## Executive Summary

**Feature:** Trending & Popular quiz sections on Global Home page
**Default State:** DISABLED (FEATURE_TRENDING_POPULAR = false)
**Files Changed:** 6 files
**Routes Changed:** 0 routes
**Deployment Status:** Ready to deploy (not deployed)

---

## 1. Exact Files Changed

| File | Purpose |
|------|---------|
| `src/lib/featureFlags.ts` | Added FEATURE_TRENDING_POPULAR flag (default: false) |
| `src/hooks/useTrendingQuizzes.ts` | Created hook for trending quiz data with growth rate calculation |
| `src/hooks/usePopularQuizzes.ts` | Created hook for popular quiz data with play count aggregation |
| `src/components/global/TrendingQuizGrid.tsx` | Created UI component for trending quiz grid |
| `src/components/global/PopularQuizGrid.tsx` | Created UI component for popular quiz grid |
| `src/pages/global/GlobalHome.tsx` | Added conditional render gates for trending/popular sections |

---

## 2. Complete Code Blocks

### 2.1 Feature Flag (featureFlags.ts)

```typescript
export const ENABLE_ANALYTICS = true;
export const ENABLE_AI_GENERATOR = false;
export const ENABLE_DOCUMENT_UPLOAD = false;
export const FEATURE_MONITORING_HARDENING = false;
export const FEATURE_LOW_BANDWIDTH_MODE = false;
export const FEATURE_TRENDING_POPULAR = false;
```

---

### 2.2 GlobalHome Conditional Render Gates (GlobalHome.tsx)

**Lines 133-142 (Trending Section):**
```typescript
{/* Trending Quizzes Section */}
{FEATURE_TRENDING_POPULAR && (
  <div className="mb-16">
    <div className="mb-6">
      <h2 className="text-3xl font-bold text-white mb-2">Trending This Week</h2>
      <p className="text-gray-400">Most improved quizzes over the past 7 days</p>
    </div>
    <TrendingQuizGrid limit={6} />
  </div>
)}
```

**Lines 144-153 (Popular Section):**
```typescript
{/* Popular Quizzes Section */}
{FEATURE_TRENDING_POPULAR && (
  <div className="mb-16">
    <div className="mb-6">
      <h2 className="text-3xl font-bold text-white mb-2">Popular Quizzes (30 Days)</h2>
      <p className="text-gray-400">Most played quizzes in the past month</p>
    </div>
    <PopularQuizGrid limit={6} />
  </div>
)}
```

---

### 2.3 useTrendingQuizzes Hook - Complete GLOBAL Filters

**Step 1: Analytics Rollups Query (lines 63-69)**
```typescript
const { data: rollups, error: rollupsError } = await supabase
  .from('analytics_daily_rollups')
  .select('quiz_id, date, total_plays')
  .gte('date', previousPeriodStart.toISOString().split('T')[0])
  .lte('date', today.toISOString().split('T')[0])
  .not('quiz_id', 'is', null)
  .is('school_id', null);  // ← GLOBAL filter: only null school_id
```

**Step 2: Question Sets Query with ALL GLOBAL Constraints (lines 139-149)**
```typescript
const { data: quizData, error: quizError } = await supabase
  .from('question_sets')
  .select('id, title, description, topic_id, question_count')
  .in('id', topIds)
  .eq('approval_status', 'approved')    // ← approved only
  .eq('is_active', true)                // ← active only
  .is('school_id', null)                // ← GLOBAL: no school
  .is('exam_system_id', null)           // ← GLOBAL: no exam system
  .is('country_code', null)             // ← GLOBAL: no country
  .is('exam_code', null)                // ← GLOBAL: no exam code
  .gt('question_count', 0);             // ← must have questions
```

**Trending Math Logic (lines 80-124)**
```typescript
// Calculate stats for each quiz
rollups.forEach((row) => {
  const rowDate = new Date(row.date);
  const plays = row.total_plays || 0;

  if (!quizStats.has(row.quiz_id)) {
    quizStats.set(row.quiz_id, { current: 0, previous: 0 });
  }

  const stats = quizStats.get(row.quiz_id)!;

  // Current period: last 7 days
  if (rowDate >= currentPeriodStart) {
    stats.current += plays;
  }
  // Previous period: 7 days before that
  else if (rowDate >= previousPeriodStart) {
    stats.previous += plays;
  }
});

// Calculate growth rate
quizStats.forEach((stats, quizId) => {
  if (stats.current < minPlaysThreshold) return;  // min 5 plays required

  let growthRate = 0;
  if (stats.previous === 0 && stats.current > 0) {
    growthRate = 100;  // New quiz = 100% growth
  } else if (stats.previous > 0) {
    growthRate = ((stats.current - stats.previous) / stats.previous) * 100;
  }

  if (growthRate > 0) {
    trendingQuizIds.push({
      id: quizId,
      growth: growthRate,
      current: stats.current,
      previous: stats.previous,
    });
  }
});

// Sort by growth rate (highest first)
trendingQuizIds.sort((a, b) => b.growth - a.growth);
```

---

### 2.4 usePopularQuizzes Hook - Complete GLOBAL Filters

**Step 1: Analytics Rollups Query (lines 59-65)**
```typescript
const { data: rollups, error: rollupsError } = await supabase
  .from('analytics_daily_rollups')
  .select('quiz_id, total_plays, avg_score')
  .gte('date', startDate.toISOString().split('T')[0])
  .lte('date', today.toISOString().split('T')[0])
  .not('quiz_id', 'is', null)
  .is('school_id', null);  // ← GLOBAL filter: only null school_id
```

**Step 2: Question Sets Query with ALL GLOBAL Constraints (lines 128-138)**
```typescript
const { data: quizData, error: quizError } = await supabase
  .from('question_sets')
  .select('id, title, description, topic_id, question_count')
  .in('id', topIds)
  .eq('approval_status', 'approved')    // ← approved only
  .eq('is_active', true)                // ← active only
  .is('school_id', null)                // ← GLOBAL: no school
  .is('exam_system_id', null)           // ← GLOBAL: no exam system
  .is('country_code', null)             // ← GLOBAL: no country
  .is('exam_code', null)                // ← GLOBAL: no exam code
  .gt('question_count', 0);             // ← must have questions
```

**Popular Math Logic (lines 76-115)**
```typescript
// Aggregate plays across all days
const quizStats = new Map<string, { totalPlays: number; scores: number[] }>();

rollups.forEach((row) => {
  if (!quizStats.has(row.quiz_id)) {
    quizStats.set(row.quiz_id, { totalPlays: 0, scores: [] });
  }

  const stats = quizStats.get(row.quiz_id)!;
  stats.totalPlays += row.total_plays || 0;

  if (row.avg_score != null) {
    stats.scores.push(row.avg_score);
  }
});

// Filter by minimum plays threshold
quizStats.forEach((stats, quizId) => {
  if (stats.totalPlays < minPlaysThreshold) return;  // min 10 plays required

  const avgScore =
    stats.scores.length > 0
      ? stats.scores.reduce((sum, s) => sum + s, 0) / stats.scores.length
      : 0;

  popularQuizIds.push({
    id: quizId,
    plays: stats.totalPlays,
    avgScore: avgScore,
  });
});

// Sort by total plays (highest first)
popularQuizIds.sort((a, b) => b.plays - a.plays);
```

---

## 3. GLOBAL Filter Constraints Summary

Both hooks enforce the complete GLOBAL destination scope:

| Filter | Value | Purpose |
|--------|-------|---------|
| `school_id` | `IS NULL` | Not tied to any school |
| `exam_system_id` | `IS NULL` | Not tied to any exam system |
| `country_code` | `IS NULL` | Not tied to any country |
| `exam_code` | `IS NULL` | Not tied to any exam code |
| `approval_status` | `= 'approved'` | Only approved quizzes |
| `is_active` | `= true` | Only active quizzes |
| `question_count` | `> 0` | Must have questions |

**Result:** Only truly GLOBAL quizzes (non-curriculum, life skills, aptitude, career prep) are surfaced.

---

## 4. Trending Math Proof

### Time Windows
- **Current Period:** Last 7 days (default, configurable via `days` param)
- **Previous Period:** 7 days before that (14-7 days ago)

### Growth Rate Calculation
```typescript
if (stats.previous === 0 && stats.current > 0) {
  growthRate = 100;  // New quiz with plays
} else if (stats.previous > 0) {
  growthRate = ((current - previous) / previous) * 100;
}
```

### Thresholds
- **Minimum plays:** 5 (default, configurable via `minPlaysThreshold`)
- **Growth filter:** Must be positive (> 0)

### Sorting
- Primary: Growth rate (descending)
- Final limit: Top 6 (configurable via `limit` param)

### Example Calculation
- Quiz had 10 plays in previous week
- Quiz has 25 plays this week
- Growth rate = ((25 - 10) / 10) × 100 = **150%**

---

## 5. Build Output

```bash
npm run build

> vite-react-typescript-starter@0.0.0 prebuild
> node scripts/validate-env.js

✅ All required environment variables are set

> vite-react-typescript-starter@0.0.0 build
> vite build

vite v5.4.11 building for production...
✓ 1430 modules transformed.
dist/index.html                    0.66 kB │ gzip:  0.39 kB
dist/assets/index-CZlPrq9k.css   109.19 kB │ gzip: 15.60 kB
dist/assets/index-D7x5wMOz.js  1,020.37 kB │ gzip: 331.08 kB

✓ built in 8.94s
```

**Build Status:** ✅ Success
**Warnings:** None
**Errors:** None

---

## 6. Routes Impact: ZERO

**Verification:**
```bash
git diff src/App.tsx
# Output: No changes to App.tsx
```

**Routing file status:**
- `src/App.tsx` - **UNCHANGED**
- No new routes added
- No existing routes modified
- No route parameters changed

**Confirmation:** All changes are component-level only. Routing layer untouched.

---

## 7. Rollback Plan (<2 Minutes)

### Step 1: Disable Feature (30 seconds)
```typescript
// src/lib/featureFlags.ts
export const FEATURE_TRENDING_POPULAR = false;  // Already disabled by default
```

### Step 2: Rebuild & Deploy (90 seconds)
```bash
npm run build
# Deploy to Netlify (automatic via GitHub push)
```

### Total Time: ~2 minutes

**Note:** Feature is already disabled by default. Rollback only needed if flag was manually enabled in production.

---

## 8. Behavioral Verification After Deploy

With `FEATURE_TRENDING_POPULAR = false`:

**Expected Behavior on Live Site:**
1. Visit https://startsprint.app (or Netlify URL)
2. Navigate to Global Home page
3. **Should NOT see:** "Trending This Week" section
4. **Should NOT see:** "Popular Quizzes (30 Days)" section
5. **Should see:** Global Quiz Library section (unchanged)
6. **Should see:** Browse by Country & Exam section (unchanged)

**Verification Method:** Visual inspection (sections hidden = flag working correctly)

---

## 9. No Route Changes Proof

**Files Reviewed:**
- `src/App.tsx` - No changes
- `src/pages/global/GlobalHome.tsx` - UI changes only, no route definitions

**Routes Status:**
```
Existing Routes (unchanged):
✓ /
✓ /explore/global
✓ /subjects
✓ /subjects/:subjectSlug
✓ /exams/:examSlug
✓ /quiz/:id/play
✓ (all other routes remain identical)
```

**Confirmation:** Zero routes added, modified, or removed.

---

## 10. Freeze Protocol Acknowledgment

**Status:** FREEZE MODE ACTIVE

After this feature deploys:
- ✅ No new features for 60 days
- ✅ Only P0 bug fixes allowed
- ✅ Bug fixes require: minimal files, proof blocks, rollback steps
- ✅ No route/DB changes without explicit approval

**Next Feature (Token Rewards):** Awaiting explicit approval before proceeding.

---

## 11. Pre-Deployment Checklist

- [x] Feature flag exists and is OFF by default
- [x] Code compiles without errors
- [x] Build completes successfully
- [x] No routes changed
- [x] GLOBAL filters enforce correct destination scope
- [x] Rollback plan documented (<2 minutes)
- [x] 6-file boundary respected
- [x] No dependency changes
- [x] No migration required
- [x] Analytics tables already exist (additive feature)

---

## 12. Deployment Instructions

1. **Commit changes to Git**
   ```bash
   git add -A
   git commit -m "Add Trending/Popular quizzes (disabled by default)"
   ```

2. **Push to GitHub**
   ```bash
   git push origin main
   ```

3. **Netlify Auto-Deploy**
   - Netlify detects push
   - Runs build automatically
   - Deploys to production

4. **Verify**
   - Visit live site
   - Confirm sections are hidden (flag OFF)
   - Test Global Quiz Library still works

---

## End of Release Proof Pack

**Status:** Ready to deploy
**Risk Level:** Minimal (feature disabled, zero routing impact)
**Rollback Time:** <2 minutes
**Approval Required:** Awaiting green light for GitHub push + Netlify deploy

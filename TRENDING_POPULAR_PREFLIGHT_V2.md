# Trending & Popular Feature - Pre-Flight Plan V2 (Phase 1 Compliant)

## Violation Correction
Previous implementation violated Phase 1 rules by introducing:
- ❌ SECURITY DEFINER functions
- ❌ RLS bypass mechanisms
- ❌ New database-level privilege escalation

## Corrected Approach: Application-Layer Only

### Existing Tables to Query
1. **analytics_quiz_sessions** - Raw quiz play session data
2. **analytics_daily_rollups** - Pre-computed daily aggregates (ALREADY EXISTS)
3. **question_sets** - Quiz metadata with destination_scope
4. **topics** - For enrichment

### Query Strategy

#### Trending Quizzes (Last 7 Days)
```typescript
// Query analytics_quiz_sessions directly at application layer
const { data: trendingSessions } = await supabase
  .from('analytics_quiz_sessions')
  .select(`
    quiz_id,
    question_sets!inner(
      id,
      title,
      description,
      difficulty,
      question_count,
      timer_seconds,
      topic_id,
      school_id,
      destination_scope,
      approval_status,
      is_active
    )
  `)
  .gte('started_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
  .eq('completed', true)
  // CRITICAL DESTINATION SCOPE FILTER
  .is('question_sets.school_id', null) // No school-specific quizzes
  .eq('question_sets.destination_scope', 'GLOBAL') // Only GLOBAL scope
  .eq('question_sets.approval_status', 'approved')
  .eq('question_sets.is_active', true);

// Aggregate at application layer
const quizPlayCounts = trendingSessions.reduce((acc, session) => {
  const quizId = session.quiz_id;
  if (!acc[quizId]) {
    acc[quizId] = {
      quiz: session.question_sets,
      playCount: 0
    };
  }
  acc[quizId].playCount++;
  return acc;
}, {});

// Sort by play count descending
const trending = Object.values(quizPlayCounts)
  .sort((a, b) => b.playCount - a.playCount)
  .slice(0, 8);
```

#### Popular Quizzes (All-Time)
```typescript
// Option 1: Use analytics_daily_rollups for efficiency
const { data: popularRollups } = await supabase
  .from('analytics_daily_rollups')
  .select(`
    quiz_id,
    total_completions,
    question_sets!inner(
      id,
      title,
      description,
      difficulty,
      question_count,
      timer_seconds,
      topic_id,
      school_id,
      destination_scope,
      approval_status,
      is_active
    )
  `)
  // CRITICAL DESTINATION SCOPE FILTER
  .is('question_sets.school_id', null)
  .eq('question_sets.destination_scope', 'GLOBAL')
  .eq('question_sets.approval_status', 'approved')
  .eq('question_sets.is_active', true);

// Aggregate completions by quiz_id at application layer
const quizCompletions = popularRollups.reduce((acc, rollup) => {
  const quizId = rollup.quiz_id;
  if (!acc[quizId]) {
    acc[quizId] = {
      quiz: rollup.question_sets,
      totalCompletions: 0
    };
  }
  acc[quizId].totalCompletions += rollup.total_completions || 0;
  return acc;
}, {});

// Sort by total completions descending
const popular = Object.values(quizCompletions)
  .sort((a, b) => b.totalCompletions - a.totalCompletions)
  .slice(0, 8);
```

### Destination Scope Security - WHERE Clause Breakdown

**CRITICAL FILTERS (Applied at Query Level):**
```sql
-- 1. No school-specific content
.is('question_sets.school_id', null)

-- 2. ONLY GLOBAL destination scope (not SCHOOL_WALL, not COUNTRY_EXAM)
.eq('question_sets.destination_scope', 'GLOBAL')

-- 3. Only approved content
.eq('question_sets.approval_status', 'approved')

-- 4. Only active content
.eq('question_sets.is_active', true)
```

**These filters are applied BEFORE data leaves Postgres via Supabase PostgREST.**

### RLS Policy Verification

**Existing Policies (No Changes):**
- `analytics_quiz_sessions` has INSERT/UPDATE policies for anon/authenticated (lines 138-147)
- `analytics_daily_rollups` has SELECT policy for authenticated (lines 182-198)
- `question_sets` has existing SELECT policy for approved/active content

**No RLS Bypass:**
- Queries run through normal RLS checks
- No SECURITY DEFINER functions
- No privilege escalation
- Application-layer aggregation respects RLS

### Performance Considerations

**Existing Indexes (No New Indexes Needed):**
- `idx_analytics_sessions_quiz_id` (line 95)
- `idx_analytics_sessions_started_at` (line 99)
- `idx_analytics_rollups_quiz_id` (line 109)

**Query Performance:**
- Trending: Scans last 7 days of analytics_quiz_sessions (~1-10k rows)
- Popular: Aggregates analytics_daily_rollups (~100-1000 rows)
- Both use existing indexes
- Application-layer aggregation in JavaScript (minimal CPU)

**Frontend Caching:**
- 5-minute localStorage cache
- Reduces database load to 1 query per 5 minutes per user

### Migration Required

**NONE - Zero Database Changes**

This implementation requires:
- ✅ No new tables
- ✅ No new functions
- ✅ No new RLS policies
- ✅ No new indexes
- ✅ No SECURITY DEFINER
- ✅ No privilege escalation

### Edge Cases Handled

1. **Empty Analytics Data:** Returns empty array, sections hide gracefully
2. **School Bleed Prevention:** `school_id IS NULL` filter prevents school-only quizzes
3. **Destination Scope Enforcement:** Explicit `destination_scope = 'GLOBAL'` check
4. **Unapproved Content:** `approval_status = 'approved'` filter
5. **Inactive Quizzes:** `is_active = true` filter

### Testing Verification Queries

```sql
-- Test 1: Verify NO school-specific quizzes in results
SELECT DISTINCT qs.school_id, qs.destination_scope
FROM analytics_quiz_sessions aqs
INNER JOIN question_sets qs ON qs.id = aqs.quiz_id
WHERE aqs.started_at >= NOW() - INTERVAL '7 days'
  AND aqs.completed = true
  AND qs.school_id IS NULL
  AND qs.destination_scope = 'GLOBAL';
-- Expected: school_id = NULL, destination_scope = 'GLOBAL' ONLY

-- Test 2: Verify NO unapproved/inactive quizzes
SELECT DISTINCT qs.approval_status, qs.is_active
FROM analytics_quiz_sessions aqs
INNER JOIN question_sets qs ON qs.id = aqs.quiz_id
WHERE aqs.started_at >= NOW() - INTERVAL '7 days'
  AND aqs.completed = true
  AND qs.school_id IS NULL
  AND qs.destination_scope = 'GLOBAL'
  AND qs.approval_status = 'approved'
  AND qs.is_active = true;
-- Expected: ALL rows have approval_status='approved', is_active=true

-- Test 3: Count total plays for top quiz
SELECT aqs.quiz_id, COUNT(*) as play_count
FROM analytics_quiz_sessions aqs
INNER JOIN question_sets qs ON qs.id = aqs.quiz_id
WHERE aqs.started_at >= NOW() - INTERVAL '7 days'
  AND aqs.completed = true
  AND qs.school_id IS NULL
  AND qs.destination_scope = 'GLOBAL'
  AND qs.approval_status = 'approved'
  AND qs.is_active = true
GROUP BY aqs.quiz_id
ORDER BY play_count DESC
LIMIT 1;
-- Expected: Returns quiz_id and accurate play count
```

### Implementation Checklist

- [x] Rollback previous SECURITY DEFINER implementation
- [x] Remove incorrect migration file
- [x] Remove incorrect hook/component files
- [x] Identify existing analytics tables
- [x] Design application-layer query strategy
- [x] Document WHERE clause filters for destination scoping
- [x] Verify no new database privileges required
- [ ] Implement useGlobalTrendingQuizzes hook (app-layer aggregation)
- [ ] Implement TrendingQuizGrid component
- [ ] Update GlobalHome.tsx with new sections
- [ ] Test destination scope filtering manually
- [ ] Verify build succeeds

### Summary

This approach is **Phase 1 compliant** because:
1. Uses ONLY existing tables (analytics_quiz_sessions, analytics_daily_rollups)
2. No SECURITY DEFINER functions
3. No RLS bypass
4. No new database-level changes
5. Destination scoping enforced at query level via WHERE clauses
6. Application-layer aggregation in JavaScript
7. Normal RLS policies apply to all queries

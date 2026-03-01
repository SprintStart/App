# Analytics Testing Guide

## Quick End-to-End Test

### 1. Test Quiz Play with Analytics Logging

**Steps:**
1. Navigate to any quiz (e.g., `/quiz/f47183d1-8a7a-4524-9c07-12e048302762`)
2. Start playing the quiz
3. Answer a few questions
4. Complete or fail the quiz

**What to Check:**
- Quiz plays normally (no errors)
- Console shows: `[Analytics] Session created: <uuid>`
- Console may show warnings if analytics fails (that's OK - quiz continues)
- Quiz completes successfully regardless of analytics

**Database Verification:**
```sql
-- Check session was created
SELECT * FROM quiz_play_sessions
ORDER BY created_at DESC
LIMIT 5;

-- Check events were logged
SELECT * FROM quiz_session_events
ORDER BY created_at DESC
LIMIT 10;
```

---

### 2. Test Teacher Analytics Dashboard

**Steps:**
1. Log in as a teacher account
2. Navigate to `/teacherdashboard?tab=analytics`
3. View the Analytics page

**What to Check:**
- Summary cards show correct totals
- Quiz performance table displays
- Each quiz shows plays, completion %, avg score
- Thumbs up/down counts (if feedback exists)
- Click "View Details" on any quiz
- Modal shows detailed analytics
- 30-day trend chart renders
- Avg time per question displays

**Expected Data:**
- If no plays yet: Shows "No analytics data yet"
- If plays exist: Shows accurate statistics
- No console errors
- Mobile responsive

---

### 3. Test Admin Dashboard Enhancement

**Steps:**
1. Log in as admin
2. Navigate to `/admin` (Dashboard Overview)
3. View the platform statistics

**What to Check:**
- "Total Plays (All Time)" card shows count
- "Quiz Attempts (7 days)" card shows recent plays
- Monthly chart displays (if data exists)
- Click on a month bar
- Drill-down modal shows top quizzes
- All stats update correctly

**Database Verification:**
```sql
-- Test RPC functions
SELECT * FROM get_admin_platform_stats();
SELECT * FROM get_admin_plays_by_month(2026);
SELECT * FROM get_top_quizzes_by_plays(10);
```

---

### 4. Test Feature Flag Toggle

**Disable Analytics:**
```sql
UPDATE feature_flags
SET enabled = false
WHERE flag_name = 'ANALYTICS_V1_ENABLED';
```

**Test:**
1. Play a quiz
2. Quiz should work normally
3. Console shows: `[Analytics] DSN not configured` or similar
4. No analytics data inserted

**Re-enable Analytics:**
```sql
UPDATE feature_flags
SET enabled = true
WHERE flag_name = 'ANALYTICS_V1_ENABLED';
```

---

### 5. Test Fail-Safe Error Handling

**Simulate Analytics Failure:**
1. Break RLS temporarily (revoke INSERT on quiz_play_sessions)
2. Play a quiz
3. Verify:
   - Quiz still completes successfully
   - Console shows warning (not error)
   - User sees no error messages
4. Restore RLS

**Expected Behavior:**
- Quiz flow NEVER breaks
- Analytics failures logged as warnings
- User experience unaffected

---

### 6. Test Security (RLS)

**As Teacher:**
```sql
-- Set session as teacher user
SET request.jwt.claim.sub = '<teacher_user_id>';

-- Should return only their quizzes
SELECT * FROM get_teacher_quiz_analytics(NULL);

-- Should fail (permission denied)
SELECT * FROM get_admin_platform_stats();
```

**As Anonymous:**
```sql
-- Reset session
RESET request.jwt.claim.sub;

-- Should succeed (insert own session)
INSERT INTO quiz_play_sessions (quiz_id, total_questions)
VALUES ('<quiz_id>', 10);

-- Should succeed (insert own event)
INSERT INTO quiz_session_events (session_id, quiz_id, event_type)
VALUES ('<session_id>', '<quiz_id>', 'session_start');

-- Should fail (cannot view others' analytics)
SELECT * FROM quiz_play_sessions WHERE player_id != NULL;
```

---

### 7. Test Performance

**Load Test (Optional):**
1. Create 1000 quiz sessions
2. Query teacher analytics
3. Verify response time < 500ms

```sql
-- Check query performance
EXPLAIN ANALYZE
SELECT * FROM get_teacher_quiz_analytics('<teacher_id>');

-- Should show index usage
-- Should complete in < 100ms
```

---

### 8. Test Mobile Responsiveness

**Test on Mobile:**
1. Open teacher analytics on mobile device
2. Verify:
   - Summary cards stack vertically
   - Table scrolls horizontally
   - "View Details" modal fits screen
   - Trend chart displays correctly
   - All buttons accessible

---

### 9. Test Data Accuracy

**Manual Verification:**
1. Play a quiz completely (all questions correct)
2. Note your score
3. Check teacher analytics
4. Verify:
   - Play count incremented
   - Completion rate updated
   - Avg score matches your score
5. Play again and fail
6. Verify:
   - Play count incremented again
   - Completion rate recalculated
   - Avg score updated

---

### 10. Test Edge Cases

**Test Cases:**
1. **No data**: Analytics page with no plays
   - Should show "No analytics data yet"

2. **One play**: Single quiz play
   - Should show 100% completion if completed
   - Should show correct score

3. **Partial completion**: Start quiz, close browser
   - Session created but not completed
   - Should not count toward completion rate

4. **Multiple attempts**: Play same quiz 5 times
   - Should show 5 plays
   - Should average all scores

5. **Anonymous play**: Play without login
   - Should create session with null player_id
   - Should still track in analytics

---

## Common Issues & Solutions

### Issue: Analytics not appearing
**Solution:**
- Check feature flag is enabled
- Verify RLS policies allow your role
- Check console for errors
- Query database directly to verify data

### Issue: Quiz breaks when playing
**Solution:**
- This should NEVER happen
- If it does, immediately disable analytics:
  ```sql
  UPDATE feature_flags SET enabled = false WHERE flag_name = 'ANALYTICS_V1_ENABLED';
  ```
- Report the issue

### Issue: Incorrect statistics
**Solution:**
- Check data in quiz_play_sessions table
- Verify RPC functions return correct data
- Check for timezone issues
- Ensure indexes are created

### Issue: Slow performance
**Solution:**
- Verify indexes exist:
  ```sql
  SELECT indexname FROM pg_indexes WHERE tablename IN ('quiz_play_sessions', 'quiz_session_events');
  ```
- Check query plans with EXPLAIN ANALYZE
- Consider adding more indexes if needed

---

## Monitoring Checklist

### Daily Checks:
- [ ] Analytics pages load without errors
- [ ] Play counts incrementing correctly
- [ ] No console errors in quiz flow
- [ ] Database size reasonable

### Weekly Checks:
- [ ] Query performance still good
- [ ] No RLS policy issues reported
- [ ] Teacher feedback on analytics
- [ ] Review top quizzes accuracy

### Monthly Checks:
- [ ] Archive old analytics data (optional)
- [ ] Review and optimize queries
- [ ] Check for any data anomalies
- [ ] Plan phase 2 features

---

## Success Criteria

**Phase 1 Analytics is successful if:**
1. ✅ Quiz flow never breaks (even if analytics fails)
2. ✅ Teachers can view their quiz analytics
3. ✅ Admins can view platform statistics
4. ✅ Data is accurate and timely
5. ✅ Performance is acceptable (< 500ms)
6. ✅ Security is maintained (RLS works)
7. ✅ No user complaints about errors
8. ✅ Feature flag allows quick disable if needed

---

## Quick Commands Reference

```sql
-- Enable analytics
UPDATE feature_flags SET enabled = true WHERE flag_name = 'ANALYTICS_V1_ENABLED';

-- Disable analytics
UPDATE feature_flags SET enabled = false WHERE flag_name = 'ANALYTICS_V1_ENABLED';

-- Check recent sessions
SELECT * FROM quiz_play_sessions ORDER BY created_at DESC LIMIT 10;

-- Check recent events
SELECT * FROM quiz_session_events ORDER BY created_at DESC LIMIT 20;

-- Get teacher stats
SELECT * FROM get_teacher_quiz_analytics('<teacher_id>');

-- Get platform stats
SELECT * FROM get_admin_platform_stats();

-- Clear test data (CAREFUL!)
TRUNCATE quiz_play_sessions CASCADE;
```

---

## Support Contact

For issues with analytics:
1. Check this guide first
2. Review PHASE_1_ANALYTICS_COMPLETE.md
3. Check console logs
4. Query database directly
5. Disable feature flag if critical

Remember: Analytics should NEVER break the quiz flow!

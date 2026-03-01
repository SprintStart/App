# Feedback System Testing Guide

## Quick Testing Checklist

### 1. Test Feedback Overlay on Results Page

**Steps:**
1. Play any quiz to completion (or game over)
2. Wait 2 seconds on the results page
3. Feedback overlay should appear (bottom-right on desktop, bottom sheet on mobile)

**Test Thumbs Up:**
1. Click thumbs up button
2. Should auto-submit
3. Shows "Thanks for your feedback!" message
4. Closes after 1.5 seconds
5. Check database:
   ```sql
   SELECT * FROM quiz_feedback ORDER BY created_at DESC LIMIT 5;
   -- Should see new entry with rating = 1
   ```

**Test Thumbs Down:**
1. Click thumbs down button
2. Should show reason selection chips
3. Select a reason (e.g., "Too hard")
4. Optionally add comment (max 140 chars)
5. Click Submit
6. Shows "Thanks!" and closes
7. Check database:
   ```sql
   SELECT * FROM quiz_feedback ORDER BY created_at DESC LIMIT 5;
   -- Should see entry with rating = -1, reason = 'too_hard'
   ```

**Test Dismissal:**
1. Click X or Skip button
2. Overlay should close immediately
3. No feedback submitted
4. User can still retry/share/exit

---

### 2. Test Non-Blocking Behavior

**Critical Test:**
1. Open results page
2. When feedback overlay appears, immediately click "Retry Challenge"
3. Quiz should restart WITHOUT waiting for feedback
4. Overlay should disappear
5. Quiz flow should be uninterrupted

**Expected:** Feedback never blocks user actions.

---

### 3. Test Teacher Dashboard Feedback Display

**Setup:**
1. Submit feedback for a quiz (as described in test #1)
2. Login as the teacher who created that quiz
3. Navigate to Analytics tab

**Test:**
1. Find the quiz in the performance table
2. Verify thumbs up/down counts display correctly
3. Click "View Details" button
4. Detailed analytics modal should open
5. Scroll down to see "Student Feedback" section

**Verify:**
- Feedback count is correct
- Reason chips display (e.g., "Too hard (1)")
- Recent comments show up with timestamps
- Color-coded chips are readable
- Mobile responsive (test on narrow screen)

**Screenshot Expected:**
```
Student Feedback (3 responses)
Improvement Suggestions:
  [Too hard (2)] [Unclear questions (1)]

Recent Comments:
  👍 "Great quiz! Helped me learn a lot."
     January 15, 2026

  👎 "Some questions were confusing."
     January 14, 2026
```

---

### 4. Test Feedback Summary RPC

**Direct Database Test:**
```sql
-- Get feedback summary for a quiz
SELECT * FROM get_quiz_feedback_summary('quiz-uuid-here');

-- Expected output:
{
  "likes_count": 5,
  "dislikes_count": 2,
  "total_feedback": 7,
  "feedback_score": 0.25,
  "reasons": {
    "too_hard": 1,
    "too_easy": 0,
    "unclear_questions": 1,
    "too_long": 0,
    "bugs_lag": 0
  },
  "recent_comments": [...]
}
```

---

### 5. Test Feedback Score Calculation

**Test Cases:**
```sql
-- Case 1: All positive
INSERT INTO quiz_feedback (quiz_id, rating) VALUES ('test-quiz', 1), ('test-quiz', 1), ('test-quiz', 1);
REFRESH MATERIALIZED VIEW quiz_feedback_stats;
SELECT feedback_score FROM quiz_feedback_stats WHERE quiz_id = 'test-quiz';
-- Expected: (3-0) / (3+0+5) = 0.375

-- Case 2: Mixed
INSERT INTO quiz_feedback (quiz_id, rating) VALUES ('test-quiz-2', 1), ('test-quiz-2', 1), ('test-quiz-2', -1);
REFRESH MATERIALIZED VIEW quiz_feedback_stats;
SELECT feedback_score FROM quiz_feedback_stats WHERE quiz_id = 'test-quiz-2';
-- Expected: (2-1) / (2+1+5) = 0.125

-- Case 3: All negative
INSERT INTO quiz_feedback (quiz_id, rating) VALUES ('test-quiz-3', -1), ('test-quiz-3', -1);
REFRESH MATERIALIZED VIEW quiz_feedback_stats;
SELECT feedback_score FROM quiz_feedback_stats WHERE quiz_id = 'test-quiz-3';
-- Expected: (0-2) / (0+2+5) = -0.286
```

---

### 6. Test Top Rated Quizzes

**Database Test:**
```sql
-- Get top 10 rated quizzes with at least 5 feedback responses
SELECT * FROM get_top_rated_quizzes(NULL, 5, 10);

-- Verify:
-- - Only quizzes with >= 5 feedback
-- - Sorted by feedback_score DESC
-- - Includes teacher_name, school_name
-- - Shows likes_count, dislikes_count
```

---

### 7. Test Teacher Review Prompt Logic

**Test Case 1: New Quiz (< 20 plays, < 3 days)**
```sql
-- Create test quiz
INSERT INTO question_sets (id, title, created_by, created_at)
VALUES ('test-new-quiz', 'New Quiz', 'teacher-uuid', NOW());

-- Check should show prompt
SELECT should_show_teacher_review_prompt('teacher-uuid', 'test-new-quiz');
-- Expected: false (not enough plays, not enough days)
```

**Test Case 2: Popular Quiz (>= 20 plays)**
```sql
-- Insert 20 quiz sessions
INSERT INTO quiz_play_sessions (quiz_id, total_questions)
SELECT 'test-popular-quiz', 10 FROM generate_series(1, 20);

-- Check should show prompt
SELECT should_show_teacher_review_prompt('teacher-uuid', 'test-popular-quiz');
-- Expected: true (>= 20 plays)
```

**Test Case 3: Old Quiz (>= 3 days)**
```sql
-- Create quiz 4 days ago
INSERT INTO question_sets (id, title, created_by, created_at)
VALUES ('test-old-quiz', 'Old Quiz', 'teacher-uuid', NOW() - INTERVAL '4 days');

-- Check should show prompt
SELECT should_show_teacher_review_prompt('teacher-uuid', 'test-old-quiz');
-- Expected: true (>= 3 days)
```

**Test Case 4: Already Shown**
```sql
-- Mark prompt as shown
INSERT INTO teacher_review_prompts (teacher_id, quiz_id)
VALUES ('teacher-uuid', 'test-quiz');

-- Check should show prompt again
SELECT should_show_teacher_review_prompt('teacher-uuid', 'test-quiz');
-- Expected: false (already shown)
```

---

### 8. Test RLS Security

**Test Insert (Anyone):**
```sql
-- As anonymous user (should succeed)
SET request.jwt.claim.sub = NULL;
INSERT INTO quiz_feedback (quiz_id, rating, user_type)
VALUES ('any-quiz', 1, 'student');
-- Expected: Success

-- As authenticated user (should succeed)
SET request.jwt.claim.sub = 'student-uuid';
INSERT INTO quiz_feedback (quiz_id, rating, user_type)
VALUES ('any-quiz', 1, 'student');
-- Expected: Success
```

**Test Select (Restricted):**
```sql
-- As anonymous user (should fail)
SET request.jwt.claim.sub = NULL;
SELECT * FROM quiz_feedback;
-- Expected: 0 rows (no permission)

-- As quiz owner (should succeed)
SET request.jwt.claim.sub = 'teacher-uuid';
SELECT * FROM quiz_feedback WHERE quiz_id IN (
  SELECT id FROM question_sets WHERE created_by = 'teacher-uuid'
);
-- Expected: Returns feedback for own quizzes only
```

**Test Update/Delete (Forbidden):**
```sql
-- Try to update feedback (should fail)
UPDATE quiz_feedback SET rating = 1 WHERE id = 'feedback-uuid';
-- Expected: Permission denied

-- Try to delete feedback (should fail)
DELETE FROM quiz_feedback WHERE id = 'feedback-uuid';
-- Expected: Permission denied
```

---

### 9. Test Mobile Responsive Design

**Mobile Testing (< 768px width):**
1. Open results page on mobile device or narrow browser
2. Wait for feedback overlay
3. Verify:
   - Overlay appears as bottom sheet (not floating card)
   - Backdrop covers entire screen
   - Buttons are touch-friendly (large tap targets)
   - Text is readable
   - Comment field is usable
   - Can scroll if needed
   - X button accessible

**Desktop Testing (>= 768px width):**
1. Open results page on desktop
2. Verify:
   - Overlay appears as bottom-right card
   - Doesn't cover results
   - Shadow/border visible
   - Animations smooth

---

### 10. Test Fail-Safe Behavior

**Simulate Database Error:**
1. Temporarily revoke INSERT on quiz_feedback:
   ```sql
   REVOKE INSERT ON quiz_feedback FROM anon;
   ```
2. Play quiz to completion
3. Submit feedback
4. Verify:
   - Console shows warning (not error)
   - User sees "Thanks!" message (even though it failed)
   - Quiz flow uninterrupted
   - User can retry/share/exit normally
5. Restore permissions:
   ```sql
   GRANT INSERT ON quiz_feedback TO anon;
   ```

**Expected:** Feedback failures are silent and non-blocking.

---

### 11. Test Character Limit

**Test Comment Field:**
1. Open feedback overlay (thumbs down)
2. Type 140 characters exactly
3. Verify character counter shows "140/140"
4. Try typing more characters
5. Verify input stops at 140
6. Submit and check database:
   ```sql
   SELECT LENGTH(comment) FROM quiz_feedback ORDER BY created_at DESC LIMIT 1;
   -- Expected: <= 140
   ```

---

### 12. Test Analytics Integration

**End-to-End Test:**
1. Play quiz as anonymous student
2. Complete quiz
3. Submit thumbs up via overlay
4. Login as teacher (quiz owner)
5. Navigate to Analytics tab
6. Verify:
   - Play count incremented (from Phase 1 analytics)
   - Thumbs up count = 1
   - View Details shows feedback summary
7. Play quiz again, submit thumbs down with reason
8. Refresh teacher analytics
9. Verify:
   - Thumbs down count = 1
   - Reason chip displays

---

## Common Issues & Solutions

### Issue: Overlay doesn't appear
**Solution:**
- Check if `quizId` is passed to EndScreen
- Verify 2-second delay hasn't been interrupted
- Check console for errors
- Ensure feedback overlay component imported

### Issue: Feedback not saving
**Solution:**
- Check RLS policies allow INSERT
- Verify quiz_id is valid UUID
- Check console for API errors
- Test database connection

### Issue: Teacher can't see feedback
**Solution:**
- Verify teacher owns the quiz
- Check RLS policies on quiz_feedback
- Ensure `get_quiz_feedback_summary` has permission checks
- Test with admin account to rule out RLS issue

### Issue: Feedback score incorrect
**Solution:**
- Refresh materialized view: `SELECT refresh_quiz_feedback_stats();`
- Verify calculation: `(likes - dislikes) / (likes + dislikes + 5)`
- Check data integrity in quiz_feedback table

---

## Performance Testing

### Load Test Feedback Submission:
```bash
# Simulate 1000 concurrent feedback submissions
# (Use your preferred load testing tool)
# Verify:
# - API response time < 500ms
# - Database can handle load
# - No deadlocks or timeouts
# - Materialized view updates efficiently
```

### Query Performance:
```sql
-- Test feedback summary query speed
EXPLAIN ANALYZE SELECT * FROM get_quiz_feedback_summary('quiz-uuid');
-- Expected: < 100ms

-- Test top rated quizzes query speed
EXPLAIN ANALYZE SELECT * FROM get_top_rated_quizzes(NULL, 10, 20);
-- Expected: < 200ms
```

---

## Success Criteria

**Micro Feedback is successful if:**
1. ✅ Overlay appears on results page (not blocking)
2. ✅ Thumbs up/down submits successfully
3. ✅ Teacher can view detailed feedback
4. ✅ Feedback failures don't break quiz flow
5. ✅ Mobile and desktop responsive
6. ✅ RLS security enforced
7. ✅ Performance acceptable (< 500ms)
8. ✅ No user complaints

---

## Quick Commands

```sql
-- View recent feedback
SELECT * FROM quiz_feedback ORDER BY created_at DESC LIMIT 10;

-- Refresh feedback stats
SELECT refresh_quiz_feedback_stats();

-- View feedback stats for all quizzes
SELECT * FROM quiz_feedback_stats ORDER BY feedback_score DESC;

-- Get feedback summary for specific quiz
SELECT * FROM get_quiz_feedback_summary('quiz-uuid');

-- Get top rated quizzes
SELECT * FROM get_top_rated_quizzes(NULL, 10, 20);

-- Check review prompt eligibility
SELECT should_show_teacher_review_prompt('teacher-uuid', 'quiz-uuid');

-- Clear test feedback (CAREFUL!)
DELETE FROM quiz_feedback WHERE quiz_id = 'test-quiz-uuid';
REFRESH MATERIALIZED VIEW quiz_feedback_stats;
```

---

## Support

For issues with feedback system:
1. Check this testing guide
2. Review MICRO_FEEDBACK_RANKING_COMPLETE.md
3. Check console logs
4. Query database directly
5. Verify RLS policies

Remember: Feedback should NEVER break the quiz flow!

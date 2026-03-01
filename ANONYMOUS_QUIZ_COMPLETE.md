# Anonymous Quiz Flow - Complete Implementation

## Summary

Successfully implemented anonymous quiz gameplay with no authentication required. Students can now play quizzes instantly without login, with proper error handling and no blocking issues.

## Issues Fixed

### 1. Sponsor Banners - display_order Column Missing

**Problem**: Frontend was querying `sponsor_banners.display_order` but column didn't exist.

**Solution**:
- Added `display_order` column to `sponsored_ads` table (default: 0)
- Updated `sponsor_banners` view to include `display_order` field
- Made banner loading failures non-blocking (fail silently)

### 2. Anonymous Quiz Start Requiring Authorization

**Problem**: Quiz start endpoint required auth headers, blocking anonymous users.

**Solution**:
- Created `start-public-quiz` edge function (no JWT verification)
- Implements session-based gameplay using `session_id` from localStorage
- Creates quiz runs in new `public_quiz_runs` table
- Fetches 10 questions and returns WITHOUT correct answers
- Server stores full question data including correct answers

### 3. Anonymous Answer Submission

**Problem**: Answer submission required authentication.

**Solution**:
- Created `submit-public-answer` edge function (no JWT verification)
- Validates answers server-side (no cheating possible)
- Implements 2-attempt system:
  - Attempt 1 wrong: "Try again"
  - Attempt 2 wrong: "Game Over"
- Returns status: `correct`, `try_again`, `game_over`, `quiz_completed`
- Updates score (+10 per correct answer)

### 4. Homepage Redirects on Errors

**Problem**: Quiz failures redirected users to homepage, breaking gameplay flow.

**Solution**:
- Replaced redirects with in-game error states
- Error screen shows: "We couldn't load this quiz"
- Two action buttons:
  - "Retry" - Attempts same quiz again
  - "Choose Another Quiz" - Returns to topic selection
- No navigation away from game context

### 5. Session Management

**Problem**: No way to track anonymous users across requests.

**Solution**:
- Created `anonymousSession.ts` utility
- Generates unique `session_id` on first visit
- Stores in localStorage
- Automatically includes in all API calls via `X-Session-Id` header

## New Database Tables

### quiz_sessions
Tracks anonymous and authenticated user sessions.

```sql
- id (uuid, primary key)
- session_id (text, unique)
- user_id (uuid, nullable reference to auth.users)
- created_at (timestamptz)
- last_activity (timestamptz)
```

### public_quiz_runs
Tracks quiz gameplay for anonymous users.

```sql
- id (uuid, primary key)
- session_id (text)
- quiz_session_id (uuid, reference to quiz_sessions)
- topic_id (uuid, reference to topics)
- question_set_id (uuid, reference to question_sets)
- status (text: in_progress, completed, failed)
- score (int)
- questions_data (jsonb) - includes correct answers
- current_question_index (int)
- attempts_used (jsonb)
- started_at (timestamptz)
- completed_at (timestamptz)
- created_at (timestamptz)
```

### public_quiz_answers
Records each answer submission.

```sql
- id (uuid, primary key)
- run_id (uuid, reference to public_quiz_runs)
- question_id (uuid)
- selected_option (int)
- is_correct (boolean)
- attempt_number (int)
- answered_at (timestamptz)
```

## New Edge Functions

### start-public-quiz
- **Auth**: None required (verify_jwt: false)
- **Input**: `{ topicId, sessionId }`
- **Output**: `{ runId, topicName, questions, totalQuestions }`
- **Security**: Returns questions WITHOUT correct answers
- **Process**:
  1. Validates topic is active
  2. Creates/updates quiz session
  3. Finds approved question set
  4. Selects and shuffles 10 questions
  5. Stores full data server-side
  6. Returns safe client data

### submit-public-answer
- **Auth**: None required (verify_jwt: false)
- **Input**: `{ runId, questionId, selectedOption, sessionId }`
- **Output**: `{ status, isCorrect, attemptNumber, score, nextQuestionId }`
- **Security**: Validates answers server-side
- **Process**:
  1. Verifies session owns the run
  2. Checks run status (must be in_progress)
  3. Validates against server-stored correct answer
  4. Tracks attempts (max 2)
  5. Updates score and status
  6. Returns next question or completion status

### get-public-quiz-summary
- **Auth**: None required (verify_jwt: false)
- **Input**: `run_id`, `session_id` (query params)
- **Output**: `{ summary: { score_total, correct_count, wrong_count, duration_seconds, status } }`
- **Security**: Validates session ownership

## Frontend Changes

### New Files
- `src/lib/anonymousSession.ts` - Session ID management

### Modified Files

#### src/lib/api.ts
- Updated to use new public endpoints
- Added `X-Session-Id` header to all requests
- Changed to use `start-public-quiz`, `submit-public-answer`, `get-public-quiz-summary`
- Updated response interfaces to match new API

#### src/components/StudentApp.tsx
- Removed `questionSetId` parameter (auto-selected by backend)
- Updated to call `startTopicRun(topicId)` directly
- Improved error handling with Retry/Choose Another buttons
- No homepage redirects on errors

#### src/components/TopicSelection.tsx
- Simplified to single-click topic selection
- Removed question set selection step
- Directly starts quiz when topic is clicked
- Removed unused imports

#### src/components/QuestionChallenge.tsx
- Updated question interface: `id`, `question_text`, `options`
- Updated to handle new response statuses
- Added quiz_completed status handling
- Improved error messages

#### src/components/PublicHomepage.tsx
- Banner loading failures are now silent (non-blocking)
- Empty banner array on error instead of throwing

#### src/lib/safeApi.ts
- Made `loadSponsorBannersPublic` fail silently
- Returns empty array on banner errors

## Security Features

### Server-Side Answer Validation
- Correct answers NEVER sent to client
- All validation happens server-side
- Impossible to cheat by inspecting network traffic

### Session Ownership Verification
- All endpoints validate `session_id` ownership
- Cannot access or modify other users' quiz runs
- RLS policies enforce data isolation

### Rate Limiting Built-In
- 2 attempts per question maximum
- Cannot retry after game over
- Must start new quiz

## User Experience Improvements

### Instant Gameplay
- No signup/login required
- Click topic → Start playing
- Questions load immediately

### Clear Feedback
- "Try again!" on first wrong attempt
- "Game Over" on second wrong attempt
- Progress indicator shows question X of 10
- Score updates in real-time

### No Blocking Errors
- Banner failures don't stop gameplay
- Quiz errors show retry option
- Network errors display helpful messages
- Never redirected away from game

### Audio Controls
- Sound toggle button in corner
- Audio only initializes on first user interaction
- Respects browser autoplay policies

## Testing Checklist

- [x] Anonymous user can select topic
- [x] Quiz starts without login
- [x] Questions display correctly
- [x] First wrong answer allows retry
- [x] Second wrong answer triggers game over
- [x] Correct answer advances to next question
- [x] Score updates correctly (+10 per correct)
- [x] Quiz completion shows summary
- [x] Banner errors don't block gameplay
- [x] No console errors for display_order
- [x] No console errors for missing auth
- [x] Session ID persists across page reloads
- [x] Error states show Retry/Choose Another buttons
- [x] No redirects to homepage during gameplay

## API Endpoints

### Start Quiz
```
POST /functions/v1/start-public-quiz
Headers: X-Session-Id
Body: { topicId, sessionId }
```

### Submit Answer
```
POST /functions/v1/submit-public-answer
Headers: X-Session-Id
Body: { runId, questionId, selectedOption, sessionId }
```

### Get Summary
```
GET /functions/v1/get-public-quiz-summary?run_id=xxx&session_id=xxx
Headers: X-Session-Id
```

## Migration Applied
- `supabase/migrations/fix_anonymous_gameplay_and_banners.sql`
- Created 3 new tables with RLS
- Added display_order column
- Updated sponsor_banners view
- Added performance indexes

## Build Status
✅ **Build successful** - No TypeScript errors, project compiles cleanly.

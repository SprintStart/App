import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QuestionChallenge } from '../components/QuestionChallenge';
import { EndScreen } from '../components/EndScreen';
import { supabase } from '../lib/supabase';
import { useImmersive } from '../contexts/ImmersiveContext';
import { getOrCreateSessionId } from '../lib/anonymousSession';
import { createQuizPlaySession } from '../lib/analytics';
import { QuizPlayAdBanner } from '../components/ads/QuizPlayAdBanner';

type Screen = 'loading' | 'challenge' | 'end';

interface ChallengeState {
  runId: string;
  questionSetId: string;
  timerSeconds: number | null;
  analyticsSessionId: string | null;
  schoolId: string | null;
  countryId: string | null;
  questions: Array<{
    id: string;
    question_text: string;
    options: string[];
    correct_index: number;
    explanation: string;
    image_url?: string;
  }>;
}

const CURRENT_RUN_KEY = 'immersiq_current_run';

export function QuizPlay() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>('loading');
  const [challengeState, setChallengeState] = useState<ChallengeState | null>(null);
  const [endState, setEndState] = useState<{ type: 'completed' | 'game_over'; summary: any } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryableError, setRetryableError] = useState(false);
  const { isImmersive } = useImmersive();

  useEffect(() => {
    if (quizId) {
      startQuizRun(quizId);
    }
  }, [quizId]);

  async function startQuizRun(questionSetId: string) {
    try {
      console.log('[QuizPlay] Starting quiz:', questionSetId);

      // Get question set details and verify it's accessible
      const { data: qsData, error: qsError } = await supabase
        .from('question_sets')
        .select('id, title, topic_id, timer_seconds, approval_status, is_active')
        .eq('id', questionSetId)
        .maybeSingle();

      if (qsError) {
        console.error('[QuizPlay] Error fetching question set:', qsError);
        throw new Error('Unable to load quiz. Please try again.');
      }

      if (!qsData) {
        console.error('[QuizPlay] Question set not found:', questionSetId);
        setError('Quiz not found. It may have been removed or is not yet available.');
        return;
      }

      // Verify quiz is approved and active
      if (!qsData.is_active) {
        console.error('[QuizPlay] Quiz is not active:', questionSetId);
        setError('This quiz is currently unavailable.');
        return;
      }

      if (qsData.approval_status !== 'approved') {
        console.error('[QuizPlay] Quiz not approved:', questionSetId, qsData.approval_status);
        setError('This quiz is not yet available for play.');
        return;
      }

      // Pre-flight check: verify questions exist
      const { data: questionsCheck, error: checkError } = await supabase
        .from('topic_questions')
        .select('id')
        .eq('question_set_id', questionSetId)
        .eq('is_published', true)
        .limit(1);

      if (checkError) {
        console.error('[QuizPlay] Error checking questions:', checkError);
        throw new Error('Unable to load quiz questions.');
      }

      if (!questionsCheck || questionsCheck.length === 0) {
        console.error('[QuizPlay] No published questions found for quiz:', questionSetId);
        setError('This quiz has no questions yet. Please check back later.');
        return;
      }

      console.log('[QuizPlay] Pre-flight check passed, creating quiz run');

      // Get or create session ID
      const sessionId = getOrCreateSessionId();
      console.log('[QuizPlay] Using session ID:', sessionId);

      // Create quiz run using RPC (includes questions_data)
      const { data: rpcData, error: runError } = await supabase
        .rpc('start_quiz_run', {
          p_question_set_id: questionSetId,
          p_session_id: sessionId,
        });

      if (runError) {
        console.error('[QuizPlay] RPC error:', {
          message: runError.message,
          details: runError.details,
          hint: runError.hint,
          code: runError.code,
        });

        if (runError.message.includes('No published questions')) {
          setError('This quiz has no questions available yet.');
        } else if (runError.message.includes('not approved')) {
          setError('This quiz is not yet available for play.');
        } else {
          setError('Unable to start quiz. Please try again.');
        }
        return;
      }

      if (!rpcData || !rpcData.run_id) {
        console.error('[QuizPlay] RPC returned invalid data:', rpcData);
        setError('Failed to create quiz run. Please try again.');
        return;
      }

      console.log('[QuizPlay] Quiz run created successfully:', {
        runId: rpcData.run_id,
        questionCount: rpcData.question_count,
      });

      // Fetch questions for display (without correct_index for security)
      // Retry logic: 1 automatic retry after 500ms on failure
      let questionsData;
      try {
        const { data, error: questionsError } = await supabase
          .from('topic_questions')
          .select('id, question_text, options, image_url')
          .eq('question_set_id', questionSetId)
          .eq('is_published', true)
          .order('order_index', { ascending: true });

        if (questionsError) {
          console.error('[QuizPlay] Error fetching questions (first attempt):', questionsError);

          // Wait 500ms and retry once
          await new Promise(resolve => setTimeout(resolve, 500));

          const { data: retryData, error: retryError } = await supabase
            .from('topic_questions')
            .select('id, question_text, options, image_url')
            .eq('question_set_id', questionSetId)
            .eq('is_published', true)
            .order('order_index', { ascending: true });

          if (retryError) {
            console.error('[QuizPlay] Error fetching questions (retry failed):', retryError);
            setError('Connection unstable — tap retry');
            setRetryableError(true);
            return;
          }

          questionsData = retryData;
        } else {
          questionsData = data;
        }
      } catch (err) {
        console.error('[QuizPlay] Unexpected error loading questions:', err);
        setError('Connection unstable — tap retry');
        setRetryableError(true);
        return;
      }

      if (!questionsData || questionsData.length === 0) {
        console.error('[QuizPlay] No questions returned after run creation');
        setError('Unable to load questions. Please try again.');
        return;
      }

      // Create analytics session (non-blocking, fail-safe)
      let analyticsSessionId: string | null = null;
      let topicData: { id: string; subject_id: string | null; school_id: string | null } | null = null;

      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id || null;

        // Get topic/school/subject if available
        const { data: fetchedTopicData } = await supabase
          .from('topics')
          .select('id, subject_id, school_id')
          .eq('id', qsData.topic_id)
          .maybeSingle();

        topicData = fetchedTopicData;

        analyticsSessionId = await createQuizPlaySession({
          quiz_id: questionSetId,
          school_id: topicData?.school_id || null,
          subject_id: topicData?.subject_id || null,
          topic_id: qsData.topic_id || null,
          player_id: userId,
          total_questions: questionsData.length,
        });

        console.log('[Analytics] Session created:', analyticsSessionId);
      } catch (analyticsError) {
        console.warn('[Analytics] Failed to create session (non-critical):', analyticsError);
      }

      const newChallengeState = {
        runId: rpcData.run_id,
        questionSetId: questionSetId,
        timerSeconds: qsData.timer_seconds,
        analyticsSessionId: analyticsSessionId,
        schoolId: topicData?.school_id || null,
        questions: questionsData,
      };

      localStorage.setItem(CURRENT_RUN_KEY, JSON.stringify({
        runId: rpcData.run_id,
        questionSetId: questionSetId,
        analyticsSessionId: analyticsSessionId,
        schoolId: topicData?.school_id || null,
      }));

      setChallengeState(newChallengeState);
      setScreen('challenge');
    } catch (err: any) {
      console.error('[QuizPlay] Unexpected error starting quiz:', {
        error: err,
        message: err?.message,
        stack: err?.stack,
      });

      if (err instanceof RetryableError) {
        setError(err.message);
        setRetryableError(true);
      } else {
        setError(err.message || 'An unexpected error occurred. Please try again.');
      }
    }
  }

  function handleComplete(summary: any) {
    setEndState({ type: 'completed', summary });
    setScreen('end');
  }

  function handleGameOver(summary: any) {
    setEndState({ type: 'game_over', summary });
    setScreen('end');
  }

  function handleRetry() {
    localStorage.removeItem(CURRENT_RUN_KEY);
    setEndState(null);
    setError(null);
    setRetryableError(false);
    if (quizId) {
      startQuizRun(quizId);
    }
  }

  function handleExit() {
    localStorage.removeItem(CURRENT_RUN_KEY);
    navigate('/explore');
  }

  if (error) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isImmersive ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="text-center max-w-2xl mx-auto p-8">
          <div className={`mb-6 ${isImmersive ? 'text-red-400 text-3xl' : 'text-red-600 text-xl'}`}>
            {retryableError ? 'Connection Issue' : 'Unable to Start Quiz'}
          </div>
          <div className={`mb-8 ${isImmersive ? 'text-gray-300 text-xl' : 'text-gray-600 text-base'}`}>
            {error}
          </div>
          <div className="flex gap-4 justify-center">
            {retryableError && (
              <button
                onClick={handleRetry}
                className={`px-8 py-3 rounded-lg font-bold transition-all ${
                  isImmersive
                    ? 'bg-green-600 hover:bg-green-700 text-white text-xl'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                Retry
              </button>
            )}
            <button
              onClick={handleExit}
              className={`px-8 py-3 rounded-lg font-bold transition-all ${
                isImmersive
                  ? 'bg-blue-600 hover:bg-blue-700 text-white text-xl'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              Back to Browse
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'loading' || !challengeState) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isImmersive ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className={`text-center ${isImmersive ? 'text-white text-3xl' : 'text-gray-600 text-xl'}`}>
          Loading quiz...
        </div>
      </div>
    );
  }

  if (screen === 'challenge') {
    return (
      <>
        <QuestionChallenge
          runId={challengeState.runId}
          questionSetId={challengeState.questionSetId}
          analyticsSessionId={challengeState.analyticsSessionId}
          questions={challengeState.questions}
          timerSeconds={challengeState.timerSeconds || undefined}
          onComplete={handleComplete}
          onGameOver={handleGameOver}
        />
        {/* Ad shown during quiz play (not blocking) */}
        {!isImmersive && (
          <div className="fixed bottom-4 right-4 w-80 z-10">
            <QuizPlayAdBanner
              country_id={challengeState.countryId}
              school_id={challengeState.schoolId}
            />
          </div>
        )}
      </>
    );
  }

  if (screen === 'end' && endState) {
    return (
      <EndScreen
        type={endState.type}
        summary={endState.summary}
        quizId={challengeState?.questionSetId}
        analyticsSessionId={challengeState?.analyticsSessionId}
        schoolId={challengeState?.schoolId}
        onRetry={handleRetry}
        onNewTopic={handleExit}
      />
    );
  }

  return null;
}

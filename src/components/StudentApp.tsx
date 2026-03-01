import { useState, useEffect } from 'react';
import { TopicSelection } from './TopicSelection';
import { QuestionChallenge } from './QuestionChallenge';
import { EndScreen } from './EndScreen';
import { startTopicRun, getTopicRunSummary } from '../lib/api';
import { useImmersive } from '../contexts/ImmersiveContext';
import { Maximize2, Minimize2 } from 'lucide-react';

type Screen = 'selection' | 'challenge' | 'end';

interface ChallengeState {
  runId: string;
  topicId: string;
  questions: Array<{
    id: string;
    question_text: string;
    options: string[];
  }>;
}

const CURRENT_RUN_KEY = 'immersiq_current_run';

export function StudentApp() {
  const [screen, setScreen] = useState<Screen>('selection');
  const [challengeState, setChallengeState] = useState<ChallengeState | null>(null);
  const [endState, setEndState] = useState<{ type: 'completed' | 'game_over'; summary: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isImmersive, toggleImmersive } = useImmersive();

  useEffect(() => {
    checkForExistingRun();
  }, []);

  async function checkForExistingRun() {
    try {
      const savedRun = localStorage.getItem(CURRENT_RUN_KEY);
      if (!savedRun) {
        setLoading(false);
        return;
      }

      const { runId, topicId } = JSON.parse(savedRun);
      const summary = await getTopicRunSummary(runId);

      if (summary.success && summary.summary) {
        const status = summary.summary.status;

        if (status === 'completed' || status === 'game_over' || status === 'failed') {
          setEndState({
            type: status === 'completed' ? 'completed' : 'game_over',
            summary: summary.summary,
          });
          setScreen('end');
        } else if (status === 'in_progress') {
          localStorage.removeItem(CURRENT_RUN_KEY);
        }
      }
    } catch (err) {
      console.error('Error checking existing run:', err);
      localStorage.removeItem(CURRENT_RUN_KEY);
    } finally {
      setLoading(false);
    }
  }

  async function handleStartChallenge(topicId: string) {
    setLoading(true);
    setError(null);

    try {
      const response = await startTopicRun(topicId);

      if (!response.success || !response.runId || !response.questions) {
        setError(response.error || 'Failed to start challenge');
        setLoading(false);
        return;
      }

      const newChallengeState = {
        runId: response.runId,
        topicId,
        questions: response.questions,
      };

      localStorage.setItem(CURRENT_RUN_KEY, JSON.stringify({
        runId: response.runId,
        topicId,
      }));

      setChallengeState(newChallengeState);
      setScreen('challenge');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
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
    if (challengeState) {
      handleStartChallenge(challengeState.topicId);
    }
  }

  function handleNewTopic() {
    localStorage.removeItem(CURRENT_RUN_KEY);
    setScreen('selection');
    setChallengeState(null);
    setEndState(null);
  }

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isImmersive ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className={`text-center ${isImmersive ? 'text-white text-3xl' : 'text-gray-600 text-xl'}`}>
          Starting challenge...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isImmersive ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="text-center max-w-2xl mx-auto p-8">
          <div className={`mb-6 ${isImmersive ? 'text-red-400 text-3xl' : 'text-red-600 text-xl'}`}>
            We couldn't load this quiz
          </div>
          <div className={`mb-8 ${isImmersive ? 'text-gray-300 text-xl' : 'text-gray-600 text-base'}`}>
            {error}
          </div>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => {
                setError(null);
                if (challengeState) {
                  handleStartChallenge(challengeState.topicId);
                }
              }}
              disabled={!challengeState}
              className={`rounded-lg font-bold transition-all ${
                isImmersive
                  ? 'px-12 py-6 text-2xl bg-green-600 text-white hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500'
                  : 'px-6 py-3 text-lg bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-500'
              }`}
            >
              Retry
            </button>
            <button
              onClick={() => {
                setError(null);
                setScreen('selection');
                setChallengeState(null);
              }}
              className={`rounded-lg font-bold transition-all ${
                isImmersive
                  ? 'px-12 py-6 text-2xl bg-blue-600 text-white hover:bg-blue-500'
                  : 'px-6 py-3 text-lg bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Choose Another Quiz
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <button
        onClick={toggleImmersive}
        className={`fixed z-50 rounded-full shadow-lg transition-all ${
          isImmersive
            ? 'top-4 right-4 sm:top-6 sm:right-6 md:top-8 md:right-8 bg-gray-700 hover:bg-gray-600 p-3 sm:p-4 md:p-6'
            : 'top-3 right-3 sm:top-4 sm:right-4 bg-white hover:bg-gray-100 p-2 sm:p-3'
        }`}
        title={isImmersive ? 'Exit Immersive Mode' : 'Enter Immersive Mode'}
      >
        {isImmersive ? (
          <Minimize2 className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-white" />
        ) : (
          <Maximize2 className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
        )}
      </button>

      {screen === 'selection' && (
        <TopicSelection onStartChallenge={handleStartChallenge} />
      )}

      {screen === 'challenge' && challengeState && (
        <QuestionChallenge
          runId={challengeState.runId}
          questions={challengeState.questions}
          onComplete={handleComplete}
          onGameOver={handleGameOver}
        />
      )}

      {screen === 'end' && endState && (
        <EndScreen
          type={endState.type}
          summary={endState.summary}
          onRetry={handleRetry}
          onNewTopic={handleNewTopic}
          onExplore={() => window.location.href = '/'}
          onTeacherLogin={() => window.location.href = '/teachers'}
        />
      )}
    </div>
  );
}

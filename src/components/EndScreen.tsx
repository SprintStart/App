import { useImmersive } from '../contexts/ImmersiveContext';
import { Trophy, Circle as XCircle, RotateCcw, Hop as Home, Target, Clock, Award, CircleCheck as CheckCircle, Circle as XCircleSmall, Share2, Compass, GraduationCap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { QuizFeedbackOverlay } from './QuizFeedbackOverlay';
import TokenRewardModal from './TokenRewardModal';
import { FEATURE_TOKENS } from '../lib/featureFlags';

interface QuestionBreakdown {
  question_text: string;
  is_correct: boolean;
  attempts: number;
}

interface EndScreenProps {
  type: 'completed' | 'game_over';
  summary: {
    score_total: number;
    correct_count: number;
    wrong_count: number;
    total_questions?: number;
    percentage?: number;
    duration_seconds: number | null;
    status?: string;
    is_frozen?: boolean;
    question_breakdown?: QuestionBreakdown[];
    run_id?: string;
  };
  quizId?: string;
  analyticsSessionId?: string | null;
  schoolId?: string | null;
  onRetry: () => void;
  onNewTopic: () => void;
  onExplore?: () => void;
  onTeacherLogin?: () => void;
}

export function EndScreen({ type, summary, quizId, analyticsSessionId, schoolId, onRetry, onNewTopic, onExplore, onTeacherLogin }: EndScreenProps) {
  const { isImmersive } = useImmersive();
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      window.history.pushState(null, '', window.location.href);
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    if (quizId) {
      const timer = setTimeout(() => {
        setShowFeedback(true);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [quizId]);

  useEffect(() => {
    if (FEATURE_TOKENS && quizId) {
      const tokenTimer = setTimeout(() => {
        setShowTokenModal(true);
      }, 3500);

      return () => clearTimeout(tokenTimer);
    }
  }, [quizId]);

  const handleShare = async () => {
    const totalQuestions = summary.total_questions || (summary.correct_count + summary.wrong_count);
    const percentage = summary.percentage !== undefined
      ? summary.percentage
      : totalQuestions > 0
        ? Math.round((summary.correct_count / totalQuestions) * 100)
        : 0;

    const shareUrl = summary.run_id
      ? `${window.location.origin}/share/session/${summary.run_id}`
      : window.location.origin;

    const shareText = `I scored ${percentage}% (${summary.correct_count}/${totalQuestions}) on StartSprint! ${type === 'completed' ? '🏆' : '💪'} Can you beat me?`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My StartSprint Score',
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          copyToClipboard(shareUrl);
        }
      }
    } else {
      copyToClipboard(shareUrl);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 3000);
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const totalQuestions = summary.total_questions || (summary.correct_count + summary.wrong_count);
  const percentage = summary.percentage !== undefined
    ? summary.percentage
    : totalQuestions > 0
      ? Math.round((summary.correct_count / totalQuestions) * 100)
      : 0;

  return (
    <div className={`min-h-screen flex items-center justify-center ${isImmersive ? 'bg-gray-900 p-3 sm:p-6 md:p-8 lg:p-12' : 'bg-gray-50 p-3 sm:p-4 md:p-6 lg:p-8'}`}>
      <div className={`w-full text-center mx-auto ${isImmersive ? 'max-w-5xl' : 'max-w-2xl'}`}>
        <div className={`rounded-lg ${isImmersive ? 'bg-gray-800 p-6 sm:p-8 md:p-12 lg:p-16' : 'bg-white shadow-lg p-4 sm:p-6 md:p-8 lg:p-12'}`}>
          <div className="flex justify-center mb-4 sm:mb-6 md:mb-8">
            {type === 'completed' ? (
              <div className={`rounded-full ${isImmersive ? 'bg-green-600 p-6 sm:p-8 md:p-10 lg:p-12' : 'bg-green-100 p-4 sm:p-6 md:p-8'}`}>
                <Trophy className={isImmersive ? 'w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 text-white' : 'w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 text-green-600'} />
              </div>
            ) : (
              <div className={`rounded-full ${isImmersive ? 'bg-red-600 p-6 sm:p-8 md:p-10 lg:p-12' : 'bg-red-100 p-4 sm:p-6 md:p-8'}`}>
                <XCircle className={isImmersive ? 'w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 text-white' : 'w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 text-red-600'} />
              </div>
            )}
          </div>

          <h1 className={`font-bold mb-2 sm:mb-3 md:mb-4 ${
            isImmersive ? 'text-3xl sm:text-4xl md:text-5xl lg:text-6xl' : 'text-2xl sm:text-3xl md:text-4xl'
          } ${
            type === 'completed'
              ? isImmersive ? 'text-green-400' : 'text-green-600'
              : isImmersive ? 'text-red-400' : 'text-red-600'
          }`}>
            {type === 'completed' ? 'Challenge Complete!' : 'Game Over'}
          </h1>

          <p className={`mb-4 sm:mb-6 md:mb-8 ${
            isImmersive ? 'text-lg sm:text-xl md:text-2xl lg:text-3xl text-gray-300' : 'text-base sm:text-lg md:text-xl text-gray-600'
          }`}>
            {type === 'completed'
              ? 'Congratulations on completing the challenge!'
              : 'Better luck next time!'}
          </p>

          <div className={`mb-4 sm:mb-6 md:mb-8 ${isImmersive ? 'text-gray-300 text-base sm:text-lg md:text-xl' : 'text-gray-500 text-sm sm:text-base'}`}>
            {type === 'completed' ? (
              <span>You answered all questions correctly!</span>
            ) : (
              <span>You got {summary.correct_count} out of {totalQuestions} questions right</span>
            )}
          </div>

          <div className={`grid gap-3 sm:gap-4 md:gap-6 mb-6 sm:mb-8 md:mb-12 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`}>
            <div className={`rounded-lg ${isImmersive ? 'bg-gray-700 p-4 sm:p-6 md:p-8' : 'bg-gray-50 p-3 sm:p-4 md:p-6'}`}>
              <div className="flex justify-center mb-2 sm:mb-3">
                <Award className={isImmersive ? 'w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 text-yellow-400' : 'w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-yellow-600'} />
              </div>
              <div className={`font-bold mb-1 sm:mb-2 ${isImmersive ? 'text-3xl sm:text-4xl md:text-5xl text-yellow-400' : 'text-2xl sm:text-3xl text-yellow-600'}`}>
                {percentage}%
              </div>
              <div className={isImmersive ? 'text-base sm:text-lg md:text-xl lg:text-2xl text-gray-400' : 'text-sm sm:text-base text-gray-600'}>
                Score
              </div>
            </div>

            <div className={`rounded-lg ${isImmersive ? 'bg-gray-700 p-4 sm:p-6 md:p-8' : 'bg-gray-50 p-3 sm:p-4 md:p-6'}`}>
              <div className="flex justify-center mb-2 sm:mb-3">
                <Target className={isImmersive ? 'w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 text-green-400' : 'w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-green-600'} />
              </div>
              <div className={`font-bold mb-1 sm:mb-2 ${isImmersive ? 'text-3xl sm:text-4xl md:text-5xl text-green-400' : 'text-2xl sm:text-3xl text-green-600'}`}>
                {summary.correct_count}/{totalQuestions}
              </div>
              <div className={isImmersive ? 'text-base sm:text-lg md:text-xl lg:text-2xl text-gray-400' : 'text-sm sm:text-base text-gray-600'}>
                Correct
              </div>
            </div>

            <div className={`rounded-lg ${isImmersive ? 'bg-gray-700 p-4 sm:p-6 md:p-8' : 'bg-gray-50 p-3 sm:p-4 md:p-6'}`}>
              <div className="flex justify-center mb-2 sm:mb-3">
                <Clock className={isImmersive ? 'w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 text-blue-400' : 'w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-blue-600'} />
              </div>
              <div className={`font-bold mb-1 sm:mb-2 ${isImmersive ? 'text-3xl sm:text-4xl md:text-5xl text-blue-400' : 'text-2xl sm:text-3xl text-blue-600'}`}>
                {formatDuration(summary.duration_seconds)}
              </div>
              <div className={isImmersive ? 'text-base sm:text-lg md:text-xl lg:text-2xl text-gray-400' : 'text-sm sm:text-base text-gray-600'}>
                Time
              </div>
            </div>
          </div>

          {summary.question_breakdown && summary.question_breakdown.length > 0 && (
            <div className="mb-4 sm:mb-6 md:mb-8">
              <button
                onClick={() => setShowBreakdown(!showBreakdown)}
                className={`mb-3 sm:mb-4 underline ${isImmersive ? 'text-blue-400 text-base sm:text-lg md:text-xl' : 'text-blue-600 text-sm sm:text-base'}`}
              >
                {showBreakdown ? 'Hide' : 'Show'} Question Results
              </button>

              {showBreakdown && (
                <div className={`max-h-64 sm:max-h-80 md:max-h-96 overflow-y-auto ${isImmersive ? 'space-y-3 sm:space-y-4' : 'space-y-2 sm:space-y-3'}`}>
                  {summary.question_breakdown.map((q, idx) => (
                    <div
                      key={idx}
                      className={`text-left rounded-lg ${
                        isImmersive
                          ? 'bg-gray-700 p-3 sm:p-4 md:p-6'
                          : 'bg-gray-50 p-2 sm:p-3 md:p-4'
                      }`}
                    >
                      <div className="flex items-start gap-2 sm:gap-3">
                        <div className="flex-shrink-0 mt-1">
                          {q.is_correct ? (
                            <CheckCircle className={`${isImmersive ? 'w-5 h-5 sm:w-6 sm:h-6' : 'w-4 h-4 sm:w-5 sm:h-5'} text-green-500`} />
                          ) : (
                            <XCircleSmall className={`${isImmersive ? 'w-5 h-5 sm:w-6 sm:h-6' : 'w-4 h-4 sm:w-5 sm:h-5'} text-red-500`} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`${isImmersive ? 'text-gray-200 text-sm sm:text-base md:text-lg' : 'text-gray-800 text-xs sm:text-sm md:text-base'} break-words`}>
                            {q.question_text}
                          </p>
                          <p className={`mt-1 ${isImmersive ? 'text-gray-400 text-xs sm:text-sm' : 'text-gray-500 text-xs'}`}>
                            {q.is_correct
                              ? `Correct on attempt ${q.attempts}`
                              : `Failed after ${q.attempts} attempt${q.attempts > 1 ? 's' : ''}`
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {summary.is_frozen && (
            <div className={`mb-4 sm:mb-6 md:mb-8 ${isImmersive ? 'text-gray-400 text-sm sm:text-base md:text-lg' : 'text-gray-500 text-xs sm:text-sm'}`}>
              Session completed and saved
            </div>
          )}

          <div className="space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                onClick={onRetry}
                className={`flex-1 flex items-center justify-center gap-2 sm:gap-3 rounded-lg font-bold transition-all ${
                  isImmersive
                    ? 'py-4 sm:py-6 md:py-8 text-xl sm:text-2xl md:text-3xl bg-blue-600 text-white hover:bg-blue-500'
                    : 'py-3 sm:py-4 text-base sm:text-lg bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <RotateCcw className={isImmersive ? 'w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10' : 'w-5 h-5 sm:w-6 sm:h-6'} />
                <span className="whitespace-nowrap">Retry Challenge</span>
              </button>

              <button
                onClick={onNewTopic}
                className={`flex-1 flex items-center justify-center gap-2 sm:gap-3 rounded-lg font-bold transition-all ${
                  isImmersive
                    ? 'py-4 sm:py-6 md:py-8 text-xl sm:text-2xl md:text-3xl bg-gray-700 text-white hover:bg-gray-600'
                    : 'py-3 sm:py-4 text-base sm:text-lg bg-gray-600 text-white hover:bg-gray-700'
                }`}
              >
                <Home className={isImmersive ? 'w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10' : 'w-5 h-5 sm:w-6 sm:h-6'} />
                <span className="whitespace-nowrap">Choose New Topic</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                onClick={handleShare}
                className={`flex-1 flex items-center justify-center gap-2 sm:gap-3 rounded-lg font-bold transition-all ${
                  isImmersive
                    ? 'py-3 sm:py-4 md:py-6 text-lg sm:text-xl md:text-2xl bg-green-600 text-white hover:bg-green-500'
                    : 'py-2 sm:py-3 text-sm sm:text-base bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                <Share2 className={isImmersive ? 'w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8' : 'w-4 h-4 sm:w-5 sm:h-5'} />
                <span>{shareSuccess ? 'Copied!' : 'Share Score'}</span>
              </button>

              {onExplore && (
                <button
                  onClick={onExplore}
                  className={`flex-1 flex items-center justify-center gap-2 sm:gap-3 rounded-lg font-bold transition-all ${
                    isImmersive
                      ? 'py-3 sm:py-4 md:py-6 text-lg sm:text-xl md:text-2xl bg-teal-600 text-white hover:bg-teal-500'
                      : 'py-2 sm:py-3 text-sm sm:text-base bg-teal-600 text-white hover:bg-teal-700'
                  }`}
                >
                  <Compass className={isImmersive ? 'w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8' : 'w-4 h-4 sm:w-5 sm:h-5'} />
                  <span className="whitespace-nowrap">Explore Subjects</span>
                </button>
              )}

              {onTeacherLogin && (
                <button
                  onClick={onTeacherLogin}
                  className={`flex-1 flex items-center justify-center gap-2 sm:gap-3 rounded-lg font-bold transition-all ${
                    isImmersive
                      ? 'py-3 sm:py-4 md:py-6 text-lg sm:text-xl md:text-2xl bg-orange-600 text-white hover:bg-orange-500'
                      : 'py-2 sm:py-3 text-sm sm:text-base bg-orange-600 text-white hover:bg-orange-700'
                  }`}
                >
                  <GraduationCap className={isImmersive ? 'w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8' : 'w-4 h-4 sm:w-5 sm:h-5'} />
                  <span className="whitespace-nowrap">Teacher Login</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showFeedback && quizId && (
        <QuizFeedbackOverlay
          quizId={quizId}
          sessionId={analyticsSessionId}
          schoolId={schoolId}
          onClose={() => setShowFeedback(false)}
        />
      )}

      {FEATURE_TOKENS && showTokenModal && (
        <TokenRewardModal
          isOpen={showTokenModal}
          onClose={() => setShowTokenModal(false)}
          quizId={quizId}
          runId={summary.run_id}
        />
      )}
    </div>
  );
}

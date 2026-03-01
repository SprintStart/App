import { useState, useEffect, useRef } from 'react';
import { submitTopicAnswer, getTopicRunSummary } from '../lib/api';
import { useImmersive } from '../contexts/ImmersiveContext';
import { audioManager } from '../lib/audio';
import { CheckCircle, XCircle, AlertCircle, Volume2, VolumeX, Sparkles, Timer } from 'lucide-react';
import { logQuizSessionEvent, completeQuizPlaySession } from '../lib/analytics';

interface Question {
  id: string;
  question_text: string;
  options: string[];
  image_url?: string;
}

interface QuestionChallengeProps {
  runId: string;
  questionSetId: string;
  analyticsSessionId: string | null;
  questions: Question[];
  onComplete: (summary: any) => void;
  onGameOver: (summary: any) => void;
  timerSeconds?: number;
}

export function QuestionChallenge({ runId, questionSetId, analyticsSessionId, questions, onComplete, onGameOver, timerSeconds }: QuestionChallengeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'correct' | 'wrong' | 'gameover' | null; message: string }>({
    type: null,
    message: '',
  });
  const [attemptCount, setAttemptCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);
  const [shakeWrong, setShakeWrong] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(timerSeconds || null);
  const { isImmersive } = useImmersive();

  const currentQuestion = questions[currentIndex];
  const questionStartTime = useRef<number>(Date.now());
  const correctCount = useRef<number>(0);
  const wrongCount = useRef<number>(0);

  useEffect(() => {
    const initAudio = async () => {
      const success = await audioManager.initialize();
      setAudioInitialized(success);
    };

    initAudio();

    const handleInteraction = () => {
      if (!audioInitialized) {
        initAudio();
      }
    };

    document.addEventListener('click', handleInteraction);
    document.addEventListener('keydown', handleInteraction);

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };
  }, [audioInitialized]);

  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0 || isSubmitting || feedback.type) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          handleTimeExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining, isSubmitting, feedback.type]);

  async function handleTimeExpired() {
    if (isSubmitting) return;

    audioManager.playGameOver();
    setFeedback({
      type: 'gameover',
      message: 'Time\'s Up! Game Over',
    });

    const summary = await getTopicRunSummary(runId);
    if (summary.success && summary.summary) {
      setTimeout(() => {
        onGameOver(summary.summary);
      }, 2000);
    }
  }

  function toggleSound() {
    const newState = audioManager.toggle();
    setSoundEnabled(newState);
  }

  async function handleAnswerSelection(answerIndex: number) {
    if (isSubmitting) return;

    setSelectedAnswer(answerIndex);

    setTimeout(() => {
      handleSubmit(answerIndex);
    }, 300);
  }

  async function handleSubmit(answerIndex: number) {
    if (isSubmitting) return;

    setIsSubmitting(true);
    const timeSpent = Date.now() - questionStartTime.current;

    try {
      const response = await submitTopicAnswer(runId, currentQuestion.id, answerIndex);

      if (!response.success) {
        setFeedback({
          type: 'wrong',
          message: response.error || 'An error occurred',
        });
        setIsSubmitting(false);
        return;
      }

      setAttemptCount(response.attemptNumber || 0);

      // Log analytics event (fail-safe, non-blocking)
      const isCorrect = response.status === 'correct' || response.status === 'quiz_completed';
      if (isCorrect) {
        correctCount.current += 1;
      } else {
        wrongCount.current += 1;
      }

      try {
        if (analyticsSessionId) {
          await logQuizSessionEvent({
            session_id: analyticsSessionId,
            quiz_id: questionSetId,
            question_id: currentQuestion.id,
            event_type: 'answer_submitted',
            is_correct: isCorrect,
            attempts_used: response.attemptNumber || 1,
            time_spent_ms: timeSpent,
          });
        }
      } catch (analyticsError) {
        console.warn('[Analytics] Failed to log answer event (non-critical):', analyticsError);
      }

      if (response.status === 'correct') {
        audioManager.playCorrect();
        setShowCelebration(true);
        setFeedback({
          type: 'correct',
          message: 'Excellent! Well done!',
        });

        setTimeout(async () => {
          setShowCelebration(false);
          if (currentIndex < questions.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setSelectedAnswer(null);
            setFeedback({ type: null, message: '' });
            setAttemptCount(0);
            setIsSubmitting(false);
            questionStartTime.current = Date.now();
          } else {
            const summary = await getTopicRunSummary(runId);
            if (summary.success && summary.summary) {
              // Complete analytics session (fail-safe)
              try {
                if (analyticsSessionId) {
                  await completeQuizPlaySession(analyticsSessionId, {
                    score: summary.summary.score || 0,
                    correct_count: correctCount.current,
                    wrong_count: wrongCount.current,
                  });
                }
              } catch (analyticsError) {
                console.warn('[Analytics] Failed to complete session (non-critical):', analyticsError);
              }

              audioManager.playComplete();
              onComplete(summary.summary);
            }
          }
        }, 1500);
      } else if (response.status === 'try_again') {
        audioManager.playWrong();
        setShakeWrong(true);
        setFeedback({
          type: 'wrong',
          message: 'Not quite. Try again!',
        });
        setTimeout(() => setShakeWrong(false), 500);
        setSelectedAnswer(null);
        setIsSubmitting(false);
      } else if (response.status === 'game_over') {
        audioManager.playGameOver();
        setFeedback({
          type: 'gameover',
          message: 'Game Over',
        });

        const summary = await getTopicRunSummary(runId);
        if (summary.success && summary.summary) {
          // Complete analytics session (fail-safe)
          try {
            if (analyticsSessionId) {
              await completeQuizPlaySession(analyticsSessionId, {
                score: summary.summary.score || 0,
                correct_count: correctCount.current,
                wrong_count: wrongCount.current,
              });
            }
          } catch (analyticsError) {
            console.warn('[Analytics] Failed to complete session (non-critical):', analyticsError);
          }

          onGameOver(summary.summary);
        }
      } else if (response.status === 'quiz_completed') {
        audioManager.playComplete();
        setFeedback({
          type: 'correct',
          message: 'Congratulations! Quiz Complete!',
        });

        setTimeout(async () => {
          const summary = await getTopicRunSummary(runId);
          if (summary.success && summary.summary) {
            // Complete analytics session (fail-safe)
            try {
              if (analyticsSessionId) {
                await completeQuizPlaySession(analyticsSessionId, {
                  score: summary.summary.score || 0,
                  correct_count: correctCount.current,
                  wrong_count: wrongCount.current,
                });
              }
            } catch (analyticsError) {
              console.warn('[Analytics] Failed to complete session (non-critical):', analyticsError);
            }

            onComplete(summary.summary);
          }
        }, 2000);
      }
    } catch (error) {
      setFeedback({
        type: 'wrong',
        message: 'Network error occurred',
      });
      setIsSubmitting(false);
    }
  }

  return (
    <div className={`min-h-screen flex items-center justify-center relative overflow-hidden ${isImmersive ? 'bg-gray-900 p-3 sm:p-6 md:p-8 lg:p-12' : 'bg-gray-50 p-3 sm:p-4 md:p-6 lg:p-8'}`}>
      {showCelebration && (
        <>
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-ping"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: '1s',
              }}
            >
              <Sparkles className={`${isImmersive ? 'w-8 sm:w-10 md:w-12' : 'w-6 sm:w-8'} text-yellow-400`} />
            </div>
          ))}
        </>
      )}

      <button
        onClick={toggleSound}
        className={`fixed z-50 rounded-full shadow-lg transition-all ${
          isImmersive
            ? 'top-4 right-4 sm:top-6 sm:right-6 md:top-8 md:right-8 bg-gray-700 hover:bg-gray-600 p-3 sm:p-4 md:p-6'
            : 'top-3 right-3 sm:top-4 sm:right-4 bg-white hover:bg-gray-100 p-2 sm:p-3'
        }`}
        title={soundEnabled ? 'Mute Sound' : 'Enable Sound'}
      >
        {soundEnabled ? (
          <Volume2 className={isImmersive ? 'w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-green-400' : 'w-5 h-5 sm:w-6 sm:h-6 text-green-600'} />
        ) : (
          <VolumeX className={isImmersive ? 'w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-gray-400' : 'w-5 h-5 sm:w-6 sm:h-6 text-gray-500'} />
        )}
      </button>

      <div className={`w-full ${isImmersive ? 'max-w-5xl' : 'max-w-3xl'} mx-auto`}>
        <div className={`mb-4 sm:mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4 ${isImmersive ? 'text-lg sm:text-xl md:text-2xl' : 'text-base sm:text-lg'}`}>
          <span className={isImmersive ? 'text-gray-300' : 'text-gray-600'}>
            Question {currentIndex + 1} of {questions.length}
          </span>
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            {timeRemaining !== null && (
              <span className={`flex items-center gap-1 sm:gap-2 font-bold text-sm sm:text-base ${
                timeRemaining <= 10
                  ? isImmersive ? 'text-red-400 animate-pulse' : 'text-red-600 animate-pulse'
                  : timeRemaining <= 30
                  ? isImmersive ? 'text-yellow-400' : 'text-yellow-600'
                  : isImmersive ? 'text-green-400' : 'text-green-600'
              }`}>
                <Timer className={isImmersive ? 'w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7' : 'w-4 h-4 sm:w-5 sm:h-5'} />
                {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
              </span>
            )}
            {attemptCount > 0 && (
              <span className={`flex items-center gap-1 sm:gap-2 text-sm sm:text-base ${isImmersive ? 'text-yellow-400' : 'text-yellow-600'}`}>
                <AlertCircle className={isImmersive ? 'w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7' : 'w-4 h-4 sm:w-5 sm:h-5'} />
                <span className="whitespace-nowrap">Attempt {attemptCount}/2</span>
              </span>
            )}
          </div>
        </div>

        <div
          className={`rounded-lg transition-all ${isImmersive ? 'bg-gray-800 p-4 sm:p-6 md:p-8 lg:p-12' : 'bg-white shadow-lg p-4 sm:p-6 md:p-8'} ${
            shakeWrong ? 'animate-shake' : ''
          }`}
          style={{
            animation: shakeWrong ? 'shake 0.5s' : 'none',
          }}
        >
          <h2 className={`font-bold mb-4 sm:mb-6 md:mb-8 leading-tight ${isImmersive ? 'text-2xl sm:text-3xl md:text-4xl text-white' : 'text-xl sm:text-2xl text-gray-900'}`}>
            {currentQuestion.question_text}
          </h2>

          {currentQuestion.image_url && (
            <div className="mb-4 sm:mb-6">
              <img
                src={currentQuestion.image_url}
                alt="Question"
                className={`w-full max-w-2xl h-auto rounded-lg ${isImmersive ? 'border-2 border-gray-700' : 'border border-gray-300'} mx-auto`}
              />
            </div>
          )}

          <div className="space-y-2 sm:space-y-3 md:space-y-4">
            {currentQuestion.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswerSelection(index)}
                disabled={isSubmitting}
                className={`w-full text-left rounded-lg transition-all ${
                  isImmersive
                    ? `p-4 sm:p-6 md:p-8 border-2 sm:border-3 md:border-4 ${
                        selectedAnswer === index
                          ? 'bg-blue-600 border-blue-500 text-white scale-105 shadow-xl'
                          : 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600 hover:scale-102'
                      }`
                    : `p-3 sm:p-4 md:p-6 border-2 ${
                        selectedAnswer === index
                          ? 'bg-blue-100 border-blue-500 text-blue-900 scale-105 shadow-lg'
                          : 'bg-gray-50 border-gray-300 text-gray-900 hover:bg-gray-100'
                      }`
                } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}`}
              >
                <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
                  <div className={`font-bold flex-shrink-0 flex items-center justify-center rounded-full ${
                    isImmersive
                      ? 'text-base sm:text-lg md:text-2xl w-8 h-8 sm:w-10 sm:h-10 md:w-[50px] md:h-[50px]'
                      : 'text-sm sm:text-base md:text-lg w-8 h-8 sm:w-9 sm:h-9 md:w-[40px] md:h-[40px]'
                  } ${
                    selectedAnswer === index
                      ? isImmersive ? 'bg-blue-500' : 'bg-blue-500 text-white'
                      : isImmersive ? 'bg-gray-600' : 'bg-gray-200'
                  }`}>
                    {String.fromCharCode(65 + index)}
                  </div>
                  <span className={`${isImmersive ? 'text-base sm:text-lg md:text-xl lg:text-2xl' : 'text-sm sm:text-base md:text-lg'} break-words`}>{option}</span>
                </div>
              </button>
            ))}
          </div>

          {isSubmitting && !feedback.type && (
            <div className={`mt-4 sm:mt-6 md:mt-8 rounded-lg flex items-center justify-center gap-2 sm:gap-3 md:gap-4 ${
              isImmersive ? 'p-4 sm:p-6 md:p-8 bg-blue-900 text-blue-200' : 'p-3 sm:p-4 md:p-6 bg-blue-100 text-blue-800'
            }`}>
              <div className="animate-spin">
                <div className={`${isImmersive ? 'w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8' : 'w-5 h-5 sm:w-6 sm:h-6'} border-4 border-blue-400 border-t-transparent rounded-full`}></div>
              </div>
              <span className={`font-semibold ${isImmersive ? 'text-lg sm:text-xl md:text-2xl lg:text-3xl' : 'text-base sm:text-lg'}`}>
                Checking answer...
              </span>
            </div>
          )}

          {feedback.type && (
            <div
              className={`mt-4 sm:mt-6 md:mt-8 rounded-lg flex items-center gap-2 sm:gap-3 md:gap-4 ${
                isImmersive ? 'p-4 sm:p-6 md:p-8' : 'p-3 sm:p-4 md:p-6'
              } ${
                feedback.type === 'correct'
                  ? isImmersive ? 'bg-green-900 text-green-200 animate-pulse' : 'bg-green-100 text-green-800 animate-pulse'
                  : feedback.type === 'gameover'
                  ? isImmersive ? 'bg-red-950 text-red-300 border-4 border-red-700' : 'bg-red-200 text-red-900 border-4 border-red-500'
                  : isImmersive ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-800'
              }`}
              style={{
                animation: feedback.type === 'gameover' ? 'pulse 2s infinite' : undefined,
              }}
            >
              {feedback.type === 'correct' ? (
                <CheckCircle className={`flex-shrink-0 ${isImmersive ? 'w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10' : 'w-5 h-5 sm:w-6 sm:h-6'} animate-bounce`} />
              ) : (
                <XCircle className={`flex-shrink-0 ${isImmersive ? 'w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10' : 'w-5 h-5 sm:w-6 sm:h-6'} ${feedback.type === 'gameover' ? 'animate-spin' : ''}`} />
              )}
              <span className={`font-black ${isImmersive ? 'text-xl sm:text-2xl md:text-3xl lg:text-4xl' : 'text-base sm:text-lg md:text-xl'} ${feedback.type === 'gameover' ? 'uppercase tracking-wider' : ''}`}>
                {feedback.message}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

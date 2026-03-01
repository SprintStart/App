import { useState } from 'react';
import { ThumbsUp, ThumbsDown, X } from 'lucide-react';
import { submitQuizFeedback } from '../lib/analytics';

interface QuizFeedbackOverlayProps {
  quizId: string;
  sessionId?: string | null;
  schoolId?: string | null;
  onClose: () => void;
}

const REASON_OPTIONS = [
  { value: 'too_hard', label: 'Too hard' },
  { value: 'too_easy', label: 'Too easy' },
  { value: 'unclear_questions', label: 'Unclear questions' },
  { value: 'too_long', label: 'Too long' },
  { value: 'bugs_lag', label: 'Bugs/Lag' },
] as const;

export function QuizFeedbackOverlay({ quizId, sessionId, schoolId, onClose }: QuizFeedbackOverlayProps) {
  const [step, setStep] = useState<'rating' | 'details' | 'submitted'>('rating');
  const [rating, setRating] = useState<1 | -1 | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRatingClick(value: 1 | -1) {
    setRating(value);

    // If thumbs up, submit immediately and close
    if (value === 1) {
      await submitFeedback(value, null, null);
      setStep('submitted');
      setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      // If thumbs down, show details step
      setStep('details');
    }
  }

  async function handleSubmitDetails() {
    if (!rating) return;

    setIsSubmitting(true);
    await submitFeedback(rating, reason, comment);
    setIsSubmitting(false);
    setStep('submitted');

    setTimeout(() => {
      onClose();
    }, 1500);
  }

  async function submitFeedback(ratingValue: 1 | -1, reasonValue: string | null, commentValue: string | null) {
    try {
      await submitQuizFeedback({
        quiz_id: quizId,
        session_id: sessionId,
        school_id: schoolId,
        rating: ratingValue,
        reason: reasonValue as any,
        comment: commentValue || undefined,
        user_type: 'student',
      });
    } catch (error) {
      console.error('[Feedback] Failed to submit:', error);
    }
  }

  if (step === 'submitted') {
    return (
      <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-green-500 text-white rounded-lg shadow-2xl p-6 max-w-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              ✓
            </div>
            <span className="font-medium">Thanks for your feedback!</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: Bottom Sheet */}
      <div className="md:hidden fixed inset-0 z-50 animate-in fade-in duration-200">
        <div
          className="absolute inset-0 bg-black/50"
          onClick={onClose}
        />
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom duration-300">
          {step === 'rating' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">How was this quiz?</h3>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex gap-4 justify-center py-4">
                <button
                  onClick={() => handleRatingClick(1)}
                  className="flex-1 flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-gray-200 hover:border-green-500 hover:bg-green-50 transition-all active:scale-95"
                >
                  <ThumbsUp className="w-12 h-12 text-green-600" />
                  <span className="text-sm font-medium text-gray-700">Good</span>
                </button>

                <button
                  onClick={() => handleRatingClick(-1)}
                  className="flex-1 flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-gray-200 hover:border-red-500 hover:bg-red-50 transition-all active:scale-95"
                >
                  <ThumbsDown className="w-12 h-12 text-red-600" />
                  <span className="text-sm font-medium text-gray-700">Not Good</span>
                </button>
              </div>
            </div>
          )}

          {step === 'details' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">What should improve?</h3>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {REASON_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setReason(option.value)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        reason === option.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value.slice(0, 140))}
                  placeholder="Optional: Tell us more (140 chars max)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={3}
                  maxLength={140}
                />
                <div className="text-xs text-gray-500 text-right">{comment.length}/140</div>

                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                  >
                    Skip
                  </button>
                  <button
                    onClick={handleSubmitDetails}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Desktop: Bottom Right Card */}
      <div className="hidden md:block fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-sm overflow-hidden">
          {step === 'rating' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">How was this quiz?</h3>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleRatingClick(1)}
                  className="flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-gray-200 hover:border-green-500 hover:bg-green-50 transition-all"
                >
                  <ThumbsUp className="w-10 h-10 text-green-600" />
                  <span className="text-sm font-medium text-gray-700">Good</span>
                </button>

                <button
                  onClick={() => handleRatingClick(-1)}
                  className="flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-gray-200 hover:border-red-500 hover:bg-red-50 transition-all"
                >
                  <ThumbsDown className="w-10 h-10 text-red-600" />
                  <span className="text-sm font-medium text-gray-700">Not Good</span>
                </button>
              </div>
            </div>
          )}

          {step === 'details' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">What should improve?</h3>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {REASON_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setReason(option.value)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        reason === option.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value.slice(0, 140))}
                  placeholder="Optional: Tell us more (140 chars max)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                  rows={3}
                  maxLength={140}
                />
                <div className="text-xs text-gray-500 text-right">{comment.length}/140</div>

                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors text-sm"
                  >
                    Skip
                  </button>
                  <button
                    onClick={handleSubmitDetails}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors text-sm"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

import { useEffect, useState } from 'react';
import { ThumbsUp, ThumbsDown, MessageSquare, TrendingDown, TrendingUp } from 'lucide-react';
import { getAdminFeedbackOverview, getAdminQuizzesByFeedback } from '../../lib/analytics';

interface FeedbackOverview {
  total_feedback: number;
  total_likes: number;
  total_dislikes: number;
  feedback_this_month: number;
  like_ratio: number;
  reasons: {
    too_hard: number;
    too_easy: number;
    unclear_questions: number;
    too_long: number;
    bugs_lag: number;
  };
  recent_feedback: Array<{
    quiz_title: string;
    rating: number;
    reason: string | null;
    comment: string | null;
    created_at: string;
    school_name: string;
  }>;
}

interface QuizFeedback {
  quiz_id: string;
  quiz_title: string;
  school_name: string;
  teacher_email: string;
  likes_count: number;
  dislikes_count: number;
  total_feedback: number;
  feedback_score: number;
  reasons: {
    too_hard: number;
    too_easy: number;
    unclear_questions: number;
    too_long: number;
    bugs_lag: number;
  };
}

export function AdminFeedbackPage() {
  const [overview, setOverview] = useState<FeedbackOverview | null>(null);
  const [worstQuizzes, setWorstQuizzes] = useState<QuizFeedback[]>([]);
  const [bestQuizzes, setBestQuizzes] = useState<QuizFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'worst' | 'best'>('worst');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [overviewData, worstData, bestData] = await Promise.all([
        getAdminFeedbackOverview(),
        getAdminQuizzesByFeedback('worst', 10),
        getAdminQuizzesByFeedback('best', 10),
      ]);

      setOverview(overviewData);
      setWorstQuizzes(Array.isArray(worstData) ? worstData : []);
      setBestQuizzes(Array.isArray(bestData) ? bestData : []);
    } catch (error) {
      console.error('[Admin Feedback] Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const reasonLabels: Record<string, string> = {
    too_hard: 'Too Hard',
    too_easy: 'Too Easy',
    unclear_questions: 'Unclear Questions',
    too_long: 'Too Long',
    bugs_lag: 'Bugs/Lag',
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3 mb-3">
          <MessageSquare className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Quiz Feedback Analytics</h1>
        </div>
        <p className="text-purple-100">Student feedback and quiz quality insights</p>
      </div>

      {overview && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <MessageSquare className="w-6 h-6 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-gray-600">Total Feedback</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">{overview.total_feedback.toLocaleString()}</div>
              <div className="text-sm text-gray-500 mt-1">{overview.feedback_this_month} this month</div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <ThumbsUp className="w-6 h-6 text-green-600" />
                </div>
                <span className="text-sm font-medium text-gray-600">Likes</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">{overview.total_likes.toLocaleString()}</div>
              <div className="text-sm text-green-600 mt-1">{overview.like_ratio.toFixed(1)}% positive</div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <ThumbsDown className="w-6 h-6 text-red-600" />
                </div>
                <span className="text-sm font-medium text-gray-600">Dislikes</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">{overview.total_dislikes.toLocaleString()}</div>
              <div className="text-sm text-red-600 mt-1">{(100 - overview.like_ratio).toFixed(1)}% negative</div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <TrendingDown className="w-6 h-6 text-orange-600" />
                </div>
                <span className="text-sm font-medium text-gray-600">Top Issue</span>
              </div>
              <div className="text-xl font-bold text-gray-900">
                {Object.entries(overview.reasons).sort(([, a], [, b]) => b - a)[0]?.[0] &&
                  reasonLabels[Object.entries(overview.reasons).sort(([, a], [, b]) => b - a)[0][0]]}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {Object.entries(overview.reasons).sort(([, a], [, b]) => b - a)[0]?.[1]} reports
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Feedback Reasons Breakdown</h2>
              <div className="space-y-3">
                {Object.entries(overview.reasons)
                  .sort(([, a], [, b]) => b - a)
                  .map(([reason, count]) => {
                    const maxCount = Math.max(...Object.values(overview.reasons));
                    const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;

                    return (
                      <div key={reason}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">{reasonLabels[reason]}</span>
                          <span className="text-sm font-bold text-gray-900">{count}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Comments</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {overview.recent_feedback && overview.recent_feedback.length > 0 ? (
                  overview.recent_feedback.map((feedback, i) => (
                    <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-start gap-2 mb-2">
                        {feedback.rating === 1 ? (
                          <ThumbsUp className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <ThumbsDown className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 text-sm truncate">{feedback.quiz_title}</div>
                          <div className="text-xs text-gray-500">{feedback.school_name}</div>
                        </div>
                      </div>
                      {feedback.reason && (
                        <div className="text-xs text-orange-600 mb-1">
                          {reasonLabels[feedback.reason]}
                        </div>
                      )}
                      {feedback.comment && (
                        <p className="text-sm text-gray-700 italic">"{feedback.comment}"</p>
                      )}
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(feedback.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">No comments yet</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Quizzes by Feedback</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('worst')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'worst'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                Needs Attention
              </div>
            </button>
            <button
              onClick={() => setActiveTab('best')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'best'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Top Rated
              </div>
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {(activeTab === 'worst' ? worstQuizzes : bestQuizzes).map((quiz, i) => {
            const totalVotes = quiz.likes_count + quiz.dislikes_count;
            const likePercentage = totalVotes > 0 ? (quiz.likes_count / totalVotes) * 100 : 0;

            return (
              <div key={i} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900">{quiz.quiz_title}</div>
                    <div className="text-sm text-gray-500">
                      {quiz.school_name} • {quiz.teacher_email}
                    </div>

                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-2">
                        <ThumbsUp className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-gray-700">{quiz.likes_count}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ThumbsDown className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-medium text-gray-700">{quiz.dislikes_count}</span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {likePercentage.toFixed(0)}% positive
                      </div>
                    </div>

                    {quiz.reasons && Object.values(quiz.reasons).some(v => v > 0) && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {Object.entries(quiz.reasons)
                          .filter(([, count]) => count > 0)
                          .map(([reason, count]) => (
                            <span
                              key={reason}
                              className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full"
                            >
                              {reasonLabels[reason]}: {count}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className={`text-2xl font-bold ${
                      quiz.feedback_score >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {quiz.feedback_score.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">Score</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {(activeTab === 'worst' ? worstQuizzes : bestQuizzes).length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No quizzes with sufficient feedback yet
            <div className="text-sm mt-1">At least 5 feedback entries required</div>
          </div>
        )}
      </div>
    </div>
  );
}

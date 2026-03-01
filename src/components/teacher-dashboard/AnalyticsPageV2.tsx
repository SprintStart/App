import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, Clock, ThumbsUp, ThumbsDown, RefreshCw, AlertCircle } from 'lucide-react';
import { getTeacherQuizAnalytics, getQuizDetailedAnalytics, getQuizFeedbackSummary } from '../../lib/analytics';

interface QuizAnalytics {
  quiz_id: string;
  quiz_title: string;
  total_plays: number;
  completed_plays: number;
  completion_rate: number;
  avg_score: number;
  thumbs_up: number;
  thumbs_down: number;
  last_played_at: string | null;
}

interface DetailedAnalytics {
  total_plays: number;
  completed_plays: number;
  completion_rate: number;
  avg_score: number;
  avg_time_per_question_ms: number;
  thumbs_up: number;
  thumbs_down: number;
  plays_by_day: Array<{ play_date: string; play_count: number }>;
  last_played_at: string | null;
}

interface FeedbackSummary {
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
  recent_comments: Array<{
    comment: string;
    created_at: string;
    rating: number;
  }>;
}

export function AnalyticsPageV2() {
  const [quizzes, setQuizzes] = useState<QuizAnalytics[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<string | null>(null);
  const [detailedAnalytics, setDetailedAnalytics] = useState<DetailedAnalytics | null>(null);
  const [feedbackSummary, setFeedbackSummary] = useState<FeedbackSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    setLoading(true);
    try {
      const data = await getTeacherQuizAnalytics();
      setQuizzes(data);
    } catch (error) {
      console.error('[Analytics] Failed to load quiz analytics:', error);
    } finally {
      setLoading(false);
    }
  }

  async function viewDetails(quizId: string) {
    setSelectedQuiz(quizId);
    setDetailsLoading(true);
    try {
      const [details, feedback] = await Promise.all([
        getQuizDetailedAnalytics(quizId),
        getQuizFeedbackSummary(quizId)
      ]);
      setDetailedAnalytics(details);
      setFeedbackSummary(feedback);
    } catch (error) {
      console.error('[Analytics] Failed to load detailed analytics:', error);
    } finally {
      setDetailsLoading(false);
    }
  }

  function closeDetails() {
    setSelectedQuiz(null);
    setDetailedAnalytics(null);
    setFeedbackSummary(null);
  }

  const totalPlays = quizzes.reduce((sum, q) => sum + Number(q.total_plays), 0);
  const avgCompletionRate = quizzes.length > 0
    ? quizzes.reduce((sum, q) => sum + Number(q.completion_rate), 0) / quizzes.length
    : 0;
  const totalLikes = quizzes.reduce((sum, q) => sum + Number(q.thumbs_up), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-6 h-6" />
          <h2 className="text-2xl font-bold">Analytics (Beta)</h2>
        </div>
        <p className="text-blue-100">
          Track how students engage with your quizzes
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-gray-600 text-sm">Total Plays</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{totalPlays}</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-gray-600 text-sm">Avg Completion</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{avgCompletionRate.toFixed(0)}%</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <ThumbsUp className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-gray-600 text-sm">Total Likes</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{totalLikes}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Quiz Performance</h3>
        </div>

        {quizzes.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg mb-2">No analytics data yet</p>
            <p className="text-sm">Analytics will appear once students play your quizzes</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quiz
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plays
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Completion
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Score
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Feedback
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {quizzes.map((quiz) => (
                  <tr key={quiz.quiz_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{quiz.quiz_title}</div>
                      {quiz.last_played_at && (
                        <div className="text-xs text-gray-500">
                          Last played: {new Date(quiz.last_played_at).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-semibold text-gray-900">
                        {quiz.total_plays}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        quiz.completion_rate >= 80
                          ? 'bg-green-100 text-green-800'
                          : quiz.completion_rate >= 60
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {quiz.completion_rate.toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-semibold text-gray-900">
                        {quiz.avg_score ? quiz.avg_score.toFixed(0) + '%' : 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <div className="flex items-center gap-1 text-green-600">
                          <ThumbsUp className="w-4 h-4" />
                          <span className="text-sm font-medium">{quiz.thumbs_up}</span>
                        </div>
                        <div className="flex items-center gap-1 text-red-600">
                          <ThumbsDown className="w-4 h-4" />
                          <span className="text-sm font-medium">{quiz.thumbs_down}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => viewDetails(quiz.quiz_id)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedQuiz && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-lg font-semibold text-gray-900">Detailed Analytics</h3>
              <button
                onClick={closeDetails}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {detailsLoading ? (
              <div className="p-12 flex items-center justify-center">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : detailedAnalytics ? (
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Total Plays</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {detailedAnalytics.total_plays}
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Completion Rate</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {detailedAnalytics.completion_rate.toFixed(0)}%
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Avg Score</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {detailedAnalytics.avg_score?.toFixed(0) || 'N/A'}%
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Avg Time/Question
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {detailedAnalytics.avg_time_per_question_ms
                        ? (detailedAnalytics.avg_time_per_question_ms / 1000).toFixed(1) + 's'
                        : 'N/A'}
                    </div>
                  </div>
                </div>

                {detailedAnalytics.plays_by_day && detailedAnalytics.plays_by_day.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Plays Over Time (Last 30 Days)</h4>
                    <div className="flex items-end gap-2 h-32">
                      {detailedAnalytics.plays_by_day.map((day, i) => {
                        const maxPlays = Math.max(...detailedAnalytics.plays_by_day.map(d => d.play_count));
                        const height = (day.play_count / maxPlays) * 100;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <div
                              className="w-full bg-blue-600 rounded-t transition-all hover:bg-blue-700"
                              style={{ height: `${height}%`, minHeight: day.play_count > 0 ? '4px' : '0' }}
                              title={`${day.play_date}: ${day.play_count} plays`}
                            />
                            <div className="text-xs text-gray-500 text-center">
                              {new Date(day.play_date).getDate()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-center gap-8 pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2">
                    <ThumbsUp className="w-5 h-5 text-green-600" />
                    <span className="text-lg font-semibold text-gray-900">
                      {detailedAnalytics.thumbs_up}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ThumbsDown className="w-5 h-5 text-red-600" />
                    <span className="text-lg font-semibold text-gray-900">
                      {detailedAnalytics.thumbs_down}
                    </span>
                  </div>
                </div>

                {feedbackSummary && feedbackSummary.total_feedback > 0 && (
                  <div className="pt-4 border-t border-gray-200 space-y-4">
                    <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Student Feedback ({feedbackSummary.total_feedback} responses)
                    </h4>

                    {(feedbackSummary.reasons.too_hard > 0 ||
                      feedbackSummary.reasons.too_easy > 0 ||
                      feedbackSummary.reasons.unclear_questions > 0 ||
                      feedbackSummary.reasons.too_long > 0 ||
                      feedbackSummary.reasons.bugs_lag > 0) && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                          Improvement Suggestions
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {feedbackSummary.reasons.too_hard > 0 && (
                            <div className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-sm">
                              Too hard ({feedbackSummary.reasons.too_hard})
                            </div>
                          )}
                          {feedbackSummary.reasons.too_easy > 0 && (
                            <div className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm">
                              Too easy ({feedbackSummary.reasons.too_easy})
                            </div>
                          )}
                          {feedbackSummary.reasons.unclear_questions > 0 && (
                            <div className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm">
                              Unclear questions ({feedbackSummary.reasons.unclear_questions})
                            </div>
                          )}
                          {feedbackSummary.reasons.too_long > 0 && (
                            <div className="px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-full text-sm">
                              Too long ({feedbackSummary.reasons.too_long})
                            </div>
                          )}
                          {feedbackSummary.reasons.bugs_lag > 0 && (
                            <div className="px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-sm">
                              Bugs/Lag ({feedbackSummary.reasons.bugs_lag})
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {feedbackSummary.recent_comments && feedbackSummary.recent_comments.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                          Recent Comments
                        </div>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {feedbackSummary.recent_comments.slice(0, 5).map((comment, i) => (
                            <div key={i} className="p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-start gap-2">
                                {comment.rating === 1 ? (
                                  <ThumbsUp className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                ) : (
                                  <ThumbsDown className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1">
                                  <p className="text-sm text-gray-700">{comment.comment}</p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {new Date(comment.created_at).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-12 text-center text-gray-500">
                Failed to load detailed analytics
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

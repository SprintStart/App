import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { authenticatedGet } from '../../lib/authenticatedFetch';
import {
  Loader2,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Users,
  Clock,
  BarChart3,
  Target,
  XCircle,
} from 'lucide-react';

interface QuizOption {
  value: string;
  label: string;
  subject: string;
}

interface QuizStats {
  total_plays: number;
  unique_students: number;
  completed_runs: number;
  avg_score: number;
  avg_duration: number;
}

interface QuestionBreakdown {
  question_id: string;
  question_text: string;
  order_index: number;
  correct_index: number;
  options: string[];
  total_attempts: number;
  correct_count: number;
  correct_percentage: number;
  most_common_wrong_index: number | null;
  most_common_wrong_answer: string | null;
  wrong_count: number;
  needs_reteach: boolean;
  explanation: string;
}

interface ScoreDistribution {
  '0-20': number;
  '20-40': number;
  '40-60': number;
  '60-80': number;
  '80-100': number;
}

interface DailyTrend {
  date: string;
  attempts: number;
}

interface AnalyticsData {
  quiz_stats: QuizStats;
  question_breakdown: QuestionBreakdown[];
  score_distribution: ScoreDistribution;
  daily_trend: DailyTrend[];
}

export function AnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [quizzes, setQuizzes] = useState<QuizOption[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<string>('');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingQuizzes, setLoadingQuizzes] = useState(true);

  useEffect(() => {
    loadQuizzes();
  }, []);

  useEffect(() => {
    const quizParam = searchParams.get('quiz');
    if (quizParam && quizzes.length > 0) {
      setSelectedQuiz(quizParam);
      loadAnalytics(quizParam);
    }
  }, [searchParams, quizzes]);

  async function loadQuizzes() {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        console.error('No user found');
        return;
      }

      console.log('Loading quizzes for user:', user.user.id);

      const { data, error } = await supabase
        .from('question_sets')
        .select(`
          id,
          title,
          topic:topics(subject)
        `)
        .eq('created_by', user.user.id)
        .eq('is_active', true)
        .eq('approval_status', 'approved')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading quizzes:', error);
        return;
      }

      console.log('Raw quiz data:', data);

      const quizOptions: QuizOption[] = (data || []).map((q: any) => {
        const topicData = Array.isArray(q.topic) ? q.topic[0] : q.topic;
        return {
          value: q.id,
          label: q.title,
          subject: topicData?.subject || 'Unknown'
        };
      });

      console.log('Processed quiz options:', quizOptions);
      setQuizzes(quizOptions);
    } catch (err) {
      console.error('Failed to load quizzes:', err);
    } finally {
      setLoadingQuizzes(false);
    }
  }

  async function loadAnalytics(quizId: string) {
    try {
      setLoading(true);

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-quiz-analytics`;
      const { data, error } = await authenticatedGet<AnalyticsData>(
        apiUrl,
        { question_set_id: quizId }
      );

      if (error) {
        console.error('Analytics API error:', error);
        throw error;
      }

      if (data) {
        setAnalytics(data);
        console.log('Analytics data loaded:', data);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleQuizChange(quizId: string) {
    setSelectedQuiz(quizId);
    setSearchParams({ quiz: quizId });
    loadAnalytics(quizId);
  }

  function formatDuration(seconds: number): string {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }

  function getScoreColor(score: number): string {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  }

  if (loadingQuizzes) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Deep Analytics</h1>
        <p className="text-gray-600 mt-1">Question-level insights and performance trends</p>
      </div>

      {/* Quiz Selector */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Quiz to Analyze
        </label>
        <select
          value={selectedQuiz}
          onChange={(e) => handleQuizChange(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Choose a quiz --</option>
          {quizzes.map((quiz) => (
            <option key={quiz.value} value={quiz.value}>
              {quiz.label} ({quiz.subject})
            </option>
          ))}
        </select>
      </div>

      {!selectedQuiz && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-12 text-center">
          <BarChart3 className="w-16 h-16 mx-auto text-blue-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Quiz</h3>
          <p className="text-gray-600">Choose a quiz from the dropdown to view detailed analytics</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {!loading && selectedQuiz && analytics && (
        <>
          {/* Quiz Stats Summary */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <p className="text-sm text-gray-600">Total Plays</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{analytics.quiz_stats.total_plays}</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-green-600" />
                <p className="text-sm text-gray-600">Students</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{analytics.quiz_stats.unique_students}</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-purple-600" />
                <p className="text-sm text-gray-600">Completed</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{analytics.quiz_stats.completed_runs}</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5 text-yellow-600" />
                <p className="text-sm text-gray-600">Avg Score</p>
              </div>
              <p className={`text-2xl font-bold ${getScoreColor(analytics.quiz_stats.avg_score || 0)}`}>
                {analytics.quiz_stats.avg_score?.toFixed(1) || 0}%
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-gray-600" />
                <p className="text-sm text-gray-600">Avg Time</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {formatDuration(analytics.quiz_stats.avg_duration)}
              </p>
            </div>
          </div>

          {/* Score Distribution Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              Score Distribution
            </h2>
            <div className="grid grid-cols-5 gap-4">
              {Object.entries(analytics.score_distribution).map(([range, count]) => {
                const total = Object.values(analytics.score_distribution).reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={range} className="text-center">
                    <div className="mb-2">
                      <div className="h-32 bg-gray-100 rounded-lg flex items-end justify-center p-2">
                        <div
                          className="w-full bg-blue-500 rounded-t"
                          style={{ height: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-gray-700">{range}%</p>
                    <p className="text-2xl font-bold text-gray-900">{count}</p>
                    <p className="text-xs text-gray-500">{percentage.toFixed(0)}%</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Daily Trend */}
          {analytics.daily_trend && analytics.daily_trend.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Attempt Trends (Last 30 Days)
              </h2>
              <div className="flex items-end gap-2 h-48">
                {analytics.daily_trend.map((day, index) => {
                  const maxAttempts = Math.max(...analytics.daily_trend.map(d => d.attempts));
                  const height = maxAttempts > 0 ? (day.attempts / maxAttempts) * 100 : 0;
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full bg-gray-100 rounded flex items-end" style={{ height: '100%' }}>
                        <div
                          className="w-full bg-green-500 rounded-t transition-all"
                          style={{ height: `${height}%` }}
                          title={`${day.date}: ${day.attempts} attempts`}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-500 transform -rotate-45 origin-top-left">
                        {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Per-Question Breakdown */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Target className="w-5 h-5 text-purple-600" />
                Question-Level Analysis
              </h2>
              <p className="text-sm text-gray-600 mt-1">Detailed breakdown of student performance per question</p>
            </div>

            {analytics.question_breakdown.length === 0 ? (
              <div className="p-12 text-center">
                <AlertTriangle className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Student Attempts Yet</h3>
                <p className="text-gray-600">Share this quiz with students to collect performance data</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {analytics.question_breakdown.map((question, index) => (
                  <div
                    key={question.question_id}
                    className={`p-6 ${question.needs_reteach ? 'bg-red-50' : ''}`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Question Number */}
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                        question.needs_reteach ? 'bg-red-600 text-white' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {index + 1}
                      </div>

                      {/* Question Details */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-3">
                          <p className="text-base font-medium text-gray-900 flex-1">{question.question_text}</p>
                          {question.needs_reteach && (
                            <span className="ml-4 px-3 py-1 bg-red-600 text-white text-xs font-semibold rounded-full flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              NEEDS RETEACH
                            </span>
                          )}
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-4 gap-4 mb-4">
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Total Attempts</p>
                            <p className="text-lg font-bold text-gray-900">{question.total_attempts}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Correct</p>
                            <p className="text-lg font-bold text-green-600">{question.correct_count}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Wrong</p>
                            <p className="text-lg font-bold text-red-600">{question.wrong_count}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Success Rate</p>
                            <p className={`text-lg font-bold ${getScoreColor(question.correct_percentage)}`}>
                              {question.correct_percentage.toFixed(1)}%
                            </p>
                          </div>
                        </div>

                        {/* Options Breakdown */}
                        {question.options && question.options.length > 0 && (
                          <div className="space-y-2">
                            {question.options.map((option, optIndex) => {
                              const isCorrect = optIndex === question.correct_index;
                              const isMostCommonWrong = optIndex === question.most_common_wrong_index;
                              return (
                                <div
                                  key={optIndex}
                                  className={`p-3 rounded-lg border ${
                                    isCorrect ? 'bg-green-50 border-green-200' :
                                    isMostCommonWrong ? 'bg-red-50 border-red-200' :
                                    'bg-gray-50 border-gray-200'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 flex-1">
                                      <span className="font-semibold text-gray-700">{String.fromCharCode(65 + optIndex)}.</span>
                                      <span className="text-sm text-gray-900">{option}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {isCorrect && (
                                        <span className="px-2 py-1 bg-green-600 text-white text-xs font-semibold rounded flex items-center gap-1">
                                          <CheckCircle className="w-3 h-3" />
                                          Correct
                                        </span>
                                      )}
                                      {isMostCommonWrong && question.most_common_wrong_index !== null && (
                                        <span className="px-2 py-1 bg-red-600 text-white text-xs font-semibold rounded flex items-center gap-1">
                                          <XCircle className="w-3 h-3" />
                                          Most Common Wrong
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Explanation */}
                        {question.explanation && (
                          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-xs font-semibold text-blue-900 mb-1">Explanation:</p>
                            <p className="text-sm text-blue-800">{question.explanation}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

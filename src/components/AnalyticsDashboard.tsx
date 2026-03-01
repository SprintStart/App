import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TrendingUp, Users, Target, Clock, AlertTriangle, Download } from 'lucide-react';

interface QuizAnalytics {
  id: string;
  title: string;
  play_count: number;
  completion_count: number;
  average_score: number;
  average_time: number;
  drop_off_rate: number;
  top_drop_off_question: number;
}

interface QuestionPerformance {
  question_text: string;
  correct_rate: number;
  average_time: number;
  attempts: number;
}

export function AnalyticsDashboard() {
  const [quizzes, setQuizzes] = useState<QuizAnalytics[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<string | null>(null);
  const [questionStats, setQuestionStats] = useState<QuestionPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPlays, setTotalPlays] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [avgCompletionRate, setAvgCompletionRate] = useState(0);

  useEffect(() => {
    loadAnalytics();
  }, []);

  useEffect(() => {
    if (selectedQuiz) {
      loadQuestionStats(selectedQuiz);
    }
  }, [selectedQuiz]);

  async function loadAnalytics() {
    try {
      setLoading(true);
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data: quizData, error } = await supabase
        .from('question_sets')
        .select('*')
        .eq('created_by', user.user.id)
        .order('play_count', { ascending: false });

      if (error) throw error;

      const analyticsPromises = (quizData || []).map(async (quiz) => {
        const { data: sessions } = await supabase
          .from('student_sessions')
          .select('*')
          .eq('question_set_id', quiz.id);

        const completedSessions = sessions?.filter((s) => s.completed_at) || [];
        const avgScore = completedSessions.length > 0
          ? completedSessions.reduce((sum, s) => sum + (s.score / s.total_questions) * 100, 0) / completedSessions.length
          : 0;

        const avgTime = completedSessions.length > 0
          ? completedSessions.reduce((sum, s) => sum + (s.time_spent_seconds || 0), 0) / completedSessions.length
          : 0;

        const dropOffs = sessions?.filter((s) => !s.completed_at && s.drop_off_question) || [];
        const dropOffRate = sessions && sessions.length > 0 ? (dropOffs.length / sessions.length) * 100 : 0;

        const dropOffQuestions = dropOffs.map((s) => s.drop_off_question);
        const topDropOff = dropOffQuestions.length > 0
          ? dropOffQuestions.sort((a, b) =>
              dropOffQuestions.filter((q) => q === b).length - dropOffQuestions.filter((q) => q === a).length
            )[0]
          : 0;

        return {
          id: quiz.id,
          title: quiz.title,
          play_count: quiz.play_count || 0,
          completion_count: quiz.completion_count || 0,
          average_score: Math.round(avgScore),
          average_time: Math.round(avgTime / 60),
          drop_off_rate: Math.round(dropOffRate),
          top_drop_off_question: topDropOff,
        };
      });

      const analytics = await Promise.all(analyticsPromises);
      setQuizzes(analytics);

      const totalPlaysCount = analytics.reduce((sum, q) => sum + q.play_count, 0);
      const totalCompletions = analytics.reduce((sum, q) => sum + q.completion_count, 0);
      setTotalPlays(totalPlaysCount);
      setTotalStudents(totalPlaysCount);
      setAvgCompletionRate(totalPlaysCount > 0 ? Math.round((totalCompletions / totalPlaysCount) * 100) : 0);

    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadQuestionStats(quizId: string) {
    try {
      const { data: analytics } = await supabase
        .from('question_analytics')
        .select(`
          *,
          topic_questions!inner(question_text)
        `)
        .eq('question_set_id', quizId);

      if (analytics) {
        const stats = analytics.map((a: any) => ({
          question_text: a.topic_questions.question_text,
          correct_rate: a.total_attempts > 0 ? Math.round((a.correct_attempts / a.total_attempts) * 100) : 0,
          average_time: Math.round(a.average_time_seconds),
          attempts: a.total_attempts,
        }));
        setQuestionStats(stats);
      }
    } catch (err) {
      console.error('Failed to load question stats:', err);
    }
  }

  async function exportAnalytics() {
    const csv = [
      ['Quiz Title', 'Plays', 'Completions', 'Avg Score %', 'Avg Time (min)', 'Drop-off Rate %'],
      ...quizzes.map((q) => [
        q.title,
        q.play_count,
        q.completion_count,
        q.average_score,
        q.average_time,
        q.drop_off_rate,
      ]),
    ].map((row) => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Analytics Dashboard</h1>
          <button
            onClick={exportAnalytics}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download className="w-5 h-5" />
            Export CSV
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-6 h-6 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Total Plays</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900">{totalPlays}</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3 mb-2">
              <Target className="w-6 h-6 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">Completion Rate</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900">{avgCompletionRate}%</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-6 h-6 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">Active Quizzes</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900">{quizzes.length}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Quiz Performance</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Quiz Title</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Plays</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Completions</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Avg Score</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Avg Time</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Drop-off</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {quizzes.map((quiz) => (
                  <tr key={quiz.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900">{quiz.title}</td>
                    <td className="py-3 px-4 text-gray-600">{quiz.play_count}</td>
                    <td className="py-3 px-4 text-gray-600">{quiz.completion_count}</td>
                    <td className="py-3 px-4 text-gray-600">{quiz.average_score}%</td>
                    <td className="py-3 px-4 text-gray-600">{quiz.average_time} min</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm ${
                        quiz.drop_off_rate > 30 ? 'bg-red-100 text-red-800' :
                        quiz.drop_off_rate > 15 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {quiz.drop_off_rate > 20 && <AlertTriangle className="w-3 h-3" />}
                        {quiz.drop_off_rate}%
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => setSelectedQuiz(quiz.id)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selectedQuiz && questionStats.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Question Performance</h2>
              <button
                onClick={() => setSelectedQuiz(null)}
                className="text-gray-600 hover:text-gray-800"
              >
                Close
              </button>
            </div>
            <div className="space-y-4">
              {questionStats.map((stat, idx) => (
                <div key={idx} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-medium text-gray-900 flex-1">{stat.question_text}</p>
                    <span className={`ml-4 px-3 py-1 rounded text-sm font-semibold ${
                      stat.correct_rate >= 70 ? 'bg-green-100 text-green-800' :
                      stat.correct_rate >= 50 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {stat.correct_rate}% correct
                    </span>
                  </div>
                  <div className="flex gap-6 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {stat.attempts} attempts
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {stat.average_time}s avg
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

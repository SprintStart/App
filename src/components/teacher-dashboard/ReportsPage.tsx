import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { FileDown, Calendar, FileText, Loader2, TrendingUp, Users, Clock, CheckCircle } from 'lucide-react';

interface QuizData {
  quizId: string;
  quizName: string;
  subject: string;
  difficulty: string;
  questionCount: number;
  totalPlays: number;
  completed: number;
  avgScore: number;
  avgTime: number;
  uniqueStudents: number;
  completionRate: number;
  playsLast7Days: number;
  playsLast30Days: number;
}

export function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [quizData, setQuizData] = useState<QuizData[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | '7days' | '30days'>('all');

  useEffect(() => {
    loadQuizData();
  }, []);

  async function loadQuizData() {
    try {
      setLoading(true);
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data: questionSets } = await supabase
        .from('question_sets')
        .select(`
          id,
          title,
          difficulty,
          question_count,
          topic:topics!inner (
            id,
            name,
            subject
          )
        `)
        .eq('created_by', user.user.id)
        .eq('is_active', true)
        .eq('approval_status', 'approved');

      if (!questionSets || questionSets.length === 0) {
        setQuizData([]);
        return;
      }

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const quizStats = await Promise.all(
        questionSets.map(async (qs: any) => {
          const topicData = Array.isArray(qs.topic) ? qs.topic[0] : qs.topic;

          const { data: allRuns } = await supabase
            .from('public_quiz_runs')
            .select('status, percentage, duration_seconds, session_id, started_at')
            .eq('question_set_id', qs.id);

          const totalPlays = allRuns?.length || 0;
          const completed = allRuns?.filter(r => r.status === 'completed').length || 0;
          const completedRuns = allRuns?.filter(r => r.status === 'completed') || [];
          const uniqueStudents = new Set(allRuns?.map(r => r.session_id)).size;

          const avgScore = completedRuns.length > 0
            ? completedRuns.reduce((sum, r) => sum + (r.percentage || 0), 0) / completedRuns.length
            : 0;

          const avgTime = completedRuns.length > 0
            ? completedRuns.reduce((sum, r) => sum + (r.duration_seconds || 0), 0) / completedRuns.length
            : 0;

          const completionRate = totalPlays > 0 ? (completed / totalPlays) * 100 : 0;

          const playsLast7Days = allRuns?.filter(r => r.started_at >= sevenDaysAgo).length || 0;
          const playsLast30Days = allRuns?.filter(r => r.started_at >= thirtyDaysAgo).length || 0;

          return {
            quizId: qs.id,
            quizName: qs.title,
            subject: topicData?.subject || 'Unknown',
            difficulty: qs.difficulty || 'medium',
            questionCount: qs.question_count || 0,
            totalPlays,
            completed,
            avgScore: Math.round(avgScore),
            avgTime: Math.round(avgTime),
            uniqueStudents,
            completionRate: Math.round(completionRate),
            playsLast7Days,
            playsLast30Days
          };
        })
      );

      setQuizData(quizStats.sort((a, b) => b.totalPlays - a.totalPlays));
    } catch (err) {
      console.error('Failed to load quiz data:', err);
    } finally {
      setLoading(false);
    }
  }

  function downloadCSV() {
    setExportLoading(true);
    try {
      const headers = [
        'Quiz Name',
        'Subject',
        'Difficulty',
        'Questions',
        'Total Plays',
        'Completed',
        'Completion Rate (%)',
        'Unique Students',
        'Avg Score (%)',
        'Avg Time (s)',
        'Plays Last 7 Days',
        'Plays Last 30 Days'
      ];

      const rows = quizData.map(q => [
        q.quizName,
        q.subject,
        q.difficulty,
        q.questionCount.toString(),
        q.totalPlays.toString(),
        q.completed.toString(),
        q.completionRate.toString(),
        q.uniqueStudents.toString(),
        q.avgScore.toString(),
        q.avgTime.toString(),
        q.playsLast7Days.toString(),
        q.playsLast30Days.toString()
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `quiz-performance-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to generate CSV:', err);
      alert('Failed to generate CSV');
    } finally {
      setExportLoading(false);
    }
  }

  function downloadWeeklySummary() {
    setExportLoading(true);
    try {
      const headers = [
        'Quiz Name',
        'Subject',
        'Plays Last 7 Days',
        'Plays Last 30 Days',
        'Total Plays',
        'Avg Score (%)',
        'Completion Rate (%)'
      ];

      const rows = quizData.map(q => [
        q.quizName,
        q.subject,
        q.playsLast7Days.toString(),
        q.playsLast30Days.toString(),
        q.totalPlays.toString(),
        q.avgScore.toString(),
        q.completionRate.toString()
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `weekly-summary-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to generate CSV:', err);
      alert('Failed to generate CSV');
    } finally {
      setExportLoading(false);
    }
  }

  const filteredData = quizData.map(q => {
    const displayPlays = selectedPeriod === '7days' ? q.playsLast7Days :
                        selectedPeriod === '30days' ? q.playsLast30Days :
                        q.totalPlays;
    return { ...q, displayPlays };
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const totalStats = quizData.reduce((acc, q) => ({
    totalPlays: acc.totalPlays + q.totalPlays,
    totalStudents: acc.totalStudents + q.uniqueStudents,
    totalCompleted: acc.totalCompleted + q.completed,
    avgCompletionRate: acc.avgCompletionRate + q.completionRate
  }), { totalPlays: 0, totalStudents: 0, totalCompleted: 0, avgCompletionRate: 0 });

  const overallCompletionRate = quizData.length > 0 ? Math.round(totalStats.avgCompletionRate / quizData.length) : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-1">Comprehensive quiz performance analytics</p>
        </div>
      </div>

      {quizData.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Data Available</h3>
          <p className="text-gray-600">Create and publish quizzes to generate reports</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Plays</p>
                  <p className="text-2xl font-bold text-gray-900">{totalStats.totalPlays}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Unique Students</p>
                  <p className="text-2xl font-bold text-gray-900">{totalStats.totalStudents}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Completed</p>
                  <p className="text-2xl font-bold text-gray-900">{totalStats.totalCompleted}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Completion Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{overallCompletionRate}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Quiz Performance</h3>
                  <p className="text-sm text-gray-600">Detailed breakdown by quiz</p>
                </div>
              </div>
              <button
                onClick={downloadCSV}
                disabled={exportLoading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {exportLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4" />
                )}
                Export CSV
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Weekly Summary</h3>
                  <p className="text-sm text-gray-600">Activity overview</p>
                </div>
              </div>
              <button
                onClick={downloadWeeklySummary}
                disabled={exportLoading}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {exportLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4" />
                )}
                Export CSV
              </button>
            </div>
          </div>

          {/* Period Filter */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Quiz Performance Data</h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Period:</span>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value as any)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Time</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Quiz Name</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Subject</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Plays</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Students</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Completed</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Completion</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Avg Score</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Avg Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((quiz, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm">
                        <div className="font-medium text-gray-900">{quiz.quizName}</div>
                        <div className="text-xs text-gray-500 capitalize">{quiz.difficulty} • {quiz.questionCount} questions</div>
                      </td>
                      <td className="py-3 px-4 text-sm text-center">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                          {quiz.subject}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-center font-medium text-gray-900">{quiz.displayPlays}</td>
                      <td className="py-3 px-4 text-sm text-center text-gray-900">{quiz.uniqueStudents}</td>
                      <td className="py-3 px-4 text-sm text-center text-gray-900">{quiz.completed}</td>
                      <td className="py-3 px-4 text-sm text-center">
                        <span className={`font-medium ${
                          quiz.completionRate >= 80 ? 'text-green-600' :
                          quiz.completionRate >= 50 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {quiz.completionRate}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-center">
                        <span className={`font-medium ${
                          quiz.avgScore >= 80 ? 'text-green-600' :
                          quiz.avgScore >= 60 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {quiz.avgScore}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-center text-gray-900">
                        <div className="flex items-center justify-center gap-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          {quiz.avgTime}s
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Insights */}
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Performance Insights
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="text-sm text-gray-700 space-y-2">
                <p className="font-medium text-gray-900">Engagement Metrics:</p>
                <ul className="space-y-1">
                  <li>• Total quiz attempts across all quizzes: <strong>{totalStats.totalPlays}</strong></li>
                  <li>• Unique students engaged: <strong>{totalStats.totalStudents}</strong></li>
                  <li>• Overall completion rate: <strong>{overallCompletionRate}%</strong></li>
                </ul>
              </div>
              <div className="text-sm text-gray-700 space-y-2">
                <p className="font-medium text-gray-900">Export Features:</p>
                <ul className="space-y-1">
                  <li>• Export comprehensive performance data to CSV</li>
                  <li>• Download weekly activity summaries</li>
                  <li>• Filter data by time period (7/30 days)</li>
                  <li>• Track individual quiz performance trends</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

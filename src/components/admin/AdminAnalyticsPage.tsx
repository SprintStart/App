import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Users, School, Award, Calendar } from 'lucide-react';
import { getAdminPlatformStats, getAdminPlaysByMonth, getTopQuizzesByPlays, getSchoolActivityRankings, getMonthlyDrilldown } from '../../lib/analytics';

interface PlatformStats {
  total_plays: number;
  plays_this_month: number;
  plays_last_month: number;
  month_growth_pct: number;
  active_schools: number;
  active_quizzes: number;
  avg_score: number;
}

interface MonthlyData {
  month: string;
  month_name: string;
  plays: number;
  completions: number;
  completion_rate: number;
  avg_score: number;
}

interface TopQuiz {
  quiz_title: string;
  school_name: string;
  plays: number;
  completion_rate: number;
  teacher_email: string;
}

interface SchoolActivity {
  school_name: string;
  total_plays: number;
  active_quizzes: number;
  active_teachers: number;
  avg_score: number;
}

export function AdminAnalyticsPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [topQuizzes, setTopQuizzes] = useState<TopQuiz[]>([]);
  const [schoolActivity, setSchoolActivity] = useState<SchoolActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [drilldownData, setDrilldownData] = useState<any[]>([]);
  const [loadingDrilldown, setLoadingDrilldown] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);
    try {
      const [statsData, monthlyResult, quizzesData, schoolsData] = await Promise.all([
        getAdminPlatformStats(),
        getAdminPlaysByMonth(12),
        getTopQuizzesByPlays(10),
        getSchoolActivityRankings(10),
      ]);

      setStats(statsData);
      setMonthlyData(Array.isArray(monthlyResult) ? monthlyResult : []);
      setTopQuizzes(Array.isArray(quizzesData) ? quizzesData : []);
      setSchoolActivity(Array.isArray(schoolsData) ? schoolsData : []);
    } catch (error) {
      console.error('[Admin Analytics] Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleMonthClick(monthStr: string) {
    const [year, month] = monthStr.split('-').map(Number);
    setSelectedMonth(monthStr);
    setLoadingDrilldown(true);

    try {
      const data = await getMonthlyDrilldown(year, month);
      setDrilldownData(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('[Admin Analytics] Failed to load drilldown:', error);
    } finally {
      setLoadingDrilldown(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3 mb-3">
          <BarChart3 className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Platform Analytics</h1>
        </div>
        <p className="text-blue-100">System-wide quiz engagement and performance metrics</p>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-600">Total Plays</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{stats.total_plays.toLocaleString()}</div>
            <div className="text-sm text-gray-500 mt-1">All time</div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-sm font-medium text-gray-600">This Month</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{stats.plays_this_month.toLocaleString()}</div>
            <div className={`text-sm mt-1 flex items-center gap-1 ${stats.month_growth_pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {stats.month_growth_pct >= 0 ? '↑' : '↓'} {Math.abs(stats.month_growth_pct).toFixed(1)}% vs last month
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <School className="w-6 h-6 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-gray-600">Active Schools</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{stats.active_schools}</div>
            <div className="text-sm text-gray-500 mt-1">Last 30 days</div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Award className="w-6 h-6 text-orange-600" />
              </div>
              <span className="text-sm font-medium text-gray-600">Avg Score</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{stats.avg_score.toFixed(0)}%</div>
            <div className="text-sm text-gray-500 mt-1">Platform average</div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Calendar className="w-5 h-5 text-gray-600" />
          <h2 className="text-xl font-semibold text-gray-900">Monthly Plays Trend</h2>
          <span className="text-sm text-gray-500 ml-auto">Click a month for details</span>
        </div>

        {monthlyData.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-end gap-2 h-64">
              {monthlyData.map((month, i) => {
                const maxPlays = Math.max(...monthlyData.map(m => m.plays));
                const height = maxPlays > 0 ? (month.plays / maxPlays) * 100 : 0;
                const isSelected = selectedMonth === month.month;

                return (
                  <button
                    key={i}
                    onClick={() => handleMonthClick(month.month)}
                    className="flex-1 flex flex-col items-center gap-2 group"
                  >
                    <div
                      className={`w-full rounded-t transition-all ${
                        isSelected
                          ? 'bg-blue-700'
                          : 'bg-blue-600 group-hover:bg-blue-700'
                      }`}
                      style={{ height: `${height}%`, minHeight: month.plays > 0 ? '8px' : '0' }}
                      title={`${month.month_name}: ${month.plays.toLocaleString()} plays`}
                    />
                    <div className="text-xs text-gray-600 font-medium text-center">
                      {month.month_name}
                    </div>
                    <div className="text-sm font-semibold text-gray-900">
                      {month.plays.toLocaleString()}
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedMonth && !loadingDrilldown && drilldownData.length > 0 && (
              <div className="border-t border-gray-200 pt-6 mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Daily Breakdown - {monthlyData.find(m => m.month === selectedMonth)?.month_name}
                </h3>
                <div className="grid grid-cols-7 gap-2">
                  {drilldownData.map((day, i) => (
                    <div key={i} className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs text-gray-600 mb-1">{new Date(day.date).getDate()}</div>
                      <div className="text-lg font-bold text-gray-900">{day.plays}</div>
                      <div className="text-xs text-gray-500">{day.completions} completed</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            No monthly data available yet
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900">Top 10 Quizzes by Plays</h2>
          </div>

          {topQuizzes.length > 0 ? (
            <div className="space-y-3">
              {topQuizzes.map((quiz, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{quiz.quiz_title}</div>
                    <div className="text-sm text-gray-500">
                      {quiz.school_name} • {quiz.teacher_email}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-bold text-gray-900">{quiz.plays}</div>
                    <div className="text-xs text-gray-500">{quiz.completion_rate.toFixed(0)}% complete</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">No quiz data available</div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <School className="w-5 h-5 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900">Top Schools by Activity</h2>
          </div>

          {schoolActivity.length > 0 ? (
            <div className="space-y-3">
              {schoolActivity.map((school, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{school.school_name}</div>
                    <div className="text-sm text-gray-500">
                      {school.active_quizzes} quizzes • {school.active_teachers} teachers
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-bold text-gray-900">{school.total_plays}</div>
                    <div className="text-xs text-gray-500">{school.avg_score.toFixed(0)}% avg</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">No school data available</div>
          )}
        </div>
      </div>
    </div>
  );
}

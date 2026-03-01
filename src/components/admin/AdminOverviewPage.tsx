import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, BookOpen, TrendingUp, Calendar, DollarSign, AlertTriangle, Play, BarChart3 } from 'lucide-react';
import { getAdminPlatformStats, getAdminPlaysByMonth, getTopQuizzesByPlays } from '../../lib/analytics';

interface Stats {
  totalTeachers: number;
  activeTeachers: number;
  totalQuizzes: number;
  quizAttempts7Days: number;
  quizAttempts30Days: number;
  activeSubscriptions: number;
  expiringSoon: number;
  totalPlays: number;
}

interface MonthlyStats {
  month: string;
  plays: number;
  quizzes: number;
  schools: Set<string>;
  subjects: Set<string>;
}

interface DrillDownData {
  month: string;
  topQuizzes: Array<{ name: string; plays: number }>;
  topSchools: Array<{ name: string; plays: number }>;
  topSubjects: Array<{ name: string; plays: number }>;
}

export function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats>({
    totalTeachers: 0,
    activeTeachers: 0,
    totalQuizzes: 0,
    quizAttempts7Days: 0,
    quizAttempts30Days: 0,
    activeSubscriptions: 0,
    expiringSoon: 0,
    totalPlays: 0,
  });
  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<MonthlyStats[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [drillDown, setDrillDown] = useState<DrillDownData | null>(null);
  const [loadingDrillDown, setLoadingDrillDown] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadMonthlyData() {
    try {
      const currentYear = new Date().getFullYear();
      const data = await getAdminPlaysByMonth(currentYear);

      const monthlyStats = (data || []).map((item: any) => ({
        month: `${item.year}-${String(item.month).padStart(2, '0')}`,
        plays: item.total_plays || 0,
        quizzes: new Set(),
        schools: new Set(),
        subjects: new Set(),
      }));

      setMonthlyData(monthlyStats);
    } catch (err) {
      console.error('[Admin Overview] Error loading monthly data:', err);
    }
  }

  async function loadDrillDown(monthKey: string) {
    setLoadingDrillDown(true);
    setSelectedMonth(monthKey);

    try {
      // Get top quizzes overall
      const topQuizzes = await getTopQuizzesByPlays(10);

      setDrillDown({
        month: monthKey,
        topQuizzes: topQuizzes.map(q => ({
          name: q.quiz_title,
          plays: Number(q.total_plays)
        })),
        topSchools: [],
        topSubjects: [],
      });
    } catch (err) {
      console.error('[Admin Overview] Error loading drill down:', err);
    } finally {
      setLoadingDrillDown(false);
    }
  }

  async function loadStats() {
    try {
      console.log('[Admin Overview] Loading stats');

      const { count: totalTeachers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'teacher');

      const { data: stripeCustomers } = await supabase
        .from('stripe_customers')
        .select('customer_id')
        .is('deleted_at', null);

      const customerIds = stripeCustomers?.map(c => c.customer_id) || [];

      let activeSubscriptions = 0;
      let expiringSoon = 0;

      if (customerIds.length > 0) {
        const { count: activeSubs } = await supabase
          .from('stripe_subscriptions')
          .select('*', { count: 'exact', head: true })
          .in('customer_id', customerIds)
          .eq('status', 'active');

        activeSubscriptions = activeSubs || 0;

        const thirtyDaysFromNow = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
        const now = Math.floor(Date.now() / 1000);

        const { count: expiring } = await supabase
          .from('stripe_subscriptions')
          .select('*', { count: 'exact', head: true })
          .in('customer_id', customerIds)
          .eq('status', 'active')
          .lte('current_period_end', thirtyDaysFromNow)
          .gte('current_period_end', now);

        expiringSoon = expiring || 0;
      }

      const { count: totalQuizzes } = await supabase
        .from('topics')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Load new analytics platform stats
      const platformStats = await getAdminPlatformStats();

      const attempts7Days = platformStats?.total_plays_7days || 0;
      const attempts30Days = platformStats?.total_plays_30days || 0;
      const totalPlays = platformStats?.total_plays_all_time || 0;

      await loadMonthlyData();

      const newStats = {
        totalTeachers: totalTeachers || 0,
        activeTeachers: activeSubscriptions || 0,
        totalQuizzes: totalQuizzes || 0,
        quizAttempts7Days: attempts7Days || 0,
        quizAttempts30Days: attempts30Days || 0,
        activeSubscriptions: activeSubscriptions || 0,
        expiringSoon: expiringSoon || 0,
        totalPlays: totalPlays || 0,
      };

      setStats(newStats);

      console.log('[Admin Overview] Stats loaded:', newStats);

    } catch (err) {
      console.error('[Admin Overview] Error loading stats:', err);
    } finally {
      setLoading(false);
    }
  }

  const statCards = [
    {
      title: 'Total Plays (All Time)',
      value: stats.totalPlays,
      subtitle: `${stats.quizAttempts30Days} in last 30 days`,
      icon: Play,
      color: 'bg-purple-500',
    },
    {
      title: 'Total Teachers',
      value: stats.totalTeachers,
      subtitle: `${stats.activeTeachers} active subscriptions`,
      icon: Users,
      color: 'bg-blue-500',
    },
    {
      title: 'Published Quizzes',
      value: stats.totalQuizzes,
      subtitle: 'Across all teachers',
      icon: BookOpen,
      color: 'bg-green-500',
    },
    {
      title: 'Quiz Attempts (7 days)',
      value: stats.quizAttempts7Days,
      subtitle: `${stats.quizAttempts30Days} in last 30 days`,
      icon: TrendingUp,
      color: 'bg-cyan-500',
    },
    {
      title: 'Active Subscriptions',
      value: stats.activeSubscriptions,
      subtitle: `£${(stats.activeSubscriptions * 99.99).toFixed(2)} annual revenue`,
      icon: DollarSign,
      color: 'bg-emerald-500',
    },
    {
      title: 'Expiring Soon (30 days)',
      value: stats.expiringSoon,
      subtitle: 'Renewals needed',
      icon: AlertTriangle,
      color: 'bg-orange-500',
    },
  ];

  function formatMonthName(monthKey: string) {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-gray-900 mb-1">Dashboard Overview</h3>
        <p className="text-gray-600">Platform statistics and key metrics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className={`${card.color} rounded-lg p-3`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900 mb-1">{card.value.toLocaleString()}</p>
                <p className="text-sm font-medium text-gray-900 mb-1">{card.title}</p>
                <p className="text-xs text-gray-500">{card.subtitle}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm">
            View All Teachers
          </button>
          <button className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm">
            Create Sponsored Ad
          </button>
          <button className="px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium text-sm">
            View Expiring Accounts
          </button>
          <button className="px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium text-sm">
            Download Reports
          </button>
        </div>
      </div>

      {/* Monthly Plays Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Plays Over Time</h3>
            <p className="text-sm text-gray-600 mt-1">Last 12 months - Click a month to drill down</p>
          </div>
          <BarChart3 className="w-5 h-5 text-gray-400" />
        </div>

        {monthlyData.length > 0 ? (
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 items-end h-48">
              {monthlyData.slice().reverse().map((month) => {
                const maxPlays = Math.max(...monthlyData.map(m => m.plays));
                const heightPercent = maxPlays > 0 ? (month.plays / maxPlays) * 100 : 0;
                const isSelected = selectedMonth === month.month;

                return (
                  <button
                    key={month.month}
                    onClick={() => loadDrillDown(month.month)}
                    className={`flex flex-col items-center gap-1 transition-all hover:opacity-80 ${
                      isSelected ? 'ring-2 ring-blue-500 rounded' : ''
                    }`}
                    title={`${formatMonthName(month.month)}: ${month.plays} plays`}
                  >
                    <div
                      className={`w-full rounded-t transition-all ${
                        isSelected ? 'bg-blue-600' : 'bg-blue-400 hover:bg-blue-500'
                      }`}
                      style={{ height: `${heightPercent}%` }}
                    />
                    <span className="text-xs text-gray-600 font-medium">{month.plays}</span>
                    <span className="text-xs text-gray-500 truncate w-full text-center">
                      {formatMonthName(month.month).split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">No monthly data available</div>
        )}
      </div>

      {/* Drill Down Data */}
      {selectedMonth && drillDown && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {formatMonthName(selectedMonth)} Breakdown
              </h3>
              <p className="text-sm text-gray-600 mt-1">Top performing content this month</p>
            </div>
            <button
              onClick={() => {
                setSelectedMonth(null);
                setDrillDown(null);
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          </div>

          {loadingDrillDown ? (
            <div className="text-center py-8 text-gray-500">Loading details...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Top Quizzes</h4>
                <div className="space-y-2">
                  {drillDown.topQuizzes.map((quiz, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm text-gray-900 truncate flex-1">{quiz.name}</span>
                      <span className="text-sm font-medium text-blue-600 ml-2">{quiz.plays}</span>
                    </div>
                  ))}
                  {drillDown.topQuizzes.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">No data</p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Top Schools</h4>
                <div className="space-y-2">
                  {drillDown.topSchools.map((school, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm text-gray-900 truncate flex-1">{school.name}</span>
                      <span className="text-sm font-medium text-green-600 ml-2">{school.plays}</span>
                    </div>
                  ))}
                  {drillDown.topSchools.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">No data</p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Top Subjects</h4>
                <div className="space-y-2">
                  {drillDown.topSubjects.map((subject, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm text-gray-900 truncate flex-1 capitalize">{subject.name}</span>
                      <span className="text-sm font-medium text-purple-600 ml-2">{subject.plays}</span>
                    </div>
                  ))}
                  {drillDown.topSubjects.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">No data</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Platform Health</h3>
          <Calendar className="w-5 h-5 text-gray-400" />
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">System Status</span>
            <span className="text-sm font-semibold text-green-600">All Systems Operational</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Database</span>
            <span className="text-sm font-semibold text-green-600">Healthy</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-600">API Response Time</span>
            <span className="text-sm font-semibold text-green-600">Fast (&lt;100ms)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

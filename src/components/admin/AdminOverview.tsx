import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Users,
  FileText,
  Play,
  CheckCircle,
  DollarSign,
  Megaphone,
  AlertTriangle,
  Loader2,
  TrendingUp,
} from 'lucide-react';

interface DashboardStats {
  totalTeachers: number;
  activeTeachers: number;
  expiredTeachers: number;
  suspendedTeachers: number;
  totalPublishedQuizzes: number;
  totalPlays: number;
  playsLast7Days: number;
  playsLast30Days: number;
  averageCompletionRate: number;
  activeSponsorAds: number;
}

interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
}

export function AdminOverview() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('status, current_period_end');

      const totalTeachers = subscriptions?.length || 0;
      const activeTeachers =
        subscriptions?.filter((s) => s.status === 'active' || s.status === 'trialing').length || 0;
      const expiredTeachers =
        subscriptions?.filter((s) => s.status === 'expired' || s.status === 'canceled').length || 0;
      const suspendedTeachers = 0;

      const expiringTeachers =
        subscriptions?.filter(
          (s) =>
            s.status === 'active' &&
            s.current_period_end &&
            new Date(s.current_period_end) <= fourteenDaysFromNow &&
            new Date(s.current_period_end) > now
        ).length || 0;

      const { data: quizzes } = await supabase
        .from('question_sets')
        .select('id, is_published');

      const totalPublishedQuizzes = quizzes?.filter((q) => q.is_published).length || 0;

      const { count: totalPlaysCount } = await supabase
        .from('public_quiz_runs')
        .select('*', { count: 'exact', head: true });

      const totalPlays = totalPlaysCount || 0;

      const { count: completedCount } = await supabase
        .from('public_quiz_runs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');

      const totalCompletions = completedCount || 0;
      const averageCompletionRate =
        totalPlays > 0 ? Math.round((totalCompletions / totalPlays) * 100) : 0;

      const { count: last7DaysCount } = await supabase
        .from('public_quiz_runs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo.toISOString());

      const playsLast7Days = last7DaysCount || 0;

      const { count: last30DaysCount } = await supabase
        .from('public_quiz_runs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo.toISOString());

      const playsLast30Days = last30DaysCount || 0;

      const { data: sponsors } = await supabase
        .from('sponsor_ads')
        .select('id')
        .eq('is_active', true);

      const activeSponsorAds = sponsors?.length || 0;

      setStats({
        totalTeachers,
        activeTeachers,
        expiredTeachers,
        suspendedTeachers,
        totalPublishedQuizzes,
        totalPlays,
        playsLast7Days,
        playsLast30Days,
        averageCompletionRate,
        activeSponsorAds,
      });

      const alertList: Alert[] = [];

      if (expiringTeachers > 0) {
        alertList.push({
          id: 'expiring',
          type: 'warning',
          message: `${expiringTeachers} teacher subscription(s) expiring in the next 14 days`,
        });
      }

      setAlerts(alertList);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  if (!stats) {
    return <div className="text-center py-8 text-gray-600">Failed to load dashboard data</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>

      {alerts.length > 0 && (
        <div className="mb-6 space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-lg border flex items-start gap-3 ${
                alert.type === 'warning'
                  ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                  : alert.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}
            >
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="text-sm font-medium">{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Teachers</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalTeachers}</p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.activeTeachers} active, {stats.expiredTeachers} expired
              </p>
            </div>
            <Users className="w-10 h-10 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Published Quizzes</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalPublishedQuizzes}</p>
              <p className="text-xs text-gray-500 mt-1">across platform</p>
            </div>
            <FileText className="w-10 h-10 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Plays</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalPlays}</p>
              <p className="text-xs text-gray-500 mt-1">{stats.playsLast7Days} last 7 days</p>
            </div>
            <Play className="w-10 h-10 text-purple-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Completion Rate</p>
              <p className="text-3xl font-bold text-gray-900">{stats.averageCompletionRate}%</p>
              <p className="text-xs text-gray-500 mt-1">platform average</p>
            </div>
            <CheckCircle className="w-10 h-10 text-yellow-600" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Platform Activity
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Last 7 Days</span>
              <span className="text-2xl font-bold text-blue-600">{stats.playsLast7Days}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Last 30 Days</span>
              <span className="text-2xl font-bold text-blue-600">{stats.playsLast30Days}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-purple-600" />
            Platform Status
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Active Sponsors</span>
              <span className="text-2xl font-bold text-purple-600">{stats.activeSponsorAds}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Suspended Teachers</span>
              <span className="text-2xl font-bold text-red-600">{stats.suspendedTeachers}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

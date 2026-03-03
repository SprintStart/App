import { useLocation } from 'react-router-dom';
import { AdminProtectedRoute } from '../components/auth/AdminProtectedRoute';
import { AdminDashboardLayout } from '../components/admin/AdminDashboardLayout';
import { AdminOverviewPage } from '../components/admin/AdminOverviewPage';
import { AdminAnalyticsPage } from '../components/admin/AdminAnalyticsPage';
import { AdminFeedbackPage } from '../components/admin/AdminFeedbackPage';
import { AdminTeachersPage } from '../components/admin/AdminTeachersPage';
import { SystemHealthPage } from '../components/admin/SystemHealthPage';
import { SponsorBannersPageV2 } from '../components/admin/SponsorBannersPageV2';
import { SubscriptionsPage } from '../components/admin/SubscriptionsPage';
import { ContentManagement } from '../components/admin/ContentManagement';
import { DataIntegrityPage } from '../components/admin/DataIntegrityPage';
import AdminSchoolsPage from '../components/admin/AdminSchoolsPage';
import AdminSubjectsTopicsPage from '../components/admin/AdminSubjectsTopicsPage';
import SupportInboxPage from '../components/admin/SupportInboxPage';
import { LowBandwidthSettings } from '../components/admin/LowBandwidthSettings';
import TokenSettingsPanel from '../components/admin/TokenSettingsPanel';
import { FEATURE_TOKENS } from '../lib/featureFlags';

export function AdminDashboard() {
  const location = useLocation();
  const currentPath = location.pathname.split('/').pop() || 'overview';

  const getCurrentView = () => {
    if (location.pathname === '/admindashboard') return 'overview';
    return currentPath;
  };

  const currentView = getCurrentView();

  return (
    <AdminProtectedRoute>
      <AdminDashboardLayout currentView={currentView}>
        {(currentView === 'overview' || currentView === 'admindashboard') && <AdminOverviewPage />}
        {currentView === 'analytics' && <AdminAnalyticsPage />}
        {currentView === 'feedback' && <AdminFeedbackPage />}
        {currentView === 'system-health' && <SystemHealthPage />}
        {currentView === 'data-integrity' && <DataIntegrityPage />}
        {currentView === 'teachers' && <AdminTeachersPage />}
        {currentView === 'quizzes' && <ContentManagement />}
        {currentView === 'subjects' && <AdminSubjectsTopicsPage />}
        {currentView === 'subscriptions' && <SubscriptionsPage />}
        {currentView === 'sponsors' && <SponsorBannersPageV2 />}
        {currentView === 'schools' && <AdminSchoolsPage />}
        {currentView === 'support' && <SupportInboxPage />}
        {currentView === 'reports' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Reports & Analytics</h3>
            <p className="text-gray-600 mb-6">Automated weekly reports and platform insights</p>

            <div className="grid gap-6 mt-6">
              <div className="border border-gray-200 rounded-lg p-6">
                <h4 className="font-semibold text-gray-900 mb-2">Weekly Teacher Reports</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Automated weekly performance reports sent to all teachers every Monday at 9 AM.
                  Includes quiz plays, student engagement, completion rates, and recommendations.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      const response = await fetch(
                        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/weekly-teacher-report`,
                        {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                          },
                        }
                      );
                      const data = await response.json();
                      alert(`Generated ${data.reports_generated} reports, sent ${data.emails_sent} emails`);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Run Test Report Now
                  </button>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-6">
                <h4 className="font-semibold text-gray-900 mb-2">Weekly Sponsor Reports</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Automated weekly ad performance reports sent to all active sponsors.
                  Includes impressions, clicks, CTR, top placements, and daily breakdowns.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      const response = await fetch(
                        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/weekly-sponsor-report`,
                        {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                          },
                        }
                      );
                      const data = await response.json();
                      alert(`Generated ${data.reports_generated} reports, sent ${data.emails_sent} emails`);
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    Run Test Report Now
                  </button>
                </div>
              </div>

              <div className="border border-blue-200 bg-blue-50 rounded-lg p-6">
                <h4 className="font-semibold text-blue-900 mb-2">Scheduling Information</h4>
                <p className="text-sm text-blue-700">
                  To enable automatic weekly scheduling, configure a cron job in Supabase:
                  <code className="block mt-2 p-2 bg-white rounded border border-blue-200 text-xs font-mono">
                    0 9 * * 1 # Every Monday at 9:00 AM
                  </code>
                </p>
              </div>
            </div>
          </div>
        )}
        {currentView === 'audit' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Audit Logs</h3>
            <p className="text-gray-600 mb-6">View all admin actions and security events</p>
            <div className="text-center py-12 text-gray-500">
              Audit logs viewer interface - Coming soon
              <br />
              <span className="text-sm">Logs are being recorded to audit_logs table</span>
            </div>
          </div>
        )}
        {currentView === 'settings' && (
          <div className="space-y-6">
            <LowBandwidthSettings />
            {FEATURE_TOKENS && <TokenSettingsPanel />}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Other Settings</h3>
              <p className="text-gray-600 mb-6">Additional platform configuration and preferences</p>
              <div className="text-center py-12 text-gray-500">
                Additional settings - Coming soon
              </div>
            </div>
          </div>
        )}
      </AdminDashboardLayout>
    </AdminProtectedRoute>
  );
}

import { useState, useEffect } from 'react';
import { Activity, AlertCircle, CheckCircle, Clock, RefreshCw, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface HealthCheckStatus {
  check_name: string;
  last_run: string;
  last_success: string | null;
  last_error: string | null;
  status: 'success' | 'failure' | 'warning';
  http_status: number | null;
  response_time_ms: number;
}

interface RecentAlert {
  id: string;
  check_name: string;
  alert_type: string;
  failure_count: number;
  sent_at: string;
  resolved_at: string | null;
}

const CHECK_LABELS: Record<string, string> = {
  explore_page: 'Homepage /explore',
  northampton_college_wall: 'School Wall /northampton-college',
  business_subject_page: 'Subject Page /subjects/business',
  quiz_page_load: 'Quiz Page Load',
  quiz_start_api: 'Quiz Start API'
};

export function SystemHealthPage() {
  const [healthStatus, setHealthStatus] = useState<HealthCheckStatus[]>([]);
  const [alerts, setAlerts] = useState<RecentAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [runningCheck, setRunningCheck] = useState(false);

  async function loadHealthStatus() {
    setLoading(true);
    try {
      console.log('[System Health] Loading health status');

      const { data, error } = await supabase.rpc('get_latest_health_status');

      if (error) {
        console.error('[System Health] Error loading status:', error);
      } else {
        console.log('[System Health] Loaded status:', data);
        setHealthStatus(data || []);
      }

      // Load recent unresolved alerts
      const { data: alertsData, error: alertsError } = await supabase
        .from('health_alerts')
        .select('*')
        .is('resolved_at', null)
        .order('sent_at', { ascending: false })
        .limit(10);

      if (!alertsError) {
        setAlerts(alertsData || []);
      }
    } catch (error) {
      console.error('[System Health] Error loading health status:', error);
    } finally {
      setLoading(false);
    }
  }

  async function runHealthCheck() {
    setRunningCheck(true);
    try {
      console.log('[System Health] Running health check');

      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        console.error('[System Health] No active admin session');
        alert('You must be logged in as an admin to run health checks.');
        return;
      }

      const response = await fetch(
        'https://quhugpgfrnzvqugwibfp.supabase.co/functions/v1/run-health-checks',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.ok) {
        console.log('[System Health] Health check completed');
        await loadHealthStatus();
      } else {
        const errorText = await response.text();
        console.error('[System Health] Health check failed:', errorText);
        alert(`Health check failed: ${errorText}`);
      }
    } catch (error) {
      console.error('[System Health] Error running health check:', error);
      alert(`Error running health check: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRunningCheck(false);
    }
  }

  async function clearOldAlerts() {
    try {
      console.log('[System Health] Clearing old alerts');

      const { error } = await supabase
        .from('health_alerts')
        .update({ resolved_at: new Date().toISOString() })
        .is('resolved_at', null);

      if (error) {
        console.error('[System Health] Error clearing alerts:', error);
        alert('Failed to clear alerts. Please try again.');
      } else {
        console.log('[System Health] Alerts cleared successfully');
        await loadHealthStatus();
      }
    } catch (error) {
      console.error('[System Health] Error clearing alerts:', error);
      alert('Failed to clear alerts. Please try again.');
    }
  }

  useEffect(() => {
    loadHealthStatus();
    // Auto-refresh every 60 seconds
    const interval = setInterval(loadHealthStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const allPassing = healthStatus.length > 0 && healthStatus.every(check => check.status === 'success');
  const hasFailures = healthStatus.some(check => check.status === 'failure');

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">System Health Monitoring</h3>
            <p className="text-gray-600 mt-1">P0 critical path monitoring</p>
          </div>
          <button
            onClick={runHealthCheck}
            disabled={runningCheck}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${runningCheck ? 'animate-spin' : ''}`} />
            Run Check Now
          </button>
        </div>

        {alerts.length > 0 && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <h4 className="font-semibold text-red-900">Active Alerts ({alerts.length})</h4>
              </div>
              <button
                onClick={clearOldAlerts}
                className="text-sm px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Clear All Alerts
              </button>
            </div>
            <div className="space-y-2">
              {alerts.map(alert => (
                <div key={alert.id} className="text-sm text-red-800">
                  <span className="font-medium">{CHECK_LABELS[alert.check_name] || alert.check_name}</span>
                  {' '}- {alert.failure_count} consecutive failures
                  {' '}(sent {new Date(alert.sent_at).toLocaleString()})
                </div>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
            Loading health checks...
          </div>
        ) : healthStatus.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No health checks recorded yet</p>
            <button
              onClick={runHealthCheck}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Run your first health check
            </button>
          </div>
        ) : (
          <>
            <div className={`mb-6 p-4 rounded-lg border-2 ${
              allPassing
                ? 'border-green-200 bg-green-50'
                : hasFailures
                ? 'border-red-200 bg-red-50'
                : 'border-yellow-200 bg-yellow-50'
            }`}>
              <div className="flex items-center gap-2">
                {allPassing ? (
                  <>
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    <span className="font-semibold text-green-900">All Systems Operational</span>
                  </>
                ) : hasFailures ? (
                  <>
                    <XCircle className="w-6 h-6 text-red-600" />
                    <span className="font-semibold text-red-900">System Issues Detected</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-6 h-6 text-yellow-600" />
                    <span className="font-semibold text-yellow-900">Warnings Present</span>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {healthStatus.map((check) => (
                <div
                  key={check.check_name}
                  className={`p-4 rounded-lg border-2 ${
                    check.status === 'success'
                      ? 'border-green-200 bg-green-50'
                      : check.status === 'warning'
                      ? 'border-yellow-200 bg-yellow-50'
                      : 'border-red-200 bg-red-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {check.status === 'success' ? (
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    ) : check.status === 'warning' ? (
                      <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900">
                        {CHECK_LABELS[check.check_name] || check.check_name}
                      </h4>

                      <div className="mt-2 space-y-1 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Clock className="w-4 h-4 flex-shrink-0" />
                          <span>Last run: {new Date(check.last_run).toLocaleString()}</span>
                        </div>

                        {check.last_success && (
                          <div className="flex items-center gap-2 text-green-700">
                            <CheckCircle className="w-4 h-4 flex-shrink-0" />
                            <span>Last success: {new Date(check.last_success).toLocaleString()}</span>
                          </div>
                        )}

                        {check.response_time_ms > 0 && (
                          <div className="text-gray-600">
                            Response: {check.response_time_ms}ms
                            {check.http_status && ` (HTTP ${check.http_status})`}
                          </div>
                        )}
                      </div>

                      {check.last_error && (
                        <div className="mt-2 text-sm text-red-700 bg-red-100 rounded px-3 py-2 break-words">
                          <span className="font-medium">Error: </span>
                          {check.last_error}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h4 className="font-semibold text-gray-900 mb-4">About Health Monitoring</h4>
        <div className="space-y-2 text-sm text-gray-600">
          <p>Health checks run automatically every 5-10 minutes to monitor critical paths:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li><span className="font-medium">Homepage /explore</span> - Main landing page loads correctly</li>
            <li><span className="font-medium">School Wall</span> - Northampton College wall page accessible</li>
            <li><span className="font-medium">Subject Pages</span> - Business subject page loads</li>
            <li><span className="font-medium">Quiz Pages</span> - Quiz detail pages load correctly</li>
            <li><span className="font-medium">Quiz Start API</span> - Quiz creation works with valid questions</li>
          </ul>
          <p className="mt-4">
            <span className="font-medium">Alert Policy:</span> If any P0 check fails 2 times consecutively,
            automated alerts are sent to support@startsprint.app and leslie.addae@startsprint.app
          </p>
        </div>
      </div>
    </div>
  );
}

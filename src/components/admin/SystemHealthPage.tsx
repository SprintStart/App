import { useState, useEffect } from 'react';
import { Activity, AlertCircle, CheckCircle, Clock, RefreshCw, XCircle, Copy, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { FEATURE_MONITORING_HARDENING } from '../../lib/featureFlags';

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
  severity?: 'critical' | 'warning';
  error_details?: any;
}

interface HealthTrend {
  check_name: string;
  total_runs: number;
  failure_count: number;
  success_count: number;
  avg_response_time_ms: number;
  max_response_time_ms: number;
  last_failure_time: string | null;
  last_failure_message: string | null;
  success_rate: number;
}

const CHECK_LABELS: Record<string, string> = {
  explore_page: 'Homepage /explore',
  global_library_page: 'Global Library /explore/global',
  northampton_college_wall: 'School Wall /northampton-college',
  business_subject_page: 'Business /subjects/business',
  mathematics_subject_page: 'Mathematics /subjects/mathematics',
  gcse_mathematics_exam_page: 'GCSE Math /exams/gcse/mathematics',
  quiz_page_load: 'Quiz Page Load',
  quiz_start_api: 'Quiz Start API'
};

type AlertFilter = 'active_recent' | 'active_all' | 'resolved';

export function SystemHealthPage() {
  const [healthStatus, setHealthStatus] = useState<HealthCheckStatus[]>([]);
  const [alerts, setAlerts] = useState<RecentAlert[]>([]);
  const [trends, setTrends] = useState<HealthTrend[]>([]);
  const [loading, setLoading] = useState(false);
  const [runningCheck, setRunningCheck] = useState(false);
  const [alertFilter, setAlertFilter] = useState<AlertFilter>('active_recent');
  const [copiedDiagnostics, setCopiedDiagnostics] = useState(false);

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

      // Load alerts based on filter
      let alertsQuery = supabase
        .from('health_alerts')
        .select('*')
        .order('sent_at', { ascending: false });

      if (alertFilter === 'active_recent') {
        // Active alerts from last 60 minutes
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        alertsQuery = alertsQuery
          .is('resolved_at', null)
          .gte('last_seen_at', oneHourAgo);
      } else if (alertFilter === 'active_all') {
        // All active alerts
        alertsQuery = alertsQuery.is('resolved_at', null);
      } else if (alertFilter === 'resolved') {
        // Resolved alerts from last 7 days
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        alertsQuery = alertsQuery
          .not('resolved_at', 'is', null)
          .gte('resolved_at', sevenDaysAgo);
      }

      const { data: alertsData, error: alertsError } = await alertsQuery.limit(20);

      if (!alertsError) {
        setAlerts(alertsData || []);
      }

      // Load 24h trends if monitoring hardening is enabled
      if (FEATURE_MONITORING_HARDENING) {
        const { data: trendsData, error: trendsError } = await supabase.rpc('get_24h_health_trends');
        if (!trendsError && trendsData) {
          console.log('[System Health] Loaded 24h trends:', trendsData);
          setTrends(trendsData);
        }
      }
    } catch (error) {
      console.error('[System Health] Error loading health status:', error);
    } finally {
      setLoading(false);
    }
  }

  function copyDiagnostics() {
    const diagnosticsData = {
      timestamp: new Date().toISOString(),
      healthChecks: healthStatus,
      alerts: alerts.filter(a => !a.resolved_at),
      trends24h: trends,
    };

    const diagnosticsJson = JSON.stringify(diagnosticsData, null, 2);
    navigator.clipboard.writeText(diagnosticsJson).then(() => {
      setCopiedDiagnostics(true);
      setTimeout(() => setCopiedDiagnostics(false), 2000);
    });
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

  async function clearAllAlerts() {
    if (!confirm('Clear all active alerts? This will mark them as resolved.')) {
      return;
    }

    try {
      console.log('[System Health] Clearing all active alerts');

      const { data, error } = await supabase.rpc('clear_all_health_alerts');

      if (error) {
        console.error('[System Health] Error clearing alerts:', error);
        alert('Failed to clear alerts. Please try again.');
      } else {
        console.log(`[System Health] Cleared ${data || 0} alerts successfully`);
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
  }, [alertFilter]);

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
          <div className="flex items-center gap-3">
            {FEATURE_MONITORING_HARDENING && (
              <button
                onClick={copyDiagnostics}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Copy className="w-4 h-4" />
                {copiedDiagnostics ? 'Copied!' : 'Copy Diagnostics'}
              </button>
            )}
            <button
              onClick={runHealthCheck}
              disabled={runningCheck}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${runningCheck ? 'animate-spin' : ''}`} />
              Run Check Now
            </button>
          </div>
        </div>

        {/* Alert Filter Toggle */}
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Show:</span>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setAlertFilter('active_recent')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                alertFilter === 'active_recent'
                  ? 'bg-white text-gray-900 font-medium shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Active (60 min)
            </button>
            <button
              onClick={() => setAlertFilter('active_all')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                alertFilter === 'active_all'
                  ? 'bg-white text-gray-900 font-medium shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All Active
            </button>
            <button
              onClick={() => setAlertFilter('resolved')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                alertFilter === 'resolved'
                  ? 'bg-white text-gray-900 font-medium shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Resolved
            </button>
          </div>
        </div>

        {alerts.length > 0 && (
          <div className={`mb-6 p-4 border-2 rounded-lg ${
            alertFilter === 'resolved'
              ? 'bg-gray-50 border-gray-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className={`w-5 h-5 ${
                  alertFilter === 'resolved' ? 'text-gray-600' : 'text-red-600'
                }`} />
                <h4 className={`font-semibold ${
                  alertFilter === 'resolved' ? 'text-gray-900' : 'text-red-900'
                }`}>
                  {alertFilter === 'resolved' ? 'Resolved Alerts' : 'Active Alerts'} ({alerts.length})
                </h4>
              </div>
              {alertFilter !== 'resolved' && (
                <button
                  onClick={clearAllAlerts}
                  className="text-sm px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Clear All Alerts
                </button>
              )}
            </div>
            <div className="space-y-2">
              {alerts.map(alert => (
                <div key={alert.id} className={`text-sm ${
                  alertFilter === 'resolved' ? 'text-gray-700' : 'text-red-800'
                }`}>
                  <span className="font-medium">{CHECK_LABELS[alert.check_name] || alert.check_name}</span>
                  {' '}- {alert.failure_count} consecutive failures
                  {alert.resolved_at && (
                    <span className="text-gray-500">
                      {' '}(resolved {new Date(alert.resolved_at).toLocaleString()})
                    </span>
                  )}
                  {!alert.resolved_at && (
                    <span className="text-gray-600">
                      {' '}(last seen {new Date(alert.sent_at).toLocaleString()})
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {alerts.length === 0 && (
          <div className="mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-lg text-center">
            <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-2" />
            <p className="text-sm text-green-800 font-medium">
              {alertFilter === 'resolved'
                ? 'No resolved alerts in the last 7 days'
                : 'No active alerts'}
            </p>
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

                      {/* 24h Trend Summary */}
                      {FEATURE_MONITORING_HARDENING && trends.length > 0 && (() => {
                        const trend = trends.find(t => t.check_name === check.check_name);
                        if (!trend) return null;

                        return (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="text-xs font-medium text-gray-500 mb-2">Last 24h</div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-gray-500">Runs:</span>
                                <span className="ml-1 font-medium text-gray-900">{trend.total_runs}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Success Rate:</span>
                                <span className={`ml-1 font-medium ${
                                  trend.success_rate >= 99 ? 'text-green-600' :
                                  trend.success_rate >= 95 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                  {trend.success_rate}%
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500">Avg Time:</span>
                                <span className="ml-1 font-medium text-gray-900">
                                  {Math.round(trend.avg_response_time_ms)}ms
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500">Failures:</span>
                                <span className={`ml-1 font-medium ${
                                  trend.failure_count === 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {trend.failure_count}
                                </span>
                              </div>
                            </div>
                            {trend.last_failure_time && (
                              <div className="mt-2 text-xs text-red-600">
                                Last failure: {new Date(trend.last_failure_time).toLocaleString()}
                              </div>
                            )}
                          </div>
                        );
                      })()}
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
          <p>Health checks run automatically every 5-10 minutes to monitor P0 critical routes:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li><span className="font-medium">/explore</span> - Main landing page</li>
            <li><span className="font-medium">/explore/global</span> - Global quiz library</li>
            <li><span className="font-medium">/northampton-college</span> - School wall page</li>
            <li><span className="font-medium">/subjects/business</span> - Business subject page</li>
            <li><span className="font-medium">/subjects/mathematics</span> - Mathematics subject page</li>
            <li><span className="font-medium">/exams/gcse/mathematics</span> - Country/exam listing page</li>
          </ul>
          <p className="mt-4">
            <span className="font-medium">Alert Policy:</span> If any check fails 2 times consecutively,
            automated alerts are sent to <span className="font-mono text-xs">support@startsprint.app</span> and{' '}
            <span className="font-mono text-xs">leslie.addae@startsprint.app</span>
          </p>
          <p className="mt-2">
            <span className="font-medium">Cooldown:</span> Alerts will not repeat for the same check within 6 hours
            to prevent spam.
          </p>
          {FEATURE_MONITORING_HARDENING && (
            <p className="mt-2">
              <span className="font-medium">Performance:</span> Responses slower than 2 seconds are marked as warnings.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

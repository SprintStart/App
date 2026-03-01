import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { AlertTriangle, CheckCircle, RefreshCw, XCircle } from 'lucide-react';

interface IntegrityIssue {
  id: string;
  title: string;
  destination_scope: string;
  school_id: string | null;
  country_code: string | null;
  exam_code: string | null;
  approval_status: string;
  created_at: string;
  integrity_status: string;
}

export function DataIntegrityPage() {
  const [issues, setIssues] = useState<IntegrityIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    ok: 0,
    invalid: 0,
    warnings: 0,
  });

  async function loadIntegrityCheck() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('question_sets_integrity_check')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading integrity check:', error);
        return;
      }

      if (data) {
        setIssues(data);

        // Calculate stats
        const total = data.length;
        const ok = data.filter(d => d.integrity_status === 'OK').length;
        const invalid = data.filter(d => d.integrity_status.startsWith('INVALID')).length;
        const warnings = data.filter(d => d.integrity_status.startsWith('WARNING')).length;

        setStats({ total, ok, invalid, warnings });
      }
    } catch (error) {
      console.error('Error in loadIntegrityCheck:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadIntegrityCheck();
  }, []);

  const getSeverityColor = (status: string) => {
    if (status === 'OK') return 'text-green-600 bg-green-50';
    if (status.startsWith('INVALID')) return 'text-red-600 bg-red-50';
    if (status.startsWith('WARNING')) return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getSeverityIcon = (status: string) => {
    if (status === 'OK') return <CheckCircle className="w-5 h-5 text-green-600" />;
    if (status.startsWith('INVALID')) return <XCircle className="w-5 h-5 text-red-600" />;
    if (status.startsWith('WARNING')) return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    return null;
  };

  const problemIssues = issues.filter(i => i.integrity_status !== 'OK');

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-gray-900">Data Integrity Monitor</h1>
          <button
            onClick={loadIntegrityCheck}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        <p className="text-gray-600">
          Automated checks for destination scope violations, invalid combinations, and quizzes with zero questions.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="text-sm text-gray-600 mb-1">Total Quizzes</div>
          <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="text-sm text-green-700 mb-1">Healthy</div>
          <div className="text-3xl font-bold text-green-700">{stats.ok}</div>
          <div className="text-xs text-green-600 mt-1">
            {stats.total > 0 ? Math.round((stats.ok / stats.total) * 100) : 0}%
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="text-sm text-red-700 mb-1">Invalid</div>
          <div className="text-3xl font-bold text-red-700">{stats.invalid}</div>
          <div className="text-xs text-red-600 mt-1">Requires immediate fix</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="text-sm text-yellow-700 mb-1">Warnings</div>
          <div className="text-3xl font-bold text-yellow-700">{stats.warnings}</div>
          <div className="text-xs text-yellow-600 mt-1">Needs attention</div>
        </div>
      </div>

      {/* System Status */}
      {stats.invalid === 0 && stats.warnings === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <h3 className="text-lg font-semibold text-green-900">All Systems Healthy</h3>
              <p className="text-green-700">No integrity issues detected. All quizzes have valid destination configurations.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-600" />
            <div>
              <h3 className="text-lg font-semibold text-red-900">Issues Detected</h3>
              <p className="text-red-700">
                Found {stats.invalid} invalid configuration{stats.invalid !== 1 ? 's' : ''} and {stats.warnings} warning{stats.warnings !== 1 ? 's' : ''}.
                Please review and fix below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Issues Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : problemIssues.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">
              Issues Requiring Attention ({problemIssues.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quiz Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scope</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">School ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Country/Exam</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issue</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {problemIssues.map((issue) => (
                  <tr key={issue.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getSeverityIcon(issue.integrity_status)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
                        {issue.title}
                      </div>
                      <div className="text-xs text-gray-500">ID: {issue.id.slice(0, 8)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        {issue.destination_scope}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        {issue.school_id ? issue.school_id.slice(0, 8) : '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        {issue.country_code || '—'} / {issue.exam_code || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(issue.integrity_status)}`}>
                        {issue.integrity_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(issue.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Documentation */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">About Destination Scopes</h3>
        <div className="space-y-2 text-sm text-blue-800">
          <div>
            <strong>GLOBAL:</strong> Must have school_id = NULL, country_code = NULL, exam_code = NULL (visible on /explore)
          </div>
          <div>
            <strong>SCHOOL_WALL:</strong> Must have school_id NOT NULL, country_code = NULL, exam_code = NULL (visible on /{'{school_slug}'})
          </div>
          <div>
            <strong>COUNTRY_EXAM:</strong> Must have country_code NOT NULL, exam_code NOT NULL, school_id = NULL (visible on /exams/{'{exam}/{subject}'})
          </div>
        </div>
        <div className="mt-4 text-sm text-blue-700">
          Invalid configurations are blocked by database constraints. This page shows any existing issues that need manual correction.
        </div>
      </div>
    </div>
  );
}

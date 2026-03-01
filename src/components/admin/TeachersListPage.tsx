import { useState, useEffect } from 'react';
import { Search, Filter, UserCheck, UserX, Mail, Eye, AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Teacher {
  id: string;
  email: string;
  full_name: string;
  email_verified: boolean;
  premium_status: boolean;
  premium_source: 'stripe' | 'school_domain' | 'admin_override' | 'none';
  expires_at: string | null;
  status: 'active' | 'expired' | 'inactive';
  created_at: string;
  quiz_count: number;
}

export function TeachersListPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [filteredTeachers, setFilteredTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'inactive'>('all');
  const [premiumFilter, setPremiumFilter] = useState<'all' | 'premium' | 'free'>('all');
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadTeachers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [teachers, searchTerm, statusFilter, premiumFilter]);

  async function loadTeachers() {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No access token available');
      }

      console.log('[Teachers List] Access token length:', session.access_token.length);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-teachers`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Teachers List] Request failed:', response.status, errorData);
        throw new Error(errorData.error || errorData.details || 'Failed to load teachers');
      }

      const data = await response.json();
      console.log('[Teachers List] Teachers loaded:', data.teachers?.length || 0);
      setTeachers(data.teachers || []);
    } catch (err: any) {
      console.error('[Teachers List] Error loading teachers:', err);
      setError(err.message || 'Failed to load teachers');
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    let filtered = [...teachers];

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        t => t.email.toLowerCase().includes(search) || t.full_name.toLowerCase().includes(search)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }

    if (premiumFilter === 'premium') {
      filtered = filtered.filter(t => t.premium_status);
    } else if (premiumFilter === 'free') {
      filtered = filtered.filter(t => !t.premium_status);
    }

    setFilteredTeachers(filtered);
  }

  async function handleSuspend(teacher: Teacher) {
    if (!confirm(`Suspend ${teacher.email}? This will unpublish all their quizzes.`)) {
      return;
    }

    const reason = prompt('Reason for suspension:') || 'No reason provided';

    try {
      setActionLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-suspend-teacher`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ teacher_id: teacher.id, reason }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to suspend teacher');
      }

      const result = await response.json();
      alert(`Success! Suspended ${result.topics_suspended} topics and ${result.question_sets_suspended} question sets`);
      await loadTeachers();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReactivate(teacher: Teacher) {
    if (!confirm(`Reactivate ${teacher.email}? This will republish their previously published quizzes.`)) {
      return;
    }

    const reason = prompt('Reason for reactivation:') || 'Subscription renewed';

    try {
      setActionLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reactivate-teacher`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ teacher_id: teacher.id, reason }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to reactivate teacher');
      }

      const result = await response.json();
      alert(`Success! Reactivated ${result.topics_reactivated} topics and ${result.question_sets_reactivated} question sets`);
      await loadTeachers();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResendVerification(teacher: Teacher) {
    if (!confirm(`Send verification email to ${teacher.email}?`)) {
      return;
    }

    try {
      setActionLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-resend-verification`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ teacher_email: teacher.email }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to send verification email');
      }

      alert('Verification email sent successfully!');
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  }

  function getPremiumBadge(teacher: Teacher) {
    if (!teacher.premium_status) {
      return <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">Free</span>;
    }

    switch (teacher.premium_source) {
      case 'stripe':
        return <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">Stripe</span>;
      case 'school_domain':
        return <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">School</span>;
      case 'admin_override':
        return <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">Admin</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">Free</span>;
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
            <CheckCircle className="w-3 h-3" />
            Active
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
            <XCircle className="w-3 h-3" />
            Expired
          </span>
        );
      case 'inactive':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">
            <AlertCircle className="w-3 h-3" />
            Inactive
          </span>
        );
      default:
        return null;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800 font-medium">Error: {error}</p>
        <button
          onClick={loadTeachers}
          className="mt-2 text-sm text-red-600 hover:text-red-700 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Teachers</h1>
          <p className="text-gray-600 mt-1">Manage teacher accounts and subscriptions</p>
        </div>
        <button
          onClick={loadTeachers}
          disabled={actionLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div>
            <select
              value={premiumFilter}
              onChange={(e) => setPremiumFilter(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Plans</option>
              <option value="premium">Premium</option>
              <option value="free">Free</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>Total: {teachers.length}</span>
          <span>Filtered: {filteredTeachers.length}</span>
          <span>Premium: {teachers.filter(t => t.premium_status).length}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Teacher
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Verified
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Premium
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quizzes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTeachers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No teachers found
                  </td>
                </tr>
              ) : (
                filteredTeachers.map((teacher) => (
                  <tr key={teacher.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900">{teacher.full_name}</span>
                        <span className="text-sm text-gray-500">{teacher.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {teacher.email_verified ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {getPremiumBadge(teacher)}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(teacher.status)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {teacher.quiz_count}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(teacher.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {!teacher.email_verified && (
                          <button
                            onClick={() => handleResendVerification(teacher)}
                            disabled={actionLoading}
                            title="Resend verification email"
                            className="p-1 text-blue-600 hover:text-blue-700 disabled:opacity-50"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                        )}
                        {teacher.status === 'active' ? (
                          <button
                            onClick={() => handleSuspend(teacher)}
                            disabled={actionLoading}
                            title="Suspend teacher"
                            className="p-1 text-red-600 hover:text-red-700 disabled:opacity-50"
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivate(teacher)}
                            disabled={actionLoading}
                            title="Reactivate teacher"
                            className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

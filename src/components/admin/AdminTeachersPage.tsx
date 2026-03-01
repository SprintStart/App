import { useState, useEffect } from 'react';
import {
  Search, Filter, UserCheck, UserX, Mail, Eye, AlertCircle, CheckCircle,
  XCircle, Loader2, X, Calendar, CreditCard, Activity, FileText, Clock,
  Shield, Plus, RefreshCw, DollarSign, Ban, MoreVertical, Copy
} from 'lucide-react';
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

interface TeacherDetail {
  id: string;
  email: string;
  full_name: string;
  email_verified: boolean;
  email_confirmed_at: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  premium_status: boolean;
  premium_source: string;
  expires_at: string | null;
  subscription: any;
  school_membership: any;
  topics: any[];
  recent_activity: any[];
  audit_logs: any[];
}

export function AdminTeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [filteredTeachers, setFilteredTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'inactive'>('all');
  const [premiumFilter, setPremiumFilter] = useState<'all' | 'premium' | 'free'>('all');
  const [actionLoading, setActionLoading] = useState(false);

  const [selectedTeachers, setSelectedTeachers] = useState<Set<string>>(new Set());
  const [showDrawer, setShowDrawer] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherDetail | null>(null);
  const [drawerTab, setDrawerTab] = useState<'overview' | 'billing' | 'activity' | 'audit'>('overview');
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [showGrantModal, setShowGrantModal] = useState(false);
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [modalTeacherId, setModalTeacherId] = useState<string>('');
  const [modalReason, setModalReason] = useState('');
  const [modalExpiryDays, setModalExpiryDays] = useState(365);
  const [showActionsMenu, setShowActionsMenu] = useState<string | null>(null);

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
      setDebugInfo(null);

      console.log('[Admin Teachers] Loading teachers');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('[Admin Teachers] No session found');
        throw new Error('Not authenticated');
      }

      console.log('[Admin Teachers] Session found, calling edge function');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-teachers`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('[Admin Teachers] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[Admin Teachers] Error response:', errorData);
        setDebugInfo(errorData);
        throw new Error(errorData.error || 'Failed to load teachers');
      }

      const data = await response.json();
      console.log('[Admin Teachers] Loaded teachers:', data.teachers?.length);
      setTeachers(data.teachers || []);
    } catch (err: any) {
      console.error('[Admin Teachers] Error loading teachers:', err);
      setError(err.message || 'Failed to load teachers');
      setDebugInfo({ error: err.message, stack: err.stack });
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

  async function loadTeacherDetail(teacherId: string) {
    try {
      setLoadingDetail(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-teacher-detail`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ teacher_id: teacherId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load teacher details');
      }

      const data = await response.json();
      setSelectedTeacher(data.teacher);
      setShowDrawer(true);
    } catch (err: any) {
      alert('Error loading teacher details: ' + err.message);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleGrantPremium() {
    if (!modalTeacherId || !modalReason.trim()) {
      alert('Please enter a reason for granting premium access');
      return;
    }

    try {
      setActionLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + modalExpiryDays);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-grant-premium`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            teacher_id: modalTeacherId,
            expires_at: expiresAt.toISOString(),
            reason: modalReason,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        const errorMsg = errorData.details
          ? `${errorData.error}\n\nDetails: ${errorData.details}`
          : errorData.error || 'Failed to grant premium';
        throw new Error(errorMsg);
      }

      alert('Premium access granted successfully!');
      setShowGrantModal(false);
      setModalReason('');
      setModalExpiryDays(365);
      await loadTeachers();
      if (selectedTeacher?.id === modalTeacherId) {
        await loadTeacherDetail(modalTeacherId);
      }
    } catch (err: any) {
      console.error('Grant premium error:', err);
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRevokePremium() {
    if (!modalTeacherId || !modalReason.trim()) {
      alert('Please enter a reason for revoking premium access');
      return;
    }

    try {
      setActionLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-revoke-premium`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            teacher_id: modalTeacherId,
            reason: modalReason,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to revoke premium');
      }

      alert('Premium access revoked successfully!');
      setShowRevokeModal(false);
      setModalReason('');
      await loadTeachers();
      if (selectedTeacher?.id === modalTeacherId) {
        await loadTeacherDetail(modalTeacherId);
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSendPasswordReset() {
    const teacher = teachers.find(t => t.id === modalTeacherId);
    if (!teacher) return;

    if (!confirm(`Send password reset email to ${teacher.email}?`)) {
      return;
    }

    try {
      setActionLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-send-password-reset`,
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
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send password reset');
      }

      alert('Password reset email sent successfully!');
      setShowPasswordResetModal(false);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(false);
    }
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

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedTeachers(new Set(filteredTeachers.map(t => t.id)));
    } else {
      setSelectedTeachers(new Set());
    }
  }

  function handleSelectTeacher(teacherId: string, checked: boolean) {
    const newSelected = new Set(selectedTeachers);
    if (checked) {
      newSelected.add(teacherId);
    } else {
      newSelected.delete(teacherId);
    }
    setSelectedTeachers(newSelected);
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

  function copyDebugInfo() {
    navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
    alert('Debug info copied to clipboard');
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
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">Error: {error}</p>
          <button
            onClick={loadTeachers}
            className="mt-2 text-sm text-red-600 hover:text-red-700 underline"
          >
            Try again
          </button>
        </div>
        {debugInfo && (
          <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">Debug Info (Admin Only)</h3>
              <button
                onClick={copyDebugInfo}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <Copy className="w-4 h-4" />
                Copy
              </button>
            </div>
            <pre className="text-xs text-gray-700 overflow-auto">{JSON.stringify(debugInfo, null, 2)}</pre>
          </div>
        )}
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
          <RefreshCw className="w-4 h-4 inline mr-2" />
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

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>Total: {teachers.length}</span>
            <span>Filtered: {filteredTeachers.length}</span>
            <span>Premium: {teachers.filter(t => t.premium_status).length}</span>
          </div>

          {selectedTeachers.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">{selectedTeachers.size} selected</span>
              <button
                onClick={() => alert('Bulk actions coming soon')}
                className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200"
              >
                Bulk Actions
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedTeachers.size === filteredTeachers.length && filteredTeachers.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
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
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    No teachers found
                  </td>
                </tr>
              ) : (
                filteredTeachers.map((teacher) => (
                  <tr key={teacher.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedTeachers.has(teacher.id)}
                        onChange={(e) => handleSelectTeacher(teacher.id, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <button
                          onClick={() => loadTeacherDetail(teacher.id)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-700 text-left"
                        >
                          {teacher.full_name}
                        </button>
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
                      <div className="flex items-center justify-end gap-2 relative">
                        <button
                          onClick={() => loadTeacherDetail(teacher.id)}
                          disabled={loadingDetail}
                          title="View details"
                          className="p-1 text-blue-600 hover:text-blue-700 disabled:opacity-50"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setShowActionsMenu(showActionsMenu === teacher.id ? null : teacher.id)}
                          title="More actions"
                          className="p-1 text-gray-600 hover:text-gray-700"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {showActionsMenu === teacher.id && (
                          <div className="absolute right-0 top-8 z-10 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                            {!teacher.email_verified && (
                              <button
                                onClick={() => {
                                  setShowActionsMenu(null);
                                  handleResendVerification(teacher);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Mail className="w-4 h-4" />
                                Resend Verification
                              </button>
                            )}
                            {teacher.premium_source !== 'admin_override' ? (
                              <button
                                onClick={() => {
                                  setShowActionsMenu(null);
                                  setModalTeacherId(teacher.id);
                                  setShowGrantModal(true);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Shield className="w-4 h-4" />
                                Grant Premium
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setShowActionsMenu(null);
                                  setModalTeacherId(teacher.id);
                                  setShowRevokeModal(true);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Ban className="w-4 h-4" />
                                Revoke Premium
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setShowActionsMenu(null);
                                setModalTeacherId(teacher.id);
                                setShowPasswordResetModal(true);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Mail className="w-4 h-4" />
                              Send Password Reset
                            </button>
                            {teacher.status === 'active' ? (
                              <button
                                onClick={() => {
                                  setShowActionsMenu(null);
                                  handleSuspend(teacher);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                <UserX className="w-4 h-4" />
                                Suspend
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setShowActionsMenu(null);
                                  handleReactivate(teacher);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-green-600 hover:bg-green-50 flex items-center gap-2"
                              >
                                <UserCheck className="w-4 h-4" />
                                Reactivate
                              </button>
                            )}
                          </div>
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

      {showDrawer && selectedTeacher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
          <div className="w-full max-w-3xl bg-white h-full overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Teacher Details</h2>
              <button
                onClick={() => setShowDrawer(false)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border-b border-gray-200 px-6">
              <div className="flex gap-4">
                <button
                  onClick={() => setDrawerTab('overview')}
                  className={`py-3 px-1 border-b-2 font-medium text-sm ${
                    drawerTab === 'overview'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setDrawerTab('billing')}
                  className={`py-3 px-1 border-b-2 font-medium text-sm ${
                    drawerTab === 'billing'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Subscription & Billing
                </button>
                <button
                  onClick={() => setDrawerTab('activity')}
                  className={`py-3 px-1 border-b-2 font-medium text-sm ${
                    drawerTab === 'activity'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Activity
                </button>
                <button
                  onClick={() => setDrawerTab('audit')}
                  className={`py-3 px-1 border-b-2 font-medium text-sm ${
                    drawerTab === 'audit'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Admin Actions Log
                </button>
              </div>
            </div>

            <div className="p-6">
              {drawerTab === 'overview' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Full Name</label>
                        <p className="text-gray-900">{selectedTeacher.full_name}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Email</label>
                        <p className="text-gray-900">{selectedTeacher.email}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Email Verified</label>
                        <p className="text-gray-900">
                          {selectedTeacher.email_verified ? (
                            <span className="text-green-600 flex items-center gap-1">
                              <CheckCircle className="w-4 h-4" />
                              Verified
                            </span>
                          ) : (
                            <span className="text-red-600 flex items-center gap-1">
                              <XCircle className="w-4 h-4" />
                              Not Verified
                            </span>
                          )}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Joined</label>
                        <p className="text-gray-900">{new Date(selectedTeacher.created_at).toLocaleString()}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Last Sign In</label>
                        <p className="text-gray-900">
                          {selectedTeacher.last_sign_in_at
                            ? new Date(selectedTeacher.last_sign_in_at).toLocaleString()
                            : 'Never'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Premium Status</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Status</label>
                        <p className="text-gray-900">
                          {selectedTeacher.premium_status ? (
                            <span className="text-green-600 font-medium">Premium Active</span>
                          ) : (
                            <span className="text-gray-600">Free Plan</span>
                          )}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Source</label>
                        <p className="text-gray-900 capitalize">{selectedTeacher.premium_source.replace('_', ' ')}</p>
                      </div>
                      {selectedTeacher.expires_at && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Expires At</label>
                          <p className="text-gray-900">{new Date(selectedTeacher.expires_at).toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedTeacher.school_membership && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">School Membership</h3>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="font-medium text-blue-900">{selectedTeacher.school_membership.school_name}</p>
                        <p className="text-sm text-blue-700 mt-1">
                          Joined via: {selectedTeacher.school_membership.joined_via}
                        </p>
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Content Statistics</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-2xl font-bold text-gray-900">{selectedTeacher.topics.length}</p>
                        <p className="text-sm text-gray-600">Total Quizzes</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-2xl font-bold text-gray-900">
                          {selectedTeacher.topics.filter(t => t.is_active).length}
                        </p>
                        <p className="text-sm text-gray-600">Active Quizzes</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {drawerTab === 'billing' && (
                <div className="space-y-6">
                  {selectedTeacher.subscription ? (
                    <>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Stripe Subscription</h3>
                        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-gray-500">Status</span>
                            <span className="text-sm text-gray-900 capitalize">{selectedTeacher.subscription.status}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-gray-500">Subscription ID</span>
                            <span className="text-sm text-gray-900 font-mono">{selectedTeacher.subscription.subscription_id}</span>
                          </div>
                          {selectedTeacher.subscription.current_period_start && (
                            <div className="flex justify-between">
                              <span className="text-sm font-medium text-gray-500">Current Period</span>
                              <span className="text-sm text-gray-900">
                                {new Date(selectedTeacher.subscription.current_period_start * 1000).toLocaleDateString()} -
                                {new Date(selectedTeacher.subscription.current_period_end * 1000).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          {selectedTeacher.subscription.payment_method_brand && (
                            <div className="flex justify-between">
                              <span className="text-sm font-medium text-gray-500">Payment Method</span>
                              <span className="text-sm text-gray-900">
                                {selectedTeacher.subscription.payment_method_brand} ****{selectedTeacher.subscription.payment_method_last4}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-gray-500">Cancel at Period End</span>
                            <span className="text-sm text-gray-900">
                              {selectedTeacher.subscription.cancel_at_period_end ? 'Yes' : 'No'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No active Stripe subscription
                    </div>
                  )}
                </div>
              )}

              {drawerTab === 'activity' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Topics Created</h3>
                    {selectedTeacher.topics.length > 0 ? (
                      <div className="space-y-2">
                        {selectedTeacher.topics.map((topic: any) => (
                          <div key={topic.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <p className="font-medium text-gray-900">{topic.name}</p>
                              <p className="text-sm text-gray-500">{topic.subject}</p>
                            </div>
                            <span className={`px-2 py-1 text-xs rounded ${
                              topic.is_active
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {topic.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">No topics created yet</p>
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Quiz Activity</h3>
                    {selectedTeacher.recent_activity.length > 0 ? (
                      <div className="space-y-2">
                        {selectedTeacher.recent_activity.slice(0, 10).map((run: any) => (
                          <div key={run.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <p className="text-sm text-gray-900">Score: {run.score || 0}</p>
                              <p className="text-xs text-gray-500">
                                {new Date(run.started_at).toLocaleDateString()}
                              </p>
                            </div>
                            <span className={`px-2 py-1 text-xs rounded capitalize ${
                              run.status === 'completed'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {run.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">No recent activity</p>
                    )}
                  </div>
                </div>
              )}

              {drawerTab === 'audit' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Admin Actions Log</h3>
                  {selectedTeacher.audit_logs.length > 0 ? (
                    <div className="space-y-3">
                      {selectedTeacher.audit_logs.map((log: any) => (
                        <div key={log.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-medium text-gray-900 capitalize">
                                {log.action_type.replace('_', ' ')}
                              </p>
                              <p className="text-sm text-gray-600">By: {log.actor_email}</p>
                            </div>
                            <span className="text-xs text-gray-500">
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                          {log.reason && (
                            <p className="text-sm text-gray-700 mb-2">
                              <span className="font-medium">Reason:</span> {log.reason}
                            </p>
                          )}
                          {log.metadata && (
                            <details className="text-xs text-gray-600">
                              <summary className="cursor-pointer hover:text-gray-900">View metadata</summary>
                              <pre className="mt-2 bg-gray-50 p-2 rounded overflow-auto">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No admin actions recorded</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showGrantModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Grant Premium Access</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiry Period (days)
                </label>
                <input
                  type="number"
                  value={modalExpiryDays}
                  onChange={(e) => setModalExpiryDays(parseInt(e.target.value) || 365)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason (required)
                </label>
                <textarea
                  value={modalReason}
                  onChange={(e) => setModalReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="e.g., Special promotion, support escalation, etc."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleGrantPremium}
                disabled={actionLoading || !modalReason.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {actionLoading ? 'Granting...' : 'Grant Premium'}
              </button>
              <button
                onClick={() => {
                  setShowGrantModal(false);
                  setModalReason('');
                  setModalExpiryDays(365);
                }}
                disabled={actionLoading}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showRevokeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Revoke Premium Access</h3>
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                This will immediately revoke premium access and unpublish all their content.
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason (required)
                </label>
                <textarea
                  value={modalReason}
                  onChange={(e) => setModalReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="e.g., Policy violation, payment dispute, etc."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleRevokePremium}
                disabled={actionLoading || !modalReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? 'Revoking...' : 'Revoke Premium'}
              </button>
              <button
                onClick={() => {
                  setShowRevokeModal(false);
                  setModalReason('');
                }}
                disabled={actionLoading}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showPasswordResetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Send Password Reset</h3>
            <p className="text-gray-600 mb-6">
              This will send a password reset email to the teacher. They can use it to set a new password.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleSendPasswordReset}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {actionLoading ? 'Sending...' : 'Send Reset Email'}
              </button>
              <button
                onClick={() => setShowPasswordResetModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

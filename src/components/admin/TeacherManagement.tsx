import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Eye, Ban, CheckCircle, Trash2, Loader2, EyeOff } from 'lucide-react';

interface Teacher {
  id: string;
  email: string;
  full_name: string | null;
  school_name: string | null;
  subjects_taught: string[] | null;
  created_at: string;
  subscription?: {
    status: string;
    current_period_end: string | null;
  };
  quiz_count?: number;
  total_plays?: number;
}

export function TeacherManagement() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [filteredTeachers, setFilteredTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  useEffect(() => {
    loadTeachers();
  }, []);

  useEffect(() => {
    filterTeachers();
  }, [teachers, searchTerm, statusFilter]);

  async function loadTeachers() {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, school_name, subjects_taught, created_at')
        .eq('role', 'teacher')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const teachersWithData = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: subscription } = await supabase
            .from('subscriptions')
            .select('status, current_period_end')
            .eq('teacher_id', profile.id)
            .maybeSingle();

          const { count: quizCount } = await supabase
            .from('question_sets')
            .select('id', { count: 'exact', head: true })
            .eq('created_by', profile.id);

          const { data: quizzes } = await supabase
            .from('question_sets')
            .select('play_count')
            .eq('created_by', profile.id);

          const totalPlays =
            quizzes?.reduce((sum, q) => sum + (q.play_count || 0), 0) || 0;

          return {
            ...profile,
            subscription: subscription || undefined,
            quiz_count: quizCount || 0,
            total_plays: totalPlays,
          };
        })
      );

      setTeachers(teachersWithData);
    } catch (err) {
      console.error('Failed to load teachers:', err);
    } finally {
      setLoading(false);
    }
  }

  function filterTeachers() {
    let filtered = teachers;

    if (searchTerm) {
      filtered = filtered.filter(
        (t) =>
          t.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.school_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((t) => {
        if (!t.subscription) return statusFilter === 'no_subscription';
        return t.subscription.status === statusFilter;
      });
    }

    setFilteredTeachers(filtered);
  }

  async function handleUnpublishAllQuizzes(teacherId: string) {
    if (
      !confirm(
        'Are you sure you want to unpublish ALL quizzes from this teacher? This action will make all their content unavailable to students.'
      )
    )
      return;

    setActionInProgress(teacherId);
    try {
      const { error } = await supabase
        .from('question_sets')
        .update({ is_published: false })
        .eq('created_by', teacherId);

      if (error) throw error;

      await logAuditAction('unpublish_all_teacher_quizzes', teacherId, 'Admin bulk unpublish');

      alert('All quizzes unpublished successfully');
      loadTeachers();
    } catch (err) {
      console.error('Failed to unpublish quizzes:', err);
      alert('Failed to unpublish quizzes');
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleExtendSubscription(teacherId: string) {
    const days = prompt('Enter number of days to extend subscription:');
    if (!days || isNaN(parseInt(days))) return;

    setActionInProgress(teacherId);
    try {
      const { data: existing } = await supabase
        .from('subscriptions')
        .select('current_period_end')
        .eq('teacher_id', teacherId)
        .maybeSingle();

      const currentEnd = existing?.current_period_end
        ? new Date(existing.current_period_end)
        : new Date();

      const newEnd = new Date(currentEnd.getTime() + parseInt(days) * 24 * 60 * 60 * 1000);

      if (existing) {
        await supabase
          .from('subscriptions')
          .update({
            current_period_end: newEnd.toISOString(),
            status: 'active',
          })
          .eq('teacher_id', teacherId);
      } else {
        await supabase.from('subscriptions').insert({
          teacher_id: teacherId,
          status: 'active',
          plan_type: 'annual',
          current_period_start: new Date().toISOString(),
          current_period_end: newEnd.toISOString(),
          max_active_quizzes: 1000,
          max_students_per_quiz: 10000,
        });
      }

      await logAuditAction(
        'extend_subscription',
        teacherId,
        `Extended subscription by ${days} days`
      );

      alert('Subscription extended successfully');
      loadTeachers();
    } catch (err) {
      console.error('Failed to extend subscription:', err);
      alert('Failed to extend subscription');
    } finally {
      setActionInProgress(null);
    }
  }

  async function logAuditAction(action: string, entityId: string, reason: string) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('audit_logs').insert({
        admin_id: user.id,
        action_type: action,
        entity_type: 'teacher',
        entity_id: entityId,
        reason: reason,
      });
    } catch (err) {
      console.error('Failed to log audit action:', err);
    }
  }

  const getStatusBadge = (teacher: Teacher) => {
    if (!teacher.subscription) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          No Subscription
        </span>
      );
    }

    const status = teacher.subscription.status;
    if (status === 'active' || status === 'trialing') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3" />
          Active
        </span>
      );
    }

    if (status === 'expired' || status === 'canceled') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <Ban className="w-3 h-3" />
          Expired
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Teacher Management</h1>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search teachers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="trialing">Trialing</option>
            <option value="expired">Expired</option>
            <option value="canceled">Canceled</option>
            <option value="no_subscription">No Subscription</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Teacher
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  School
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Expiry Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Quizzes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Total Plays
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTeachers.map((teacher) => (
                <tr key={teacher.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-gray-900">
                        {teacher.full_name || 'Unnamed'}
                      </div>
                      <div className="text-sm text-gray-500">{teacher.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {teacher.school_name || '-'}
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(teacher)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {teacher.subscription?.current_period_end
                      ? new Date(teacher.subscription.current_period_end).toLocaleDateString()
                      : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{teacher.quiz_count}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{teacher.total_plays}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleExtendSubscription(teacher.id)}
                        disabled={actionInProgress === teacher.id}
                        className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition disabled:opacity-50"
                        title="Extend Subscription"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleUnpublishAllQuizzes(teacher.id)}
                        disabled={actionInProgress === teacher.id}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                        title="Unpublish All Quizzes"
                      >
                        {actionInProgress === teacher.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <EyeOff className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

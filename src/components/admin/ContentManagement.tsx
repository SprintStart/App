import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Search,
  Filter,
  Eye,
  EyeOff,
  Trash2,
  Flag,
  Edit2,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react';

interface Teacher {
  id: string;
  email: string;
  name: string | null;
}

interface Quiz {
  id: string;
  title: string;
  topic_id: string | null;
  difficulty: string;
  is_active: boolean;
  approval_status: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  topics?: { name: string; subject: string };
}

export function ContentManagement() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [filteredQuizzes, setFilteredQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [showFlagModal, setShowFlagModal] = useState<Quiz | null>(null);
  const [flagReason, setFlagReason] = useState('');

  useEffect(() => {
    loadTeachers();
  }, []);

  useEffect(() => {
    if (selectedTeacher) {
      loadTeacherQuizzes(selectedTeacher);
    }
  }, [selectedTeacher]);

  useEffect(() => {
    filterQuizzes();
  }, [quizzes, searchTerm, statusFilter]);

  async function loadTeachers() {
    try {
      console.log('[Content Management] Loading teachers');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('[Content Management] No session found');
        return;
      }

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
        const errorData = await response.json();
        console.error('[Content Management] Error loading teachers:', errorData);
        return;
      }

      const data = await response.json();
      console.log('[Content Management] Loaded teachers:', data.teachers?.length);

      setTeachers(
        data.teachers?.map((t: any) => ({
          id: t.id,
          email: t.email,
          name: t.full_name,
        })) || []
      );
    } catch (err) {
      console.error('[Content Management] Failed to load teachers:', err);
    }
  }

  async function loadTeacherQuizzes(teacherId: string) {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('question_sets')
        .select(
          `
          *,
          topics:topic_id(name, subject)
        `
        )
        .eq('created_by', teacherId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuizzes(data || []);
    } catch (err) {
      console.error('Failed to load quizzes:', err);
    } finally {
      setLoading(false);
    }
  }

  function filterQuizzes() {
    let filtered = quizzes;

    if (searchTerm) {
      filtered = filtered.filter((q) =>
        q.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((q) => {
        if (statusFilter === 'active') return q.is_active;
        if (statusFilter === 'inactive') return !q.is_active;
        return true;
      });
    }

    setFilteredQuizzes(filtered);
  }

  async function handleDeactivate(quizId: string) {
    if (!confirm('Are you sure you want to deactivate this quiz?')) return;

    setActionInProgress(quizId);
    try {
      const { error } = await supabase
        .from('question_sets')
        .update({ is_active: false })
        .eq('id', quizId);

      if (error) throw error;

      await logAuditAction('deactivate_quiz', quizId, 'Admin deactivate');

      setQuizzes((prev) =>
        prev.map((q) => (q.id === quizId ? { ...q, is_active: false } : q))
      );
    } catch (err) {
      console.error('Failed to deactivate:', err);
      alert('Failed to deactivate quiz');
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleActivate(quizId: string) {
    setActionInProgress(quizId);
    try {
      const { error } = await supabase
        .from('question_sets')
        .update({ is_active: true })
        .eq('id', quizId);

      if (error) throw error;

      await logAuditAction('activate_quiz', quizId, 'Admin activate');

      setQuizzes((prev) =>
        prev.map((q) => (q.id === quizId ? { ...q, is_active: true } : q))
      );
    } catch (err) {
      console.error('Failed to activate:', err);
      alert('Failed to activate quiz');
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleDelete(quizId: string) {
    if (!confirm('Are you sure you want to permanently delete this quiz? This cannot be undone.'))
      return;

    setActionInProgress(quizId);
    try {
      const { error } = await supabase.from('question_sets').delete().eq('id', quizId);

      if (error) throw error;

      await logAuditAction('delete_quiz', quizId, 'Admin delete');

      setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
    } catch (err) {
      console.error('Failed to delete:', err);
      alert('Failed to delete quiz');
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleFlag(quiz: Quiz) {
    setShowFlagModal(quiz);
  }

  async function submitFlag() {
    if (!showFlagModal || !flagReason.trim()) {
      alert('Please provide a reason for flagging this quiz');
      return;
    }

    setActionInProgress(showFlagModal.id);
    try {
      const { error } = await supabase
        .from('question_sets')
        .update({
          is_active: false,
        })
        .eq('id', showFlagModal.id);

      if (error) throw error;

      await logAuditAction('flag_quiz', showFlagModal.id, flagReason);

      setQuizzes((prev) =>
        prev.map((q) => (q.id === showFlagModal.id ? { ...q, is_active: false } : q))
      );

      setShowFlagModal(null);
      setFlagReason('');
    } catch (err) {
      console.error('Failed to flag:', err);
      alert('Failed to flag quiz');
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
        entity_type: 'quiz',
        entity_id: entityId,
        reason: reason,
      });
    } catch (err) {
      console.error('Failed to log audit action:', err);
    }
  }


  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Content Management</h1>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Teacher</label>
        <select
          value={selectedTeacher}
          onChange={(e) => setSelectedTeacher(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
        >
          <option value="">-- Select a teacher --</option>
          {teachers.map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {teacher.name || teacher.email}
            </option>
          ))}
        </select>
      </div>

      {selectedTeacher && (
        <>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search quizzes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-red-600" />
            </div>
          ) : filteredQuizzes.length === 0 ? (
            <div className="bg-white p-12 rounded-lg shadow-sm border border-gray-200 text-center text-gray-500">
              No quizzes found
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Quiz Title
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Subject
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Topic
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Difficulty
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Approval
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Created
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredQuizzes.map((quiz) => (
                      <tr key={quiz.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{quiz.title}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {quiz.topics?.subject || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {quiz.topics?.name || '-'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            quiz.difficulty === 'easy'
                              ? 'bg-green-100 text-green-800'
                              : quiz.difficulty === 'medium'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {quiz.difficulty}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {quiz.is_active ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle className="w-3 h-3" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              <XCircle className="w-3 h-3" />
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            quiz.approval_status === 'approved'
                              ? 'bg-green-100 text-green-800'
                              : quiz.approval_status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {quiz.approval_status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(quiz.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            {quiz.is_active ? (
                              <button
                                onClick={() => handleDeactivate(quiz.id)}
                                disabled={actionInProgress === quiz.id}
                                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                                title="Deactivate"
                              >
                                {actionInProgress === quiz.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <EyeOff className="w-4 h-4" />
                                )}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleActivate(quiz.id)}
                                disabled={actionInProgress === quiz.id}
                                className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition disabled:opacity-50"
                                title="Activate"
                              >
                                {actionInProgress === quiz.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => handleFlag(quiz)}
                              disabled={actionInProgress === quiz.id}
                              className="p-2 text-gray-600 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition disabled:opacity-50"
                              title="Flag"
                            >
                              <Flag className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(quiz.id)}
                              disabled={actionInProgress === quiz.id}
                              className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {showFlagModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Flag Quiz</h3>
            <p className="text-sm text-gray-600 mb-4">
              Flagging this quiz will deactivate it and log the reason for review.
            </p>
            <textarea
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              placeholder="Enter reason for flagging..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent mb-4"
              rows={4}
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowFlagModal(null);
                  setFlagReason('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={submitFlag}
                disabled={!flagReason.trim() || actionInProgress === showFlagModal.id}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {actionInProgress === showFlagModal.id ? 'Flagging...' : 'Flag Quiz'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

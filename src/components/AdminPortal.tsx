import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, FileText, School, Ban, CheckCircle, AlertTriangle, Wand2 } from 'lucide-react';
import { BulkQuizGenerator } from './BulkQuizGenerator';

interface Teacher {
  id: string;
  email: string;
  full_name: string;
  school_name: string;
  created_at: string;
  subscription?: {
    plan_type: string;
    status: string;
    current_period_end: string;
  };
}

interface QuizModerationItem {
  id: string;
  title: string;
  teacher_name: string;
  teacher_email: string;
  created_at: string;
  question_count: number;
  is_published: boolean;
  is_active: boolean;
}

interface SchoolDomain {
  id: string;
  name: string;
  domain: string;
  subscription_type: string;
  is_active: boolean;
}

export function AdminPortal() {
  const [view, setView] = useState<'teachers' | 'quizzes' | 'schools' | 'generation'>('teachers');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [quizzes, setQuizzes] = useState<QuizModerationItem[]>([]);
  const [schools, setSchools] = useState<SchoolDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      if (view === 'teachers') loadTeachers();
      else if (view === 'quizzes') loadQuizzes();
      else if (view === 'schools') loadSchools();
    }
  }, [view, isAdmin]);

  async function checkAdminAccess() {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.user.id)
        .single();

      if (profile?.role === 'admin') {
        setIsAdmin(true);
      }
    } catch (err) {
      console.error('Access check failed:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadTeachers() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          full_name,
          school_name,
          created_at,
          subscriptions (
            plan_type,
            status,
            current_period_end
          )
        `)
        .eq('role', 'teacher')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const teacherList = (data || []).map((t: any) => ({
        id: t.id,
        email: t.email,
        full_name: t.full_name,
        school_name: t.school_name,
        created_at: t.created_at,
        subscription: t.subscriptions?.[0],
      }));

      setTeachers(teacherList);
    } catch (err) {
      console.error('Failed to load teachers:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadQuizzes() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('question_sets')
        .select(`
          id,
          title,
          created_at,
          question_count,
          is_published,
          is_active,
          profiles!question_sets_created_by_fkey (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const quizList = (data || []).map((q: any) => ({
        id: q.id,
        title: q.title,
        teacher_name: q.profiles?.full_name || 'Unknown',
        teacher_email: q.profiles?.email || 'Unknown',
        created_at: q.created_at,
        question_count: q.question_count,
        is_published: q.is_published,
        is_active: q.is_active,
      }));

      setQuizzes(quizList);
    } catch (err) {
      console.error('Failed to load quizzes:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadSchools() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .order('name');

      if (error) throw error;
      setSchools(data || []);
    } catch (err) {
      console.error('Failed to load schools:', err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleQuizActive(quizId: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('question_sets')
        .update({ is_active: !currentStatus })
        .eq('id', quizId);

      if (error) throw error;
      loadQuizzes();
    } catch (err) {
      console.error('Failed to toggle quiz status:', err);
    }
  }

  async function updateSubscription(teacherId: string, planType: string, status: string) {
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          plan_type: planType,
          status: status,
          current_period_end: status === 'active' ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() : null,
        })
        .eq('teacher_id', teacherId);

      if (error) throw error;
      loadTeachers();
    } catch (err) {
      console.error('Failed to update subscription:', err);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You do not have permission to access this area.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Admin Portal</h1>

        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setView('teachers')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium ${
              view === 'teachers'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-300'
            }`}
          >
            <Users className="w-5 h-5" />
            Teachers
          </button>
          <button
            onClick={() => setView('quizzes')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium ${
              view === 'quizzes'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-300'
            }`}
          >
            <FileText className="w-5 h-5" />
            Quiz Moderation
          </button>
          <button
            onClick={() => setView('schools')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium ${
              view === 'schools'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-300'
            }`}
          >
            <School className="w-5 h-5" />
            School Domains
          </button>
          <button
            onClick={() => setView('generation')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium ${
              view === 'generation'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-300'
            }`}
          >
            <Wand2 className="w-5 h-5" />
            Bulk Generation
          </button>
        </div>

        {view === 'teachers' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Teacher Management</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Email</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">School</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Plan</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((teacher) => (
                    <tr key={teacher.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-900">{teacher.full_name}</td>
                      <td className="py-3 px-4 text-gray-600">{teacher.email}</td>
                      <td className="py-3 px-4 text-gray-600">{teacher.school_name || '-'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-sm font-medium ${
                          teacher.subscription?.plan_type === 'premium' ? 'bg-blue-100 text-blue-800' :
                          teacher.subscription?.plan_type === 'enterprise' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {teacher.subscription?.plan_type || 'free'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-sm font-medium ${
                          teacher.subscription?.status === 'active' ? 'bg-green-100 text-green-800' :
                          teacher.subscription?.status === 'canceled' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {teacher.subscription?.status || 'active'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          onChange={(e) => {
                            const [plan, status] = e.target.value.split(':');
                            updateSubscription(teacher.id, plan, status);
                          }}
                          className="text-sm border border-gray-300 rounded px-2 py-1"
                        >
                          <option value="">Change Plan...</option>
                          <option value="free:active">Free</option>
                          <option value="premium:active">Premium (Active)</option>
                          <option value="enterprise:active">Enterprise (Active)</option>
                          <option value="free:canceled">Cancel Subscription</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'quizzes' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Quiz Moderation</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Title</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Teacher</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Questions</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {quizzes.map((quiz) => (
                    <tr key={quiz.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-900">{quiz.title}</td>
                      <td className="py-3 px-4 text-gray-600">
                        <div>{quiz.teacher_name}</div>
                        <div className="text-xs text-gray-500">{quiz.teacher_email}</div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{quiz.question_count}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-sm font-medium ${
                          quiz.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {quiz.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => toggleQuizActive(quiz.id, quiz.is_active)}
                          className={`flex items-center gap-1 px-3 py-1 rounded text-sm font-medium ${
                            quiz.is_active
                              ? 'bg-red-100 text-red-800 hover:bg-red-200'
                              : 'bg-green-100 text-green-800 hover:bg-green-200'
                          }`}
                        >
                          {quiz.is_active ? (
                            <>
                              <Ban className="w-4 h-4" />
                              Disable
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              Enable
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'schools' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">School Domains</h2>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                Add School
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">School Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Domain</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Subscription</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {schools.map((school) => (
                    <tr key={school.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-900">{school.name}</td>
                      <td className="py-3 px-4 text-gray-600">{school.domain}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-sm font-medium ${
                          school.subscription_type === 'premium' ? 'bg-blue-100 text-blue-800' :
                          school.subscription_type === 'enterprise' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {school.subscription_type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-sm font-medium ${
                          school.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {school.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'generation' && <BulkQuizGenerator />}
      </div>
    </div>
  );
}

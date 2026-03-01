import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Search,
  Filter,
  Eye,
  Edit,
  Copy,
  Archive,
  Share2,
  Loader2,
  FileText,
  Plus,
  EyeOff,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Quiz {
  id: string;
  name: string;
  subject: string;
  slug: string;
  is_published: boolean;
  is_active: boolean;
  created_at: string;
  plays: number;
  difficulty?: string;
  question_count?: number;
  is_draft?: boolean;
  draft_id?: string;
}

export function MyQuizzesPage() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    loadQuizzes();
  }, []);

  async function loadQuizzes() {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        console.error('No user found');
        return;
      }

      console.log('Loading quizzes for user:', user.user.id);

      // Load published question sets
      const { data: questionSets, error: qsError } = await supabase
        .from('question_sets')
        .select(`
          id,
          title,
          difficulty,
          question_count,
          is_active,
          approval_status,
          created_at,
          topic_id,
          topic:topics (
            id,
            name,
            subject
          )
        `)
        .eq('created_by', user.user.id)
        .order('created_at', { ascending: false });

      if (qsError) {
        console.error('Error loading question sets:', qsError);
      }

      console.log('Loaded question sets:', questionSets);

      // Load draft quizzes
      const { data: drafts, error: draftsError } = await supabase
        .from('teacher_quiz_drafts')
        .select('*')
        .eq('teacher_id', user.user.id)
        .eq('is_published', false)
        .order('updated_at', { ascending: false });

      if (draftsError) {
        console.error('Error loading drafts:', draftsError);
      }

      console.log('Loaded drafts:', drafts);

      const allQuizzes: Quiz[] = [];

      // Process published quizzes
      if (questionSets) {
        const quizzesWithPlays = await Promise.all(
          questionSets.map(async (qs: any) => {
            const { data: runs } = await supabase
              .from('public_quiz_runs')
              .select('id')
              .eq('question_set_id', qs.id);

            const slug = `${qs.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${qs.id}`;

            // Handle topic data (could be array or object from Supabase)
            const topicData = Array.isArray(qs.topic) ? qs.topic[0] : qs.topic;

            return {
              id: qs.id,
              name: qs.title,
              subject: topicData?.subject || 'Unknown',
              slug,
              is_published: qs.approval_status === 'approved',
              is_active: qs.is_active,
              created_at: qs.created_at,
              difficulty: qs.difficulty,
              question_count: qs.question_count,
              plays: runs?.length || 0,
              is_draft: false
            };
          })
        );
        allQuizzes.push(...quizzesWithPlays);
      }

      // Process drafts
      if (drafts) {
        const draftQuizzes = drafts.map((draft: any) => ({
          id: draft.metadata?.topic_id || draft.id,
          draft_id: draft.id,
          name: draft.title,
          subject: draft.subject || 'Unknown',
          slug: '',
          is_published: false,
          is_active: true,
          created_at: draft.updated_at || draft.created_at,
          difficulty: draft.difficulty,
          question_count: draft.questions?.length || 0,
          plays: 0,
          is_draft: true
        }));
        allQuizzes.push(...draftQuizzes);
      }

      // Sort by date
      allQuizzes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setQuizzes(allQuizzes);
    } catch (err) {
      console.error('Failed to load quizzes:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredQuizzes = quizzes.filter(quiz => {
    const matchesSearch = quiz.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSubject = filterSubject === 'all' || quiz.subject === filterSubject;
    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'published' && quiz.is_published) ||
      (filterStatus === 'draft' && !quiz.is_published);
    return matchesSearch && matchesSubject && matchesStatus;
  });

  async function duplicateQuiz(quizId: string, name: string) {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data: original, error: fetchError } = await supabase
        .from('question_sets')
        .select('*, topic_questions(*)')
        .eq('id', quizId)
        .single();

      if (fetchError || !original) {
        console.error('Failed to fetch original quiz:', fetchError);
        alert('Failed to duplicate quiz');
        return;
      }

      const { data: newQuiz, error: insertError } = await supabase
        .from('question_sets')
        .insert({
          title: `${original.title} (Copy)`,
          topic_id: original.topic_id,
          difficulty: original.difficulty,
          question_count: original.question_count,
          created_by: user.user.id,
          approval_status: 'draft',
          is_active: true
        })
        .select()
        .single();

      if (insertError || !newQuiz) {
        console.error('Failed to create duplicate quiz:', insertError);
        alert('Failed to duplicate quiz');
        return;
      }

      if (original.topic_questions && original.topic_questions.length > 0) {
        const newQuestions = original.topic_questions.map((q: any) => ({
          question_set_id: newQuiz.id,
          question_text: q.question_text,
          options: q.options,
          correct_index: q.correct_index,
          explanation: q.explanation,
          order_index: q.order_index
        }));

        await supabase.from('topic_questions').insert(newQuestions);
      }

      await supabase.from('teacher_activities').insert({
        teacher_id: user.user.id,
        activity_type: 'quiz_duplicated',
        title: `${name} (Copy)`,
        metadata: { original_id: quizId }
      });

      alert('Quiz duplicated successfully!');
      loadQuizzes();
    } catch (err) {
      console.error('Failed to duplicate quiz:', err);
      alert('Failed to duplicate quiz');
    }
  }

  async function togglePublish(quizId: string, name: string, currentStatus: boolean) {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const newStatus = currentStatus ? 'draft' : 'approved';

      const { error } = await supabase
        .from('question_sets')
        .update({ approval_status: newStatus })
        .eq('id', quizId);

      if (error) {
        console.error('Failed to toggle publish:', error);
        alert('Failed to update quiz status');
        return;
      }

      await supabase.from('teacher_activities').insert({
        teacher_id: user.user.id,
        activity_type: currentStatus ? 'quiz_unpublished' : 'quiz_published',
        title: name,
        entity_id: quizId
      });

      alert(`Quiz ${currentStatus ? 'unpublished' : 'published'} successfully!`);
      loadQuizzes();
    } catch (err) {
      console.error('Failed to toggle publish:', err);
      alert('Failed to update quiz status');
    }
  }

  async function archiveQuiz(quizId: string, name: string) {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { error } = await supabase
        .from('question_sets')
        .update({ is_active: false })
        .eq('id', quizId);

      if (error) {
        console.error('Failed to archive quiz:', error);
        alert('Failed to archive quiz');
        return;
      }

      await supabase.from('teacher_activities').insert({
        teacher_id: user.user.id,
        activity_type: 'quiz_archived',
        title: name
      });

      alert('Quiz archived successfully!');
      loadQuizzes();
    } catch (err) {
      console.error('Failed to archive quiz:', err);
      alert('Failed to archive quiz');
    }
  }

  async function deleteDraft(draftId: string) {
    try {
      const { error } = await supabase
        .from('teacher_quiz_drafts')
        .delete()
        .eq('id', draftId);

      if (error) {
        console.error('Failed to delete draft:', error);
        alert('Failed to delete draft');
        return;
      }

      alert('Draft deleted successfully!');
      loadQuizzes();
    } catch (err) {
      console.error('Failed to delete draft:', err);
      alert('Failed to delete draft');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">My Quizzes</h1>
        <button
          onClick={() => navigate('/teacherdashboard?tab=create-quiz')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Quiz
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search quizzes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Subjects</option>
            <option value="mathematics">Mathematics</option>
            <option value="science">Science</option>
            <option value="english">English</option>
            <option value="computing">Computing</option>
            <option value="business">Business</option>
            <option value="other">Other</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      {filteredQuizzes.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {quizzes.length === 0 ? 'No quizzes yet' : 'No quizzes match your filters'}
          </h3>
          <p className="text-gray-600 mb-6">
            {quizzes.length === 0
              ? 'Create your first quiz to get started!'
              : 'Try adjusting your search or filters'}
          </p>
          {quizzes.length === 0 && (
            <button
              onClick={() => navigate('/teacherdashboard?tab=create-quiz')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create Your First Quiz
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Quiz Name</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Subject</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Plays</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Created</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuizzes.map((quiz) => (
                <tr key={quiz.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm font-medium text-gray-900">{quiz.name}</td>
                  <td className="py-3 px-4 text-sm text-gray-600 capitalize">{quiz.subject}</td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        quiz.is_draft
                          ? 'bg-yellow-100 text-yellow-800'
                          : quiz.is_published
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {quiz.is_draft ? 'Draft (In Progress)' : quiz.is_published ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-center text-gray-900">{quiz.plays}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {new Date(quiz.created_at).toLocaleDateString('en-GB')}
                  </td>
                  <td className="py-3 px-4 text-sm text-right">
                    <div className="flex items-center justify-end gap-2">
                      {quiz.is_draft ? (
                        <>
                          <button
                            onClick={() => navigate(`/teacherdashboard?tab=create-quiz&draft=${quiz.draft_id}`)}
                            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium"
                            title="Resume editing"
                          >
                            Continue Editing
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete draft "${quiz.name}"?`)) {
                                deleteDraft(quiz.draft_id!);
                              }
                            }}
                            className="p-1 hover:bg-red-50 rounded text-red-600"
                            title="Delete draft"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => window.open(`/quiz/${quiz.slug}`, '_blank')}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="Preview"
                          >
                            <Eye className="w-4 h-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/quiz/${quiz.slug}`);
                              alert('Link copied!');
                            }}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="Share"
                          >
                            <Share2 className="w-4 h-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => navigate(`/teacherdashboard?tab=edit-quiz&id=${quiz.id}`)}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => togglePublish(quiz.id, quiz.name, quiz.is_published)}
                            className="p-1 hover:bg-gray-100 rounded"
                            title={quiz.is_published ? 'Unpublish' : 'Publish'}
                          >
                            {quiz.is_published ? (
                              <EyeOff className="w-4 h-4 text-gray-600" />
                            ) : (
                              <Eye className="w-4 h-4 text-green-600" />
                            )}
                          </button>
                          <button
                            onClick={() => duplicateQuiz(quiz.id, quiz.name)}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="Duplicate"
                          >
                            <Copy className="w-4 h-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Archive "${quiz.name}"?`)) {
                                archiveQuiz(quiz.id, quiz.name);
                              }
                            }}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="Archive"
                          >
                            <Archive className="w-4 h-4 text-gray-600" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  FileText,
  CheckCircle,
  FilePlus,
  Loader2,
  Plus,
  ChevronRight,
} from 'lucide-react';

interface BasicMetrics {
  totalQuizzes: number;
  publishedQuizzes: number;
  draftQuizzes: number;
  lastPublishedAt: string | null;
}

export function OverviewPage() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<BasicMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBasicMetrics();
  }, []);

  async function loadBasicMetrics() {
    try {
      setLoading(true);
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data: questionSets } = await supabase
        .from('question_sets')
        .select('id, approval_status, is_active, created_at')
        .eq('created_by', user.user.id)
        .eq('is_active', true);

      const { data: drafts } = await supabase
        .from('teacher_quiz_drafts')
        .select('id')
        .eq('teacher_id', user.user.id)
        .eq('is_published', false);

      const published = (questionSets || []).filter(
        (qs) => qs.approval_status === 'approved'
      );
      const unpublished = (questionSets || []).filter(
        (qs) => qs.approval_status !== 'approved'
      );

      const allDrafts = unpublished.length + (drafts?.length || 0);

      const sortedPublished = [...published].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setMetrics({
        totalQuizzes: (questionSets?.length || 0) + (drafts?.length || 0),
        publishedQuizzes: published.length,
        draftQuizzes: allDrafts,
        lastPublishedAt: sortedPublished[0]?.created_at || null,
      });
    } catch (err) {
      console.error('Failed to load basic metrics:', err);
    } finally {
      setLoading(false);
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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Your quiz overview at a glance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Quizzes</p>
              <p className="text-2xl font-bold text-gray-900">
                {metrics?.totalQuizzes ?? 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Published</p>
              <p className="text-2xl font-bold text-gray-900">
                {metrics?.publishedQuizzes ?? 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <FilePlus className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Drafts</p>
              <p className="text-2xl font-bold text-gray-900">
                {metrics?.draftQuizzes ?? 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {metrics?.lastPublishedAt && (
        <p className="text-sm text-gray-500">
          Last published:{' '}
          {new Date(metrics.lastPublishedAt).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      )}

      {metrics?.publishedQuizzes === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-10 text-center">
          <FileText className="w-14 h-14 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            You haven't published any quizzes yet
          </h3>
          <p className="text-gray-600 mb-6">
            Create a quiz and publish it so students can start playing.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => navigate('/teacherdashboard?tab=create-quiz')}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Quiz
            </button>
            <button
              onClick={() => navigate('/teacherdashboard?tab=my-quizzes')}
              className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 inline-flex items-center gap-2"
            >
              My Quizzes
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/teacherdashboard?tab=create-quiz')}
          className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow text-left"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg mb-1">Create New Quiz</h3>
              <p className="text-sm text-blue-100">Build custom assessments</p>
            </div>
            <ChevronRight className="w-6 h-6" />
          </div>
        </button>

        <button
          onClick={() => navigate('/teacherdashboard?tab=my-quizzes')}
          className="bg-gradient-to-br from-gray-600 to-gray-700 text-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow text-left"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg mb-1">My Quizzes</h3>
              <p className="text-sm text-gray-300">
                Manage your published and draft quizzes
              </p>
            </div>
            <ChevronRight className="w-6 h-6" />
          </div>
        </button>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { GlobalHeader } from '../../components/global/GlobalHeader';
import { SEOHead } from '../../components/SEOHead';
import { findSubjectById } from '../../lib/globalData';
import { supabase } from '../../lib/supabase';
import { Target, Clock } from 'lucide-react';

interface TopicWithQuizzes {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  quizzes: QuizInfo[];
}

interface QuizInfo {
  id: string;
  title: string;
  difficulty: string | null;
  questionCount: number;
  timer_seconds: number | null;
}

export function SubjectTopicsPage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const [topics, setTopics] = useState<TopicWithQuizzes[]>([]);
  const [loading, setLoading] = useState(true);

  const subject = subjectId ? findSubjectById(subjectId) : null;
  const Icon = subject?.icon;

  useEffect(() => {
    async function loadTopics() {
      if (!subjectId) return;

      try {
        // Get all topics for this subject
        const { data: topicsData, error } = await supabase
          .from('topics')
          .select('id, name, slug, description')
          .eq('subject', subjectId)
          .is('school_id', null)
          .order('name');

        if (error) {
          console.error('Error loading topics:', error);
          return;
        }

        if (topicsData) {
          // Get quizzes for each topic
          const topicsWithQuizzes = await Promise.all(
            topicsData.map(async (topic) => {
              const { data: quizzes } = await supabase
                .from('question_sets')
                .select('id, title, difficulty, timer_seconds')
                .eq('topic_id', topic.id)
                .eq('approval_status', 'approved')
                .is('school_id', null)
                .order('created_at', { ascending: false });

              // Get question counts for each quiz
              const quizzesWithCounts = await Promise.all(
                (quizzes || []).map(async (quiz) => {
                  const { count } = await supabase
                    .from('topic_questions')
                    .select('*', { count: 'exact', head: true })
                    .eq('question_set_id', quiz.id);

                  return {
                    id: quiz.id,
                    title: quiz.title,
                    difficulty: quiz.difficulty,
                    timer_seconds: quiz.timer_seconds,
                    questionCount: count || 0,
                  };
                })
              );

              return {
                id: topic.id,
                name: topic.name,
                slug: topic.slug,
                description: topic.description,
                quizzes: quizzesWithCounts.filter(q => q.questionCount > 0),
              };
            })
          );

          // Only show topics that have quizzes
          setTopics(topicsWithQuizzes.filter(t => t.quizzes.length > 0));
        }
      } catch (error) {
        console.error('Error loading topics:', error);
      } finally {
        setLoading(false);
      }
    }

    loadTopics();
  }, [subjectId]);

  const breadcrumbs = [
    { label: 'Explore', href: '/explore' },
    { label: 'All Subjects', href: '/subjects' },
    { label: subject?.name || 'Subject' },
  ];

  const getDifficultyColor = (difficulty: string | null) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'hard': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <SEOHead
        title={`${subject?.name || 'Subject'} Quizzes - StartSprint`}
        description={`Explore ${subject?.name || 'subject'} quizzes from teachers worldwide`}
      />

      <GlobalHeader breadcrumbs={breadcrumbs} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          {Icon && (
            <div className="inline-flex p-6 rounded-2xl bg-gray-800 mb-6">
              <Icon className={`w-16 h-16 ${subject.color}`} />
            </div>
          )}
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            {subject?.name || 'Subject'}
          </h1>
          <p className="text-lg text-gray-400">
            {topics.reduce((sum, t) => sum + t.quizzes.length, 0)} quizzes across {topics.length} topics
          </p>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
            <p className="text-gray-400 mt-4">Loading topics...</p>
          </div>
        ) : topics.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">No topics available for this subject yet.</p>
            <Link to="/subjects" className="inline-block mt-4 text-blue-400 hover:text-blue-300">
              ← Back to all subjects
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {topics.map((topic) => (
              <div key={topic.id} className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                {/* Topic Header */}
                <div className="mb-4">
                  <h2 className="text-2xl font-bold text-white mb-2">{topic.name}</h2>
                  {topic.description && (
                    <p className="text-gray-400">{topic.description}</p>
                  )}
                </div>

                {/* Quizzes Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {topic.quizzes.map((quiz) => (
                    <Link
                      key={quiz.id}
                      to={`/quiz/${quiz.id}`}
                      className="group bg-gray-700 hover:bg-gray-600 rounded-lg border border-gray-600 hover:border-blue-500 transition-all p-4"
                    >
                      <div className="flex items-start justify-between mb-2">
                        {quiz.difficulty && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getDifficultyColor(quiz.difficulty)}`}>
                            {quiz.difficulty}
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors mb-3 line-clamp-2">
                        {quiz.title}
                      </h3>

                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <div className="flex items-center gap-1">
                          <Target className="w-4 h-4" />
                          <span>{quiz.questionCount} questions</span>
                        </div>
                        {quiz.timer_seconds && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{Math.floor(quiz.timer_seconds / 60)}m</span>
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

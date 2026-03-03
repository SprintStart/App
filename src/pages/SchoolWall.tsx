import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { startTopicRun } from '../lib/api';
import { QuestionChallenge } from '../components/QuestionChallenge';
import { EndScreen } from '../components/EndScreen';
import { ImmersiveProvider } from '../contexts/ImmersiveContext';
import { OptimizedImage } from '../components/OptimizedImage';
import { Play, ArrowLeft, BookOpen, Clock, AlertCircle } from 'lucide-react';

interface SchoolData {
  id: string;
  school_name: string;
  slug: string;
}

interface TopicWithQuizzes {
  id: string;
  name: string;
  subject: string;
  description: string | null;
  quizzes: Array<{
    id: string;
    title: string;
    difficulty: string | null;
    question_count: number;
  }>;
}

type WallView = 'topics' | 'quiz' | 'end';

function SchoolWallContent() {
  const { slug } = useParams<{ slug: string }>();
  const [school, setSchool] = useState<SchoolData | null>(null);
  const [topics, setTopics] = useState<TopicWithQuizzes[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [view, setView] = useState<WallView>('topics');
  const [quizState, setQuizState] = useState<{
    runId: string;
    topicId: string;
    questions: Array<{ id: string; question_text: string; options: string[]; image_url?: string | null }>;
  } | null>(null);
  const [endState, setEndState] = useState<{ type: 'completed' | 'game_over'; summary: any } | null>(null);
  const [startingQuiz, setStartingQuiz] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) loadSchoolData(slug);
  }, [slug]);

  async function loadSchoolData(schoolSlug: string) {
    try {
      setLoading(true);
      const { data: schoolData, error: schoolErr } = await supabase
        .from('schools')
        .select('id, school_name, slug')
        .eq('slug', schoolSlug)
        .eq('is_active', true)
        .maybeSingle();

      if (schoolErr || !schoolData) {
        setNotFound(true);
        return;
      }

      setSchool(schoolData);

      const { data: topicsData } = await supabase
        .from('topics')
        .select('id, name, subject, description')
        .eq('school_id', schoolData.id)
        .eq('is_active', true)
        .eq('is_published', true)
        .order('name');

      const topicsWithQuizzes: TopicWithQuizzes[] = [];

      for (const topic of topicsData || []) {
        const { data: quizzes } = await supabase
          .from('question_sets')
          .select('id, title, difficulty, question_count')
          .eq('topic_id', topic.id)
          .eq('is_active', true)
          .eq('approval_status', 'approved')
          .order('title');

        if (quizzes && quizzes.length > 0) {
          topicsWithQuizzes.push({ ...topic, quizzes });
        }
      }

      setTopics(topicsWithQuizzes);
    } catch (err) {
      console.error('Failed to load school data:', err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleStartQuiz(topicId: string) {
    setStartingQuiz(true);
    setQuizError(null);
    try {
      const response = await startTopicRun(topicId);
      if (!response.success || !response.runId || !response.questions) {
        setQuizError(response.error || 'Failed to start quiz');
        return;
      }
      setQuizState({
        runId: response.runId,
        topicId,
        questions: response.questions,
      });
      setView('quiz');
    } catch (err) {
      setQuizError('Connection error. Please try again.');
    } finally {
      setStartingQuiz(false);
    }
  }

  function handleComplete(summary: any) {
    setEndState({ type: 'completed', summary });
    setView('end');
  }

  function handleGameOver(summary: any) {
    setEndState({ type: 'game_over', summary });
    setView('end');
  }

  function handleRetry() {
    if (quizState) {
      handleStartQuiz(quizState.topicId);
    }
  }

  function handleNewQuiz() {
    setView('topics');
    setQuizState(null);
    setEndState(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">School Not Found</h1>
          <p className="text-gray-600 mb-6">This school page does not exist or has been deactivated.</p>
          <Link to="/" className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <ArrowLeft className="w-4 h-4" />
            Go to Homepage
          </Link>
        </div>
      </div>
    );
  }

  if (view === 'quiz' && quizState) {
    return (
      <QuestionChallenge
        runId={quizState.runId}
        questions={quizState.questions}
        onComplete={handleComplete}
        onGameOver={handleGameOver}
      />
    );
  }

  if (view === 'end' && endState) {
    return (
      <EndScreen
        type={endState.type}
        summary={endState.summary}
        onRetry={handleRetry}
        onNewTopic={handleNewQuiz}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <OptimizedImage
                  src="/startsprint_logo.png"
                  alt="StartSprint"
                  className="h-10 w-auto"
                  width={120}
                  height={40}
                />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-3">{school?.school_name}</h1>
              <p className="text-gray-600 mt-1">Select a topic and start a quiz -- no sign-up required</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 sm:px-6">
        {quizError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            {quizError}
          </div>
        )}

        {topics.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No quizzes available yet</h2>
            <p className="text-gray-500">Check back soon -- teachers are preparing content for this school.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {topics.map((topic) => (
              <div key={topic.id}>
                <div className="mb-4">
                  <h2 className="text-xl font-bold text-gray-900">{topic.name}</h2>
                  <p className="text-sm text-gray-500 capitalize">{topic.subject}</p>
                  {topic.description && <p className="text-gray-600 mt-1 text-sm">{topic.description}</p>}
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {topic.quizzes.map((quiz) => (
                    <button
                      key={quiz.id}
                      onClick={() => handleStartQuiz(topic.id)}
                      disabled={startingQuiz}
                      className="text-left bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-400 hover:shadow-lg transition-all group disabled:opacity-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">{quiz.title}</h3>
                          <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                            {quiz.difficulty && (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                quiz.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                                quiz.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {quiz.difficulty}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {quiz.question_count} Qs
                            </span>
                          </div>
                        </div>
                        <div className="bg-blue-100 rounded-full p-2 group-hover:bg-blue-600 transition-colors">
                          <Play className="w-5 h-5 text-blue-600 group-hover:text-white transition-colors" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export function SchoolWall() {
  return (
    <ImmersiveProvider>
      <SchoolWallContent />
    </ImmersiveProvider>
  );
}

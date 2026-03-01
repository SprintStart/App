import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Play, BookOpen, Clock, BarChart3, CheckCircle } from 'lucide-react';

interface Question {
  id: string;
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string;
  order_index: number;
  image_url?: string;
}

interface QuestionSet {
  id: string;
  title: string;
  difficulty: string;
  question_count: number;
  topic_id: string;
  topic: {
    id: string;
    name: string;
    subject: string;
  };
}

export function QuizPreview() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [questionSet, setQuestionSet] = useState<QuestionSet | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadQuizData();
  }, [slug]);

  async function loadQuizData() {
    if (!slug) {
      setError('Invalid quiz URL');
      setLoading(false);
      return;
    }

    try {
      // Extract UUID from slug using regex (UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
      const uuidMatch = slug.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);

      if (!uuidMatch) {
        setError('Invalid quiz URL format');
        setLoading(false);
        return;
      }

      const quizId = uuidMatch[0];

      console.log('[QuizPreview] Loading quiz:', { slug, quizId });

      // Fetch question set with topic info
      const { data: qsData, error: qsError } = await supabase
        .from('question_sets')
        .select(`
          id,
          title,
          difficulty,
          question_count,
          topic_id,
          topic:topics (
            id,
            name,
            subject
          )
        `)
        .eq('id', quizId)
        .maybeSingle();

      if (qsError) {
        console.error('[QuizPreview] Error loading question set:', qsError);
        throw qsError;
      }

      if (!qsData) {
        setError('Quiz not found');
        setLoading(false);
        return;
      }

      // Transform the data to match the expected structure
      const transformedData = {
        ...qsData,
        topic: Array.isArray(qsData.topic) ? qsData.topic[0] : qsData.topic
      };

      setQuestionSet(transformedData as any);

      // Fetch questions
      const { data: questionsData, error: questionsError } = await supabase
        .from('topic_questions')
        .select('*')
        .eq('question_set_id', quizId)
        .order('order_index', { ascending: true });

      if (questionsError) {
        console.error('[QuizPreview] Error loading questions:', questionsError);
        throw questionsError;
      }

      setQuestions(questionsData || []);
    } catch (err: any) {
      console.error('[QuizPreview] Error:', err);
      setError(err.message || 'Failed to load quiz');
    } finally {
      setLoading(false);
    }
  }

  function handleStartQuiz() {
    if (questionSet?.id) {
      console.log('[QuizPreview] Starting quiz, navigating to /play/', questionSet.id);
      navigate(`/play/${questionSet.id}`);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-gray-600 text-xl">Loading quiz...</div>
      </div>
    );
  }

  if (error || !questionSet) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Quiz Not Found</h1>
          <p className="text-gray-600 mb-6">
            {error || 'This quiz does not exist or has been removed.'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const difficultyColors = {
    easy: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    hard: 'bg-red-100 text-red-800'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <button
            onClick={handleStartQuiz}
            className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Play className="w-5 h-5" />
            <span>Start Quiz</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Quiz Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-medium">
                  {questionSet.topic.subject}
                </span>
                <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full font-medium">
                  {questionSet.topic.name}
                </span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {questionSet.title}
              </h1>
            </div>
            {questionSet.difficulty && (
              <span className={`px-4 py-2 rounded-lg font-semibold text-sm ${difficultyColors[questionSet.difficulty as keyof typeof difficultyColors] || 'bg-gray-100 text-gray-800'}`}>
                {questionSet.difficulty.charAt(0).toUpperCase() + questionSet.difficulty.slice(1)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-6 text-gray-600">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              <span>{questions.length} Questions</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <span>~{Math.ceil(questions.length * 1.5)} mins</span>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              <span>2 Attempts per Question</span>
            </div>
          </div>
        </div>

        {/* Quiz Info Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">About This Quiz</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <BookOpen className="w-6 h-6 text-blue-600" />
                <span className="font-semibold text-gray-900">Questions</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{questions.length}</p>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-6 h-6 text-purple-600" />
                <span className="font-semibold text-gray-900">Estimated Time</span>
              </div>
              <p className="text-2xl font-bold text-purple-600">~{Math.ceil(questions.length * 1.5)} mins</p>
            </div>

            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <BarChart3 className="w-6 h-6 text-green-600" />
                <span className="font-semibold text-gray-900">Attempts</span>
              </div>
              <p className="text-2xl font-bold text-green-600">2 per question</p>
            </div>

            <div className="p-4 bg-red-50 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-6 h-6 text-red-600" />
                <span className="font-semibold text-gray-900">Game Over</span>
              </div>
              <p className="text-2xl font-bold text-red-600">3 mistakes</p>
            </div>
          </div>

          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  No peeking! Questions will be revealed during the quiz.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-xl p-8 text-center">
          <h3 className="text-2xl font-bold text-white mb-4">
            Ready to test your knowledge?
          </h3>
          <p className="text-blue-100 mb-6">
            You'll have 2 attempts per question. Get 3 questions wrong and it's game over!
          </p>
          <button
            onClick={handleStartQuiz}
            className="px-8 py-4 bg-white text-blue-600 rounded-lg font-bold text-lg hover:bg-blue-50 transition-colors inline-flex items-center gap-3"
          >
            <Play className="w-6 h-6" />
            Start Quiz Now
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, Target, Users } from 'lucide-react';
import { SEOHead } from '../../components/SEOHead';
import { QuestionChallenge } from '../../components/QuestionChallenge';
import { EndScreen } from '../../components/EndScreen';
import { ImmersiveProvider } from '../../contexts/ImmersiveContext';
import { findSubjectById } from '../../lib/globalData';
import { supabase } from '../../lib/supabase';
import { startTopicRun } from '../../lib/api';

interface QuestionSet {
  id: string;
  title: string;
  description: string | null;
  difficulty: string;
  timer_seconds: number | null;
  question_count: number;
  teacher_name: string | null;
}

interface Question {
  id: string;
  question_text: string;
  options: string[];
  image_url?: string;
}

type ViewState = 'browse' | 'playing' | 'ended';

export function SchoolTopicPage() {
  const { schoolSlug, subjectSlug, topicSlug } = useParams<{ schoolSlug: string; subjectSlug: string; topicSlug: string }>();
  const navigate = useNavigate();
  const subject = subjectSlug ? findSubjectById(subjectSlug) : null;

  console.log('[SchoolTopicPage] URL params:', { schoolSlug, subjectSlug, topicSlug });

  const [school, setSchool] = useState<any>(null);
  const [topic, setTopic] = useState<any>(null);
  const [quizzes, setQuizzes] = useState<QuestionSet[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewState, setViewState] = useState<ViewState>('browse');
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [currentQuestions, setCurrentQuestions] = useState<Question[]>([]);
  const [currentTimerSeconds, setCurrentTimerSeconds] = useState<number | null>(null);
  const [endSummary, setEndSummary] = useState<any>(null);
  const [endType, setEndType] = useState<'completed' | 'game_over'>('completed');

  useEffect(() => {
    async function loadData() {
      console.log('[SchoolTopicPage] loadData called with:', { schoolSlug, topicSlug });

      if (!schoolSlug || !topicSlug) {
        console.log('[SchoolTopicPage] Missing required params');
        return;
      }

      try {
        console.log('[SchoolTopicPage] Fetching school data...');
        const { data: schoolData } = await supabase
          .from('schools')
          .select('*')
          .eq('slug', schoolSlug)
          .eq('is_active', true)
          .maybeSingle();

        console.log('[SchoolTopicPage] School data:', schoolData);

        if (schoolData) {
          setSchool(schoolData);

          const { data: topicData, error: topicError } = await supabase
            .from('topics')
            .select('*')
            .eq('slug', topicSlug)
            .eq('school_id', schoolData.id)
            .eq('is_published', true)
            .maybeSingle();

          if (topicError) {
            console.error('[SchoolTopicPage] Topic query error:', topicError);
          }

          if (!topicData) {
            console.error('[SchoolTopicPage] Topic not found. URL slug:', topicSlug, 'School ID:', schoolData.id);
          }

          console.log('[SchoolTopicPage] Topic data:', topicData);

          if (topicData) {
            setTopic(topicData);

            console.log('[SchoolTopicPage] Fetching quizzes for topic:', topicData.id);

            const { data: quizzesData, error: quizzesError } = await supabase
              .from('question_sets')
              .select('id, title, description, difficulty, timer_seconds, created_by')
              .eq('topic_id', topicData.id)
              .eq('is_active', true)
              .eq('approval_status', 'approved')
              .order('created_at', { ascending: false });

            console.log('[SchoolTopicPage] Quizzes data:', quizzesData);

            if (quizzesError) {
              console.error('[SchoolTopicPage] Quiz query error:', quizzesError);
            }

            if (quizzesData) {
              console.log('[SchoolTopicPage] Processing', quizzesData.length, 'quizzes');
              const quizzesWithCounts = await Promise.all(
                quizzesData.map(async (quiz: any) => {
                  const { count } = await supabase
                    .from('topic_questions')
                    .select('*', { count: 'exact', head: true })
                    .eq('question_set_id', quiz.id);

                  // Fetch teacher name separately
                  let teacherName = 'Anonymous';
                  if (quiz.created_by) {
                    const { data: profile } = await supabase
                      .from('profiles')
                      .select('full_name')
                      .eq('id', quiz.created_by)
                      .maybeSingle();

                    if (profile?.full_name) {
                      teacherName = profile.full_name;
                    }
                  }

                  return {
                    id: quiz.id,
                    title: quiz.title,
                    description: quiz.description,
                    difficulty: quiz.difficulty || 'medium',
                    timer_seconds: quiz.timer_seconds,
                    question_count: count || 0,
                    teacher_name: teacherName,
                  };
                })
              );

              console.log('[SchoolTopicPage] Quizzes with counts:', quizzesWithCounts);
              setQuizzes(quizzesWithCounts);
              console.log('[SchoolTopicPage] Quizzes state set successfully');
            }
          }
        }
      } catch (error) {
        console.error('[SchoolTopicPage] Error loading data:', error);
      } finally {
        console.log('[SchoolTopicPage] Loading complete');
        setLoading(false);
      }
    }

    loadData();
  }, [schoolSlug, topicSlug]);

  async function handlePlayQuiz(topicId: string, timerSeconds: number | null) {
    const response = await startTopicRun(topicId);
    if (response.success && response.runId && response.questions) {
      setCurrentRunId(response.runId);
      setCurrentQuestions(response.questions);
      setCurrentTimerSeconds(timerSeconds);
      setViewState('playing');
    } else {
      alert(response.error || 'Failed to start quiz');
    }
  }

  function handleQuizComplete(summary: any) {
    setEndSummary(summary);
    setEndType('completed');
    setViewState('ended');
  }

  function handleGameOver(summary: any) {
    setEndSummary(summary);
    setEndType('game_over');
    setViewState('ended');
  }

  function handleRetry() {
    if (topic) {
      handlePlayQuiz(topic.id, currentTimerSeconds);
    }
  }

  function handleNewTopic() {
    setViewState('browse');
    setCurrentRunId(null);
    setCurrentQuestions([]);
    setEndSummary(null);
  }

  function handleExplore() {
    navigate(`/${schoolSlug}/${subjectSlug}`);
  }

  if (viewState === 'playing' && currentRunId && currentQuestions.length > 0) {
    return (
      <ImmersiveProvider>
        <QuestionChallenge
          runId={currentRunId}
          questions={currentQuestions}
          onComplete={handleQuizComplete}
          onGameOver={handleGameOver}
          timerSeconds={currentTimerSeconds || undefined}
        />
      </ImmersiveProvider>
    );
  }

  if (viewState === 'ended' && endSummary) {
    return (
      <ImmersiveProvider>
        <EndScreen
          type={endType}
          summary={endSummary}
          onRetry={handleRetry}
          onNewTopic={handleNewTopic}
          onExplore={handleExplore}
          // No onTeacherLogin - Teacher Login removed from school walls
        />
      </ImmersiveProvider>
    );
  }

  if (!subject) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <p className="text-gray-300 text-xl">Subject not found</p>
      </div>
    );
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'hard': return 'bg-red-500/20 text-red-300 border-red-500/30';
      default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <SEOHead
        title={`StartSprint - ${topic?.name || 'Topic'} Quizzes`}
        description={topic?.description || `${topic?.name} quizzes. Test your knowledge with interactive quizzes.`}
      />

      <header className="bg-slate-900/50 backdrop-blur-sm border-b border-blue-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            to={`/${schoolSlug}/${subjectSlug}`}
            className="inline-flex items-center gap-2 text-blue-300 hover:text-blue-200 mb-4 font-medium"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Back to {subject.name}</span>
          </Link>

          <h1 className="text-3xl font-black text-white">{topic?.name}</h1>
          {topic?.description && (
            <p className="text-gray-300 mt-2">{topic.description}</p>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
          </div>
        ) : quizzes.length === 0 ? (
          <div className="text-center py-12 bg-slate-800/50 backdrop-blur-sm border border-blue-500/20 rounded-2xl p-16">
            <p className="text-gray-300 text-xl font-bold mb-2">No quizzes available yet</p>
            <p className="text-gray-400">Teachers will publish quizzes soon</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {quizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="bg-slate-800/50 backdrop-blur-sm border-2 border-blue-500/20 hover:border-blue-400 hover:bg-slate-800/70 rounded-2xl shadow-lg hover:shadow-blue-500/20 transition-all p-8"
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-2xl font-black text-white flex-1">{quiz.title}</h3>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-bold border-2 ${getDifficultyColor(quiz.difficulty)}`}
                  >
                    {quiz.difficulty}
                  </span>
                </div>

                {quiz.description && (
                  <p className="text-gray-300 mb-6">{quiz.description}</p>
                )}

                <div className="flex items-center gap-6 text-gray-400 mb-6">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    <span className="font-medium">{quiz.question_count} questions</span>
                  </div>
                  {quiz.teacher_name && (
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      <span className="font-medium">{quiz.teacher_name}</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => navigate(`/play/${quiz.id}`)}
                  className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-lg font-black rounded-xl transition-all shadow-lg hover:shadow-blue-500/30"
                >
                  Start Quiz
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

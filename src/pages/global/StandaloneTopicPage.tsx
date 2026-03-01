import { useEffect, useState } from 'react';
import { useParams, Navigate, useNavigate } from 'react-router-dom';
import { GlobalHeader } from '../../components/global/GlobalHeader';
import { SEOHead } from '../../components/SEOHead';
import { QuestionChallenge } from '../../components/QuestionChallenge';
import { EndScreen } from '../../components/EndScreen';
import { ImmersiveProvider } from '../../contexts/ImmersiveContext';
import { findSubjectById } from '../../lib/globalData';
import { supabase } from '../../lib/supabase';
import { startTopicRun } from '../../lib/api';
import { Target, Users } from 'lucide-react';

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

export function StandaloneTopicPage() {
  const { topicSlug } = useParams<{ topicSlug: string }>();
  const navigate = useNavigate();

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
    async function loadTopicData() {
      if (!topicSlug) return;

      try {
        const { data: topicData } = await supabase
          .from('topics')
          .select('*')
          .eq('slug', topicSlug)
          .eq('is_published', true)
          .eq('is_active', true)
          .is('school_id', null)
          .maybeSingle();

        if (topicData) {
          setTopic(topicData);

          const { data: quizzesData } = await supabase
            .from('question_sets')
            .select(`
              id,
              title,
              description,
              difficulty,
              timer_seconds,
              created_by,
              profiles(full_name)
            `)
            .eq('topic_id', topicData.id)
            .eq('approval_status', 'approved')
            .order('created_at', { ascending: false });

          if (quizzesData) {
            const quizzesWithCounts = await Promise.all(
              quizzesData.map(async (quiz: any) => {
                const { count } = await supabase
                  .from('questions')
                  .select('*', { count: 'exact', head: true })
                  .eq('question_set_id', quiz.id);

                return {
                  id: quiz.id,
                  title: quiz.title,
                  description: quiz.description,
                  difficulty: quiz.difficulty || 'medium',
                  timer_seconds: quiz.timer_seconds,
                  question_count: count || 0,
                  teacher_name: quiz.profiles?.full_name || 'Anonymous',
                };
              })
            );

            setQuizzes(quizzesWithCounts);
          }
        }
      } catch (error) {
        console.error('Error loading topic:', error);
      } finally {
        setLoading(false);
      }
    }

    loadTopicData();
  }, [topicSlug]);

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
    navigate('/');
  }

  function handleTeacherLogin() {
    navigate('/teacher');
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
          onTeacherLogin={handleTeacherLogin}
        />
      </ImmersiveProvider>
    );
  }

  const breadcrumbs = [
    { label: 'Global Library', href: '/' },
    { label: topic?.name || '' },
  ];

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'hard': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const subjectData = topic?.subject ? findSubjectById(topic.subject) : null;
  const Icon = subjectData?.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <SEOHead
        title={`${topic?.name || 'Topic'} - Global Quiz Library - StartSprint`}
        description={topic?.description || `Explore ${topic?.name} quizzes`}
      />

      <GlobalHeader breadcrumbs={breadcrumbs} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : !topic ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">Topic not found</p>
          </div>
        ) : (
          <>
            <div className="text-center mb-12">
              <div className="flex items-center justify-center gap-3 mb-4">
                {Icon && <Icon className={`w-12 h-12 ${subjectData.color}`} />}
                <h1 className="text-4xl md:text-5xl font-bold text-gray-900">{topic.name}</h1>
              </div>
              {topic.description && (
                <p className="text-lg text-gray-600 max-w-3xl mx-auto mb-4">{topic.description}</p>
              )}
              {subjectData && (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                  {subjectData.name}
                </div>
              )}
            </div>

            {quizzes.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No quizzes available yet for this topic.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {quizzes.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg transition-all p-6"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-xl font-bold text-gray-900 flex-1">{quiz.title}</h3>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium border ${getDifficultyColor(quiz.difficulty)}`}
                      >
                        {quiz.difficulty}
                      </span>
                    </div>

                    {quiz.description && (
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">{quiz.description}</p>
                    )}

                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                      <div className="flex items-center gap-1">
                        <Target className="w-4 h-4" />
                        <span>{quiz.question_count} questions</span>
                      </div>
                      {quiz.teacher_name && (
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>{quiz.teacher_name}</span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handlePlayQuiz(topic.id, quiz.timer_seconds)}
                      className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Play Now
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

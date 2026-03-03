import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { GlobalHeader } from '../../components/global/GlobalHeader';
import { SEOHead } from '../../components/SEOHead';
import { COUNTRIES, findSubjectById } from '../../lib/globalData';
import { supabase } from '../../lib/supabase';
import { BadgeCheck, BookOpen, Target } from 'lucide-react';
import { AdBanner } from '../../components/ads/AdBanner';
import { TrendingQuizGrid } from '../../components/global/TrendingQuizGrid';
import { PopularQuizGrid } from '../../components/global/PopularQuizGrid';
import { FEATURE_TRENDING_POPULAR } from '../../lib/featureFlags';

interface GlobalQuiz {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  question_count: number;
  difficulty: string | null;
  timer_seconds: number | null;
  topic: {
    name: string;
    subject: string;
    global_category: string | null;
  };
  profiles: {
    full_name: string;
  } | null;
}

export function GlobalHome() {
  const [globalQuizzes, setGlobalQuizzes] = useState<GlobalQuiz[]>([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(true);

  useEffect(() => {
    async function loadGlobalQuizzes() {
      try {
        // Fetch truly GLOBAL quizzes only (no exam_system_id, no school_id)
        // These are non-curriculum quizzes: aptitude tests, career prep, life skills, general knowledge
        const { data: quizzes, error } = await supabase
          .from('question_sets')
          .select(`
            id,
            title,
            description,
            created_at,
            difficulty,
            timer_seconds,
            topic_id
          `)
          .is('school_id', null)
          .is('exam_system_id', null)
          .eq('approval_status', 'approved')
          .order('created_at', { ascending: false })
          .limit(12);

        if (error) {
          console.error('Error loading global quizzes:', error);
          return;
        }

        if (quizzes && quizzes.length > 0) {
          // Get topic info and question counts for each quiz
          const quizzesWithCounts = await Promise.all(
            quizzes.map(async (quiz: any) => {
              // Get topic info
              const { data: topicData } = await supabase
                .from('topics')
                .select('name, subject, global_category')
                .eq('id', quiz.topic_id)
                .maybeSingle();

              // Get question count
              const { count } = await supabase
                .from('topic_questions')
                .select('*', { count: 'exact', head: true })
                .eq('question_set_id', quiz.id);

              return {
                id: quiz.id,
                title: quiz.title,
                description: quiz.description,
                created_at: quiz.created_at,
                difficulty: quiz.difficulty,
                timer_seconds: quiz.timer_seconds,
                question_count: count || 0,
                topic: topicData || { name: 'Unknown', subject: 'other', global_category: null },
                profiles: null,
              };
            })
          );

          // Only show quizzes with at least 1 question
          setGlobalQuizzes(quizzesWithCounts.filter(q => q.question_count > 0));
        }
      } catch (error) {
        console.error('Error loading global quizzes:', error);
      } finally {
        setLoadingQuizzes(false);
      }
    }

    loadGlobalQuizzes();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900">
      <SEOHead
        title="StartSprint - Global Quiz Discovery"
        description="Subjects, exams, and quizzes from classrooms worldwide"
      />

      <GlobalHeader />

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-900 text-green-300 rounded-full text-sm font-medium mb-6 border border-green-700">
            <BadgeCheck className="w-4 h-4" />
            No sign-up required
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
            Choose Your Path
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Subjects, exams, and quizzes — from classrooms worldwide.
          </p>
        </div>

        {/* Ad Banner - GLOBAL_HOME placement */}
        <AdBanner placement="GLOBAL_HOME" className="mb-8" />

        {/* Trending Quizzes Section */}
        {FEATURE_TRENDING_POPULAR && (
          <div className="mb-16">
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-white mb-2">Trending This Week</h2>
              <p className="text-gray-400">Most improved quizzes over the past 7 days</p>
            </div>
            <TrendingQuizGrid limit={6} />
          </div>
        )}

        {/* Popular Quizzes Section */}
        {FEATURE_TRENDING_POPULAR && (
          <div className="mb-16">
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-white mb-2">Popular Quizzes (30 Days)</h2>
              <p className="text-gray-400">Most played quizzes in the past month</p>
            </div>
            <PopularQuizGrid limit={6} />
          </div>
        )}

        {/* Global Quiz Library Section */}
        <div className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">Global Quiz Library</h2>
              <p className="text-gray-400">Global quizzes are non-curriculum-based tests designed to build skills, reasoning ability, career readiness, and general knowledge.</p>
            </div>
            <Link to="/explore/global" className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors">
              <span className="text-sm font-medium">View all</span>
              <BookOpen className="w-5 h-5" />
            </Link>
          </div>

          {loadingQuizzes ? (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mb-4"></div>
              <p className="text-gray-400">Loading global quizzes...</p>
            </div>
          ) : globalQuizzes.length === 0 ? (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
              <p className="text-gray-400 text-lg mb-4">No global quizzes available yet</p>
              <p className="text-gray-500 text-sm">Check back soon for aptitude tests, career prep, and general knowledge quizzes</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                {globalQuizzes.slice(0, 6).map((quiz) => {
                  const subjectData = findSubjectById(quiz.topic.subject);
                  const Icon = subjectData?.icon;
                  return (
                    <Link
                      key={quiz.id}
                      to={`/quiz/${quiz.id}`}
                      className="bg-gray-800 rounded-xl border border-gray-700 hover:border-blue-500 hover:shadow-xl transition-all p-6"
                    >
                      <div className="flex items-start justify-between mb-3">
                        {Icon && <Icon className={`w-6 h-6 ${subjectData.color}`} />}
                        {quiz.difficulty && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            quiz.difficulty.toLowerCase() === 'easy' ? 'bg-green-900 text-green-300' :
                            quiz.difficulty.toLowerCase() === 'medium' ? 'bg-yellow-900 text-yellow-300' :
                            'bg-red-900 text-red-300'
                          }`}>
                            {quiz.difficulty}
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2 line-clamp-2">{quiz.title}</h3>
                      {quiz.description && (
                        <p className="text-sm text-gray-400 mb-3 line-clamp-2">{quiz.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Target className="w-4 h-4" />
                          <span>{quiz.question_count} questions</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
              {globalQuizzes.length > 6 && (
                <div className="text-center">
                  <Link
                    to="/explore/global"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    View all {globalQuizzes.length} global quizzes →
                  </Link>
                </div>
              )}
            </>
          )}
        </div>

        {/* Browse by Country Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Browse by Country & Exam</h2>
          <p className="text-gray-400 mb-6">Find quizzes organized by your curriculum</p>
        </div>

        {/* Country Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-16">
          {COUNTRIES.map((country) => (
            <div
              key={country.slug}
              className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 hover:border-blue-500 hover:shadow-2xl transition-all p-6"
            >
              {/* Country Header */}
              <div className="mb-4">
                <div className="text-4xl mb-2">{country.emoji}</div>
                <h2 className="text-2xl font-bold text-white mb-1">{country.name}</h2>
                <p className="text-sm text-gray-400">{country.description}</p>
              </div>

              {/* Exam System Links */}
              <div className="space-y-2">
                {country.exams.map((exam) => (
                  <Link
                    key={exam.slug}
                    to={`/exams/${exam.slug}`}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors group"
                  >
                    <span className="text-2xl">{exam.emoji}</span>
                    <div className="flex-1">
                      <div className="font-medium text-gray-200 group-hover:text-blue-400 transition-colors">
                        {exam.name}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Links */}
        <footer className="border-t border-gray-700 pt-8">
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-400">
            <Link to="/about" className="hover:text-white transition-colors">About</Link>
            <Link to="/mission" className="hover:text-white transition-colors">Mission</Link>
            <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link to="/ai-policy" className="hover:text-white transition-colors">AI Policy</Link>
            <Link to="/safeguarding" className="hover:text-white transition-colors">Safeguarding</Link>
            <Link to="/contact" className="hover:text-white transition-colors">Contact</Link>
          </div>
          <div className="text-center mt-4 text-sm text-gray-500">
            © {new Date().getFullYear()} StartSprint. All rights reserved.
          </div>
        </footer>
      </div>
    </div>
  );
}

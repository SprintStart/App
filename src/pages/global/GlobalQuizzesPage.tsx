import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GlobalHeader } from '../../components/global/GlobalHeader';
import { SEOHead } from '../../components/SEOHead';
import { findSubjectById, SUBJECTS } from '../../lib/globalData';
import { supabase } from '../../lib/supabase';
import { Target, Search, Filter } from 'lucide-react';
import { getCached, setCache } from '../../lib/cacheManager';

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

const GLOBAL_CATEGORIES = [
  { id: 'aptitude', name: 'Aptitude & Psychometric Tests', icon: '🧠' },
  { id: 'career_prep', name: 'Career & Employment Prep', icon: '💼' },
  { id: 'general_knowledge', name: 'General Knowledge & Trivia', icon: '🌍' },
  { id: 'life_skills', name: 'Life Skills', icon: '🎯' },
];

export function GlobalQuizzesPage() {
  const [allQuizzes, setAllQuizzes] = useState<GlobalQuiz[]>([]);
  const [filteredQuizzes, setFilteredQuizzes] = useState<GlobalQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent');

  useEffect(() => {
    async function loadAllQuizzes() {
      try {
        console.log('[GlobalQuizzesPage] Loading global quizzes...');

        // Check cache first
        const cacheKey = 'global_quizzes_list';
        const cached = getCached<GlobalQuiz[]>(cacheKey);
        if (cached) {
          console.log('[GlobalQuizzesPage] Using cached data');
          setAllQuizzes(cached);
          setFilteredQuizzes(cached);
          setLoading(false);
          return;
        }

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
            created_by,
            topics!inner(name, subject, global_category)
          `)
          .is('school_id', null)
          .is('exam_system_id', null)
          .eq('approval_status', 'approved')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(100);

        console.log('[GlobalQuizzesPage] Query result:', { quizzes, error });

        if (error) {
          console.error('[GlobalQuizzesPage] Error loading global quizzes:', error);
          return;
        }

        if (quizzes) {
          console.log('[GlobalQuizzesPage] Processing', quizzes.length, 'quizzes');

          const quizzesWithCounts = await Promise.all(
            quizzes.map(async (quiz: any) => {
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
                created_at: quiz.created_at,
                difficulty: quiz.difficulty,
                timer_seconds: quiz.timer_seconds,
                question_count: count || 0,
                topic: quiz.topics,
                profiles: { full_name: teacherName },
              };
            })
          );

          const validQuizzes = quizzesWithCounts.filter(q => q.question_count > 0);

          // Cache the results
          setCache(cacheKey, validQuizzes);

          setAllQuizzes(validQuizzes);
          setFilteredQuizzes(validQuizzes);
        }
      } catch (error) {
        console.error('Error loading global quizzes:', error);
      } finally {
        setLoading(false);
      }
    }

    loadAllQuizzes();
  }, []);

  useEffect(() => {
    let filtered = [...allQuizzes];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(quiz =>
        quiz.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        quiz.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        quiz.topic.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply subject filter
    if (selectedSubject !== 'all') {
      filtered = filtered.filter(quiz => quiz.topic.subject === selectedSubject);
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(quiz => quiz.topic.global_category === selectedCategory);
    }

    // Apply sorting
    if (sortBy === 'recent') {
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    setFilteredQuizzes(filtered);
  }, [searchTerm, selectedSubject, selectedCategory, sortBy, allQuizzes]);

  const breadcrumbs = [
    { label: 'Explore', href: '/explore' },
    { label: 'Global Quizzes' },
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <SEOHead
        title="Global Quiz Library - StartSprint"
        description="Explore quizzes from teachers worldwide on StartSprint"
      />

      <GlobalHeader breadcrumbs={breadcrumbs} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Global Quiz Library
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Global quizzes are non-curriculum-based tests designed to build skills, reasoning ability, career readiness, and general knowledge.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {allQuizzes.length} {allQuizzes.length === 1 ? 'quiz' : 'quizzes'} available
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search quizzes, topics, or subjects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Categories</option>
                {GLOBAL_CATEGORIES.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Subjects</option>
                {SUBJECTS.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Sort by:</span>
              <button
                onClick={() => setSortBy('recent')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  sortBy === 'recent'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Recently Added
              </button>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-6 text-sm text-gray-600">
          {loading ? (
            'Loading quizzes...'
          ) : (
            `Showing ${filteredQuizzes.length} of ${allQuizzes.length} quizzes`
          )}
        </div>

        {/* Quiz Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredQuizzes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg mb-4">No quizzes found matching your criteria.</p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedSubject('all');
                setSelectedCategory('all');
              }}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredQuizzes.map((quiz) => {
              const subjectData = findSubjectById(quiz.topic.subject);
              const Icon = subjectData?.icon;
              return (
                <Link
                  key={quiz.id}
                  to={`/quiz/${quiz.id}`}
                  className="group bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-blue-300 transition-all p-6"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {Icon && <Icon className={`w-6 h-6 ${subjectData.color} flex-shrink-0`} />}
                      {quiz.topic.global_category && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                          {GLOBAL_CATEGORIES.find(c => c.id === quiz.topic.global_category)?.icon}
                        </span>
                      )}
                      {quiz.difficulty && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getDifficultyColor(quiz.difficulty)}`}>
                          {quiz.difficulty}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(quiz.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors mb-2">
                    {quiz.title}
                  </h3>

                  {quiz.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{quiz.description}</p>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <span className="truncate">{quiz.topic.name}</span>
                    {subjectData && (
                      <span className="ml-2 flex-shrink-0">{subjectData.name}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Target className="w-4 h-4" />
                      <span>{quiz.question_count} questions</span>
                    </div>
                    {quiz.timer_seconds && (
                      <div className="flex items-center gap-1">
                        <span>⏱️ {Math.floor(quiz.timer_seconds / 60)}m</span>
                      </div>
                    )}
                  </div>

                  {quiz.profiles?.full_name && (
                    <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                      By {quiz.profiles.full_name}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

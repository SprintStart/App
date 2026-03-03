import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { SUBJECTS } from '../../lib/globalData';
import { supabase } from '../../lib/supabase';
import { ArrowRight, BookOpen, Trophy } from 'lucide-react';

interface SubjectWithCount {
  id: string;
  name: string;
  icon: any;
  color: string;
  topic_count: number;
}

interface Quiz {
  id: string;
  title: string;
  difficulty: string;
  question_count: number;
  subject: string;
}

export function SchoolHome() {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const [school, setSchool] = useState<any>(null);
  const [subjects, setSubjects] = useState<SubjectWithCount[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasEntered, setHasEntered] = useState(false);

  useEffect(() => {
    async function loadSchoolData() {
      if (!schoolSlug) return;

      console.log('[SchoolHome] Loading school with slug:', schoolSlug);

      try {
        const { data: schoolData } = await supabase
          .from('schools')
          .select('*')
          .eq('slug', schoolSlug)
          .eq('is_active', true)
          .maybeSingle();

        console.log('[SchoolHome] School data result:', schoolData ? `Found: ${schoolData.name}` : 'NOT FOUND');

        if (schoolData) {
          setSchool(schoolData);

          // Load topics grouped by subject
          const { data: topics } = await supabase
            .from('topics')
            .select('subject')
            .eq('school_id', schoolData.id)
            .eq('is_published', true);

          if (topics) {
            const subjectCounts = topics.reduce((acc: any, topic) => {
              if (topic.subject) {
                acc[topic.subject] = (acc[topic.subject] || 0) + 1;
              }
              return acc;
            }, {});

            const subjectsWithCounts = SUBJECTS.map((subject) => ({
              ...subject,
              topic_count: subjectCounts[subject.id] || 0,
            })).filter((s) => s.topic_count > 0);

            setSubjects(subjectsWithCounts);
          }

          // Load published quizzes for this school
          // First, get question_sets with their question counts in a single query
          const { data: quizData } = await supabase
            .from('question_sets')
            .select(`
              id,
              title,
              difficulty,
              topic_id,
              topics!inner(subject)
            `)
            .eq('school_id', schoolData.id)
            .eq('approval_status', 'approved')
            .order('created_at', { ascending: false })
            .limit(12);

          if (quizData && quizData.length > 0) {
            // Get question counts for all quizzes in parallel
            const quizzesWithDetails = await Promise.all(
              quizData.map(async (quiz: any) => {
                const { count } = await supabase
                  .from('topic_questions')
                  .select('*', { count: 'exact', head: true })
                  .eq('question_set_id', quiz.id);

                return {
                  id: quiz.id,
                  title: quiz.title,
                  difficulty: quiz.difficulty || 'medium',
                  question_count: count || 0,
                  subject: quiz.topics?.subject || 'other',
                };
              })
            );

            // Filter out quizzes with no questions - THIS is what determines the final list
            const validQuizzes = quizzesWithDetails.filter(q => q.question_count > 0);
            setQuizzes(validQuizzes);
          } else {
            setQuizzes([]);
          }
        }
      } catch (error) {
        console.error('Error loading school:', error);
      } finally {
        setLoading(false);
      }
    }

    loadSchoolData();
  }, [schoolSlug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600"></div>
      </div>
    );
  }

  if (!school) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center px-4">
          <h1 className="text-2xl font-bold text-white mb-2">School Not Found</h1>
          <p className="text-gray-400">The school you're looking for doesn't exist or is no longer active.</p>
        </div>
      </div>
    );
  }

  // Welcome Screen (before entering) - Immersive Hero matching PublicHomepage
  if (!hasEntered) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4 sm:p-6 md:p-8">
        <SEOHead
          title={`StartSprint - Interactive Quiz Wall`}
          description={`Interactive quiz wall for ${school.name}. Test your knowledge with interactive quizzes created by your teachers.`}
        />

        <div className="text-center max-w-4xl mx-auto px-4">
          {/* Title */}
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-6 text-gray-300">
            Interactive Quiz Wall
          </h1>

          {/* Main Heading */}
          <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-6 sm:mb-8 text-white leading-tight">
            Are you ready to learn?
          </h2>

          {/* Subheading */}
          <p className="text-xl sm:text-2xl md:text-3xl lg:text-4xl text-gray-300 mb-8 sm:mb-10 md:mb-12 leading-relaxed">
            Test your knowledge with interactive quizzes created by your teachers
          </p>

          {/* ENTER Button - matching PublicHomepage style */}
          <button
            onClick={() => setHasEntered(true)}
            className="group bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-12 sm:px-16 md:px-20 lg:px-24 py-5 sm:py-6 md:py-7 lg:py-8 text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black rounded-2xl transition-all shadow-2xl hover:shadow-blue-500/50 inline-flex items-center gap-4"
          >
            ENTER
            <ArrowRight className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 group-hover:translate-x-2 transition-transform" />
          </button>

          {/* Stats preview */}
          {(subjects.length > 0 || quizzes.length > 0) && (
            <div className="mt-16 sm:mt-20 flex items-center justify-center gap-8 sm:gap-12">
              <div className="text-center">
                <div className="text-5xl sm:text-6xl md:text-7xl font-black text-white mb-2">{subjects.length}</div>
                <div className="text-sm sm:text-base md:text-lg text-gray-400 font-medium">Subjects</div>
              </div>
              <div className="w-px h-16 sm:h-20 bg-gray-600" />
              <div className="text-center">
                <div className="text-5xl sm:text-6xl md:text-7xl font-black text-white mb-2">{quizzes.length}</div>
                <div className="text-sm sm:text-base md:text-lg text-gray-400 font-medium">Quizzes</div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // School Wall Content (after entering) - Keep immersive dark theme
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <SEOHead
        title={`StartSprint - Interactive Quiz Wall`}
        description={`Interactive quiz wall for ${school.name}. Test your knowledge with interactive quizzes created by your teachers.`}
      />

      {/* Header - Immersive style */}
      <header className="bg-slate-900/50 backdrop-blur-sm border-b border-blue-500/20 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-black text-white">{school.name}</h1>
          <p className="text-blue-300 mt-1">Interactive Quiz Wall</p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Subjects Section - Only section shown */}
        <section>
          <h2 className="text-3xl font-black text-white mb-8 flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-blue-400" />
            Subjects
          </h2>

          {subjects.length === 0 ? (
            <div className="bg-slate-800/50 backdrop-blur-sm border border-blue-500/20 rounded-2xl p-16 text-center">
              <BookOpen className="w-20 h-20 text-blue-400/50 mx-auto mb-6" />
              <p className="text-gray-300 text-xl font-bold mb-2">No subjects available yet</p>
              <p className="text-gray-400 text-base">Teachers will add content soon</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {subjects.map((subject) => {
                const Icon = subject.icon;
                return (
                  <Link
                    key={subject.id}
                    to={`/${schoolSlug}/${subject.id}`}
                    className="group bg-slate-800/50 backdrop-blur-sm border-2 border-blue-500/20 hover:border-blue-400 hover:bg-slate-800/70 rounded-2xl shadow-lg hover:shadow-blue-500/20 transition-all p-8 text-center"
                  >
                    <Icon className={`w-20 h-20 mx-auto mb-4 ${subject.color.replace('text-', 'text-').replace('-600', '-400')} group-hover:scale-110 transition-transform`} />
                    <h3 className="text-xl font-black text-white mb-2">{subject.name}</h3>
                    <p className="text-sm text-gray-400 font-medium">{subject.topic_count} topic{subject.topic_count !== 1 ? 's' : ''}</p>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

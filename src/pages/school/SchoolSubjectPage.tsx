import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { SEOHead } from '../../components/SEOHead';
import { findSubjectById, SCHOOL_FILTER_TABS } from '../../lib/globalData';
import { supabase } from '../../lib/supabase';

interface Topic {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  quiz_count: number;
}

export function SchoolSubjectPage() {
  const { schoolSlug, subjectSlug } = useParams<{ schoolSlug: string; subjectSlug: string }>();
  const subject = subjectSlug ? findSubjectById(subjectSlug) : null;

  const [school, setSchool] = useState<any>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [activeTab, setActiveTab] = useState('recent');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!schoolSlug || !subjectSlug) return;

      try {
        const { data: schoolData } = await supabase
          .from('schools')
          .select('*')
          .eq('slug', schoolSlug)
          .eq('is_active', true)
          .maybeSingle();

        if (schoolData) {
          setSchool(schoolData);

          const { data: topicsData } = await supabase
            .from('topics')
            .select('id, slug, name, description')
            .eq('school_id', schoolData.id)
            .eq('subject', subjectSlug)
            .eq('is_published', true)
            .order('created_at', { ascending: false });

          if (topicsData) {
            console.log('Fetched topics data:', topicsData);

            const topicsWithCounts = await Promise.all(
              topicsData.map(async (topic) => {
                const { count } = await supabase
                  .from('question_sets')
                  .select('*', { count: 'exact', head: true })
                  .eq('topic_id', topic.id)
                  .eq('approval_status', 'approved');

                console.log('Topic:', topic.name, 'Slug:', topic.slug, 'Quiz Count:', count);

                return {
                  ...topic,
                  quiz_count: count || 0,
                };
              })
            );

            const filtered = topicsWithCounts.filter((t) => t.quiz_count > 0);
            console.log('Final topics with quizzes:', filtered);
            setTopics(filtered);
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [schoolSlug, subjectSlug]);

  if (!subject) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <p className="text-gray-300 text-xl">Subject not found</p>
      </div>
    );
  }

  const Icon = subject.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <SEOHead
        title={`StartSprint - ${subject.name} Quiz Wall`}
        description={`${subject.name} quizzes for ${school?.name}. Test your knowledge with interactive quizzes.`}
      />

      <header className="bg-slate-900/50 backdrop-blur-sm border-b border-blue-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            to={`/${schoolSlug}`}
            className="inline-flex items-center gap-2 text-blue-300 hover:text-blue-200 mb-4 font-medium"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Back to Quiz Wall</span>
          </Link>

          <div className="flex items-center gap-4">
            <Icon className={`w-12 h-12 ${subject.color.replace('text-', 'text-').replace('-600', '-400')}`} />
            <div>
              <h1 className="text-3xl font-black text-white">{subject.name}</h1>
              {school && <p className="text-blue-300 mt-1">{school.name}</p>}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* UK Curriculum Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {SCHOOL_FILTER_TABS.map((tab) => {
            const isExamTab = tab.id !== 'recent';
            const isDisabled = isExamTab;

            return (
              <button
                key={tab.id}
                onClick={() => !isDisabled && setActiveTab(tab.id)}
                disabled={isDisabled}
                title={isDisabled ? 'Coming soon - Exam system filtering' : undefined}
                className={`px-6 py-3 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === tab.id && !isDisabled
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                    : isDisabled
                    ? 'bg-slate-800/30 backdrop-blur-sm text-gray-500 border-2 border-slate-600/20 cursor-not-allowed opacity-50'
                    : 'bg-slate-800/50 backdrop-blur-sm text-gray-300 hover:bg-slate-800/70 border-2 border-blue-500/20'
                }`}
              >
                <span className="mr-2">{tab.emoji}</span>
                {tab.label}
                {isDisabled && <span className="ml-2 text-xs">(Soon)</span>}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
          </div>
        ) : topics.length === 0 ? (
          <div className="text-center py-12 bg-slate-800/50 backdrop-blur-sm border border-blue-500/20 rounded-2xl p-16">
            <p className="text-gray-300 text-xl font-bold mb-2">No quizzes available yet</p>
            <p className="text-gray-400">Your teachers will publish quizzes here soon</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {topics.map((topic) => (
              <Link
                key={topic.id}
                to={`/${schoolSlug}/${subjectSlug}/${topic.slug}`}
                className="group bg-slate-800/50 backdrop-blur-sm border-2 border-blue-500/20 hover:border-blue-400 hover:bg-slate-800/70 rounded-2xl shadow-lg hover:shadow-blue-500/20 transition-all p-6"
              >
                <h3 className="text-xl font-black text-white group-hover:text-blue-300 mb-2 transition-colors">
                  {topic.name}
                </h3>
                {topic.description && (
                  <p className="text-sm text-gray-400 mb-4 line-clamp-2">{topic.description}</p>
                )}
                <div className="text-sm text-blue-400 font-medium">
                  {topic.quiz_count} quiz{topic.quiz_count !== 1 ? 'zes' : ''}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

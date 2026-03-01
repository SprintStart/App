import { useEffect, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { GlobalHeader } from '../../components/global/GlobalHeader';
import { SEOHead } from '../../components/SEOHead';
import { findExamBySlug, findSubjectById } from '../../lib/globalData';
import { supabase } from '../../lib/supabase';

interface Topic {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  quiz_count: number;
}

const FILTER_TABS = [
  { id: 'all', label: 'All', emoji: '📚' },
  { id: 'new', label: 'New', emoji: '🆕' },
  { id: 'popular', label: 'Popular', emoji: '🔥' },
  { id: 'exam-focus', label: 'Exam Focus', emoji: '🎯' },
  { id: 'foundation', label: 'Foundation', emoji: '📘' },
  { id: 'advanced', label: 'Advanced', emoji: '🎓' },
];

export function SubjectPage() {
  const { examSlug, subjectSlug } = useParams<{ examSlug: string; subjectSlug: string }>();
  const examData = examSlug ? findExamBySlug(examSlug) : null;
  const subject = subjectSlug ? findSubjectById(subjectSlug) : null;

  const [topics, setTopics] = useState<Topic[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTopics() {
      if (!subjectSlug || !examSlug) return;

      try {
        // Get country_code and exam_code from examSlug
        const examData = findExamBySlug(examSlug);
        const countryCode = examData?.country.code;
        const examCode = examData?.exam.code;

        if (!countryCode || !examCode) {
          console.error('Invalid exam slug:', examSlug);
          setLoading(false);
          return;
        }

        // Get topics with quiz counts filtered by exam
        const { data: topicsData } = await supabase
          .from('topics')
          .select(`
            id,
            slug,
            name,
            description,
            question_sets!inner(id, country_code, exam_code)
          `)
          .eq('subject', subjectSlug)
          .eq('is_published', true)
          .eq('is_active', true);

        if (topicsData) {
          // Count approved quizzes per topic for this specific exam
          const topicsWithCounts = await Promise.all(
            topicsData.map(async (topic) => {
              const { count } = await supabase
                .from('question_sets')
                .select('*', { count: 'exact', head: true })
                .eq('topic_id', topic.id)
                .eq('approval_status', 'approved')
                .eq('country_code', countryCode)
                .eq('exam_code', examCode);

              return {
                id: topic.id,
                slug: topic.slug,
                name: topic.name,
                description: topic.description,
                quiz_count: count || 0,
              };
            })
          );

          // Only show topics with at least 1 quiz for this exam
          setTopics(topicsWithCounts.filter((t) => t.quiz_count > 0));
        }
      } catch (error) {
        console.error('Error loading topics:', error);
      } finally {
        setLoading(false);
      }
    }

    loadTopics();
  }, [subjectSlug, examSlug]);

  if (!examData || !subject) {
    return <Navigate to="/" replace />;
  }

  const { exam, country } = examData;
  const Icon = subject.icon;

  const breadcrumbs = [
    { label: country.name, href: '/' },
    { label: exam.name, href: `/exams/${examSlug}` },
    { label: subject.name },
  ];

  // Filter logic (for now, 'all' shows everything, others could be implemented)
  const filteredTopics = topics;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <SEOHead
        title={`${subject.name} - ${exam.name} - StartSprint`}
        description={`Explore ${subject.name} topics for ${exam.name}`}
      />

      <GlobalHeader breadcrumbs={breadcrumbs} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Subject Header */}
        <div className="text-center mb-8">
          <Icon className={`w-16 h-16 mx-auto mb-4 ${subject.color}`} />
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-2">{subject.name}</h1>
          <p className="text-lg text-gray-600">
            {exam.name} • {country.name}
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <span className="mr-1">{tab.emoji}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Topics Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredTopics.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No topics available yet for this subject.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTopics.map((topic) => (
              <Link
                key={topic.id}
                to={`/exams/${examSlug}/${subjectSlug}/${topic.slug}`}
                className="group bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-blue-300 transition-all p-6"
              >
                <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors mb-2">
                  {topic.name}
                </h3>
                {topic.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{topic.description}</p>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{topic.quiz_count} quiz{topic.quiz_count !== 1 ? 'zes' : ''}</span>
                  <span className="text-blue-600 font-medium group-hover:translate-x-1 transition-transform">
                    Explore →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { GlobalHeader } from '../../components/global/GlobalHeader';
import { SEOHead } from '../../components/SEOHead';
import { SUBJECTS } from '../../lib/globalData';
import { supabase } from '../../lib/supabase';
import { BookOpen, ArrowRight } from 'lucide-react';

interface SubjectWithCounts {
  id: string;
  name: string;
  icon: any;
  color: string;
  topicCount: number;
  quizCount: number;
}

export function SubjectsListPage() {
  const [subjects, setSubjects] = useState<SubjectWithCounts[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSubjects() {
      try {
        // Get counts for each subject
        const subjectsWithCounts = await Promise.all(
          SUBJECTS.map(async (subject) => {
            // Get topics for this subject
            const { data: topics } = await supabase
              .from('topics')
              .select('id')
              .eq('subject', subject.id)
              .is('school_id', null);

            const topicCount = topics?.length || 0;

            // Get quiz count for this subject
            let quizCount = 0;
            if (topics && topics.length > 0) {
              const topicIds = topics.map(t => t.id);
              const { count } = await supabase
                .from('question_sets')
                .select('*', { count: 'exact', head: true })
                .in('topic_id', topicIds)
                .eq('approval_status', 'approved')
                .is('school_id', null);

              quizCount = count || 0;
            }

            return {
              id: subject.id,
              name: subject.name,
              icon: subject.icon,
              color: subject.color,
              topicCount,
              quizCount,
            };
          })
        );

        // Filter to only subjects with quizzes and sort by quiz count
        const filteredSubjects = subjectsWithCounts
          .filter(s => s.quizCount > 0)
          .sort((a, b) => b.quizCount - a.quizCount);

        setSubjects(filteredSubjects);
      } catch (error) {
        console.error('Error loading subjects:', error);
      } finally {
        setLoading(false);
      }
    }

    loadSubjects();
  }, []);

  const breadcrumbs = [
    { label: 'Explore', href: '/explore' },
    { label: 'All Subjects' },
  ];

  return (
    <div className="min-h-screen bg-gray-900">
      <SEOHead
        title="Browse Subjects - StartSprint"
        description="Explore quizzes by subject from teachers worldwide"
      />

      <GlobalHeader breadcrumbs={breadcrumbs} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Browse by Subject
          </h1>
          <p className="text-lg text-gray-400">
            {subjects.reduce((sum, s) => sum + s.quizCount, 0)} quizzes across {subjects.length} subjects
          </p>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
            <p className="text-gray-400 mt-4">Loading subjects...</p>
          </div>
        ) : subjects.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No subjects with quizzes available yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {subjects.map((subject) => {
              const Icon = subject.icon;
              return (
                <Link
                  key={subject.id}
                  to={`/subjects/${subject.id}`}
                  className="group bg-gray-800 rounded-xl shadow-lg border border-gray-700 hover:border-blue-500 hover:shadow-2xl transition-all p-8"
                >
                  {/* Icon */}
                  <div className="flex items-center justify-between mb-4">
                    {Icon && (
                      <div className={`p-4 rounded-lg bg-gray-700 group-hover:bg-gray-600 transition-colors`}>
                        <Icon className={`w-10 h-10 ${subject.color}`} />
                      </div>
                    )}
                    <ArrowRight className="w-6 h-6 text-gray-600 group-hover:text-blue-400 transition-colors" />
                  </div>

                  {/* Subject Name */}
                  <h2 className="text-2xl font-bold text-white group-hover:text-blue-400 transition-colors mb-3">
                    {subject.name}
                  </h2>

                  {/* Stats */}
                  <div className="flex items-center gap-6 text-sm text-gray-400">
                    <div>
                      <span className="font-semibold text-white">{subject.quizCount}</span> quizzes
                    </div>
                    <div>
                      <span className="font-semibold text-white">{subject.topicCount}</span> topics
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Info Box */}
        {!loading && subjects.length > 0 && (
          <div className="mt-12 bg-blue-900 border border-blue-700 rounded-xl p-6 text-center">
            <p className="text-blue-300">
              Click on any subject to explore all available topics and quizzes
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

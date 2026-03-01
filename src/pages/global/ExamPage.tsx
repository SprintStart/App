import { useEffect, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { GlobalHeader } from '../../components/global/GlobalHeader';
import { SEOHead } from '../../components/SEOHead';
import { findExamBySlug, SUBJECTS, SubjectDef } from '../../lib/globalData';
import { supabase } from '../../lib/supabase';

interface SponsorAd {
  id: string;
  sponsor_name: string;
  sponsor_logo_url: string | null;
  banner_image_url: string | null;
  click_url: string;
}

export function ExamPage() {
  const { examSlug } = useParams<{ examSlug: string }>();
  const examData = examSlug ? findExamBySlug(examSlug) : null;

  const [availableSubjects, setAvailableSubjects] = useState<SubjectDef[]>([]);
  const [sponsor, setSponsor] = useState<SponsorAd | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadExamData() {
      if (!examSlug) return;

      try {
        // Load subjects that have published topics for this exam
        const { data: topics } = await supabase
          .from('topics')
          .select('subject')
          .eq('is_published', true)
          .eq('is_active', true)
          .not('subject', 'is', null);

        if (topics) {
          const subjectIds = [...new Set(topics.map((t) => t.subject))];
          const subjects = SUBJECTS.filter((s) => subjectIds.includes(s.id));
          setAvailableSubjects(subjects.length > 0 ? subjects : SUBJECTS);
        } else {
          setAvailableSubjects(SUBJECTS);
        }

        // Load sponsor ad
        const { data: sponsorData } = await supabase
          .from('sponsored_ads')
          .select('*')
          .eq('is_active', true)
          .eq('placement', 'exam_page')
          .limit(1)
          .maybeSingle();

        if (sponsorData) {
          setSponsor(sponsorData);
        }
      } catch (error) {
        console.error('Error loading exam data:', error);
        setAvailableSubjects(SUBJECTS);
      } finally {
        setLoading(false);
      }
    }

    loadExamData();
  }, [examSlug]);

  if (!examData) {
    return <Navigate to="/" replace />;
  }

  const { exam, country } = examData;

  const breadcrumbs = [
    { label: country.name, href: '/' },
    { label: exam.name },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <SEOHead
        title={`${exam.name} - ${country.name} - StartSprint`}
        description={`Explore ${exam.name} quizzes across all subjects`}
      />

      <GlobalHeader breadcrumbs={breadcrumbs} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Exam Header */}
        <div className="text-center mb-12">
          <div className="text-6xl mb-4">{exam.emoji}</div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">{exam.name}</h1>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mb-4">
            {country.emoji} {country.name}
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">{exam.description}</p>
        </div>

        {/* Sponsor Banner */}
        {sponsor && (
          <div className="mb-12">
            <div className="text-xs text-gray-500 text-center mb-2">Sponsored</div>
            <a
              href={sponsor.click_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block max-w-4xl mx-auto rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
            >
              {sponsor.banner_image_url ? (
                <img
                  src={sponsor.banner_image_url}
                  alt={sponsor.sponsor_name}
                  className="w-full h-48 object-cover"
                />
              ) : (
                <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-12 text-center">
                  <div className="text-white text-2xl font-bold">{sponsor.sponsor_name}</div>
                </div>
              )}
            </a>
          </div>
        )}

        {/* Subject Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {availableSubjects.map((subject) => {
              const Icon = subject.icon;
              return (
                <Link
                  key={subject.id}
                  to={`/exams/${examSlug}/${subject.id}`}
                  className="group bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-blue-300 transition-all p-6 text-center"
                >
                  <Icon className={`w-12 h-12 mx-auto mb-3 ${subject.color} group-hover:scale-110 transition-transform`} />
                  <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {subject.name}
                  </h3>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { GlobalHeader } from '../../components/global/GlobalHeader';
import { SEOHead } from '../../components/SEOHead';
import { findExamBySlug, SUBJECTS, SubjectDef } from '../../lib/globalData';
import { supabase } from '../../lib/supabase';
import { AdBanner } from '../../components/ads/AdBanner';

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

        {/* Ad Banner - COUNTRY_HOME placement for exam pages */}
        <AdBanner
          placement="COUNTRY_HOME"
          country_id={examData.country.id}
          exam_system_id={examData.exam.id}
          className="mb-12 max-w-4xl mx-auto"
        />

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

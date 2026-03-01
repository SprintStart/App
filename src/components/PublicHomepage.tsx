import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, Topic, QuestionSet } from '../lib/supabase';
import { useImmersive } from '../contexts/ImmersiveContext';
import { SEOHead } from './SEOHead';
import {
  Calculator, Beaker, BookOpen, Monitor, Briefcase,
  Globe, Clock, Languages, Palette, Cog, Heart, Grid3x3, Play, LogIn
} from 'lucide-react';

interface SponsorBanner {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  display_order: number;
}

type View = 'hero' | 'subjects' | 'quizzes';

const KNOWN_SUBJECTS: Record<string, { name: string; icon: typeof Calculator }> = {
  mathematics: { name: 'Mathematics', icon: Calculator },
  science: { name: 'Science', icon: Beaker },
  english: { name: 'English', icon: BookOpen },
  computing: { name: 'Computing / IT', icon: Monitor },
  business: { name: 'Business', icon: Briefcase },
  geography: { name: 'Geography', icon: Globe },
  history: { name: 'History', icon: Clock },
  languages: { name: 'Languages', icon: Languages },
  art: { name: 'Art & Design', icon: Palette },
  engineering: { name: 'Engineering', icon: Cog },
  health: { name: 'Health & Social Care', icon: Heart },
  other: { name: 'Other / General Knowledge', icon: Grid3x3 },
};

export function PublicHomepage() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>('hero');
  const [banners, setBanners] = useState<SponsorBanner[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [loading, setLoading] = useState(false);
  const [allSubjects, setAllSubjects] = useState<Array<{ id: string; name: string; icon: typeof Calculator }>>([]);
  const { isImmersive } = useImmersive();

  useEffect(() => {
    loadBanners();
    loadSubjects();
  }, []);

  useEffect(() => {
    if (selectedSubject) {
      loadTopicsForSubject(selectedSubject);
    }
  }, [selectedSubject]);

  useEffect(() => {
    if (selectedTopic) {
      loadQuestionSets(selectedTopic.id);
    }
  }, [selectedTopic]);

  async function loadBanners() {
    try {
      const { data, error } = await supabase
        .from('sponsor_banners')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) {
        console.warn('Failed to load banners (non-blocking):', error);
        setBanners([]);
        return;
      }
      setBanners(data || []);
    } catch (err) {
      console.warn('Failed to load banners (non-blocking):', err);
      setBanners([]);
    }
  }

  async function loadSubjects() {
    try {
      const { data, error } = await supabase
        .from('topics')
        .select('subject')
        .eq('is_active', true)
        .eq('is_published', true);

      if (error) throw error;

      const uniqueSubjects = new Set((data || []).map(t => t.subject));
      const knownKeys = Object.keys(KNOWN_SUBJECTS);
      const result: Array<{ id: string; name: string; icon: typeof Calculator }> = [];

      for (const key of knownKeys) {
        if (uniqueSubjects.has(key)) {
          result.push({ id: key, name: KNOWN_SUBJECTS[key].name, icon: KNOWN_SUBJECTS[key].icon });
          uniqueSubjects.delete(key);
        }
      }

      for (const custom of uniqueSubjects) {
        if (custom && custom.trim()) {
          result.push({ id: custom, name: custom.trim(), icon: BookOpen });
        }
      }

      setAllSubjects(result);
    } catch (err) {
      console.error('Failed to load subjects:', err);
      const fallback = Object.entries(KNOWN_SUBJECTS).map(([id, v]) => ({ id, name: v.name, icon: v.icon }));
      setAllSubjects(fallback);
    }
  }

  async function loadTopicsForSubject(subject: string) {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('topics')
        .select('*')
        .eq('subject', subject)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setTopics(data || []);
    } catch (err) {
      console.error('Failed to load topics:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadQuestionSets(topicId: string) {
    try {
      const { data, error } = await supabase
        .from('question_sets')
        .select('*')
        .eq('topic_id', topicId)
        .eq('is_active', true)
        .eq('approval_status', 'approved')
        .order('title');

      if (error) throw error;
      setQuestionSets(data || []);
    } catch (err) {
      console.error('Failed to load question sets:', err);
    }
  }

  async function handleBannerClick(banner: SponsorBanner) {
    try {
      const { data: currentBanner } = await supabase
        .from('sponsor_banners')
        .select('click_count')
        .eq('id', banner.id)
        .single();

      if (currentBanner) {
        await supabase
          .from('sponsor_banners')
          .update({ click_count: (currentBanner.click_count || 0) + 1 })
          .eq('id', banner.id);
      }
    } catch (err) {
      console.error('Failed to track banner click:', err);
    }

    if (banner.link_url) {
      window.open(banner.link_url, '_blank');
    }
  }

  function handleSubjectSelect(subjectId: string) {
    setSelectedSubject(subjectId);
    setView('quizzes');
  }

  function handleBackToSubjects() {
    setSelectedSubject(null);
    setSelectedTopic(null);
    setQuestionSets([]);
    setTopics([]);
    setView('subjects');
  }

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isImmersive ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className={`text-center ${isImmersive ? 'text-white text-3xl' : 'text-gray-600 text-xl'}`}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead />
      <div className={`min-h-screen ${isImmersive ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <Link
          to="/teacher"
          onClick={() => {
            console.log('[NAV] Teacher Login clicked -> navigating to /teacher');
            console.log('[NAV] Current route is now: /teacher');
          }}
          className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg transition-colors"
        >
          <LogIn className="w-5 h-5" />
          Teacher Login
        </Link>

      {view !== 'hero' && banners.length > 0 && (
        <div className={`border-b ${isImmersive ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="max-w-7xl mx-auto relative">
            <div className={`absolute top-2 left-4 px-3 py-1 text-xs font-semibold ${
              isImmersive ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'
            } rounded`}>
              Sponsored
            </div>
            {banners.map((banner) => (
              <button
                key={banner.id}
                onClick={() => handleBannerClick(banner)}
                className={`w-full transition-opacity hover:opacity-80 ${
                  isImmersive ? 'py-8 pt-12' : 'py-6 pt-10'
                }`}
              >
                <img
                  src={banner.image_url}
                  alt={banner.title}
                  className="w-full h-auto max-h-32 object-contain"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {view === 'hero' && (
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 md:p-8">
          <div className="text-center max-w-4xl mx-auto px-4">
            <div className="flex justify-center mb-4 sm:mb-5 md:mb-6">
              <img
                src="/startsprint_logo.png"
                alt="StartSprint Logo"
                className={isImmersive ? 'h-32 sm:h-40 md:h-48 lg:h-56 w-auto' : 'h-24 sm:h-32 md:h-40 lg:h-48 w-auto'}
              />
            </div>
            <h2 className={`font-bold mb-3 sm:mb-4 ${
              isImmersive ? 'text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-blue-400' : 'text-xl sm:text-2xl md:text-3xl lg:text-4xl text-blue-600'
            }`}>
              Are you ready to challenge your mind?
            </h2>
            <p className={`mb-6 sm:mb-8 md:mb-12 ${
              isImmersive ? 'text-lg sm:text-xl md:text-2xl lg:text-3xl text-gray-300' : 'text-base sm:text-lg md:text-xl lg:text-2xl text-gray-600'
            }`}>
              Think fast. Play smart. Beat the quiz.
            </p>
            <p className={`mb-8 sm:mb-10 md:mb-12 ${
              isImmersive ? 'text-base sm:text-lg md:text-xl lg:text-2xl text-gray-400' : 'text-sm sm:text-base md:text-lg lg:text-xl text-gray-500'
            }`}>
              No sign-up. No waiting. Just play.
            </p>
            <button
              onClick={() => navigate('/explore')}
              className={`group font-bold rounded-xl transition-all shadow-2xl ${
                isImmersive
                  ? 'bg-green-600 hover:bg-green-500 text-white px-8 sm:px-10 md:px-12 lg:px-16 py-4 sm:py-5 md:py-6 lg:py-8 text-xl sm:text-2xl md:text-3xl lg:text-4xl'
                  : 'bg-green-500 hover:bg-green-600 text-white px-6 sm:px-8 md:px-10 lg:px-12 py-3 sm:py-4 md:py-5 lg:py-6 text-lg sm:text-xl md:text-2xl lg:text-3xl'
              }`}
            >
              ENTER ▶
            </button>
          </div>
        </div>
      )}

      {view === 'subjects' && (
        <div className={isImmersive ? 'p-3 sm:p-6 md:p-8 lg:p-12' : 'p-3 sm:p-4 md:p-6 lg:p-8'}>
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-6 sm:mb-8 md:mb-12">
              <h1 className={`font-bold mb-3 sm:mb-4 ${isImmersive ? 'text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-white' : 'text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-gray-900'}`}>
                Choose Your Subject
              </h1>
              <p className={isImmersive ? 'text-base sm:text-lg md:text-xl lg:text-2xl text-gray-300' : 'text-sm sm:text-base md:text-lg lg:text-xl text-gray-600'}>
                Select a subject to explore quizzes
              </p>
            </div>

            <div className={`grid gap-3 sm:gap-4 md:gap-6 ${
              isImmersive ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4'
            }`}>
              {allSubjects.map((subject) => {
                const Icon = subject.icon;
                return (
                  <button
                    key={subject.id}
                    onClick={() => handleSubjectSelect(subject.id)}
                    className={`text-center rounded-lg transition-all ${
                      isImmersive
                        ? 'bg-gray-800 hover:bg-gray-700 p-10 border-4 border-gray-700 hover:border-blue-500'
                        : 'bg-white hover:bg-blue-50 p-6 shadow-lg hover:shadow-xl border-2 border-gray-200 hover:border-blue-400'
                    }`}
                  >
                    <div className={`mx-auto rounded-full p-4 mb-4 ${isImmersive ? 'bg-blue-600' : 'bg-blue-100'} w-fit`}>
                      <Icon className={isImmersive ? 'w-12 h-12 text-white' : 'w-8 h-8 text-blue-600'} />
                    </div>
                    <h3 className={`font-bold ${
                      isImmersive ? 'text-3xl text-white' : 'text-xl text-gray-900'
                    }`}>
                      {subject.name}
                    </h3>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {view === 'quizzes' && (
        <div className={isImmersive ? 'p-12' : 'p-8'}>
          <div className="max-w-6xl mx-auto">
            <button
              onClick={handleBackToSubjects}
              className={`mb-8 font-medium ${
                isImmersive
                  ? 'text-3xl text-blue-400 hover:text-blue-300'
                  : 'text-xl text-blue-600 hover:text-blue-800'
              }`}
            >
              ← Back to Subjects
            </button>

            {!selectedTopic ? (
              <div>
                <h2 className={`font-semibold mb-8 text-center ${
                  isImmersive ? 'text-4xl text-gray-200' : 'text-3xl text-gray-700'
                }`}>
                  {allSubjects.find(s => s.id === selectedSubject)?.name || selectedSubject} Topics
                </h2>
                <div className={`grid gap-6 ${
                  isImmersive ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                }`}>
                  {topics.map((topic) => (
                    <button
                      key={topic.id}
                      onClick={() => setSelectedTopic(topic)}
                      className={`text-left rounded-lg transition-all ${
                        isImmersive
                          ? 'bg-gray-800 hover:bg-gray-700 p-10 border-4 border-gray-700 hover:border-blue-500'
                          : 'bg-white hover:bg-blue-50 p-8 shadow-lg hover:shadow-xl border-2 border-gray-200 hover:border-blue-400'
                      }`}
                    >
                      <h3 className={`font-bold mb-2 ${
                        isImmersive ? 'text-4xl text-white' : 'text-2xl text-gray-900'
                      }`}>
                        {topic.name}
                      </h3>
                      {topic.description && (
                        <p className={isImmersive ? 'text-xl text-gray-300' : 'text-gray-600'}>
                          {topic.description}
                        </p>
                      )}
                    </button>
                  ))}
                </div>

                {topics.length === 0 && (
                  <p className={`text-center mt-8 ${
                    isImmersive ? 'text-2xl text-gray-400' : 'text-xl text-gray-500'
                  }`}>
                    No topics available for this subject yet.
                  </p>
                )}
              </div>
            ) : (
              <div>
                <button
                  onClick={() => {
                    setSelectedTopic(null);
                    setQuestionSets([]);
                  }}
                  className={`mb-8 font-medium ${
                    isImmersive
                      ? 'text-3xl text-blue-400 hover:text-blue-300'
                      : 'text-xl text-blue-600 hover:text-blue-800'
                  }`}
                >
                  ← Back to Topics
                </button>

                <h2 className={`font-semibold mb-8 text-center ${
                  isImmersive ? 'text-4xl text-gray-200' : 'text-3xl text-gray-700'
                }`}>
                  {selectedTopic.name} Quizzes
                </h2>

                <div className={`grid gap-6 ${isImmersive ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                  {questionSets.map((set) => (
                    <button
                      key={set.id}
                      onClick={() => navigate(`/quiz/${set.id}`)}
                      className={`text-left rounded-lg transition-all ${
                        isImmersive
                          ? 'bg-gray-800 hover:bg-gray-700 p-10 border-4 border-gray-700 hover:border-green-500'
                          : 'bg-white hover:bg-green-50 p-8 shadow-lg hover:shadow-xl border-2 border-gray-200 hover:border-green-400'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <h3 className={`font-bold mb-2 ${
                            isImmersive ? 'text-3xl text-white' : 'text-2xl text-gray-900'
                          }`}>
                            {set.title}
                          </h3>
                          <div className={`flex gap-4 ${isImmersive ? 'text-xl' : 'text-base'}`}>
                            {set.difficulty && (
                              <span className={isImmersive ? 'text-yellow-400' : 'text-yellow-600 font-medium'}>
                                {set.difficulty}
                              </span>
                            )}
                            <span className={isImmersive ? 'text-gray-400' : 'text-gray-500'}>
                              {set.question_count} questions
                            </span>
                          </div>
                        </div>
                        <div className={`rounded-full p-4 ${isImmersive ? 'bg-green-600' : 'bg-green-100'}`}>
                          <Play className={isImmersive ? 'w-12 h-12 text-white' : 'w-8 h-8 text-green-600'} />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {questionSets.length === 0 && (
                  <p className={`text-center mt-8 ${
                    isImmersive ? 'text-2xl text-gray-400' : 'text-xl text-gray-500'
                  }`}>
                    No quizzes available for this topic yet.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </>
  );
}

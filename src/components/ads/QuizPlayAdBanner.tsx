import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';

interface Ad {
  id: string;
  title: string;
  image_url: string;
  click_url: string;
}

interface QuizPlayAdBannerProps {
  country_id?: string | null;
  school_id?: string | null;
  questionsAnswered?: number; // Rotate every 3 questions
}

const ROTATION_INTERVAL = 25000; // 25 seconds
const QUESTIONS_PER_ROTATION = 3;

export function QuizPlayAdBanner({
  country_id = null,
  school_id = null,
  questionsAnswered = 0
}: QuizPlayAdBannerProps) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const impressionTracked = useRef(new Set<string>());
  const lastRotationQuestion = useRef(0);

  useEffect(() => {
    async function fetchAds() {
      try {
        const { data, error } = await supabase.rpc('get_active_ads_for_placement', {
          p_placement: 'QUIZ_PLAY',
          p_country_id: country_id,
          p_exam_system_id: null,
          p_school_id: school_id,
          p_limit: 10
        });

        if (error) {
          console.warn('[QuizPlayAd] Failed to fetch ads:', error);
          setLoading(false);
          return;
        }

        setAds(data || []);
        setLoading(false);
      } catch (err) {
        console.warn('[QuizPlayAd] Error:', err);
        setLoading(false);
      }
    }

    fetchAds();
  }, [country_id, school_id]);

  // Track impression
  useEffect(() => {
    if (!ads.length || loading) return;

    const currentAd = ads[currentAdIndex];
    if (!currentAd || impressionTracked.current.has(currentAd.id)) return;

    impressionTracked.current.add(currentAd.id);

    const trackImpression = async () => {
      try {
        await supabase.rpc('track_ad_impression', {
          p_ad_id: currentAd.id,
          p_session_id: sessionStorage.getItem('quiz_session_id') || null,
          p_page_url: window.location.href,
          p_placement: 'QUIZ_PLAY',
          p_country_code: null
        });
      } catch (err) {
        console.warn('[QuizPlayAd] Failed to track impression:', err);
      }
    };

    trackImpression();
  }, [ads, currentAdIndex, loading]);

  // Time-based rotation
  useEffect(() => {
    if (ads.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentAdIndex((prev) => (prev + 1) % ads.length);
    }, ROTATION_INTERVAL);

    return () => clearInterval(timer);
  }, [ads.length]);

  // Question-based rotation
  useEffect(() => {
    if (ads.length <= 1) return;

    const questionsSinceLastRotation = questionsAnswered - lastRotationQuestion.current;

    if (questionsSinceLastRotation >= QUESTIONS_PER_ROTATION) {
      setCurrentAdIndex((prev) => (prev + 1) % ads.length);
      lastRotationQuestion.current = questionsAnswered;
    }
  }, [questionsAnswered, ads.length]);

  async function handleAdClick(ad: Ad) {
    try {
      await supabase.rpc('track_ad_click', {
        p_ad_id: ad.id,
        p_session_id: sessionStorage.getItem('quiz_session_id') || null,
        p_page_url: window.location.href,
        p_placement: 'QUIZ_PLAY',
        p_country_code: null,
        p_referrer: document.referrer || null
      });
    } catch (err) {
      console.warn('[QuizPlayAd] Failed to track click:', err);
    }

    window.open(ad.click_url, '_blank', 'noopener,noreferrer');
  }

  if (loading || !ads.length) {
    return null;
  }

  const currentAd = ads[currentAdIndex];
  if (!currentAd) return null;

  return (
    <div className="w-full max-w-md mx-auto my-4">
      <div className="relative group">
        <img
          src={currentAd.image_url}
          alt={currentAd.title}
          onClick={() => handleAdClick(currentAd)}
          className="w-full h-auto rounded-lg cursor-pointer shadow-sm hover:shadow-md transition-shadow"
          loading="lazy"
        />

        <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black bg-opacity-60 text-white text-xs rounded">
          Sponsored
        </div>

        {ads.length > 1 && (
          <div className="absolute bottom-2 right-2 flex gap-1">
            {ads.map((_, idx) => (
              <div
                key={idx}
                className={`w-1.5 h-1.5 rounded-full ${
                  idx === currentAdIndex ? 'bg-white' : 'bg-white bg-opacity-40'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

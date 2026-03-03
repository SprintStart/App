import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { X } from 'lucide-react';

interface Ad {
  id: string;
  title: string;
  image_url: string;
  click_url: string;
  placement: string;
  scope: string;
  country_id: string | null;
}

interface AdBannerProps {
  placement: string;
  country_id?: string | null;
  exam_system_id?: string | null;
  school_id?: string | null;
  rotationInterval?: number; // milliseconds (default 25000 = 25 seconds)
  className?: string;
}

const AD_CACHE = new Map<string, { ads: Ad[]; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export function AdBanner({
  placement,
  country_id = null,
  exam_system_id = null,
  school_id = null,
  rotationInterval = 25000,
  className = ''
}: AdBannerProps) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const impressionTracked = useRef(new Set<string>());

  // Lazy load: only fetch when component becomes visible
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(containerRef.current);

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, []);

  // Fetch ads when visible
  useEffect(() => {
    if (!visible) return;

    async function fetchAds() {
      try {
        setLoading(true);
        setError(false);

        // Generate cache key
        const cacheKey = `${placement}:${country_id || 'null'}:${exam_system_id || 'null'}:${school_id || 'null'}`;

        // Check cache
        const cached = AD_CACHE.get(cacheKey);
        const now = Date.now();

        if (cached && (now - cached.timestamp) < CACHE_DURATION) {
          setAds(cached.ads);
          setLoading(false);
          return;
        }

        // Fetch from database using RPC function
        const { data, error: fetchError } = await supabase.rpc('get_active_ads_for_placement', {
          p_placement: placement,
          p_country_id: country_id,
          p_exam_system_id: exam_system_id,
          p_school_id: school_id,
          p_limit: 10
        });

        if (fetchError) {
          console.warn('[AdBanner] Failed to fetch ads:', fetchError);
          setError(true);
          setLoading(false);
          return;
        }

        const fetchedAds = data || [];

        // Cache results
        AD_CACHE.set(cacheKey, { ads: fetchedAds, timestamp: now });

        setAds(fetchedAds);
        setLoading(false);

      } catch (err) {
        console.warn('[AdBanner] Error fetching ads:', err);
        setError(true);
        setLoading(false);
      }
    }

    fetchAds();
  }, [visible, placement, country_id, exam_system_id, school_id]);

  // Track impression when ad becomes visible
  useEffect(() => {
    if (!ads.length || !visible || loading) return;

    const currentAd = ads[currentAdIndex];
    if (!currentAd || impressionTracked.current.has(currentAd.id)) return;

    // Mark as tracked
    impressionTracked.current.add(currentAd.id);

    // Track impression asynchronously (fire and forget)
    const trackImpression = async () => {
      try {
        await supabase.rpc('track_ad_impression', {
          p_ad_id: currentAd.id,
          p_session_id: sessionStorage.getItem('quiz_session_id') || null,
          p_page_url: window.location.href,
          p_placement: placement,
          p_country_code: null
        });
      } catch (err) {
        console.warn('[AdBanner] Failed to track impression:', err);
      }
    };

    trackImpression();
  }, [ads, currentAdIndex, visible, loading, placement]);

  // Rotation timer
  useEffect(() => {
    if (ads.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentAdIndex((prev) => (prev + 1) % ads.length);
    }, rotationInterval);

    return () => clearInterval(timer);
  }, [ads.length, rotationInterval]);

  // Handle ad click
  async function handleAdClick(ad: Ad) {
    try {
      // Track click asynchronously
      await supabase.rpc('track_ad_click', {
        p_ad_id: ad.id,
        p_session_id: sessionStorage.getItem('quiz_session_id') || null,
        p_page_url: window.location.href,
        p_placement: placement,
        p_country_code: null,
        p_referrer: document.referrer || null
      });
    } catch (err) {
      console.warn('[AdBanner] Failed to track click:', err);
    }

    // Open in new tab
    window.open(ad.click_url, '_blank', 'noopener,noreferrer');
  }

  // Silent fail if no ads or error
  if (loading || error || !ads.length || dismissed) {
    return <div ref={containerRef} className="hidden" />;
  }

  const currentAd = ads[currentAdIndex];
  if (!currentAd) return null;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative group">
        <img
          src={currentAd.image_url}
          alt={currentAd.title}
          onClick={() => handleAdClick(currentAd)}
          className="w-full h-auto rounded-lg cursor-pointer shadow-sm hover:shadow-md transition-shadow"
          loading="lazy"
        />

        {/* Dismiss button (optional, for sidebar ads) */}
        {placement === 'SIDEBAR' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDismissed(true);
            }}
            className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Dismiss ad"
          >
            <X className="w-3 h-3 text-gray-600" />
          </button>
        )}

        {/* Sponsored label */}
        <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black bg-opacity-60 text-white text-xs rounded">
          Sponsored
        </div>

        {/* Rotation indicator if multiple ads */}
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

import { supabase } from './supabase';

export async function safeQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: string | null }> {
  try {
    const { data, error } = await queryFn();

    if (error) {
      if (
        error.message?.includes('authorization') ||
        error.message?.includes('JWT') ||
        error.code === 'PGRST301'
      ) {
        console.warn('Auth error (expected for anonymous users):', error.message);
        return { data: null, error: null };
      }

      console.error('Query error:', error);
      return { data: null, error: error.message || 'An error occurred' };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { data: null, error: err instanceof Error ? err.message : 'An unexpected error occurred' };
  }
}

export async function loadTopicsPublic() {
  return safeQuery(() =>
    supabase
      .from('topics')
      .select('*')
      .eq('is_active', true)
      .eq('is_published', true)
      .order('name')
  );
}

export async function loadQuestionSetsPublic(topicId: string) {
  return safeQuery(() =>
    supabase
      .from('question_sets')
      .select('*')
      .eq('topic_id', topicId)
      .eq('is_active', true)
      .eq('approval_status', 'approved')
      .order('title')
  );
}

export async function loadSponsorBannersPublic(placement: string = 'homepage-top') {
  try {
    const result = await safeQuery(() =>
      supabase
        .from('sponsor_banners')
        .select('*')
        .eq('is_active', true)
        .eq('placement', placement)
        .limit(5)
    );

    if (result.error) {
      console.warn('Banner loading failed (non-blocking):', result.error);
      return { data: [], error: null };
    }

    return result;
  } catch (err) {
    console.warn('Banner loading failed (non-blocking):', err);
    return { data: [], error: null };
  }
}

export async function trackBannerEvent(
  bannerId: string,
  eventType: 'view' | 'click',
  sessionId: string | null
) {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(
      `${supabaseUrl}/functions/v1/sponsor-analytics?action=track`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
        },
        body: JSON.stringify({
          banner_id: bannerId,
          event_type: eventType,
          session_id: sessionId,
          referrer: document.referrer || null,
        }),
      }
    );

    if (!response.ok) {
      console.warn('Failed to track banner event:', await response.text());
    }
  } catch (error) {
    console.warn('Error tracking banner event:', error);
  }
}

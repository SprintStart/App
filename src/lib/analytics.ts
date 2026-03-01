import { supabase } from './supabase';

let analyticsEnabled = true;

export async function isAnalyticsEnabled(): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('feature_flags')
      .select('enabled')
      .eq('flag_name', 'ANALYTICS_V1_ENABLED')
      .single();

    return data?.enabled ?? true;
  } catch (error) {
    console.warn('[Analytics] Failed to check feature flag:', error);
    return true;
  }
}

export interface QuizPlaySession {
  id?: string;
  quiz_id: string;
  school_id?: string | null;
  subject_id?: string | null;
  topic_id?: string | null;
  player_id?: string | null;
  total_questions: number;
  device_type?: string;
  user_agent?: string;
}

export interface QuizSessionEvent {
  session_id: string;
  quiz_id: string;
  question_id?: string;
  event_type: 'session_start' | 'question_start' | 'answer_submitted' | 'question_end' | 'quiz_end';
  is_correct?: boolean;
  attempts_used?: number;
  time_spent_ms?: number;
  metadata?: Record<string, any>;
}

export interface QuizFeedback {
  quiz_id: string;
  school_id?: string | null;
  session_id?: string | null;
  rating: 1 | -1;
  reason?: 'too_hard' | 'too_easy' | 'unclear_questions' | 'too_long' | 'bugs_lag' | null;
  comment?: string;
  user_type?: 'student' | 'teacher';
}

function getDeviceType(): string {
  const ua = navigator.userAgent;
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

export async function createQuizPlaySession(data: QuizPlaySession): Promise<string | null> {
  if (!analyticsEnabled) return null;

  try {
    const { data: session, error } = await supabase
      .from('quiz_play_sessions')
      .insert({
        quiz_id: data.quiz_id,
        school_id: data.school_id,
        subject_id: data.subject_id,
        topic_id: data.topic_id,
        player_id: data.player_id,
        total_questions: data.total_questions,
        device_type: data.device_type || getDeviceType(),
        user_agent: data.user_agent || navigator.userAgent.substring(0, 500),
      })
      .select('id')
      .single();

    if (error) {
      console.warn('[Analytics] Failed to create play session:', error);
      return null;
    }

    return session?.id || null;
  } catch (error) {
    console.warn('[Analytics] Exception creating play session:', error);
    return null;
  }
}

export async function logQuizSessionEvent(event: QuizSessionEvent): Promise<void> {
  if (!analyticsEnabled || !event.session_id) return;

  try {
    await supabase
      .from('quiz_session_events')
      .insert({
        session_id: event.session_id,
        quiz_id: event.quiz_id,
        question_id: event.question_id,
        event_type: event.event_type,
        is_correct: event.is_correct,
        attempts_used: event.attempts_used,
        time_spent_ms: event.time_spent_ms,
        metadata: event.metadata,
      });
  } catch (error) {
    console.warn('[Analytics] Failed to log session event:', error);
  }
}

export async function completeQuizPlaySession(
  sessionId: string,
  data: {
    score: number;
    correct_count: number;
    wrong_count: number;
  }
): Promise<void> {
  if (!analyticsEnabled || !sessionId) return;

  try {
    await supabase
      .from('quiz_play_sessions')
      .update({
        ended_at: new Date().toISOString(),
        completed: true,
        score: data.score,
        correct_count: data.correct_count,
        wrong_count: data.wrong_count,
      })
      .eq('id', sessionId);
  } catch (error) {
    console.warn('[Analytics] Failed to complete play session:', error);
  }
}

export async function submitQuizFeedback(feedback: QuizFeedback): Promise<void> {
  if (!analyticsEnabled) return;

  try {
    const { error } = await supabase
      .from('quiz_feedback')
      .insert({
        quiz_id: feedback.quiz_id,
        school_id: feedback.school_id,
        session_id: feedback.session_id,
        thumb: feedback.rating === 1 ? 'up' : 'down',
        rating: feedback.rating,
        reason: feedback.reason || null,
        comment: feedback.comment || null,
        user_type: feedback.user_type || 'student',
      });

    if (error) {
      console.error('[Analytics] Failed to submit feedback:', error);
    } else {
      console.log('[Analytics] Feedback submitted successfully');
    }
  } catch (error) {
    console.warn('[Analytics] Exception submitting feedback:', error);
  }
}

export function disableAnalytics(): void {
  analyticsEnabled = false;
}

export function enableAnalytics(): void {
  analyticsEnabled = true;
}

export async function getTeacherQuizAnalytics(teacherId?: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase.rpc('get_teacher_quiz_analytics', {
      p_teacher_id: teacherId || user.id
    });

    if (error) throw error;

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('[Analytics] Failed to get teacher quiz analytics:', error);
    return [];
  }
}

export async function getQuizDetailedAnalytics(quizId: string) {
  try {
    const { data, error } = await supabase.rpc('get_quiz_detailed_analytics', {
      p_quiz_id: quizId
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Analytics] Failed to get quiz detailed analytics:', error);
    return null;
  }
}

export async function getAdminPlatformStats() {
  try {
    const { data, error } = await supabase.rpc('get_admin_overview_stats');

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Analytics] Failed to get platform stats:', error);
    return null;
  }
}

export async function getAdminPlaysByMonth(monthsBack: number = 12) {
  try {
    const { data, error } = await supabase.rpc('get_admin_monthly_plays', {
      p_months_back: monthsBack
    });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[Analytics] Failed to get plays by month:', error);
    return [];
  }
}

export async function getTopQuizzesByPlays(limit: number = 10) {
  try {
    const { data, error } = await supabase.rpc('get_admin_top_quizzes', {
      p_limit: limit,
      p_metric: 'plays'
    });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[Analytics] Failed to get top quizzes:', error);
    return [];
  }
}

export async function getSchoolActivityRankings(limit: number = 10) {
  try {
    const { data, error } = await supabase.rpc('get_admin_school_activity', {
      p_limit: limit
    });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[Analytics] Failed to get school activity:', error);
    return [];
  }
}

export async function getMonthlyDrilldown(year: number, month: number) {
  try {
    const { data, error } = await supabase.rpc('get_admin_monthly_drilldown', {
      p_year: year,
      p_month: month
    });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[Analytics] Failed to get monthly drilldown:', error);
    return [];
  }
}

export async function getSchoolAnalytics(schoolId: string) {
  try {
    const { data, error } = await supabase.rpc('get_school_analytics', {
      p_school_id: schoolId
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Analytics] Failed to get school analytics:', error);
    return null;
  }
}

export async function getQuizFeedbackSummary(quizId: string) {
  try {
    const { data, error } = await supabase.rpc('get_quiz_feedback_summary', {
      p_quiz_id: quizId
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Analytics] Failed to get quiz feedback summary:', error);
    return null;
  }
}

export async function getTopRatedQuizzes(schoolId?: string, minFeedback: number = 10, limit: number = 20) {
  try {
    const { data, error } = await supabase.rpc('get_top_rated_quizzes', {
      p_school_id: schoolId || null,
      p_min_feedback: minFeedback,
      p_limit: limit
    });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[Analytics] Failed to get top rated quizzes:', error);
    return [];
  }
}

export async function refreshFeedbackStats() {
  try {
    const { error } = await supabase.rpc('refresh_quiz_feedback_stats');
    if (error) throw error;
  } catch (error) {
    console.error('[Analytics] Failed to refresh feedback stats:', error);
  }
}

export async function checkTeacherReviewPrompt(teacherId: string, quizId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('should_show_teacher_review_prompt', {
      p_teacher_id: teacherId,
      p_quiz_id: quizId
    });

    if (error) throw error;
    return data || false;
  } catch (error) {
    console.error('[Analytics] Failed to check review prompt:', error);
    return false;
  }
}

export async function markReviewPromptShown(teacherId: string, quizId: string) {
  try {
    await supabase
      .from('teacher_review_prompts')
      .insert({
        teacher_id: teacherId,
        quiz_id: quizId,
        shown_at: new Date().toISOString(),
      });
  } catch (error) {
    console.warn('[Analytics] Failed to mark review prompt shown:', error);
  }
}

export async function markReviewPromptClicked(teacherId: string, quizId: string) {
  try {
    await supabase
      .from('teacher_review_prompts')
      .update({
        clicked: true,
      })
      .eq('teacher_id', teacherId)
      .eq('quiz_id', quizId);
  } catch (error) {
    console.warn('[Analytics] Failed to mark review prompt clicked:', error);
  }
}

export async function markReviewPromptDismissed(teacherId: string, quizId: string) {
  try {
    await supabase
      .from('teacher_review_prompts')
      .update({
        dismissed: true,
      })
      .eq('teacher_id', teacherId)
      .eq('quiz_id', quizId);
  } catch (error) {
    console.warn('[Analytics] Failed to mark review prompt dismissed:', error);
  }
}

export async function getAdminFeedbackOverview() {
  try {
    const { data, error } = await supabase.rpc('get_admin_feedback_overview');

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Analytics] Failed to get feedback overview:', error);
    return null;
  }
}

export async function getAdminQuizzesByFeedback(sortOrder: 'best' | 'worst' = 'worst', limit: number = 20) {
  try {
    const { data, error } = await supabase.rpc('get_admin_quizzes_by_feedback', {
      p_sort_order: sortOrder,
      p_limit: limit
    });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[Analytics] Failed to get quizzes by feedback:', error);
    return [];
  }
}

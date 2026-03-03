import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * DESTINATION SCOPE DEFINITIONS:
 *
 * GLOBAL quizzes are identified by:
 *   - school_id IS NULL (not tied to any school)
 *   - exam_system_id IS NULL (not tied to any exam system)
 *   - country_code IS NULL (not tied to any country)
 *   - exam_code IS NULL (not tied to any exam code)
 *
 * COUNTRY_EXAM quizzes are identified by:
 *   - school_id IS NULL (not school-specific)
 *   - AND (exam_system_id IS NOT NULL OR country_code IS NOT NULL OR exam_code IS NOT NULL)
 *
 * SCHOOL_WALL quizzes are identified by:
 *   - school_id IS NOT NULL (belongs to a specific school)
 */

interface TrendingQuiz {
  question_set_id: string;
  title: string;
  description: string | null;
  subject: string;
  question_count: number;
  growth_rate: number;
  current_plays: number;
  previous_plays: number;
}

interface UseTrendingQuizzesOptions {
  limit?: number;
  days?: number;
  minPlaysThreshold?: number;
}

export function useTrendingQuizzes({
  limit = 10,
  days = 7,
  minPlaysThreshold = 5,
}: UseTrendingQuizzesOptions = {}) {
  const [quizzes, setQuizzes] = useState<TrendingQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchTrending() {
      try {
        setLoading(true);
        setError(null);

        const today = new Date();
        const currentPeriodStart = new Date(today);
        currentPeriodStart.setDate(today.getDate() - days);

        const previousPeriodStart = new Date(currentPeriodStart);
        previousPeriodStart.setDate(currentPeriodStart.getDate() - days);

        // STEP 1: Fetch analytics rollups for GLOBAL quizzes only (school_id IS NULL)
        const { data: rollups, error: rollupsError } = await supabase
          .from('analytics_daily_rollups')
          .select('quiz_id, date, total_plays')
          .gte('date', previousPeriodStart.toISOString().split('T')[0])
          .lte('date', today.toISOString().split('T')[0])
          .not('quiz_id', 'is', null)
          .is('school_id', null);

        if (rollupsError) throw rollupsError;
        if (!rollups || rollups.length === 0) {
          if (mounted) {
            setQuizzes([]);
            setLoading(false);
          }
          return;
        }

        const quizStats = new Map<string, { current: number; previous: number }>();

        rollups.forEach((row) => {
          const rowDate = new Date(row.date);
          const plays = row.total_plays || 0;

          if (!quizStats.has(row.quiz_id)) {
            quizStats.set(row.quiz_id, { current: 0, previous: 0 });
          }

          const stats = quizStats.get(row.quiz_id)!;

          if (rowDate >= currentPeriodStart) {
            stats.current += plays;
          } else if (rowDate >= previousPeriodStart) {
            stats.previous += plays;
          }
        });

        const trendingQuizIds: Array<{
          id: string;
          growth: number;
          current: number;
          previous: number;
        }> = [];

        quizStats.forEach((stats, quizId) => {
          if (stats.current < minPlaysThreshold) return;

          let growthRate = 0;
          if (stats.previous === 0 && stats.current > 0) {
            growthRate = 100;
          } else if (stats.previous > 0) {
            growthRate = ((stats.current - stats.previous) / stats.previous) * 100;
          }

          if (growthRate > 0) {
            trendingQuizIds.push({
              id: quizId,
              growth: growthRate,
              current: stats.current,
              previous: stats.previous,
            });
          }
        });

        trendingQuizIds.sort((a, b) => b.growth - a.growth);

        const topIds = trendingQuizIds.slice(0, limit).map((item) => item.id);

        if (topIds.length === 0) {
          if (mounted) {
            setQuizzes([]);
            setLoading(false);
          }
          return;
        }

        // STEP 2: Fetch GLOBAL question_sets with complete destination filters
        const { data: quizData, error: quizError } = await supabase
          .from('question_sets')
          .select('id, title, description, topic_id, question_count')
          .in('id', topIds)
          .eq('approval_status', 'approved')
          .eq('is_active', true)
          .is('school_id', null)
          .is('exam_system_id', null)
          .is('country_code', null)
          .is('exam_code', null)
          .gt('question_count', 0);

        if (quizError) throw quizError;
        if (!quizData || quizData.length === 0) {
          if (mounted) {
            setQuizzes([]);
            setLoading(false);
          }
          return;
        }

        const quizDetails = await Promise.all(
          quizData.map(async (quiz) => {
            const { data: topicData } = await supabase
              .from('topics')
              .select('subject')
              .eq('id', quiz.topic_id)
              .maybeSingle();

            const stats = trendingQuizIds.find((item) => item.id === quiz.id)!;

            return {
              question_set_id: quiz.id,
              title: quiz.title,
              description: quiz.description,
              subject: topicData?.subject || 'other',
              question_count: quiz.question_count || 0,
              growth_rate: Math.round(stats.growth),
              current_plays: stats.current,
              previous_plays: stats.previous,
            };
          })
        );

        const sortedQuizzes = quizDetails.sort((a, b) => b.growth_rate - a.growth_rate);

        if (mounted) {
          setQuizzes(sortedQuizzes);
        }
      } catch (err) {
        console.error('Error fetching trending quizzes:', err);
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchTrending();

    return () => {
      mounted = false;
    };
  }, [limit, days, minPlaysThreshold]);

  return { quizzes, loading, error };
}

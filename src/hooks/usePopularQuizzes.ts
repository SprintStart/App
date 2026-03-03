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

interface PopularQuiz {
  question_set_id: string;
  title: string;
  description: string | null;
  subject: string;
  question_count: number;
  total_plays: number;
  avg_score: number;
}

interface UsePopularQuizzesOptions {
  limit?: number;
  days?: number;
  minPlaysThreshold?: number;
}

export function usePopularQuizzes({
  limit = 10,
  days = 30,
  minPlaysThreshold = 10,
}: UsePopularQuizzesOptions = {}) {
  const [quizzes, setQuizzes] = useState<PopularQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchPopular() {
      try {
        setLoading(true);
        setError(null);

        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - days);

        // STEP 1: Fetch analytics rollups for GLOBAL quizzes only (school_id IS NULL)
        const { data: rollups, error: rollupsError } = await supabase
          .from('analytics_daily_rollups')
          .select('quiz_id, total_plays, avg_score')
          .gte('date', startDate.toISOString().split('T')[0])
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

        const quizStats = new Map<
          string,
          { totalPlays: number; scores: number[] }
        >();

        rollups.forEach((row) => {
          if (!quizStats.has(row.quiz_id)) {
            quizStats.set(row.quiz_id, { totalPlays: 0, scores: [] });
          }

          const stats = quizStats.get(row.quiz_id)!;
          stats.totalPlays += row.total_plays || 0;

          if (row.avg_score != null) {
            stats.scores.push(row.avg_score);
          }
        });

        const popularQuizIds: Array<{
          id: string;
          plays: number;
          avgScore: number;
        }> = [];

        quizStats.forEach((stats, quizId) => {
          if (stats.totalPlays < minPlaysThreshold) return;

          const avgScore =
            stats.scores.length > 0
              ? stats.scores.reduce((sum, s) => sum + s, 0) / stats.scores.length
              : 0;

          popularQuizIds.push({
            id: quizId,
            plays: stats.totalPlays,
            avgScore: avgScore,
          });
        });

        popularQuizIds.sort((a, b) => b.plays - a.plays);

        const topIds = popularQuizIds.slice(0, limit).map((item) => item.id);

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

            const stats = popularQuizIds.find((item) => item.id === quiz.id)!;

            return {
              question_set_id: quiz.id,
              title: quiz.title,
              description: quiz.description,
              subject: topicData?.subject || 'other',
              question_count: quiz.question_count || 0,
              total_plays: stats.plays,
              avg_score: Math.round(stats.avgScore),
            };
          })
        );

        const sortedQuizzes = quizDetails.sort((a, b) => b.total_plays - a.total_plays);

        if (mounted) {
          setQuizzes(sortedQuizzes);
        }
      } catch (err) {
        console.error('Error fetching popular quizzes:', err);
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchPopular();

    return () => {
      mounted = false;
    };
  }, [limit, days, minPlaysThreshold]);

  return { quizzes, loading, error };
}

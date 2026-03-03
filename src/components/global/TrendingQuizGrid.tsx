import { Link } from 'react-router-dom';
import { useTrendingQuizzes } from '../../hooks/useTrendingQuizzes';
import { findSubjectById } from '../../lib/globalData';
import { TrendingUp } from 'lucide-react';

interface TrendingQuizGridProps {
  limit?: number;
}

export function TrendingQuizGrid({ limit = 6 }: TrendingQuizGridProps) {
  const { quizzes, loading, error } = useTrendingQuizzes({ limit });

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mb-4"></div>
        <p className="text-gray-400">Loading trending quizzes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
        <p className="text-red-400">Error loading trending quizzes</p>
      </div>
    );
  }

  if (quizzes.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
        <p className="text-gray-400">No trending quizzes available</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {quizzes.map((quiz) => {
        const subjectData = findSubjectById(quiz.subject);
        const Icon = subjectData?.icon;

        return (
          <Link
            key={quiz.question_set_id}
            to={`/quiz/${quiz.question_set_id}/play`}
            className="bg-gray-800 rounded-xl border border-gray-700 p-6 hover:border-blue-500 transition-all group"
          >
            <div className="flex items-start gap-4 mb-4">
              {Icon && (
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-6 h-6 text-white" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-blue-400 transition-colors line-clamp-2">
                  {quiz.title}
                </h3>
                <p className="text-sm text-gray-400 capitalize">{quiz.subject}</p>
              </div>
            </div>

            {quiz.description && (
              <p className="text-sm text-gray-400 mb-4 line-clamp-2">{quiz.description}</p>
            )}

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">{quiz.question_count} questions</span>
              <div className="flex items-center gap-1 text-green-400">
                <TrendingUp className="w-4 h-4" />
                <span className="font-semibold">{quiz.growth_rate}%</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

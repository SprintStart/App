import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trophy, Target, Clock, Play, Share2 } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';

interface SessionResult {
  id: string;
  score: number;
  correct_count: number;
  wrong_count: number;
  percentage: number;
  duration_seconds: number;
  topic_name: string;
  topic_id: string;
  subject: string;
  status: string;
  completed_at: string;
}

export function ShareResult() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<SessionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setError('Invalid session ID');
      setLoading(false);
      return;
    }

    fetchSessionResult();
  }, [sessionId]);

  async function fetchSessionResult() {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/get-shared-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ sessionId }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load session');
      }

      setResult(data.result);
    } catch (err) {
      console.error('Error fetching session:', err);
      setError('Session not found or expired');
    } finally {
      setLoading(false);
    }
  }

  function formatDuration(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: `I scored ${result?.correct_count}/${(result?.correct_count || 0) + (result?.wrong_count || 0)} on StartSprint!`,
        text: `Can you beat my score? ${result?.topic_name} quiz`,
        url: url,
      }).catch(() => {
        copyToClipboard(url);
      });
    } else {
      copyToClipboard(url);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    });
  }

  function handlePlayQuiz() {
    navigate(`/?topic=${result?.topic_id}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center text-gray-600 text-lg">
          Loading result...
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-red-600 text-xl mb-4">{error || 'Result not found'}</div>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  const totalQuestions = result.correct_count + result.wrong_count;
  const shareUrl = `https://startsprint.app/share/session/${sessionId}`;
  const ogImageUrl = `https://startsprint.app/api/og/result?sessionId=${sessionId}`;

  return (
    <>
      <SEOHead
        title={`I scored ${result.percentage}% on ${result.topic_name} | StartSprint`}
        description={`${result.correct_count}/${totalQuestions} correct • Time: ${formatDuration(result.duration_seconds)} • Can you beat my score?`}
        image={ogImageUrl}
        url={shareUrl}
      />

      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 py-8 sm:py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 mb-2">
              StartSprint
            </h1>
            <p className="text-base sm:text-lg text-gray-600">Quiz Challenge Result</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 md:p-10 mb-6">
            <div className="text-center mb-6 sm:mb-8">
              <div className={`inline-flex rounded-full p-6 sm:p-8 mb-4 ${
                result.status === 'completed' ? 'bg-green-100' : 'bg-orange-100'
              }`}>
                <Trophy className={`w-12 h-12 sm:w-16 sm:h-16 ${
                  result.status === 'completed' ? 'text-green-600' : 'text-orange-600'
                }`} />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                {result.topic_name}
              </h2>
              <p className="text-base sm:text-lg text-gray-600">
                {result.subject}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
              <div className="bg-yellow-50 rounded-lg p-4 sm:p-6 text-center">
                <div className="flex justify-center mb-2">
                  <Target className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-600" />
                </div>
                <div className="text-3xl sm:text-4xl font-bold text-yellow-600 mb-1">
                  {result.percentage}%
                </div>
                <div className="text-sm text-gray-600">Score</div>
              </div>

              <div className="bg-green-50 rounded-lg p-4 sm:p-6 text-center">
                <div className="flex justify-center mb-2">
                  <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
                </div>
                <div className="text-3xl sm:text-4xl font-bold text-green-600 mb-1">
                  {result.correct_count}/{totalQuestions}
                </div>
                <div className="text-sm text-gray-600">Correct</div>
              </div>

              <div className="bg-blue-50 rounded-lg p-4 sm:p-6 text-center">
                <div className="flex justify-center mb-2">
                  <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
                </div>
                <div className="text-3xl sm:text-4xl font-bold text-blue-600 mb-1">
                  {formatDuration(result.duration_seconds)}
                </div>
                <div className="text-sm text-gray-600">Time</div>
              </div>
            </div>

            <div className="text-center text-gray-600 text-base sm:text-lg mb-6">
              Can you beat this score?
            </div>

            <div className="space-y-3 sm:space-y-4">
              <button
                onClick={handlePlayQuiz}
                className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-4 rounded-lg font-bold text-lg sm:text-xl hover:from-green-600 hover:to-green-700 transition-all shadow-lg flex items-center justify-center gap-3"
              >
                <Play className="w-6 h-6" />
                Play This Quiz
              </button>

              <button
                onClick={handleShare}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-base sm:text-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
              >
                <Share2 className="w-5 h-5" />
                {copySuccess ? 'Link Copied!' : 'Share with Friends'}
              </button>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={() => navigate('/')}
              className="text-blue-600 hover:text-blue-700 font-semibold"
            >
              Explore More Quizzes →
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

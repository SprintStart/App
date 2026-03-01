import { useEffect, useState } from 'react';
import { Topic } from '../lib/supabase';
import { loadTopicsPublic } from '../lib/safeApi';
import { useImmersive } from '../contexts/ImmersiveContext';
import { Play } from 'lucide-react';

interface TopicSelectionProps {
  onStartChallenge: (topicId: string) => void;
}

export function TopicSelection({ onStartChallenge }: TopicSelectionProps) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isImmersive } = useImmersive();

  useEffect(() => {
    loadTopics();
  }, []);

  async function loadTopics() {
    try {
      setLoading(true);
      const { data, error } = await loadTopicsPublic();

      if (error) {
        setError(error);
      } else {
        setTopics(data || []);
      }
    } catch (err) {
      console.error('Error loading topics:', err);
      setError('Failed to load topics. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isImmersive ? 'bg-gray-900' : 'bg-gray-50'} p-4`}>
        <div className={`text-center ${isImmersive ? 'text-white text-xl sm:text-2xl md:text-3xl' : 'text-gray-600 text-base sm:text-lg md:text-xl'}`}>
          Loading topics...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isImmersive ? 'bg-gray-900' : 'bg-gray-50'} p-4`}>
        <div className={`text-center ${isImmersive ? 'text-red-400 text-xl sm:text-2xl md:text-3xl' : 'text-red-600 text-base sm:text-lg md:text-xl'}`}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isImmersive ? 'bg-gray-900 p-3 sm:p-6 md:p-8 lg:p-12' : 'bg-gray-50 p-3 sm:p-4 md:p-6 lg:p-8'}`}>
      <div className="max-w-6xl mx-auto">
        <h1 className={`font-bold mb-4 sm:mb-6 md:mb-8 ${isImmersive ? 'text-3xl sm:text-4xl md:text-5xl text-white' : 'text-2xl sm:text-3xl md:text-4xl text-gray-900'}`}>
          Topic Challenge
        </h1>

        <div>
          <h2 className={`font-semibold mb-4 sm:mb-5 md:mb-6 ${isImmersive ? 'text-xl sm:text-2xl md:text-3xl text-gray-200' : 'text-lg sm:text-xl md:text-2xl text-gray-700'}`}>
            Select a Topic
          </h2>
          <div className={`grid gap-3 sm:gap-4 md:gap-6 ${isImmersive ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>
            {topics.map((topic) => (
              <button
                key={topic.id}
                onClick={() => onStartChallenge(topic.id)}
                className={`text-left rounded-lg transition-all ${
                  isImmersive
                    ? 'bg-gray-800 hover:bg-gray-700 p-4 sm:p-6 md:p-8 lg:p-10 border-2 sm:border-3 md:border-4 border-gray-700 hover:border-blue-500'
                    : 'bg-white hover:bg-blue-50 p-3 sm:p-4 md:p-6 shadow-md hover:shadow-xl border border-gray-200'
                }`}
              >
                <div className="flex items-start gap-2 sm:gap-3 md:gap-4">
                  <div className={`rounded-full flex-shrink-0 p-2 sm:p-2.5 md:p-3 ${isImmersive ? 'bg-blue-600' : 'bg-blue-100'}`}>
                    <Play className={isImmersive ? 'w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 text-white' : 'w-5 h-5 sm:w-6 sm:h-6 text-blue-600'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-bold mb-1 sm:mb-1.5 md:mb-2 ${isImmersive ? 'text-lg sm:text-xl md:text-2xl lg:text-3xl text-white' : 'text-base sm:text-lg md:text-xl text-gray-900'} break-words`}>
                      {topic.name}
                    </h3>
                    {topic.description && (
                      <p className={`${isImmersive ? 'text-sm sm:text-base md:text-lg lg:text-xl text-gray-300' : 'text-xs sm:text-sm md:text-base text-gray-600'} break-words`}>
                        {topic.description}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

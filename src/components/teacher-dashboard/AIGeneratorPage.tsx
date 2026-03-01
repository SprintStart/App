import { useState } from 'react';
import { Wand2, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';

interface AIQuestion {
  type: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export function AIGeneratorPage() {
  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState('');
  const [level, setLevel] = useState('gcse');
  const [questionCount, setQuestionCount] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function generateQuiz() {
    if (!topic.trim()) {
      setError('Please enter a topic');
      return;
    }

    if (!subject.trim()) {
      setError('Please enter a subject');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      console.log('[AI Generator] Starting quiz generation...');

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error('No active session. Please log in again.');
      }

      console.log('[AI Generator] Session verified, calling edge function...');

      const difficultyMap: Record<string, 'easy' | 'medium' | 'hard'> = {
        'ks3': 'easy',
        'gcse': 'medium',
        'alevel': 'hard',
        'university': 'hard'
      };

      const { data, error: functionError } = await supabase.functions.invoke('ai-generate-quiz-questions', {
        body: {
          subject: subject.trim(),
          topic: topic.trim(),
          quiz_title: `${topic} Quiz`,
          quiz_description: `AI-generated quiz about ${topic} for ${level.toUpperCase()}`,
          difficulty: difficultyMap[level] || 'medium',
          count: questionCount,
          types: ['mcq'],
          curriculum: 'uk',
          language: 'en-GB'
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (functionError) {
        console.error('[AI Generator] Edge function error:', functionError);
        throw new Error(functionError.message || 'Failed to generate quiz');
      }

      if (!data || !data.items || data.items.length === 0) {
        throw new Error('No questions were generated. Please try again.');
      }

      console.log('[AI Generator] Success! Generated', data.items.length, 'questions');

      const questions = data.items.map((item: AIQuestion) => ({
        id: crypto.randomUUID(),
        question_text: item.question,
        options: item.options,
        correct_index: item.correctIndex,
        explanation: item.explanation || ''
      }));

      const draftKey = `startsprint:createQuizDraft:${session.user.id}`;
      const draft = {
        step: 4,
        selectedSubjectId: '',
        selectedSubjectName: subject,
        selectedTopicId: '',
        title: `${topic} Quiz`,
        difficulty: difficultyMap[level] || 'medium',
        description: `AI-generated quiz about ${topic} for ${level.toUpperCase()}`,
        questions: questions,
        activeQuestionMethod: 'ai',
        lastSavedAt: new Date().toISOString()
      };

      localStorage.setItem(draftKey, JSON.stringify(draft));

      navigate('/teacherdashboard?tab=create-quiz');

    } catch (err: any) {
      console.error('[AI Generator] Error:', err);

      if (err.message.includes('401') || err.message.includes('Unauthorized')) {
        setError('Authentication failed. Please refresh the page and try again.');
      } else if (err.message.includes('403') || err.message.includes('Premium')) {
        setError('Premium subscription required for AI generation.');
      } else {
        setError(err.message || 'Failed to generate quiz. Please try again.');
      }
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <Wand2 className="w-8 h-8 text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Quiz Generator</h1>
        <p className="text-gray-600">Generate custom quizzes instantly using AI</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-900 font-medium">Generation Failed</p>
            <p className="text-red-700 text-sm mt-1">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-sm text-red-600 underline mt-2"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Subject *</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g., Biology, History, Maths"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Topic *</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., Photosynthesis, World War 2, Quadratic Equations"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Education Level</label>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="ks3">Key Stage 3 (Ages 11-14)</option>
            <option value="gcse">GCSE (Ages 14-16)</option>
            <option value="alevel">A-Level (Ages 16-18)</option>
            <option value="university">University</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Number of Questions: {questionCount}
          </label>
          <input
            type="range"
            min="5"
            max="20"
            value={questionCount}
            onChange={(e) => setQuestionCount(parseInt(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>5</span>
            <span>20</span>
          </div>
        </div>

        <button
          onClick={generateQuiz}
          disabled={generating}
          className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating Quiz...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Generate Quiz with AI
            </>
          )}
        </button>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">How it works</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• AI analyzes your subject, topic and education level</li>
            <li>• Generates {questionCount} relevant multiple-choice questions</li>
            <li>• Questions are loaded into the Create Quiz wizard</li>
            <li>• You can review, edit, and publish</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

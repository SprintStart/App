import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Wand2, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

interface Topic {
  id: string;
  name: string;
  slug: string;
  subject: string;
  is_active: boolean;
}

interface GenerationJob {
  topic_id: string;
  topic_name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  quizzes_generated: number;
  questions_generated: number;
  error?: string;
}

export function BulkQuizGenerator() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [jobs, setJobs] = useState<Map<string, GenerationJob>>(new Map());
  const [loading, setLoading] = useState(true);
  const [quizCount, setQuizCount] = useState(10);
  const [questionsPerQuiz, setQuestionsPerQuiz] = useState(10);
  const [difficulty, setDifficulty] = useState('medium');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');

  useEffect(() => {
    loadTopics();
  }, []);

  async function loadTopics() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('topics')
        .select('id, name, slug, subject, is_active')
        .eq('is_active', true)
        .order('subject', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setTopics(data || []);
    } catch (err) {
      console.error('Failed to load topics:', err);
    } finally {
      setLoading(false);
    }
  }

  function toggleTopic(topicId: string) {
    const newSelected = new Set(selectedTopics);
    if (newSelected.has(topicId)) {
      newSelected.delete(topicId);
    } else {
      newSelected.add(topicId);
    }
    setSelectedTopics(newSelected);
  }

  function selectAllInSubject(subject: string) {
    const newSelected = new Set(selectedTopics);
    topics
      .filter(t => subject === 'all' || t.subject === subject)
      .forEach(t => newSelected.add(t.id));
    setSelectedTopics(newSelected);
  }

  function clearSelection() {
    setSelectedTopics(new Set());
  }

  async function generateQuizzesForTopic(topic: Topic) {
    const newJobs = new Map(jobs);
    newJobs.set(topic.id, {
      topic_id: topic.id,
      topic_name: topic.name,
      status: 'running',
      quizzes_generated: 0,
      questions_generated: 0,
    });
    setJobs(newJobs);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bulk-generate-quizzes`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic_id: topic.id,
          quiz_count: quizCount,
          questions_per_quiz: questionsPerQuiz,
          difficulty: difficulty,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Generation failed');
      }

      newJobs.set(topic.id, {
        topic_id: topic.id,
        topic_name: topic.name,
        status: 'completed',
        quizzes_generated: result.quizzes_generated,
        questions_generated: result.questions_generated,
        error: result.failed_quizzes?.length > 0 ? `${result.failed_quizzes.length} quizzes failed` : undefined,
      });
    } catch (error) {
      newJobs.set(topic.id, {
        topic_id: topic.id,
        topic_name: topic.name,
        status: 'failed',
        quizzes_generated: 0,
        questions_generated: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    setJobs(new Map(newJobs));
  }

  async function startBulkGeneration() {
    const selectedTopicList = topics.filter(t => selectedTopics.has(t.id));

    for (const topic of selectedTopicList) {
      await generateQuizzesForTopic(topic);
    }
  }

  const subjects = ['all', ...new Set(topics.map(t => t.subject))];
  const filteredTopics = selectedSubject === 'all'
    ? topics
    : topics.filter(t => t.subject === selectedSubject);

  const isGenerating = Array.from(jobs.values()).some(j => j.status === 'running');

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Bulk Quiz Generator</h1>
        <p className="text-gray-600">Generate multiple quizzes for selected topics using AI</p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Generation Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quizzes per Topic
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={quizCount}
              onChange={(e) => setQuizCount(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              disabled={isGenerating}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Questions per Quiz
            </label>
            <input
              type="number"
              min="5"
              max="20"
              value={questionsPerQuiz}
              onChange={(e) => setQuestionsPerQuiz(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              disabled={isGenerating}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Difficulty
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              disabled={isGenerating}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
              <option value="expert">Expert</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Select Topics</h2>
          <div className="flex gap-2">
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              {subjects.map(subject => (
                <option key={subject} value={subject}>
                  {subject === 'all' ? 'All Subjects' : subject.charAt(0).toUpperCase() + subject.slice(1)}
                </option>
              ))}
            </select>
            <button
              onClick={() => selectAllInSubject(selectedSubject)}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              disabled={isGenerating}
            >
              Select All
            </button>
            <button
              onClick={clearSelection}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              disabled={isGenerating}
            >
              Clear
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
            {filteredTopics.map(topic => {
              const job = jobs.get(topic.id);
              return (
                <div
                  key={topic.id}
                  className={`p-3 border rounded-lg cursor-pointer transition ${
                    selectedTopics.has(topic.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${job ? 'relative' : ''}`}
                  onClick={() => !isGenerating && toggleTopic(topic.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-sm text-gray-900">{topic.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{topic.subject}</div>
                    </div>
                    {job && (
                      <div className="ml-2">
                        {job.status === 'running' && (
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                        )}
                        {job.status === 'completed' && (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        )}
                        {job.status === 'failed' && (
                          <AlertCircle className="w-4 h-4 text-red-600" />
                        )}
                      </div>
                    )}
                  </div>
                  {job && job.status !== 'pending' && (
                    <div className="mt-2 text-xs">
                      {job.status === 'completed' && (
                        <div className="text-green-600">
                          {job.quizzes_generated} quizzes, {job.questions_generated} questions
                        </div>
                      )}
                      {job.error && (
                        <div className="text-red-600">{job.error}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 text-sm text-gray-600">
          {selectedTopics.size} topic{selectedTopics.size !== 1 ? 's' : ''} selected
          {selectedTopics.size > 0 && (
            <span className="ml-2">
              (Will generate {selectedTopics.size * quizCount} quizzes total)
            </span>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <button
          onClick={startBulkGeneration}
          disabled={selectedTopics.size === 0 || isGenerating}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Wand2 className="w-5 h-5" />
              Generate {selectedTopics.size * quizCount} Quizzes
            </>
          )}
        </button>
      </div>

      {jobs.size > 0 && (
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Generation Progress</h2>
          <div className="space-y-2">
            {Array.from(jobs.values()).map(job => (
              <div key={job.topic_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {job.status === 'running' && <Loader2 className="w-5 h-5 animate-spin text-blue-600" />}
                  {job.status === 'completed' && <CheckCircle className="w-5 h-5 text-green-600" />}
                  {job.status === 'failed' && <AlertCircle className="w-5 h-5 text-red-600" />}
                  <span className="font-medium">{job.topic_name}</span>
                </div>
                <div className="text-sm text-gray-600">
                  {job.status === 'running' && 'Generating...'}
                  {job.status === 'completed' && `${job.quizzes_generated} quizzes, ${job.questions_generated} questions`}
                  {job.status === 'failed' && job.error}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

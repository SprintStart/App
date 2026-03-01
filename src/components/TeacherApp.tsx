import { useState, useEffect } from 'react';
import { supabase, Topic, QuestionSet, TopicQuestion } from '../lib/supabase';
import { Plus, Edit2, Trash2, Save, X, Sparkles, BarChart3, FileText } from 'lucide-react';
import { AIQuizGenerator } from './AIQuizGenerator';
import { DocumentUpload } from './DocumentUpload';
import { useNavigate } from 'react-router-dom';

export function TeacherApp() {
  const navigate = useNavigate();
  const [view, setView] = useState<'topics' | 'questions'>('topics');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [selectedQuestionSet, setSelectedQuestionSet] = useState<QuestionSet | null>(null);
  const [questions, setQuestions] = useState<TopicQuestion[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);

  useEffect(() => {
    loadTopics();
  }, []);

  useEffect(() => {
    if (selectedTopic) {
      loadQuestionSets(selectedTopic.id);
    }
  }, [selectedTopic]);

  useEffect(() => {
    if (selectedQuestionSet) {
      loadQuestions(selectedQuestionSet.id);
    }
  }, [selectedQuestionSet]);

  async function loadTopics() {
    try {
      setLoading(true);
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data, error } = await supabase
        .from('topics')
        .select('*')
        .eq('created_by', user.user.id)
        .order('name');

      if (error) throw error;
      setTopics(data || []);
    } catch (err) {
      console.error('Failed to load topics:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadQuestionSets(topicId: string) {
    try {
      const { data, error } = await supabase
        .from('question_sets')
        .select('*')
        .eq('topic_id', topicId)
        .order('title');

      if (error) throw error;
      setQuestionSets(data || []);
    } catch (err) {
      console.error('Failed to load question sets:', err);
    }
  }

  async function loadQuestions(questionSetId: string) {
    try {
      const { data, error } = await supabase
        .from('topic_questions')
        .select('*')
        .eq('question_set_id', questionSetId)
        .order('order_index');

      if (error) throw error;
      setQuestions(data || []);
    } catch (err) {
      console.error('Failed to load questions:', err);
    }
  }

  async function createTopic(name: string, description: string) {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const { error } = await supabase.from('topics').insert({
        name,
        slug,
        description,
        created_by: user.user.id,
      });

      if (error) throw error;
      loadTopics();
    } catch (err) {
      console.error('Failed to create topic:', err);
    }
  }

  async function createQuestionSet(title: string, difficulty: string) {
    if (!selectedTopic) return;

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { error } = await supabase.from('question_sets').insert({
        topic_id: selectedTopic.id,
        title,
        difficulty,
        created_by: user.user.id,
      });

      if (error) throw error;
      loadQuestionSets(selectedTopic.id);
    } catch (err) {
      console.error('Failed to create question set:', err);
    }
  }

  async function createQuestion(questionText: string, options: string[], correctIndex: number) {
    if (!selectedQuestionSet) return;

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { error } = await supabase.from('topic_questions').insert({
        question_set_id: selectedQuestionSet.id,
        question_text: questionText,
        options: options,
        correct_index: correctIndex,
        order_index: questions.length,
        created_by: user.user.id,
      });

      if (error) throw error;

      await supabase
        .from('question_sets')
        .update({ question_count: questions.length + 1 })
        .eq('id', selectedQuestionSet.id);

      loadQuestions(selectedQuestionSet.id);
    } catch (err) {
      console.error('Failed to create question:', err);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Topic Challenge Builder</h1>

        <div className="flex gap-4 mb-8 flex-wrap">
          <button
            onClick={() => setView('topics')}
            className={`px-6 py-3 rounded-lg font-medium ${
              view === 'topics'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-300'
            }`}
          >
            Topics & Question Sets
          </button>
          <button
            onClick={() => setView('questions')}
            disabled={!selectedQuestionSet}
            className={`px-6 py-3 rounded-lg font-medium ${
              view === 'questions' && selectedQuestionSet
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-300'
            } ${!selectedQuestionSet ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Questions
          </button>
          <button
            onClick={() => setShowAIGenerator(true)}
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
          >
            <Sparkles className="w-5 h-5" />
            AI Generate Quiz
          </button>
          <button
            onClick={() => navigate('/analytics')}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
          >
            <BarChart3 className="w-5 h-5" />
            Analytics
          </button>
          <button
            onClick={() => setShowDocumentUpload(true)}
            className="flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700"
          >
            <FileText className="w-5 h-5" />
            Upload Document
          </button>
        </div>

        {showAIGenerator && (
          <AIQuizGenerator
            onClose={() => setShowAIGenerator(false)}
            onQuizCreated={() => {
              loadTopics();
              setShowAIGenerator(false);
            }}
          />
        )}

        {showDocumentUpload && (
          <DocumentUpload
            onClose={() => setShowDocumentUpload(false)}
            onQuizCreated={() => {
              loadTopics();
              setShowDocumentUpload(false);
            }}
          />
        )}

        {view === 'topics' ? (
          <TopicsView
            topics={topics}
            selectedTopic={selectedTopic}
            questionSets={questionSets}
            onSelectTopic={setSelectedTopic}
            onCreateTopic={createTopic}
            onCreateQuestionSet={createQuestionSet}
            onSelectQuestionSet={(qs) => {
              setSelectedQuestionSet(qs);
              setView('questions');
            }}
          />
        ) : (
          <QuestionsView
            questionSet={selectedQuestionSet}
            questions={questions}
            onCreateQuestion={createQuestion}
            onBack={() => setView('topics')}
          />
        )}
      </div>
    </div>
  );
}

function TopicsView({
  topics,
  selectedTopic,
  questionSets,
  onSelectTopic,
  onCreateTopic,
  onCreateQuestionSet,
  onSelectQuestionSet,
}: any) {
  const [showTopicForm, setShowTopicForm] = useState(false);
  const [showQSForm, setShowQSForm] = useState(false);
  const [topicName, setTopicName] = useState('');
  const [topicDesc, setTopicDesc] = useState('');
  const [qsTitle, setQSTitle] = useState('');
  const [qsDifficulty, setQSDifficulty] = useState('');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Topics</h2>
          <button
            onClick={() => setShowTopicForm(!showTopicForm)}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {showTopicForm && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <input
              type="text"
              placeholder="Topic name"
              value={topicName}
              onChange={(e) => setTopicName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-2"
            />
            <textarea
              placeholder="Description"
              value={topicDesc}
              onChange={(e) => setTopicDesc(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-2"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onCreateTopic(topicName, topicDesc);
                  setTopicName('');
                  setTopicDesc('');
                  setShowTopicForm(false);
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Create
              </button>
              <button
                onClick={() => setShowTopicForm(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {topics.map((topic: Topic) => (
            <button
              key={topic.id}
              onClick={() => onSelectTopic(topic)}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                selectedTopic?.id === topic.id
                  ? 'bg-blue-50 border-blue-500'
                  : 'bg-white border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="font-semibold text-gray-900">{topic.name}</div>
              {topic.description && (
                <div className="text-sm text-gray-600 mt-1">{topic.description}</div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Question Sets</h2>
          {selectedTopic && (
            <button
              onClick={() => setShowQSForm(!showQSForm)}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
        </div>

        {!selectedTopic ? (
          <p className="text-gray-500">Select a topic to view question sets</p>
        ) : (
          <>
            {showQSForm && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <input
                  type="text"
                  placeholder="Question set title"
                  value={qsTitle}
                  onChange={(e) => setQSTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-2"
                />
                <input
                  type="text"
                  placeholder="Difficulty (optional)"
                  value={qsDifficulty}
                  onChange={(e) => setQSDifficulty(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-2"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onCreateQuestionSet(qsTitle, qsDifficulty);
                      setQSTitle('');
                      setQSDifficulty('');
                      setShowQSForm(false);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setShowQSForm(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {questionSets.map((qs: QuestionSet) => (
                <button
                  key={qs.id}
                  onClick={() => onSelectQuestionSet(qs)}
                  className="w-full text-left p-4 rounded-lg border-2 bg-white border-gray-200 hover:border-blue-300 transition-all"
                >
                  <div className="font-semibold text-gray-900">{qs.title}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    {qs.difficulty && `${qs.difficulty} • `}
                    {qs.question_count} questions
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function QuestionsView({ questionSet, questions, onCreateQuestion, onBack }: any) {
  const [showForm, setShowForm] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState(0);

  function handleAddQuestion() {
    const validOptions = options.filter((o) => o.trim());
    if (questionText.trim() && validOptions.length >= 2) {
      onCreateQuestion(questionText, validOptions, correctIndex);
      setQuestionText('');
      setOptions(['', '', '', '']);
      setCorrectIndex(0);
      setShowForm(false);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <button onClick={onBack} className="mb-6 text-blue-600 hover:text-blue-800 font-medium">
        ← Back to Topics
      </button>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {questionSet?.title} - Questions
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-6 bg-gray-50 rounded-lg">
          <textarea
            placeholder="Question text"
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
            rows={3}
          />

          <div className="space-y-2 mb-4">
            {options.map((option, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  type="radio"
                  name="correct"
                  checked={correctIndex === idx}
                  onChange={() => setCorrectIndex(idx)}
                  className="w-5 h-5"
                />
                <input
                  type="text"
                  placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                  value={option}
                  onChange={(e) => {
                    const newOptions = [...options];
                    newOptions[idx] = e.target.value;
                    setOptions(newOptions);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAddQuestion}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Add Question
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {questions.map((q: TopicQuestion, idx: number) => (
          <div key={q.id} className="p-4 border border-gray-200 rounded-lg">
            <div className="font-semibold text-gray-900 mb-2">
              {idx + 1}. {q.question_text}
            </div>
            <div className="space-y-1">
              {(q.options as string[]).map((option, optIdx) => (
                <div
                  key={optIdx}
                  className={`text-sm px-3 py-1 rounded ${
                    optIdx === q.correct_index ? 'bg-green-100 text-green-800' : 'text-gray-600'
                  }`}
                >
                  {String.fromCharCode(65 + optIdx)}. {option}
                  {optIdx === q.correct_index && ' ✓'}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Save, ArrowLeft, Loader2, Plus, Trash2, X } from 'lucide-react';

interface Question {
  id?: string;
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string;
  order_index: number;
}

export function EditQuizPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const quizId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [topicId, setTopicId] = useState('');
  const [topicName, setTopicName] = useState('');
  const [subject, setSubject] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (quizId) {
      loadQuiz();
    }
  }, [quizId]);

  async function loadQuiz() {
    try {
      setLoading(true);
      setError(null);

      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        setError('Please log in to edit quizzes');
        return;
      }

      const { data: quiz, error: quizError } = await supabase
        .from('question_sets')
        .select(`
          id,
          title,
          difficulty,
          topic_id,
          topic:topics (
            id,
            name,
            subject
          )
        `)
        .eq('id', quizId)
        .eq('created_by', user.user.id)
        .maybeSingle();

      if (quizError) {
        console.error('Error loading quiz:', quizError);
        setError('Failed to load quiz');
        return;
      }

      if (!quiz) {
        setError('Quiz not found or you do not have permission to edit it');
        return;
      }

      // Handle topic data (could be array or object from Supabase)
      const topicData = Array.isArray(quiz.topic) ? quiz.topic[0] : quiz.topic;

      setTitle(quiz.title);
      setDifficulty(quiz.difficulty || 'medium');
      setTopicId(quiz.topic_id);
      setTopicName(topicData?.name || '');
      setSubject(topicData?.subject || '');

      const { data: questionsData, error: questionsError } = await supabase
        .from('topic_questions')
        .select('*')
        .eq('question_set_id', quizId)
        .order('order_index', { ascending: true });

      if (questionsError) {
        console.error('Error loading questions:', questionsError);
        setError('Failed to load questions');
        return;
      }

      setQuestions(questionsData || []);
    } catch (err: any) {
      console.error('Error loading quiz:', err);
      setError(err.message || 'Failed to load quiz');
    } finally {
      setLoading(false);
    }
  }

  function addQuestion() {
    const newQuestion: Question = {
      question_text: '',
      options: ['', '', '', ''],
      correct_index: 0,
      explanation: '',
      order_index: questions.length
    };
    setQuestions([...questions, newQuestion]);
  }

  function removeQuestion(index: number) {
    if (questions.length === 1) {
      alert('You must have at least one question');
      return;
    }
    const updated = questions.filter((_, i) => i !== index);
    updated.forEach((q, i) => q.order_index = i);
    setQuestions(updated);
  }

  function updateQuestion(index: number, field: keyof Question, value: any) {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  }

  function updateOption(questionIndex: number, optionIndex: number, value: string) {
    const updated = [...questions];
    const options = [...updated[questionIndex].options];
    options[optionIndex] = value;
    updated[questionIndex] = { ...updated[questionIndex], options };
    setQuestions(updated);
  }

  async function handleSave() {
    if (!title.trim()) {
      alert('Please enter a quiz title');
      return;
    }

    const validQuestions = questions.filter(q => q.question_text.trim() && q.options.every(opt => opt.trim()));
    if (validQuestions.length === 0) {
      alert('Please add at least one complete question');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        alert('Please log in to save changes');
        return;
      }

      const { error: updateError } = await supabase
        .from('question_sets')
        .update({
          title,
          difficulty,
          question_count: validQuestions.length,
          updated_at: new Date().toISOString()
        })
        .eq('id', quizId);

      if (updateError) {
        console.error('Error updating quiz:', updateError);
        alert('Failed to save quiz changes');
        return;
      }

      const existingQuestionIds = questions.filter(q => q.id).map(q => q.id);
      if (existingQuestionIds.length > 0) {
        await supabase
          .from('topic_questions')
          .delete()
          .eq('question_set_id', quizId);
      }

      const questionsToInsert = validQuestions.map((q, index) => ({
        question_set_id: quizId,
        question_text: q.question_text.trim(),
        options: q.options.map(opt => opt.trim()),
        correct_index: q.correct_index,
        explanation: q.explanation.trim(),
        order_index: index
      }));

      const { error: questionsError } = await supabase
        .from('topic_questions')
        .insert(questionsToInsert);

      if (questionsError) {
        console.error('Error saving questions:', questionsError);
        alert('Failed to save questions');
        return;
      }

      await supabase.from('teacher_activities').insert({
        teacher_id: user.user.id,
        activity_type: 'quiz_updated',
        title: title,
        entity_id: quizId
      });

      alert('Quiz updated successfully!');
      navigate('/teacherdashboard?tab=my-quizzes');
    } catch (err: any) {
      console.error('Error saving quiz:', err);
      alert(err.message || 'Failed to save quiz');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-bold text-red-900 mb-2">Error</h2>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={() => navigate('/teacherdashboard?tab=my-quizzes')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to My Quizzes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/teacherdashboard?tab=my-quizzes')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Edit Quiz</h1>
            <p className="text-gray-600 mt-1">{subject} / {topicName}</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Changes
            </>
          )}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quiz Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quiz Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter quiz title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Difficulty
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Questions ({questions.length})</h2>
          <button
            onClick={addQuestion}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Question
          </button>
        </div>

        {questions.map((question, qIndex) => (
          <div key={qIndex} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Question {qIndex + 1}</h3>
              {questions.length > 1 && (
                <button
                  onClick={() => removeQuestion(qIndex)}
                  className="p-1 hover:bg-red-50 rounded text-red-600"
                  title="Remove question"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Question Text *
                </label>
                <textarea
                  value={question.question_text}
                  onChange={(e) => updateQuestion(qIndex, 'question_text', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Enter your question"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Answer Options *
                </label>
                <div className="space-y-2">
                  {question.options.map((option, optIndex) => (
                    <div key={optIndex} className="flex items-center gap-3">
                      <input
                        type="radio"
                        name={`correct-${qIndex}`}
                        checked={question.correct_index === optIndex}
                        onChange={() => updateQuestion(qIndex, 'correct_index', optIndex)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => updateOption(qIndex, optIndex, e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={`Option ${String.fromCharCode(65 + optIndex)}`}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Select the radio button for the correct answer
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Explanation (Optional)
                </label>
                <textarea
                  value={question.explanation}
                  onChange={(e) => updateQuestion(qIndex, 'explanation', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                  placeholder="Explain why this is the correct answer"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-4 pt-4">
        <button
          onClick={() => navigate('/teacherdashboard?tab=my-quizzes')}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}

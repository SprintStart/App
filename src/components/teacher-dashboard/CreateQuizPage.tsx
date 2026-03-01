import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import { Save, Eye, Loader2, Plus, Trash2 } from 'lucide-react';

interface Question {
  id: string;
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

export function CreateQuizPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('mathematics');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [questions, setQuestions] = useState<Question[]>([{
    id: crypto.randomUUID(),
    question_text: '',
    options: ['', '', '', ''],
    correct_index: 0,
    explanation: ''
  }]);

  useEffect(() => {
    const state = location.state as any;
    if (state?.generatedQuestions && Array.isArray(state.generatedQuestions)) {
      const generatedQuestions = state.generatedQuestions.map((q: any) => ({
        id: crypto.randomUUID(),
        question_text: q.question || '',
        options: q.options || ['', '', '', ''],
        correct_index: q.correctIndex ?? 0,
        explanation: q.explanation || ''
      }));
      setQuestions(generatedQuestions);

      if (state.subject) setSubject(state.subject);
      if (state.topic) setTitle(state.topic);
    }
  }, [location.state]);

  function addQuestion() {
    setQuestions([...questions, {
      id: crypto.randomUUID(),
      question_text: '',
      options: ['', '', '', ''],
      correct_index: 0,
      explanation: ''
    }]);
  }

  function removeQuestion(id: string) {
    if (questions.length === 1) {
      alert('You must have at least one question');
      return;
    }
    setQuestions(questions.filter(q => q.id !== id));
  }

  function updateQuestion(id: string, field: keyof Question, value: any) {
    setQuestions(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
  }

  function updateOption(questionId: string, optionIndex: number, value: string) {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        const newOptions = [...q.options];
        newOptions[optionIndex] = value;
        return { ...q, options: newOptions };
      }
      return q;
    }));
  }

  async function saveDraft() {
    if (!title.trim()) {
      alert('Please enter a quiz title');
      return;
    }

    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      await supabase.from('teacher_quiz_drafts').insert({
        teacher_id: user.user.id,
        title,
        subject,
        description,
        difficulty,
        questions: questions
      });

      await supabase.from('teacher_activities').insert({
        teacher_id: user.user.id,
        activity_type: 'quiz_created',
        title
      });

      alert('Draft saved successfully!');
      navigate('/teacherdashboard?tab=quizzes');
    } catch (err) {
      console.error('Failed to save draft:', err);
      alert('Failed to save draft');
    } finally {
      setSaving(false);
    }
  }

  async function publishQuiz() {
    if (!title.trim()) {
      alert('Please enter a quiz title');
      return;
    }

    const invalidQuestions = questions.filter(q =>
      !q.question_text.trim() ||
      q.options.some(opt => !opt.trim())
    );

    if (invalidQuestions.length > 0) {
      alert('Please complete all questions before publishing');
      return;
    }

    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      const { data: topic } = await supabase
        .from('topics')
        .insert({
          name: title,
          slug,
          subject,
          description,
          created_by: user.user.id,
          is_published: true,
          is_active: true
        })
        .select()
        .single();

      if (!topic) throw new Error('Failed to create topic');

      const { data: questionSet } = await supabase
        .from('question_sets')
        .insert({
          topic_id: topic.id,
          title: title,
          difficulty,
          created_by: user.user.id,
          approval_status: 'approved',
          question_count: questions.length
        })
        .select()
        .single();

      if (!questionSet) throw new Error('Failed to create question set');

      const questionsToInsert = questions.map((q, index) => ({
        question_set_id: questionSet.id,
        question_text: q.question_text,
        options: q.options,
        correct_index: q.correct_index,
        explanation: q.explanation,
        order_index: index,
        created_by: user.user.id,
        is_published: true
      }));

      await supabase.from('topic_questions').insert(questionsToInsert);

      await supabase.from('teacher_activities').insert({
        teacher_id: user.user.id,
        activity_type: 'quiz_published',
        title,
        entity_id: topic.id
      });

      alert('Quiz published successfully!');
      navigate('/teacherdashboard?tab=quizzes');
    } catch (err) {
      console.error('Failed to publish quiz:', err);
      alert('Failed to publish quiz');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Create Quiz</h1>
        <div className="flex gap-2">
          <button
            onClick={saveDraft}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 inline-flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Draft
          </button>
          <button
            onClick={publishQuiz}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
            Publish
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Quiz Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Algebra Basics Quiz"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject *</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="mathematics">Mathematics</option>
              <option value="science">Science</option>
              <option value="english">English</option>
              <option value="computing">Computing</option>
              <option value="business">Business</option>
              <option value="geography">Geography</option>
              <option value="history">History</option>
              <option value="languages">Languages</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of the quiz content..."
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Questions ({questions.length})</h2>
          <button
            onClick={addQuestion}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Question
          </button>
        </div>

        {questions.map((question, qIndex) => (
          <div key={question.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Question {qIndex + 1}</h3>
              {questions.length > 1 && (
                <button
                  onClick={() => removeQuestion(question.id)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Question Text *</label>
              <input
                type="text"
                value={question.question_text}
                onChange={(e) => updateQuestion(question.id, 'question_text', e.target.value)}
                placeholder="Enter your question..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Options *</label>
              <div className="space-y-2">
                {question.options.map((option, oIndex) => (
                  <div key={oIndex} className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={question.correct_index === oIndex}
                      onChange={() => updateQuestion(question.id, 'correct_index', oIndex)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(question.id, oIndex, e.target.value)}
                      placeholder={`Option ${oIndex + 1}`}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">Select the radio button for the correct answer</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Explanation (Optional)</label>
              <textarea
                value={question.explanation}
                onChange={(e) => updateQuestion(question.id, 'explanation', e.target.value)}
                placeholder="Explain why this answer is correct..."
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

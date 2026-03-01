import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuizDraft } from '../../hooks/useQuizDraft';
import { uploadQuestionImage, deleteQuestionImage } from '../../lib/imageUpload';
import { PublishDestinationPicker, type PublishDestination } from './PublishDestinationPicker';
import {
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Plus,
  Trash2,
  Wand2,
  Upload,
  Edit3,
  Save,
  Eye,
  Clock,
  AlertCircle,
  Image as ImageIcon,
  X,
  Lock
} from 'lucide-react';

type QuestionType = 'mcq' | 'true_false' | 'yes_no';

interface Question {
  id: string;
  question_text: string;
  question_type: QuestionType;
  options: string[];
  correct_index: number;
  explanation: string;
  image_url?: string;
}

interface Subject {
  id: string;
  name: string;
}

interface Topic {
  id: string;
  name: string;
  subject_id: string;
}

const AVAILABLE_SUBJECTS: Subject[] = [
  { id: 'mathematics', name: 'Mathematics' },
  { id: 'science', name: 'Science' },
  { id: 'english', name: 'English' },
  { id: 'computing', name: 'Computing' },
  { id: 'business', name: 'Business' },
  { id: 'geography', name: 'Geography' },
  { id: 'history', name: 'History' },
  { id: 'languages', name: 'Languages' },
  { id: 'art', name: 'Art' },
  { id: 'engineering', name: 'Engineering' },
  { id: 'health', name: 'Health' },
  { id: 'other', name: 'Other' }
];

const FEATURE_AI_GENERATOR = import.meta.env.VITE_FEATURE_AI_GENERATOR === 'true';

export function CreateQuizWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loadDraft, saveDraft: saveToLocalStorage, clearDraft, autosaving, lastSaved, saveError } = useQuizDraft();

  // Wizard state
  const [step, setStep] = useState(0); // Start at step 0 (destination picker)
  const [loading, setLoading] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [saving, setSaving] = useState(false);

  // Step 0: Publish Destination
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [publishDestination, setPublishDestination] = useState<PublishDestination | null>(null);

  // Step 1: Subject
  const [customSubjects, setCustomSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedSubjectName, setSelectedSubjectName] = useState('');
  const [newSubjectName, setNewSubjectName] = useState('');
  const [creatingSubject, setCreatingSubject] = useState(false);

  // Step 2: Topic
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [newTopicName, setNewTopicName] = useState('');
  const [creatingTopic, setCreatingTopic] = useState(false);

  // Step 3: Details
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [description, setDescription] = useState('');
  const [draftId, setDraftId] = useState<string | null>(null);

  // Step 4: Questions
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeQuestionMethod, setActiveQuestionMethod] = useState<'manual' | 'ai' | 'document'>('manual');

  // AI Generation
  const [aiTopic, setAiTopic] = useState('');
  const [aiQuestionCount, setAiQuestionCount] = useState(5);
  const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [generatingAI, setGeneratingAI] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);

  // Document Upload
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [processingDoc, setProcessingDoc] = useState(false);

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Bulk Import state
  const [bulkImportText, setBulkImportText] = useState('');
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImportErrors, setBulkImportErrors] = useState<string[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Bulk import parser - Enhanced version supporting multiple formats
  function parseBulkImport(text: string): { questions: Question[]; errors: string[] } {
    const errors: string[] = [];
    const questions: Question[] = [];
    const lines = text.split('\n').map((l, idx) => ({ text: l.trim(), lineNum: idx + 1 })).filter(l => l.text.length > 0);

    let i = 0;
    let questionNumber = 1;

    // Helper: Check if line is a type header
    function isTypeHeader(line: string): { isHeader: boolean; type: 'mcq' | 'true_false' | 'yes_no' | null } {
      const normalized = line.trim().replace(/[-_\s]/g, '').toLowerCase();

      // MCQ patterns: "MCQ", "Multiple Choice", "multiplechoice", etc.
      if (/^(mcq|multiplechoice)$/i.test(normalized)) return { isHeader: true, type: 'mcq' };

      // True/False patterns: "True/False", "TrueFalse", "T/F", "TF", etc.
      if (/^(truefalse|tf|trueorfalse)$/i.test(normalized)) return { isHeader: true, type: 'true_false' };

      // Yes/No patterns: "Yes/No", "YesNo", "Y/N", "YN", etc.
      if (/^(yesno|yn|yesorno)$/i.test(normalized)) return { isHeader: true, type: 'yes_no' };

      return { isHeader: false, type: null };
    }

    // Helper: Extract question text (remove "Question:" prefix and numbering)
    function cleanQuestionText(text: string): string {
      return text
        .replace(/^\d+[\)\.:\-]\s*/, '') // Remove "1)" or "1." or "1:" or "1-"
        .replace(/^Question\s*:\s*/i, '') // Remove "Question:"
        .trim();
    }

    // Helper: Check if line is an MCQ option
    function parseMCQOption(line: string): { isOption: boolean; letter: string; text: string; isCorrect: boolean } {
      // Match patterns: A) A. A: A- followed by text
      const match = line.match(/^([A-F])[\.\):\-]\s*(.+)/i);
      if (!match) return { isOption: false, letter: '', text: '', isCorrect: false };

      const optionText = match[2].trim();
      const hasCorrectMarker = /✅|\(correct\)|\(answer\)|\*\*correct\*\*/i.test(optionText);
      const cleanText = optionText.replace(/✅|\(correct\)|\(answer\)|\*\*correct\*\*/gi, '').trim();

      return {
        isOption: true,
        letter: match[1].toUpperCase(),
        text: cleanText,
        isCorrect: hasCorrectMarker
      };
    }

    // Helper: Parse "Answer: B" line
    function parseAnswerLine(line: string): { isAnswerLine: boolean; answer: string } {
      const match = line.match(/^(Answer|Correct|Solution)\s*:\s*([A-F])/i);
      if (match) return { isAnswerLine: true, answer: match[2].toUpperCase() };
      return { isAnswerLine: false, answer: '' };
    }

    // Helper: Detect True/False answer patterns
    function detectTrueFalseAnswer(lines: Array<{ text: string; lineNum: number }>, startIndex: number): {
      found: boolean;
      answer: 'true' | 'false' | null;
      consumed: number;
    } {
      if (startIndex >= lines.length) return { found: false, answer: null, consumed: 0 };

      const nextLine = lines[startIndex].text;

      // Pattern 1: Just "True" or "False" on next line
      if (/^(True|False)$/i.test(nextLine)) {
        return {
          found: true,
          answer: nextLine.toLowerCase() as 'true' | 'false',
          consumed: 1
        };
      }

      // Pattern 2: "Answer: True" or "Answer: False"
      const answerMatch = nextLine.match(/^(Answer|Correct|Solution)\s*:\s*(True|False|T|F)/i);
      if (answerMatch) {
        const ans = answerMatch[2].toUpperCase();
        return {
          found: true,
          answer: (ans === 'TRUE' || ans === 'T') ? 'true' : 'false',
          consumed: 1
        };
      }

      return { found: false, answer: null, consumed: 0 };
    }

    // Helper: Detect Yes/No answer patterns
    function detectYesNoAnswer(lines: Array<{ text: string; lineNum: number }>, startIndex: number): {
      found: boolean;
      answer: 'yes' | 'no' | null;
      consumed: number;
    } {
      if (startIndex >= lines.length) return { found: false, answer: null, consumed: 0 };

      const nextLine = lines[startIndex].text;

      // Pattern 1: Just "Yes" or "No" on next line
      if (/^(Yes|No)$/i.test(nextLine)) {
        return {
          found: true,
          answer: nextLine.toLowerCase() as 'yes' | 'no',
          consumed: 1
        };
      }

      // Pattern 2: "Answer: Yes" or "Answer: No"
      const answerMatch = nextLine.match(/^(Answer|Correct|Solution)\s*:\s*(Yes|No|Y|N)/i);
      if (answerMatch) {
        const ans = answerMatch[2].toUpperCase();
        return {
          found: true,
          answer: (ans === 'YES' || ans === 'Y') ? 'yes' : 'no',
          consumed: 1
        };
      }

      return { found: false, answer: null, consumed: 0 };
    }

    while (i < lines.length) {
      const { text: line, lineNum } = lines[i];
      const headerCheck = isTypeHeader(line);

      // Auto-detect MCQ if we see option pattern (A. or A) or A:)
      const nextLine = i + 1 < lines.length ? lines[i + 1].text : '';
      const isLikelyMCQQuestion = !headerCheck.isHeader && /^([A-F])[\.\):\-]\s*\S+/i.test(nextLine);

      // Auto-detect True/False if question ends with ? and next line has True/False
      const tfDetection = detectTrueFalseAnswer(lines, i + 1);
      const isLikelyTrueFalse = !headerCheck.isHeader && !isLikelyMCQQuestion && tfDetection.found;

      // Auto-detect Yes/No if question ends with ? and next line has Yes/No
      const ynDetection = detectYesNoAnswer(lines, i + 1);
      const isLikelyYesNo = !headerCheck.isHeader && !isLikelyMCQQuestion && !isLikelyTrueFalse && ynDetection.found;

      if (headerCheck.isHeader && headerCheck.type) {
        const questionType = headerCheck.type;
        i++;

        // Handle multi-question blocks - keep parsing same type until next type header or end
        while (i < lines.length) {
          if (i >= lines.length) break;

          // Check if we hit another type header - if so, break and let outer loop handle it
          const nextHeaderCheck = isTypeHeader(lines[i].text);
          if (nextHeaderCheck.isHeader) break;

          // Get question text
          let questionText = cleanQuestionText(lines[i].text);
          const questionLineNum = lines[i].lineNum;

          if (!questionText) {
            errors.push(`Line ${questionLineNum}: Empty question text after type header`);
            i++;
            continue;
          }

          i++;

          if (questionType === 'mcq') {
            // Parse MCQ
            const options: string[] = [];
            let correctIndex = -1;
            const optionLetters: string[] = [];
            let answerLetter = '';

            // Check if answer is inline in question (e.g., "What is 2+2? (B)")
            const inlineAnswerMatch = questionText.match(/\(([A-F])\)\s*$/i);
            if (inlineAnswerMatch) {
              answerLetter = inlineAnswerMatch[1].toUpperCase();
              questionText = questionText.replace(/\(([A-F])\)\s*$/i, '').trim();
            }

            // Parse options
            while (i < lines.length) {
              const optionCheck = parseMCQOption(lines[i].text);
              if (!optionCheck.isOption) {
                // Check if it's an "Answer: B" line
                const answerCheck = parseAnswerLine(lines[i].text);
                if (answerCheck.isAnswerLine) {
                  answerLetter = answerCheck.answer;
                  i++;
                }
                break;
              }

              optionLetters.push(optionCheck.letter);
              options.push(optionCheck.text);
              if (optionCheck.isCorrect) {
                correctIndex = options.length - 1;
              }
              i++;
            }

            // Validate
            if (options.length < 2) {
              errors.push(`Line ${questionLineNum}: MCQ must have at least 2 options`);
              questionNumber++;
              continue;
            }

            // Determine correct answer
            if (correctIndex === -1 && answerLetter) {
              // Find index by letter
              const letterIndex = optionLetters.indexOf(answerLetter);
              if (letterIndex !== -1) {
                correctIndex = letterIndex;
              }
            }

            if (correctIndex === -1) {
              errors.push(`Line ${questionLineNum}: No correct answer marked. Use ✅, (Correct), or "Answer: B"`);
              questionNumber++;
              continue;
            }

            questions.push({
              id: `q-${Date.now()}-${questionNumber}`,
              question_text: questionText,
              question_type: 'mcq',
              options,
              correct_index: correctIndex,
              explanation: ''
            });

          } else if (questionType === 'true_false') {
            // Parse True/False - support inline or "Answer: True" format
            let answer = '';

            // Check inline (T), (F), (True), (False)
            const inlineMatch = questionText.match(/\((T|F|True|False)\)\s*$/i);
            if (inlineMatch) {
              answer = inlineMatch[1].toUpperCase();
              questionText = questionText.replace(/\((T|F|True|False)\)\s*$/i, '').trim();
            } else if (i < lines.length) {
              // Check for "Answer: True" or "Answer: T" on next line
              const answerMatch = lines[i].text.match(/^(Answer|Correct|Solution)\s*:\s*(T|F|True|False)/i);
              if (answerMatch) {
                answer = answerMatch[2].toUpperCase();
                i++;
              }
            }

            if (!answer) {
              errors.push(`Line ${questionLineNum}: True/False must have answer. Use (T), (F), or "Answer: True"`);
              questionNumber++;
              continue;
            }

            const correctIndex = (answer === 'T' || answer === 'TRUE') ? 0 : 1;

            questions.push({
              id: `q-${Date.now()}-${questionNumber}`,
              question_text: questionText,
              question_type: 'true_false',
              options: ['True', 'False'],
              correct_index: correctIndex,
              explanation: ''
            });

          } else if (questionType === 'yes_no') {
            // Parse Yes/No - support inline or "Answer: Yes" format
            let answer = '';

            // Check inline (Yes), (No), (Y), (N)
            const inlineMatch = questionText.match(/\((Yes|No|Y|N)\)\s*$/i);
            if (inlineMatch) {
              answer = inlineMatch[1].toUpperCase();
              questionText = questionText.replace(/\((Yes|No|Y|N)\)\s*$/i, '').trim();
            } else if (i < lines.length) {
              // Check for "Answer: Yes" or "Answer: Y" on next line
              const answerMatch = lines[i].text.match(/^(Answer|Correct|Solution)\s*:\s*(Yes|No|Y|N)/i);
              if (answerMatch) {
                answer = answerMatch[2].toUpperCase();
                i++;
              }
            }

            if (!answer) {
              errors.push(`Line ${questionLineNum}: Yes/No must have answer. Use (Yes), (No), or "Answer: Yes"`);
              questionNumber++;
              continue;
            }

            const correctIndex = (answer === 'YES' || answer === 'Y') ? 0 : 1;

            questions.push({
              id: `q-${Date.now()}-${questionNumber}`,
              question_text: questionText,
              question_type: 'yes_no',
              options: ['Yes', 'No'],
              correct_index: correctIndex,
              explanation: ''
            });
          }

          questionNumber++;

          // If we're at the end or hit another type header, break
          if (i >= lines.length || isTypeHeader(lines[i].text).isHeader) {
            break;
          }
        }
      } else if (isLikelyMCQQuestion) {
        // Auto-detected MCQ without type header
        let questionText = cleanQuestionText(line);
        const questionLineNum = lineNum;

        if (!questionText) {
          i++;
          continue;
        }

        i++;

        // Parse MCQ options
        const options: string[] = [];
        let correctIndex = -1;
        const optionLetters: string[] = [];
        let answerLetter = '';

        // Check if answer is inline in question (e.g., "What is 2+2? (B)")
        const inlineAnswerMatch = questionText.match(/\(([A-F])\)\s*$/i);
        if (inlineAnswerMatch) {
          answerLetter = inlineAnswerMatch[1].toUpperCase();
          questionText = questionText.replace(/\(([A-F])\)\s*$/i, '').trim();
        }

        // Parse options
        while (i < lines.length) {
          const optionCheck = parseMCQOption(lines[i].text);
          if (!optionCheck.isOption) {
            // Check if it's an "Answer: B" line
            const answerCheck = parseAnswerLine(lines[i].text);
            if (answerCheck.isAnswerLine) {
              answerLetter = answerCheck.answer;
              i++;
            }
            break;
          }

          optionLetters.push(optionCheck.letter);
          options.push(optionCheck.text);
          if (optionCheck.isCorrect) {
            correctIndex = options.length - 1;
          }
          i++;
        }

        // Validate
        if (options.length < 2) {
          errors.push(`Line ${questionLineNum}: MCQ must have at least 2 options`);
          questionNumber++;
          continue;
        }

        // Determine correct answer
        if (correctIndex === -1 && answerLetter) {
          // Find index by letter
          const letterIndex = optionLetters.indexOf(answerLetter);
          if (letterIndex !== -1) {
            correctIndex = letterIndex;
          }
        }

        if (correctIndex === -1) {
          errors.push(`Line ${questionLineNum}: No correct answer marked. Use ✅, (Correct), or "Answer: B"`);
          questionNumber++;
          continue;
        }

        questions.push({
          id: `q-${Date.now()}-${questionNumber}`,
          question_text: questionText,
          question_type: 'mcq',
          options,
          correct_index: correctIndex,
          explanation: ''
        });

        questionNumber++;
      } else if (isLikelyTrueFalse && tfDetection.answer) {
        // Auto-detected True/False without header
        let questionText = cleanQuestionText(line);
        const questionLineNum = lineNum;

        if (!questionText) {
          i++;
          continue;
        }

        i++; // Move past question
        i += tfDetection.consumed; // Move past answer line(s)

        const correctIndex = tfDetection.answer === 'true' ? 0 : 1;

        questions.push({
          id: `q-${Date.now()}-${questionNumber}`,
          question_text: questionText,
          question_type: 'true_false',
          options: ['True', 'False'],
          correct_index: correctIndex,
          explanation: ''
        });

        questionNumber++;
      } else if (isLikelyYesNo && ynDetection.answer) {
        // Auto-detected Yes/No without header
        let questionText = cleanQuestionText(line);
        const questionLineNum = lineNum;

        if (!questionText) {
          i++;
          continue;
        }

        i++; // Move past question
        i += ynDetection.consumed; // Move past answer line(s)

        const correctIndex = ynDetection.answer === 'yes' ? 0 : 1;

        questions.push({
          id: `q-${Date.now()}-${questionNumber}`,
          question_text: questionText,
          question_type: 'yes_no',
          options: ['Yes', 'No'],
          correct_index: correctIndex,
          explanation: ''
        });

        questionNumber++;
      } else {
        // Skip lines that aren't recognized
        i++;
      }
    }

    return { questions, errors };
  }

  function handleBulkImport() {
    if (!bulkImportText.trim()) {
      showToast('Please paste some questions first', 'error');
      return;
    }

    const { questions: parsedQuestions, errors } = parseBulkImport(bulkImportText);

    setBulkImportErrors(errors);

    if (parsedQuestions.length > 0) {
      // Count question types for preview
      const mcqCount = parsedQuestions.filter(q => q.question_type === 'mcq').length;
      const tfCount = parsedQuestions.filter(q => q.question_type === 'true_false').length;
      const ynCount = parsedQuestions.filter(q => q.question_type === 'yes_no').length;

      // Build type summary
      const typeSummary = [
        mcqCount > 0 ? `${mcqCount} MCQ` : '',
        tfCount > 0 ? `${tfCount} True/False` : '',
        ynCount > 0 ? `${ynCount} Yes/No` : ''
      ].filter(Boolean).join(', ');

      setQuestions([...questions, ...parsedQuestions]);

      if (errors.length > 0) {
        showToast(`Detected ${typeSummary}. Added ${parsedQuestions.length} question(s). ${errors.length} question(s) need fixes.`, 'info');
      } else {
        showToast(`Detected ${typeSummary}. Added ${parsedQuestions.length} question(s)!`, 'success');
        // Clear and hide bulk import if no errors
        setBulkImportText('');
        setShowBulkImport(false);
      }
    } else if (errors.length > 0) {
      const errorCount = errors.length;
      showToast(`Import failed: ${errorCount} question${errorCount !== 1 ? 's' : ''} need${errorCount === 1 ? 's' : ''} fixes. See details below.`, 'error');
    } else {
      showToast('Could not detect any questions. Check formatting: MCQ needs A) B) C) format, True/False needs answer, Yes/No needs answer.', 'error');
    }
  }

  // Fetch teacher email and ID on mount
  useEffect(() => {
    async function fetchTeacherInfo() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        if (user.email) setTeacherEmail(user.email);
        setTeacherId(user.id);
      }
    }
    fetchTeacherInfo();
  }, []);

  useEffect(() => {
    async function loadDraftData() {
      // Check if there's a draft ID in the URL
      const draftIdFromUrl = searchParams.get('draft');

      if (draftIdFromUrl) {
        console.log('[CreateQuizWizard] Loading draft from database:', draftIdFromUrl);
        setLoadingDraft(true);

        try {
          const { data: draftData, error } = await supabase
            .from('teacher_quiz_drafts')
            .select('*')
            .eq('id', draftIdFromUrl)
            .maybeSingle();

          if (error) {
            console.error('Failed to load draft:', error);
            showToast('Failed to load draft', 'error');
            setLoadingDraft(false);
            return;
          }

          if (!draftData) {
            console.warn('Draft not found:', draftIdFromUrl);
            showToast('Draft not found', 'error');
            setLoadingDraft(false);
            return;
          }

          console.log('[CreateQuizWizard] Draft loaded:', draftData);

          // Set draft ID for saving
          setDraftId(draftData.id);

          // Restore all fields
          if (draftData.subject) setSelectedSubjectId(draftData.subject);
          if (draftData.metadata?.custom_subject_name) setSelectedSubjectName(draftData.metadata.custom_subject_name);
          if (draftData.metadata?.topic_id) setSelectedTopicId(draftData.metadata.topic_id);
          if (draftData.title) setTitle(draftData.title);
          if (draftData.difficulty) setDifficulty(draftData.difficulty);
          if (draftData.description) setDescription(draftData.description);
          if (draftData.questions) setQuestions(draftData.questions);

          // Set step to last saved step or default to step 4 (questions)
          const lastStep = draftData.metadata?.last_step || 4;
          setStep(lastStep);

          showToast('Draft loaded successfully', 'success');
        } catch (err) {
          console.error('Error loading draft:', err);
          showToast('Error loading draft', 'error');
        } finally {
          setLoadingDraft(false);
        }
      } else {
        // Load from localStorage if no URL param
        const draft = loadDraft();
        if (draft) {
          console.log('[CreateQuizWizard] Restoring draft from localStorage...');
          if (draft.step) setStep(draft.step);
          if (draft.selectedSubjectId) setSelectedSubjectId(draft.selectedSubjectId);
          if (draft.selectedSubjectName) setSelectedSubjectName(draft.selectedSubjectName);
          if (draft.selectedTopicId) setSelectedTopicId(draft.selectedTopicId);
          if (draft.title) setTitle(draft.title);
          if (draft.difficulty) setDifficulty(draft.difficulty);
          if (draft.description) setDescription(draft.description);
          if (draft.questions) setQuestions(draft.questions);
          if (draft.activeQuestionMethod) setActiveQuestionMethod(draft.activeQuestionMethod);
        }
      }
    }

    loadDraftData();
  }, [searchParams]);

  useEffect(() => {
    if (title || description || questions.length > 0) {
      saveToLocalStorage({
        step,
        selectedSubjectId,
        selectedSubjectName,
        selectedTopicId,
        title,
        difficulty,
        description,
        questions,
        activeQuestionMethod,
      });
    }
  }, [step, selectedSubjectId, selectedSubjectName, selectedTopicId, title, difficulty, description, questions, activeQuestionMethod]);

  useEffect(() => {
    loadCustomSubjects();
  }, []);

  useEffect(() => {
    if (selectedSubjectId) {
      loadTopics(selectedSubjectId);
    }
  }, [selectedSubjectId]);

  async function loadCustomSubjects() {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data: subjects } = await supabase
        .from('subjects')
        .select('id, name')
        .eq('created_by', user.user.id)
        .eq('is_active', true)
        .order('name');

      if (subjects) {
        setCustomSubjects(subjects);
      }
    } catch (err) {
      console.error('Failed to load custom subjects:', err);
    }
  }

  const allSubjects = [...AVAILABLE_SUBJECTS, ...customSubjects];

  async function loadTopics(subjectFilter: string) {
    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();

      // Load both system topics (created_by IS NULL) and user's own topics
      const { data, error } = await supabase
        .from('topics')
        .select('id, name, subject, created_by')
        .eq('subject', subjectFilter)
        .eq('is_active', true)
        .or(`created_by.is.null,created_by.eq.${user.user?.id || ''}`)
        .order('name');

      if (error) {
        console.error('Error loading topics:', error);
      }

      if (data) {
        // System topics (created_by IS NULL) come first, then user topics
        const systemTopics = data.filter(t => t.created_by === null);
        const userTopics = data.filter(t => t.created_by !== null);
        setTopics([...systemTopics, ...userTopics] as unknown as Topic[]);
      }
    } catch (err) {
      console.error('Failed to load topics:', err);
    } finally {
      setLoading(false);
    }
  }

  function createNewSubject() {
    if (!newSubjectName.trim()) return;

    const customSubjectId = `custom-${Date.now()}`;
    const newSubject = { id: customSubjectId, name: newSubjectName };

    setCustomSubjects([...customSubjects, newSubject]);
    setSelectedSubjectId(customSubjectId);
    setSelectedSubjectName(newSubjectName);
    setNewSubjectName('');
    setCreatingSubject(false);
    setStep(2);
  }

  async function createNewTopic() {
    if (!newTopicName.trim()) return;

    const { data: user, error: authError } = await supabase.auth.getUser();
    if (authError || !user.user) {
      console.error('[Create Topic] Auth error:', authError);
      showToast('Authentication failed. Please log in again.', 'error');
      return;
    }

    setLoading(true);
    try {
      const slug = newTopicName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      // Use custom subject name if it's a custom subject, otherwise use the standard subject ID
      const subjectValue = selectedSubjectId.startsWith('custom-')
        ? selectedSubjectName
        : selectedSubjectId;

      console.log('[Create Topic] Creating new topic:', {
        name: newTopicName,
        subject: subjectValue,
        created_by: user.user.id
      });

      const { data: insertedData, error } = await supabase
        .from('topics')
        .insert({
          name: newTopicName,
          slug: `${slug}-${Date.now()}`,
          subject: subjectValue,
          description: '',
          created_by: user.user.id,
          is_active: true,
          is_published: true,
          school_id: publishDestination?.school_id || null,
          exam_system_id: publishDestination?.exam_system_id || null
        })
        .select('id, name, subject, created_by, school_id, exam_system_id');

      const data = insertedData?.[0];

      if (error) {
        console.error('[Create Topic] Insert error:', error);
        console.error('[Create Topic] Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      if (data) {
        console.log('[Create Topic] ✅ Topic created successfully:', data.id);
        setSelectedTopicId(data.id);
        setTopics([...topics, data as unknown as Topic]);
        setNewTopicName('');
        setCreatingTopic(false);
        setStep(3);
        showToast('Topic created successfully!', 'success');
      }
    } catch (err: any) {
      console.error('[Create Topic] ❌ Failed to create topic:', err);

      let errorMessage = 'Failed to create topic';
      if (err.message) {
        errorMessage += `: ${err.message}`;
      }

      // Check for specific error types
      if (err.message && err.message.includes('RLS')) {
        errorMessage = 'Permission denied. Ensure you are logged in with correct permissions.';
      } else if (err.message && err.message.includes('violates')) {
        errorMessage = 'Database constraint violation. The topic name may already exist or be invalid.';
      }

      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function saveDraft() {
    if (!title.trim()) {
      showToast('Please enter a quiz title', 'error');
      return;
    }

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

    setSaving(true);
    try {
      const draftData = {
        teacher_id: user.user.id,
        title,
        subject: selectedSubjectId,
        description,
        difficulty,
        questions: questions,
        metadata: {
          topic_id: selectedTopicId,
          last_step: step,
          custom_subject_name: selectedSubjectId === 'other' && selectedSubjectName !== 'Other' ? selectedSubjectName : null
        }
      };

      if (draftId) {
        await supabase
          .from('teacher_quiz_drafts')
          .update(draftData)
          .eq('id', draftId);
      } else {
        const { data } = await supabase
          .from('teacher_quiz_drafts')
          .insert(draftData)
          .select()
          .single();

        if (data) {
          setDraftId(data.id);
        }
      }

      await supabase.from('teacher_activities').insert({
        teacher_id: user.user.id,
        activity_type: 'quiz_created',
        title,
        metadata: { draft_id: draftId }
      });

      showToast('Draft saved successfully!', 'success');
    } catch (err) {
      console.error('Failed to save draft:', err);
      showToast('Failed to save draft', 'error');
    } finally {
      setSaving(false);
    }
  }

  function addManualQuestion(questionType: QuestionType = 'mcq') {
    const newQuestion: Question = {
      id: crypto.randomUUID(),
      question_text: '',
      question_type: questionType,
      options: questionType === 'mcq' ? ['', '', '', ''] : ['True', 'False'],
      correct_index: 0,
      explanation: '',
      image_url: undefined
    };
    setQuestions([...questions, newQuestion]);
  }

  function changeQuestionType(id: string, questionType: QuestionType) {
    setQuestions(questions.map(q => {
      if (q.id === id) {
        let newOptions: string[];
        if (questionType === 'true_false') {
          newOptions = ['True', 'False'];
        } else if (questionType === 'yes_no') {
          newOptions = ['Yes', 'No'];
        } else {
          // MCQ - preserve existing options or start with 4
          newOptions = q.options.length >= 2 ? q.options : ['', '', '', ''];
        }

        return {
          ...q,
          question_type: questionType,
          options: newOptions,
          correct_index: 0
        };
      }
      return q;
    }));
  }

  function addMCQOption(id: string) {
    setQuestions(questions.map(q => {
      if (q.id === id && q.question_type === 'mcq' && q.options.length < 6) {
        return {
          ...q,
          options: [...q.options, '']
        };
      }
      return q;
    }));
  }

  function removeMCQOption(id: string, optionIndex: number) {
    setQuestions(questions.map(q => {
      if (q.id === id && q.question_type === 'mcq' && q.options.length > 2) {
        const newOptions = q.options.filter((_, idx) => idx !== optionIndex);
        // Adjust correct_index if needed
        let newCorrectIndex = q.correct_index;
        if (q.correct_index === optionIndex) {
          newCorrectIndex = 0;
        } else if (q.correct_index > optionIndex) {
          newCorrectIndex = q.correct_index - 1;
        }

        return {
          ...q,
          options: newOptions,
          correct_index: newCorrectIndex
        };
      }
      return q;
    }));
  }

  async function uploadImageForQuestion(id: string, file: File) {
    // Show instant local preview
    const localUrl = URL.createObjectURL(file);
    setQuestions(questions.map(q => {
      if (q.id === id) {
        // Delete old image if exists
        if (q.image_url && !q.image_url.startsWith('blob:')) {
          deleteQuestionImage(q.image_url).catch(err =>
            console.error('Failed to delete old image:', err)
          );
        }
        return { ...q, image_url: localUrl };
      }
      return q;
    }));

    showToast('Uploading image...', 'info');

    // Upload to storage
    const result = await uploadQuestionImage(file);

    if (result.success && result.url) {
      // Replace local preview with uploaded URL
      setQuestions(questions.map(q => {
        if (q.id === id) {
          // Revoke the blob URL to free memory
          if (q.image_url?.startsWith('blob:')) {
            URL.revokeObjectURL(q.image_url);
          }
          return { ...q, image_url: result.url };
        }
        return q;
      }));
      showToast('Image uploaded successfully!', 'success');
    } else {
      // Revert to no image on failure
      setQuestions(questions.map(q => {
        if (q.id === id && q.image_url?.startsWith('blob:')) {
          URL.revokeObjectURL(q.image_url);
          return { ...q, image_url: undefined };
        }
        return q;
      }));
      showToast(result.error || 'Failed to upload image', 'error');
    }
  }

  async function removeImageFromQuestion(id: string) {
    const question = questions.find(q => q.id === id);
    if (question?.image_url) {
      const deleted = await deleteQuestionImage(question.image_url);
      if (deleted) {
        setQuestions(questions.map(q =>
          q.id === id ? { ...q, image_url: undefined } : q
        ));
        showToast('Image removed', 'success');
      }
    }
  }

  function updateQuestion(id: string, field: keyof Question, value: any) {
    setQuestions(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
  }

  function updateQuestionOption(id: string, optionIndex: number, value: string) {
    setQuestions(questions.map(q => {
      if (q.id === id) {
        const newOptions = [...q.options];
        newOptions[optionIndex] = value;
        return { ...q, options: newOptions };
      }
      return q;
    }));
  }

  function removeQuestion(id: string) {
    setQuestions(questions.filter(q => q.id !== id));
  }

  async function generateWithAI() {
    if (!aiTopic.trim()) {
      setAiError('Please enter a topic for AI generation');
      return;
    }

    if (!selectedSubjectName || !title) {
      setAiError('Please complete subject and quiz details before generating questions');
      return;
    }

    setGeneratingAI(true);
    setAiError(null);

    // Helper to make the API call
    async function makeAIRequest(accessToken: string): Promise<any> {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const functionUrl = `${supabaseUrl}/functions/v1/ai-generate-quiz-questions`;

      console.log('[AI Generate] Request start:', new Date().toISOString());
      console.log('[AI Generate] Has access token:', !!accessToken);
      console.log('[AI Generate] Token prefix:', accessToken.substring(0, 20) + '...');

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'apikey': supabaseAnonKey
      };

      const requestBody = {
        subject: selectedSubjectName,
        topic: aiTopic,
        quiz_title: title,
        quiz_description: description,
        difficulty: aiDifficulty,
        count: aiQuestionCount,
        types: ['mcq'],
        curriculum: 'uk',
        language: 'en-GB'
      };

      console.log('[AI Generate] Request to:', functionUrl);
      console.log('[AI Generate] Request body:', requestBody);

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      console.log('[AI Generate] Response status:', response.status);
      console.log('[AI Generate] Response ok:', response.ok);

      const data = await response.json();
      console.log('[AI Generate] Response data:', {
        hasItems: !!data.items,
        hasError: !!data.error,
        errorCode: data.error,
        errorMessage: data.message
      });

      return { response, data };
    }

    try {
      // STEP 1: Get current session
      console.log('[AI Generate] Step 1: Getting session...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      console.log('[AI Generate] Session check:', {
        hasSession: !!session,
        hasError: !!sessionError,
        hasAccessToken: !!session?.access_token,
        expiresAt: session?.expires_at,
        userId: session?.user?.id
      });

      if (sessionError) {
        console.error('[AI Generate] Session error:', sessionError);
        setAiError('We couldn\'t verify your session. Please try clicking Retry or log in again.');
        return;
      }

      if (!session) {
        console.error('[AI Generate] No session found');
        setAiError('No active session found. Please log in again.');
        return;
      }

      if (!session.access_token) {
        console.error('[AI Generate] No access token in session');
        setAiError('Invalid session. Please log in again.');
        return;
      }

      // Check if token is expired
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = session.expires_at || 0;
      const isExpired = expiresAt < now;
      const secondsUntilExpiry = expiresAt - now;

      console.log('[AI Generate] Token expiry check:', {
        now,
        expiresAt,
        isExpired,
        secondsUntilExpiry
      });

      // STEP 2: Make first attempt
      console.log('[AI Generate] Step 2: Making first API call...');
      let { response, data } = await makeAIRequest(session.access_token);

      // STEP 3: If 401 (unauthorized), try refreshing token and retry once
      // Note: 403 is a permission issue (premium required), not auth, so don't refresh
      if (response.status === 401) {
        console.log('[AI Generate] Step 3: Got 401, attempting token refresh and retry...');

        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

        console.log('[AI Generate] Refresh result:', {
          success: !!refreshData.session,
          error: !!refreshError,
          hasNewToken: !!refreshData.session?.access_token
        });

        if (refreshError || !refreshData.session) {
          console.error('[AI Generate] Token refresh failed:', refreshError);
          setAiError('Your session has expired. Please log in again.');
          return;
        }

        console.log('[AI Generate] Token refreshed successfully, retrying request...');
        const retryResult = await makeAIRequest(refreshData.session.access_token);
        response = retryResult.response;
        data = retryResult.data;

        console.log('[AI Generate] Retry response status:', response.status);
      }

      // STEP 4: Handle response
      if (!response.ok || data.error) {
        const errorCode = data.error;
        const errorMessage = data.message || 'Failed to generate questions';

        console.error('[AI Generate] Error after all attempts:', {
          status: response.status,
          errorCode,
          errorMessage
        });

        if (errorCode === 'premium_required' || response.status === 403) {
          setAiError('Premium subscription required to use AI generation. Please upgrade your account.');
          return;
        }

        if (errorCode === 'missing_auth' || errorCode === 'invalid_auth' || response.status === 401) {
          setAiError('Authentication failed. Please log in again.');
          return;
        }

        setAiError(errorMessage);
        return;
      }

      // STEP 5: Validate and process response
      if (!data || !data.items || !Array.isArray(data.items)) {
        console.error('[AI Generate] Invalid response structure:', data);
        setAiError('Invalid response from AI service. Please try again.');
        return;
      }

      // Convert API response to Question format
      const newQuestions: Question[] = data.items.map((item: any) => ({
        id: `ai-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        question_text: item.question,
        question_type: 'mcq' as QuestionType,
        options: item.options,
        correct_index: item.correctIndex,
        explanation: item.explanation,
        image_url: undefined
      }));

      setGeneratedQuestions(newQuestions);
      setAiError(null);
      console.log(`[AI Generate] ✅ Success: Generated ${newQuestions.length} questions`);
      showToast(`Successfully generated ${newQuestions.length} questions!`, 'success');
    } catch (err) {
      console.error('[AI Generate] Unexpected error:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setAiError(`Error: ${errorMessage}`);
    } finally {
      setGeneratingAI(false);
    }
  }

  function addGeneratedQuestionsToQuiz() {
    if (generatedQuestions.length === 0) {
      setAiError('No generated questions to add');
      return;
    }

    setQuestions([...questions, ...generatedQuestions]);
    setGeneratedQuestions([]);
    setAiError(null);
    showToast(`Added ${generatedQuestions.length} questions to your quiz!`, 'success');
  }

  function regenerateQuestions() {
    if (generatedQuestions.length > 0) {
      if (!confirm('This will replace your current generated questions. Continue?')) {
        return;
      }
    }
    generateWithAI();
  }

  function updateGeneratedQuestion(id: string, field: keyof Question, value: any) {
    setGeneratedQuestions(generatedQuestions.map(q => q.id === id ? { ...q, [field]: value } : q));
  }

  function updateGeneratedQuestionOption(id: string, optionIndex: number, value: string) {
    setGeneratedQuestions(generatedQuestions.map(q => {
      if (q.id === id) {
        const newOptions = [...q.options];
        newOptions[optionIndex] = value;
        return { ...q, options: newOptions };
      }
      return q;
    }));
  }

  function removeGeneratedQuestion(id: string) {
    setGeneratedQuestions(generatedQuestions.filter(q => q.id !== id));
  }

  async function processDocument() {
    if (!uploadedFile) {
      showToast('Please select a file', 'error');
      return;
    }

    setProcessingDoc(true);
    try {
      // Placeholder for document processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      showToast('Document processing coming soon! This will extract text and generate questions.', 'info');
    } finally {
      setProcessingDoc(false);
    }
  }

  async function publishQuiz() {
    if (questions.length === 0) {
      showToast('Please add at least 1 question before publishing', 'error');
      return;
    }

    const invalidQuestions = questions.filter(q =>
      !q.question_text.trim() ||
      q.options.some(opt => !opt.trim())
    );

    if (invalidQuestions.length > 0) {
      showToast('Please complete all questions before publishing', 'error');
      return;
    }

    const { data: user, error: authError } = await supabase.auth.getUser();
    if (authError || !user.user) {
      console.error('[Publish Quiz] Auth error:', authError);
      showToast('Authentication failed. Please log in again.', 'error');
      return;
    }

    setSaving(true);
    try {
      console.log('[Publish Quiz] Starting publish process...');
      console.log('[Publish Quiz] User ID:', user.user.id);
      console.log('[Publish Quiz] Topic ID:', selectedTopicId);
      console.log('[Publish Quiz] Questions count:', questions.length);

      // Step 1: Update topic with details and publish destination
      console.log('[Publish Quiz] Step 1: Updating topic...');
      const { error: topicError } = await supabase
        .from('topics')
        .update({
          description,
          is_published: true,
          school_id: publishDestination?.school_id || null,
          exam_system_id: publishDestination?.exam_system_id || null
        })
        .eq('id', selectedTopicId);

      if (topicError) {
        console.error('[Publish Quiz] Topic update error:', topicError);
        throw new Error(`Failed to update topic: ${topicError.message}`);
      }

      // Step 2: Create question set with destination
      console.log('[Publish Quiz] Step 2: Creating question set...');
      console.log('[Publish Quiz] Destination:', publishDestination);

      // Determine destination_scope based on publishDestination
      let destinationScope: 'GLOBAL' | 'SCHOOL_WALL' | 'COUNTRY_EXAM' = 'GLOBAL';
      if (publishDestination?.type === 'school') {
        destinationScope = 'SCHOOL_WALL';
      } else if (publishDestination?.type === 'country_exam') {
        destinationScope = 'COUNTRY_EXAM';
      }

      const { data: questionSet, error: questionSetError } = await supabase
        .from('question_sets')
        .insert({
          topic_id: selectedTopicId,
          title,
          difficulty,
          description,
          created_by: user.user.id,
          approval_status: 'approved',
          question_count: questions.length,
          destination_scope: destinationScope,
          school_id: publishDestination?.school_id || null,
          exam_system_id: publishDestination?.exam_system_id || null,
          country_code: publishDestination?.country_code || null,
          exam_code: publishDestination?.exam_code || null
        })
        .select()
        .single();

      if (questionSetError) {
        console.error('[Publish Quiz] Question set creation error:', questionSetError);
        console.error('[Publish Quiz] Error details:', {
          code: questionSetError.code,
          message: questionSetError.message,
          details: questionSetError.details,
          hint: questionSetError.hint
        });
        throw new Error(`Failed to create question set: ${questionSetError.message}`);
      }

      if (!questionSet) {
        throw new Error('Question set was not created (no data returned)');
      }

      console.log('[Publish Quiz] Question set created:', questionSet.id);

      // Step 3: Insert questions
      console.log('[Publish Quiz] Step 3: Inserting', questions.length, 'questions...');
      const questionsToInsert = questions.map((q, index) => ({
        question_set_id: questionSet.id,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options,
        correct_index: q.correct_index,
        explanation: q.explanation,
        image_url: q.image_url || null,
        order_index: index,
        created_by: user.user.id,
        is_published: true
      }));

      const { error: questionsError } = await supabase
        .from('topic_questions')
        .insert(questionsToInsert);

      if (questionsError) {
        console.error('[Publish Quiz] Questions insert error:', questionsError);
        console.error('[Publish Quiz] Error details:', {
          code: questionsError.code,
          message: questionsError.message,
          details: questionsError.details,
          hint: questionsError.hint
        });
        throw new Error(`Failed to insert questions: ${questionsError.message}`);
      }

      console.log('[Publish Quiz] Questions inserted successfully');

      // Step 4: Log activity
      console.log('[Publish Quiz] Step 4: Logging activity...');
      const { error: activityError } = await supabase
        .from('teacher_activities')
        .insert({
          teacher_id: user.user.id,
          activity_type: 'quiz_published',
          title,
          entity_id: selectedTopicId
        });

      if (activityError) {
        console.warn('[Publish Quiz] Activity log error (non-fatal):', activityError);
      }

      // Step 5: Delete draft if exists
      if (draftId) {
        console.log('[Publish Quiz] Step 5: Deleting draft...');
        const { error: draftError } = await supabase
          .from('teacher_quiz_drafts')
          .delete()
          .eq('id', draftId);

        if (draftError) {
          console.warn('[Publish Quiz] Draft deletion error (non-fatal):', draftError);
        }
      }

      clearDraft();
      console.log('[Publish Quiz] ✅ Quiz published successfully!');
      showToast('Quiz published successfully!', 'success');

      // Small delay to ensure state is clear before navigation
      setTimeout(() => {
        navigate('/teacherdashboard?tab=my-quizzes');
      }, 500);
    } catch (err: any) {
      console.error('[Publish Quiz] ❌ Failed to publish quiz:', err);

      let errorMessage = 'Failed to publish quiz';
      if (err.message) {
        errorMessage += `: ${err.message}`;
      }

      // Check for specific error types
      if (err.message && err.message.includes('RLS')) {
        errorMessage = 'Permission denied. Please ensure you have the correct permissions and try again.';
      } else if (err.message && err.message.includes('violates')) {
        errorMessage = 'Database constraint violation. Please check your input and try again.';
      }

      showToast(errorMessage, 'error');
    } finally {
      setSaving(false);
    }
  }

  const steps = [
    { num: 0, label: 'Destination', completed: step > 0 },
    { num: 1, label: 'Subject', completed: step > 1 },
    { num: 2, label: 'Topic', completed: step > 2 },
    { num: 3, label: 'Details', completed: step > 3 },
    { num: 4, label: 'Questions', completed: step > 4 },
    { num: 5, label: 'Review', completed: false }
  ];

  function formatTimeSince(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }

  if (loadingDraft) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-gray-600">Loading draft...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Create Quiz</h1>
          <p className="text-gray-600 mt-1">Build your quiz step by step</p>
        </div>

        {/* Autosave Indicator */}
        <div className="flex items-center gap-2 text-sm">
          {autosaving && (
            <div className="flex items-center gap-2 text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving...</span>
            </div>
          )}
          {!autosaving && lastSaved && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span>Saved {formatTimeSince(lastSaved)}</span>
            </div>
          )}
          {saveError && (
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-4 h-4" />
              <span>Save failed</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          {steps.map((s, index) => (
            <div key={s.num} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  s.completed
                    ? 'bg-green-600 text-white'
                    : step === s.num
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {s.completed ? <CheckCircle className="w-6 h-6" /> : s.num}
                </div>
                <span className={`text-sm mt-2 ${
                  step === s.num ? 'font-semibold text-gray-900' : 'text-gray-600'
                }`}>
                  {s.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <ChevronRight className="w-6 h-6 text-gray-400 mx-4" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {/* Step 0: Publish Destination */}
        {step === 0 && teacherEmail && teacherId && (
          <div>
            <PublishDestinationPicker
              teacherEmail={teacherEmail}
              teacherId={teacherId}
              selectedDestination={publishDestination}
              onSelect={(destination) => {
                setPublishDestination(destination);
              }}
            />
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => publishDestination && setStep(1)}
                disabled={!publishDestination}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 font-semibold"
              >
                Continue
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Subject</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {allSubjects.map((subject) => (
                  <button
                    key={subject.id}
                    onClick={() => {
                      const isCustom = subject.id.startsWith('custom-');
                      setSelectedSubjectId(isCustom ? 'other' : subject.id);
                      setSelectedSubjectName(subject.name);
                      setStep(2);
                    }}
                    className={`p-4 border-2 rounded-lg text-left transition ${
                      selectedSubjectId === subject.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="font-semibold text-gray-900">{subject.name}</div>
                  </button>
                ))}
                <button
                  onClick={() => setCreatingSubject(true)}
                  className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 transition flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  <span>New Subject</span>
                </button>
              </div>

              {creatingSubject && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Subject Name
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSubjectName}
                      onChange={(e) => setNewSubjectName(e.target.value)}
                      placeholder="e.g., Physics"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                    />
                    <button
                      onClick={createNewSubject}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => {
                        setCreatingSubject(false);
                        setNewSubjectName('');
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Back button to Destination step */}
            <div className="mt-6 flex justify-start">
              <button
                onClick={() => setStep(0)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 inline-flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Destination
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Topic</h2>
              <p className="text-sm text-gray-600 mb-4">
                Subject: {allSubjects.find(s => s.id === selectedSubjectId || (s.id.startsWith('custom-') && selectedSubjectId === 'other'))?.name || selectedSubjectName}
              </p>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  <span className="ml-2 text-gray-600">Loading topics...</span>
                </div>
              ) : (
                <>
                  {topics.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {topics.map((topic) => (
                        <button
                          key={topic.id}
                          onClick={() => {
                            setSelectedTopicId(topic.id);
                            setTitle(topic.name);
                            setStep(3);
                          }}
                          className={`p-4 border-2 rounded-lg text-left transition ${
                            selectedTopicId === topic.id
                              ? 'border-blue-600 bg-blue-50'
                              : 'border-gray-200 hover:border-blue-300'
                          }`}
                        >
                          <div className="font-semibold text-gray-900">{topic.name}</div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No topics available. Create a new topic to get started.
                    </div>
                  )}

                  <button
                    onClick={() => setCreatingTopic(true)}
                    className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 transition flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Create New Topic</span>
                  </button>
                </>
              )}

              {creatingTopic && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Topic Name
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTopicName}
                      onChange={(e) => setNewTopicName(e.target.value)}
                      placeholder="e.g., Quadratic Equations"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                    />
                    <button
                      onClick={createNewTopic}
                      disabled={loading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create'}
                    </button>
                    <button
                      onClick={() => {
                        setCreatingTopic(false);
                        setNewTopicName('');
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 inline-flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Quiz Details</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Algebra Basics Quiz"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty *</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of what students will learn..."
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 inline-flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={saveDraft}
                disabled={saving || !title.trim()}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 inline-flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Draft'}
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={!title.trim() || !description.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2 disabled:opacity-50"
              >
                Next: Add Questions
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Add Questions</h2>

              {/* Question Method Tabs */}
              <div className="flex gap-2 mb-6 border-b border-gray-200">
                <button
                  onClick={() => setActiveQuestionMethod('manual')}
                  className={`px-4 py-2 font-medium border-b-2 transition ${
                    activeQuestionMethod === 'manual'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Edit3 className="w-4 h-4 inline mr-2" />
                  Manual
                </button>

                {/* AI Generate - DISABLED (Coming Soon) */}
                <div
                  className="px-4 py-2 font-medium border-b-2 border-transparent text-gray-400 cursor-not-allowed flex items-center gap-2"
                  title="Coming soon — in development"
                >
                  <Lock className="w-3 h-3" />
                  <Wand2 className="w-4 h-4" />
                  AI Generate (Coming Soon)
                </div>

                {/* Upload Document - DISABLED (Coming Soon) */}
                <div
                  className="px-4 py-2 font-medium border-b-2 border-transparent text-gray-400 cursor-not-allowed flex items-center gap-2"
                  title="Coming soon — in development"
                >
                  <Lock className="w-3 h-3" />
                  <Upload className="w-4 h-4" />
                  Upload Document (Coming Soon)
                </div>
              </div>

              {/* Manual Questions */}
              {activeQuestionMethod === 'manual' && (
                <div className="space-y-4">
                  {/* Bulk Import Section */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                    <button
                      onClick={() => setShowBulkImport(!showBulkImport)}
                      className="flex items-center gap-2 font-semibold text-blue-900 hover:text-blue-700 transition"
                    >
                      <Upload className="w-5 h-5" />
                      Quick Import (Copy & Paste)
                      <ChevronRight className={`w-4 h-4 transition-transform ${showBulkImport ? 'rotate-90' : ''}`} />
                    </button>

                    {showBulkImport && (
                      <div className="mt-4 space-y-3">
                        <p className="text-sm text-gray-700">
                          Paste your questions below. Questions are automatically detected - no headers needed! MCQ uses A) B) C) D) format, True/False and Yes/No detect from answers.
                        </p>

                        <div className="bg-gray-50 border border-gray-300 rounded-lg p-3">
                          <p className="text-xs font-semibold text-gray-700 mb-2">📝 Supported Formats:</p>

                          <details className="mb-2">
                            <summary className="text-xs font-medium text-blue-600 cursor-pointer hover:text-blue-700">
                              Format 1: Smart Auto-Detection (Recommended)
                            </summary>
                            <div className="mt-2 bg-white border border-gray-200 rounded p-2 text-xs font-mono text-gray-600">
                              <div className="text-green-600">MCQ (no header needed):</div>
                              <div>What is revenue?</div>
                              <div>A. Profit</div>
                              <div>B. Sales income ✅</div>
                              <div>C. Costs</div>
                              <div>D. Tax</div>
                              <div className="mt-2 text-green-600">True/False (no header needed):</div>
                              <div>A sole trader has unlimited liability.</div>
                              <div>Answer: True</div>
                              <div className="mt-2 text-green-600">Yes/No (no header needed):</div>
                              <div>Is cash flow the same as profit?</div>
                              <div>Answer: No</div>
                            </div>
                          </details>

                          <details className="mb-2">
                            <summary className="text-xs font-medium text-blue-600 cursor-pointer hover:text-blue-700">
                              Format 2: Alternative Formats
                            </summary>
                            <div className="mt-2 bg-white border border-gray-200 rounded p-2 text-xs font-mono text-gray-600">
                              <div className="text-green-600">MCQ with different punctuation:</div>
                              <div>What is profit?</div>
                              <div>A) Revenue minus costs</div>
                              <div>B) Total sales</div>
                              <div>C) Cash in bank</div>
                              <div>Answer: A</div>
                              <div className="mt-2 text-green-600">True/False with just answer word:</div>
                              <div>Assets = Liabilities + Equity</div>
                              <div>True</div>
                              <div className="mt-2 text-green-600">Yes/No simple format:</div>
                              <div>Is Python a programming language?</div>
                              <div>Yes</div>
                            </div>
                          </details>

                          <details>
                            <summary className="text-xs font-medium text-blue-600 cursor-pointer hover:text-blue-700">
                              Format 3: Multi-Question Blocks
                            </summary>
                            <div className="mt-2 bg-white border border-gray-200 rounded p-2 text-xs font-mono text-gray-600">
                              <div>MCQ</div>
                              <div>Question 1: What is 2+2?</div>
                              <div>A: 3</div>
                              <div>B: 4 ✅</div>
                              <div>C: 5</div>
                              <div className="mt-1">Question 2: What is 3+3?</div>
                              <div>A- 5</div>
                              <div>B- 6 (Correct)</div>
                              <div>C- 7</div>
                            </div>
                          </details>
                        </div>

                        <textarea
                          value={bulkImportText}
                          onChange={(e) => setBulkImportText(e.target.value)}
                          placeholder="Paste your questions here..."
                          rows={8}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm"
                        />

                        {bulkImportErrors.length > 0 && (
                          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 space-y-3">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-sm font-bold text-red-900 mb-2">
                                  ❌ Import Issues Found ({bulkImportErrors.length} {bulkImportErrors.length === 1 ? 'question' : 'questions'})
                                </p>
                                <ul className="text-sm text-red-700 space-y-1.5 list-none">
                                  {bulkImportErrors.map((error, idx) => (
                                    <li key={idx} className="flex items-start gap-2">
                                      <span className="text-red-500 font-bold">•</span>
                                      <span>{error}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>

                            <div className="border-t border-red-200 pt-3">
                              <details className="group">
                                <summary className="text-xs font-semibold text-red-800 cursor-pointer hover:text-red-900 flex items-center gap-1">
                                  <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                                  Show Correct Format Template
                                </summary>
                                <div className="mt-2 bg-white border border-red-200 rounded p-3 text-xs font-mono text-gray-700 space-y-2">
                                  <div>
                                    <div className="text-green-700 font-semibold mb-1">✓ MCQ Format (auto-detected):</div>
                                    <div className="pl-2">What is 2+2?</div>
                                    <div className="pl-2">A. 3</div>
                                    <div className="pl-2">B. 4 ✅</div>
                                    <div className="pl-2">C. 5</div>
                                    <div className="text-gray-500 mt-1">OR use: Answer: B</div>
                                  </div>
                                  <div>
                                    <div className="text-green-700 font-semibold mb-1">✓ True/False Format (auto-detected):</div>
                                    <div className="pl-2">Earth is round.</div>
                                    <div className="pl-2">Answer: True</div>
                                    <div className="text-gray-500 mt-1">OR use: Answer: True</div>
                                  </div>
                                  <div>
                                    <div className="text-green-700 font-semibold mb-1">✓ Yes/No Format (auto-detected):</div>
                                    <div className="pl-2">Is water wet?</div>
                                    <div className="pl-2">Answer: Yes</div>
                                  </div>
                                </div>
                              </details>
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button
                            onClick={handleBulkImport}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                          >
                            Parse & Add Questions
                          </button>
                          <button
                            onClick={() => {
                              setBulkImportText('');
                              setBulkImportErrors([]);
                              setShowBulkImport(false);
                            }}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {questions.map((question, qIndex) => (
                    <div key={question.id} className="border border-gray-200 rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">Question {qIndex + 1}</h3>
                        <button
                          onClick={() => removeQuestion(question.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Question Type Selector */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Question Type *</label>
                        <select
                          value={question.question_type}
                          onChange={(e) => changeQuestionType(question.id, e.target.value as QuestionType)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="mcq">Multiple Choice (2-6 options)</option>
                          <option value="true_false">True/False</option>
                          <option value="yes_no">Yes/No</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Question Text *</label>
                        <textarea
                          value={question.question_text}
                          onChange={(e) => updateQuestion(question.id, 'question_text', e.target.value)}
                          placeholder="Enter your question..."
                          rows={3}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>

                      {/* Image Upload */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Question Image (Optional)
                        </label>
                        {question.image_url ? (
                          <div className="relative">
                            <img
                              src={question.image_url}
                              alt="Question"
                              className="w-full max-w-md h-auto rounded-lg border border-gray-300"
                            />
                            <button
                              onClick={() => removeImageFromQuestion(question.id)}
                              className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div>
                            <input
                              type="file"
                              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  uploadImageForQuestion(question.id, file);
                                }
                                e.target.value = '';
                              }}
                              className="hidden"
                              id={`image-upload-${question.id}`}
                            />
                            <label
                              htmlFor={`image-upload-${question.id}`}
                              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
                            >
                              <ImageIcon className="w-4 h-4" />
                              Upload Image
                            </label>
                            <p className="text-xs text-gray-500 mt-1">
                              Supported: JPG, PNG, GIF, WebP (max 5MB)
                            </p>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {question.question_type === 'mcq' ? 'Options *' : 'Answer Options'}
                        </label>
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
                                onChange={(e) => updateQuestionOption(question.id, oIndex, e.target.value)}
                                placeholder={`Option ${oIndex + 1}`}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                                disabled={question.question_type !== 'mcq'}
                              />
                              {question.question_type === 'mcq' && question.options.length > 2 && (
                                <button
                                  onClick={() => removeMCQOption(question.id, oIndex)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                                  title="Remove option"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        {question.question_type === 'mcq' && question.options.length < 6 && (
                          <button
                            onClick={() => addMCQOption(question.id)}
                            className="mt-2 text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                          >
                            <Plus className="w-4 h-4" />
                            Add Option
                          </button>
                        )}
                        <p className="text-xs text-gray-500 mt-2">Select the radio button for the correct answer</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Explanation (Optional)</label>
                        <textarea
                          value={question.explanation}
                          onChange={(e) => updateQuestion(question.id, 'explanation', e.target.value)}
                          placeholder="Explain why this answer is correct..."
                          rows={2}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                    </div>
                  ))}

                  <div className="space-y-2">
                    <button
                      onClick={() => addManualQuestion('mcq')}
                      className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 transition flex items-center justify-center gap-2"
                    >
                      <Plus className="w-5 h-5" />
                      <span>Add Multiple Choice Question</span>
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => addManualQuestion('true_false')}
                        className="p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 transition text-sm"
                      >
                        <Plus className="w-4 h-4 inline mr-1" />
                        True/False
                      </button>
                      <button
                        onClick={() => addManualQuestion('yes_no')}
                        className="p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 transition text-sm"
                      >
                        <Plus className="w-4 h-4 inline mr-1" />
                        Yes/No
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* AI Generation */}
              {activeQuestionMethod === 'ai' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h3 className="font-semibold text-blue-900 mb-2">AI Quiz Generation</h3>
                    <p className="text-sm text-blue-700 mb-4">
                      AI generates GCSE-friendly questions from your subject and topic.
                    </p>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Topic</label>
                        <input
                          type="text"
                          value={aiTopic}
                          onChange={(e) => setAiTopic(e.target.value)}
                          placeholder="e.g., Photosynthesis in plants"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Number of Questions: {aiQuestionCount}
                        </label>
                        <input
                          type="range"
                          min="5"
                          max="50"
                          value={aiQuestionCount}
                          onChange={(e) => setAiQuestionCount(parseInt(e.target.value))}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>5</span>
                          <span>50</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
                        <div className="flex gap-2">
                          {(['easy', 'medium', 'hard'] as const).map((level) => (
                            <button
                              key={level}
                              onClick={() => setAiDifficulty(level)}
                              className={`flex-1 py-2 px-4 rounded-lg border-2 font-medium transition ${
                                aiDifficulty === level
                                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                              }`}
                            >
                              {level.charAt(0).toUpperCase() + level.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>

                      {aiError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-800 flex-1">{aiError}</p>
                          </div>
                          {(aiError.includes('session') || aiError.includes('Authentication') || aiError.includes('log in')) && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setAiError(null);
                                  generateWithAI();
                                }}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                              >
                                Retry
                              </button>
                              <button
                                onClick={() => navigate('/teacherdashboard')}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
                              >
                                Back to Dashboard
                              </button>
                              <button
                                onClick={() => navigate('/teacher')}
                                className="flex-1 px-4 py-2 border border-red-300 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 text-sm font-medium"
                              >
                                Login
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      <button
                        onClick={generateWithAI}
                        disabled={generatingAI || !aiTopic.trim()}
                        className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 font-medium"
                      >
                        {generatingAI ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Wand2 className="w-5 h-5" />
                            Generate Questions
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Generated Questions Review */}
                  {generatedQuestions.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Review Generated Questions ({generatedQuestions.length})
                        </h3>
                        <div className="flex gap-2">
                          <button
                            onClick={regenerateQuestions}
                            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 inline-flex items-center gap-2"
                          >
                            <Wand2 className="w-4 h-4" />
                            Regenerate
                          </button>
                          <button
                            onClick={addGeneratedQuestionsToQuiz}
                            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 inline-flex items-center gap-2"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Add to Quiz
                          </button>
                        </div>
                      </div>

                      <p className="text-sm text-gray-600 mb-4">
                        Review and edit before adding to your quiz.
                      </p>

                      <div className="space-y-4">
                        {generatedQuestions.map((q, index) => (
                          <div key={q.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                            <div className="flex items-start justify-between mb-3">
                              <span className="font-semibold text-gray-700">Q{index + 1}</span>
                              <button
                                onClick={() => removeGeneratedQuestion(q.id)}
                                className="text-red-600 hover:text-red-700 p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="space-y-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Question</label>
                                <input
                                  type="text"
                                  value={q.question_text}
                                  onChange={(e) => updateGeneratedQuestion(q.id, 'question_text', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                {q.options.map((option, optIndex) => (
                                  <div key={optIndex} className="flex items-center gap-2">
                                    <input
                                      type="radio"
                                      checked={q.correct_index === optIndex}
                                      onChange={() => updateGeneratedQuestion(q.id, 'correct_index', optIndex)}
                                      className="flex-shrink-0"
                                    />
                                    <input
                                      type="text"
                                      value={option}
                                      onChange={(e) => updateGeneratedQuestionOption(q.id, optIndex, e.target.value)}
                                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                  </div>
                                ))}
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Explanation</label>
                                <textarea
                                  value={q.explanation}
                                  onChange={(e) => updateGeneratedQuestion(q.id, 'explanation', e.target.value)}
                                  rows={2}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Document Upload */}
              {activeQuestionMethod === 'document' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h3 className="font-semibold text-blue-900 mb-4">Upload Document</h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Select File</label>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.txt"
                          onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
                          className="w-full"
                        />
                        {uploadedFile && (
                          <p className="text-sm text-gray-600 mt-2">
                            Selected: {uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(2)} KB)
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Or Paste Text</label>
                        <textarea
                          value={extractedText}
                          onChange={(e) => setExtractedText(e.target.value)}
                          placeholder="Paste your teaching materials here..."
                          rows={6}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>

                      <button
                        onClick={processDocument}
                        disabled={processingDoc || (!uploadedFile && !extractedText.trim())}
                        className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                      >
                        {processingDoc ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Upload className="w-5 h-5" />
                            Process Document & Generate Questions
                          </>
                        )}
                      </button>
                    </div>

                    <p className="text-sm text-blue-800 mt-4">
                      We'll extract key concepts and generate questions that you can review and edit.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStep(3)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 inline-flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={saveDraft}
                disabled={saving}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 inline-flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Draft'}
              </button>
              <button
                onClick={() => setStep(5)}
                disabled={questions.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2 disabled:opacity-50"
              >
                Next: Review
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Review & Publish</h2>

              {/* Quiz Summary */}
              <div className="bg-gray-50 rounded-lg p-6 space-y-4 mb-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-600">Title</h3>
                  <p className="text-lg font-semibold text-gray-900">{title}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-600">Subject</h3>
                    <p className="text-gray-900">{allSubjects.find(s => s.id === selectedSubjectId)?.name}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-600">Difficulty</h3>
                    <p className="text-gray-900 capitalize">{difficulty}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-600">Questions</h3>
                    <p className="text-gray-900">{questions.length}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-600">Topic</h3>
                    <p className="text-gray-900">{topics.find(t => t.id === selectedTopicId)?.name}</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-600">Description</h3>
                  <p className="text-gray-700">{description}</p>
                </div>
              </div>

              {/* Questions Preview */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Questions Preview</h3>
                {questions.map((q, index) => (
                  <div key={q.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-medium text-gray-900 flex-1">{index + 1}. {q.question_text}</p>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded ml-2">
                        {q.question_type === 'mcq' ? 'MCQ' : q.question_type === 'true_false' ? 'True/False' : 'Yes/No'}
                      </span>
                    </div>
                    {q.image_url && (
                      <img
                        src={q.image_url}
                        alt="Question"
                        className="w-full max-w-md h-auto rounded-lg border border-gray-300 mb-2"
                      />
                    )}
                    <div className="space-y-1 ml-4">
                      {q.options.map((opt, oIndex) => (
                        <p key={oIndex} className={`text-sm ${
                          oIndex === q.correct_index ? 'text-green-600 font-medium' : 'text-gray-600'
                        }`}>
                          {String.fromCharCode(65 + oIndex)}. {opt}
                          {oIndex === q.correct_index && ' ✓'}
                        </p>
                      ))}
                    </div>
                    {q.explanation && (
                      <p className="text-sm text-gray-600 mt-2 ml-4 italic">
                        Explanation: {q.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStep(4)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 inline-flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Edit
              </button>
              <button
                onClick={saveDraft}
                disabled={saving}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 inline-flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Save Draft
              </button>
              <button
                onClick={publishQuiz}
                disabled={saving || questions.length === 0}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 inline-flex items-center gap-2 disabled:opacity-50 font-semibold"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Eye className="w-5 h-5" />
                    Publish Quiz
                  </>
                )}
              </button>
            </div>

            {questions.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  You need at least 1 question to publish. Go back and add questions.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {toast && (
        <div
          className={`fixed bottom-4 right-4 max-w-md p-4 rounded-lg shadow-lg animate-slide-up z-50 ${
            toast.type === 'success'
              ? 'bg-green-500 text-white'
              : toast.type === 'error'
              ? 'bg-red-500 text-white'
              : 'bg-blue-500 text-white'
          }`}
        >
          <div className="flex items-start gap-3">
            {toast.type === 'success' && <CheckCircle className="w-5 h-5 flex-shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 flex-shrink-0" />}
            {toast.type === 'info' && <AlertCircle className="w-5 h-5 flex-shrink-0" />}
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}

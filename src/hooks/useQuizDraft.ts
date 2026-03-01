import { useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';

interface QuizDraftState {
  step: number;
  selectedSubjectId: string;
  selectedSubjectName: string;
  selectedTopicId: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  description: string;
  questions: any[];
  activeQuestionMethod: 'manual' | 'ai' | 'document';
  lastSavedAt: string | null;
}

const DRAFT_KEY_PREFIX = 'startsprint:createQuizDraft:';
const AUTOSAVE_DEBOUNCE_MS = 800;

export function useQuizDraft() {
  const { user } = useAuth();
  const [autosaving, setAutosaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  const getDraftKey = () => {
    if (!user?.id) return null;
    return `${DRAFT_KEY_PREFIX}${user.id}`;
  };

  const loadDraft = (): Partial<QuizDraftState> | null => {
    const key = getDraftKey();
    if (!key) return null;

    try {
      const saved = localStorage.getItem(key);
      if (!saved) return null;

      const draft = JSON.parse(saved) as QuizDraftState;
      console.log('[QuizDraft] Loaded draft from localStorage:', draft);
      return draft;
    } catch (error) {
      console.error('[QuizDraft] Failed to load draft:', error);
      return null;
    }
  };

  const saveDraft = (state: Partial<QuizDraftState>) => {
    const key = getDraftKey();
    if (!key) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    setAutosaving(true);
    setSaveError(null);

    autosaveTimerRef.current = setTimeout(() => {
      try {
        const draftData: QuizDraftState = {
          ...state,
          lastSavedAt: new Date().toISOString(),
        } as QuizDraftState;

        localStorage.setItem(key, JSON.stringify(draftData));

        if (isMountedRef.current) {
          setAutosaving(false);
          setLastSaved(new Date());
        }
        console.log('[QuizDraft] Saved draft to localStorage');
      } catch (error) {
        console.error('[QuizDraft] Failed to save draft:', error);
        if (isMountedRef.current) {
          setAutosaving(false);
          setSaveError('Failed to save draft');
        }
      }
    }, AUTOSAVE_DEBOUNCE_MS);
  };

  const clearDraft = () => {
    const key = getDraftKey();
    if (!key) return;

    try {
      localStorage.removeItem(key);
      setLastSaved(null);
      console.log('[QuizDraft] Cleared draft from localStorage');
    } catch (error) {
      console.error('[QuizDraft] Failed to clear draft:', error);
    }
  };

  return {
    loadDraft,
    saveDraft,
    clearDraft,
    autosaving,
    lastSaved,
    saveError,
  };
}

import { getOrCreateSessionId } from './anonymousSession';
import { getDeviceInfo } from './deviceInfo';

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

function getHeaders() {
  const sessionId = getOrCreateSessionId();
  return {
    'Content-Type': 'application/json',
    'X-Session-Id': sessionId,
  };
}

export interface StartRunResponse {
  success: boolean;
  runId?: string;
  topicName?: string;
  questions?: Array<{
    id: string;
    question_text: string;
    options: string[];
    image_url?: string | null;
  }>;
  totalQuestions?: number;
  error?: string;
}

export interface SubmitAnswerResponse {
  success: boolean;
  status?: string;
  isCorrect?: boolean;
  attemptNumber?: number;
  score?: number;
  nextQuestionId?: string;
  correctOption?: number;
  error?: string;
}

export interface RunSummaryResponse {
  success: boolean;
  summary?: {
    score_total: number;
    correct_count: number;
    wrong_count: number;
    duration_seconds: number | null;
    status: string;
  };
  error?: string;
}

export async function startTopicRun(questionSetId: string): Promise<StartRunResponse> {
  try {
    const sessionId = getOrCreateSessionId();
    const headers = getHeaders();

    console.log('[START QUIZ] Request details:', {
      questionSetId,
      sessionId,
      apiEndpoint: `${API_BASE}/start-public-quiz`,
      headers,
    });

    const deviceInfo = getDeviceInfo();

    const response = await fetch(`${API_BASE}/start-public-quiz`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        questionSetId,
        sessionId,
        deviceInfo,
      }),
    });

    console.log('[START QUIZ] Response status:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });

    const data = await response.json();

    console.log('[START QUIZ] Response data:', data);

    if (!response.ok) {
      console.error('[START QUIZ] Error response:', {
        status: response.status,
        error: data.error,
        fullData: data,
        topicId,
      });

      return {
        success: false,
        error: data.error || `Failed to start quiz (HTTP ${response.status})`,
      };
    }

    console.log('[START QUIZ] Success:', {
      runId: data.runId,
      topicName: data.topicName,
      questionCount: data.questions?.length,
      questionSetId,
    });

    return {
      success: true,
      runId: data.runId,
      topicName: data.topicName,
      questions: data.questions.map((q: any) => ({
        id: q.id,
        question_text: q.question_text,
        options: q.options,
        image_url: q.image_url || null,
      })),
      totalQuestions: data.totalQuestions,
    };
  } catch (error) {
    console.error('[START QUIZ] Exception caught:', {
      error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
      questionSetId,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

export async function submitTopicAnswer(
  runId: string,
  questionId: string,
  selectedIndex: number
): Promise<SubmitAnswerResponse> {
  try {
    const sessionId = getOrCreateSessionId();
    const headers = getHeaders();

    console.log('[SUBMIT ANSWER] Request details:', {
      runId,
      questionId,
      selectedIndex,
      sessionId,
    });

    const response = await fetch(`${API_BASE}/submit-public-answer`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        runId,
        questionId,
        selectedOption: selectedIndex,
        sessionId,
      }),
    });

    const data = await response.json();

    console.log('[SUBMIT ANSWER] Response:', {
      status: response.status,
      data,
    });

    if (!response.ok) {
      console.error('[SUBMIT ANSWER] Error response:', {
        status: response.status,
        error: data.error,
        runId,
        questionId,
      });

      return {
        success: false,
        error: data.error || 'Failed to submit answer',
      };
    }

    return {
      success: true,
      status: data.status,
      isCorrect: data.isCorrect,
      attemptNumber: data.attemptNumber,
      score: data.score,
      nextQuestionId: data.nextQuestionId,
      correctOption: data.correctOption,
    };
  } catch (error) {
    console.error('[SUBMIT ANSWER] Exception:', {
      error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      runId,
      questionId,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

export async function getTopicRunSummary(runId: string): Promise<RunSummaryResponse> {
  try {
    const sessionId = getOrCreateSessionId();
    const headers = getHeaders();
    const response = await fetch(`${API_BASE}/get-public-quiz-summary?run_id=${runId}&session_id=${sessionId}`, {
      method: 'GET',
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to get summary',
      };
    }

    return {
      success: true,
      summary: data.summary,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

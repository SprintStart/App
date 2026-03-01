const SESSION_KEY = 'quiz_session_id';

export function getOrCreateSessionId(): string {
  let sessionId = localStorage.getItem(SESSION_KEY);

  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem(SESSION_KEY, sessionId);
  }

  return sessionId;
}

export function getSessionId(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function clearSessionId(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function getSessionHeaders(): Record<string, string> {
  const sessionId = getOrCreateSessionId();
  return {
    'x-session-id': sessionId,
  };
}

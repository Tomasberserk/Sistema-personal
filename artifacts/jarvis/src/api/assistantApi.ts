import type { AssistantChatResponse } from '../types/assistant';

const envVars = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const API_BASE = (envVars.VITE_API_URL ?? '').replace(/\/+$/, '');
const TOKEN_KEY = 'jarvis_auth_token';
const TIMEOUT_MS = 60_000;

async function assistantFetch<T>(path: string, init: RequestInit): Promise<T> {
  const token = typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_KEY);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const body = (await response.json()) as { detail?: string };
        if (body?.detail) detail = body.detail;
      } catch {
        // conservar el mensaje HTTP
      }
      throw new Error(detail);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('El asistente tardó demasiado en responder. Intenta de nuevo.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function assistantChat(message: string, sessionId?: string | null): Promise<AssistantChatResponse> {
  return assistantFetch<AssistantChatResponse>('/api/assistant/chat', {
    method: 'POST',
    body: JSON.stringify({ message, session_id: sessionId ?? null }),
  });
}

export function assistantConfirm(
  sessionId: string,
  confirmationId: string,
  accept: boolean,
): Promise<AssistantChatResponse> {
  return assistantFetch<AssistantChatResponse>('/api/assistant/confirm', {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      confirmation_id: confirmationId,
      accept,
    }),
  });
}

export interface AssistantExecutedAction {
  tool: string;
  argumentos: Record<string, unknown>;
  estado: 'ok' | 'error' | string;
  resumen: string;
  datos?: unknown;
}

export interface PendingConfirmation {
  id: string;
  tool: string;
  resumen: string;
  prompt: string;
}

export interface AssistantChatResponse {
  session_id: string;
  reply: string;
  provider: string;
  executed: AssistantExecutedAction[];
  pending_confirmation: PendingConfirmation | null;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

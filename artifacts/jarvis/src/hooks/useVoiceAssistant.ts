import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { assistantChat, assistantConfirm } from '../api/assistantApi';
import type { AssistantMessage, PendingConfirmation } from '../types/assistant';

export type VoiceStatus = 'idle' | 'listening' | 'thinking' | 'speaking';

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: { transcript: string };
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
}

interface SpeechRecognitionErrorLike {
  error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const MUTE_KEY = 'jarvis_assistant_muted';

function getRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const candidate = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition ?? null;
}

function nuevoId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, '')
    .trim();
}

interface UseVoiceAssistantOptions {
  onActionsExecuted?: () => void;
}

export function useVoiceAssistant(options: UseVoiceAssistantOptions = {}) {
  const [supported] = useState(() => getRecognitionConstructor() !== null);
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [muted, setMuted] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(MUTE_KEY) === '1';
  });

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTextRef = useRef('');
  const sendingRef = useRef(false);
  const mutedRef = useRef(muted);
  const actionsRef = useRef(options.onActionsExecuted);

  mutedRef.current = muted;
  actionsRef.current = options.onActionsExecuted;

  const speak = useCallback((text: string) => {
    if (
      !text ||
      mutedRef.current ||
      typeof window === 'undefined' ||
      !('speechSynthesis' in window)
    ) {
      setStatus('idle');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-CO';
    utterance.rate = 1.02;
    utterance.pitch = 1;
    const voices = window.speechSynthesis.getVoices();
    const voice =
      voices.find((item) => item.lang.toLowerCase().startsWith('es-co')) ??
      voices.find((item) => item.lang.toLowerCase().startsWith('es'));
    if (voice) utterance.voice = voice;
    utterance.onstart = () => setStatus('speaking');
    utterance.onend = () => setStatus('idle');
    utterance.onerror = () => setStatus('idle');
    window.speechSynthesis.speak(utterance);
  }, []);

  const handleError = useCallback((error: unknown) => {
    const mensaje =
      error instanceof Error && error.message
        ? error.message
        : 'No pude completar la solicitud. Intenta de nuevo.';
    toast.error(mensaje);
    setMessages((prev) => [...prev, { id: nuevoId(), role: 'assistant', text: mensaje }]);
    setStatus('idle');
  }, []);

  const confirm = useCallback(
    async (accept: boolean) => {
      if (!pending || !sessionId) return;
      setStatus('thinking');
      try {
        const response = await assistantConfirm(sessionId, pending.id, accept);
        setMessages((prev) => [...prev, { id: nuevoId(), role: 'assistant', text: response.reply }]);
        setPending(null);
        if (response.executed.length > 0) actionsRef.current?.();
        speak(response.reply);
      } catch (error) {
        handleError(error);
      }
    },
    [pending, sessionId, speak, handleError],
  );

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || sendingRef.current) return;

      // Confirmación hablada: "sí" / "no" cuando hay una acción pendiente.
      if (pending) {
        const limpio = normalizar(text);
        if (/^(si|confirmo|dale|claro|de acuerdo|hazlo|confirmar)$/.test(limpio)) {
          await confirm(true);
          return;
        }
        if (/^(no|cancela|cancelar|mejor no|negativo)$/.test(limpio)) {
          await confirm(false);
          return;
        }
      }

      sendingRef.current = true;
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
      setMessages((prev) => [...prev, { id: nuevoId(), role: 'user', text }]);
      setStatus('thinking');

      try {
        const response = await assistantChat(text, sessionId);
        setSessionId(response.session_id);
        setMessages((prev) => [...prev, { id: nuevoId(), role: 'assistant', text: response.reply }]);
        setPending(response.pending_confirmation);
        if (response.executed.length > 0) actionsRef.current?.();
        speak(response.reply);
      } catch (error) {
        handleError(error);
      } finally {
        sendingRef.current = false;
      }
    },
    [pending, sessionId, confirm, speak, handleError],
  );

  const sendRef = useRef(send);
  sendRef.current = send;

  const startListening = useCallback(() => {
    if (!supported) {
      toast.error('Tu navegador no permite dictado por voz. Puedes escribir el comando.');
      return;
    }
    if (status === 'listening') {
      recognitionRef.current?.stop();
      return;
    }

    window.speechSynthesis?.cancel();

    const Constructor = getRecognitionConstructor();
    if (!Constructor) return;

    const recognition = new Constructor();
    recognition.lang = 'es-CO';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setStatus('listening');
    recognition.onresult = (event) => {
      let finalText = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) finalText += result[0].transcript;
      }
      finalTextRef.current = finalText.trim();
    };
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        toast.error('Permite el micrófono en el navegador para usar el asistente.');
      } else if (event.error === 'no-speech') {
        toast.message('No escuché nada. Intenta de nuevo.');
      } else if (event.error !== 'aborted') {
        toast.error(`No pude escuchar: ${event.error}`);
      }
      setStatus('idle');
    };
    recognition.onend = () => {
      setStatus((prev) => (prev === 'listening' ? 'idle' : prev));
      const text = finalTextRef.current;
      finalTextRef.current = '';
      if (text) void sendRef.current(text);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setStatus('idle');
      toast.error('El micrófono ya está en uso. Espera un momento e intenta de nuevo.');
    }
  }, [supported, status]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const toggleMuted = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      if (next) window.speechSynthesis?.cancel();
      localStorage.setItem(MUTE_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    recognitionRef.current?.abort();
    window.speechSynthesis?.cancel();
    setMessages([]);
    setPending(null);
    setSessionId(null);
    setStatus('idle');
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);

  return {
    supported,
    status,
    messages,
    pending,
    muted,
    startListening,
    stopListening,
    send,
    confirm,
    reset,
    toggleMuted,
  };
}

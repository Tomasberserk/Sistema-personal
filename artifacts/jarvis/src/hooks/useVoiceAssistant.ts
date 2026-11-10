import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Haptics, NotificationType } from '@capacitor/haptics';

import {
  assistantChat,
  assistantConfirm,
  executeAssistantTool,
  fetchLiveSession,
} from '../api/assistantApi';
import type { AssistantMessage, PendingConfirmation } from '../types/assistant';
import { AudioCapture } from '../voice/audioCapture';
import { AudioPlayback } from '../voice/audioPlayback';
import { GeminiLiveClient, type ToolCall } from '../voice/geminiLive';
import {
  controlNativeTorch,
  getNativeBattery,
  launchNativeApp,
  loadLocalContacts,
  openWhatsAppDraft,
  resolveLocalContact,
  saveLocalContact,
  startVoiceForegroundService,
  stopVoiceForegroundService,
} from '../services/nativeDevice';

export type VoiceStatus = 'idle' | 'listening' | 'thinking' | 'speaking';

const MUTE_KEY = 'jarvis_assistant_muted';

function nuevoId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

interface UseVoiceAssistantOptions {
  onActionsExecuted?: () => void;
}

export function useVoiceAssistant(options: UseVoiceAssistantOptions = {}) {
  const [supported] = useState(() => typeof window !== 'undefined');
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [muted, setMuted] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(MUTE_KEY) === '1';
  });

  const liveClientRef = useRef<GeminiLiveClient | null>(null);
  const audioCaptureRef = useRef<AudioCapture | null>(null);
  const audioPlaybackRef = useRef<AudioPlayback | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentTurnAssistantTextRef = useRef('');
  const mutedRef = useRef(muted);
  const actionsRef = useRef(options.onActionsExecuted);
  const pendingWhatsAppRef = useRef<{ phone: string; name: string; message: string } | null>(null);

  mutedRef.current = muted;
  actionsRef.current = options.onActionsExecuted;

  const toggleMuted = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem(MUTE_KEY, next ? '1' : '0');
      }
      if (audioPlaybackRef.current) {
        audioPlaybackRef.current.setMuted(next);
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    liveClientRef.current?.disconnect();
    audioPlaybackRef.current?.stop();
    audioCaptureRef.current?.setMuted(true);
    void stopVoiceForegroundService();
    pendingWhatsAppRef.current = null;
    setStatus('idle');
    setMessages([]);
    setPending(null);
    setSessionId(null);
  }, []);

  const handleError = useCallback((error: unknown) => {
    const mensaje =
      error instanceof Error && error.message
        ? error.message
        : 'Error en la conexión con Tomás.';
    toast.error(mensaje);
    setMessages((prev) => [...prev, { id: nuevoId(), role: 'assistant', text: mensaje }]);
    setStatus('idle');
  }, []);

  // Dispatch de herramientas ejecutadas por Gemini Live (Hardware Nativo Android + BFF Cloud)
  const handleToolCall = useCallback(
    async (toolCall: ToolCall): Promise<Record<string, unknown>> => {
      setStatus('thinking');
      try {
        console.info(`[VoiceAssistant] Ejecutando tool: ${toolCall.name} con parámetros:`, toolCall.args);

        if (toolCall.name === 'control_torch') {
          const enabled = toolCall.args.state !== 'off';
          const res = await controlNativeTorch(enabled);
          if (res.success) {
            toast.success(enabled ? 'Linterna encendida' : 'Linterna apagada');
          }
          return res;
        }

        if (toolCall.name === 'check_battery') {
          return await getNativeBattery();
        }

        if (toolCall.name === 'launch_app') {
          return await launchNativeApp(String(toolCall.args.app_name || ''));
        }

        if (toolCall.name === 'guardar_contacto') {
          const saved = saveLocalContact(
            String(toolCall.args.nombre || ''),
            String(toolCall.args.telefono || ''),
            Array.isArray(toolCall.args.alias) ? toolCall.args.alias.map(String) : [],
          );
          return { success: true, contacto: saved };
        }

        if (toolCall.name === 'whatsapp_preparar_mensaje') {
          const dest = String(toolCall.args.destinatario || '');
          const mensaje = String(toolCall.args.mensaje || '');
          const contact = resolveLocalContact(dest);
          if (!contact) {
            return {
              status: 'CONTACT_NOT_FOUND',
              known_contacts: loadLocalContacts().map((c) => c.name),
              message: `No tengo el número de '${dest}'. Pídelo una vez para guardarlo con guardar_contacto.`,
            };
          }
          pendingWhatsAppRef.current = { phone: contact.phone, name: contact.name, message: mensaje };
          setPending({
            id: `whatsapp_${Date.now()}`,
            tool: 'whatsapp_preparar_mensaje',
            resumen: `WhatsApp a ${contact.name} (+${contact.phone})`,
            prompt: `¿Confirmas abrir WhatsApp con "${mensaje}" para ${contact.name}?`,
          });
          return {
            status: 'PENDING_CONFIRMATION',
            destinatario: contact.name,
            message: `Solicité confirmación en pantalla para abrir WhatsApp con el mensaje listo para ${contact.name}.`,
          };
        }

        const result = await executeAssistantTool(toolCall.name, toolCall.args);

        if (result.status === 'COMMITTED') {
          try {
            await Haptics.notification({ type: NotificationType.Success });
          } catch {
            // ignore
          }
          actionsRef.current?.();
          return {
            status: 'COMMITTED',
            tool_name: toolCall.name,
            result: result.result,
            state_version: result.state_version,
            message: `Operación ${toolCall.name} completada con éxito.`,
          };
        } else {
          return {
            status: result.status,
            error: 'No se pudo comprometer la transacción en el backend.',
          };
        }
      } catch (err) {
        console.error(`[VoiceAssistant] Error ejecutando tool ${toolCall.name}:`, err);
        return {
          status: 'REJECTED',
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
    [],
  );

  const stopListening = useCallback(() => {
    liveClientRef.current?.flushSilenceEndOfTurn();
    liveClientRef.current?.disconnect();
    audioPlaybackRef.current?.stop();
    audioCaptureRef.current?.setMuted(true);
    void stopVoiceForegroundService();
    setStatus('idle');
  }, []);

  const startListening = useCallback(async () => {
    if (status === 'listening' || status === 'speaking' || status === 'thinking') {
      stopListening();
      return;
    }

    try {
      setStatus('thinking');
      void startVoiceForegroundService();

      // 1. Aprovisionamiento efímero desde Jarvis Cloud BFF (con fallback local explícito)
      const sessionInfo = await fetchLiveSession();
      let liveToken = sessionInfo.ephemeral_token;
      if (sessionInfo.configured === false) {
        const localKey = typeof window !== 'undefined' ? localStorage.getItem('tomas_gemini_api_key')?.trim() : '';
        if (localKey) {
          liveToken = localKey;
        } else {
          throw new Error('Falta GEMINI_API_KEY en Render para habilitar la voz Live sin PC.');
        }
      }

      // 2. Inicializar AudioContext y AudioPlayback
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx({ latencyHint: 'interactive' });
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      analyser.connect(audioContextRef.current.destination);

      if (!audioPlaybackRef.current) {
        audioPlaybackRef.current = new AudioPlayback(audioContextRef.current, analyser);
      }
      audioPlaybackRef.current.setMuted(mutedRef.current);

      if (!audioCaptureRef.current) {
        audioCaptureRef.current = new AudioCapture();
      }

      // 3. Crear e iniciar GeminiLiveClient con fallback multimodelo
      const client = new GeminiLiveClient();
      liveClientRef.current = client;

      client.connect({
        token: liveToken,
        wsUrl: sessionInfo.ws_url,
        wsUrlV1Beta: sessionInfo.ws_url_v1beta,
        model: sessionInfo.model || 'models/gemini-3.8-live',
        fallbackModels: sessionInfo.fallback_models,
        callbacks: {
          onConnected: () => {
            console.info('[VoiceAssistant] WebSocket conectado con Gemini Live');
          },
          onSetupComplete: async () => {
            console.info('[VoiceAssistant] Handshake completado. Iniciando captura de audio...');
            setStatus('listening');
            currentTurnAssistantTextRef.current = '';

            try {
              await audioCaptureRef.current?.start({
                onChunk: (buffer) => {
                  const base64 = bufferToBase64(buffer);
                  client.sendAudioChunk(base64);
                },
                onSpeechStart: () => {
                  // Si el usuario empieza a hablar mientras el modelo habla, cancelar audio inmediatamente (barge-in)
                  audioPlaybackRef.current?.interrupt();
                  setStatus('listening');
                },
                onSpeechEnd: () => {
                  setStatus('thinking');
                },
              });
            } catch (captureErr) {
              console.error('[VoiceAssistant] Error iniciando captura de audio:', captureErr);
              toast.error('No se pudo acceder al micrófono.');
              setStatus('idle');
            }
          },
          onAudioChunk: (base64Audio) => {
            setStatus('speaking');
            audioPlaybackRef.current?.playPcm24k(base64Audio);
          },
          onTextChunk: (textChunk) => {
            currentTurnAssistantTextRef.current += textChunk;
          },
          onInterrupted: () => {
            audioPlaybackRef.current?.interrupt();
            setStatus('listening');
          },
          onTurnComplete: () => {
            if (currentTurnAssistantTextRef.current.trim()) {
              const fullText = currentTurnAssistantTextRef.current.trim();
              setMessages((prev) => [
                ...prev,
                { id: nuevoId(), role: 'assistant', text: fullText },
              ]);
              currentTurnAssistantTextRef.current = '';
            }
            setStatus('listening');
          },
          onToolCall: handleToolCall,
          onError: (err) => {
            console.error('[VoiceAssistant] Error en cliente Gemini Live:', err);
            handleError(err);
          },
          onClose: () => {
            void stopVoiceForegroundService();
            setStatus('idle');
          },
        },
      });
    } catch (err) {
      void stopVoiceForegroundService();
      console.error('[VoiceAssistant] Error iniciando sesión Live:', err);
      handleError(err);
    }
  }, [status, stopListening, handleToolCall, handleError]);

  // Enviar texto al asistente (soporta Gemini Live si está conectado o fallback BFF)
  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text) return;

      setMessages((prev) => [...prev, { id: nuevoId(), role: 'user', text }]);

      if (liveClientRef.current) {
        liveClientRef.current.sendText(text);
        setStatus('thinking');
        return;
      }

      // Fallback a HTTP Assistant Chat si WebSocket no está abierto
      setStatus('thinking');
      try {
        const response = await assistantChat(text, sessionId);
        setSessionId(response.session_id);
        setMessages((prev) => [...prev, { id: nuevoId(), role: 'assistant', text: response.reply }]);
        setPending(response.pending_confirmation);
        if (response.executed.length > 0) actionsRef.current?.();
      } catch (error) {
        handleError(error);
      } finally {
        setStatus('idle');
      }
    },
    [sessionId, handleError],
  );

  const confirm = useCallback(
    async (accept: boolean) => {
      if (!pending) return;

      if (pending.id.startsWith('whatsapp_') && pendingWhatsAppRef.current) {
        const draft = pendingWhatsAppRef.current;
        pendingWhatsAppRef.current = null;
        setPending(null);
        if (!accept) {
          const cancelMsg = `Envío de WhatsApp a ${draft.name} cancelado.`;
          setMessages((prev) => [...prev, { id: nuevoId(), role: 'assistant', text: cancelMsg }]);
          liveClientRef.current?.sendText(`[SISTEMA]: El usuario canceló el envío de WhatsApp a ${draft.name}.`);
          return;
        }
        const openRes = await openWhatsAppDraft(draft.phone, draft.message);
        const okMsg = openRes.success
          ? `WhatsApp abierto con el mensaje listo para ${draft.name}. Toca enviar en WhatsApp.`
          : `No se pudo abrir WhatsApp: ${openRes.error}`;
        setMessages((prev) => [...prev, { id: nuevoId(), role: 'assistant', text: okMsg }]);
        liveClientRef.current?.sendText(`[SISTEMA]: ${okMsg}`);
        return;
      }

      if (!sessionId) return;
      setStatus('thinking');
      try {
        const response = await assistantConfirm(sessionId, pending.id, accept);
        setMessages((prev) => [...prev, { id: nuevoId(), role: 'assistant', text: response.reply }]);
        setPending(null);
        if (response.executed.length > 0) actionsRef.current?.();
      } catch (error) {
        handleError(error);
      } finally {
        setStatus('idle');
      }
    },
    [pending, sessionId, handleError],
  );

  useEffect(() => {
    return () => {
      liveClientRef.current?.disconnect();
      audioPlaybackRef.current?.stop();
      void stopVoiceForegroundService();
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

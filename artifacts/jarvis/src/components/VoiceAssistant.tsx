import { FormEvent, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Check,
  Loader2,
  Mic,
  RotateCcw,
  Send,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useVoiceAssistant, type VoiceStatus } from '../hooks/useVoiceAssistant';

const ESTADO_TEXTO: Record<VoiceStatus, string> = {
  idle: 'Listo para escucharte',
  listening: 'Escuchando…',
  thinking: 'Pensando…',
  speaking: 'Respondiendo…',
};

const ESTADO_COLOR: Record<VoiceStatus, string> = {
  idle: 'bg-white/40',
  listening: 'bg-[#5de8c4]',
  thinking: 'bg-[#e8d95d]',
  speaking: 'bg-[#5d8ae8]',
};

const EJEMPLOS = [
  'gasté 25 mil en comida con nequi',
  '¿cómo voy este mes?',
  'marca el hábito gimnasio',
  '¿estado del aceite de la moto?',
];

export function VoiceAssistant() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState('');
  const listaRef = useRef<HTMLDivElement | null>(null);

  const {
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
  } = useVoiceAssistant({
    onActionsExecuted: () => {
      void queryClient.invalidateQueries();
    },
  });

  useEffect(() => {
    const lista = listaRef.current;
    if (lista) lista.scrollTop = lista.scrollHeight;
  }, [messages, pending, status, open]);

  if (!user) return null;

  const ocupado = status === 'thinking';

  const enviarTexto = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!texto.trim()) return;
    void send(texto);
    setTexto('');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (open) stopListening();
          setOpen((prev) => !prev);
        }}
        aria-label={open ? 'Cerrar asistente de voz' : 'Abrir asistente de voz'}
        className="fixed bottom-[84px] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full border border-[#5de8c4]/40 bg-[#0b0b10] text-[#5de8c4] shadow-[0_0_30px_rgba(93,232,196,0.25)] transition hover:scale-105 hover:bg-[#12121a] md:bottom-6"
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : status === 'thinking' ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <Mic className="h-6 w-6" />
        )}
        {!open && status === 'listening' && (
          <span className="absolute inset-0 animate-ping rounded-full border border-[#5de8c4]/60" />
        )}
      </button>

      {open && (
        <section
          role="dialog"
          aria-label="Asistente de voz Jarvis"
          className="fixed bottom-[150px] right-3 z-40 flex w-[calc(100vw-1.5rem)] max-w-[390px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b10]/97 shadow-2xl backdrop-blur-2xl sm:right-4 md:bottom-[92px]"
        >
          <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${ESTADO_COLOR[status]} ${status !== 'idle' ? 'animate-pulse' : ''}`} />
              <div>
                <p className="text-sm font-semibold tracking-tight text-white">Jarvis voz</p>
                <p className="text-[11px] text-white/50">{ESTADO_TEXTO[status]}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleMuted}
                aria-label={muted ? 'Activar respuestas habladas' : 'Silenciar respuestas habladas'}
                className="rounded-full p-2 text-white/50 transition hover:bg-white/5 hover:text-white"
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={reset}
                aria-label="Reiniciar conversación"
                className="rounded-full p-2 text-white/50 transition hover:bg-white/5 hover:text-white"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div
            ref={listaRef}
            aria-live="polite"
            className="flex max-h-[46vh] min-h-[190px] flex-col gap-2 overflow-y-auto px-4 py-3 sm:max-h-[340px]"
          >
            {messages.length === 0 && (
              <div className="flex flex-1 flex-col justify-center gap-3 py-2">
                <p className="text-sm text-white/70">
                  Hola {user.nombre.split(' ')[0]}, puedo registrar movimientos, consultar tus finanzas,
                  marcar hábitos y más. Toca el micrófono o escribe un comando.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {EJEMPLOS.map((ejemplo) => (
                    <button
                      key={ejemplo}
                      type="button"
                      onClick={() => void send(ejemplo)}
                      className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/60 transition hover:border-[#5de8c4]/40 hover:text-white"
                    >
                      {ejemplo}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.slice(-12).map((message) => (
              <div
                key={message.id}
                className={`max-w-[88%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                  message.role === 'user'
                    ? 'self-end bg-[#5de8c4]/15 text-[#c9f7ea]'
                    : 'self-start bg-white/5 text-white/80'
                }`}
              >
                {message.text}
              </div>
            ))}

            {status === 'thinking' && (
              <div className="flex items-center gap-2 self-start rounded-2xl bg-white/5 px-3 py-2 text-[13px] text-white/50">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Procesando…
              </div>
            )}
          </div>

          {pending && (
            <div className="mx-4 mb-3 rounded-2xl border border-[#e8d95d]/40 bg-[#e8d95d]/10 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#e8d95d]" />
                <div className="space-y-2">
                  <p className="text-[12px] text-white/80">
                    Voy a <strong className="font-semibold">{pending.resumen}</strong>. ¿Confirmas?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void confirm(true)}
                      className="flex items-center gap-1 rounded-full bg-[#5de8c4] px-3 py-1 text-[12px] font-semibold text-[#062019] transition hover:brightness-110"
                    >
                      <Check className="h-3.5 w-3.5" /> Sí
                    </button>
                    <button
                      type="button"
                      onClick={() => void confirm(false)}
                      className="flex items-center gap-1 rounded-full border border-white/15 px-3 py-1 text-[12px] text-white/70 transition hover:bg-white/5"
                    >
                      <X className="h-3.5 w-3.5" /> No
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={status === 'listening' ? stopListening : startListening}
                disabled={ocupado || !supported}
                aria-label={status === 'listening' ? 'Detener dictado' : 'Hablar con el asistente'}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition ${
                  status === 'listening'
                    ? 'bg-[#5de8c4] text-[#062019]'
                    : 'border border-white/15 bg-white/5 text-white/70 hover:border-[#5de8c4]/50 hover:text-[#5de8c4]'
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {status === 'listening' ? <Mic className="h-5 w-5 animate-pulse" /> : <Mic className="h-5 w-5" />}
              </button>

              <form onSubmit={enviarTexto} className="flex flex-1 items-center gap-2">
                <input
                  value={texto}
                  onChange={(event) => setTexto(event.target.value)}
                  placeholder={supported ? 'Habla o escribe tu comando…' : 'Escribe tu comando…'}
                  disabled={ocupado}
                  className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-3.5 py-2.5 text-[13px] text-white outline-none placeholder:text-white/35 focus:border-[#5de8c4]/50 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!texto.trim() || ocupado}
                  aria-label="Enviar comando"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#5de8c4] text-[#062019] transition hover:brightness-110 disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
            {!supported && (
              <p className="mt-2 text-[11px] text-[#e8a85d]">
                Este navegador no soporta dictado por voz; usa Chrome o Edge, o escribe el comando.
              </p>
            )}
            <p className="mt-2 text-[10px] text-white/30">
              Las acciones destructivas siempre piden confirmación.
            </p>
          </div>
        </section>
      )}
    </>
  );
}

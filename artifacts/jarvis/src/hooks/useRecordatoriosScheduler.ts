import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useListRecordatorios, useUpdateRecordatorio } from '@workspace/api-client-react';
import type { Recordatorio } from '@workspace/api-client-react';

export const reproducirAlertaSonora = () => {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
    osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.35); // D6

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.25);
  } catch {
    // Audio context bloqueado antes de interacción de usuario
  }
};

export function useRecordatoriosScheduler() {
  const { data: rawRecordatorios } = useListRecordatorios();
  const updateRec = useUpdateRecordatorio();
  const triggeredIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const list: Recordatorio[] = Array.isArray(rawRecordatorios)
      ? rawRecordatorios
      : (rawRecordatorios as unknown as { data?: Recordatorio[] })?.data ?? [];

    const checkInterval = setInterval(() => {
      const now = Date.now();

      list.forEach((r) => {
        if (!r.activo || r.disparado) return;
        if (triggeredIdsRef.current.has(r.id)) return;

        try {
          const targetTime = new Date(r.fecha_disparo).getTime() - (r.anticipacion_minutos || 0) * 60 * 1000;
          if (isNaN(targetTime)) return;

          // Si ya llegó la hora (con margen de 5 minutos hacia atrás por si la app se abrió recientemente)
          if (targetTime <= now && now - targetTime < 300000) {
            triggeredIdsRef.current.add(r.id);

            // 1. Alerta sonora
            reproducirAlertaSonora();

            // 2. Notificación nativa del navegador / Service Worker
            if ('Notification' in window && Notification.permission === 'granted') {
              if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.ready.then((reg) => {
                  reg.showNotification(r.titulo, {
                    body: r.descripcion || 'Recordatorio de tu Sistema Personal',
                    icon: '/favicon.svg',
                    badge: '/favicon.svg',
                  });
                });
              } else {
                new Notification(r.titulo, {
                  body: r.descripcion || 'Recordatorio de tu Sistema Personal',
                  icon: '/favicon.svg',
                });
              }
            }

            // 3. Notificación visual Toast enriquecida
            toast.info(`🔔 Recordatorio: ${r.titulo}`, {
              description: r.descripcion || 'Hora de cumplir con tu actividad.',
              duration: 10000,
            });

            // 4. Si es recurrente, calcular siguiente disparo
            if (r.tipo === 'recurrente' && r.regla_recurrencia?.startsWith('INTERVAL_HOURS:')) {
              const hours = parseInt(r.regla_recurrencia.replace('INTERVAL_HOURS:', ''), 10) || 2;
              const nextDate = new Date(now + hours * 3600 * 1000).toISOString().slice(0, 19);
              updateRec.mutate({
                id: r.id,
                data: { fecha_disparo: nextDate, disparado: false },
              });
            } else {
              updateRec.mutate({
                id: r.id,
                data: { disparado: true },
              });
            }
          }
        } catch {
          // Ignorar formato de fecha inválido
        }
      });
    }, 10000);

    return () => clearInterval(checkInterval);
  }, [rawRecordatorios, updateRec]);
}

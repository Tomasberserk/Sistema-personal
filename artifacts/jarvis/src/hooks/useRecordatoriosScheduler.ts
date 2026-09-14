import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useListRecordatorios, useUpdateRecordatorio } from '@workspace/api-client-react';
import type { Recordatorio } from '@workspace/api-client-react';
import {
  initAudioUnlock,
  playTonoSuave,
  playTonoNotificacion,
  startAlarmaPersistente,
  type ActiveAlarmHandle,
} from '../services/soundEffects';

const BROADCAST_CHANNEL_NAME = 'jarvis_alarms';
const TAB_ID = typeof window !== 'undefined' ? Math.random().toString(36).substring(2, 9) : 'tab';

interface AlarmBroadcastMessage {
  type: 'ALARM_TRIGGERED' | 'ALARM_DISMISSED';
  eventKey: string;
  recordatorioId: number;
  tabId: string;
}

export function useRecordatoriosScheduler() {
  const { data: rawRecordatorios } = useListRecordatorios();
  const updateRec = useUpdateRecordatorio();

  const [activeAlarm, setActiveAlarm] = useState<Recordatorio | null>(null);
  const activeAlarmHandleRef = useRef<ActiveAlarmHandle | null>(null);
  const triggeredEventsRef = useRef<Set<string>>(new Set());
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // 1. Inicializar AudioContext Unlock y canal BroadcastChannel
  useEffect(() => {
    initAudioUnlock();

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      broadcastChannelRef.current = bc;

      bc.onmessage = (event: MessageEvent<AlarmBroadcastMessage>) => {
        const msg = event.data;
        if (!msg || msg.tabId === TAB_ID) return;

        if (msg.type === 'ALARM_TRIGGERED') {
          // Otra pestaña ya disparó el evento
          triggeredEventsRef.current.add(msg.eventKey);
        } else if (msg.type === 'ALARM_DISMISSED') {
          // Otra pestaña ya detuvo / pospuso / cumplió la alarma
          if (activeAlarmHandleRef.current) {
            activeAlarmHandleRef.current.stop();
            activeAlarmHandleRef.current = null;
          }
          setActiveAlarm((current) => (current?.id === msg.recordatorioId ? null : current));
        }
      };

      return () => {
        bc.close();
      };
    }
  }, []);

  // 2. Acciones del Modal de Alarma
  const handleDetener = useCallback(
    (recordatorio: Recordatorio) => {
      // Detener audio y vibración de inmediato
      if (activeAlarmHandleRef.current) {
        activeAlarmHandleRef.current.stop();
        activeAlarmHandleRef.current = null;
      }
      setActiveAlarm(null);

      const eventKey = `${recordatorio.id}_${recordatorio.fecha_disparo}`;
      broadcastChannelRef.current?.postMessage({
        type: 'ALARM_DISMISSED',
        eventKey,
        recordatorioId: recordatorio.id,
        tabId: TAB_ID,
      });

      // Semántica DETENER: silencia la alarma actual SIN alterar el ciclo de recurrencia
      updateRec.mutate({
        id: recordatorio.id,
        data: { disparado: true } as never,
      });
      toast.info(`Alarma silenciada: ${recordatorio.titulo}`);
    },
    [updateRec],
  );

  const handlePosponer = useCallback(
    (recordatorio: Recordatorio) => {
      if (activeAlarmHandleRef.current) {
        activeAlarmHandleRef.current.stop();
        activeAlarmHandleRef.current = null;
      }
      setActiveAlarm(null);

      const eventKey = `${recordatorio.id}_${recordatorio.fecha_disparo}`;
      broadcastChannelRef.current?.postMessage({
        type: 'ALARM_DISMISSED',
        eventKey,
        recordatorioId: recordatorio.id,
        tabId: TAB_ID,
      });

      // Semántica POSPONER: Operación atómica sumando 5 minutos sobre la misma entidad
      const now = Date.now();
      const nextDate = new Date(now + 5 * 60 * 1000).toISOString().slice(0, 19);

      updateRec.mutate({
        id: recordatorio.id,
        data: { fecha_disparo: nextDate, disparado: false } as never,
      });
      toast.info(`Recordatorio pospuesto 5 minutos (${nextDate.slice(11, 16)})`);
    },
    [updateRec],
  );

  const handleCumplir = useCallback(
    (recordatorio: Recordatorio) => {
      if (activeAlarmHandleRef.current) {
        activeAlarmHandleRef.current.stop();
        activeAlarmHandleRef.current = null;
      }
      setActiveAlarm(null);

      const eventKey = `${recordatorio.id}_${recordatorio.fecha_disparo}`;
      broadcastChannelRef.current?.postMessage({
        type: 'ALARM_DISMISSED',
        eventKey,
        recordatorioId: recordatorio.id,
        tabId: TAB_ID,
      });

      const now = Date.now();
      // Semántica CUMPLIR: Si es recurrente, calcula siguiente ciclo; si es puntual, se marca inactivo/completado
      if (recordatorio.tipo === 'recurrente' && recordatorio.regla_recurrencia?.startsWith('INTERVAL_HOURS:')) {
        const hours = parseInt(recordatorio.regla_recurrencia.replace('INTERVAL_HOURS:', ''), 10) || 2;
        const nextDate = new Date(now + hours * 3600 * 1000).toISOString().slice(0, 19);

        updateRec.mutate({
          id: recordatorio.id,
          data: { fecha_disparo: nextDate, disparado: false } as never,
        });
        toast.success(`¡Cumplido! Siguiente aviso programado para las ${nextDate.slice(11, 16)}.`);
      } else {
        updateRec.mutate({
          id: recordatorio.id,
          data: { activo: false, disparado: true } as never,
        });
        toast.success(`¡Recordatorio marcado como cumplido!`);
      }
    },
    [updateRec],
  );

  // 3. Scheduler Loop (React foreground checker)
  useEffect(() => {
    const list: Recordatorio[] = Array.isArray(rawRecordatorios)
      ? rawRecordatorios
      : (rawRecordatorios as unknown as { data?: Recordatorio[] })?.data ?? [];

    const checkInterval = setInterval(() => {
      const now = Date.now();

      list.forEach((r) => {
        if (!r.activo || r.disparado) return;

        const eventKey = `${r.id}_${r.fecha_disparo}`;
        if (triggeredEventsRef.current.has(eventKey)) return;

        try {
          const targetTime = new Date(r.fecha_disparo).getTime() - (r.anticipacion_minutos || 0) * 60 * 1000;
          if (isNaN(targetTime)) return;

          // Si llegó la hora (con margen de tolerancia de 5 minutos hacia atrás)
          if (targetTime <= now && now - targetTime < 300000) {
            // Deduplicación Multi-Pestaña mediante claim determinista en localStorage
            const claimKey = `jarvis_alarm_claim_${eventKey}`;
            const existingClaim = localStorage.getItem(claimKey);

            if (existingClaim) {
              try {
                const parsed = JSON.parse(existingClaim);
                if (Date.now() - parsed.ts < 60000 && parsed.tabId !== TAB_ID) {
                  // Otra pestaña ya reclamó el disparo de este evento
                  triggeredEventsRef.current.add(eventKey);
                  return;
                }
              } catch {
                // Si el claim está corrupto, continuar
              }
            }

            // Registrar claim de esta pestaña
            try {
              localStorage.setItem(claimKey, JSON.stringify({ tabId: TAB_ID, ts: Date.now() }));
            } catch {
              // Ignorar fallo de storage
            }

            triggeredEventsRef.current.add(eventKey);

            // Notificar a las demás pestañas para evitar disparos duplicados
            broadcastChannelRef.current?.postMessage({
              type: 'ALARM_TRIGGERED',
              eventKey,
              recordatorioId: r.id,
              tabId: TAB_ID,
            });

            // Determinar modo de alerta (fallback a 'notificacion' para canales históricos y cualquier valor no persistente/suave)
            const rawCanal = (r as unknown as { canal?: string }).canal;
            const modoAlerta = (rawCanal === 'suave' || rawCanal === 'persistente') ? rawCanal : 'notificacion';

            // 1. Audio & Vibración según el perfil
            if (modoAlerta === 'suave') {
              playTonoSuave();
            } else if (modoAlerta === 'persistente') {
              if (activeAlarmHandleRef.current) {
                activeAlarmHandleRef.current.stop();
              }
              activeAlarmHandleRef.current = startAlarmaPersistente();
            } else {
              // 'notificacion' (incluye fallback seguro para 'todos', 'push', 'in_app')
              playTonoNotificacion();
            }

            // 2. Notificación nativa del Sistema Operativo (Nivel B)
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try {
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
              } catch {
                // Fallback seguro si las notificaciones fallan
              }
            }

            // 3. Experiencia Visual en Primer Plano (Nivel A)
            if (modoAlerta === 'suave') {
              toast.info(`🔔 Recordatorio: ${r.titulo}`, {
                description: r.descripcion || 'Hora de cumplir con tu actividad.',
                duration: 8000,
              });
            } else {
              // Levantar AlarmaModal prominente para modo 'notificacion' y 'persistente'
              setActiveAlarm(r);
            }
          }
        } catch {
          // Ignorar formato de fecha inválido
        }
      });
    }, 5000);

    return () => clearInterval(checkInterval);
  }, [rawRecordatorios]);

  return {
    activeAlarm,
    handleDetener,
    handlePosponer,
    handleCumplir,
  };
}

// Mantener compatibilidad exportada para cualquier llamada heredada
export { playTonoNotificacion as reproducirAlertaSonora };

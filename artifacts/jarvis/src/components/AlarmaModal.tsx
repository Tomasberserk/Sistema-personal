import React from 'react';
import { BellRing, VolumeX, Clock, CheckCircle, Flame } from 'lucide-react';
import type { Recordatorio } from '@workspace/api-client-react';

interface AlarmaModalProps {
  recordatorio: Recordatorio;
  onDetener: () => void;
  onPosponer: () => void;
  onCumplir: () => void;
}

export const AlarmaModal: React.FC<AlarmaModalProps> = ({
  recordatorio,
  onDetener,
  onPosponer,
  onCumplir,
}) => {
  const isRecurrente = recordatorio.tipo === 'recurrente';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      {/* Glow Effect */}
      <div className="absolute h-80 w-80 rounded-full bg-[#5de8c4]/15 blur-[90px] pointer-events-none" />

      <div
        role="alertdialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-md rounded-[32px] border border-[#5de8c4]/30 bg-[#0d0d12] p-6 sm:p-8 text-white shadow-2xl shadow-black/80"
      >
        {/* Animated Alarm Header */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-5 flex h-20 w-20 items-center justify-center">
            {/* Concentric pulsing rings */}
            <div className="absolute inset-0 rounded-full bg-[#5de8c4]/20 animate-ping opacity-75" />
            <div className="absolute -inset-2 rounded-full border border-[#5de8c4]/30 animate-pulse" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-[#5de8c4] text-black shadow-lg shadow-[#5de8c4]/40">
              <BellRing size={32} className="animate-bounce" />
            </div>
          </div>

          <div className="cosmos-eyebrow text-[#5de8c4] uppercase tracking-widest font-bold text-xs mb-1">
            {isRecurrente ? 'Recordatorio Recurrente' : 'Alarma Programada'}
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white line-clamp-2">
            {recordatorio.titulo}
          </h2>

          {recordatorio.descripcion && (
            <p className="mt-2 text-sm text-white/70 max-w-xs">
              {recordatorio.descripcion}
            </p>
          )}

          <div className="mt-4 flex items-center gap-2 rounded-full bg-white/6 px-3.5 py-1 text-xs text-white/50">
            <Clock size={13} />
            <span>
              {new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
            </span>
            {isRecurrente && (
              <span className="flex items-center gap-1 text-[#5de8c4] font-medium border-l border-white/10 pl-2">
                <Flame size={12} />
                {recordatorio.regla_recurrencia?.replace('INTERVAL_HOURS:', 'Cada ') || 'Recurrente'}h
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 space-y-2.5">
          {/* Primary Stop / Silence Button */}
          <button
            type="button"
            onClick={onDetener}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 py-3.5 text-sm font-bold text-white transition hover:bg-white/15 active:scale-[0.98]"
          >
            <VolumeX size={18} />
            Detener Alarma (Silenciar)
          </button>

          {/* Snooze 5 Minutes */}
          <button
            type="button"
            onClick={onPosponer}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-transparent py-3 text-sm font-semibold text-white/80 transition hover:bg-white/5 hover:text-white active:scale-[0.98]"
          >
            <Clock size={16} />
            Posponer 5 minutos
          </button>

          {/* Mark as Done */}
          <button
            type="button"
            onClick={onCumplir}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#5de8c4] py-3.5 text-sm font-bold text-black shadow-lg shadow-[#5de8c4]/20 transition hover:bg-[#5de8c4]/90 active:scale-[0.98]"
          >
            <CheckCircle size={18} />
            Marcar como Cumplido
          </button>
        </div>
      </div>
    </div>
  );
};

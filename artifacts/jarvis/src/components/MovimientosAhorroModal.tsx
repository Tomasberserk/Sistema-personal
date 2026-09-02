import React from 'react';
import { X, ArrowUpRight, ArrowDownLeft, Clock, PiggyBank } from 'lucide-react';
import type { MetaAhorro } from '../types/custom';
import { useListMovimientosAhorro } from '../api/customApi';
import type { MedioPagoSaldo } from '@workspace/api-client-react';

interface MovimientosAhorroModalProps {
  meta: MetaAhorro;
  medios: MedioPagoSaldo[];
  onClose: () => void;
  onAddAporte: () => void;
}

const money = (value = 0) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);

export const MovimientosAhorroModal: React.FC<MovimientosAhorroModalProps> = ({ meta, medios, onClose, onAddAporte }) => {
  const { data: movimientos, isLoading } = useListMovimientosAhorro(meta.id);
  const medioMap = new Map(medios.map((m) => [m.id, m]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="cosmos-card relative max-h-[85vh] w-full max-w-lg overflow-hidden p-6 sm:p-7 shadow-2xl border border-white/15 flex flex-col">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl p-2 text-white/50 hover:bg-white/10 hover:text-white"
        >
          <X size={18} />
        </button>

        <div className="mb-6 flex items-center justify-between pr-8">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
              style={{ backgroundColor: `${meta.color}25` }}
            >
              {meta.icono}
            </div>
            <div>
              <div className="cosmos-eyebrow mb-1">historial de movimientos</div>
              <h2 className="cosmos-title text-xl font-bold">{meta.nombre}</h2>
            </div>
          </div>
        </div>

        {/* Resumen Superior */}
        <div className="mb-4 grid grid-cols-2 gap-3 rounded-2xl bg-white/4 p-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-white/45">Saldo Ahorrado</div>
            <div className="cosmos-number text-xl font-bold text-[#5de8c4]">{money(meta.monto_actual)}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-white/45">Meta Objetivo</div>
            <div className="cosmos-number text-xl font-bold text-white">{money(meta.monto_objetivo)} ({meta.porcentaje}%)</div>
          </div>
        </div>

        {/* Lista de Movimientos */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-white/40">Cargando movimientos...</div>
          ) : !movimientos || movimientos.length === 0 ? (
            <div className="py-12 text-center">
              <PiggyBank size={32} className="mx-auto mb-2 text-white/30" />
              <p className="text-sm font-semibold text-white/70">Aún no hay movimientos</p>
              <p className="text-xs text-white/40 mt-1">Registra tu primer aporte para empezar a construir tu meta.</p>
              <button onClick={onAddAporte} className="cosmos-button-primary mt-4 mx-auto !py-1.5 !px-4 text-xs">
                Aportar ahora
              </button>
            </div>
          ) : (
            movimientos.map((m) => {
              const med = m.medio_pago_id ? medioMap.get(m.medio_pago_id) : null;
              const isAporte = m.tipo === 'aporte';
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-white/3 px-4 py-3 transition hover:bg-white/6"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-xl text-base ${
                        isAporte ? 'bg-[#5de8c4]/15 text-[#5de8c4]' : 'bg-[#e85d4a]/15 text-[#e85d4a]'
                      }`}
                    >
                      {isAporte ? <ArrowUpRight size={17} /> : <ArrowDownLeft size={17} />}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {isAporte ? 'Aporte' : 'Retiro'}
                        {med && <span className="ml-1 text-xs text-white/50">({med.icono} {med.nombre})</span>}
                      </div>
                      <div className="text-xs text-white/45">
                        {m.fecha} {m.nota ? `· ${m.nota}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className={`cosmos-number text-sm font-bold ${isAporte ? 'text-[#5de8c4]' : 'text-[#e85d4a]'}`}>
                    {isAporte ? '+' : '-'}{money(m.monto)}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
          <button onClick={onAddAporte} className="cosmos-button-primary !py-2 !px-4 text-xs">
            + Nuevo Movimiento
          </button>
          <button onClick={onClose} className="cosmos-button-secondary !py-2 !px-4 text-xs">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

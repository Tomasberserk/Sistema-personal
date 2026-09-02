import React, { useState } from 'react';
import { PlusCircle, MinusCircle, X, ArrowRight, Wallet } from 'lucide-react';
import type { MetaAhorro, MovimientoAhorroInput } from '../types/custom';
import type { MedioPagoSaldo } from '@workspace/api-client-react';

interface AporteModalProps {
  meta: MetaAhorro;
  medios: MedioPagoSaldo[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (data: MovimientoAhorroInput) => void;
}

export const AporteModal: React.FC<AporteModalProps> = ({ meta, medios, pending, onClose, onSubmit }) => {
  const [tipo, setTipo] = useState<'aporte' | 'retiro'>('aporte');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [medioPagoId, setMedioPagoId] = useState<number | undefined>(meta.medio_pago_id);
  const [nota, setNota] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(monto);
    if (!val || val <= 0) return;
    onSubmit({
      meta_ahorro_id: meta.id,
      tipo,
      monto: val,
      fecha,
      medio_pago_id: medioPagoId,
      nota,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="cosmos-card relative w-full max-w-md overflow-hidden p-6 sm:p-7 shadow-2xl border border-white/15">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl p-2 text-white/50 hover:bg-white/10 hover:text-white"
        >
          <X size={18} />
        </button>

        <div className="mb-6 flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
            style={{ backgroundColor: `${meta.color}25` }}
          >
            {meta.icono}
          </div>
          <div>
            <div className="cosmos-eyebrow mb-1">movimiento de ahorro</div>
            <h2 className="cosmos-title text-xl font-bold">{meta.nombre}</h2>
          </div>
        </div>

        {/* Tipo: Aporte o Retiro */}
        <div className="mb-6 flex rounded-2xl bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setTipo('aporte')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition ${
              tipo === 'aporte' ? 'bg-[#5de8c4] text-black font-bold' : 'text-white/60 hover:text-white'
            }`}
          >
            <PlusCircle size={14} /> Aportar dinero
          </button>
          <button
            type="button"
            onClick={() => setTipo('retiro')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition ${
              tipo === 'retiro' ? 'bg-[#e85d4a] text-white font-bold' : 'text-white/60 hover:text-white'
            }`}
          >
            <MinusCircle size={14} /> Retirar de ahorro
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="cosmos-field-label">Monto a {tipo === 'aporte' ? 'aportar' : 'retirar'}</label>
            <div className="relative mt-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 font-bold">$</span>
              <input
                type="number"
                min="1"
                step="any"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="50000"
                className="cosmos-input pl-8 text-lg font-bold"
                required
                autoFocus
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="cosmos-field-label">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="cosmos-input"
                required
              />
            </div>

            <div>
              <label className="cosmos-field-label">Medio de Pago</label>
              <select
                value={medioPagoId ?? ''}
                onChange={(e) => setMedioPagoId(e.target.value ? Number(e.target.value) : undefined)}
                className="cosmos-input"
              >
                <option value="">(Cuenta general / Efectivo)</option>
                {medios.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.icono} {m.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="cosmos-field-label">Nota (Opcional)</label>
            <input
              type="text"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej. Quincena, ahorro semanal..."
              className="cosmos-input"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
            <button type="button" onClick={onClose} className="cosmos-button-secondary">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className={`cosmos-button-primary ${tipo === 'retiro' ? '!bg-[#e85d4a] !text-white' : ''}`}
            >
              {pending ? 'Procesando...' : tipo === 'aporte' ? 'Registrar Aporte' : 'Confirmar Retiro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

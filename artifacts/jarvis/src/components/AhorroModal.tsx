import React, { useState, useEffect } from 'react';
import { PiggyBank, X, Target, Calendar, CreditCard, Sparkles } from 'lucide-react';
import type { MetaAhorro, MetaAhorroInput } from '../types/custom';
import type { MedioPagoSaldo } from '@workspace/api-client-react';

const AHORRO_EMOJIS = ['🐷', '🛡️', '🏖️', '🏠', '🚗', '🛵', '💍', '🎓', '✈️', '💻', '💼', '🎁', '⚡', '🌟', '💰'];
const AHORRO_COLORS = ['#5de8c4', '#5d8ae8', '#e8a85d', '#a85de8', '#e85d8a', '#e8d95d', '#5de87a', '#5dc4e8'];

interface AhorroModalProps {
  record: MetaAhorro | null;
  medios: MedioPagoSaldo[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (data: MetaAhorroInput) => void;
}

export const AhorroModal: React.FC<AhorroModalProps> = ({ record, medios, pending, onClose, onSubmit }) => {
  const [nombre, setNombre] = useState(record?.nombre ?? '');
  const [montoObjetivo, setMontoObjetivo] = useState(record?.monto_objetivo?.toString() ?? '');
  const [montoActual, setMontoActual] = useState(record?.monto_actual?.toString() ?? '0');
  const [icono, setIcono] = useState(record?.icono ?? '🐷');
  const [color, setColor] = useState(record?.color ?? '#5de8c4');
  const [fechaLimite, setFechaLimite] = useState(record?.fecha_limite ?? '');
  const [medioPagoId, setMedioPagoId] = useState<number | undefined>(record?.medio_pago_id);
  const [nota, setNota] = useState(record?.nota ?? '');

  useEffect(() => {
    if (record) {
      setNombre(record.nombre);
      setMontoObjetivo(record.monto_objetivo.toString());
      setMontoActual(record.monto_actual.toString());
      setIcono(record.icono);
      setColor(record.color);
      setFechaLimite(record.fecha_limite ?? '');
      setMedioPagoId(record.medio_pago_id);
      setNota(record.nota ?? '');
    }
  }, [record]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const obj = parseFloat(montoObjetivo) || 0;
    const act = parseFloat(montoActual) || 0;
    onSubmit({
      nombre,
      monto_objetivo: obj,
      monto_actual: act,
      icono,
      color,
      fecha_limite: fechaLimite || undefined,
      medio_pago_id: medioPagoId,
      nota,
      activo: true,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="cosmos-card relative max-h-[90vh] w-full max-w-lg overflow-y-auto p-6 sm:p-7 shadow-2xl border border-white/15">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl p-2 text-white/50 hover:bg-white/10 hover:text-white"
        >
          <X size={18} />
        </button>

        <div className="mb-6 flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
            style={{ backgroundColor: `${color}25` }}
          >
            {icono}
          </div>
          <div>
            <div className="cosmos-eyebrow mb-1">fondo de ahorro</div>
            <h2 className="cosmos-title text-2xl font-bold">
              {record ? 'Editar Meta de Ahorro' : 'Nueva Meta de Ahorro'}
            </h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="cosmos-field-label">Nombre de la Meta</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Fondo de emergencia, Vacaciones, Mantenimiento..."
              className="cosmos-input"
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="cosmos-field-label">Monto Objetivo (Meta)</label>
              <div className="relative mt-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 font-bold">$</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={montoObjetivo}
                  onChange={(e) => setMontoObjetivo(e.target.value)}
                  placeholder="1000000"
                  className="cosmos-input pl-8"
                  required
                />
              </div>
            </div>

            <div>
              <label className="cosmos-field-label">Saldo Inicial / Ahorrado</label>
              <div className="relative mt-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 font-bold">$</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={montoActual}
                  onChange={(e) => setMontoActual(e.target.value)}
                  placeholder="0"
                  className="cosmos-input pl-8"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="cosmos-field-label">Fecha Límite (Opcional)</label>
              <input
                type="date"
                value={fechaLimite}
                onChange={(e) => setFechaLimite(e.target.value)}
                className="cosmos-input"
              />
            </div>

            <div>
              <label className="cosmos-field-label">Medio de Depósito Asociado</label>
              <select
                value={medioPagoId ?? ''}
                onChange={(e) => setMedioPagoId(e.target.value ? Number(e.target.value) : undefined)}
                className="cosmos-input"
              >
                <option value="">Sin asociar (Cuenta general)</option>
                {medios.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.icono} {m.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="cosmos-field-label mb-1.5 block">Ícono</label>
            <div className="flex flex-wrap gap-2">
              {AHORRO_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setIcono(em)}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg transition ${
                    icono === em ? 'bg-white/20 ring-2 ring-[#5de8c4]' : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="cosmos-field-label mb-1.5 block">Color Distintivo</label>
            <div className="flex flex-wrap gap-2">
              {AHORRO_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full transition ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : 'opacity-70 hover:opacity-100'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="cosmos-field-label">Nota o Plan (Opcional)</label>
            <input
              type="text"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej. Aporte de $50.000 quincenal"
              className="cosmos-input"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
            <button type="button" onClick={onClose} className="cosmos-button-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={pending} className="cosmos-button-primary">
              {pending ? 'Guardando...' : record ? 'Actualizar Meta' : 'Crear Meta de Ahorro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

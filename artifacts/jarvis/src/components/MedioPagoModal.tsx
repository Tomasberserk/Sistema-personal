import React, { useState, useEffect } from 'react';
import { X, Save, RefreshCw } from 'lucide-react';
import type { MedioPago, MedioPagoSaldo, MedioPagoTipo } from '@workspace/api-client-react';

const MEDIO_EMOJIS = ['💵', '🪙', '🏦', '📱', '📲', '💳', '💰', '🐖', '💼', '💎', '🏧', '🔒'];
const MEDIO_COLORS = ['#5de87a', '#5de8c4', '#5d8ae8', '#e85d4a', '#a85de8', '#e8d95d', '#e8a85d', '#e85d8a', '#5dc4e8', '#b7e85d'];

const TIPOS_MEDIO: { id: MedioPagoTipo; label: string; icon: string; desc: string }[] = [
  { id: 'billetera_digital', label: 'Billetera Digital', icon: '📱', desc: 'Nequi, Daviplata, Dale, etc.' },
  { id: 'cuenta_bancaria', label: 'Cuenta Bancaria', icon: '🏦', desc: 'Bancolombia, Davivienda, etc.' },
  { id: 'efectivo_billetes', label: 'Efectivo (Billetes)', icon: '💵', desc: 'Billetes en cartera o bolsillo' },
  { id: 'efectivo_monedas', label: 'Efectivo (Monedas)', icon: '🪙', desc: 'Monedas sueltas o alcancía' },
  { id: 'tarjeta', label: 'Tarjeta', icon: '💳', desc: 'Crédito o débito' },
  { id: 'otro', label: 'Otro Medio', icon: '📦', desc: 'Inversión, cripto, etc.' },
];

interface MedioPagoModalProps {
  record: MedioPago | MedioPagoSaldo | null;
  pending: boolean;
  onClose: () => void;
  onSwitchToCategoria?: () => void;
  onSubmit: (data: {
    nombre: string;
    tipo: MedioPagoTipo;
    icono: string;
    color: string;
    saldo_inicial: number;
    activo: boolean;
  }) => void;
}

export const MedioPagoModal: React.FC<MedioPagoModalProps> = ({ record, pending, onClose, onSwitchToCategoria, onSubmit }) => {
  const [nombre, setNombre] = useState(record?.nombre ?? '');
  const [tipo, setTipo] = useState<MedioPagoTipo>(record?.tipo ?? 'billetera_digital');
  const [icono, setIcono] = useState(record?.icono ?? '📱');
  const [color, setColor] = useState(record?.color ?? '#a85de8');
  const [saldoInicial, setSaldoInicial] = useState<string>(record?.saldo_inicial?.toString() ?? '0');
  const [activo, setActivo] = useState(record?.activo ?? true);

  useEffect(() => {
    if (record) {
      setNombre(record.nombre);
      setTipo(record.tipo);
      setIcono(record.icono);
      setColor(record.color);
      setSaldoInicial(record.saldo_inicial.toString());
      setActivo(record.activo);
    }
  }, [record]);

  const handleSelectTipo = (t: MedioPagoTipo) => {
    setTipo(t);
    const tipoMeta = TIPOS_MEDIO.find((m) => m.id === t);
    if (tipoMeta && !record) {
      setIcono(tipoMeta.icon);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNombre = nombre.trim();
    if (!cleanNombre) return;

    onSubmit({
      nombre: cleanNombre,
      tipo,
      icono,
      color,
      saldo_inicial: parseFloat(saldoInicial) || 0,
      activo,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="cosmos-card max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] p-5 pb-24 shadow-2xl sm:rounded-[28px] sm:p-7 sm:pb-7"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="mb-6 flex items-center justify-between border-b border-white/6 pb-4">
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-inner"
                style={{ backgroundColor: `${color}25` }}
              >
                {icono}
              </div>
              <div>
                <div className="cosmos-eyebrow mb-0.5">donde está tu plata</div>
                <h2 className="cosmos-title text-xl font-bold sm:text-2xl">
                  {record ? 'Editar cuenta o medio' : 'Nueva cuenta o medio'}
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={pending}
                type="submit"
                data-testid="button-save-medio-top"
                className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-black shadow-lg transition hover:bg-white/90 disabled:opacity-50"
              >
                {pending ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                {pending ? '...' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={onClose}
                data-testid="button-close-medio-modal"
                className="rounded-xl p-2 text-white/55 hover:bg-white/8 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {!record && onSwitchToCategoria && (
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/6 p-1 text-xs">
              <button
                type="button"
                onClick={onSwitchToCategoria}
                className="rounded-lg py-2 font-medium text-white/60 transition hover:bg-white/5 hover:text-white"
              >
                🏷️ Categoría de Gasto / Ingreso
              </button>
              <button
                type="button"
                className="rounded-lg py-2 font-bold transition bg-white text-black shadow"
              >
                💳 Medio de Pago / Cuenta
              </button>
            </div>
          )}

          <label className="block">
            <span className="cosmos-field-label">Nombre del medio o cuenta</span>
            <input
              required
              className="cosmos-input"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Bancolombia Principal, Nequi, Efectivo bolsillo, Daviplata..."
              data-testid="input-medio-nombre"
            />
          </label>

          <div>
            <span className="cosmos-field-label">Categoría o tipo de medio de pago</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TIPOS_MEDIO.map((t) => {
                const selected = tipo === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelectTipo(t.id)}
                    className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition ${
                      selected
                        ? 'border-white/30 bg-white/10 text-white shadow-md'
                        : 'border-white/5 bg-white/4 text-white/60 hover:border-white/15 hover:bg-white/7 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <span>{t.icon}</span>
                      <span className="truncate">{t.label}</span>
                    </div>
                    <span className="mt-1 text-[10px] text-white/40 leading-tight">{t.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block">
            <span className="cosmos-field-label">¿Con cuánto saldo arrancas en este medio? (COP)</span>
            <div className="relative mt-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 font-bold">$</span>
              <input
                type="number"
                min="0"
                step="any"
                className="cosmos-input pl-8"
                value={saldoInicial}
                onChange={(e) => setSaldoInicial(e.target.value)}
                placeholder="0"
                data-testid="input-medio-saldo-inicial"
              />
            </div>
            <span className="mt-1 block text-[11px] text-white/40">
              Es el balance que tienes hoy en esta cuenta. Los ingresos y gastos modificarán este saldo automáticamente.
            </span>
          </label>

          <div>
            <span className="cosmos-field-label">Icono representativo</span>
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
              {MEDIO_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcono(emoji)}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg transition ${
                    icono === emoji ? 'bg-white text-black' : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="cosmos-field-label">Color distintivo</span>
            <div className="flex flex-wrap gap-2">
              {MEDIO_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={c}
                  className={`h-8 w-8 rounded-full transition ${
                    color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0a0a0a]' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
            <div>
              <div className="text-sm font-medium text-white/80">Cuenta / Medio activo</div>
              <div className="text-xs text-white/40">Disponible para registrar ingresos, gastos y transferencias</div>
            </div>
            <button
              type="button"
              onClick={() => setActivo(!activo)}
              data-testid="toggle-medio-activo"
              className={`relative h-6 w-11 rounded-full transition ${activo ? 'bg-[#5de87a]' : 'bg-white/15'}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-black transition-all ${
                  activo ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

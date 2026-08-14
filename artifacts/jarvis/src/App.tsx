import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Route, Switch, useLocation } from 'wouter';
import { toast } from 'sonner';
import {
  Activity, ArrowDownLeft, ArrowUpRight, Bike, CalendarCheck, CalendarClock, CalendarDays, Check, ChevronLeft, ChevronRight,
  CircleDollarSign, Clock, Droplets, Flame, Gauge, LayoutGrid, List, Pencil, Plus, Receipt, RefreshCw, Save, Settings2, Tags, Timer,
  Trash2, TrendingUp, TriangleAlert, Wrench, X, Wallet, ArrowRightLeft, Landmark, CreditCard,
} from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  useHealthCheck, useListIngresos, useCreateIngreso, useGetIngreso, useUpdateIngreso, useDeleteIngreso,
  useListGastosFijos, useCreateGastoFijo, useGetGastoFijo, useUpdateGastoFijo, useDeleteGastoFijo,
  useListGastosVariables, useCreateGastoVariable, useGetGastoVariable, useUpdateGastoVariable, useDeleteGastoVariable,
  useListKilometrajes, useCreateKilometraje, useGetKilometraje, useUpdateKilometraje, useDeleteKilometraje,
  useGetKilometrajeResumen,
  useGetResumenMesActual, useListCategorias, useCreateCategoria, useUpdateCategoria, useDeleteCategoria,
  useGetResumenMensualPorCategoria,
  getListIngresosQueryKey, getListGastosFijosQueryKey, getListGastosVariablesQueryKey,
  getListKilometrajesQueryKey, getGetKilometrajeResumenQueryKey, getGetResumenMesActualQueryKey, getListCategoriasQueryKey,
  getGetResumenMensualPorCategoriaQueryKey, getGetMotoEstadoAceiteQueryKey,
  useGetMotoEstadoAceite, usePostMotoCambioAceite, usePutMotoConfig,
  useListHabitos, useCreateHabito, useUpdateHabito, useDeleteHabito, useGetResumenHabitos, useToggleHabitoFecha,
  getListHabitosQueryKey, getGetResumenHabitosQueryKey,
  useListBloquesRutina, useCreateBloqueRutina, useGetRutinaSemana, useGetRutinaDia, useUpdateBloqueRutina, useDeleteBloqueRutina,
  getListBloquesRutinaQueryKey, getGetRutinaSemanaQueryKey, getGetRutinaDiaQueryKey,
  useListMediosPago, useCreateMedioPago, useUpdateMedioPago, useDeleteMedioPago, getListMediosPagoQueryKey,
  useListTransferencias, useCreateTransferencia, useDeleteTransferencia, getListTransferenciasQueryKey,
} from '@workspace/api-client-react';
import type { BloqueRutina, Categoria, DiaRutina, EstadoAceite, GastoFijo, GastoVariable, Habito, HabitoResumenItem, Ingreso, Kilometraje, MedioPago, MedioPagoSaldo, ResumenCategoria, TransferenciaMedio } from '@workspace/api-client-react';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

const queryClient = new QueryClient();
type ModalKind = 'ingreso' | 'variable' | 'fijo' | 'km' | null;
type AnyRecord = Ingreso | GastoVariable | GastoFijo | Kilometraje;

const money = (value = 0) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
const asList = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') {
    const box = value as Record<string, unknown>;
    for (const key of ['data', 'items', 'records', 'results'] as const) {
      if (Array.isArray(box[key])) return box[key] as T[];
    }
  }
  return [];
};
const dateValue = (date?: string) => date ? date.slice(0, 10) : new Date().toISOString().slice(0, 10);
const dateLabel = (date?: string) => date ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(`${date.slice(0, 10)}T12:00:00`)) : 'Sin fecha';
const monthLabel = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(new Date());
const sourceLabel: Record<string, string> = { Didi: 'Didi', papa: 'Papá', amigo: 'Amigo', otro: 'Otro' };

const CATEGORY_EMOJIS = ['🍔', '🍕', '🥗', '☕', '🍺', '🛵', '🚗', '🚌', '⛽', '🎮', '🎬', '🎧', '📚', '💻', '📱', '👕', '💊', '🧴', '🎁', '🏠', '✨', '🐾', '✈️', '💰', '📦', '🧾'];
const CATEGORY_COLORS = ['#e85d4a', '#5d8ae8', '#e8a85d', '#a85de8', '#5de8c4', '#e85d8a', '#e8d95d', '#5de87a', '#5dc4e8', '#e8755d', '#8a8aa0', '#b7e85d', '#e85dd3', '#5de8dd'];
const FALLBACK_CAT = { icono: '🏷️', color: '#9aa0a6', nombre: 'Sin categoría' };
const HABITO_EMOJIS = ['✅', '🏃', '💧', '📖', '🧘', '🥗', '💪', '🛌', '🚭', '💰', '🧹', '✍️', '🎯', '🌅', '🚴', '🧠', '🙏', '🎸', '🐕', '☀️'];
const HABITO_COLORS = ['#5de8c4', '#5d8ae8', '#e8a85d', '#a85de8', '#e85d4a', '#5de87a', '#5dc4e8', '#e85dd3', '#e8d95d', '#8a8aa0'];
const RUTINA_DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const RUTINA_DIAS_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const RUTINA_EMOJIS = ['🐕', '🍳', '💪', '📚', '🍽️', '🕐', '🛁', '🏫', '⏰', '🧘', '🚿', '🛌', '📖', '💻', '🎮', '🏃', '🥗', '☕', '🚌', '🏠', '✨'];
const RUTINA_COLORS = ['#5d8ae8', '#e8a85d', '#e85d4a', '#a85de8', '#5de87a', '#e8d95d', '#5dc4e8', '#e85d8a', '#5de8c4', '#8a8aa0'];
const hoyIdx = () => (new Date().getDay() + 6) % 7;
const horaAhora = () => new Date().toTimeString().slice(0, 5);

function DetailPrefetchers({ ids }: { ids: { ingreso?: number; fijo?: number; variable?: number; km?: number } }) {
  useHealthCheck({ query: { enabled: false, queryKey: ['/api/healthz'] } });
  useGetIngreso(ids.ingreso ?? 0, { query: { enabled: Boolean(ids.ingreso), queryKey: [`/api/ingresos/${ids.ingreso ?? 0}`] } });
  useGetGastoFijo(ids.fijo ?? 0, { query: { enabled: Boolean(ids.fijo), queryKey: [`/api/gastos-fijos/${ids.fijo ?? 0}`] } });
  useGetGastoVariable(ids.variable ?? 0, { query: { enabled: Boolean(ids.variable), queryKey: [`/api/gastos-variables/${ids.variable ?? 0}`] } });
  useGetKilometraje(ids.km ?? 0, { query: { enabled: Boolean(ids.km), queryKey: [`/api/kilometrajes/${ids.km ?? 0}`] } });
  return null;
}

function CosmosBackground() {
  return (
    <>
      <div className="cosmos-blob left-[-140px] top-[-120px] h-[380px] w-[380px]" />
      <div className="cosmos-blob right-[-130px] top-[30%] h-[420px] w-[420px]" />
      <div className="cosmos-blob bottom-[-180px] left-[18%] h-[400px] w-[400px]" />
      <div className="cosmos-grain" />
    </>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  return (
    <div className="relative min-h-[100dvh] overflow-x-clip bg-background text-foreground">
      <CosmosBackground />
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[236px] flex-col border-r border-white/5 bg-black/30 px-5 py-7 backdrop-blur-xl md:flex">
        <div className="mb-12 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black"><Activity size={19} strokeWidth={2.6} /></div>
          <div><div className="cosmos-eyebrow">personal</div><div className="cosmos-title text-xl font-bold">jarvis</div></div>
        </div>
        <nav className="space-y-2">
          <NavItem href="/" active={location === '/'} icon={<CircleDollarSign size={18} />} label="Resumen" testId="link-resumen" />
          <NavItem href="/kilometraje" active={location === '/kilometraje'} icon={<Bike size={18} />} label="Kilometraje" testId="link-kilometraje" />
          <NavItem href="/habitos" active={location === '/habitos'} icon={<Flame size={18} />} label="Hábitos" testId="link-habitos" />
          <NavItem href="/rutina" active={location === '/rutina'} icon={<CalendarClock size={18} />} label="Rutina" testId="link-rutina" />
          <NavItem href="/moto" active={location === '/moto'} icon={<Droplets size={18} />} label="Moto" testId="link-moto" />
          <NavItem href="/categorias" active={location === '/categorias'} icon={<Tags size={18} />} label="Categorías" testId="link-categorias" />
        </nav>
        <div className="mt-auto space-y-5">
          <div className="cosmos-card px-4 py-4">
            <div className="mb-2 flex items-center gap-2 text-white/80"><Gauge size={15} /><span className="cosmos-eyebrow">tu ritmo</span></div>
            <p className="text-sm leading-5 text-white/50">Cada categoría con su color. Así se lee el mes de un vistazo.</p>
          </div>
          <div className="flex items-center gap-2 px-2 text-white/40"><Settings2 size={15} /><span className="text-xs">Tu espacio financiero</span></div>
        </div>
      </aside>
      <main className="md:pl-[236px]">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-[70px] items-center justify-around border-t border-white/5 bg-[#0a0a0a]/85 px-6 backdrop-blur-xl md:hidden">
        <NavItem href="/" active={location === '/'} icon={<CircleDollarSign size={20} />} label="Resumen" testId="mobile-link-resumen" />
        <NavItem href="/kilometraje" active={location === '/kilometraje'} icon={<Bike size={20} />} label="Km" testId="mobile-link-kilometraje" />
        <NavItem href="/habitos" active={location === '/habitos'} icon={<Flame size={20} />} label="Hábitos" testId="mobile-link-habitos" />
        <NavItem href="/rutina" active={location === '/rutina'} icon={<CalendarClock size={20} />} label="Rutina" testId="mobile-link-rutina" />
        <NavItem href="/moto" active={location === '/moto'} icon={<Droplets size={20} />} label="Moto" testId="mobile-link-moto" />
        <NavItem href="/categorias" active={location === '/categorias'} icon={<Tags size={20} />} label="Cat." testId="mobile-link-categorias" />
      </nav>
    </div>
  );
}

function NavItem({ href, active, icon, label, testId }: { href: string; active: boolean; icon: React.ReactNode; label: string; testId: string }) {
  return (
    <Link href={href} data-testid={testId} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? 'bg-white/8 text-white' : 'text-white/55 hover:bg-white/4 hover:text-white'} md:w-full md:justify-start`}>
      {icon}<span className="md:inline">{label}</span>
    </Link>
  );
}

function Topbar({ title, eyebrow, onAdd }: { title: string; eyebrow: string; onAdd?: () => void }) {
  return (
    <header className="relative z-10 mx-auto flex max-w-[1180px] items-start justify-between px-5 pb-7 pt-8 sm:px-8 md:px-10 md:pt-12">
      <div>
        <div className="cosmos-eyebrow mb-3">{eyebrow}</div>
        <h1 className="cosmos-title text-3xl font-semibold leading-tight sm:text-4xl">{title}</h1>
      </div>
      {onAdd && <button onClick={onAdd} data-testid="button-add-record" className="cosmos-button-primary shrink-0"><Plus size={17} /><span className="hidden sm:inline">Registrar</span></button>}
    </header>
  );
}

function Metric({ label, value, icon, note, tone = 'default' }: { label: string; value: string; icon: React.ReactNode; note?: string; tone?: 'default' | 'green' | 'warm' }) {
  const accent = tone === 'green' ? '#5de8c4' : tone === 'warm' ? '#e8a85d' : '#ffffff';
  return (
    <div className="cosmos-card relative overflow-hidden p-[22px]">
      <div className="mb-5 flex items-center justify-between" style={{ color: accent }}>
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-80">{label}</span>
        <span>{icon}</span>
      </div>
      <div data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`} className="cosmos-number text-[28px] font-bold leading-none text-white sm:text-3xl">{value}</div>
      {note && <div className="mt-2 text-xs leading-5 text-white/45">{note}</div>}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl bg-white/4 px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">{label}</div>
      <div className="cosmos-number mt-1 text-lg font-bold" style={{ color: accent ?? '#ffffff' }}>{value}</div>
    </div>
  );
}

function oilTone(pct: number): { color: string; label: string } {
  if (pct > 50) return { color: '#5de8c4', label: 'Aceite en buen estado' };
  if (pct >= 20) return { color: '#e8d95d', label: 'Se acerca el cambio' };
  return { color: '#e85d4a', label: 'Cambio de aceite pendiente' };
}

function EmptyState({ title, copy, action, onClick, testId }: { title: string; copy: string; action: string; onClick: () => void; testId: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 px-5 py-9 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/6 text-white/50"><Receipt size={19} /></div>
      <p className="font-semibold text-white/90">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-white/45">{copy}</p>
      <button onClick={onClick} data-testid={testId} className="mt-5 text-sm font-semibold text-white underline decoration-white/25 underline-offset-4 hover:decoration-white">{action}</button>
    </div>
  );
}

function RowActions({ onEdit, onDelete, id }: { onEdit: () => void; onDelete: () => void; id: number }) {
  return (
    <div className="flex items-center gap-1 opacity-60 transition group-hover:opacity-100">
      <button onClick={onEdit} data-testid={`button-edit-${id}`} aria-label="Editar registro" className="rounded-lg p-2 text-white/55 hover:bg-white/8 hover:text-white"><Pencil size={15} /></button>
      <button onClick={onDelete} data-testid={`button-delete-${id}`} aria-label="Eliminar registro" className="rounded-lg p-2 text-white/55 hover:bg-red-500/10 hover:text-red-400"><Trash2 size={15} /></button>
    </div>
  );
}

function ListCard({ title, kicker, action, children }: { title: string; kicker: string; action: () => void; children: React.ReactNode }) {
  return (
    <section className="cosmos-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/6 px-5 py-4 sm:px-6">
        <div>
          <div className="cosmos-eyebrow mb-1">{kicker}</div>
          <h2 className="cosmos-title text-lg font-bold">{title}</h2>
        </div>
        <button onClick={action} data-testid={`button-add-${kicker.toLowerCase().replaceAll(' ', '-')}`} className="flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-white/6"><Plus size={16} /> <span className="hidden sm:inline">Añadir</span></button>
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </section>
  );
}

function LoadingRows() { return <div className="space-y-3 p-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-white/5" />)}</div>; }

function DonutTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ResumenCategoria }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return <div className="cosmos-card px-3 py-2 text-sm text-white shadow-xl">{d.icono} <span className="font-semibold">{d.nombre}</span> · {money(d.total)} · <span style={{ color: d.color }}>{d.porcentaje}%</span></div>;
}

function CategoryDonut({ data }: { data: ResumenCategoria[] }) {
  const total = data.reduce((a, x) => a + x.total, 0);
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-stretch">
      <div className="relative h-[220px] w-full max-w-[260px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="total" nameKey="nombre" innerRadius={66} outerRadius={96} paddingAngle={3} stroke="none" startAngle={90} endAngle={-270}>
              {data.map((d) => <Cell key={d.id} fill={d.color} />)}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="cosmos-eyebrow mb-1">gasto variable</div>
          <div className="cosmos-number text-2xl font-bold text-white">{money(total)}</div>
        </div>
      </div>
      <div className="grid flex-1 content-center gap-2.5 sm:pr-2">
        {data.slice(0, 5).map((d) => (
          <div key={d.id} className="flex items-center gap-3 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="truncate text-white/80">{d.icono} {d.nombre}</span>
            <span className="cosmos-number ml-auto font-semibold text-white/90">{d.porcentaje}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryBars({ data }: { data: ResumenCategoria[] }) {
  if (!data.length) {
    return <div className="py-6 text-center text-sm text-white/45">Todavía no hay gastos variables este mes.</div>;
  }
  return (
    <div className="space-y-5">
      {data.map((d) => (
        <div key={d.id}>
          <div className="mb-1.5 flex items-end justify-between gap-3 text-sm">
            <span className="truncate font-medium text-white/85">{d.icono} {d.nombre}</span>
            <span className="cosmos-number shrink-0 text-white/60">{money(d.total)} <span className="ml-1 text-xs" style={{ color: d.color }}>{d.porcentaje}%</span></span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/6">
            <div className="h-full rounded-full" style={{ width: `${Math.min(d.porcentaje, 100)}%`, backgroundColor: d.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Dashboard() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<ModalKind | 'transferencia'>(null);
  const [editing, setEditing] = useState<AnyRecord | null>(null);
  const ingresos = useListIngresos(); const fijos = useListGastosFijos(); const variables = useListGastosVariables();
  const categorias = useListCategorias();
  const medios = useListMediosPago();
  const summary = useGetResumenMesActual();
  const porCategoria = useGetResumenMensualPorCategoria();
  const createIngreso = useCreateIngreso(); const updateIngreso = useUpdateIngreso(); const deleteIngreso = useDeleteIngreso();
  const createFijo = useCreateGastoFijo(); const updateFijo = useUpdateGastoFijo(); const deleteFijo = useDeleteGastoFijo();
  const createVariable = useCreateGastoVariable(); const updateVariable = useUpdateGastoVariable(); const deleteVariable = useDeleteGastoVariable();
  const createTransferencia = useCreateTransferencia();

  const ids = {
    ingreso: editing && 'fuente' in editing ? editing.id : undefined,
    fijo: editing && 'activo' in editing ? editing.id : undefined,
    variable: editing && 'categoria_id' in editing ? editing.id : undefined,
  };
  const ingresosList = asList<Ingreso>(ingresos.data);
  const fijosList = asList<GastoFijo>(fijos.data);
  const variablesList = asList<GastoVariable>(variables.data);
  const categoriasList = asList<Categoria>(categorias.data);
  const mediosList = asList<MedioPagoSaldo>(medios.data);
  const pieData = asList<ResumenCategoria>(porCategoria.data);
  const catMap = useMemo(() => new Map(categoriasList.map((c) => [c.id, c])), [categoriasList]);
  const medioMap = useMemo(() => new Map(mediosList.map((m) => [m.id, m])), [mediosList]);
  const catsForModal = useMemo(() => categoriasList.filter((c) => c.activa), [categoriasList]);
  const totals = useMemo(() => ({
    income: ingresosList.filter((x) => x.fecha.slice(0, 7) === new Date().toISOString().slice(0, 7)).reduce((a, x) => a + x.monto, 0),
    fixed: fijosList.filter((x) => x.activo).reduce((a, x) => a + x.monto, 0),
    variable: variablesList.filter((x) => x.fecha.slice(0, 7) === new Date().toISOString().slice(0, 7)).reduce((a, x) => a + x.monto, 0),
  }), [ingresosList, fijosList, variablesList]);
  const sum = summary.data ?? {
    total_ingresos: totals.income,
    total_gastos_fijos: totals.fixed,
    total_gastos_variables: totals.variable,
    saldo: totals.income - totals.fixed - totals.variable,
    saldo_total_medios: mediosList.filter((m) => m.activo).reduce((acc, m) => acc + m.saldo_actual, 0),
    saldos_medios: mediosList,
  };
  const totalEnMedios = sum.saldo_total_medios ?? mediosList.filter((m) => m.activo).reduce((acc, m) => acc + m.saldo_actual, 0);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListIngresosQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListGastosFijosQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListGastosVariablesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetResumenMesActualQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetResumenMensualPorCategoriaQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListMediosPagoQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListTransferenciasQueryKey() });
  };
  const close = () => { setModal(null); setEditing(null); };
  const submit = (data: Record<string, unknown>) => {
    const done = () => { invalidate(); close(); };
    if (modal === 'ingreso') editing ? updateIngreso.mutate({ id: editing.id, data: data as never }, { onSuccess: done }) : createIngreso.mutate({ data: data as never }, { onSuccess: done });
    if (modal === 'variable') editing ? updateVariable.mutate({ id: editing.id, data: data as never }, { onSuccess: done }) : createVariable.mutate({ data: data as never }, { onSuccess: done });
    if (modal === 'fijo') editing ? updateFijo.mutate({ id: editing.id, data: data as never }, { onSuccess: done }) : createFijo.mutate({ data: data as never }, { onSuccess: done });
    if (modal === 'transferencia') {
      createTransferencia.mutate(
        { data: data as never },
        {
          onSuccess: () => { done(); toast.success('Transferencia realizada'); },
          onError: (e: unknown) => toast.error((e as { detail?: string })?.detail ?? 'No se pudo registrar la transferencia'),
        }
      );
    }
  };
  const remove = (kind: ModalKind, id: number) => {
    if (!window.confirm('¿Eliminar este registro?')) return;
    const done = invalidate;
    if (kind === 'ingreso') deleteIngreso.mutate({ id }, { onSuccess: done });
    if (kind === 'variable') deleteVariable.mutate({ id }, { onSuccess: done });
    if (kind === 'fijo') deleteFijo.mutate({ id }, { onSuccess: done });
  };
  return <Shell>
    <div className="relative z-10 min-h-[100dvh]">
      <Topbar eyebrow={`visión de ${monthLabel}`} title="Que tu dinero te siga el paso." onAdd={() => setModal('ingreso')} />
      <div className="mx-auto max-w-[1180px] space-y-5 px-5 pb-28 sm:px-8 md:px-10">
        <div className="grid gap-4 sm:grid-cols-4">
          <Metric label="Dinero disponible" value={money(totalEnMedios)} icon={<Wallet size={19} />} tone="green" note="Saldo real en todos tus medios" />
          <Metric label="Saldo del mes" value={money(sum.saldo)} icon={<TrendingUp size={19} />} note={sum.saldo >= 0 ? 'Margen positivo del mes' : 'Ajusta el ritmo esta semana'} />
          <Metric label="Ingresos" value={money(sum.total_ingresos)} icon={<ArrowUpRight size={19} />} tone="warm" note={`${ingresosList.length} entradas este mes`} />
          <Metric label="Gastos" value={money(sum.total_gastos_fijos + sum.total_gastos_variables)} icon={<ArrowDownLeft size={19} />} note={`${money(sum.total_gastos_fijos)} fijos · ${money(sum.total_gastos_variables)} variables`} />
        </div>

        {/* Sección Medios de Dinero */}
        <section className="cosmos-card px-5 py-6 sm:px-7">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="cosmos-eyebrow mb-1">donde está tu plata</div>
              <h2 className="cosmos-title text-xl font-bold">Medios de dinero y cuentas</h2>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setModal('transferencia')} data-testid="button-open-transferencia" className="cosmos-button-secondary !py-2 !px-3 text-xs">
                <ArrowRightLeft size={14} /> Mover entre cuentas
              </button>
            </div>
          </div>
          {medios.isLoading ? <LoadingRows /> : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {mediosList.map((m) => (
                <div key={m.id} data-testid={`card-medio-${m.id}`} className="rounded-2xl border border-white/5 bg-white/4 p-4 transition hover:bg-white/7">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl text-xl" style={{ backgroundColor: `${m.color}22` }}>
                      {m.icono}
                    </div>
                    <span className="text-xs uppercase tracking-wider text-white/40">{m.tipo.replace('_', ' ')}</span>
                  </div>
                  <div className="mt-3">
                    <div className="text-xs font-medium text-white/60">{m.nombre}</div>
                    <div className="cosmos-number text-lg font-bold text-white mt-0.5">{money(m.saldo_actual)}</div>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2 text-[11px] text-white/45">
                    <span>+{money(m.total_ingresos)}</span>
                    <span className="text-white/30">|</span>
                    <span>-{money(m.total_gastos)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="cosmos-card px-5 py-6 sm:px-7">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="cosmos-eyebrow mb-1">monefy style</div>
              <h2 className="cosmos-title text-xl font-bold">Gasto variable este mes</h2>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-white/6 px-3 py-1 text-xs font-semibold text-white/70"><CalendarDays size={13} /> {monthLabel}</span>
          </div>
          {porCategoria.isLoading ? <LoadingRows /> : pieData.length === 0
            ? <EmptyState title="Sin gastos este mes" copy="Al registrar un gasto variable con su categoría, la dona se arma sola." action="Registrar gasto" onClick={() => setModal('variable')} testId="button-empty-dona" />
            : <CategoryDonut data={pieData} />}
        </section>

        <section className="cosmos-card px-5 py-6 sm:px-7">
          <div className="mb-1"><div className="cosmos-eyebrow mb-1">desglose</div><h2 className="cosmos-title text-xl font-bold">Resumen mensual por categoría</h2></div>
          <div className="mt-6"><CategoryBars data={pieData} /></div>
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <ListCard title="Ingresos" kicker="dinero que llegó" action={() => { setEditing(null); setModal('ingreso'); }}>
            {ingresos.isLoading ? <LoadingRows /> : !ingresosList.length ? <EmptyState title="Todavía no hay ingresos" copy="Anota tu primera jornada para empezar a ver el movimiento." action="Registrar ingreso" onClick={() => setModal('ingreso')} testId="button-empty-ingreso" /> : <div className="space-y-1">{ingresosList.slice(0, 6).map((x) => {
              const med = x.medio_pago_id ? medioMap.get(x.medio_pago_id) : null;
              return <div key={x.id} data-testid={`row-ingreso-${x.id}`} className="group flex items-center justify-between rounded-xl px-2 py-3 transition hover:bg-white/4"><div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#5de8c4]/12 text-[#5de8c4]"><ArrowUpRight size={17} /></div><div className="min-w-0"><div className="truncate text-sm font-semibold text-white/90">{sourceLabel[x.fuente]} {med && <span className="ml-1 text-xs text-white/50">({med.icono} {med.nombre})</span>}</div><div className="text-xs text-white/45">{dateLabel(x.fecha)}{x.nota ? ` · ${x.nota}` : ''}</div></div></div><div className="flex items-center gap-1"><span className="cosmos-number text-sm font-medium text-[#5de8c4]">+{money(x.monto)}</span><RowActions id={x.id} onEdit={() => { setEditing(x); setModal('ingreso'); }} onDelete={() => remove('ingreso', x.id)} /></div></div>;
            })}</div>}
          </ListCard>

          <ListCard title="Gastos variables" kicker="lo que cambia" action={() => { setEditing(null); setModal('variable'); }}>
            {variables.isLoading ? <LoadingRows /> : !variablesList.length ? <EmptyState title="Dale nombre a cada salida" copy="Comida, gasolina, una reparación: todo cuenta para entender tu ruta." action="Registrar gasto variable" onClick={() => setModal('variable')} testId="button-empty-variable" /> : <div className="space-y-1">{variablesList.slice(0, 8).map((x) => {
              const cat = catMap.get(x.categoria_id) ?? FALLBACK_CAT;
              const med = x.medio_pago_id ? medioMap.get(x.medio_pago_id) : null;
              return <div key={x.id} data-testid={`row-variable-${x.id}`} className="group flex items-center justify-between rounded-xl px-2 py-3 transition hover:bg-white/4"><div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base" style={{ backgroundColor: `${cat.color}26` }}>{cat.icono}</div><div className="min-w-0"><div className="truncate text-sm font-semibold text-white">{cat.nombre} {med && <span className="ml-1 text-xs text-white/50">({med.icono} {med.nombre})</span>}</div><div className="text-xs text-white/45">{dateLabel(x.fecha)}{x.nota ? ` · ${x.nota}` : ''}</div></div></div><div className="flex items-center gap-1"><span className="cosmos-number text-sm font-semibold" style={{ color: cat.color }}>-{money(x.monto)}</span><RowActions id={x.id} onEdit={() => { setEditing(x); setModal('variable'); }} onDelete={() => remove('variable', x.id)} /></div></div>;
            })}</div>}</ListCard>
        </div>

        <ListCard title="Gastos fijos" kicker="lo que sostiene el mes" action={() => { setEditing(null); setModal('fijo'); }}>
          {fijos.isLoading ? <LoadingRows /> : !fijosList.length ? <EmptyState title="Aún no has añadido compromisos" copy="Agrega renta, plan o cualquier gasto que quieras tener presente." action="Añadir gasto fijo" onClick={() => setModal('fijo')} testId="button-empty-fijo" /> : <div className="grid gap-1 sm:grid-cols-2">{fijosList.map((x) => <div key={x.id} data-testid={`row-fijo-${x.id}`} className="group flex items-center justify-between rounded-xl px-2 py-3 transition hover:bg-white/4"><div className="flex items-center gap-3"><div><div className="text-sm font-semibold text-white">{x.nombre}</div><div className="text-xs text-white/45">{x.tipo === 'mensual' ? 'Mensual' : 'Por kilometraje'} · <span className={x.activo ? 'text-[#5de8c4]' : 'text-white/40'}>{x.activo ? 'Activo' : 'Pausado'}</span></div></div></div><div className="flex items-center gap-1"><span className="cosmos-number text-sm text-white/80">{money(x.monto)}</span><RowActions id={x.id} onEdit={() => { setEditing(x); setModal('fijo'); }} onDelete={() => remove('fijo', x.id)} /></div></div>)}</div>}
        </ListCard>
      </div>
      <DetailPrefetchers ids={ids} />
      {modal === 'transferencia' && (
        <TransferenciaModal
          medios={mediosList}
          pending={createTransferencia.isPending}
          onClose={close}
          onSubmit={submit}
        />
      )}
      {modal && modal !== 'transferencia' && (
        <RecordModal
          kind={modal}
          record={editing}
          categorias={catsForModal}
          medios={mediosList}
          pending={createIngreso.isPending || updateIngreso.isPending || createVariable.isPending || updateVariable.isPending || createFijo.isPending || updateFijo.isPending}
          onClose={close}
          onSubmit={submit}
        />
      )}
    </div>
  </Shell>;
}

function KilometrajePage() {
  const queryClient = useQueryClient(); const [modal, setModal] = useState(false); const [editing, setEditing] = useState<Kilometraje | null>(null);
  const list = useListKilometrajes(); const resumen = useGetKilometrajeResumen(); const create = useCreateKilometraje(); const update = useUpdateKilometraje(); const removeMutation = useDeleteKilometraje();
  const kms = asList<Kilometraje>(list.data);
  const invalidate = () => { queryClient.invalidateQueries({ queryKey: getListKilometrajesQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetKilometrajeResumenQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetMotoEstadoAceiteQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetResumenMesActualQueryKey() }); };
  const submit = (data: Record<string, unknown>) => { const done = () => { invalidate(); setModal(false); setEditing(null); }; editing ? update.mutate({ id: editing.id, data: data as never }, { onSuccess: done, onError: (e: unknown) => toast.error((e as { detail?: string })?.detail ?? 'No se pudo guardar el registro') }) : create.mutate({ data: data as never }, { onSuccess: done, onError: (e: unknown) => toast.error((e as { detail?: string })?.detail ?? 'No se pudo guardar el registro') }); };
  const remove = (id: number) => { if (window.confirm('¿Eliminar este registro?')) removeMutation.mutate({ id }, { onSuccess: invalidate }); };
  return <Shell><div className="relative z-10 min-h-[100dvh]"><Topbar eyebrow="ruta y mantenimiento" title="Kilometraje" onAdd={() => { setEditing(null); setModal(true); }} /><div className="mx-auto max-w-[1180px] space-y-5 px-5 pb-28 sm:px-8 md:px-10">
    <div className="grid gap-4 sm:grid-cols-3">
      <Metric label="Odómetro actual" value={`${(resumen.data?.km_actuales ?? 0).toLocaleString('es-MX')} km`} icon={<Gauge size={19} />} tone="warm" note="Última lectura del cuenta kilómetros" />
      <Metric label="Jornadas anotadas" value={`${kms.length}`} icon={<CalendarDays size={19} />} note="Cada lectura que registraste" />
      <Metric label="Último registro" value={kms[0] ? dateLabel(kms[0].fecha) : '—'} icon={<Bike size={19} />} note="Fecha de la última lectura" />
    </div>
    <section className="cosmos-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/6 px-5 py-4 sm:px-6"><div><div className="cosmos-eyebrow mb-1">historial</div><h2 className="cosmos-title text-lg font-bold">Tus recorridos</h2></div><button onClick={() => { setEditing(null); setModal(true); }} data-testid="button-add-kilometraje" className="cosmos-button-secondary px-3 py-2 text-sm"><Plus size={16} /> <span className="hidden sm:inline">Registrar</span></button></div>
      <div className="p-3 sm:p-4">
        {list.isLoading ? <LoadingRows /> : !kms.length ? <EmptyState title="Tu primera ruta empieza aquí" copy="Anota los kilómetros del odómetro al terminar tu jornada." action="Registrar kilometraje" onClick={() => setModal(true)} testId="button-empty-kilometraje" /> : <div className="space-y-1">{kms.map((x) => <div key={x.id} data-testid={`row-kilometraje-${x.id}`} className="group flex items-center justify-between rounded-xl px-2 py-3 hover:bg-white/4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/6 text-white/70"><Bike size={17} /></div><div><div className="text-sm font-semibold text-white">{x.km_actuales.toLocaleString('es-MX')} km</div><div className="text-xs text-white/45">{dateLabel(x.fecha)}{x.nota ? ` · ${x.nota}` : ''}</div></div></div><RowActions id={x.id} onEdit={() => { setEditing(x); setModal(true); }} onDelete={() => remove(x.id)} /></div>)}</div>}
      </div>
    </section>
  </div>{modal && <RecordModal kind="km" record={editing} pending={create.isPending || update.isPending} onClose={() => { setModal(false); setEditing(null); }} onSubmit={submit} />}</div></Shell>;
}

function MotoPage() {
  const queryClient = useQueryClient();
  const estado = useGetMotoEstadoAceite();
  const medios = useListMediosPago();
  const changeOil = usePostMotoCambioAceite();
  const saveConfig = usePutMotoConfig();
  const [modalOil, setModalOil] = useState(false);
  const [form, setForm] = useState({ intervalo_km: '2000', alerta_km_antes: '200', km_ultimo_cambio: '0' });
  const [oilForm, setOilForm] = useState({ costo: '60000', medio_pago_id: '', crear_gasto: true, nota: '' });
  const initialized = useRef(false);
  const mediosList = asList<MedioPagoSaldo>(medios.data);
  const applyEstado = (data: EstadoAceite) => setForm({ intervalo_km: String(data.intervalo_km), alerta_km_antes: String(data.alerta_km_antes), km_ultimo_cambio: String(data.km_ultimo_cambio) });
  useEffect(() => {
    if (!initialized.current && estado.data) { initialized.current = true; applyEstado(estado.data); }
  }, [estado.data]);
  useEffect(() => {
    if (mediosList.length > 0 && !oilForm.medio_pago_id) {
      setOilForm((curr) => ({ ...curr, medio_pago_id: String(mediosList[0].id) }));
    }
  }, [mediosList, oilForm.medio_pago_id]);
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetMotoEstadoAceiteQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListGastosVariablesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetResumenMesActualQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetResumenMensualPorCategoriaQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListMediosPagoQueryKey() });
  };
  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const e = estado.data;
  const pct = e?.porcentaje_vida_aceite ?? 0;
  const tone = oilTone(pct);
  const confirmChange = (event: React.FormEvent) => {
    event.preventDefault();
    changeOil.mutate(
      {
        data: {
          costo: oilForm.crear_gasto ? Number(oilForm.costo) : undefined,
          medio_pago_id: (oilForm.crear_gasto && Number(oilForm.medio_pago_id)) ? Number(oilForm.medio_pago_id) : undefined,
          crear_gasto: oilForm.crear_gasto,
          nota: oilForm.nota,
        },
      },
      {
        onSuccess: (data) => {
          applyEstado(data);
          invalidate();
          setModalOil(false);
          toast.success(oilForm.crear_gasto ? 'Cambio de aceite y gasto registrados' : 'Cambio de aceite registrado');
        },
        onError: () => toast.error('No se pudo registrar el cambio de aceite'),
      }
    );
  };
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const intervalo = Number(form.intervalo_km);
    const alerta = Number(form.alerta_km_antes);
    const kmUltimo = Number(form.km_ultimo_cambio);
    if (!Number.isFinite(intervalo) || intervalo < 1) { toast.error('El intervalo debe ser de al menos 1 km'); return; }
    if (!Number.isFinite(alerta) || alerta < 0) { toast.error('La alerta no puede ser negativa'); return; }
    if (!Number.isFinite(kmUltimo) || kmUltimo < 0) { toast.error('El km del último cambio no puede ser negativo'); return; }
    saveConfig.mutate({ data: { intervalo_km: intervalo, alerta_km_antes: alerta, km_ultimo_cambio: kmUltimo } }, {
      onSuccess: (data) => { applyEstado(data); invalidate(); toast.success('Configuración guardada'); },
      onError: () => toast.error('No se pudo guardar la configuración'),
    });
  };
  return <Shell>
    <div className="relative z-10 min-h-[100dvh]">
      <Topbar eyebrow="moto y mantenimiento" title="Estado del aceite" />
      <div className="mx-auto max-w-[1180px] space-y-5 px-5 pb-28 sm:px-8 md:px-10">
        {estado.isLoading ? <LoadingRows /> : !e ? (
          <div className="cosmos-card px-5 py-10 text-center text-sm text-white/45">No se pudo consultar el estado del aceite.</div>
        ) : <>
          {e.alerta && (
            <div className="rounded-2xl border border-[#e85d4a]/35 bg-[#e85d4a]/12 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e85d4a]/20 text-[#ff8a7a]"><TriangleAlert size={18} /></span>
                <div>
                  <p className="text-sm font-bold text-[#ff8a7a]">Cambio de aceite pendiente</p>
                  <p className="text-xs text-white/60">{e.km_restantes <= 0 ? `Te pasaste ${Math.abs(e.km_restantes).toLocaleString('es-MX')} km del cambio en ${e.km_proximo_cambio.toLocaleString('es-MX')} km.` : `Te faltan ${e.km_restantes.toLocaleString('es-MX')} km para el próximo cambio (${e.km_proximo_cambio.toLocaleString('es-MX')} km).`}</p>
                </div>
              </div>
            </div>
          )}

          <section className="cosmos-card overflow-hidden p-6 sm:p-8">
            <div className="flex flex-col items-center gap-8 lg:flex-row">
              <div className="relative h-44 w-44 shrink-0">
                <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="11" />
                  <circle cx="60" cy="60" r="52" fill="none" stroke={tone.color} strokeWidth="11" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="cosmos-number text-4xl font-bold" style={{ color: tone.color }}>{pct}%</div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-white/50">vida útil</div>
                </div>
              </div>
              <div className="w-full flex-1 space-y-5">
                <div>
                  <div className="cosmos-eyebrow mb-1">{tone.label}</div>
                  <h2 className="cosmos-title text-2xl font-bold">Aceite de la moto</h2>
                  <p className="mt-2 text-sm leading-5 text-white/50">El cambio cada {e.intervalo_km.toLocaleString('es-MX')} km cuesta unos 60.000 COP. Mantén el ojo encima para que la moto rinda.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Stat label="Km actuales" value={`${e.km_actuales.toLocaleString('es-MX')} km`} />
                  <Stat label="Próximo cambio" value={`${e.km_proximo_cambio.toLocaleString('es-MX')} km`} />
                  <Stat label="Km restantes" value={e.km_restantes <= 0 ? '0 km' : `${e.km_restantes.toLocaleString('es-MX')} km`} accent={tone.color} />
                </div>
                <button onClick={() => setModalOil(true)} disabled={changeOil.isPending} data-testid="button-cambio-aceite" className="cosmos-button-primary">
                  <Wrench size={17} />
                  Registrar cambio de aceite
                </button>
              </div>
            </div>
          </section>

          {modalOil && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4">
              <div role="dialog" aria-modal="true" className="cosmos-card max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[24px] p-5 shadow-2xl sm:rounded-[24px] sm:p-7">
                <div className="mb-6 flex items-start justify-between">
                  <div>
                    <div className="cosmos-eyebrow mb-1">moto / mantenimiento</div>
                    <h2 className="cosmos-title text-2xl font-bold">Registrar cambio de aceite</h2>
                  </div>
                  <button onClick={() => setModalOil(false)} className="rounded-xl p-2 text-white/55 hover:bg-white/8 hover:text-white"><X size={20} /></button>
                </div>
                <form onSubmit={confirmChange} className="space-y-4">
                  <div className="rounded-xl bg-white/5 p-4 text-sm text-white/70">
                    Se actualizará el odómetro del último cambio al kilometraje actual: <strong className="text-white">{e.km_actuales.toLocaleString('es-MX')} km</strong>.
                  </div>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-white/5 p-3 text-sm font-medium text-white/80">
                    <input
                      type="checkbox"
                      checked={oilForm.crear_gasto}
                      onChange={(ev) => setOilForm((c) => ({ ...c, crear_gasto: ev.target.checked }))}
                      className="h-4 w-4 accent-white"
                    />
                    Registrar automáticamente como gasto en finanzas
                  </label>
                  {oilForm.crear_gasto && (
                    <>
                      <label className="block">
                        <span className="cosmos-field-label">Costo del cambio (COP)</span>
                        <input
                          required
                          type="number"
                          min="0"
                          step="1000"
                          className="cosmos-input"
                          value={oilForm.costo}
                          onChange={(ev) => setOilForm((c) => ({ ...c, costo: ev.target.value }))}
                          placeholder="60000"
                        />
                      </label>
                      {mediosList.length > 0 && (
                        <label className="block">
                          <span className="cosmos-field-label">¿De qué cuenta se pagó?</span>
                          <select
                            className="cosmos-select"
                            value={oilForm.medio_pago_id}
                            onChange={(ev) => setOilForm((c) => ({ ...c, medio_pago_id: ev.target.value }))}
                          >
                            {mediosList.map((m) => (
                              <option key={m.id} value={m.id}>{m.icono} {m.nombre}</option>
                            ))}
                          </select>
                        </label>
                      )}
                      <label className="block">
                        <span className="cosmos-field-label">Nota o marca del aceite (opcional)</span>
                        <input
                          className="cosmos-input"
                          value={oilForm.nota}
                          onChange={(ev) => setOilForm((c) => ({ ...c, nota: ev.target.value }))}
                          placeholder="Ej. Motul 10W-40 semisintético"
                        />
                      </label>
                    </>
                  )}
                  <button disabled={changeOil.isPending} type="submit" className="cosmos-button-primary w-full !py-3.5">
                    {changeOil.isPending ? <RefreshCw size={17} className="animate-spin" /> : <Save />}
                    {changeOil.isPending ? 'Guardando…' : 'Confirmar cambio'}
                  </button>
                </form>
              </div>
            </div>
          )}

          <section className="cosmos-card p-6 sm:p-8">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <div className="cosmos-eyebrow mb-1">configuración</div>
                <h2 className="cosmos-title text-xl font-bold">Notificaciones de mantenimiento</h2>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/6 text-white/70"><Wrench size={17} /></span>
            </div>
            <form onSubmit={save} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="cosmos-field-label">Intervalo (km)</span>
                  <input required min="1" step="100" type="number" className="cosmos-input" value={form.intervalo_km} onChange={(event) => set('intervalo_km', event.target.value)} data-testid="input-moto-intervalo" placeholder="2000" />
                </label>
                <label className="block">
                  <span className="cosmos-field-label">Avisar faltando (km)</span>
                  <input required min="0" step="50" type="number" className="cosmos-input" value={form.alerta_km_antes} onChange={(event) => set('alerta_km_antes', event.target.value)} data-testid="input-moto-alerta" placeholder="200" />
                </label>
                <label className="block">
                  <span className="cosmos-field-label">Último cambio en (km)</span>
                  <input required min="0" step="100" type="number" className="cosmos-input" value={form.km_ultimo_cambio} onChange={(event) => set('km_ultimo_cambio', event.target.value)} data-testid="input-moto-ultimo-cambio" placeholder="0" />
                </label>
              </div>
              <button disabled={saveConfig.isPending} type="submit" data-testid="button-save-moto-config" className="cosmos-button-secondary">
                {saveConfig.isPending ? <Timer size={16} className="animate-spin" /> : <Check size={16} />}
                {saveConfig.isPending ? 'Guardando…' : 'Guardar configuración'}
              </button>
            </form>
          </section>
        </>}
      </div>
    </div>
  </Shell>;
}

const todayIso = () => new Date().toISOString().slice(0, 10);
const shiftIso = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const isoLabel = (iso: string) => new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${iso}T12:00:00`));

function HabitosPage() {
  const queryClient = useQueryClient();
  const today = todayIso();
  const [fecha, setFecha] = useState(today);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Habito | null>(null);
  const resumen = useGetResumenHabitos(fecha);
  const list = useListHabitos();
  const toggle = useToggleHabitoFecha();
  const create = useCreateHabito(); const update = useUpdateHabito(); const remove = useDeleteHabito();
  const items = asList<HabitoResumenItem>(resumen.data);
  const habitos = asList<Habito>(list.data);
  const done = items.filter((x) => x.completado).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetResumenHabitosQueryKey(fecha) });
    queryClient.invalidateQueries({ queryKey: getListHabitosQueryKey() });
  };
  const onToggle = (id: number) => {
    toggle.mutate({ id, fecha }, {
      onSuccess: () => invalidate(),
      onError: (e: unknown) => toast.error((e as { detail?: string })?.detail ?? 'No se pudo registrar el hábito'),
    });
  };
  const onSave = (data: Record<string, unknown>) => {
    const doneMut = () => { invalidate(); setModal(false); setEditing(null); };
    const onError = (e: unknown) => toast.error((e as { detail?: string })?.detail ?? 'No se pudo guardar el hábito');
    if (editing) update.mutate({ id: editing.id, data: data as never }, { onSuccess: doneMut, onError });
    else create.mutate({ data: data as never }, { onSuccess: doneMut, onError });
  };
  const onDelete = (h: Habito) => {
    if (!window.confirm(`¿Eliminar "${h.nombre}"? Se borrará su historial.`)) return;
    remove.mutate({ id: h.id }, { onSuccess: () => { invalidate(); toast.success('Hábito eliminado'); }, onError: (e: unknown) => toast.error((e as { detail?: string })?.detail ?? 'No se pudo eliminar') });
  };
  const onActive = (h: Habito, activo: boolean) => {
    update.mutate({ id: h.id, data: { activo } as never }, { onSuccess: invalidate });
  };
  return <Shell><div className="relative z-10 min-h-[100dvh]">
    <Topbar eyebrow="constancia y rachas" title="Hábitos" onAdd={() => { setEditing(null); setModal(true); }} />
    <div className="mx-auto max-w-[1180px] space-y-5 px-5 pb-28 sm:px-8 md:px-10">
      <section className="cosmos-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#5de8c4]/12 text-[#5de8c4]"><Flame size={22} /></span>
          <div>
            <div className="cosmos-eyebrow mb-1 capitalize">{isoLabel(fecha)}</div>
            <div className="cosmos-title text-xl font-bold">{fecha === today ? 'Hoy' : fecha < today ? 'En el pasado' : 'Próximamente'}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setFecha((f) => shiftIso(f, -1))} disabled={toggle.isPending} data-testid="button-habitos-dia-anterior" aria-label="Día anterior" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/70 transition hover:bg-white/6 hover:text-white"><ChevronLeft size={18} /></button>
          <button onClick={() => setFecha(today)} data-testid="button-habitos-hoy" className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/6">Hoy</button>
          <button onClick={() => setFecha((f) => shiftIso(f, 1))} disabled={toggle.isPending || fecha >= today} data-testid="button-habitos-dia-siguiente" aria-label="Día siguiente" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/70 transition hover:bg-white/6 hover:text-white disabled:opacity-30"><ChevronRight size={18} /></button>
        </div>
      </section>

      <section className="cosmos-card p-5 sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <div><div className="cosmos-eyebrow mb-1">avance del día</div><h2 className="cosmos-title text-lg font-bold">{done} de {items.length} hábitos completados</h2></div>
          <span className="cosmos-number text-xl font-bold text-[#5de8c4]">{pct}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-white/6">
          <div className="h-full rounded-full bg-gradient-to-r from-[#5de8c4] to-[#5dc4e8] transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {resumen.isLoading ? <LoadingRows /> : !items.length ? (
          <div className="sm:col-span-2"><EmptyState title="Sin hábitos por hoy" copy="Crea tu primer hábito con 'Registrar' y empieza a encender la racha 🔥." action="Crear hábito" onClick={() => setModal(true)} testId="button-empty-habitos" /></div>
        ) : items.map((h) => {
          const active = h.completado ? 'scale-[0.94] border-[#5de8c4]' : 'border-white/10 hover:border-white/25';
          return (
            <div key={h.id} data-testid={`carta-habito-${h.id}`} className={`cosmos-card flex items-center gap-4 p-5 transition ${active}`} style={h.completado ? { backgroundColor: `${h.color}14`, boxShadow: `inset 0 0 0 1px ${h.color}aa` } : undefined}>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl" style={{ backgroundColor: `${h.color}26`, boxShadow: `0 0 0 1px ${h.color}55` }}>{h.icono}</div>
              <div className="min-w-0 flex-1">
                <div className={`truncate text-sm font-semibold ${h.completado ? 'line-through decoration-white/40 text-white/60' : 'text-white'}`}>{h.nombre}</div>
                <div className="mt-1 flex items-center gap-1.5 text-xs">
                  <span className="flex items-center gap-1 font-semibold" style={{ color: h.racha > 0 ? '#e8a85d' : 'rgba(255,255,255,0.4)' }}><Flame size={13} /> {h.racha} día{h.racha === 1 ? '' : 's'}</span>
                  <span className="text-white/35">·</span>
                  <span className="text-white/45">{h.completado ? 'Listo hoy' : 'Pendiente'}</span>
                </div>
              </div>
              <button onClick={() => onToggle(h.id)} disabled={toggle.isPending} data-testid={`check-habito-${h.id}`} aria-label={h.completado ? 'Desmarcar hábito' : 'Marcar hábito'}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition ${h.completado ? 'border-transparent text-black' : 'border-white/25 text-transparent hover:border-white/60'}`}
                style={h.completado ? { backgroundColor: h.color, boxShadow: `0 0 18px ${h.color}66` } : undefined}>
                <Check size={20} strokeWidth={3} className={h.completado ? 'opacity-100' : 'opacity-0'} />
              </button>
            </div>
          );
        })}
      </section>

      <section className="cosmos-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/6 px-5 py-4 sm:px-6">
          <div><div className="cosmos-eyebrow mb-1">gestión</div><h2 className="cosmos-title text-lg font-bold">Tus hábitos</h2></div>
          <button onClick={() => { setEditing(null); setModal(true); }} data-testid="button-add-habito" className="flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-white/6"><Plus size={16} /><span className="hidden sm:inline">Nuevo</span></button>
        </div>
        <div className="p-3 sm:p-4">
          {list.isLoading ? <LoadingRows /> : !habitos.length ? <EmptyState title="Nada configurado aún" copy="Los hábitos activos aparecen en la lista del día y alimentan tu racha." action="Crear primer hábito" onClick={() => setModal(true)} testId="button-empty-gestores" /> : <div className="space-y-1">{habitos.map((h) => (
            <div key={h.id} data-testid={`fila-habito-${h.id}`} className={`group flex items-center justify-between rounded-xl px-2 py-3 transition hover:bg-white/4 ${h.activo ? '' : 'opacity-60'}`}>
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base" style={{ backgroundColor: `${h.color}26` }}>{h.icono}</span>
                <div className="min-w-0"><div className="truncate text-sm font-semibold text-white">{h.nombre}</div><div className="text-xs text-white/45">{h.activo ? 'activo' : 'pausado'}</div></div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => onActive(h, !h.activo)} data-testid={`toggle-activo-habito-${h.id}`} className={`rounded-lg p-2 transition ${h.activo ? 'text-[#5de8c4]' : 'text-white/35'} hover:bg-white/8`} title={h.activo ? 'Pausar' : 'Activar'}><CalendarCheck size={16} /></button>
                <button onClick={() => { setEditing(h); setModal(true); }} aria-label="Editar hábito" className="rounded-lg p-2 text-white/55 hover:bg-white/8 hover:text-white"><Pencil size={15} /></button>
                <button onClick={() => onDelete(h)} aria-label="Eliminar hábito" className="rounded-lg p-2 text-white/55 hover:bg-red-500/10 hover:text-red-400"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}</div>}
        </div>
      </section>
    </div>
    {modal && <HabitoModal record={editing} pending={create.isPending || update.isPending} onClose={() => { setModal(false); setEditing(null); }} onSubmit={onSave} />}
  </div></Shell>;
}

function HabitoModal({ record, pending, onClose, onSubmit }: { record: Habito | null; pending: boolean; onClose: () => void; onSubmit: (data: Record<string, unknown>) => void }) {
  const [form, setForm] = useState<Record<string, string | boolean>>({ nombre: record?.nombre ?? '', icono: record?.icono ?? HABITO_EMOJIS[0], color: record?.color ?? HABITO_COLORS[0], activo: record?.activo ?? true });
  const set = (key: string, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!String(form.nombre).trim()) return;
    onSubmit({ nombre: String(form.nombre).trim(), icono: String(form.icono), color: String(form.color), activo: Boolean(form.activo) });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div role="dialog" aria-modal="true" className="cosmos-card max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[24px] p-5 shadow-2xl sm:rounded-[24px] sm:p-7">
        <div className="mb-6 flex items-start justify-between"><div><div className="cosmos-eyebrow mb-1">jarvis / hábito</div><h2 className="cosmos-title text-2xl font-bold">{record ? 'Editar hábito' : 'Nuevo hábito'}</h2></div><button onClick={onClose} data-testid="button-close-modal" className="rounded-xl p-2 text-white/55 hover:bg-white/8 hover:text-white"><X size={20} /></button></div>
        <form onSubmit={submit} className="space-y-5">
          <label className="block"><span className="cosmos-field-label">Nombre</span><input required className="cosmos-input" value={String(form.nombre)} onChange={(e) => set('nombre', e.target.value)} data-testid="input-habito-nombre" placeholder="Ej. Meditar, Beber agua, Leer 10 min..." /></label>
          <div><span className="cosmos-field-label">Icono</span>
            <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
              {HABITO_EMOJIS.map((emoji) => (
                <button key={emoji} type="button" onClick={() => set('icono', emoji)} data-testid="picker-habito-icono" className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg transition ${form.icono === emoji ? 'bg-white text-black' : 'bg-white/5 hover:bg-white/10'}`}>{emoji}</button>
              ))}
            </div>
          </div>
          <div><span className="cosmos-field-label">Color</span>
            <div className="flex flex-wrap gap-2">
              {HABITO_COLORS.map((color) => (
                <button key={color} type="button" onClick={() => set('color', color)} data-testid="swatch-habito-color" aria-label={color} className={`h-8 w-8 rounded-full transition ${form.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0a0a0a]' : 'hover:scale-110'}`} style={{ backgroundColor: color }} />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
            <span className="text-sm font-medium text-white/80">¿Mostrarlo en la lista diaria?</span>
            <button type="button" onClick={() => set('activo', !form.activo)} data-testid="toggle-habito-activo" className={`relative h-6 w-11 rounded-full transition ${form.activo ? 'bg-white' : 'bg-white/15'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-black transition-all ${form.activo ? 'left-[22px]' : 'left-0.5'}`} /></button>
          </div>
          <button disabled={pending} type="submit" data-testid="button-save-habito" className="cosmos-button-primary w-full">{pending ? <RefreshCw size={17} className="animate-spin" /> : <Save />}{pending ? 'Guardando…' : 'Guardar hábito'}</button>
        </form>
      </div>
    </div>
  );
}

function RutinaPage() {
  const queryClient = useQueryClient();
  const today = hoyIdx();
  const [dia, setDia] = useState(today);
  const [view, setView] = useState<'dia' | 'semana'>('dia');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<BloqueRutina | null>(null);
  const diaQ = useGetRutinaDia(dia);
  const semanaQ = useGetRutinaSemana();
  const todosQ = useListBloquesRutina();
  const create = useCreateBloqueRutina(); const update = useUpdateBloqueRutina(); const remove = useDeleteBloqueRutina();
  const bloquesDia = asList<BloqueRutina>(diaQ.data);
  const semana = asList<DiaRutina>(semanaQ.data);
  const todos = asList<BloqueRutina>(todosQ.data);
  const ahora = horaAhora();
  const activoAhora = (b: BloqueRutina) => dia === today && b.hora_inicio <= ahora && ahora < b.hora_fin;
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetRutinaDiaQueryKey(dia) });
    queryClient.invalidateQueries({ queryKey: getGetRutinaSemanaQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListBloquesRutinaQueryKey() });
  };
  const onSave = (data: Record<string, unknown>) => {
    const doneMut = () => { invalidate(); setModal(false); setEditing(null); };
    const onError = (e: unknown) => toast.error((e as { detail?: string })?.detail ?? 'No se pudo guardar el bloque');
    if (editing) update.mutate({ id: editing.id, data: data as never }, { onSuccess: doneMut, onError });
    else create.mutate({ data: data as never }, { onSuccess: doneMut, onError });
  };
  const onDelete = (b: BloqueRutina) => {
    if (!window.confirm(`¿Eliminar "${b.titulo}" de ${b.hora_inicio} a ${b.hora_fin}?`)) return;
    remove.mutate({ id: b.id }, { onSuccess: () => { invalidate(); toast.success('Bloque eliminado'); }, onError: () => toast.error('No se pudo eliminar') });
  };
  const onActive = (b: BloqueRutina, activo: boolean) => {
    update.mutate({ id: b.id, data: { activo } as never }, { onSuccess: invalidate });
  };
  return <Shell><div className="relative z-10 min-h-[100dvh]">
    <Topbar eyebrow="semana y ritmo" title="Rutina" onAdd={() => { setEditing(null); setModal(true); }} />
    <div className="mx-auto max-w-[1180px] space-y-5 px-5 pb-28 sm:px-8 md:px-10">
      <div className="flex items-center justify-between gap-3">
        <div className="cosmos-card flex gap-1 p-1">
          <button onClick={() => setView('dia')} data-testid="tab-rutina-dia" className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${view === 'dia' ? 'bg-white text-black' : 'text-white/55 hover:text-white'}`}><List size={15} /><span className="hidden sm:inline">Día</span></button>
          <button onClick={() => setView('semana')} data-testid="tab-rutina-semana" className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${view === 'semana' ? 'bg-white text-black' : 'text-white/55 hover:text-white'}`}><LayoutGrid size={15} /><span className="hidden sm:inline">Semana</span></button>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-white/6 px-3 py-1.5 text-xs font-semibold text-white/60"><Clock size={13} /> {RUTINA_DIAS_FULL[today]} · {ahora}</span>
      </div>

      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {RUTINA_DIAS.map((label, i) => {
          const n = semana[i]?.bloques.length ?? 0;
          const selected = view === 'dia' && dia === i;
          const isToday = i === today;
          return (
            <button key={i} onClick={() => { setDia(i); setView('dia'); }} data-testid={`selector-dia-${i}`}
              className={`flex flex-col items-center gap-0.5 rounded-2xl px-1 py-2.5 text-center transition ${selected ? 'bg-white text-black' : isToday ? 'bg-white/10 text-white' : 'bg-white/4 text-white/60 hover:bg-white/8'}`}>
              <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
              <span className={`cosmos-number text-sm font-bold ${selected ? 'text-black' : isToday ? 'text-[#5de8c4]' : 'text-white/45'}`}>{n}</span>
            </button>
          );
        })}
      </div>

      {view === 'dia' ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div><div className="cosmos-eyebrow mb-1">hoy en el día</div><h2 className="cosmos-title text-xl font-bold">{RUTINA_DIAS_FULL[dia]}</h2></div>
            <button onClick={() => { setEditing(null); setModal(true); }} data-testid="button-add-rutina" className="flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-white/6"><Plus size={16} /><span className="hidden sm:inline">Bloque</span></button>
          </div>
          {diaQ.isLoading ? <LoadingRows /> : !bloquesDia.length ? (
            <EmptyState title="Día sin bloques" copy="Agrega un bloque para este día y arma tu ritmo." action="Agregar bloque" onClick={() => setModal(true)} testId="button-empty-rutina" />
          ) : bloquesDia.map((b) => {
            const running = activoAhora(b);
            return (
              <div key={b.id} data-testid={`bloque-rutina-${b.id}`} className={`cosmos-card group relative flex items-center gap-4 overflow-hidden p-4 sm:p-5 ${running ? 'ring-1' : ''}`} style={running ? { boxShadow: `inset 0 0 0 1px ${b.color}cc`, backgroundColor: `${b.color}14` } : undefined}>
                <span className="h-12 w-1.5 shrink-0 self-center rounded-full" style={{ backgroundColor: b.color, boxShadow: running ? `0 0 14px ${b.color}` : undefined }} />
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl" style={{ backgroundColor: `${b.color}26` }}>{b.icono}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-white">{b.titulo}</span>
                    {running && <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black" style={{ backgroundColor: b.color }}>ahora</span>}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-white/45"><Clock size={12} /><span className="cosmos-number font-semibold" style={{ color: b.color }}>{b.hora_inicio} – {b.hora_fin}</span>{b.descripcion ? ` · ${b.descripcion}` : ''}</div>
                </div>
                <div className="flex items-center gap-1 opacity-60 transition group-hover:opacity-100">
                  <button onClick={() => { setEditing(b); setModal(true); }} aria-label="Editar bloque" className="rounded-lg p-2 text-white/55 hover:bg-white/8 hover:text-white"><Pencil size={15} /></button>
                  <button onClick={() => onDelete(b)} aria-label="Eliminar bloque" className="rounded-lg p-2 text-white/55 hover:bg-red-500/10 hover:text-red-400"><Trash2 size={15} /></button>
                </div>
              </div>
            );
          })}
        </section>
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {semanaQ.isLoading ? <LoadingRows /> : semana.map((d, i) => (
            <div key={d.dia_semana} data-testid={`columna-semana-${i}`} className={`cosmos-card flex flex-col gap-1.5 p-3 ${i === today ? 'ring-1 ring-white/20' : ''}`}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">{RUTINA_DIAS[i]}</span>
                <span className={`text-xs font-semibold ${i === today ? 'text-[#5de8c4]' : 'text-white/35'}`}>{d.bloques.length}</span>
              </div>
              {!d.bloques.length ? <span className="text-center text-[11px] text-white/25">—</span> : d.bloques.map((b) => (
                <button key={b.id} onClick={() => { setDia(i); setView('dia'); }} data-testid={`pastilla-semana-${b.id}`}
                  className="flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-left text-[11px] font-medium leading-tight text-white/85 transition hover:scale-[1.02]"
                  style={{ backgroundColor: `${b.color}24`, boxShadow: `inset 0 0 0 1px ${b.color}55` }}>
                  <span>{b.icono}</span>
                  <span className="min-w-0"><span className="block truncate">{b.titulo}</span><span className="cosmos-number block text-[9px] font-semibold" style={{ color: b.color }}>{b.hora_inicio}–{b.hora_fin}</span></span>
                </button>
              ))}
            </div>
          ))}
        </section>
      )}

      <section className="cosmos-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/6 px-5 py-4 sm:px-6">
          <div><div className="cosmos-eyebrow mb-1">gestión</div><h2 className="cosmos-title text-lg font-bold">Todos los bloques</h2></div>
          <button onClick={() => { setEditing(null); setModal(true); }} data-testid="button-add-bloque-rutina" className="flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-white/6"><Plus size={16} /><span className="hidden sm:inline">Nuevo</span></button>
        </div>
        <div className="p-3 sm:p-4">
          {todosQ.isLoading ? <LoadingRows /> : !todos.length ? <EmptyState title="Sin bloques configurados" copy="Agrega el primer bloque de tu rutina." action="Crear bloque" onClick={() => setModal(true)} testId="button-empty-gestion-rutina" /> : <div className="grid gap-1.5 sm:grid-cols-2">{todos.map((b) => (
            <div key={b.id} data-testid={`fila-bloque-${b.id}`} className={`group flex items-center justify-between rounded-xl px-2 py-3 transition hover:bg-white/4 ${b.activo ? '' : 'opacity-60'}`}>
              <div className="flex min-w-0 items-center gap-3">
                <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: b.color }} />
                <div className="min-w-0"><div className="truncate text-sm font-semibold text-white">{b.icono} {b.titulo}</div><div className="text-xs text-white/45">{RUTINA_DIAS[b.dia_semana]} · {b.hora_inicio}–{b.hora_fin}{b.descripcion ? ` · ${b.descripcion}` : ''}</div></div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => onActive(b, !b.activo)} data-testid={`toggle-activo-bloque-${b.id}`} className={`rounded-lg p-2 transition ${b.activo ? 'text-[#5de8c4]' : 'text-white/35'} hover:bg-white/8`} title={b.activo ? 'Pausar' : 'Activar'}><CalendarCheck size={16} /></button>
                <button onClick={() => { setEditing(b); setModal(true); }} aria-label="Editar bloque" className="rounded-lg p-2 text-white/55 hover:bg-white/8 hover:text-white"><Pencil size={15} /></button>
                <button onClick={() => onDelete(b)} aria-label="Eliminar bloque" className="rounded-lg p-2 text-white/55 hover:bg-red-500/10 hover:text-red-400"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}</div>}
        </div>
      </section>
    </div>
    {modal && <RutinaModal record={editing} pending={create.isPending || update.isPending || remove.isPending} onClose={() => { setModal(false); setEditing(null); }} onSubmit={onSave} />}
  </div></Shell>;
}

function RutinaModal({ record, pending, onClose, onSubmit }: { record: BloqueRutina | null; pending: boolean; onClose: () => void; onSubmit: (data: Record<string, unknown>) => void }) {
  const [form, setForm] = useState<Record<string, string | boolean>>({ dia_semana: String(record?.dia_semana ?? hoyIdx()), hora_inicio: record?.hora_inicio ?? '08:00', hora_fin: record?.hora_fin ?? '09:00', titulo: record?.titulo ?? '', descripcion: record?.descripcion ?? '', icono: record?.icono ?? RUTINA_EMOJIS[0], color: record?.color ?? RUTINA_COLORS[0], activo: record?.activo ?? true });
  const set = (key: string, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const inicio = String(form.hora_inicio);
    const fin = String(form.hora_fin);
    if (fin <= inicio) { toast.error('La hora de fin debe ser posterior a la de inicio'); return; }
    if (!String(form.titulo).trim()) return;
    onSubmit({ dia_semana: Number(form.dia_semana), hora_inicio: inicio, hora_fin: fin, titulo: String(form.titulo).trim(), descripcion: String(form.descripcion).trim(), icono: String(form.icono), color: String(form.color), activo: Boolean(form.activo) });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div role="dialog" aria-modal="true" className="cosmos-card max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[24px] p-5 shadow-2xl sm:rounded-[24px] sm:p-7">
        <div className="mb-6 flex items-start justify-between"><div><div className="cosmos-eyebrow mb-1">jarvis / rutina</div><h2 className="cosmos-title text-2xl font-bold">{record ? 'Editar bloque' : 'Nuevo bloque'}</h2></div><button onClick={onClose} data-testid="button-close-modal" className="rounded-xl p-2 text-white/55 hover:bg-white/8 hover:text-white"><X size={20} /></button></div>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="cosmos-field-label">Día</span><select className="cosmos-select" value={String(form.dia_semana)} onChange={(e) => set('dia_semana', e.target.value)} data-testid="select-rutina-dia">{RUTINA_DIAS.map((label, i) => <option key={i} value={i}>{label} · {RUTINA_DIAS_FULL[i]}</option>)}</select></label>
            <label className="block"><span className="cosmos-field-label">Icono</span><select className="cosmos-select" value={String(form.icono)} onChange={(e) => set('icono', e.target.value)} data-testid="select-rutina-icono">{RUTINA_EMOJIS.map((emoji) => <option key={emoji} value={emoji}>{emoji}</option>)}</select></label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="cosmos-field-label">Hora inicio</span><input required type="time" className="cosmos-input" value={String(form.hora_inicio)} onChange={(e) => set('hora_inicio', e.target.value)} data-testid="input-rutina-inicio" /></label>
            <label className="block"><span className="cosmos-field-label">Hora fin</span><input required type="time" className="cosmos-input" value={String(form.hora_fin)} onChange={(e) => set('hora_fin', e.target.value)} data-testid="input-rutina-fin" /></label>
          </div>
          <label className="block"><span className="cosmos-field-label">Título</span><input required className="cosmos-input" value={String(form.titulo)} onChange={(e) => set('titulo', e.target.value)} data-testid="input-rutina-titulo" placeholder="Ej. Desayuno, SENA, Tiempo libre..." /></label>
          <label className="block"><span className="cosmos-field-label">Descripción (opcional)</span><input className="cosmos-input" value={String(form.descripcion)} onChange={(e) => set('descripcion', e.target.value)} data-testid="input-rutina-descripcion" placeholder="Un detalle de este bloque..." /></label>
          <div><span className="cosmos-field-label">Color</span>
            <div className="flex flex-wrap gap-2">
              {RUTINA_COLORS.map((color) => (
                <button key={color} type="button" onClick={() => set('color', color)} data-testid="swatch-rutina-color" aria-label={color} className={`h-8 w-8 rounded-full transition ${form.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0a0a0a]' : 'hover:scale-110'}`} style={{ backgroundColor: color }} />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
            <span className="text-sm font-medium text-white/80">¿Mostrarlo en la rutina?</span>
            <button type="button" onClick={() => set('activo', !form.activo)} data-testid="toggle-rutina-activo" className={`relative h-6 w-11 rounded-full transition ${form.activo ? 'bg-white' : 'bg-white/15'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-black transition-all ${form.activo ? 'left-[22px]' : 'left-0.5'}`} /></button>
          </div>
          <button disabled={pending} type="submit" data-testid="button-save-rutina" className="cosmos-button-primary w-full">{pending ? <RefreshCw size={17} className="animate-spin" /> : <Save />}{pending ? 'Guardando…' : 'Guardar bloque'}</button>
        </form>
      </div>
    </div>
  );
}

function CategoriesPage() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Categoria | null>(null);
  const list = useListCategorias();
  const cats = asList<Categoria>(list.data);
  const create = useCreateCategoria(); const update = useUpdateCategoria(); const remove = useDeleteCategoria();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListCategoriasQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetResumenMensualPorCategoriaQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListGastosVariablesQueryKey() });
  };
  const onSuccess = () => { invalidate(); setModal(false); setEditing(null); };
  const onError = (e: unknown) => toast.error((e as { detail?: string })?.detail ?? 'No se pudo guardar la categoría');
  const submit = (data: Record<string, unknown>) => {
    if (editing) update.mutate({ id: editing.id, data: data as never }, { onSuccess, onError });
    else create.mutate({ data: data as never }, { onSuccess, onError });
  };
  const removeCat = (c: Categoria) => {
    if (!window.confirm(`¿Eliminar "${c.nombre}"?`)) return;
    remove.mutate({ id: c.id }, { onSuccess: invalidate, onError: (e: unknown) => toast.error((e as { detail?: string })?.detail ?? 'No se pudo eliminar') });
  };
  return <Shell><div className="relative z-10 min-h-[100dvh]">
    <Topbar eyebrow="colores del mes" title="Categorías" onAdd={() => { setEditing(null); setModal(true); }} />
    <div className="mx-auto max-w-[1180px] space-y-5 px-5 pb-28 sm:px-8 md:px-10">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.isLoading ? <LoadingRows /> : cats.map((c) => (
          <div key={c.id} data-testid={`carta-categoria-${c.id}`} className="cosmos-card group flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl" style={{ backgroundColor: `${c.color}26`, boxShadow: `0 0 0 1px ${c.color}55` }}>{c.icono}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{c.nombre}</div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-white/45">
                <span className="font-mono uppercase tracking-wider" style={{ color: c.color }}>{c.color}</span>
                <span className={c.activa ? 'text-[#5de8c4]' : 'text-white/35'}>{c.activa ? 'activa' : 'no activa'}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-70 transition group-hover:opacity-100">
              <button onClick={() => { setEditing(c); setModal(true); }} aria-label="Editar categoría" className="rounded-lg p-2 text-white/55 hover:bg-white/8 hover:text-white"><Pencil size={15} /></button>
              <button onClick={() => removeCat(c)} aria-label="Eliminar categoría" className="rounded-lg p-2 text-white/55 hover:bg-red-500/10 hover:text-red-400"><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
    {modal && <CategoryModal record={editing} pending={create.isPending || update.isPending || remove.isPending} onClose={() => { setModal(false); setEditing(null); }} onSubmit={submit} />}
  </div></Shell>;
}

function CategoryModal({ record, pending, onClose, onSubmit }: { record: Categoria | null; pending: boolean; onClose: () => void; onSubmit: (data: Record<string, unknown>) => void }) {
  const [form, setForm] = useState<Record<string, string | boolean>>({ nombre: record?.nombre ?? '', icono: record?.icono ?? CATEGORY_EMOJIS[0], color: record?.color ?? CATEGORY_COLORS[0], activa: record?.activa ?? true });
  const set = (key: string, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const edit = (event: React.FormEvent) => { event.preventDefault(); if (!String(form.nombre).trim()) return; onSubmit({ ...form, activa: Boolean(form.activa) }); };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div role="dialog" aria-modal="true" className="cosmos-card max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[24px] p-5 shadow-2xl sm:rounded-[24px] sm:p-7">
        <div className="mb-6 flex items-start justify-between"><div><div className="cosmos-eyebrow mb-1">jarvis / categoría</div><h2 className="cosmos-title text-2xl font-bold">{record ? 'Editar categoría' : 'Nueva categoría'}</h2></div><button onClick={onClose} data-testid="button-close-modal" className="rounded-xl p-2 text-white/55 hover:bg-white/8 hover:text-white"><X size={20} /></button></div>
        <form onSubmit={edit} className="space-y-5">
          <label className="block"><span className="cosmos-field-label">Nombre</span><input required className="cosmos-input" value={String(form.nombre)} onChange={(e) => set('nombre', e.target.value)} data-testid="input-categoria-nombre" placeholder="Ej. Comida, Didi, Mercado..." /></label>
          <div><span className="cosmos-field-label">Icono</span>
            <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
              {CATEGORY_EMOJIS.map((emoji) => (
                <button key={emoji} type="button" onClick={() => set('icono', emoji)} data-testid="picker-categoria-icono" className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg transition ${form.icono === emoji ? 'bg-white text-black' : 'bg-white/5 hover:bg-white/10'}`}>{emoji}</button>
              ))}
            </div>
          </div>
          <div><span className="cosmos-field-label">Color</span>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((color) => (
                <button key={color} type="button" onClick={() => set('color', color)} data-testid="swatch-categoria-color" aria-label={color} className={`h-8 w-8 rounded-full transition ${form.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0a0a0a]' : 'hover:scale-110'}`} style={{ backgroundColor: color }} />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
            <span className="text-sm font-medium text-white/80">¿Mostrarla al registrar gastos?</span>
            <button type="button" onClick={() => set('activa', !form.activa)} data-testid="toggle-categoria-activa" className={`relative h-6 w-11 rounded-full transition ${form.activa ? 'bg-white' : 'bg-white/15'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-black transition-all ${form.activa ? 'left-[22px]' : 'left-0.5'}`} /></button>
          </div>
          <button disabled={pending} type="submit" data-testid="button-save-categoria" className="cosmos-button-primary w-full">{pending ? <RefreshCw size={17} className="animate-spin" /> : <Save />}{pending ? 'Guardando…' : 'Guardar categoría'}</button>
        </form>
      </div>
    </div>
  );
}

function CategoryPills({ categories, value, onSelect }: { categories: Categoria[]; value: number | null; onSelect: (id: number) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {categories.map((c) => {
        const active = value === c.id;
        return (
          <button key={c.id} type="button" onClick={() => onSelect(c.id)} data-testid={`pill-categoria-${c.id}`}
            className={`flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-center transition ${active ? 'scale-[0.98]' : 'hover:bg-white/6'}`}
            style={active ? { backgroundColor: `${c.color}2e`, boxShadow: `inset 0 0 0 1.5px ${c.color}` } : { backgroundColor: 'rgba(255,255,255,0.05)' }}>
            <span className="text-2xl">{c.icono}</span>
            <span className="w-full truncate text-[11px] font-medium" style={{ color: active ? c.color : 'rgba(255,255,255,0.6)' }}>{c.nombre}</span>
          </button>
        );
      })}
    </div>
  );
}

function TransferenciaModal({ medios, pending, onClose, onSubmit }: { medios: MedioPagoSaldo[]; pending: boolean; onClose: () => void; onSubmit: (data: Record<string, unknown>) => void }) {
  const activos = medios.filter((m) => m.activo);
  const [form, setForm] = useState({
    fecha: dateValue(),
    origen_id: String(activos[0]?.id ?? ''),
    destino_id: String(activos[1]?.id ?? activos[0]?.id ?? ''),
    monto: '',
    nota: '',
  });
  const set = (key: string, value: string) => setForm((curr) => ({ ...curr, [key]: value }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const origen = Number(form.origen_id);
    const destino = Number(form.destino_id);
    const monto = Number(form.monto);
    if (!origen || !destino) { toast.error('Selecciona cuentas de origen y destino'); return; }
    if (origen === destino) { toast.error('El medio de origen y destino no pueden ser el mismo'); return; }
    if (!monto || monto <= 0) { toast.error('Ingresa un monto mayor a 0'); return; }
    onSubmit({ fecha: form.fecha, origen_id: origen, destino_id: destino, monto, nota: form.nota });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div role="dialog" aria-modal="true" className="cosmos-card max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[24px] p-5 shadow-2xl sm:rounded-[24px] sm:p-7">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="cosmos-eyebrow mb-1">jarvis / transferencias</div>
            <h2 className="cosmos-title text-2xl font-bold">Mover entre cuentas</h2>
          </div>
          <button onClick={onClose} data-testid="button-close-modal" className="rounded-xl p-2 text-white/55 hover:bg-white/8 hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <span className="block"><span className="cosmos-field-label">Fecha</span><input required type="date" className="cosmos-input" value={form.fecha} onChange={(e) => set('fecha', e.target.value)} /></span>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="cosmos-field-label">Desde (Origen)</span>
              <select className="cosmos-select" value={form.origen_id} onChange={(e) => set('origen_id', e.target.value)}>
                {activos.map((m) => (
                  <option key={m.id} value={m.id}>{m.icono} {m.nombre} ({money(m.saldo_actual)})</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="cosmos-field-label">Hacia (Destino)</span>
              <select className="cosmos-select" value={form.destino_id} onChange={(e) => set('destino_id', e.target.value)}>
                {activos.map((m) => (
                  <option key={m.id} value={m.id}>{m.icono} {m.nombre} ({money(m.saldo_actual)})</option>
                ))}
              </select>
            </label>
          </div>
          <span className="block"><span className="cosmos-field-label">Monto a transferir</span><input required min="0.01" step="0.01" type="number" className="cosmos-input" value={form.monto} onChange={(e) => set('monto', e.target.value)} placeholder="0" /></span>
          <span className="block"><span className="cosmos-field-label">Nota o motivo (opcional)</span><input className="cosmos-input" value={form.nota} onChange={(e) => set('nota', e.target.value)} placeholder="Ej. Retiro cajero, recarga Nequi..." /></span>
          <button disabled={pending} type="submit" data-testid="button-save-transferencia" className="cosmos-button-primary w-full !py-3.5">
            {pending ? <RefreshCw size={17} className="animate-spin" /> : <ArrowRightLeft size={17} />}
            {pending ? 'Transfiriendo…' : 'Completar transferencia'}
          </button>
        </form>
      </div>
    </div>
  );
}

function RecordModal({ kind, record, categorias, medios, pending, onClose, onSubmit }: { kind: Exclude<ModalKind, null>; record: AnyRecord | null; categorias?: Categoria[]; medios?: MedioPagoSaldo[]; pending: boolean; onClose: () => void; onSubmit: (data: Record<string, unknown>) => void }) {
  const isIngreso = kind === 'ingreso'; const isVariable = kind === 'variable'; const isFijo = kind === 'fijo'; const isKm = kind === 'km';
  const r = record as Partial<Ingreso & GastoVariable & GastoFijo & Kilometraje> | null;
  const [form, setForm] = useState<Record<string, string | boolean>>({
    fecha: dateValue(r?.fecha), fuente: r?.fuente ?? 'Didi', monto: String(r?.monto ?? ''),
    medio_pago_id: String(r?.medio_pago_id ?? (medios?.[0]?.id ?? '')),
    nota: r?.nota ?? '', categoria_id: String(r?.categoria_id ?? (categorias?.[0]?.id ?? '')), nombre: r?.nombre ?? '',
    tipo: r?.tipo ?? 'mensual', activo: r?.activo ?? true, km_actuales: String(r?.km_actuales ?? ''),
  });
  const set = (key: string, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const base = { ...form };
    const medioId = Number(base.medio_pago_id) || undefined;
    if (isVariable) {
      if (!Number(base.categoria_id)) { toast.error('Elige una categoría para este gasto'); return; }
      onSubmit({ fecha: base.fecha, categoria_id: Number(base.categoria_id), monto: Number(base.monto), medio_pago_id: medioId, nota: String(base.nota) });
    }
    else if (isIngreso) onSubmit({ fecha: base.fecha, fuente: base.fuente, monto: Number(base.monto), medio_pago_id: medioId, nota: String(base.nota) });
    else if (isFijo) onSubmit({ nombre: base.nombre, monto: Number(base.monto), tipo: base.tipo, activo: Boolean(base.activo) });
    else onSubmit({ fecha: base.fecha, km_actuales: Number(base.km_actuales), nota: String(base.nota) });
  };
  const title = isIngreso ? (record ? 'Editar ingreso' : 'Nuevo ingreso') : isVariable ? (record ? 'Editar gasto variable' : 'Nuevo gasto variable') : isFijo ? (record ? 'Editar gasto fijo' : 'Nuevo gasto fijo') : (record ? 'Editar kilometraje' : 'Registrar kilometraje');
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div role="dialog" aria-modal="true" className="cosmos-card max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[24px] p-5 shadow-2xl sm:rounded-[24px] sm:p-7">
        <div className="mb-6 flex items-start justify-between"><div><div className="cosmos-eyebrow mb-1">jarvis / registro</div><h2 className="cosmos-title text-2xl font-bold">{title}</h2></div><button onClick={onClose} data-testid="button-close-modal" className="rounded-xl p-2 text-white/55 hover:bg-white/8 hover:text-white"><X size={20} /></button></div>
        <form onSubmit={submit} className="space-y-4">
          {isFijo ? <>
            <span className="block"><span className="cosmos-field-label">Nombre</span><input required className="cosmos-input" value={String(form.nombre)} onChange={(e) => set('nombre', e.target.value)} data-testid="input-fijo-nombre" placeholder="Ej. renta, plan de datos" /></span>
            <span className="block"><span className="cosmos-field-label">Monto</span><input required min="0" step="0.01" type="number" className="cosmos-input" value={String(form.monto)} onChange={(e) => set('monto', e.target.value)} data-testid="input-fijo-monto" placeholder="0" /></span>
            <span className="block"><span className="cosmos-field-label">Tipo</span><select className="cosmos-select" value={String(form.tipo)} onChange={(e) => set('tipo', e.target.value)} data-testid="select-fijo-tipo"><option value="mensual">Mensual</option><option value="por_kilometraje">Por kilometraje</option></select></span>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-white/5 p-3 text-sm font-medium text-white/80"><input type="checkbox" checked={Boolean(form.activo)} onChange={(e) => set('activo', e.target.checked)} data-testid="checkbox-fijo-activo" className="h-4 w-4 accent-white" /> Está activo este mes</label>
          </> : <>
            {isVariable && categorias?.length ? <div>
              <span className="cosmos-field-label">Categoría</span>
              <CategoryPills categories={categorias} value={Number(form.categoria_id) || null} onSelect={(id) => set('categoria_id', String(id))} />
            </div> : (
              isVariable && <p className="rounded-xl bg-white/5 px-4 py-3 text-sm text-white/50">Aún no hay categorías activas. Crea una desde «Categorías» y vuelve aquí.</p>
            )}
            <span className="block"><span className="cosmos-field-label">Fecha</span><input required type="date" className="cosmos-input" value={String(form.fecha)} onChange={(e) => set('fecha', e.target.value)} data-testid={`input-${kind}-fecha`} /></span>
            {isIngreso && <span className="block"><span className="cosmos-field-label">Fuente</span><select className="cosmos-select" value={String(form.fuente)} onChange={(e) => set('fuente', e.target.value)} data-testid="select-ingreso-fuente"><option value="Didi">Didi</option><option value="papa">Papá</option><option value="amigo">Amigo</option><option value="otro">Otro</option></select></span>}
            {(isIngreso || isVariable) && medios && medios.length > 0 && (
              <label className="block">
                <span className="cosmos-field-label">{isIngreso ? '¿Dónde entró el dinero?' : '¿De dónde salió el dinero?'}</span>
                <select className="cosmos-select" value={String(form.medio_pago_id)} onChange={(e) => set('medio_pago_id', e.target.value)}>
                  {medios.map((m) => (
                    <option key={m.id} value={m.id}>{m.icono} {m.nombre}</option>
                  ))}
                </select>
              </label>
            )}
            {isKm ? <span className="block"><span className="cosmos-field-label">Kilómetros actuales</span><input required min="0" step="0.1" type="number" className="cosmos-input" value={String(form.km_actuales)} onChange={(e) => set('km_actuales', e.target.value)} data-testid="input-km-actuales" placeholder="0" /></span> : <span className="block"><span className="cosmos-field-label">Monto</span><input required min="0" step="0.01" type="number" className="cosmos-input" value={String(form.monto)} onChange={(e) => set('monto', e.target.value)} data-testid="input-monto" placeholder="0" /></span>}
            {!isKm && <span className="block"><span className="cosmos-field-label">Nota (opcional)</span><input className="cosmos-input" value={String(form.nota)} onChange={(e) => set('nota', e.target.value)} placeholder="Un detalle, la ruta, la hora..." /></span>}
          </>}
          <button disabled={pending} type="submit" data-testid="button-save-record" className="cosmos-button-primary w-full !py-3.5">{pending ? <RefreshCw size={17} className="animate-spin" /> : <Save />}{pending ? 'Guardando…' : 'Guardar registro'}</button>
        </form>
      </div>
    </div>
  );
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><Switch>
    <Route path="/" component={Dashboard} />
    <Route path="/kilometraje" component={KilometrajePage} />
    <Route path="/habitos" component={HabitosPage} />
    <Route path="/rutina" component={RutinaPage} />
    <Route path="/moto" component={MotoPage} />
    <Route path="/categorias" component={CategoriesPage} />
    <Route component={() => <Shell><div className="relative z-10 flex min-h-[100dvh] items-center justify-center p-8 text-center"><div><h1 className="cosmos-title text-3xl font-bold">Esta ruta no existe</h1><Link href="/" data-testid="link-back-home" className="mt-3 inline-block text-white underline decoration-white/25 underline-offset-4">Volver al resumen</Link></div></div></Shell>} />
  </Switch><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
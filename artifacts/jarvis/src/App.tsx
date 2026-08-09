import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, Route, Switch, useLocation } from 'wouter';
import { toast } from 'sonner';
import {
  Activity, ArrowDownLeft, ArrowUpRight, Bike, CalendarDays, CircleDollarSign,
  Gauge, Pencil, Plus, Receipt, RefreshCw, Save, Settings2, Tags, Trash2, TrendingUp, X,
} from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  useHealthCheck, useListIngresos, useCreateIngreso, useGetIngreso, useUpdateIngreso, useDeleteIngreso,
  useListGastosFijos, useCreateGastoFijo, useGetGastoFijo, useUpdateGastoFijo, useDeleteGastoFijo,
  useListGastosVariables, useCreateGastoVariable, useGetGastoVariable, useUpdateGastoVariable, useDeleteGastoVariable,
  useListKilometrajes, useCreateKilometraje, useGetKilometraje, useUpdateKilometraje, useDeleteKilometraje,
  useGetResumenMesActual, useListCategorias, useCreateCategoria, useUpdateCategoria, useDeleteCategoria,
  useGetResumenMensualPorCategoria,
  getListIngresosQueryKey, getListGastosFijosQueryKey, getListGastosVariablesQueryKey,
  getListKilometrajesQueryKey, getGetResumenMesActualQueryKey, getListCategoriasQueryKey,
  getGetResumenMensualPorCategoriaQueryKey,
} from '@workspace/api-client-react';
import type { Categoria, GastoFijo, GastoVariable, Ingreso, Kilometraje, ResumenCategoria } from '@workspace/api-client-react';
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
  const [modal, setModal] = useState<ModalKind>(null);
  const [editing, setEditing] = useState<AnyRecord | null>(null);
  const ingresos = useListIngresos(); const fijos = useListGastosFijos(); const variables = useListGastosVariables();
  const categorias = useListCategorias();
  const summary = useGetResumenMesActual();
  const porCategoria = useGetResumenMensualPorCategoria();
  const createIngreso = useCreateIngreso(); const updateIngreso = useUpdateIngreso(); const deleteIngreso = useDeleteIngreso();
  const createFijo = useCreateGastoFijo(); const updateFijo = useUpdateGastoFijo(); const deleteFijo = useDeleteGastoFijo();
  const createVariable = useCreateGastoVariable(); const updateVariable = useUpdateGastoVariable(); const deleteVariable = useDeleteGastoVariable();
  const ids = {
    ingreso: editing && 'fuente' in editing ? editing.id : undefined,
    fijo: editing && 'activo' in editing ? editing.id : undefined,
    variable: editing && 'categoria_id' in editing ? editing.id : undefined,
  };
  const ingresosList = asList<Ingreso>(ingresos.data);
  const fijosList = asList<GastoFijo>(fijos.data);
  const variablesList = asList<GastoVariable>(variables.data);
  const categoriasList = asList<Categoria>(categorias.data);
  const pieData = asList<ResumenCategoria>(porCategoria.data);
  const catMap = useMemo(() => new Map(categoriasList.map((c) => [c.id, c])), [categoriasList]);
  const catsForModal = useMemo(() => categoriasList.filter((c) => c.activa), [categoriasList]);
  const totals = useMemo(() => ({
    income: ingresosList.filter((x) => x.fecha.slice(0, 7) === new Date().toISOString().slice(0, 7)).reduce((a, x) => a + x.monto, 0),
    fixed: fijosList.filter((x) => x.activo).reduce((a, x) => a + x.monto, 0),
    variable: variablesList.filter((x) => x.fecha.slice(0, 7) === new Date().toISOString().slice(0, 7)).reduce((a, x) => a + x.monto, 0),
  }), [ingresosList, fijosList, variablesList]);
  const sum = summary.data ?? { total_ingresos: totals.income, total_gastos_fijos: totals.fixed, total_gastos_variables: totals.variable, saldo: totals.income - totals.fixed - totals.variable };
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListIngresosQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListGastosFijosQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListGastosVariablesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetResumenMesActualQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetResumenMensualPorCategoriaQueryKey() });
  };
  const close = () => { setModal(null); setEditing(null); };
  const submit = (data: Record<string, unknown>) => {
    const done = () => { invalidate(); close(); };
    if (modal === 'ingreso') editing ? updateIngreso.mutate({ id: editing.id, data: data as never }, { onSuccess: done }) : createIngreso.mutate({ data: data as never }, { onSuccess: done });
    if (modal === 'variable') editing ? updateVariable.mutate({ id: editing.id, data: data as never }, { onSuccess: done }) : createVariable.mutate({ data: data as never }, { onSuccess: done });
    if (modal === 'fijo') editing ? updateFijo.mutate({ id: editing.id, data: data as never }, { onSuccess: done }) : createFijo.mutate({ data: data as never }, { onSuccess: done });
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
        <div className="grid gap-4 sm:grid-cols-3">
          <Metric label="Saldo del mes" value={money(sum.saldo)} icon={<TrendingUp size={19} />} tone="green" note={sum.saldo >= 0 ? 'Vas construyendo margen' : 'Ajusta el ritmo esta semana'} />
          <Metric label="Ingresos" value={money(sum.total_ingresos)} icon={<ArrowUpRight size={19} />} tone="warm" note={`${ingresosList.length} registros este mes`} />
          <Metric label="Gastos" value={money(sum.total_gastos_fijos + sum.total_gastos_variables)} icon={<ArrowDownLeft size={19} />} note={`${money(sum.total_gastos_fijos)} fijos · ${money(sum.total_gastos_variables)} variables`} />
        </div>

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
            {ingresos.isLoading ? <LoadingRows /> : !ingresosList.length ? <EmptyState title="Todavía no hay ingresos" copy="Anota tu primera jornada para empezar a ver el movimiento." action="Registrar ingreso" onClick={() => setModal('ingreso')} testId="button-empty-ingreso" /> : <div className="space-y-1">{ingresosList.slice(0, 6).map((x) => <div key={x.id} data-testid={`row-ingreso-${x.id}`} className="group flex items-center justify-between rounded-xl px-2 py-3 transition hover:bg-white/4"><div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#5de8c4]/12 text-[#5de8c4]"><ArrowUpRight size={17} /></div><div className="min-w-0"><div className="truncate text-sm font-semibold text-white/90">{sourceLabel[x.fuente]}</div><div className="text-xs text-white/45">{dateLabel(x.fecha)}{x.nota ? ` · ${x.nota}` : ''}</div></div></div><div className="flex items-center gap-1"><span className="cosmos-number text-sm font-medium text-[#5de8c4]">+{money(x.monto)}</span><RowActions id={x.id} onEdit={() => { setEditing(x); setModal('ingreso'); }} onDelete={() => remove('ingreso', x.id)} /></div></div>)}</div>}
          </ListCard>

          <ListCard title="Gastos variables" kicker="lo que cambia" action={() => { setEditing(null); setModal('variable'); }}>
            {variables.isLoading ? <LoadingRows /> : !variablesList.length ? <EmptyState title="Dale nombre a cada salida" copy="Comida, gasolina, una reparación: todo cuenta para entender tu ruta." action="Registrar gasto variable" onClick={() => setModal('variable')} testId="button-empty-variable" /> : <div className="space-y-1">{variablesList.slice(0, 8).map((x) => {
              const cat = catMap.get(x.categoria_id) ?? FALLBACK_CAT;
              return <div key={x.id} data-testid={`row-variable-${x.id}`} className="group flex items-center justify-between rounded-xl px-2 py-3 transition hover:bg-white/4"><div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base" style={{ backgroundColor: `${cat.color}26` }}>{cat.icono}</div><div className="min-w-0"><div className="truncate text-sm font-semibold text-white">{cat.nombre}</div><div className="text-xs text-white/45">{dateLabel(x.fecha)}{x.nota ? ` · ${x.nota}` : ''}</div></div></div><div className="flex items-center gap-1"><span className="cosmos-number text-sm font-semibold" style={{ color: cat.color }}>-{money(x.monto)}</span><RowActions id={x.id} onEdit={() => { setEditing(x); setModal('variable'); }} onDelete={() => remove('variable', x.id)} /></div></div>;
            })}</div>}</ListCard>
        </div>

        <ListCard title="Gastos fijos" kicker="lo que sostiene el mes" action={() => { setEditing(null); setModal('fijo'); }}>
          {fijos.isLoading ? <LoadingRows /> : !fijosList.length ? <EmptyState title="Aún no has añadido compromisos" copy="Agrega renta, plan o cualquier gasto que quieras tener presente." action="Añadir gasto fijo" onClick={() => setModal('fijo')} testId="button-empty-fijo" /> : <div className="grid gap-1 sm:grid-cols-2">{fijosList.map((x) => <div key={x.id} data-testid={`row-fijo-${x.id}`} className="group flex items-center justify-between rounded-xl px-2 py-3 transition hover:bg-white/4"><div className="flex items-center gap-3"><div><div className="text-sm font-semibold text-white">{x.nombre}</div><div className="text-xs text-white/45">{x.tipo === 'mensual' ? 'Mensual' : 'Por kilometraje'} · <span className={x.activo ? 'text-[#5de8c4]' : 'text-white/40'}>{x.activo ? 'Activo' : 'Pausado'}</span></div></div></div><div className="flex items-center gap-1"><span className="cosmos-number text-sm text-white/80">{money(x.monto)}</span><RowActions id={x.id} onEdit={() => { setEditing(x); setModal('fijo'); }} onDelete={() => remove('fijo', x.id)} /></div></div>)}</div>}
        </ListCard>
      </div>
      <DetailPrefetchers ids={ids} />
      {modal && <RecordModal kind={modal} record={editing} categorias={catsForModal} pending={createIngreso.isPending || updateIngreso.isPending || createVariable.isPending || updateVariable.isPending || createFijo.isPending || updateFijo.isPending} onClose={close} onSubmit={submit} />}
    </div>
  </Shell>;
}

function KilometrajePage() {
  const queryClient = useQueryClient(); const [modal, setModal] = useState(false); const [editing, setEditing] = useState<Kilometraje | null>(null);
  const list = useListKilometrajes(); const create = useCreateKilometraje(); const update = useUpdateKilometraje(); const removeMutation = useDeleteKilometraje();
  const kms = asList<Kilometraje>(list.data);
  const total = useMemo(() => kms.reduce((a, x) => a + x.km_actuales, 0), [kms]);
  const invalidate = () => { queryClient.invalidateQueries({ queryKey: getListKilometrajesQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetResumenMesActualQueryKey() }); };
  const submit = (data: Record<string, unknown>) => { const done = () => { invalidate(); setModal(false); setEditing(null); }; editing ? update.mutate({ id: editing.id, data: data as never }, { onSuccess: done }) : create.mutate({ data: data as never }, { onSuccess: done }); };
  const remove = (id: number) => { if (window.confirm('¿Eliminar este registro?')) removeMutation.mutate({ id }, { onSuccess: invalidate }); };
  return <Shell><div className="relative z-10 min-h-[100dvh]"><Topbar eyebrow="ruta y mantenimiento" title="Kilometraje" onAdd={() => { setEditing(null); setModal(true); }} /><div className="mx-auto max-w-[1180px] space-y-5 px-5 pb-28 sm:px-8 md:px-10">
    <div className="grid gap-4 sm:grid-cols-3">
      <Metric label="Kilómetros registrados" value={`${total.toLocaleString('es-MX')} km`} icon={<Bike size={19} />} tone="warm" note="Suma de tus registros" />
      <Metric label="Jornadas anotadas" value={`${kms.length}`} icon={<CalendarDays size={19} />} note="Este espacio es tuyo" />
      <Metric label="Odómetro" value="en vivo" icon={<Gauge size={19} />} note="Un odómetro al día te dice qué cuesta cada jornada." />
    </div>
    <section className="cosmos-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/6 px-5 py-4 sm:px-6"><div><div className="cosmos-eyebrow mb-1">historial</div><h2 className="cosmos-title text-lg font-bold">Tus recorridos</h2></div><button onClick={() => { setEditing(null); setModal(true); }} data-testid="button-add-kilometraje" className="cosmos-button-secondary px-3 py-2 text-sm"><Plus size={16} /> <span className="hidden sm:inline">Registrar</span></button></div>
      <div className="p-3 sm:p-4">
        {list.isLoading ? <LoadingRows /> : !kms.length ? <EmptyState title="Tu primera ruta empieza aquí" copy="Anota los kilómetros del odómetro al terminar tu jornada." action="Registrar kilometraje" onClick={() => setModal(true)} testId="button-empty-kilometraje" /> : <div className="space-y-1">{kms.map((x) => <div key={x.id} data-testid={`row-kilometraje-${x.id}`} className="group flex items-center justify-between rounded-xl px-2 py-3 hover:bg-white/4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/6 text-white/70"><Bike size={17} /></div><div><div className="text-sm font-semibold text-white">{x.km_actuales.toLocaleString('es-MX')} km</div><div className="text-xs text-white/45">{dateLabel(x.fecha)}{x.nota ? ` · ${x.nota}` : ''}</div></div></div><RowActions id={x.id} onEdit={() => { setEditing(x); setModal(true); }} onDelete={() => remove(x.id)} /></div>)}</div>}
      </div>
    </section>
  </div>{modal && <RecordModal kind="km" record={editing} pending={create.isPending || update.isPending} onClose={() => { setModal(false); setEditing(null); }} onSubmit={submit} />}</div></Shell>;
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

function RecordModal({ kind, record, categorias, pending, onClose, onSubmit }: { kind: Exclude<ModalKind, null>; record: AnyRecord | null; categorias?: Categoria[]; pending: boolean; onClose: () => void; onSubmit: (data: Record<string, unknown>) => void }) {
  const isIngreso = kind === 'ingreso'; const isVariable = kind === 'variable'; const isFijo = kind === 'fijo'; const isKm = kind === 'km';
  const r = record as Partial<Ingreso & GastoVariable & GastoFijo & Kilometraje> | null;
  const [form, setForm] = useState<Record<string, string | boolean>>({
    fecha: dateValue(r?.fecha), fuente: r?.fuente ?? 'Didi', monto: String(r?.monto ?? ''),
    nota: r?.nota ?? '', categoria_id: String(r?.categoria_id ?? (categorias?.[0]?.id ?? '')), nombre: r?.nombre ?? '',
    tipo: r?.tipo ?? 'mensual', activo: r?.activo ?? true, km_actuales: String(r?.km_actuales ?? ''),
  });
  const set = (key: string, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const base = { ...form };
    if (isVariable) {
      if (!Number(base.categoria_id)) { toast.error('Elige una categoría para este gasto'); return; }
      onSubmit({ fecha: base.fecha, categoria_id: Number(base.categoria_id), monto: Number(base.monto), nota: String(base.nota) });
    }
    else if (isIngreso) onSubmit({ fecha: base.fecha, fuente: base.fuente, monto: Number(base.monto), nota: String(base.nota) });
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
    <Route path="/categorias" component={CategoriesPage} />
    <Route component={() => <Shell><div className="relative z-10 flex min-h-[100dvh] items-center justify-center p-8 text-center"><div><h1 className="cosmos-title text-3xl font-bold">Esta ruta no existe</h1><Link href="/" data-testid="link-back-home" className="mt-3 inline-block text-white underline decoration-white/25 underline-offset-4">Volver al resumen</Link></div></div></Shell>} />
  </Switch><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
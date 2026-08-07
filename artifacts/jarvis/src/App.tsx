import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, Route, Switch, useLocation } from 'wouter';
import {
  Activity, ArrowDownLeft, ArrowUpRight, Bike, CalendarDays, Check, ChevronRight, CircleDollarSign,
  Ellipsis, Gauge, Menu, Pencil, Plus, Receipt, RefreshCw, Save, Settings2, Trash2, TrendingUp, X,
} from 'lucide-react';
import {
  useHealthCheck, useListIngresos, useCreateIngreso, useGetIngreso, useUpdateIngreso, useDeleteIngreso,
  useListGastosFijos, useCreateGastoFijo, useGetGastoFijo, useUpdateGastoFijo, useDeleteGastoFijo,
  useListGastosVariables, useCreateGastoVariable, useGetGastoVariable, useUpdateGastoVariable, useDeleteGastoVariable,
  useListKilometrajes, useCreateKilometraje, useGetKilometraje, useUpdateKilometraje, useDeleteKilometraje,
  useGetResumenMesActual, getListIngresosQueryKey, getListGastosFijosQueryKey, getListGastosVariablesQueryKey,
  getListKilometrajesQueryKey, getGetResumenMesActualQueryKey,
} from '@workspace/api-client-react';
import type { GastoFijo, GastoVariable, Ingreso, Kilometraje } from '@workspace/api-client-react';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

const queryClient = new QueryClient();
type ModalKind = 'ingreso' | 'variable' | 'fijo' | 'km' | null;
type AnyRecord = Ingreso | GastoVariable | GastoFijo | Kilometraje;

const money = (value = 0) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
const dateValue = (date?: string) => date ? date.slice(0, 10) : new Date().toISOString().slice(0, 10);
const dateLabel = (date?: string) => date ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(`${date.slice(0, 10)}T12:00:00`)) : 'Sin fecha';
const monthLabel = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(new Date());
const sourceLabel: Record<string, string> = { Didi: 'Didi', papa: 'Papá', amigo: 'Amigo', otro: 'Otro' };

function DetailPrefetchers({ ids }: { ids: { ingreso?: number; fijo?: number; variable?: number; km?: number } }) {
  useHealthCheck({ query: { enabled: false, queryKey: ['/api/healthz'] } });
  useGetIngreso(ids.ingreso ?? 0, { query: { enabled: Boolean(ids.ingreso), queryKey: [`/api/ingresos/${ids.ingreso ?? 0}`] } });
  useGetGastoFijo(ids.fijo ?? 0, { query: { enabled: Boolean(ids.fijo), queryKey: [`/api/gastos-fijos/${ids.fijo ?? 0}`] } });
  useGetGastoVariable(ids.variable ?? 0, { query: { enabled: Boolean(ids.variable), queryKey: [`/api/gastos-variables/${ids.variable ?? 0}`] } });
  useGetKilometraje(ids.km ?? 0, { query: { enabled: Boolean(ids.km), queryKey: [`/api/kilometrajes/${ids.km ?? 0}`] } });
  return null;
}

function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  return (
    <div className="min-h-[100dvh] bg-background">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[232px] flex-col bg-sidebar px-5 py-7 text-sidebar-foreground md:flex">
        <div className="mb-12 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-primary text-primary-foreground shadow-sm"><Activity size={21} strokeWidth={2.6} /></div>
          <div><div className="font-mono text-[11px] uppercase tracking-[.22em] text-primary">personal</div><div className="text-xl font-extrabold tracking-tight">jarvis</div></div>
        </div>
        <nav className="space-y-2">
          <NavItem href="/" active={location === '/'} icon={<CircleDollarSign size={18} />} label="Resumen" testId="link-resumen" />
          <NavItem href="/kilometraje" active={location === '/kilometraje'} icon={<Bike size={18} />} label="Kilometraje" testId="link-kilometraje" />
        </nav>
        <div className="mt-auto rounded-2xl border border-sidebar-border bg-sidebar-accent p-4">
          <div className="mb-2 flex items-center gap-2 text-primary"><Gauge size={16} /><span className="font-mono text-[10px] uppercase tracking-widest">tu ritmo</span></div>
          <p className="text-sm leading-5 text-sidebar-foreground/75">Registra lo que pasa hoy. El panorama aparece solo.</p>
        </div>
        <div className="mt-5 flex items-center gap-2 px-2 text-sidebar-foreground/45"><Settings2 size={15} /><span className="text-xs">Tu espacio financiero</span></div>
      </aside>
      <main className="md:pl-[232px]">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-[72px] items-center justify-around border-t border-border bg-card/95 px-8 backdrop-blur md:hidden">
        <NavItem href="/" active={location === '/'} icon={<CircleDollarSign size={20} />} label="Resumen" testId="mobile-link-resumen" />
        <NavItem href="/kilometraje" active={location === '/kilometraje'} icon={<Bike size={20} />} label="Kilometraje" testId="mobile-link-kilometraje" />
      </nav>
    </div>
  );
}

function NavItem({ href, active, icon, label, testId }: { href: string; active: boolean; icon: React.ReactNode; label: string; testId: string }) {
  return <Link href={href} data-testid={testId} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? 'bg-sidebar-accent text-primary' : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'} md:w-full md:justify-start`}>
    {icon}<span className="md:inline">{label}</span>
  </Link>;
}

function Topbar({ title, eyebrow, onAdd }: { title: string; eyebrow: string; onAdd?: () => void }) {
  return <header className="mx-auto flex max-w-[1180px] items-start justify-between px-5 pb-7 pt-8 sm:px-8 md:px-10 md:pt-12">
    <div><div className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[.2em] text-muted-foreground">{eyebrow}</div><h1 className="text-3xl font-extrabold tracking-[-.04em] text-foreground sm:text-4xl">{title}</h1></div>
    {onAdd && <button onClick={onAdd} data-testid="button-add-record" className="group flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-[0_8px_20px_hsl(38_87%_62%_/_0.2)] transition hover:-translate-y-0.5 active:translate-y-0"><Plus size={18} /><span className="hidden sm:inline">Registrar</span></button>}
  </header>;
}

function Metric({ label, value, icon, tone = 'default', note }: { label: string; value: string; icon: React.ReactNode; tone?: string; note?: string }) {
  return <div className={`jarvis-card rounded-2xl border p-5 ${tone === 'green' ? 'border-[hsl(164_35%_54%_/_0.3)] bg-[hsl(164_35%_54%_/_0.08)]' : tone === 'warm' ? 'border-[hsl(38_87%_62%_/_0.35)] bg-[hsl(38_87%_62%_/_0.11)]' : 'border-card-border bg-card'}`}>
    <div className="mb-5 flex items-center justify-between text-muted-foreground"><span className="text-xs font-semibold uppercase tracking-wider">{label}</span><span className="text-primary">{icon}</span></div>
    <div data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`} className="text-2xl font-extrabold tracking-tight sm:text-[28px]">{value}</div>
    {note && <div className="mt-1 text-xs text-muted-foreground">{note}</div>}
  </div>;
}

function EmptyState({ title, copy, action, onClick, testId }: { title: string; copy: string; action: string; onClick: () => void; testId: string }) {
  return <div className="rounded-2xl border border-dashed border-border bg-card/45 px-5 py-9 text-center"><div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground"><Receipt size={19} /></div><p className="font-bold">{title}</p><p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">{copy}</p><button onClick={onClick} data-testid={testId} className="mt-5 text-sm font-bold text-accent underline decoration-accent/30 underline-offset-4 hover:decoration-accent">{action}</button></div>;
}

function RowActions({ onEdit, onDelete, id }: { onEdit: () => void; onDelete: () => void; id: number }) {
  return <div className="flex items-center gap-1 opacity-70 transition group-hover:opacity-100"><button onClick={onEdit} data-testid={`button-edit-${id}`} aria-label="Editar registro" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil size={15} /></button><button onClick={onDelete} data-testid={`button-delete-${id}`} aria-label="Eliminar registro" className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={15} /></button></div>;
}

function ListCard({ title, kicker, action, children, accent = 'gold' }: { title: string; kicker: string; action: () => void; children: React.ReactNode; accent?: string }) {
  return <section className="jarvis-card overflow-hidden rounded-2xl border border-card-border bg-card">
    <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6"><div><div className={`mb-1 font-mono text-[10px] uppercase tracking-[.18em] ${accent === 'coral' ? 'text-accent' : 'text-primary'}`}>{kicker}</div><h2 className="text-lg font-extrabold tracking-tight">{title}</h2></div><button onClick={action} data-testid={`button-add-${kicker.toLowerCase().replaceAll(' ', '-')}`} className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-bold text-accent transition hover:bg-accent/10"><Plus size={17} /> <span className="hidden sm:inline">Añadir</span></button></div>
    <div className="p-3 sm:p-4">{children}</div>
  </section>;
}

function LoadingRows() { return <div className="space-y-3 p-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />)}</div>; }

function Dashboard() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<ModalKind>(null);
  const [editing, setEditing] = useState<AnyRecord | null>(null);
  const ingresos = useListIngresos(); const fijos = useListGastosFijos(); const variables = useListGastosVariables();
  const summary = useGetResumenMesActual();
  const createIngreso = useCreateIngreso(); const updateIngreso = useUpdateIngreso(); const deleteIngreso = useDeleteIngreso();
  const createFijo = useCreateGastoFijo(); const updateFijo = useUpdateGastoFijo(); const deleteFijo = useDeleteGastoFijo();
  const createVariable = useCreateGastoVariable(); const updateVariable = useUpdateGastoVariable(); const deleteVariable = useDeleteGastoVariable();
  const ids = { ingreso: editing && 'fuente' in editing ? editing.id : undefined, fijo: editing && 'activo' in editing ? editing.id : undefined, variable: editing && 'categoria' in editing ? editing.id : undefined };
  const totals = useMemo(() => ({ income: (ingresos.data ?? []).reduce((a, x) => a + x.monto, 0), fixed: (fijos.data ?? []).filter(x => x.activo).reduce((a, x) => a + x.monto, 0), variable: (variables.data ?? []).reduce((a, x) => a + x.monto, 0) }), [ingresos.data, fijos.data, variables.data]);
  const sum = summary.data ?? { total_ingresos: totals.income, total_gastos_fijos: totals.fixed, total_gastos_variables: totals.variable, saldo: totals.income - totals.fixed - totals.variable };
  const invalidate = () => { queryClient.invalidateQueries({ queryKey: getListIngresosQueryKey() }); queryClient.invalidateQueries({ queryKey: getListGastosFijosQueryKey() }); queryClient.invalidateQueries({ queryKey: getListGastosVariablesQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetResumenMesActualQueryKey() }); };
  const close = () => { setModal(null); setEditing(null); };
  const submit = (data: Record<string, unknown>) => {
    const done = () => { invalidate(); close(); };
    if (modal === 'ingreso') editing ? updateIngreso.mutate({ id: editing.id, data: data as never }, { onSuccess: done }) : createIngreso.mutate({ data: data as never }, { onSuccess: done });
    if (modal === 'variable') editing ? updateVariable.mutate({ id: editing.id, data: data as never }, { onSuccess: done }) : createVariable.mutate({ data: data as never }, { onSuccess: done });
    if (modal === 'fijo') editing ? updateFijo.mutate({ id: editing.id, data: data as never }, { onSuccess: done }) : createFijo.mutate({ data: data as never }, { onSuccess: done });
  };
  const remove = (kind: ModalKind, id: number) => { if (!window.confirm('¿Eliminar este registro?')) return; const done = invalidate; if (kind === 'ingreso') deleteIngreso.mutate({ id }, { onSuccess: done }); if (kind === 'variable') deleteVariable.mutate({ id }, { onSuccess: done }); if (kind === 'fijo') deleteFijo.mutate({ id }, { onSuccess: done }); };
  return <Shell><div className="jarvis-grid min-h-[100dvh]">
    <Topbar eyebrow={`visión de ${monthLabel}`} title="Que tu dinero te siga el paso." onAdd={() => setModal('ingreso')} />
    <div className="mx-auto max-w-[1180px] space-y-6 px-5 pb-28 sm:px-8 md:px-10">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Saldo del mes" value={money(sum.saldo)} icon={<TrendingUp size={19} />} tone="green" note={sum.saldo >= 0 ? 'Vas construyendo margen' : 'Ajusta el ritmo esta semana'} />
        <Metric label="Ingresos" value={money(sum.total_ingresos)} icon={<ArrowUpRight size={19} />} tone="warm" note={`${(ingresos.data ?? []).length} registros este mes`} />
        <Metric label="Gastos" value={money(sum.total_gastos_fijos + sum.total_gastos_variables)} icon={<ArrowDownLeft size={19} />} note={`${money(sum.total_gastos_fijos)} fijos · ${money(sum.total_gastos_variables)} variables`} />
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground"><CalendarDays size={16} className="text-primary" /><span>Este mes llevas <strong className="text-foreground">{money(sum.saldo)}</strong> disponibles para lo que sigue.</span></div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ListCard title="Ingresos" kicker="dinero que llegó" action={() => { setEditing(null); setModal('ingreso'); }}>
          {ingresos.isLoading ? <LoadingRows /> : !ingresos.data?.length ? <EmptyState title="Todavía no hay ingresos" copy="Anota tu primera jornada para empezar a ver el movimiento." action="Registrar ingreso" onClick={() => setModal('ingreso')} testId="button-empty-ingreso" /> : <div className="space-y-1">{ingresos.data.slice(0, 6).map((x) => <div key={x.id} data-testid={`row-ingreso-${x.id}`} className="group flex items-center justify-between rounded-xl px-2 py-3 transition hover:bg-muted/60"><div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(38_87%_62%_/_0.16)] text-primary"><ArrowUpRight size={17} /></div><div className="min-w-0"><div className="truncate text-sm font-bold">{sourceLabel[x.fuente]}</div><div className="text-xs text-muted-foreground">{dateLabel(x.fecha)}{x.nota ? ` · ${x.nota}` : ''}</div></div></div><div className="flex items-center gap-1"><span className="font-mono text-sm font-medium text-[hsl(164_35%_42%)]">+{money(x.monto)}</span><RowActions id={x.id} onEdit={() => { setEditing(x); setModal('ingreso'); }} onDelete={() => remove('ingreso', x.id)} /></div></div>)}</div>}
        </ListCard>
        <ListCard title="Gastos variables" kicker="lo que cambia" accent="coral" action={() => { setEditing(null); setModal('variable'); }}>
          {variables.isLoading ? <LoadingRows /> : !variables.data?.length ? <EmptyState title="Dale nombre a cada salida" copy="Comida, gasolina, una reparación: todo cuenta para entender tu ruta." action="Registrar gasto variable" onClick={() => setModal('variable')} testId="button-empty-variable" /> : <div className="space-y-1">{variables.data.slice(0, 6).map((x) => <div key={x.id} data-testid={`row-variable-${x.id}`} className="group flex items-center justify-between rounded-xl px-2 py-3 transition hover:bg-muted/60"><div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent"><ArrowDownLeft size={17} /></div><div className="min-w-0"><div className="truncate text-sm font-bold">{x.categoria}</div><div className="text-xs text-muted-foreground">{dateLabel(x.fecha)}{x.nota ? ` · ${x.nota}` : ''}</div></div></div><div className="flex items-center gap-1"><span className="font-mono text-sm font-medium text-accent">-{money(x.monto)}</span><RowActions id={x.id} onEdit={() => { setEditing(x); setModal('variable'); }} onDelete={() => remove('variable', x.id)} /></div></div>)}</div>}
        </ListCard>
      </div>
      <ListCard title="Gastos fijos" kicker="lo que sostiene el mes" action={() => { setEditing(null); setModal('fijo'); }}>
        {fijos.isLoading ? <LoadingRows /> : !fijos.data?.length ? <EmptyState title="Aún no has añadido compromisos" copy="Agrega renta, plan o cualquier gasto que quieras tener presente." action="Añadir gasto fijo" onClick={() => setModal('fijo')} testId="button-empty-fijo" /> : <div className="grid gap-1 sm:grid-cols-2">{fijos.data.map((x) => <div key={x.id} data-testid={`row-fijo-${x.id}`} className="group flex items-center justify-between rounded-xl px-2 py-3 transition hover:bg-muted/60"><div className="flex items-center gap-3"><div className={`h-2.5 w-2.5 rounded-full ${x.activo ? 'bg-[hsl(164_35%_54%)]' : 'bg-muted-foreground/30'}`} /><div><div className="text-sm font-bold">{x.nombre}</div><div className="text-xs text-muted-foreground">{x.tipo === 'mensual' ? 'Mensual' : 'Por kilometraje'} · {x.activo ? 'Activo' : 'Pausado'}</div></div></div><div className="flex items-center gap-1"><span className="font-mono text-sm">{money(x.monto)}</span><RowActions id={x.id} onEdit={() => { setEditing(x); setModal('fijo'); }} onDelete={() => remove('fijo', x.id)} /></div></div>)}</div>}
      </ListCard>
    </div>
    <DetailPrefetchers ids={ids} />
    {modal && <RecordModal kind={modal} record={editing} pending={createIngreso.isPending || updateIngreso.isPending || createVariable.isPending || updateVariable.isPending || createFijo.isPending || updateFijo.isPending} onClose={close} onSubmit={submit} />}
  </div></Shell>;
}

function KilometrajePage() {
  const queryClient = useQueryClient(); const [modal, setModal] = useState(false); const [editing, setEditing] = useState<Kilometraje | null>(null);
  const list = useListKilometrajes(); const create = useCreateKilometraje(); const update = useUpdateKilometraje(); const removeMutation = useDeleteKilometraje();
  const total = useMemo(() => (list.data ?? []).reduce((a, x) => a + x.km_actuales, 0), [list.data]);
  const invalidate = () => { queryClient.invalidateQueries({ queryKey: getListKilometrajesQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetResumenMesActualQueryKey() }); };
  const submit = (data: Record<string, unknown>) => { const done = () => { invalidate(); setModal(false); setEditing(null); }; editing ? update.mutate({ id: editing.id, data: data as never }, { onSuccess: done }) : create.mutate({ data: data as never }, { onSuccess: done }); };
  const remove = (id: number) => { if (window.confirm('¿Eliminar este registro?')) removeMutation.mutate({ id }, { onSuccess: invalidate }); };
  return <Shell><div className="jarvis-grid min-h-[100dvh]"><Topbar eyebrow="ruta y mantenimiento" title="Kilometraje" onAdd={() => { setEditing(null); setModal(true); }} /><div className="mx-auto max-w-[1180px] space-y-6 px-5 pb-28 sm:px-8 md:px-10">
    <div className="grid gap-3 sm:grid-cols-3"><Metric label="Kilómetros registrados" value={`${total.toLocaleString('es-MX')} km`} icon={<Bike size={19} />} tone="warm" note="Suma de tus registros" /><Metric label="Jornadas anotadas" value={`${list.data?.length ?? 0}`} icon={<CalendarDays size={19} />} note="Este espacio es tuyo" /><div className="rounded-2xl border border-secondary bg-secondary px-5 py-5 text-secondary-foreground"><div className="mb-4 flex items-center gap-2 text-primary"><Gauge size={18} /><span className="font-mono text-[10px] uppercase tracking-widest">recordatorio</span></div><p className="text-sm leading-5 text-secondary-foreground/75">Un odómetro actualizado te ayuda a saber qué cuesta realmente cada día.</p></div></div>
    <section className="jarvis-card rounded-2xl border border-card-border bg-card"><div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6"><div><div className="mb-1 font-mono text-[10px] uppercase tracking-[.18em] text-primary">historial</div><h2 className="text-lg font-extrabold tracking-tight">Tus recorridos</h2></div><button onClick={() => { setEditing(null); setModal(true); }} data-testid="button-add-kilometraje" className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"><Plus size={17} /> <span className="hidden sm:inline">Registrar</span></button></div><div className="p-3 sm:p-4">
      {list.isLoading ? <LoadingRows /> : !list.data?.length ? <EmptyState title="Tu primera ruta empieza aquí" copy="Anota los kilómetros del odómetro al terminar tu jornada." action="Registrar kilometraje" onClick={() => setModal(true)} testId="button-empty-kilometraje" /> : <div className="space-y-1">{list.data.map((x) => <div key={x.id} data-testid={`row-kilometraje-${x.id}`} className="group flex items-center justify-between rounded-xl px-2 py-3 hover:bg-muted/60"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary"><Bike size={17} /></div><div><div className="text-sm font-bold">{x.km_actuales.toLocaleString('es-MX')} km</div><div className="text-xs text-muted-foreground">{dateLabel(x.fecha)}{x.nota ? ` · ${x.nota}` : ''}</div></div></div><RowActions id={x.id} onEdit={() => { setEditing(x); setModal(true); }} onDelete={() => remove(x.id)} /></div>)}</div>}
    </div></section>
  </div>{modal && <RecordModal kind="km" record={editing} pending={create.isPending || update.isPending} onClose={() => { setModal(false); setEditing(null); }} onSubmit={submit} />}</div></Shell>;
}

function RecordModal({ kind, record, pending, onClose, onSubmit }: { kind: Exclude<ModalKind, null>; record: AnyRecord | null; pending: boolean; onClose: () => void; onSubmit: (data: Record<string, unknown>) => void }) {
  const isIngreso = kind === 'ingreso'; const isVariable = kind === 'variable'; const isFijo = kind === 'fijo'; const isKm = kind === 'km';
  const r = record as Partial<Ingreso & GastoVariable & GastoFijo & Kilometraje> | null;
  const [form, setForm] = useState<Record<string, string | boolean>>({ fecha: dateValue(r?.fecha), fuente: r?.fuente ?? 'Didi', monto: String(r?.monto ?? ''), nota: r?.nota ?? '', categoria: r?.categoria ?? '', nombre: r?.nombre ?? '', tipo: r?.tipo ?? 'mensual', activo: r?.activo ?? true, km_actuales: String(r?.km_actuales ?? '') });
  const set = (key: string, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: React.FormEvent) => { event.preventDefault(); const data: Record<string, unknown> = { ...form, monto: Number(form.monto), km_actuales: Number(form.km_actuales) }; if (isIngreso) delete data.km_actuales; if (!isKm) delete data.km_actuales; if (!isFijo) { delete data.nombre; delete data.tipo; delete data.activo; } if (!isVariable) delete data.categoria; if (!isIngreso && !isVariable) delete data.fuente; onSubmit(data); };
  const title = isIngreso ? (record ? 'Editar ingreso' : 'Nuevo ingreso') : isVariable ? (record ? 'Editar gasto variable' : 'Nuevo gasto variable') : isFijo ? (record ? 'Editar gasto fijo' : 'Nuevo gasto fijo') : (record ? 'Editar kilometraje' : 'Registrar kilometraje');
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[hsl(168_27%_17%_/_0.45)] p-0 backdrop-blur-sm sm:items-center sm:p-4"><div role="dialog" aria-modal="true" className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[24px] border border-border bg-card p-5 shadow-2xl sm:rounded-[24px] sm:p-7">
    <div className="mb-6 flex items-start justify-between"><div><div className="mb-1 font-mono text-[10px] uppercase tracking-[.18em] text-primary">jarvis / registro</div><h2 className="text-2xl font-extrabold tracking-tight">{title}</h2></div><button onClick={onClose} data-testid="button-close-modal" className="rounded-xl p-2 text-muted-foreground hover:bg-muted"><X size={20} /></button></div>
    <form onSubmit={submit} className="space-y-4">
      {isFijo ? <><Field label="Nombre"><input required value={String(form.nombre)} onChange={e => set('nombre', e.target.value)} data-testid="input-fijo-nombre" placeholder="Ej. renta, plan de datos" /></Field><Field label="Monto"><input required min="0" step="0.01" type="number" value={String(form.monto)} onChange={e => set('monto', e.target.value)} data-testid="input-fijo-monto" placeholder="0" /></Field><Field label="Tipo"><select value={String(form.tipo)} onChange={e => set('tipo', e.target.value)} data-testid="select-fijo-tipo"><option value="mensual">Mensual</option><option value="por_kilometraje">Por kilometraje</option></select></Field><label className="flex cursor-pointer items-center gap-3 rounded-xl bg-muted/60 p-3 text-sm font-semibold"><input type="checkbox" checked={Boolean(form.activo)} onChange={e => set('activo', e.target.checked)} data-testid="checkbox-fijo-activo" className="h-4 w-4 accent-[hsl(38_87%_62%)]" /> Está activo este mes</label></> : <><Field label="Fecha"><input required type="date" value={String(form.fecha)} onChange={e => set('fecha', e.target.value)} data-testid={`input-${kind}-fecha`} /></Field>{isIngreso && <Field label="Fuente"><select value={String(form.fuente)} onChange={e => set('fuente', e.target.value)} data-testid="select-ingreso-fuente"><option value="Didi">Didi</option><option value="papa">Papá</option><option value="amigo">Amigo</option><option value="otro">Otro</option></select></Field>}{isVariable && <Field label="Categoría"><input required value={String(form.categoria)} onChange={e => set('categoria', e.target.value)} data-testid="input-variable-categoria" placeholder="Gasolina, comida, reparación..." /></Field>}{isKm ? <Field label="Kilómetros actuales"><input required min="0" step="0.1" type="number" value={String(form.km_actuales)} onChange={e => set('km_actuales', e.target.value)} data-testid="input-km-actuales" placeholder="0" /></Field> : <Field label="Monto"><input required min="0" step="0.01" type="number" value={String(form.monto)} onChange={e => set('monto', e.target.value)} data-testid={`input-${kind}-monto`} placeholder="0" /></Field>}<Field label="Nota" optional><textarea value={String(form.nota)} onChange={e => set('nota', e.target.value)} data-testid={`input-${kind}-nota`} placeholder="Un detalle para tu yo del futuro" rows={3} /></Field></>}
      <button disabled={pending} type="submit" data-testid="button-save-record" className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-extrabold text-primary-foreground transition hover:brightness-95 disabled:cursor-wait disabled:opacity-60">{pending ? <RefreshCw size={17} className="animate-spin" /> : <Save size={17} />}{pending ? 'Guardando…' : 'Guardar registro'}</button>
    </form>
  </div></div>;
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-sm font-bold">{label} {optional && <span className="font-normal text-muted-foreground">(opcional)</span>}</span>{children}</label>; }

function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><Switch><Route path="/" component={Dashboard} /><Route path="/kilometraje" component={KilometrajePage} /><Route component={() => <Shell><div className="flex min-h-[100dvh] items-center justify-center p-8 text-center"><div><h1 className="text-3xl font-extrabold">Esta ruta no existe</h1><Link href="/" data-testid="link-back-home" className="mt-3 inline-block text-accent underline">Volver al resumen</Link></div></div></Shell>} /></Switch><Toaster /></TooltipProvider></QueryClientProvider>; }

export default App;
export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  avatar: string;
  rol: 'admin' | 'usuario';
  creado_en: string;
}

export interface DemoUserItem {
  id: number;
  nombre: string;
  email: string;
  avatar: string;
  rol: string;
}

export interface AuthResponse {
  token: string;
  usuario: Usuario;
}

export interface MetaAhorro {
  id: number;
  usuario_id: number;
  nombre: string;
  monto_objetivo: number;
  monto_actual: number;
  porcentaje: number;
  icono: string;
  color: string;
  fecha_limite?: string;
  medio_pago_id?: number;
  nota: string;
  activo: boolean;
}

export interface MetaAhorroInput {
  nombre: string;
  monto_objetivo: number;
  monto_actual?: number;
  icono?: string;
  color?: string;
  fecha_limite?: string;
  medio_pago_id?: number;
  nota?: string;
  activo?: boolean;
}

export interface MovimientoAhorro {
  id: number;
  usuario_id: number;
  meta_ahorro_id: number;
  tipo: 'aporte' | 'retiro';
  monto: number;
  fecha: string;
  medio_pago_id?: number;
  nota: string;
}

export interface MovimientoAhorroInput {
  meta_ahorro_id: number;
  tipo: 'aporte' | 'retiro';
  monto: number;
  fecha?: string;
  medio_pago_id?: number;
  nota?: string;
}

export type PrioridadMeta = 'alta' | 'media' | 'baja';

export interface MetaDiaria {
  id: number;
  usuario_id: number;
  titulo: string;
  descripcion: string;
  fecha: string;
  prioridad: PrioridadMeta;
  hora?: string | null;
  completada: boolean;
  orden: number;
  creado_en?: string | null;
  completado_en?: string | null;
}

export interface MetaDiariaInput {
  titulo: string;
  descripcion?: string;
  fecha: string;
  prioridad?: PrioridadMeta;
  hora?: string | null;
  orden?: number;
}

export interface MetaDiariaWidgetItem {
  id: number;
  titulo: string;
  prioridad: PrioridadMeta;
  hora?: string | null;
  completada: boolean;
}

export interface MetasDiariasResumen {
  fecha: string;
  total: number;
  completadas: number;
  pendientes: number;
  porcentaje: number;
  actualizado_en: string;
  metas: MetaDiariaWidgetItem[];
}

export interface FinanzasMedioWidgetItem {
  id: number;
  nombre: string;
  icono: string;
  saldo_actual: number;
}

export interface FinanzasWidgetResumen {
  fecha: string;
  saldo_total: number;
  gastos_hoy: number;
  ingresos_hoy: number;
  balance_hoy: number;
  actualizado_en: string;
  medios_principales: FinanzasMedioWidgetItem[];
}

export interface HabitoWidgetItem {
  id: number;
  nombre: string;
  icono: string;
  color: string;
  racha: number;
  completado: boolean;
}

export interface HabitosWidgetResumen {
  fecha: string;
  total: number;
  completados: number;
  pendientes: number;
  porcentaje: number;
  actualizado_en: string;
  habitos: HabitoWidgetItem[];
}

export interface MotoWidgetResumen {
  km_actuales: number;
  km_ultimo_cambio: number;
  km_proximo_cambio: number;
  km_restantes: number;
  porcentaje_vida_aceite: number;
  alerta: boolean;
  actualizado_en: string;
}

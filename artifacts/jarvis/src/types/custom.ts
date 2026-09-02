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

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@workspace/api-client-react';
import type { AuthResponse, DemoUserItem, MetaAhorro, MetaAhorroInput, MovimientoAhorro, MovimientoAhorroInput, Usuario } from '../types/custom';

// Query Keys
export const getAhorrosQueryKey = () => ['/api/ahorros'] as const;
export const getAhorroMovimientosQueryKey = (id: number) => [`/api/ahorros/${id}/movimientos`] as const;
export const getAuthMeQueryKey = () => ['/api/auth/me'] as const;
export const getDemoUsersQueryKey = () => ['/api/auth/demo-users'] as const;

// Ahorros Hooks
export function useListAhorros() {
  return useQuery<MetaAhorro[]>({
    queryKey: getAhorrosQueryKey(),
    queryFn: () => customFetch<MetaAhorro[]>('/api/ahorros', { method: 'GET' }),
  });
}

export function useCreateAhorro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MetaAhorroInput) =>
      customFetch<MetaAhorro>('/api/ahorros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getAhorrosQueryKey() });
      queryClient.invalidateQueries({ queryKey: ['/api/resumen/mes-actual'] });
    },
  });
}

export function useUpdateAhorro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<MetaAhorroInput> }) =>
      customFetch<MetaAhorro>(`/api/ahorros/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getAhorrosQueryKey() });
      queryClient.invalidateQueries({ queryKey: ['/api/resumen/mes-actual'] });
    },
  });
}

export function useDeleteAhorro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<void>(`/api/ahorros/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getAhorrosQueryKey() });
      queryClient.invalidateQueries({ queryKey: ['/api/resumen/mes-actual'] });
    },
  });
}

export function useAportarAhorro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: MovimientoAhorroInput }) =>
      customFetch<MetaAhorro>(`/api/ahorros/${id}/aportar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: getAhorrosQueryKey() });
      queryClient.invalidateQueries({ queryKey: getAhorroMovimientosQueryKey(variables.id) });
      queryClient.invalidateQueries({ queryKey: ['/api/resumen/mes-actual'] });
      queryClient.invalidateQueries({ queryKey: ['/api/medios-pago'] });
    },
  });
}

export function useListMovimientosAhorro(metaId: number, enabled = true) {
  return useQuery<MovimientoAhorro[]>({
    queryKey: getAhorroMovimientosQueryKey(metaId),
    queryFn: () => customFetch<MovimientoAhorro[]>(`/api/ahorros/${metaId}/movimientos`, { method: 'GET' }),
    enabled: enabled && metaId > 0,
  });
}

// Auth API Functions
export async function apiLogin(email: string, password: string): Promise<AuthResponse> {
  return customFetch<AuthResponse>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export async function apiRegister(nombre: string, email: string, password: string, avatar = '🚀'): Promise<AuthResponse> {
  return customFetch<AuthResponse>('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, email, password, avatar }),
  });
}

export async function apiSwitchDemo(userId: number): Promise<AuthResponse> {
  return customFetch<AuthResponse>('/api/auth/switch-demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  });
}

export async function apiGetMe(): Promise<Usuario> {
  return customFetch<Usuario>('/api/auth/me', { method: 'GET' });
}

export async function apiGetDemoUsers(): Promise<DemoUserItem[]> {
  return customFetch<DemoUserItem[]>('/api/auth/demo-users', { method: 'GET' });
}

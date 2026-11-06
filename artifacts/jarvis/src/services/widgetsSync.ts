import { Capacitor, registerPlugin } from '@capacitor/core';
import type {
  FinanzasWidgetResumen,
  HabitosWidgetResumen,
  MetasDiariasResumen,
  MotoWidgetResumen,
} from '../types/custom';

interface JarvisWidgetsPlugin {
  updateMetas(options: { json: string }): Promise<{ updated: boolean }>;
  updateFinanzas(options: { json: string }): Promise<{ updated: boolean }>;
  updateHabitos(options: { json: string }): Promise<{ updated: boolean }>;
  updateMoto(options: { json: string }): Promise<{ updated: boolean }>;
  clearAll(): Promise<void>;
}

// Registramos el plugin unificado
const JarvisWidgets = registerPlugin<JarvisWidgetsPlugin>('JarvisWidgets');

export const isNativeAndroid = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

/** Envía al widget de Metas la instantánea del día. */
export async function syncMetasWidget(summary: MetasDiariasResumen): Promise<void> {
  if (!isNativeAndroid()) return;
  try {
    await JarvisWidgets.updateMetas({ json: JSON.stringify(summary) });
  } catch (error) {
    console.warn('No se pudo actualizar el widget de metas', error);
  }
}

/** Envía al widget de Finanzas el saldo y flujo de hoy. */
export async function syncFinanzasWidget(summary: FinanzasWidgetResumen): Promise<void> {
  if (!isNativeAndroid()) return;
  try {
    await JarvisWidgets.updateFinanzas({ json: JSON.stringify(summary) });
  } catch (error) {
    console.warn('No se pudo actualizar el widget de finanzas', error);
  }
}

/** Envía al widget de Hábitos el cumplimiento y rachas. */
export async function syncHabitosWidget(summary: HabitosWidgetResumen): Promise<void> {
  if (!isNativeAndroid()) return;
  try {
    await JarvisWidgets.updateHabitos({ json: JSON.stringify(summary) });
  } catch (error) {
    console.warn('No se pudo actualizar el widget de habitos', error);
  }
}

/** Envía al widget de Moto el estado de aceite y odómetro. */
export async function syncMotoWidget(summary: MotoWidgetResumen): Promise<void> {
  if (!isNativeAndroid()) return;
  try {
    await JarvisWidgets.updateMoto({ json: JSON.stringify(summary) });
  } catch (error) {
    console.warn('No se pudo actualizar el widget de moto', error);
  }
}

/** Borra todas las instantáneas de los widgets al cerrar sesión. */
export async function clearAllJarvisWidgets(): Promise<void> {
  if (!isNativeAndroid()) return;
  try {
    await JarvisWidgets.clearAll();
  } catch (error) {
    console.warn('No se pudieron limpiar los widgets de Jarvis', error);
  }
}

// Compatibilidad hacia atrás
export const clearMetasWidget = clearAllJarvisWidgets;

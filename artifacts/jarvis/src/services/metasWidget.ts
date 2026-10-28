import { Capacitor, registerPlugin } from '@capacitor/core';

import type { MetasDiariasResumen } from '../types/custom';

interface MetasWidgetPlugin {
  update(options: { json: string }): Promise<{ updated: boolean }>;
  clear(): Promise<void>;
}

const MetasWidget = registerPlugin<MetasWidgetPlugin>('MetasWidget');

export const isNativeAndroid = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

/**
 * Envía al widget nativo la última instantánea de metas.
 * En web es un no-op para no romper el build de Vite.
 */
export async function syncMetasWidget(summary: MetasDiariasResumen): Promise<void> {
  if (!isNativeAndroid()) return;

  try {
    await MetasWidget.update({ json: JSON.stringify(summary) });
  } catch (error) {
    console.warn('No se pudo actualizar el widget de metas', error);
  }
}

/** Borra la instantánea del widget al cerrar sesión o invalidar el token. */
export async function clearMetasWidget(): Promise<void> {
  if (!isNativeAndroid()) return;

  try {
    await MetasWidget.clear();
  } catch (error) {
    console.warn('No se pudo limpiar el widget de metas', error);
  }
}

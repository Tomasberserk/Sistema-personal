import { Capacitor, registerPlugin } from '@capacitor/core';

interface JarvisDevicePlugin {
  setTorch(options: { enabled: boolean }): Promise<{ success: boolean; enabled: boolean; cameraId?: string }>;
  openApp(options: { packageName?: string; url?: string }): Promise<{ success: boolean }>;
  getBatteryStatus(): Promise<{ success: boolean; percentage: number; isCharging: boolean; temperatureC: number }>;
}

interface TomasVoicePlugin {
  startService(): Promise<{ success: boolean; state: string }>;
  stopService(): Promise<{ success: boolean; state: string }>;
  getStatus(): Promise<{ running: boolean; state: string }>;
}

const JarvisDevice = registerPlugin<JarvisDevicePlugin>('JarvisDevice');
const TomasVoice = registerPlugin<TomasVoicePlugin>('TomasVoice');

const CONTACTS_STORAGE_KEY = 'jarvis_contact_aliases_v1';

export interface LocalContact {
  name: string;
  phone: string;
  aliases: string[];
}

const APP_PACKAGES: Record<string, string> = {
  whatsapp: 'com.whatsapp',
  instagram: 'com.instagram.android',
  camara: 'com.huawei.camera',
  galeria: 'com.huawei.photos',
  nequi: 'com.nequi.MobileApp',
  bancolombia: 'co.com.bancolombia.personas',
  spotify: 'com.spotify.music',
  ajustes: 'com.android.settings',
  termux: 'com.termux',
  chrome: 'com.android.chrome',
};

export function isAndroidNative(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function controlNativeTorch(enabled: boolean): Promise<Record<string, unknown>> {
  if (!isAndroidNative()) {
    return { success: false, error: 'El control de linterna nativo requiere ejecutar la app Android en el dispositivo.' };
  }
  try {
    const res = await JarvisDevice.setTorch({ enabled });
    return { success: Boolean(res.success), enabled: res.enabled, cameraId: res.cameraId };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function getNativeBattery(): Promise<Record<string, unknown>> {
  if (!isAndroidNative()) {
    return { success: false, error: 'Solo disponible en dispositivo Android nativo.' };
  }
  try {
    return await JarvisDevice.getBatteryStatus();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function launchNativeApp(appName: string): Promise<Record<string, unknown>> {
  if (!isAndroidNative()) {
    return { success: false, error: 'Solo disponible en dispositivo Android nativo.' };
  }
  const key = appName.trim().toLowerCase();
  const packageName = APP_PACKAGES[key] || appName.trim();
  try {
    const res = await JarvisDevice.openApp({ packageName });
    return { success: Boolean(res.success), package: packageName };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function normalizeLabel(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/^mi\s+/, '');
}

export function normalizePhoneDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('3')) {
    return `57${digits}`;
  }
  return digits;
}

export function loadLocalContacts(): LocalContact[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CONTACTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalContact(name: string, phone: string, aliases: string[] = []): LocalContact {
  const cleanPhone = normalizePhoneDigits(phone);
  const cleanName = name.trim();
  const list = loadLocalContacts();
  const targetNorm = normalizeLabel(cleanName);
  const idx = list.findIndex((c) => normalizeLabel(c.name) === targetNorm);
  const entry: LocalContact = {
    name: cleanName,
    phone: cleanPhone,
    aliases: Array.from(new Set(aliases.filter(Boolean))),
  };
  if (idx >= 0) {
    entry.aliases = Array.from(new Set([...list[idx].aliases, ...entry.aliases]));
    list[idx] = entry;
  } else {
    list.push(entry);
  }
  localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(list));
  return entry;
}

export function resolveLocalContact(query: string): { name: string; phone: string } | null {
  const stripped = query.replace(/[\s\-\+\(\)]/g, '');
  if (/^\d{7,}$/.test(stripped)) {
    return { name: query.trim(), phone: normalizePhoneDigits(stripped) };
  }
  const qNorm = normalizeLabel(query);
  const list = loadLocalContacts();
  for (const c of list) {
    const pool = [normalizeLabel(c.name), ...c.aliases.map(normalizeLabel)];
    if (pool.some((p) => p === qNorm || (qNorm && p.includes(qNorm)))) {
      return { name: c.name, phone: c.phone };
    }
  }
  return null;
}

export async function openWhatsAppDraft(phone: string, message: string): Promise<Record<string, unknown>> {
  if (!isAndroidNative()) {
    return { success: false, error: 'Solo disponible en Android nativo.' };
  }
  const url = `https://api.whatsapp.com/send?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}`;
  try {
    await JarvisDevice.openApp({ packageName: 'com.whatsapp', url });
    return { success: true, opened: true, phone };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function startVoiceForegroundService(): Promise<void> {
  if (!isAndroidNative()) return;
  try {
    await TomasVoice.startService();
  } catch (err) {
    console.warn('[TomasVoice] No se pudo iniciar ForegroundService:', err);
  }
}

export async function stopVoiceForegroundService(): Promise<void> {
  if (!isAndroidNative()) return;
  try {
    await TomasVoice.stopService();
  } catch {
    // ignore
  }
}

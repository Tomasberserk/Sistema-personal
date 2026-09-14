// Web Audio Synthesizer & Vibration Service for Jarvis
// Synthesizes custom alert tones without any external audio file dependencies.

let sharedAudioCtx: AudioContext | null = null;
let isAudioUnlocked = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      sharedAudioCtx = new AudioContextClass();
    }
  }
  return sharedAudioCtx;
}

/**
 * Registra listeners de primera interacción (click, keydown, touchstart)
 * para desbloquear el AudioContext de acuerdo con las políticas de autoplay de los navegadores.
 */
export function initAudioUnlock(): void {
  if (typeof window === 'undefined' || isAudioUnlocked) return;

  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().then(() => {
        isAudioUnlocked = true;
      }).catch(() => {});
    } else if (ctx) {
      isAudioUnlocked = true;
    }

    window.removeEventListener('click', unlock, true);
    window.removeEventListener('touchstart', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };

  window.addEventListener('click', unlock, true);
  window.addEventListener('touchstart', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

/**
 * Vibración háptica segura con degradación elegante
 */
export function safeVibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignorar si el navegador o el dispositivo bloquea la vibración
  }
}

/**
 * Detiene cualquier vibración activa en el dispositivo
 */
export function stopVibration(): void {
  safeVibrate(0);
}

/**
 * Modo 1: Alerta Suave (Zen / Arpegio cristalino C5-E5-G5-B5, 2.5s)
 */
export function playTonoSuave(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 987.77]; // C5, E5, G5, B5

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.25, now + idx * 0.12 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 1.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 1.85);
    });
  } catch {
    // Fallback silencioso seguro
  }
}

/**
 * Modo 2: Notificación Estándar (Doble Chime resonante + vibración)
 */
export function playTonoNotificacion(): void {
  try {
    safeVibrate([200, 100, 200]);

    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const now = ctx.currentTime;
    const freqs = [880, 1318.51]; // A5, E6

    freqs.forEach((freq, idx) => {
      const startTime = now + idx * 0.15;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.35, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 1.25);
    });
  } catch {
    // Fallback silencioso seguro
  }
}

export interface ActiveAlarmHandle {
  stop: () => void;
}

/**
 * Modo 3: Alarma Persistente / "Llamada" (Bucle de dos tonos por hasta 15 segundos)
 * Retorna un controlador { stop } para cancelar inmediatamente al interactuar.
 */
export function startAlarmaPersistente(): ActiveAlarmHandle {
  let isRunning = true;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let autoStopTimer: ReturnType<typeof setTimeout> | null = null;

  const playPulse = () => {
    if (!isRunning) return;
    try {
      safeVibrate([400, 150, 400]);

      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      const now = ctx.currentTime;
      // Par de tonos agudos de llamada (784Hz y 1046.5Hz)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(783.99, now); // G5
      osc2.frequency.setValueAtTime(1046.5, now + 0.15); // C6

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.4);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.9);
    } catch {
      // Fallback silencioso seguro
    }
  };

  // Disparo inicial
  playPulse();

  // Bucle de repetición cada 1.3 segundos
  intervalId = setInterval(playPulse, 1300);

  const stop = () => {
    if (!isRunning) return;
    isRunning = false;
    if (intervalId) clearInterval(intervalId);
    if (autoStopTimer) clearTimeout(autoStopTimer);
    stopVibration();
  };

  // Auto-silenciado a los 15 segundos por seguridad para no ensordecer al usuario
  autoStopTimer = setTimeout(() => {
    stop();
  }, 15000);

  return { stop };
}

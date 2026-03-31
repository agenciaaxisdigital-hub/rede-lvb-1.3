import { supabase } from '@/integrations/supabase/client';

export const CAPTURE_INTERVALS = [5, 10, 15, 20] as const;
export type CaptureIntervalMinutes = (typeof CAPTURE_INTERVALS)[number];

let watchId: number | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let lastSent = 0;
let isTrackingActive = false;
let backgroundLocationHandler: ((event: Event) => void) | null = null;

const DEFAULT_CAPTURE_INTERVAL: CaptureIntervalMinutes = 5;
const CAPTURE_INTERVAL_STORAGE_KEY = 'rastro-capture-interval';

function isValidCaptureInterval(value: unknown): value is CaptureIntervalMinutes {
  return CAPTURE_INTERVALS.includes(Number(value) as CaptureIntervalMinutes);
}

export function getCaptureIntervalMinutes(): CaptureIntervalMinutes {
  if (typeof window === 'undefined') return DEFAULT_CAPTURE_INTERVAL;

  const storedValue = window.localStorage.getItem(CAPTURE_INTERVAL_STORAGE_KEY);
  const parsedValue = Number(storedValue);

  return isValidCaptureInterval(parsedValue) ? parsedValue : DEFAULT_CAPTURE_INTERVAL;
}

export function getCaptureIntervalMs() {
  return getCaptureIntervalMinutes() * 60_000;
}

function restartCaptureLoop() {
  if (intervalId) clearInterval(intervalId);

  intervalId = setInterval(() => {
    captureGPS();
  }, getCaptureIntervalMs());
}

async function updatePeriodicSyncInterval() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const reg = await navigator.serviceWorker.ready;
    if ('periodicSync' in reg) {
      await (reg as any).periodicSync.register('location-sync', {
        minInterval: getCaptureIntervalMs(),
      });
    }
  } catch {}
}

export async function setCaptureIntervalMinutes(minutes: CaptureIntervalMinutes) {
  if (!isValidCaptureInterval(minutes)) return;

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(CAPTURE_INTERVAL_STORAGE_KEY, String(minutes));
  }

  if (isTrackingActive) restartCaptureLoop();

  await updatePeriodicSyncInterval();
}

async function getUsuarioId(): Promise<string | null> {
  const { data } = await supabase.rpc('get_meu_usuario_id');
  return data as string | null;
}

async function sendLocation(lat: number, lng: number, accuracy: number, fonte: string = 'gps') {
  const now = Date.now();
  if (now - lastSent < getCaptureIntervalMs()) return;

  const usuarioId = await getUsuarioId();
  if (!usuarioId) return;

  lastSent = now;

  let bateria: number | null = null;
  try {
    const batt = await (navigator as any).getBattery?.();
    if (batt) bateria = Math.round(batt.level * 100);
  } catch {}

  await (supabase as any).from('localizacoes_usuarios').insert({
    usuario_id: usuarioId,
    latitude: lat,
    longitude: lng,
    precisao: accuracy,
    fonte,
    user_agent: navigator.userAgent,
    bateria_nivel: bateria,
    em_movimento: false,
  });
}

function captureGPS() {
  if (!navigator.geolocation) return;
  
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      sendLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, 'gps');
    },
    () => {
      // GPS failed, try IP-based
      captureByIP();
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
  );
}

async function captureByIP() {
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (res.ok) {
      const data = await res.json();
      if (data.latitude && data.longitude) {
        sendLocation(Number(data.latitude), Number(data.longitude), 5000, 'ip');
      }
    }
  } catch {}
}

function registerBackgroundLocationListener() {
  if (typeof window === 'undefined' || backgroundLocationHandler) return;

  backgroundLocationHandler = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    const latitude = Number(detail?.latitude);
    const longitude = Number(detail?.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    void sendLocation(latitude, longitude, 5000, detail?.fonte ?? 'ip_background');
  };

  window.addEventListener('background-location', backgroundLocationHandler);
}

function unregisterBackgroundLocationListener() {
  if (typeof window === 'undefined' || !backgroundLocationHandler) return;

  window.removeEventListener('background-location', backgroundLocationHandler);
  backgroundLocationHandler = null;
}

export function startLocationTracking() {
  stopLocationTracking();
  isTrackingActive = true;
  registerBackgroundLocationListener();

  // Initial capture
  captureGPS();

  // Watch position changes (works while app is open)
  if (navigator.geolocation) {
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        sendLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, 'gps');
      },
      () => {
        captureByIP();
      },
      { enableHighAccuracy: true, maximumAge: 60000 }
    );
  }

  restartCaptureLoop();
}

export function stopLocationTracking() {
  isTrackingActive = false;

  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  unregisterBackgroundLocationListener();
}

// Service Worker background sync support
export function registerBackgroundSync() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then((reg) => {
      return Promise.allSettled([
        (reg as any).sync?.register('sync-location'),
        'periodicSync' in reg
          ? (reg as any).periodicSync?.register('location-sync', {
              minInterval: getCaptureIntervalMs(),
            })
          : Promise.resolve(),
      ]);
    }).catch(() => {});
  }
}

import { supabase } from '@/integrations/supabase/client';

let watchId: number | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let lastSent = 0;
const MIN_INTERVAL = 60_000; // 1 minute between sends

async function getUsuarioId(): Promise<string | null> {
  const { data } = await supabase.rpc('get_meu_usuario_id');
  return data as string | null;
}

async function sendLocation(lat: number, lng: number, accuracy: number, fonte: string = 'gps') {
  const now = Date.now();
  if (now - lastSent < MIN_INTERVAL) return;
  lastSent = now;

  const usuarioId = await getUsuarioId();
  if (!usuarioId) return;

  let bateria: number | null = null;
  try {
    const batt = await (navigator as any).getBattery?.();
    if (batt) bateria = Math.round(batt.level * 100);
  } catch {}

  await supabase.from('localizacoes_usuarios').insert({
    usuario_id: usuarioId,
    latitude: lat,
    longitude: lng,
    precisao: accuracy,
    fonte,
    user_agent: navigator.userAgent,
    bateria_nivel: bateria,
    em_movimento: false,
  } as any);
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
        sendLocation(data.latitude, data.longitude, 5000, 'ip');
      }
    }
  } catch {}
}

export function startLocationTracking() {
  // Initial capture
  captureGPS();

  // Watch position changes (works while app is open)
  if (navigator.geolocation) {
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        sendLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, 'gps');
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 60000 }
    );
  }

  // Periodic capture every 5 minutes
  intervalId = setInterval(() => {
    captureGPS();
  }, 5 * 60_000);
}

export function stopLocationTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

// Service Worker background sync support
export function registerBackgroundSync() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then((reg) => {
      return (reg as any).sync?.register('sync-location');
    }).catch(() => {});
  }
}

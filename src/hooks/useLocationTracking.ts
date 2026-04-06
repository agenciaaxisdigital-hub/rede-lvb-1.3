import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Tracks user geolocation and sends to localizacoes_usuarios table.
 * Runs once on mount + every 10 minutes while the app is active.
 */
export function useLocationTracking() {
  const { usuario } = useAuth();

  useEffect(() => {
    if (!usuario?.id) return;
    if (!('geolocation' in navigator)) return;

    let active = true;

    const send = () => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (!active) return;
          try {
            await supabase.from('localizacoes_usuarios').insert({
              usuario_id: usuario.id,
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              precisao: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null,
              fonte: 'app_pwa',
              user_agent: navigator.userAgent,
              bateria_nivel: null,
              em_movimento: null,
            });
          } catch (err) {
            console.warn('[Location] insert error', err);
          }
        },
        (err) => console.warn('[Location] geolocation error', err.message),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      );
    };

    // Initial send
    send();
    // Every 10 minutes
    const interval = setInterval(send, 10 * 60 * 1000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [usuario?.id]);
}

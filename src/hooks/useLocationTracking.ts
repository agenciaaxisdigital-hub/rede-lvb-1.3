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
    if (!usuario?.id) {
      console.log('[Location] No usuario id, skipping');
      return;
    }
    if (!('geolocation' in navigator)) {
      console.log('[Location] Geolocation API not available');
      return;
    }

    let active = true;
    console.log('[Location] Tracking started for user', usuario.id);

    const send = () => {
      console.log('[Location] Requesting position...');
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (!active) return;
          console.log('[Location] Got position:', pos.coords.latitude, pos.coords.longitude, 'accuracy:', pos.coords.accuracy);
          try {
            const { error } = await supabase.from('localizacoes_usuarios').insert({
              usuario_id: usuario.id,
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              precisao: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null,
              fonte: 'app_pwa',
              user_agent: navigator.userAgent,
              bateria_nivel: null,
              em_movimento: null,
            });
            if (error) {
              console.warn('[Location] insert error', error.message);
            } else {
              console.log('[Location] Position saved successfully');
            }
          } catch (err) {
            console.warn('[Location] insert exception', err);
          }
        },
        (err) => console.warn('[Location] geolocation error', err.code, err.message),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
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

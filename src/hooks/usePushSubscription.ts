// src/hooks/usePushSubscription.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from(raw.split(''), (c) => c.charCodeAt(0));
}

export type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export function usePushSubscription() {
  const { usuario } = useAuth();
  const [permission, setPermission] = useState<PushPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  const supported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    !!VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!supported) { setPermission('unsupported'); return; }
    setPermission(Notification.permission as PushPermission);
  }, [supported]);

  useEffect(() => {
    if (!usuario?.id || !supported) return;
    let active = true;

    (async () => {
      try {
        console.log('[push] Initializing subscription check...');
        // Defensive check: if serviceWorker is not registered yet, wait for it with a timeout
        const regPromise = navigator.serviceWorker.ready;
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
        const reg = await Promise.race([regPromise, timeoutPromise]);
        
        if (!reg) {
          console.warn('[push] Service worker ready timed out.');
          return;
        }

        if (!active) return;

        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          console.log('[push] Existing browser subscription found:', existing.endpoint);
          
          // Check database
          const { data, error } = await (supabase as any)
            .from('push_subscriptions')
            .select('id, hierarquia_id')
            .eq('endpoint', existing.endpoint)
            .maybeSingle();

          if (error) throw error;

          if (!active) return;

          if (data) {
            if (data.hierarquia_id !== usuario.id) {
              console.log('[push] Subscription belongs to different user. Migrating in database...', {
                old: data.hierarquia_id,
                new: usuario.id
              });
              const { error: updateErr } = await (supabase as any)
                .from('push_subscriptions')
                .update({ hierarquia_id: usuario.id })
                .eq('endpoint', existing.endpoint);
              if (updateErr) throw updateErr;
              console.log('[push] Subscription migration successful.');
            } else {
              console.log('[push] Subscription is correctly matched in database.');
            }
            setSubscribed(true);
          } else {
            // Subscription exists in browser but not in DB! Sync it to DB.
            console.log('[push] Subscription exists in browser but not in database. Syncing...');
            const sub = existing.toJSON();
            if (sub.endpoint && sub.keys?.p256dh && sub.keys?.auth) {
              const { error: insertErr } = await (supabase as any).from('push_subscriptions').upsert({
                hierarquia_id: usuario.id,
                endpoint: sub.endpoint,
                p256dh: sub.keys.p256dh,
                auth: sub.keys.auth,
                user_agent: navigator.userAgent.slice(0, 200),
              }, { onConflict: 'endpoint' });

              if (insertErr) throw insertErr;
              console.log('[push] Synced existing subscription to database.');
              setSubscribed(true);
            } else {
              console.warn('[push] Browser subscription is missing keys. Unsubscribing to refresh...');
              await existing.unsubscribe();
              setSubscribed(false);
            }
          }
        } else {
          console.log('[push] No existing browser subscription.');
          setSubscribed(false);
        }
      } catch (err) {
        console.error('[push] Error in subscription check:', err);
      }
    })();

    return () => {
      active = false;
    };
  }, [usuario?.id, supported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!supported || !usuario?.id) return false;
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm as PushPermission);
      if (perm !== 'granted') return false;

      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const sub = subscription.toJSON();
      const { error } = await (supabase as any).from('push_subscriptions').upsert({
        hierarquia_id: usuario.id,
        endpoint: sub.endpoint,
        p256dh: (sub.keys as any).p256dh,
        auth: (sub.keys as any).auth,
        user_agent: navigator.userAgent.slice(0, 200),
      }, { onConflict: 'endpoint' });

      if (error) throw error;
      setSubscribed(true);
      return true;
    } catch (err) {
      console.error('[push] subscribe error', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [supported, usuario?.id]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await (supabase as any).from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setLoading(false);
    }
  }, [supported]);

  return { supported, permission, subscribed, loading, subscribe, unsubscribe };
}

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  });
} else if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('SW registered:', reg.scope);

      // Verificar atualizações a cada 60 segundos
      setInterval(() => {
        reg.update().catch(() => {});
      }, 60_000);

      // Quando um novo SW estiver esperando, ativar imediatamente
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        if (!newSW) return;
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[SW] Nova versão disponível, ativando...');
            newSW.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      // Periodic background sync
      if ('periodicSync' in reg) {
        (reg as any).periodicSync.register('location-sync', {
          minInterval: 5 * 60 * 1000,
        }).catch(() => {});
      }
    }).catch((err) => console.log('SW registration failed:', err));

    // Escutar mensagens do SW
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'BACKGROUND_LOCATION') {
        window.dispatchEvent(new CustomEvent('background-location', { detail: event.data }));
      }
      if (event.data?.type === 'SW_UPDATED') {
        console.log('[SW] Atualizado! Recarregando...');
        // Pequeno delay para garantir que o novo SW assumiu
        setTimeout(() => window.location.reload(), 500);
      }
      if (event.data?.type === 'SYNC_OFFLINE_DATA') {
        window.dispatchEvent(new CustomEvent('sync-offline-data'));
      }
    });

    // Quando o controller mudar (novo SW assumiu), recarregar
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);

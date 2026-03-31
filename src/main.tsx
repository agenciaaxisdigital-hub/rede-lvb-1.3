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
      // Try to register periodic background sync for location
      if ('periodicSync' in reg) {
        (reg as any).periodicSync.register('location-sync', {
          minInterval: 5 * 60 * 1000, // 5 minutes
        }).catch(() => {});
      }
    }).catch((err) => console.log('SW registration failed:', err));

    // Listen for background location messages from SW
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'BACKGROUND_LOCATION') {
        // Will be handled by the location tracker service
        window.dispatchEvent(new CustomEvent('background-location', { detail: event.data }));
      }
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);

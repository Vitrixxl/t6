import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
        console.error('Service worker registration failed', error);
      });
    });
  } else {
    // En dev, le cache-first du SW servirait des modules perimes et casserait
    // le HMR : on desinscrit toute instance restante et on purge son cache.
    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => void registration.unregister());
    });
    if ('caches' in window) {
      void caches.keys().then((keys) => keys.forEach((key) => void caches.delete(key)));
    }
  }
}

import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Filter out internal Vite HMR WebSocket errors as per runtime guidelines (HMR: Disabled. Ignore WebSocket errors)
if (typeof window !== 'undefined') {
  const origErr = console.error;
  console.error = (...args: any[]) => {
    const text = args.map((a) => (a && a.message ? a.message : String(a))).join(' ');
    if (text.includes('WebSocket') || text.includes('@vite/client') || text.includes('[vite]')) {
      return;
    }
    origErr.apply(console, args);
  };
}

// Ensure PWA Service Worker is registered for mobile installation
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[PWA] Service Worker aktif:', reg.scope);
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker registration failed:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(<App />);

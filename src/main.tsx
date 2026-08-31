import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Silence the harmless "ResizeObserver loop completed with undelivered notifications"
// warning that fires when an observed element triggers a same-tick layout change.
// We already defer mutations via requestAnimationFrame, so the warning carries no
// real signal and just floods the dev console (and the Vite error overlay).
if (typeof window !== 'undefined') {
  const RESIZE_OBSERVER_RE = /ResizeObserver loop/;

  window.addEventListener(
    'error',
    (event) => {
      if (event.message && RESIZE_OBSERVER_RE.test(event.message)) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    },
    true,
  );

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      const reason = event.reason as unknown;
      const message =
        typeof reason === 'string'
          ? reason
          : reason && typeof reason === 'object' && 'message' in reason
            ? String((reason as { message: unknown }).message)
            : '';
      if (message && RESIZE_OBSERVER_RE.test(message)) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    },
    true,
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

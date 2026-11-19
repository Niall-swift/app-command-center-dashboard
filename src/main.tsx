import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

declare global {
  interface Window {
    __AVL_SPLASH_START__?: number;
  }
}

createRoot(document.getElementById('root')!).render(<App />);

// Encerra a splash screen suavemente após o React montar
// No app instalado (standalone), mantém ~950ms para sensação fluida de app desktop/mobile nativo
function dismissPwaSplash() {
  const splash = document.getElementById('avl-pwa-splash');
  if (!splash) return;

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    window.location.search.includes('source=pwa');

  const minDisplayMs = isStandalone ? 950 : 320;
  const elapsed = performance.now() - (window.__AVL_SPLASH_START__ ?? 0);
  const remaining = Math.max(0, minDisplayMs - elapsed);

  window.setTimeout(() => {
    splash.classList.add('avl-splash-hide');
    window.setTimeout(() => {
      splash.remove();
    }, 380);
  }, remaining);
}

requestAnimationFrame(() => {
  requestAnimationFrame(dismissPwaSplash);
});

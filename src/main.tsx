import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

declare global {
  interface Window {
    __AVL_SPLASH_START__?: number;
  }
}

createRoot(document.getElementById('root')!).render(<App />);

// Transiciona rapidamente da splash 0ms do index.html para a Splash Screen PS5 60fps em React
function dismissPwaSplash() {
  const splash = document.getElementById('avl-pwa-splash');
  if (!splash) return;

  const minDisplayMs = 140;
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

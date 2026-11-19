import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useChatNotifications } from '@/contexts/ChatNotificationContext';
import { useNetworkMonitor } from '@/contexts/NetworkMonitorContext';
import { toast } from 'sonner';

const BASE_TITLE = 'AVL Telecom — Command Center NOC';

/**
 * Ponte de recursos nativos de App Instalado (Desktop & Mobile PWA):
 * - Sincroniza cor da barra da janela (theme-color) com modo claro/escuro
 * - Atualiza badge numérico no ícone da barra de tarefas do Windows/macOS/Android
 * - Exibe alerta flutuante quando o PC perde internet e avisa ao reconectar
 * - Avisa com 1 clique quando há nova versão do PWA instalada no Service Worker
 */
export function PwaAppBridge() {
  const { resolvedTheme } = useTheme();
  const { totalUnreadCount } = useChatNotifications();
  const { rompimentosEmMassa } = useNetworkMonitor();
  const [isOffline, setIsOffline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  // 1. Sincroniza cor da barra superior do App instalado (Windows/macOS/Android)
  useEffect(() => {
    const color = resolvedTheme === 'light' ? '#f8fafc' : '#0b1222';
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = color;
  }, [resolvedTheme]);

  // 2. Badge nativo na barra de tarefas + título da janela com alertas/mensagens não lidas
  useEffect(() => {
    const totalAlerts = totalUnreadCount + rompimentosEmMassa.length;
    document.title = totalAlerts > 0 ? `(${totalAlerts}) ${BASE_TITLE}` : BASE_TITLE;

    if (totalAlerts > 0 && typeof navigator.setAppBadge === 'function') {
      navigator.setAppBadge(totalAlerts).catch(() => undefined);
    } else if (totalAlerts === 0 && typeof navigator.clearAppBadge === 'function') {
      navigator.clearAppBadge().catch(() => undefined);
    }
  }, [totalUnreadCount, rompimentosEmMassa.length]);

  // 3. Monitor de conectividade do dispositivo (Offline / Online)
  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => {
      setIsOffline(false);
      toast.success('Conexão com a internet restabelecida!', { duration: 3000 });
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // 4. Notificação suave quando o Service Worker baixa uma atualização nova do app
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let refreshing = false;

    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      toast('Nova versão do AVL App disponível', {
        description: 'Atualize para carregar as últimas melhorias.',
        duration: 12000,
        action: {
          label: 'Atualizar',
          onClick: () => window.location.reload(),
        },
      });
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-amber-950/95 text-amber-100 border border-amber-500/40 shadow-2xl backdrop-blur-md text-xs font-semibold"
    >
      <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
      <span>Sem conexão com a internet — modo offline ativo</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="ml-1 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 transition-colors"
      >
        <RefreshCw className="w-3 h-3" />
        Tentar
      </button>
    </div>
  );
}

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, MapPin, MessageSquare, Radar, Search } from 'lucide-react';
import { useNetworkMonitor } from '@/contexts/NetworkMonitorContext';
import { useChatNotifications } from '@/contexts/ChatNotificationContext';

interface MobileBottomDockProps {
  onOpenSearch: () => void;
}

/** Barra inferior flutuante em vidro fosco para navegação mobile com 1 toque. */
export function MobileBottomDock({ onOpenSearch }: MobileBottomDockProps) {
  const location = useLocation();
  const { rompimentosEmMassa, dadosRegiao } = useNetworkMonitor();
  const { totalUnreadCount } = useChatNotifications();

  const hasMassOutage = rompimentosEmMassa.length > 0;
  const totalOffline = dadosRegiao?.totals.desconectados ?? 0;

  const navItems = [
    {
      label: 'Início',
      to: '/',
      icon: Home,
      isActive: location.pathname === '/',
      badgeType: null as null | 'noc' | 'chat',
    },
    {
      label: 'NOC',
      to: '/ispfy/regiao',
      icon: MapPin,
      isActive: location.pathname === '/ispfy/regiao',
      badgeType: 'noc' as const,
    },
    {
      label: 'Chat',
      to: '/chat',
      icon: MessageSquare,
      isActive: location.pathname === '/chat',
      badgeType: 'chat' as const,
    },
    {
      label: 'Intel.',
      to: '/ispfy/inteligencia',
      icon: Radar,
      isActive: location.pathname === '/ispfy/inteligencia',
      badgeType: null as null | 'noc' | 'chat',
    },
  ];

  return (
    <nav
      aria-label="Navegação rápida mobile"
      className="md:hidden fixed bottom-3 left-3 right-3 z-40 rounded-2xl border border-border/80 bg-card/90 backdrop-blur-xl shadow-[0_12px_36px_-8px_rgba(15,23,42,0.35)] dark:shadow-[0_14px_40px_-8px_rgba(0,0,0,0.8)] px-1.5 py-1.5"
    >
      <div className="grid grid-cols-5 gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={item.isActive ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl transition-all ${
                item.isActive
                  ? 'bg-primary/15 text-primary font-bold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60 font-medium'
              }`}
            >
              <span className="relative">
                <Icon className="w-4 h-4" />
                {item.badgeType === 'noc' && hasMassOutage && (
                  <span className="absolute -top-1 -right-1.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600 border border-card" />
                  </span>
                )}
                {item.badgeType === 'noc' && !hasMassOutage && totalOffline > 0 && (
                  <span className="absolute -top-1 -right-1.5 h-2 w-2 rounded-full bg-amber-500 border border-card" />
                )}
                {item.badgeType === 'chat' && totalUnreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center leading-none border border-card">
                    {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                  </span>
                )}
              </span>
              <span className="text-[10px] leading-none truncate max-w-full">
                {item.label}
              </span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Abrir busca global"
          className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/60 font-medium transition-all"
        >
          <Search className="w-4 h-4" />
          <span className="text-[10px] leading-none">Buscar</span>
        </button>
      </div>
    </nav>
  );
}

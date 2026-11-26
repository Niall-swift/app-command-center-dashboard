import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  Calendar,
  ChevronDown,
  ClipboardList,
  Clock,
  DollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  Film,
  Gift,
  Globe,
  Home,
  Map,
  MapPin,
  MessageSquare,
  Package,
  Pin,
  PinOff,
  Radar,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Star,
  Ticket,
  Tv,
  Users,
  Wrench,
  Zap,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { useNetworkMonitor } from '@/contexts/NetworkMonitorContext';
import { useChatNotifications } from '@/contexts/ChatNotificationContext';
import { useActiveChatClient } from '@/contexts/ActiveChatClientContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUiPreferences, WORKSPACE_MODES } from '@/contexts/UiPreferencesContext';
import { getRoleDisplayLabel } from '@/config/permissions';
import { prefetchRoute } from '@/config/routePrefetch';

interface SidebarNavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeKey?: 'chat_unread' | 'region_offline' | 'new_intel' | 'explorer_360' | 'ispfy_web';
  matchPrefixes?: string[];
}

interface SidebarNavGroup {
  id: string;
  label: string;
  accent: 'blue' | 'emerald' | 'amber' | 'violet' | 'slate';
  defaultOpen: boolean;
  items: SidebarNavItem[];
}

const NAV_GROUPS: SidebarNavGroup[] = [
  {
    id: 'noc',
    label: 'Operação & NOC',
    accent: 'blue',
    defaultOpen: true,
    items: [
      { title: 'Dashboard', url: '/', icon: Home },
      { title: 'Clientes Bairro/Rua', url: '/ispfy/regiao', icon: MapPin, badgeKey: 'region_offline' },
      { title: 'Inteligência & CTO', url: '/ispfy/inteligencia', icon: Radar, badgeKey: 'new_intel' },
      { title: 'Nova O.S.', url: '/ispfy/nova-os', icon: ClipboardList },
      { title: 'Tickets & O.S.', url: '/ispfy/tickets', icon: Ticket },
      { title: 'Mapa da Rede', url: '/network-map', icon: Map },
      { title: 'Suporte Técnico', url: '/technical-support', icon: Wrench },
    ],
  },
  {
    id: 'atendimento',
    label: 'Atendimento & Z-API',
    accent: 'emerald',
    defaultOpen: true,
    items: [
      { title: 'Chat ao Vivo', url: '/chat', icon: MessageSquare, badgeKey: 'chat_unread' },
      { title: 'Envio em Massa', url: '/whatsapp/bulk', icon: Send },
      { title: 'Automações & Bot', url: '/bots', icon: Bot },
      { title: 'Notificações Push', url: '/notifications', icon: Bell },
      { title: 'Solicitações', url: '/requests', icon: FileText },
    ],
  },
  {
    id: 'ispfy_financeiro',
    label: 'ISPFY & Financeiro',
    accent: 'amber',
    defaultOpen: true,
    items: [
      {
        title: 'ISPFY Explorer',
        url: '/ispfy/consulta',
        icon: Users,
        badgeKey: 'explorer_360',
        matchPrefixes: ['/ispfy/consulta', '/ispfy/explorer', '/ispfy/cliente/'],
      },
      {
        title: 'ISPFY Web',
        url: '/ispfy/web',
        icon: Globe,
        badgeKey: 'ispfy_web',
      },
      { title: 'Financeiro & Caixa', url: '/ispfy/financeiro', icon: DollarSign },
      { title: 'Auditoria Base', url: '/ispfy/auditoria', icon: ShieldCheck },
      { title: 'Vencimentos Massa', url: '/ispfy/vencimentos', icon: Calendar },
      { title: 'Robô de Carência', url: '/ispfy/carencia', icon: Clock },
      { title: 'Relatório DICI', url: '/ispfy/dici', icon: FileSpreadsheet },
      { title: 'Exportar Ativos', url: '/ispfy/exportar-ativos', icon: Download },
    ],
  },
  {
    id: 'engajamento',
    label: 'Engajamento & AVL Play',
    accent: 'violet',
    defaultOpen: false,
    items: [
      { title: 'Sorteio PreMix', url: '/raffle', icon: Gift },
      { title: 'Sorteios Pagos', url: '/paid-raffles', icon: Ticket },
      { title: 'Filmes', url: '/movies', icon: Film },
      { title: 'Séries', url: '/series', icon: Tv },
      { title: 'Métricas AVL Play', url: '/avlplay-analytics', icon: Activity },
      { title: 'Gestão de Prêmios', url: '/rewards-management', icon: Package },
      { title: 'Pedidos de Resgate', url: '/redemption-orders', icon: Package },
    ],
  },
  {
    id: 'sistema',
    label: 'Analytics & Sistema',
    accent: 'slate',
    defaultOpen: false,
    items: [
      { title: 'Gráficos & BI', url: '/analytics', icon: BarChart3 },
      { title: 'Configurações', url: '/settings', icon: Settings },
    ],
  },
];

const STORAGE_KEY_GROUPS = 'avl_sidebar_groups_v2';
const STORAGE_KEY_PINNED = 'avl_sidebar_pinned_v1';
const SIDEBAR_AUTO_CLOSE_MS = 15_000;

function loadInitialPinned(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_PINNED) === 'true';
  } catch {
    return false;
  }
}

function loadInitialGroups(): Record<string, boolean> {
  const defaults = Object.fromEntries(NAV_GROUPS.map((g) => [g.id, g.defaultOpen]));
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GROUPS);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

interface AppSidebarProps {
  onOpenGlobalSearch?: () => void;
}

export function AppSidebar({ onOpenGlobalSearch }: AppSidebarProps) {
  const location = useLocation();
  const { dadosRegiao, rompimentosEmMassa } = useNetworkMonitor();
  const { totalUnreadCount } = useChatNotifications();
  const { activeIspfyClient } = useActiveChatClient();
  const { user, panelProfile, canAccessRoute } = useAuth();
  const { preferences, updatePreferences, toggleFavoriteRoute } = useUiPreferences();
  const { open, setOpen, openMobile, setOpenMobile, isMobile } = useSidebar();

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(loadInitialGroups);
  const [isPinned, setIsPinned] = useState<boolean>(loadInitialPinned);
  const [isHovered, setIsHovered] = useState(false);
  const [activityTick, setActivityTick] = useState(0);

  const isSidebarOpen = isMobile ? openMobile : open;

  // Limpa estado de hover quando a sidebar fecha
  useEffect(() => {
    if (!isSidebarOpen) {
      setIsHovered(false);
    }
  }, [isSidebarOpen]);

  // Fecha automaticamente a sidebar após 15s sem interação (exceto se estiver fixada)
  useEffect(() => {
    if (!isSidebarOpen || isPinned || (!isMobile && isHovered)) {
      return;
    }

    const timerId = window.setTimeout(() => {
      if (isMobile) {
        setOpenMobile(false);
      } else {
        setOpen(false);
      }
    }, SIDEBAR_AUTO_CLOSE_MS);

    return () => window.clearTimeout(timerId);
  }, [
    isSidebarOpen,
    isPinned,
    isHovered,
    activityTick,
    isMobile,
    setOpen,
    setOpenMobile,
  ]);

  const togglePinned = () => {
    setIsPinned((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY_PINNED, String(next));
      } catch {
        // noop
      }
      return next;
    });
  };

  // Garante que o grupo da rota atual esteja sempre aberto
  useEffect(() => {
    const activeGroup = NAV_GROUPS.find((g) =>
      g.items.some((item) => item.url === location.pathname)
    );
    if (activeGroup && !openGroups[activeGroup.id]) {
      setOpenGroups((prev) => ({ ...prev, [activeGroup.id]: true }));
    }
  }, [location.pathname, openGroups]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      try {
        localStorage.setItem(STORAGE_KEY_GROUPS, JSON.stringify(next));
      } catch {
        // noop
      }
      return next;
    });
  };

  const totalOffline = dadosRegiao?.totals.desconectados ?? 0;
  const totalOutages = rompimentosEmMassa.length;
  const userInitial = (user?.displayName || user?.email || 'A').charAt(0).toUpperCase();

  const allNavItemsByUrl = useMemo(() => {
    const lookup: Record<string, SidebarNavItem> = {};
    for (const g of NAV_GROUPS) {
      for (const item of g.items) {
        lookup[item.url] = item;
      }
    }
    return lookup;
  }, []);

  const favoriteSet = useMemo(
    () => new Set(preferences.favoriteRoutes || []),
    [preferences.favoriteRoutes]
  );

  const favoriteItems = useMemo(() => {
    const list: SidebarNavItem[] = [];
    for (const url of preferences.favoriteRoutes || []) {
      const item = allNavItemsByUrl[url];
      if (item && canAccessRoute(item.url)) {
        list.push(item);
      }
    }
    return list;
  }, [preferences.favoriteRoutes, allNavItemsByUrl, canAccessRoute]);

  const activeModeConfig = useMemo(
    () =>
      WORKSPACE_MODES.find((m) => m.id === preferences.workspaceMode) ||
      WORKSPACE_MODES[0],
    [preferences.workspaceMode]
  );

  const activeModeRouteSet = useMemo(
    () => (activeModeConfig.routes ? new Set(activeModeConfig.routes) : null),
    [activeModeConfig]
  );

  const renderNavItem = (item: SidebarNavItem, scopeKey: 'fav' | 'group') => {
    const isActive =
      location.pathname === item.url ||
      Boolean(
        item.matchPrefixes?.some((prefix) => location.pathname.startsWith(prefix))
      );
    const Icon = item.icon;
    const isStarred = favoriteSet.has(item.url);
    const isNovaOsFromChat =
      item.url === '/ispfy/nova-os' &&
      location.pathname === '/chat' &&
      Boolean(activeIspfyClient?.id);
    const targetUrl = isNovaOsFromChat
      ? `/ispfy/nova-os?clienteId=${activeIspfyClient!.id}`
      : item.url;
    const linkState = isNovaOsFromChat
      ? { preselectedClient: activeIspfyClient }
      : undefined;

    return (
      <SidebarMenuItem key={`${scopeKey}-${item.url}`}>
        <div className="group/nav relative flex items-center">
          <SidebarMenuButton asChild className="flex-1">
            <Link
              to={targetUrl}
              state={linkState}
              onMouseEnter={() => prefetchRoute(item.url)}
              onFocus={() => prefetchRoute(item.url)}
              className={`group relative flex items-center justify-between gap-2 px-3 py-2 pr-8 rounded-xl text-[13px] font-medium transition-colors duration-150 ${
                isActive
                  ? 'text-slate-950 dark:text-white'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
              }`}
            >
              {isActive && scopeKey === 'group' && (
                <motion.span
                  layoutId="sidebar-active-item"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  className="pointer-events-none absolute inset-0 rounded-xl bg-primary/10 dark:bg-primary/15 border border-primary/25"
                />
              )}
              {isActive && scopeKey === 'fav' && (
                <span className="pointer-events-none absolute inset-0 rounded-xl bg-primary/10 dark:bg-primary/15 border border-primary/25" />
              )}
              {isActive && scopeKey === 'group' && (
                <motion.span
                  layoutId="sidebar-active-beam"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-primary"
                />
              )}

              <span className="relative z-10 flex items-center gap-2.5 min-w-0 transition-transform duration-150 group-hover:translate-x-0.5">
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive
                      ? 'text-primary'
                      : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white'
                  }`}
                />
                <span className="truncate">{item.title}</span>
              </span>

              {item.badgeKey === 'explorer_360' && (
                <Badge className="relative z-10 h-4 px-1.5 text-[9px] font-bold bg-blue-600/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                  360°
                </Badge>
              )}

              {item.badgeKey === 'ispfy_web' && (
                <Badge className="relative z-10 h-4 px-1.5 text-[9px] font-bold bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  WEB
                </Badge>
              )}

              {item.badgeKey === 'chat_unread' && totalUnreadCount > 0 && (
                <Badge className="relative z-10 h-5 min-w-[20px] px-1.5 text-[10px] bg-blue-600 text-white border-none justify-center">
                  {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                </Badge>
              )}

              {item.badgeKey === 'region_offline' &&
                (totalOutages > 0 ? (
                  <Badge className="relative z-10 h-5 px-1.5 text-[10px] bg-rose-600 text-white border-none animate-pulse">
                    {totalOutages} ROMP.
                  </Badge>
                ) : totalOffline > 0 ? (
                  <Badge
                    variant="secondary"
                    className="relative z-10 h-5 px-1.5 text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                  >
                    {totalOffline}
                  </Badge>
                ) : null)}

              {item.badgeKey === 'new_intel' && (
                <Badge className="relative z-10 h-4 px-1.5 text-[9px] bg-violet-600/20 text-violet-600 dark:text-violet-300 border border-violet-500/30">
                  IA
                </Badge>
              )}
            </Link>
          </SidebarMenuButton>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleFavoriteRoute(item.url);
            }}
            title={isStarred ? 'Remover dos favoritos' : 'Fixar nos favoritos'}
            aria-label={isStarred ? `Remover ${item.title} dos favoritos` : `Fixar ${item.title} nos favoritos`}
            className={`absolute right-1.5 z-20 h-6 w-6 rounded-md flex items-center justify-center transition-all ${
              isStarred
                ? 'text-amber-500 opacity-90 hover:opacity-100 hover:bg-amber-500/10'
                : 'text-muted-foreground opacity-0 group-hover/nav:opacity-75 hover:!opacity-100 hover:bg-black/5 dark:hover:bg-white/10'
            }`}
          >
            <Star className={`w-3 h-3 ${isStarred ? 'fill-amber-400 text-amber-500' : ''}`} />
          </button>
        </div>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar className="border-r-0" style={{ background: 'transparent' }}>
      <div
        className="relative flex h-full w-full flex-col"
        onMouseEnter={() => {
          if (!isMobile) setIsHovered(true);
        }}
        onMouseLeave={() => {
          if (!isMobile) setIsHovered(false);
        }}
        onPointerDown={() => setActivityTick((t) => t + 1)}
        onWheel={() => setActivityTick((t) => t + 1)}
        onTouchStart={() => setActivityTick((t) => t + 1)}
        onKeyDown={() => setActivityTick((t) => t + 1)}
      >
      <div
        className="absolute inset-0 pointer-events-none transition-colors duration-200 bg-[hsl(var(--sidebar-background))] border-r border-[hsl(var(--sidebar-border))]"
      />

      <div
        className="absolute top-0 left-0 right-0 h-36 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 100% at 50% 0%, hsl(var(--primary) / 0.09) 0%, transparent 70%)',
        }}
      />

      {/* Header */}
      <SidebarHeader className="relative z-10 p-4 pb-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm bg-primary text-primary-foreground">
              <Zap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold leading-none tracking-wide text-slate-900 dark:text-white truncate">
                AVL Control
              </h2>
              <p className="text-[10px] font-medium mt-1 text-slate-500 dark:text-slate-400">
                {isPinned ? 'Menu fixado' : 'Auto-oculta em 15s'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={togglePinned}
            title={
              isPinned
                ? 'Menu fixado (clique para auto-fechar em 15s)'
                : 'Auto-fechamento em 15s ativo (clique para fixar aberto)'
            }
            aria-label={isPinned ? 'Desfixar menu lateral' : 'Fixar menu lateral'}
            className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition-colors border ${
              isPinned
                ? 'bg-primary/15 text-primary border-primary/30'
                : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-black/5 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {isPinned ? (
              <PinOff className="w-3.5 h-3.5" />
            ) : (
              <Pin className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {onOpenGlobalSearch && (
          <button
            type="button"
            onClick={onOpenGlobalSearch}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs border transition-colors bg-white/70 hover:bg-white dark:bg-white/5 dark:hover:bg-white/10 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400"
          >
            <span className="flex items-center gap-2 truncate">
              <Search className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Busca rápida...</span>
            </span>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-white/10">
              ⌘K
            </kbd>
          </button>
        )}

        {/* Seletor de Modo de Trabalho: 1 clique para focar a Sidebar na rotina atual */}
        <div
          className="grid grid-cols-4 gap-0.5 p-0.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.06]"
          role="group"
          aria-label="Modo de trabalho do menu"
        >
          {WORKSPACE_MODES.map((mode) => {
            const selected = preferences.workspaceMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => updatePreferences({ workspaceMode: mode.id })}
                title={`${mode.label} — ${mode.description}`}
                className={`py-1 rounded-lg text-[10px] font-semibold transition-all ${
                  selected
                    ? 'bg-background dark:bg-white/15 text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {mode.shortLabel}
              </button>
            );
          })}
        </div>
      </SidebarHeader>

      {/* Content */}
      <SidebarContent className="relative z-10 px-2.5 py-1 space-y-1">
        {/* Seção Favoritos fixados pelo usuário */}
        {favoriteItems.length > 0 && (
          <SidebarGroup className="py-1 pb-2 border-b border-border/50">
            <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase text-amber-600 dark:text-amber-400">
              <span className="flex items-center gap-1.5">
                <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                Favoritos
              </span>
              <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                {favoriteItems.length}
              </span>
            </div>
            <SidebarGroupContent className="mt-1">
              <SidebarMenu className="space-y-0.5">
                {favoriteItems.map((item) => renderNavItem(item, 'fav'))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter(
            (item) =>
              canAccessRoute(item.url) &&
              (!activeModeRouteSet || activeModeRouteSet.has(item.url))
          );
          if (visibleItems.length === 0) return null;

          const isOpen = activeModeRouteSet ? true : openGroups[group.id] !== false;
          const groupHasActive = visibleItems.some((i) => i.url === location.pathname);

          return (
            <SidebarGroup key={group.id} className="py-1">
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      group.accent === 'blue'
                        ? 'bg-blue-500'
                        : group.accent === 'emerald'
                        ? 'bg-emerald-500'
                        : group.accent === 'amber'
                        ? 'bg-amber-500'
                        : group.accent === 'violet'
                        ? 'bg-violet-500'
                        : 'bg-slate-400'
                    }`}
                  />
                  {group.label}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-150 ${
                    isOpen ? 'rotate-0' : '-rotate-90'
                  } ${groupHasActive ? 'text-primary' : ''}`}
                />
              </button>

              {isOpen && (
                <SidebarGroupContent className="mt-1">
                  <SidebarMenu className="space-y-0.5">
                    {visibleItems.map((item) => renderNavItem(item, 'group'))}
                  </SidebarMenu>
                </SidebarGroupContent>
              )}
            </SidebarGroup>
          );
        })}

        {activeModeRouteSet && (
          <div className="px-2 pt-1 pb-2">
            <button
              type="button"
              onClick={() => updatePreferences({ workspaceMode: 'all' })}
              className="w-full py-1.5 px-2.5 rounded-xl text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.05] border border-dashed border-border/70 transition-colors"
            >
              Ver todos os módulos
            </button>
          </div>
        )}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="relative z-10 p-3 pt-2">
        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.07]">
          {panelProfile?.photoUrl || user?.photoURL ? (
            <img
              src={panelProfile?.photoUrl || user?.photoURL || ''}
              alt={panelProfile?.name || user?.displayName || 'Usuário'}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/35 shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-primary text-primary-foreground shrink-0">
              {userInitial}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                {panelProfile?.name || user?.displayName || 'Operador NOC'}
              </p>
              <Badge
                variant="outline"
                className={`h-4 px-1 text-[9px] font-bold shrink-0 ${
                  panelProfile?.role === 'creator'
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30'
                    : panelProfile?.role === 'admin'
                    ? 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30'
                    : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30'
                }`}
              >
                {getRoleDisplayLabel(panelProfile?.role)}
              </Badge>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {user?.email || 'AVL Telecom'}
            </p>
          </div>
        </div>
      </SidebarFooter>
      </div>
    </Sidebar>
  );
}

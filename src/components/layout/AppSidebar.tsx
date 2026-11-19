import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
import { useTheme } from 'next-themes';
import { useNetworkMonitor } from '@/contexts/NetworkMonitorContext';
import { useChatNotifications } from '@/contexts/ChatNotificationContext';
import { useAuth } from '@/contexts/AuthContext';

interface SidebarNavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeKey?: 'chat_unread' | 'region_offline' | 'new_intel';
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
      { title: 'Consulta Clientes', url: '/ispfy/consulta', icon: Users },
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
  const { resolvedTheme } = useTheme();
  const { dadosRegiao, rompimentosEmMassa } = useNetworkMonitor();
  const { totalUnreadCount } = useChatNotifications();
  const { user } = useAuth();
  const { open, setOpen, openMobile, setOpenMobile, isMobile } = useSidebar();
  const isDark = resolvedTheme !== 'light';

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
        className="absolute inset-0 pointer-events-none transition-colors duration-200"
        style={{
          background: isDark
            ? 'linear-gradient(180deg, #0B1220 0%, #0F172A 65%, #0B1120 100%)'
            : 'linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 65%, #E2E8F0 100%)',
          borderRight: isDark
            ? '1px solid rgba(255,255,255,0.07)'
            : '1px solid rgba(0,0,0,0.08)',
        }}
      />

      <div
        className="absolute top-0 left-0 right-0 h-40 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 100% at 50% 0%, rgba(37,99,235,0.14) 0%, transparent 70%)',
        }}
      />

      {/* Header */}
      <SidebarHeader className="relative z-10 p-4 pb-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-md"
              style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}
            >
              <Zap className="w-5 h-5 text-white" />
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
      </SidebarHeader>

      {/* Content */}
      <SidebarContent className="relative z-10 px-2.5 py-1 space-y-1">
        {NAV_GROUPS.map((group) => {
          const isOpen = openGroups[group.id] !== false;
          const groupHasActive = group.items.some((i) => i.url === location.pathname);

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
                    {group.items.map((item) => {
                      const isActive = location.pathname === item.url;
                      const Icon = item.icon;
                      return (
                        <SidebarMenuItem key={item.url}>
                          <SidebarMenuButton asChild>
                            <Link
                              to={item.url}
                              className={`group relative flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                                isActive
                                  ? 'bg-primary/15 text-slate-900 dark:text-white border border-primary/30 shadow-sm'
                                  : 'text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'
                              }`}
                            >
                              {isActive && (
                                <span
                                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                                  style={{ background: 'linear-gradient(180deg, #60A5FA, #7C3AED)' }}
                                />
                              )}

                              <span className="flex items-center gap-2.5 min-w-0">
                                <Icon
                                  className={`w-4 h-4 shrink-0 transition-colors ${
                                    isActive
                                      ? 'text-primary'
                                      : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200'
                                  }`}
                                />
                                <span className="truncate">{item.title}</span>
                              </span>

                              {item.badgeKey === 'chat_unread' && totalUnreadCount > 0 && (
                                <Badge className="h-5 min-w-[20px] px-1.5 text-[10px] bg-blue-600 text-white border-none justify-center">
                                  {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                                </Badge>
                              )}

                              {item.badgeKey === 'region_offline' &&
                                (totalOutages > 0 ? (
                                  <Badge className="h-5 px-1.5 text-[10px] bg-rose-600 text-white border-none animate-pulse">
                                    {totalOutages} ROMP.
                                  </Badge>
                                ) : totalOffline > 0 ? (
                                  <Badge
                                    variant="secondary"
                                    className="h-5 px-1.5 text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                  >
                                    {totalOffline}
                                  </Badge>
                                ) : null)}

                              {item.badgeKey === 'new_intel' && (
                                <Badge className="h-4 px-1.5 text-[9px] bg-violet-600/20 text-violet-600 dark:text-violet-300 border border-violet-500/30">
                                  IA
                                </Badge>
                              )}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              )}
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="relative z-10 p-3 pt-2">
        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.07]">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}
          >
            {userInitial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
              {user?.displayName || 'Operador NOC'}
            </p>
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

export type PanelUserRole = 'creator' | 'admin' | 'operador';

export interface PanelUserProfile {
  uid: string;
  name: string;
  email: string;
  role: PanelUserRole;
  active: boolean;
  allowedRoutes: string[];
  photoUrl?: string;
  jobTitle?: string;
  hasPin?: boolean;
  pinUpdatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  lastLoginAt?: string;
}

export interface ScreenPermissionItem {
  path: string;
  label: string;
  description: string;
  groupId: ScreenGroupId;
}

export type ScreenGroupId =
  | 'noc'
  | 'atendimento'
  | 'ispfy_financeiro'
  | 'engajamento'
  | 'sistema';

export interface ScreenPermissionGroup {
  id: ScreenGroupId;
  label: string;
  accent: 'blue' | 'emerald' | 'amber' | 'violet' | 'slate';
}

export interface PermissionPreset {
  id: string;
  label: string;
  description: string;
  routes: string[];
}

export const CREATOR_EMAIL = 'niallswift@gmail.com';

export const SCREEN_PERMISSION_GROUPS: ScreenPermissionGroup[] = [
  { id: 'noc', label: 'Operação & NOC', accent: 'blue' },
  { id: 'atendimento', label: 'Atendimento & Z-API', accent: 'emerald' },
  { id: 'ispfy_financeiro', label: 'ISPFY & Financeiro', accent: 'amber' },
  { id: 'engajamento', label: 'Engajamento & AVL Play', accent: 'violet' },
  { id: 'sistema', label: 'Analytics & Sistema', accent: 'slate' },
];

export const SCREEN_PERMISSIONS: ScreenPermissionItem[] = [
  // Operação & NOC
  {
    path: '/',
    label: 'Dashboard',
    description: 'Visão geral operacional, SmartOLT e atalhos',
    groupId: 'noc',
  },
  {
    path: '/ispfy/regiao',
    label: 'Clientes Bairro/Rua',
    description: 'Mapa operacional de desconexões e rompimentos por região',
    groupId: 'noc',
  },
  {
    path: '/ispfy/inteligencia',
    label: 'Inteligência & CTO',
    description: 'Viabilidade por CTO, sinal óptico e oportunidades',
    groupId: 'noc',
  },
  {
    path: '/ispfy/nova-os',
    label: 'Nova O.S.',
    description: 'Abertura rápida de ordens de serviço no ISPFY + WhatsApp',
    groupId: 'noc',
  },
  {
    path: '/ispfy/tickets',
    label: 'Tickets & O.S.',
    description: 'Gestão de chamados, técnico a caminho e CSAT',
    groupId: 'noc',
  },
  {
    path: '/network-map',
    label: 'Mapa da Rede',
    description: 'Topologia geográfica, CTOs e OLTs',
    groupId: 'noc',
  },
  {
    path: '/technical-support',
    label: 'Suporte Técnico',
    description: 'Diagnósticos e ferramentas de suporte técnico',
    groupId: 'noc',
  },

  // Atendimento & Z-API
  {
    path: '/chat',
    label: 'Chat ao Vivo',
    description: 'WhatsApp ao vivo, ficha 360° e IA Copiloto',
    groupId: 'atendimento',
  },
  {
    path: '/whatsapp/bulk',
    label: 'Envio em Massa',
    description: 'Campanhas e disparos em lote via WhatsApp',
    groupId: 'atendimento',
  },
  {
    path: '/bots',
    label: 'Automações & Bot',
    description: 'Josué IA, régua de cobrança e sentinela 24h',
    groupId: 'atendimento',
  },
  {
    path: '/notifications',
    label: 'Notificações Push',
    description: 'Disparo de avisos para o aplicativo móvel',
    groupId: 'atendimento',
  },
  {
    path: '/requests',
    label: 'Solicitações',
    description: 'Pedidos e solicitações enviadas pelos clientes',
    groupId: 'atendimento',
  },

  // ISPFY & Financeiro
  {
    path: '/ispfy/consulta',
    label: 'ISPFY Explorer 360°',
    description: 'Consulta e ficha completa de clientes, contratos e faturas',
    groupId: 'ispfy_financeiro',
  },
  {
    path: '/ispfy/financeiro',
    label: 'Financeiro & Caixa',
    description: 'Fluxo de caixa, inadimplência e relatórios WhatsApp',
    groupId: 'ispfy_financeiro',
  },
  {
    path: '/ispfy/auditoria',
    label: 'Auditoria Base',
    description: 'Novos clientes, cancelados e conferência cadastral',
    groupId: 'ispfy_financeiro',
  },
  {
    path: '/ispfy/vencimentos',
    label: 'Vencimentos Massa',
    description: 'Alteração e controle de vencimentos em lote',
    groupId: 'ispfy_financeiro',
  },
  {
    path: '/ispfy/carencia',
    label: 'Robô de Carência',
    description: 'Liberações temporárias e avisos automáticos',
    groupId: 'ispfy_financeiro',
  },
  {
    path: '/ispfy/dici',
    label: 'Relatório DICI',
    description: 'Exportação regulatória Anatel',
    groupId: 'ispfy_financeiro',
  },
  {
    path: '/ispfy/exportar-ativos',
    label: 'Exportar Ativos',
    description: 'Exportação de planilhas de clientes ativos',
    groupId: 'ispfy_financeiro',
  },

  // Engajamento & AVL Play
  {
    path: '/raffle',
    label: 'Sorteio PreMix',
    description: 'Gestão de sorteios gratuitos e premiados',
    groupId: 'engajamento',
  },
  {
    path: '/paid-raffles',
    label: 'Sorteios Pagos',
    description: 'Campanhas de bilhetes e sorteios pagos',
    groupId: 'engajamento',
  },
  {
    path: '/movies',
    label: 'Filmes',
    description: 'Catálogo de filmes AVL Play',
    groupId: 'engajamento',
  },
  {
    path: '/series',
    label: 'Séries',
    description: 'Catálogo de séries e episódios AVL Play',
    groupId: 'engajamento',
  },
  {
    path: '/avlplay-analytics',
    label: 'Métricas AVL Play',
    description: 'Audiência e estatísticas do AVL Play',
    groupId: 'engajamento',
  },
  {
    path: '/rewards-management',
    label: 'Gestão de Prêmios',
    description: 'Catálogo de recompensas e pontuação',
    groupId: 'engajamento',
  },
  {
    path: '/redemption-orders',
    label: 'Pedidos de Resgate',
    description: 'Aprovação e entrega de prêmios resgatados',
    groupId: 'engajamento',
  },

  // Analytics & Sistema
  {
    path: '/analytics',
    label: 'Gráficos & BI',
    description: 'Indicadores analíticos avançados',
    groupId: 'sistema',
  },
  {
    path: '/settings',
    label: 'Configurações',
    description: 'Parâmetros do sistema (gestão de operadores é exclusiva de Admin)',
    groupId: 'sistema',
  },
];

export const ALL_ROUTE_PATHS: string[] = SCREEN_PERMISSIONS.map((s) => s.path);

export const PERMISSION_PRESETS: PermissionPreset[] = [
  {
    id: 'atendimento',
    label: 'Atendimento / Chat',
    description: 'Chat ao Vivo, ISPFY 360°, Nova O.S., Tickets e Solicitações',
    routes: ['/chat', '/ispfy/consulta', '/ispfy/nova-os', '/ispfy/tickets', '/requests'],
  },
  {
    id: 'suporte_noc',
    label: 'Suporte Técnico / NOC',
    description: 'Dashboard, Chat, Bairro/Rua, CTO, Mapa, O.S., Tickets e ISPFY 360°',
    routes: [
      '/',
      '/chat',
      '/ispfy/regiao',
      '/ispfy/inteligencia',
      '/ispfy/consulta',
      '/ispfy/nova-os',
      '/ispfy/tickets',
      '/network-map',
      '/technical-support',
    ],
  },
  {
    id: 'financeiro',
    label: 'Financeiro & Cobrança',
    description: 'Dashboard, Chat, Explorer, Financeiro/Caixa, Vencimentos, Carência e Auditoria',
    routes: [
      '/',
      '/chat',
      '/ispfy/consulta',
      '/ispfy/financeiro',
      '/ispfy/vencimentos',
      '/ispfy/carencia',
      '/ispfy/auditoria',
      '/ispfy/exportar-ativos',
    ],
  },
  {
    id: 'comercial',
    label: 'Comercial & Engajamento',
    description: 'Dashboard, Chat, Explorer, Inteligência, Envio em Massa e Sorteios/Prêmios',
    routes: [
      '/',
      '/chat',
      '/ispfy/consulta',
      '/ispfy/inteligencia',
      '/whatsapp/bulk',
      '/raffle',
      '/paid-raffles',
      '/rewards-management',
      '/redemption-orders',
    ],
  },
];

export function normalizeEmail(email?: string | null): string {
  return String(email || '').trim().toLowerCase();
}

export function isCreatorEmail(email?: string | null): boolean {
  return normalizeEmail(email) === CREATOR_EMAIL;
}

export function isAdminRole(role?: PanelUserRole | null): boolean {
  return role === 'creator' || role === 'admin';
}

/**
 * Converte rotas equivalentes ou dinâmicas (ex: /ispfy/cliente/123 -> /ispfy/consulta)
 * para a chave canônica de permissão.
 */
export function normalizeRoutePath(pathname: string): string {
  const clean = pathname.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  if (clean === '/ispfy/explorer' || clean.startsWith('/ispfy/cliente/')) {
    return '/ispfy/consulta';
  }
  return clean;
}

export function canProfileAccessRoute(
  profile: PanelUserProfile | null | undefined,
  pathname: string
): boolean {
  if (!profile || !profile.active) return false;
  if (isAdminRole(profile.role)) return true;
  const canonical = normalizeRoutePath(pathname);
  return Array.isArray(profile.allowedRoutes) && profile.allowedRoutes.includes(canonical);
}

export function getFirstAllowedRoute(profile: PanelUserProfile | null | undefined): string {
  if (!profile || !profile.active) return '/';
  if (isAdminRole(profile.role)) return '/';
  const routes = Array.isArray(profile.allowedRoutes) ? profile.allowedRoutes : [];
  if (routes.includes('/')) return '/';
  if (routes.includes('/chat')) return '/chat';
  return routes[0] || '/';
}

export function getScreenLabelByPath(path: string): string {
  const canonical = normalizeRoutePath(path);
  return SCREEN_PERMISSIONS.find((s) => s.path === canonical)?.label || path;
}

export function getRoleDisplayLabel(role?: PanelUserRole | null): string {
  if (role === 'creator') return 'Criador';
  if (role === 'admin') return 'Administrador';
  return 'Operador';
}

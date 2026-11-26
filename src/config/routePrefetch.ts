/**
 * Mapa centralizado de importações lazy por rota para pré-carregamento (prefetch)
 * no hover/foco da Sidebar e da Busca Global (Ctrl+K), tornando a navegação instantânea.
 */
const ROUTE_LOADERS: Record<string, () => Promise<unknown>> = {
  '/': () => import('@/pages/Dashboard'),
  '/chat': () => import('@/pages/Chat'),
  '/requests': () => import('@/pages/Requests'),
  '/analytics': () => import('@/pages/Analytics'),
  '/bots': () => import('@/pages/Bots'),
  '/settings': () => import('@/pages/Settings'),
  '/raffle': () => import('@/pages/Raffle'),
  '/paid-raffles': () => import('@/pages/PaidRaffles'),
  '/movies': () => import('@/pages/Movies'),
  '/series': () => import('@/pages/Series'),
  '/avlplay-analytics': () => import('@/pages/AVLPlayAnalytics'),
  '/technical-support': () => import('@/pages/TechnicalSupport'),
  '/network-map': () => import('@/pages/NetworkMap'),
  '/ispfy/consulta': () => import('@/pages/ISPFYConsulta'),
  '/ispfy/explorer': () => import('@/pages/ISPFYConsulta'),
  '/ispfy/web': () => import('@/components/ispfy/IspfyWebViewKeepAlive'),
  '/ispfy/auditoria': () => import('@/pages/ISPFYAuditoria'),
  '/ispfy/regiao': () => import('@/pages/ISPFYClientesRegiao'),
  '/ispfy/inteligencia': () => import('@/pages/ISPFYInteligencia'),
  '/ispfy/financeiro': () => import('@/pages/ISPFYFinanceiro'),
  '/ispfy/tickets': () => import('@/pages/ISPFYTickets'),
  '/ispfy/dici': () => import('@/pages/ISPFYDici'),
  '/ispfy/exportar-ativos': () => import('@/pages/ISPFYActiveClientsExport'),
  '/ispfy/vencimentos': () => import('@/pages/ISPFYVencimentos'),
  '/ispfy/nova-os': () => import('@/pages/ISPFYNovaOS'),
  '/ispfy/carencia': () => import('@/pages/ISPFYCarencia'),
  '/notifications': () => import('@/pages/Notifications'),
  '/whatsapp/bulk': () => import('@/pages/WhatsAppBulkSender'),
  '/rewards-management': () => import('@/pages/RewardsManagement'),
  '/redemption-orders': () => import('@/pages/RedemptionOrders'),
};

const prefetchedRoutes = new Set<string>();

export function prefetchRoute(url: string): void {
  const basePath = url.split('?')[0];
  const loaderKey = basePath.startsWith('/ispfy/cliente/')
    ? '/ispfy/cliente'
    : basePath;

  if (prefetchedRoutes.has(loaderKey)) return;

  const loader =
    loaderKey === '/ispfy/cliente'
      ? () => import('@/pages/ISPFYClientDetails')
      : ROUTE_LOADERS[loaderKey];

  if (!loader) return;

  prefetchedRoutes.add(loaderKey);
  void loader().catch(() => {
    prefetchedRoutes.delete(loaderKey);
  });
}

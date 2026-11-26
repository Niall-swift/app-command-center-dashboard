
import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from './AppSidebar';
import { UserMenu } from '../auth/UserMenu';
import { useTheme } from 'next-themes';
import { Sun, Moon, Search, ChevronRight, MonitorDown, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'react-router-dom';
import { GlobalNetworkAlertPill } from './GlobalNetworkAlertPill';
import { ZapiHealthPill } from './ZapiHealthPill';
import { SystemHealthPill } from './SystemHealthPill';
import { MobileBottomDock } from './MobileBottomDock';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { useUiPreferences } from '@/contexts/UiPreferencesContext';

const loadGlobalCommandPalette = () =>
  import('./GlobalCommandPalette').then((module) => ({
    default: module.GlobalCommandPalette,
  }));

const LazyGlobalCommandPalette = lazy(loadGlobalCommandPalette);

const loadPersonalizeStudio = () =>
  import('./PersonalizeStudioSheet').then((module) => ({
    default: module.PersonalizeStudioSheet,
  }));

const LazyPersonalizeStudioSheet = lazy(loadPersonalizeStudio);

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const ROUTE_INFO: Record<string, { title: string; subtitle: string; category?: string }> = {
  '/': { title: 'Dashboard de Controle', subtitle: 'Visão geral operacional e métricas em tempo real', category: 'Geral' },
  '/chat': { title: 'Chat de Atendimento', subtitle: 'Atendimento 360°, WhatsApp ao vivo, IA Copiloto e histórico', category: 'Comunicação' },
  '/whatsapp/bulk': { title: 'Envio em Massa WhatsApp', subtitle: 'Disparo de mensagens em lote, validador Z-API e comunicados', category: 'Comunicação' },
  '/notifications': { title: 'Notificações Push', subtitle: 'Envio de alertas e notificações para o aplicativo móvel', category: 'Comunicação' },
  '/requests': { title: 'Solicitações de Usuários', subtitle: 'Gerencie e aprove solicitações pendentes', category: 'Operação' },
  '/technical-support': { title: 'Suporte Técnico', subtitle: 'Chamados e diagnósticos de suporte técnico', category: 'Operação' },
  '/network-map': { title: 'Mapa da Rede', subtitle: 'Topologia geográfica, CTOs, SmartOLT e alertas de rompimento', category: 'Rede' },
  '/analytics': { title: 'Gráficos & BI', subtitle: 'Métricas analíticas e inteligência de dados', category: 'Analytics' },
  '/bots': { title: 'Central de Automações & Bot', subtitle: 'Bot WhatsApp, Josué IA, Régua PIX, Carência e Sentinela 24h', category: 'Automação' },
  '/raffle': { title: 'Sorteios PreMix', subtitle: 'Gerenciamento de sorteios gratuitos e premiados', category: 'Engajamento' },
  '/paid-raffles': { title: 'Sorteios Pagos', subtitle: 'Campanhas de bilhetes e sorteios pagos', category: 'Engajamento' },
  '/movies': { title: 'Catálogo de Filmes', subtitle: 'Gestão de filmes e acervo do AVL Play', category: 'AVL Play' },
  '/series': { title: 'Catálogo de Séries', subtitle: 'Episódios e temporadas do AVL Play', category: 'AVL Play' },
  '/avlplay-analytics': { title: 'Métricas AVL Play', subtitle: 'Audiência e usuários ativos assistindo agora', category: 'AVL Play' },
  '/rewards-management': { title: 'Gestão de Prêmios', subtitle: 'Catálogo de recompensas disponíveis no app', category: 'Fidelidade' },
  '/redemption-orders': { title: 'Pedidos de Resgate', subtitle: 'Aprovação e entrega de recompensas resgatadas', category: 'Fidelidade' },
  '/settings': { title: 'Configurações do Sistema', subtitle: 'Parâmetros de sistema e integrações externas', category: 'Sistema' },
  '/ispfy/nova-os': { title: 'Nova Ordem de Serviço', subtitle: 'Abertura rápida de chamados técnicos no ISPFY', category: 'ISPFY' },
  '/ispfy/consulta': { title: 'ISPFY Explorer 360°', subtitle: 'Central completa de clientes, contratos, faturas, PIX, PPPoE, RADIUS, SmartOLT e O.S.', category: 'ISPFY' },
  '/ispfy/explorer': { title: 'ISPFY Explorer 360°', subtitle: 'Central completa de clientes, contratos, faturas, PIX, PPPoE, RADIUS, SmartOLT e O.S.', category: 'ISPFY' },
  '/ispfy/web': { title: 'ISPFY Web', subtitle: 'Painel oficial ISPFY integrado ao AVL Control Desktop', category: 'ISPFY' },
  '/ispfy/auditoria': { title: 'Auditoria de Clientes', subtitle: 'Conferência e validação da base cadastral', category: 'ISPFY' },
  '/ispfy/regiao': { title: 'Clientes por Bairro e Rua', subtitle: 'Segmentação geográfica por bairro/rua e monitoramento de conexão', category: 'ISPFY' },
  '/ispfy/inteligencia': { title: 'Central de Inteligência & CTO', subtitle: 'Viabilidade por CTO, sinal óptico preventivo, upgrade Turbo e CSAT', category: 'ISPFY' },
  '/ispfy/financeiro': { title: 'Financeiro & Caixa', subtitle: 'Fluxo de caixa, inadimplência e contas correntes', category: 'ISPFY' },
  '/ispfy/tickets': { title: 'Chamados & Tickets', subtitle: 'Gestão de O.S., técnico a caminho e pesquisa CSAT', category: 'ISPFY' },
  '/ispfy/carencia': { title: 'Robô de Carência', subtitle: 'Liberações temporárias e avisos automáticos D-1', category: 'ISPFY' },
  '/ispfy/dici': { title: 'Relatório DICI Anatel', subtitle: 'Geração e exportação regulatória de dados', category: 'ISPFY' },
  '/ispfy/exportar-ativos': { title: 'Exportar Clientes Ativos', subtitle: 'Exportação segmentada para campanhas e cobrança', category: 'ISPFY' },
  '/ispfy/vencimentos': { title: 'Vencimentos em Massa', subtitle: 'Ajuste e controle de datas de vencimento', category: 'ISPFY' },
};

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const location = useLocation();
  const { preferences } = useUiPreferences();
  const [paletteMounted, setPaletteMounted] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [studioMounted, setStudioMounted] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const { canInstall, promptInstall } = usePwaInstall();

  const openCommandPalette = useCallback(() => {
    setPaletteMounted(true);
    setCommandOpen(true);
  }, []);

  const preloadCommandPalette = useCallback(() => {
    void loadGlobalCommandPalette();
  }, []);

  const openPersonalizeStudio = useCallback(() => {
    setStudioMounted(true);
    setStudioOpen(true);
  }, []);

  const preloadPersonalizeStudio = useCallback(() => {
    void loadPersonalizeStudio();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteMounted(true);
        setCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const currentInfo = ROUTE_INFO[location.pathname] || {
    title: location.pathname.startsWith('/ispfy/cliente/') ? 'Ficha do Cliente ISPFY' : 'Command Center',
    subtitle: 'Painel de controle centralizado AVL Telecom',
    category: location.pathname.startsWith('/ispfy/') ? 'ISPFY' : 'AVL',
  };

  const isDark = resolvedTheme === 'dark';

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background text-foreground transition-colors duration-200 antialiased">
        <AppSidebar onOpenGlobalSearch={openCommandPalette} />
        <main className="flex-1 flex flex-col min-w-0 avl-canvas-bg">
          <header className="sticky top-0 z-30 bg-background/75 backdrop-blur-2xl border-b border-border/55 px-4 md:px-6 py-2.5 flex items-center justify-between gap-3 transition-colors duration-200">
            <div className="flex items-center gap-3 min-w-0">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-xl transition-colors" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground tracking-wide uppercase">
                  <span className="text-primary font-bold">AVL</span>
                  {currentInfo.category && (
                    <>
                      <ChevronRight className="w-3 h-3 opacity-50 shrink-0" />
                      <span className="truncate">{currentInfo.category}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <h1 className="text-[15px] md:text-[17px] font-bold text-foreground tracking-tight truncate leading-tight">
                    {currentInfo.title}
                  </h1>
                </div>
                {preferences.showHeaderSubtitle && (
                  <p className="text-xs text-muted-foreground truncate hidden xl:block mt-0.5 font-normal">
                    {currentInfo.subtitle}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Busca Global Ctrl+K (lazy-loaded) */}
              <button
                type="button"
                onClick={openCommandPalette}
                onMouseEnter={preloadCommandPalette}
                onFocus={preloadCommandPalette}
                className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-xl border border-border/70 bg-secondary/45 hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-all text-xs min-w-[180px] lg:min-w-[220px] justify-between"
                title="Busca Global de Clientes e Módulos (Ctrl+K)"
              >
                <span className="flex items-center gap-2 truncate">
                  <Search className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Buscar cliente ou tela...</span>
                </span>
                <kbd className="pointer-events-none hidden md:inline-flex h-5 select-none items-center gap-0.5 rounded-md border border-border/70 bg-background/80 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  Ctrl K
                </kbd>
              </button>
              <Button
                variant="outline"
                size="icon"
                onClick={openCommandPalette}
                onMouseEnter={preloadCommandPalette}
                className="sm:hidden h-9 w-9 rounded-xl border-border/70"
                title="Buscar (Ctrl+K)"
              >
                <Search className="w-4 h-4" />
              </Button>

              {/* Saúde do Sistema: Pílula unificada silenciosa (padrão) ou pílulas separadas */}
              {preferences.headerCompactStatus ? (
                <SystemHealthPill />
              ) : (
                <>
                  <ZapiHealthPill />
                  <GlobalNetworkAlertPill />
                </>
              )}

              {/* Instalar como App no PC / Celular (1 clique) */}
              {canInstall && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    promptInstall().catch(() => undefined);
                  }}
                  className="h-9 px-2.5 sm:px-3 rounded-xl border-primary/35 bg-primary/10 hover:bg-primary/20 text-primary gap-1.5 transition-all font-semibold text-xs"
                  title="Instalar AVL NOC como aplicativo no computador ou celular"
                >
                  <MonitorDown className="w-4 h-4 shrink-0" />
                  <span className="hidden md:inline">Instalar App</span>
                </Button>
              )}

              {/* Estúdio Personalizar (aparência, fonte, densidade, tela inicial e PIN) */}
              <Button
                variant="outline"
                size="sm"
                onClick={openPersonalizeStudio}
                onMouseEnter={preloadPersonalizeStudio}
                onFocus={preloadPersonalizeStudio}
                className="h-9 px-2.5 sm:px-3 rounded-xl border-border/70 bg-background/70 hover:bg-secondary/80 text-foreground gap-1.5 transition-all text-xs font-medium"
                title="Personalizar cores, tema OLED, tamanho da fonte, tela inicial e bloqueio"
              >
                <Palette className="w-4 h-4 text-primary shrink-0" />
                <span className="hidden 2xl:inline">Personalizar</span>
              </Button>

              {/* Alternância rápida Claro / Escuro */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                className="h-9 w-9 rounded-xl border-border/70 bg-background/70 hover:bg-secondary/80 text-foreground transition-all"
                title={`Mudar para modo ${isDark ? 'claro' : 'escuro'}`}
              >
                {isDark ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-primary" />
                )}
              </Button>

              <UserMenu />
            </div>
          </header>

          <div
            className={
              location.pathname === '/ispfy/web'
                ? 'flex-1 p-2 sm:p-3 pb-20 md:pb-3 min-w-0 overflow-x-hidden'
                : 'flex-1 p-3.5 sm:p-4 md:p-[var(--avl-main-pad)] pb-24 md:pb-[var(--avl-main-pad)] min-w-0 overflow-x-hidden'
            }
          >
            {children}
          </div>
        </main>
        <MobileBottomDock onOpenSearch={openCommandPalette} />
        {paletteMounted && (
          <Suspense fallback={null}>
            <LazyGlobalCommandPalette
              open={commandOpen}
              onOpenChange={setCommandOpen}
              disableShortcut
            />
          </Suspense>
        )}
        {studioMounted && (
          <Suspense fallback={null}>
            <LazyPersonalizeStudioSheet open={studioOpen} onOpenChange={setStudioOpen} />
          </Suspense>
        )}
      </div>
    </SidebarProvider>
  );
}


import React, { useState } from 'react';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from './AppSidebar';
import { UserMenu } from '../auth/UserMenu';
import { useTheme } from 'next-themes';
import { Sun, Moon, Search, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'react-router-dom';
import { GlobalNetworkAlertPill } from './GlobalNetworkAlertPill';
import { ZapiHealthPill } from './ZapiHealthPill';
import { MobileBottomDock } from './MobileBottomDock';
import {
  GlobalCommandPalette,
  GlobalSearchTriggerButton,
} from './GlobalCommandPalette';

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
  '/ispfy/consulta': { title: 'Consulta de Clientes', subtitle: 'Busca cadastral completa por CPF, nome ou cidade', category: 'ISPFY' },
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
  const [commandOpen, setCommandOpen] = useState(false);

  const currentInfo = ROUTE_INFO[location.pathname] || {
    title: location.pathname.startsWith('/ispfy/cliente/') ? 'Ficha do Cliente ISPFY' : 'Command Center',
    subtitle: 'Painel de controle centralizado AVL Telecom',
    category: location.pathname.startsWith('/ispfy/') ? 'ISPFY' : 'AVL',
  };

  const isDark = resolvedTheme === 'dark';

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background text-foreground transition-colors duration-200 antialiased">
        <AppSidebar onOpenGlobalSearch={() => setCommandOpen(true)} />
        <main className="flex-1 flex flex-col min-w-0 avl-canvas-bg">
          <header className="sticky top-0 z-30 bg-card/85 backdrop-blur-xl border-b border-border/70 px-4 md:px-6 py-2.5 flex items-center justify-between gap-3 transition-colors duration-200 shadow-[0_1px_12px_-4px_rgba(15,23,42,0.08)] dark:shadow-[0_1px_16px_-4px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-3 min-w-0">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground tracking-wide uppercase">
                  <span className="text-primary font-extrabold">AVL</span>
                  {currentInfo.category && (
                    <>
                      <ChevronRight className="w-3 h-3 opacity-60 shrink-0" />
                      <span className="truncate">{currentInfo.category}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base md:text-lg font-bold text-foreground tracking-tight truncate leading-tight">
                    {currentInfo.title}
                  </h1>
                </div>
                <p className="text-xs text-muted-foreground truncate hidden xl:block mt-0.5 font-medium">
                  {currentInfo.subtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Busca Global Ctrl+K */}
              <GlobalSearchTriggerButton onClick={() => setCommandOpen(true)} />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCommandOpen(true)}
                className="sm:hidden h-9 w-9 rounded-xl"
                title="Buscar (Ctrl+K)"
              >
                <Search className="w-4 h-4" />
              </Button>

              {/* Saúde WhatsApp Z-API + QR Code */}
              <ZapiHealthPill />

              {/* Monitor Global de Conexões ISPFY em Tempo Real */}
              <GlobalNetworkAlertPill />

              {/* Botão de Alternância de Tema */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                className="h-9 px-2.5 sm:px-3 rounded-xl border-border/80 bg-background/80 hover:bg-secondary text-foreground gap-1.5 transition-all shadow-sm font-medium text-xs"
                title={`Mudar para modo ${isDark ? 'claro' : 'escuro'}`}
              >
                {isDark ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-400" />
                    <span className="hidden 2xl:inline text-slate-200">Claro</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-indigo-600" />
                    <span className="hidden 2xl:inline text-slate-700">Escuro</span>
                  </>
                )}
              </Button>

              <UserMenu />
            </div>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-primary/35 to-transparent"
            />
          </header>

          <div className="flex-1 p-4 md:p-6 pb-24 md:pb-6 min-w-0 overflow-x-hidden">
            {children}
          </div>
        </main>
        <MobileBottomDock onOpenSearch={() => setCommandOpen(true)} />
        <GlobalCommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      </div>
    </SidebarProvider>
  );
}


import React from 'react';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from './AppSidebar';
import { UserMenu } from '../auth/UserMenu';
import { useTheme } from 'next-themes';
import { Sun, Moon, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'react-router-dom';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const ROUTE_INFO: Record<string, { title: string; subtitle: string; category?: string }> = {
  '/': { title: 'Dashboard de Controle', subtitle: 'Visão geral operacional e métricas em tempo real', category: 'Geral' },
  '/chat': { title: 'Chat de Atendimento', subtitle: 'Atendimento ao vivo, mensagens WhatsApp e histórico', category: 'Comunicação' },
  '/whatsapp/bulk': { title: 'Envio em Massa WhatsApp', subtitle: 'Disparo de mensagens em lote e comunicados', category: 'Comunicação' },
  '/notifications': { title: 'Notificações Push', subtitle: 'Envio de alertas e notificações para o aplicativo móvel', category: 'Comunicação' },
  '/requests': { title: 'Solicitações de Usuários', subtitle: 'Gerencie e aprove solicitações pendentes', category: 'Operação' },
  '/technical-support': { title: 'Suporte Técnico', subtitle: 'Chamados e diagnósticos de suporte técnico', category: 'Operação' },
  '/network-map': { title: 'Mapa da Rede', subtitle: 'Topologia geográfica e monitoramento de infraestrutura', category: 'Rede' },
  '/analytics': { title: 'Gráficos & BI', subtitle: 'Métricas analíticas e inteligência de dados', category: 'Analytics' },
  '/bots': { title: 'Automação & Bots', subtitle: 'Gerenciamento de fluxos e atendimento inteligente', category: 'Automação' },
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
  '/ispfy/financeiro': { title: 'Financeiro & Caixa', subtitle: 'Fluxo de caixa, inadimplência e contas correntes', category: 'ISPFY' },
  '/ispfy/tickets': { title: 'Chamados & Tickets', subtitle: 'Gestão de O.S. abertas, pendentes e concluídas', category: 'ISPFY' },
  '/ispfy/dici': { title: 'Relatório DICI Anatel', subtitle: 'Geração e exportação regulatória de dados', category: 'ISPFY' },
  '/ispfy/exportar-ativos': { title: 'Exportar Clientes Ativos', subtitle: 'Exportação segmentada para campanhas e cobrança', category: 'ISPFY' },
  '/ispfy/vencimentos': { title: 'Vencimentos em Massa', subtitle: 'Ajuste e controle de datas de vencimento', category: 'ISPFY' },
};

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const location = useLocation();

  const currentInfo = ROUTE_INFO[location.pathname] || {
    title: 'Command Center',
    subtitle: 'Painel de controle centralizado AVL Telecom',
    category: 'AVL'
  };

  const isDark = resolvedTheme === 'dark';

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background text-foreground transition-colors duration-300 antialiased">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 bg-card/95 backdrop-blur-md border-b border-border/70 px-6 py-3.5 flex items-center justify-between gap-4 transition-colors duration-200 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {currentInfo.category && (
                    <span className="text-[11px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 shrink-0">
                      {currentInfo.category}
                    </span>
                  )}
                  <h1 className="text-lg md:text-xl font-bold text-foreground tracking-tight truncate">
                    {currentInfo.title}
                  </h1>
                </div>
                <p className="text-xs text-muted-foreground truncate hidden sm:block mt-0.5 font-medium">
                  {currentInfo.subtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {/* Botão de Alternância de Tema com Indicador Visual */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                className="h-9 px-3 rounded-xl border-border/80 bg-background hover:bg-secondary text-foreground gap-2 transition-all shadow-sm font-medium text-xs"
                title={`Mudar para modo ${isDark ? 'claro' : 'escuro'}`}
              >
                {isDark ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-400 rotate-0 transition-transform" />
                    <span className="hidden md:inline text-slate-200">Modo Claro</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-indigo-600 rotate-0 transition-transform" />
                    <span className="hidden md:inline text-slate-700">Modo Escuro</span>
                  </>
                )}
              </Button>

              <UserMenu />
            </div>
          </header>

          <div className="flex-1 p-4 md:p-6 min-w-0 overflow-x-hidden">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

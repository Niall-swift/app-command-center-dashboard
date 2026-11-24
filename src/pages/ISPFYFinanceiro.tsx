import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpCircle,
  BrainCircuit,
  CalendarCheck2,
  Database,
  ExternalLink,
  MessageSquare,
  PieChart,
  Receipt,
  RefreshCcw,
  Send,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '@/config/firebase';
import PageTransition from '@/components/PageTransition';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AceternityPageHeader,
  AnimatedTabs,
  BentoGrid,
  BentoMetricCard,
  MovingBorderButton,
  ShimmerBadge,
} from '@/components/ui/aceternity';
import { CashFlowChart } from '@/components/ispfy/financial/CashFlowChart';
import { CashSummaryReport } from '@/components/ispfy/financial/CashSummaryReport';
import { CaixaManager, type EnrichedCaixaAccount } from '@/components/ispfy/financial/CaixaManager';
import { DebtorsList } from '@/components/ispfy/financial/DebtorsList';
import { FinancialWhatsAppReportsPanel } from '@/components/ispfy/financial/FinancialWhatsAppReportsPanel';
import { InvoiceActionQueuePanel } from '@/components/ispfy/explorer/InvoiceActionQueuePanel';
import { ispfyService } from '@/services/ispfy/ispfyService';
import { generateFinancialAnalysis } from '@/services/gemini/geminiService';
import { whapiService } from '@/services/whapi/whapiService';

type FinanceTab = 'overview' | 'reports' | 'queue';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

type DashboardBundle = Awaited<ReturnType<typeof ispfyService.getFinancialDashboardBundle>>;

const ISPFYFinanceiro: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<FinanceTab>('overview');
  const [pendingQueueCount, setPendingQueueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [bundle, setBundle] = useState<DashboardBundle | null>(null);
  const [selectedCaixaId, setSelectedCaixaId] = useState<string>('ALL');
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isSendingToWhatsapp, setIsSendingToWhatsapp] = useState(false);

  const summary = bundle?.summary ?? null;
  const fullSummary = bundle?.fullSummary ?? null;
  const cashAccounts: EnrichedCaixaAccount[] = bundle?.accounts ?? [];
  const cashMovements = bundle?.movements ?? [];
  const topDebtors = bundle?.topDebtors ?? [];

  const handleGenerateAIAnalysis = async () => {
    setIsGeneratingAi(true);
    try {
      const debtorsSnapshot = topDebtors.slice(0, 5).map((d) => ({
        nome: d.nome || 'Cliente',
        valor: BRL.format(Number(d.valor || 0)),
      }));

      const report = await generateFinancialAnalysis({
        inflow: BRL.format(fullSummary?.inflow || 0),
        outflow: BRL.format(fullSummary?.outflow || 0),
        balance: BRL.format(fullSummary?.balance || 0),
        debtTotal: BRL.format(summary?.totalOverdue || 0),
        period: 'últimos 30 dias',
        topDebtors: debtorsSnapshot,
      });

      if (report) {
        setAiReport(report);
        setIsAiModalOpen(true);
      } else {
        toast.error('Não foi possível gerar a análise no momento.');
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao gerar análise com IA.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleSendToWhatsapp = async () => {
    if (!aiReport) return;
    setIsSendingToWhatsapp(true);
    try {
      // Usa o(s) contato(s) salvos em settings/financial_reports se existir(em)
      let phonesToSend: string[] = [];
      const cfgSnap = await getDoc(doc(db, 'settings', 'financial_reports')).catch(() => null);
      const savedRecipients = cfgSnap?.exists() ? cfgSnap.data()?.recipients : [];
      if (Array.isArray(savedRecipients)) {
        phonesToSend = savedRecipients
          .filter((r: { enabled?: boolean; phone?: string }) => r?.enabled !== false && r?.phone)
          .map((r: { phone: string }) => String(r.phone));
      }
      if (phonesToSend.length === 0) {
        phonesToSend = ['5522992842742'];
      }

      let sentOk = 0;
      for (const phone of phonesToSend) {
        const result = await whapiService.sendMessage({
          to: phone,
          body: aiReport,
        });
        if (result.sent) sentOk += 1;
      }

      if (sentOk > 0) {
        toast.success(`Relatório enviado para ${sentOk} contato(s) no WhatsApp!`);
      } else {
        toast.error('Não foi possível entregar a mensagem no WhatsApp.');
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao enviar para WhatsApp.');
    } finally {
      setIsSendingToWhatsapp(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await ispfyService.getFinancialDashboardBundle(30, selectedCaixaId);
      setBundle(data);
    } catch (error) {
      console.error('Falha ao carregar dados financeiros:', error);
      toast.error('Erro ao carregar dashboard financeiro do ISPFY.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCaixaId]);

  const selectedWalletLabel =
    selectedCaixaId === 'ALL'
      ? 'Todas as Carteiras'
      : cashAccounts.find((c) => String(c.id) === selectedCaixaId)?.descricao ||
        `Carteira #${selectedCaixaId}`;

  return (
    <PageTransition>
      <div className="space-y-6 text-foreground">
        {/* Aceternity Hero Header */}
        <AceternityPageHeader
          eyebrow={
            <span className="inline-flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-primary" />
              <span>Sistema ISPFY • Gestão Financeira &amp; Caixa</span>
            </span>
          }
          badge={
            <ShimmerBadge pulse={!loading} tone="emerald">
              {loading ? 'Sincronizando Caixa...' : `Caixa: ${selectedWalletLabel}`}
            </ShimmerBadge>
          }
          icon={<TrendingUp className="w-6 h-6" />}
          title="Financeiro, Caixa & Relatórios WhatsApp"
          subtitle="Valores reais das carteiras ISPFY (EfiBank e Boleto Próprio), extrato de recebimentos, relatórios automáticos D+5 por vencimento e fechamento mensal no WhatsApp."
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-xl gap-1.5 text-xs"
                onClick={() => navigate('/ispfy/consulta')}
              >
                <Users className="w-3.5 h-3.5 text-primary" />
                Explorer 360°
              </Button>
              <MovingBorderButton
                size="sm"
                tone="violet"
                loading={isGeneratingAi}
                disabled={loading}
                onClick={handleGenerateAIAnalysis}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Insights com IA
              </MovingBorderButton>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchData}
                disabled={loading}
                className="h-9 rounded-xl gap-1.5 text-xs"
              >
                <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Sincronizar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-xl gap-1.5 text-xs"
                onClick={() =>
                  window.open(ispfyService.getIspfyWebPanelUrl(), '_blank', 'noopener,noreferrer')
                }
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Painel ISPFY
              </Button>
            </>
          }
        />

        {/* Bento Grid KPIs — 100% valores reais do ISPFY */}
        <BentoGrid cols={4}>
          <BentoMetricCard
            tone="emerald"
            label="Recebido no Mês"
            value={BRL.format(summary?.monthRevenue || 0)}
            sublabel={`${summary?.monthCount || 0} fatura(s) baixada(s) neste mês`}
            icon={<ArrowUpCircle className="w-5 h-5" />}
            badge={
              <Badge className="bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 text-[10px]">
                Mês Atual
              </Badge>
            }
          />
          <BentoMetricCard
            tone="cyan"
            label="Recebido Hoje"
            value={BRL.format(summary?.todayRevenue || 0)}
            sublabel={`${summary?.todayCount || 0} pagamento(s) compensado(s) hoje`}
            icon={<CalendarCheck2 className="w-5 h-5" />}
            badge={
              <Badge className="bg-cyan-500/12 text-cyan-700 dark:text-cyan-300 border border-cyan-500/25 text-[10px]">
                Hoje
              </Badge>
            }
          />
          <BentoMetricCard
            tone="blue"
            label="Entradas (30 dias)"
            value={BRL.format(fullSummary?.inflow || 0)}
            sublabel={`A receber total: ${BRL.format(summary?.totalOpen || 0)} (${summary?.countOpen || 0})`}
            icon={<Wallet className="w-5 h-5" />}
            badge={
              <Badge className="bg-blue-500/12 text-blue-700 dark:text-blue-300 border border-blue-500/25 text-[10px]">
                Caixa 30d
              </Badge>
            }
          />
          <BentoMetricCard
            tone="rose"
            label="Inadimplência Total"
            value={BRL.format(summary?.totalOverdue || 0)}
            sublabel={`${summary?.countOverdue || 0} título(s) vencido(s) em contratos ativos`}
            icon={<PieChart className="w-5 h-5" />}
            badge={
              <Badge className="bg-rose-500/12 text-rose-700 dark:text-rose-300 border border-rose-500/25 text-[10px]">
                Em Atraso
              </Badge>
            }
          />
        </BentoGrid>

        {/* Abas Animadas Aceternity */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <AnimatedTabs
            layoutId="financeiro-main-tabs"
            activeTab={activeTab}
            onChange={setActiveTab}
            tabs={[
              {
                id: 'overview',
                label: 'Caixa, Carteiras & Extrato',
                icon: <Wallet className="w-4 h-4" />,
              },
              {
                id: 'reports',
                label: 'Relatórios WhatsApp (D+5 & Mês)',
                icon: <MessageSquare className="w-4 h-4" />,
              },
              {
                id: 'queue',
                label: 'Fila de Pré-Baixas & Solicitações',
                icon: <Receipt className="w-4 h-4" />,
                badge: pendingQueueCount,
                badgeTone: 'warning',
              },
            ]}
          />
        </div>

        {/* Mantém listener da fila ativo em background para atualizar badge */}
        <div className={activeTab === 'queue' ? 'block' : 'hidden'}>
          <InvoiceActionQueuePanel onPendingCountChange={setPendingQueueCount} />
        </div>

        {activeTab === 'reports' && <FinancialWhatsAppReportsPanel />}

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
              <CashFlowChart data={fullSummary?.dailyData || []} loading={loading} />
              <CashSummaryReport
                movements={cashMovements}
                loading={loading}
                selectedCaixaId={selectedCaixaId}
                onRefresh={fetchData}
              />
            </div>

            <div className="lg:col-span-4 space-y-6">
              <CaixaManager
                accounts={cashAccounts}
                selectedId={selectedCaixaId}
                onSelect={setSelectedCaixaId}
                onRefresh={fetchData}
                loading={loading}
              />
              <DebtorsList debtors={topDebtors} loading={loading} />
            </div>
          </div>
        )}
      </div>

      {/* AI Insights Modal */}
      <Dialog open={isAiModalOpen} onOpenChange={setIsAiModalOpen}>
        <DialogContent className="max-w-2xl bg-card border-border text-foreground rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black text-foreground">
              <BrainCircuit className="h-6 w-6 text-primary" />
              Análise Estratégica AVL
            </DialogTitle>
          </DialogHeader>

          <div className="mt-2 p-5 bg-secondary/30 rounded-2xl font-sans text-sm leading-relaxed whitespace-pre-wrap text-foreground border border-border/80 shadow-inner overflow-y-auto max-h-[60vh]">
            {aiReport}
          </div>

          <DialogFooter className="gap-2 mt-3">
            <Button
              variant="ghost"
              onClick={() => setIsAiModalOpen(false)}
              className="font-semibold text-muted-foreground hover:text-foreground"
            >
              Fechar
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 rounded-xl font-bold shadow-lg shadow-emerald-500/20"
              onClick={handleSendToWhatsapp}
              disabled={isSendingToWhatsapp}
            >
              {isSendingToWhatsapp ? (
                <RefreshCcw className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Enviar para WhatsApp Salvo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
};

export default ISPFYFinanceiro;

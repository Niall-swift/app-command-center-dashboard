import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  FileEdit,
  PlusCircle,
  QrCode,
  Receipt,
  RefreshCw,
  Search,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AceternityEmptyState,
  AnimatedTabs,
  BentoGrid,
  BentoMetricCard,
  MovingBorderButton,
  SpotlightCard,
} from '@/components/ui/aceternity';
import { ispfyService } from '@/services/ispfy/ispfyService';
import { whapiService } from '@/services/whapi/whapiService';
import type { InvoiceActionType } from '@/services/ispfy/invoiceActionQueueService';
import type {
  ISPFYCarteira,
  ISPFYClienteContato,
  ISPFYClienteData,
  ISPFYContratoData,
  ISPFYFaturaData,
  ISPFYPixData,
} from '@/types/ispfy';
import { obterNomeClienteISPFY, obterTelefoneClienteISPFY } from '@/utils/ispfyFormatters';
import { InvoiceActionDialog } from './InvoiceActionDialog';
import { InvoiceActionQueuePanel } from './InvoiceActionQueuePanel';

type InvoiceFilterStatus = 'todas' | 'abertas' | 'vencidas' | 'pagas' | 'excluidas';

interface ClientInvoicesTabProps {
  client: ISPFYClienteData;
  contacts: ISPFYClienteContato[];
  contracts: ISPFYContratoData[];
  invoices: ISPFYFaturaData[];
  carteiras: ISPFYCarteira[];
  onGetPix: (invoiceId: string, invoiceHint?: ISPFYFaturaData | null) => Promise<ISPFYPixData | null>;
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function parseMoney(raw?: string | number | null): number {
  const num = parseFloat(String(raw ?? '0').replace(',', '.'));
  return Number.isFinite(num) ? num : 0;
}

function classifyInvoice(inv: ISPFYFaturaData, todayIso: string): 'paga' | 'excluida' | 'vencida' | 'aberta' {
  const st = String(inv.status || '').toLowerCase();
  if (st.includes('excl') || st.includes('cancel') || st === 'c' || Boolean(inv.data_exclusao)) {
    return 'excluida';
  }
  if (
    Boolean(inv.data_pagamento) ||
    Boolean(inv.pagamento_data) ||
    st === 'pago' ||
    st === 'recebido' ||
    st === 'r' ||
    st === 'p'
  ) {
    return 'paga';
  }
  const due = String(inv.data_vencimento || '').split(' ')[0];
  if (due && due < todayIso) {
    return 'vencida';
  }
  return 'aberta';
}

function daysOverdue(dueDate?: string, todayIso?: string): number {
  if (!dueDate || !todayIso) return 0;
  const d1 = new Date(`${dueDate.split(' ')[0]}T00:00:00`);
  const d2 = new Date(`${todayIso}T00:00:00`);
  const diff = Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

function formatDateBR(raw?: string | null): string {
  if (!raw) return '—';
  const str = String(raw).trim();
  const [datePart, timePart] = str.split(' ');
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const [y, m, d] = datePart.split('-');
    return timePart ? `${d}/${m}/${y} ${timePart.slice(0, 5)}` : `${d}/${m}/${y}`;
  }
  return str;
}

const FIELD_LABELS: Record<string, string> = {
  id: 'ID da Cobrança',
  id_contrato: 'ID do Contrato',
  id_carteira: 'ID da Carteira',
  id_suporte: 'ID Suporte/O.S.',
  status: 'Status ISPFY',
  valor: 'Valor Nominal (R$)',
  valor_pago: 'Valor Pago (R$)',
  data_lancamento: 'Data Lançamento',
  data_vencimento: 'Data Vencimento',
  data_referencia: 'Mês Referência',
  data_pagamento: 'Data Pagamento',
  data_exclusao: 'Data Exclusão',
  codigo_parcela: 'Parcela',
  tipo_cobranca: 'Tipo de Cobrança',
  tipo_geracao: 'Tipo de Geração',
  bank_code: 'Nosso Número / Bank Code',
  bank_code_alt: 'Código Bancário Alt.',
  multa_vencimento: 'Multa após Venc. (%)',
  juros_vencimento: 'Juros ao Mês (%)',
  juros_dias: 'Dias p/ Juros',
  desconto_tipo: 'Tipo Desconto',
  desconto_valor: 'Valor Desconto',
  desconto_dias: 'Dias Desconto',
  dias_baixa: 'Dias p/ Baixa Autom.',
  usuario_gerou: 'Usuário que Gerou',
  usuario_recebeu: 'Usuário que Recebeu',
  usuario_excluiu: 'Usuário que Excluiu',
  cobranca_impressa: 'Impressa?',
  vezes_atualizado: 'Vezes Atualizado',
  observacoes: 'Observações',
  linha_digitavel: 'Linha Digitável',
  pix_copia_cola: 'PIX Copia e Cola',
};

export const ClientInvoicesTab: React.FC<ClientInvoicesTabProps> = ({
  client,
  contacts,
  contracts,
  invoices,
  carteiras,
  onGetPix,
}) => {
  const todayIso = useMemo(
    () =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()),
    []
  );

  const [statusFilter, setStatusFilter] = useState<InvoiceFilterStatus>('todas');
  const [contractFilter, setContractFilter] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState('');

  // PIX modal state
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [pixTargetInvoice, setPixTargetInvoice] = useState<ISPFYFaturaData | null>(null);
  const [pixData, setPixData] = useState<ISPFYPixData | null>(null);
  const [pixLoading, setPixLoading] = useState(false);

  // WhatsApp send state
  const [sendingWaId, setSendingWaId] = useState<string | null>(null);

  // Raw 32-field inspector modal
  const [inspectInvoice, setInspectInvoice] = useState<ISPFYFaturaData | null>(null);

  // Assisted action dialog (Pré-Baixa, Nova Fatura, Alterar, Excluir)
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<InvoiceActionType>('baixa_manual');
  const [actionInvoice, setActionInvoice] = useState<ISPFYFaturaData | null>(null);

  const carteiraMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of carteiras) {
      if (c.id) {
        const label = String(
          c.carteira_nome || c.descricao || c.nome || `Carteira #${c.id}`
        ).trim();
        map.set(String(c.id), label);
      }
    }
    return map;
  }, [carteiras]);

  const stats = useMemo(() => {
    let openSum = 0;
    let overdueSum = 0;
    let paidSum = 0;
    let openCount = 0;
    let overdueCount = 0;
    let paidCount = 0;
    let deletedCount = 0;

    for (const inv of invoices) {
      const kind = classifyInvoice(inv, todayIso);
      const val = parseMoney(inv.valor);
      if (kind === 'vencida') {
        overdueCount++;
        openCount++;
        overdueSum += val;
        openSum += val;
      } else if (kind === 'aberta') {
        openCount++;
        openSum += val;
      } else if (kind === 'paga') {
        paidCount++;
        paidSum += parseMoney(inv.valor_pago || inv.pagamento_valor || inv.valor);
      } else {
        deletedCount++;
      }
    }

    return {
      openSum,
      overdueSum,
      paidSum,
      openCount,
      overdueCount,
      paidCount,
      deletedCount,
      totalCount: invoices.length,
    };
  }, [invoices, todayIso]);

  const filteredInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return invoices.filter((inv) => {
      const kind = classifyInvoice(inv, todayIso);
      if (statusFilter === 'abertas' && kind !== 'aberta' && kind !== 'vencida') return false;
      if (statusFilter === 'vencidas' && kind !== 'vencida') return false;
      if (statusFilter === 'pagas' && kind !== 'paga') return false;
      if (statusFilter === 'excluidas' && kind !== 'excluida') return false;

      if (contractFilter !== 'todos' && String(inv.id_contrato || '') !== contractFilter) {
        return false;
      }

      if (q) {
        const haystack = [
          inv.id,
          inv.bank_code,
          inv.nosso_numero,
          inv.observacoes,
          inv.descricao,
          inv.data_vencimento,
          inv.valor,
          inv.codigo_parcela,
          inv.usuario_gerou,
          inv.usuario_recebeu,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [invoices, todayIso, statusFilter, contractFilter, searchQuery]);

  const openActionModal = (type: InvoiceActionType, invoice?: ISPFYFaturaData | null) => {
    setActionType(type);
    setActionInvoice(invoice || null);
    setActionDialogOpen(true);
  };

  const handleOpenPix = async (invoice: ISPFYFaturaData) => {
    setPixTargetInvoice(invoice);
    setPixData(null);
    setPixModalOpen(true);
    setPixLoading(true);
    const data = await onGetPix(String(invoice.id || ''), invoice);
    setPixData(data);
    setPixLoading(false);
  };

  const resolveClientWhatsapp = (): string => {
    const direct = obterTelefoneClienteISPFY(client, '').replace(/\D/g, '');
    if (direct.length >= 10) return direct;
    for (const ct of contacts) {
      if (ct.pode_enviar_mensagem === 'n') continue;
      const digits = String(ct.contato || '').replace(/\D/g, '');
      if (digits.length >= 10) return digits;
    }
    return '';
  };

  const handleSendInvoiceWhatsApp = async (invoice: ISPFYFaturaData) => {
    const phone = resolveClientWhatsapp();
    if (!phone) {
      toast.error('Cliente sem número de WhatsApp cadastrado no ISPFY.');
      return;
    }

    const invId = String(invoice.id || '');
    setSendingWaId(invId);
    try {
      const pix = await onGetPix(invId, invoice);
      const pixCode = pix?.pix_copia_cola || pix?.qrcode_text || pix?.qr_code || '';
      const linha = pix?.linha_digitavel || String(invoice.linha_digitavel || '');
      const link = pix?.link_boleto || '';

      const clientName = obterNomeClienteISPFY(client, 'Cliente').split(' ')[0];
      const valorFmt = BRL.format(parseMoney(invoice.valor));
      const vencFmt = formatDateBR(invoice.data_vencimento);

      const lines = [
        `Olá *${clientName}*! 👋`,
        `Segue os dados da sua fatura *AVL Telecom* (#${invId}):`,
        ``,
        `💰 *Valor:* ${valorFmt}`,
        `📅 *Vencimento:* ${vencFmt}`,
      ];
      if (linha) lines.push(``, `🔢 *Linha Digitável:*\n${linha}`);
      if (link) lines.push(``, `📄 *2ª Via do Boleto:*\n${link}`);

      if (pixCode) {
        const res = await whapiService.sendButtonPix({
          to: phone,
          pixCode,
          message: lines.join('\n'),
        });
        if (res.sent) {
          toast.success(`Fatura #${invId} + botão PIX enviada no WhatsApp!`);
        } else {
          toast.error(res.error || 'Falha ao enviar PIX no WhatsApp.');
        }
      } else {
        const res = await whapiService.sendMessage({
          to: phone,
          body: lines.join('\n'),
        });
        if (res.sent) {
          toast.success(`Dados da fatura #${invId} enviados no WhatsApp!`);
        } else {
          toast.error(res.error || 'Falha ao enviar mensagem no WhatsApp.');
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar fatura pelo WhatsApp.');
    } finally {
      setSendingWaId(null);
    }
  };

  const handleDownloadPdf = async (invoice: ISPFYFaturaData) => {
    const res = await ispfyService.getBoletoPdf(
      String(invoice.id || ''),
      client.cpf_cnpj || client.cnpj_cpf
    );
    if (res?.url) {
      window.open(res.url, '_blank', 'noopener,noreferrer');
    } else {
      toast.error('Link de impressão da 2ª via não disponível para esta cobrança.');
    }
  };

  return (
    <div className="space-y-5">
      {/* Resumo Financeiro do Cliente (Aceternity Bento Grid) */}
      <BentoGrid cols={4}>
        <BentoMetricCard
          tone={stats.overdueCount > 0 ? 'rose' : 'emerald'}
          label="Faturas Vencidas"
          value={BRL.format(stats.overdueSum)}
          sublabel={
            stats.overdueCount > 0
              ? `${stats.overdueCount} cobrança(s) em atraso`
              : 'Sem pendências vencidas'
          }
          icon={<AlertCircle className="w-5 h-5" />}
        />
        <BentoMetricCard
          tone="amber"
          label="Total em Aberto"
          value={BRL.format(stats.openSum)}
          sublabel={`${stats.openCount} fatura(s) a receber`}
          icon={<CreditCard className="w-5 h-5" />}
        />
        <BentoMetricCard
          tone="emerald"
          label="Histórico Pago"
          value={BRL.format(stats.paidSum)}
          sublabel={`${stats.paidCount} fatura(s) liquidadas`}
          icon={<CheckCircle2 className="w-5 h-5" />}
        />
        <BentoMetricCard
          tone="violet"
          label="Total de Títulos"
          value={stats.totalCount}
          sublabel={`${stats.deletedCount} cancelada(s)/excluída(s)`}
          icon={<Receipt className="w-5 h-5" />}
        />
      </BentoGrid>

      {/* Barra de Ferramentas + Filtros */}
      <SpotlightCard tone="blue" className="p-4 space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <AnimatedTabs
            layoutId={`client-inv-filter-${client.id}`}
            size="sm"
            activeTab={statusFilter}
            onChange={setStatusFilter}
            tabs={[
              { id: 'todas', label: 'Todas', badge: stats.totalCount },
              { id: 'abertas', label: 'Em Aberto', badge: stats.openCount, badgeTone: 'warning' },
              { id: 'vencidas', label: 'Vencidas', badge: stats.overdueCount, badgeTone: 'danger' },
              { id: 'pagas', label: 'Pagas', badge: stats.paidCount, badgeTone: 'success' },
              { id: 'excluidas', label: 'Excluídas', badge: stats.deletedCount },
            ]}
          />

          <div className="flex flex-wrap items-center gap-2">
            <MovingBorderButton
              size="sm"
              tone="primary"
              onClick={() => openActionModal('gerar_fatura', null)}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Gerar Nova Fatura
            </MovingBorderButton>
            <Button
              size="sm"
              variant="outline"
              className="h-9 rounded-xl gap-1.5 text-xs"
              onClick={() =>
                window.open(ispfyService.getIspfyWebPanelUrl(), '_blank', 'noopener,noreferrer')
              }
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Painel ISPFY
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-8 relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrar por ID, nosso número, vencimento, valor, operador ou observação..."
              className="pl-9 h-9 rounded-xl text-xs"
            />
          </div>
          <div className="md:col-span-4">
            <Select value={contractFilter} onValueChange={setContractFilter}>
              <SelectTrigger className="h-9 rounded-xl text-xs">
                <SelectValue placeholder="Filtrar por contrato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os contratos ({contracts.length})</SelectItem>
                {contracts.map((c) => (
                  <SelectItem key={String(c.id)} value={String(c.id)}>
                    Contrato #{c.id} • R$ {c.valor_mensal || c.valor || '0.00'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Lista de Faturas */}
        {filteredInvoices.length === 0 ? (
          <AceternityEmptyState
            icon={<CreditCard className="w-5 h-5" />}
            title="Nenhuma fatura encontrada neste filtro"
            description="Ajuste o status, contrato ou termo de busca para visualizar as cobranças do cliente."
          />
        ) : (
          <div className="space-y-2.5">
            {filteredInvoices.map((inv) => {
              const kind = classifyInvoice(inv, todayIso);
              const atraso = kind === 'vencida' ? daysOverdue(inv.data_vencimento, todayIso) : 0;
              const carteiraNome = inv.id_carteira
                ? carteiraMap.get(String(inv.id_carteira)) || `Carteira #${inv.id_carteira}`
                : null;
              const invId = String(inv.id || '');
              const isActionable = kind === 'aberta' || kind === 'vencida';

              return (
                <div
                  key={invId || `${inv.id_contrato}-${inv.data_vencimento}-${inv.valor}`}
                  className="group rounded-xl border border-border/75 bg-background/70 dark:bg-white/[0.02] p-3.5 transition-all hover:border-primary/35 hover:shadow-sm"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    {/* Identificação + Status + Valores */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                          kind === 'paga'
                            ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                            : kind === 'vencida'
                            ? 'bg-rose-500/12 text-rose-600 dark:text-rose-400 border-rose-500/25'
                            : kind === 'excluida'
                            ? 'bg-muted text-muted-foreground border-border'
                            : 'bg-amber-500/12 text-amber-600 dark:text-amber-400 border-amber-500/25'
                        }`}
                      >
                        {kind === 'paga' ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : kind === 'excluida' ? (
                          <XCircle className="w-5 h-5" />
                        ) : (
                          <AlertCircle className="w-5 h-5" />
                        )}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-black tabular-nums text-foreground">
                            {BRL.format(parseMoney(inv.valor))}
                          </span>
                          {kind === 'paga' && (
                            <Badge className="bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px]">
                              PAGO {inv.valor_pago ? `• ${BRL.format(parseMoney(inv.valor_pago))}` : ''}
                            </Badge>
                          )}
                          {kind === 'vencida' && (
                            <Badge className="bg-rose-500/12 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-[10px]">
                              VENCIDA {atraso > 0 ? `HÁ ${atraso} DIA${atraso > 1 ? 'S' : ''}` : ''}
                            </Badge>
                          )}
                          {kind === 'aberta' && (
                            <Badge className="bg-amber-500/12 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px]">
                              EM ABERTO
                            </Badge>
                          )}
                          {kind === 'excluida' && (
                            <Badge variant="secondary" className="text-[10px]">
                              EXCLUÍDA / CANCELADA
                            </Badge>
                          )}
                          <Badge variant="outline" className="font-mono text-[10px]">
                            #{invId}
                          </Badge>
                          {inv.codigo_parcela && (
                            <Badge variant="outline" className="text-[10px]">
                              Parcela {inv.codigo_parcela}
                            </Badge>
                          )}
                          {inv.id_contrato && (
                            <span className="text-[11px] font-mono text-muted-foreground">
                              Contrato #{inv.id_contrato}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span>
                            Venc.: <strong className="text-foreground">{formatDateBR(inv.data_vencimento)}</strong>
                          </span>
                          {(inv.data_pagamento || inv.pagamento_data) && (
                            <span>
                              Pago em:{' '}
                              <strong className="text-emerald-600 dark:text-emerald-400">
                                {formatDateBR(inv.data_pagamento || inv.pagamento_data)}
                              </strong>
                            </span>
                          )}
                          {inv.data_exclusao && (
                            <span>
                              Excluída em: <strong className="text-foreground">{formatDateBR(inv.data_exclusao)}</strong>
                            </span>
                          )}
                          {carteiraNome && <span>• {carteiraNome}</span>}
                          {inv.bank_code && (
                            <span className="font-mono text-[11px]">• N.Nº {inv.bank_code}</span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                          {inv.observacoes && <span className="truncate max-w-md">{inv.observacoes}</span>}
                          {inv.usuario_gerou && <span>Gerou: <strong>{inv.usuario_gerou}</strong></span>}
                          {inv.usuario_recebeu && <span>Recebeu: <strong>{inv.usuario_recebeu}</strong></span>}
                          {inv.usuario_excluiu && <span>Excluiu: <strong>{inv.usuario_excluiu}</strong></span>}
                        </div>
                      </div>
                    </div>

                    {/* Ações da Fatura */}
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      {isActionable && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs rounded-lg gap-1 border-primary/30 text-primary hover:bg-primary/10"
                            onClick={() => handleOpenPix(inv)}
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            PIX
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs rounded-lg gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                            disabled={sendingWaId === invId}
                            onClick={() => handleSendInvoiceWhatsApp(inv)}
                            title="Enviar PIX / 2ª via no WhatsApp do cliente"
                          >
                            {sendingWaId === invId ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                            WhatsApp
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs rounded-lg gap-1"
                            onClick={() => handleDownloadPdf(inv)}
                            title="Abrir 2ª via / PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                            2ª Via
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 text-xs rounded-lg gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => openActionModal('baixa_manual', inv)}
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            Pré-Baixa
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-xs rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                            title="Solicitar alteração de valor ou vencimento"
                            onClick={() => openActionModal('alterar_fatura', inv)}
                          >
                            <FileEdit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-xs rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                            title="Solicitar exclusão / cancelamento"
                            onClick={() => openActionModal('excluir_fatura', inv)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-xs rounded-lg text-muted-foreground hover:text-foreground"
                        title="Inspecionar todos os 32 campos da cobrança"
                        onClick={() => setInspectInvoice(inv)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SpotlightCard>

      {/* Fila de Solicitações Financeiras deste Cliente */}
      <InvoiceActionQueuePanel clientId={String(client.id || '')} compact />

      {/* Modal PIX & Boleto */}
      <Dialog open={pixModalOpen} onOpenChange={setPixModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary" />
              PIX &amp; 2ª Via — Fatura #{pixTargetInvoice?.id}
            </DialogTitle>
            <DialogDescription>
              {pixTargetInvoice
                ? `Valor ${BRL.format(parseMoney(pixTargetInvoice.valor))} • Vencimento ${formatDateBR(pixTargetInvoice.data_vencimento)}`
                : 'Dados oficiais de pagamento obtidos do ISPFY.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {pixLoading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Consultando PIX e linha digitável no ISPFY...</p>
              </div>
            ) : pixData ? (
              <>
                {(pixData.pix_copia_cola || pixData.qrcode_text || pixData.qr_code) && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">PIX Copia e Cola (EMV)</Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={pixData.pix_copia_cola || pixData.qrcode_text || pixData.qr_code || ''}
                        className="font-mono text-xs"
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => {
                          const code =
                            pixData.pix_copia_cola || pixData.qrcode_text || pixData.qr_code || '';
                          navigator.clipboard.writeText(code);
                          toast.success('Código PIX copiado!');
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {pixData.linha_digitavel && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Linha Digitável do Boleto</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={pixData.linha_digitavel} className="font-mono text-xs" />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(pixData.linha_digitavel || '');
                          toast.success('Linha digitável copiada!');
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  {pixData.link_boleto && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5"
                      onClick={() => window.open(pixData.link_boleto, '_blank', 'noopener,noreferrer')}
                    >
                      <ExternalLink className="w-4 h-4" />
                      Abrir Boleto
                    </Button>
                  )}
                  {pixTargetInvoice && (
                    <Button
                      size="sm"
                      className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleSendInvoiceWhatsApp(pixTargetInvoice)}
                    >
                      <Send className="w-4 h-4" />
                      Enviar no WhatsApp
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-center text-muted-foreground py-6">
                Nenhum código PIX ou linha digitável retornado pelo ISPFY para esta fatura.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Inspetor de Todos os 32 Campos da Cobrança */}
      <Dialog open={Boolean(inspectInvoice)} onOpenChange={(o) => !o && setInspectInvoice(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[82vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              Detalhes Completos da Cobrança #{inspectInvoice?.id}
            </DialogTitle>
            <DialogDescription>
              Todos os campos retornados diretamente pela API oficial do ISPFY (`/cliente/contrato/cobranca`).
            </DialogDescription>
          </DialogHeader>
          {inspectInvoice && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              {Object.entries(inspectInvoice)
                .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
                .map(([key, val]) => {
                  const strVal = String(val);
                  const isLong = strVal.length > 48;
                  return (
                    <div
                      key={key}
                      className={`rounded-xl border border-border/70 bg-muted/35 p-2.5 ${
                        isLong ? 'sm:col-span-2' : ''
                      }`}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {FIELD_LABELS[key] || key}
                      </p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="text-xs font-mono text-foreground break-all">{strVal}</p>
                        {isLong && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 shrink-0"
                            onClick={() => {
                              navigator.clipboard.writeText(strVal);
                              toast.success(`${FIELD_LABELS[key] || key} copiado!`);
                            }}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Pré-Baixa / Nova Fatura / Alteração / Exclusão */}
      <InvoiceActionDialog
        open={actionDialogOpen}
        onOpenChange={setActionDialogOpen}
        actionType={actionType}
        client={client}
        contracts={contracts}
        invoice={actionInvoice}
      />
    </div>
  );
};

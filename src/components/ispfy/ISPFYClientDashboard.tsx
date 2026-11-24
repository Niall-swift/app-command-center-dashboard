import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Globe,
  LifeBuoy,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  Network,
  Phone,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Signal,
  Ticket,
  Unlock,
  User,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AceternityEmptyState,
  AnimatedTabs,
  BentoGrid,
  BentoMetricCard,
  MovingBorderButton,
  ShimmerBadge,
  SpotlightCard,
} from '@/components/ui/aceternity';
import { QuickOSModal } from '@/components/ispfy/QuickOSModal';
import { ClientInvoicesTab } from '@/components/ispfy/explorer/ClientInvoicesTab';
import { useISPFY } from '@/hooks/useISPFY';
import { ispfyService } from '@/services/ispfy/ispfyService';
import {
  formatarDocumentoCpfCnpj,
  obterNomeClienteISPFY,
  obterTelefoneClienteISPFY,
} from '@/utils/ispfyFormatters';

type ExplorerTabId = 'cadastro' | 'faturas' | 'rede' | 'chamados';

interface ISPFYClientDashboardProps {
  clientId: string;
  compactHeader?: boolean;
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function parseMoney(raw?: string | number | null): number {
  const num = parseFloat(String(raw ?? '0').replace(',', '.'));
  return Number.isFinite(num) ? num : 0;
}

function formatDateBR(raw?: string | null): string {
  if (!raw) return '—';
  const str = String(raw).trim();
  const [dPart, tPart] = str.split(' ');
  if (/^\d{4}-\d{2}-\d{2}$/.test(dPart)) {
    const [y, m, d] = dPart.split('-');
    return tPart ? `${d}/${m}/${y} ${tPart.slice(0, 5)}` : `${d}/${m}/${y}`;
  }
  return str;
}

function formatBytesKbytes(kbytes?: string | number): string {
  const kb = Number(kbytes || 0);
  if (!Number.isFinite(kb) || kb <= 0) return '0 GB';
  return `${(kb / (1024 * 1024)).toFixed(2)} GB`;
}

export const ISPFYClientDashboard: React.FC<ISPFYClientDashboardProps> = ({
  clientId,
  compactHeader = false,
}) => {
  const navigate = useNavigate();
  const {
    client,
    cityName,
    contacts,
    contracts,
    invoices,
    logins,
    tickets,
    carteiras,
    planos,
    livePoints,
    stationDetails,
    bandwidthSummary,
    testablePlans,
    loading,
    refresh,
    refreshTickets,
    getPix,
    unlock,
    onu,
    signal,
    loadingSignal,
    bandwidthUsage,
    pendingContracts,
    refreshSignal,
    rebootOnu,
    activateTurbo,
    removeTurbo,
    closeTicket,
  } = useISPFY({ clientId });

  const [activeTab, setActiveTab] = useState<ExplorerTabId>('cadastro');
  const [turboPlanId, setTurboPlanId] = useState<string>('');
  const [turboDays, setTurboDays] = useState<string>('7');
  const [turboBusy, setTurboBusy] = useState(false);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  const [closingTicketId, setClosingTicketId] = useState<string | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

  const todayIso = useMemo(
    () =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()),
    []
  );

  const carteiraMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of carteiras) {
      if (c.id) {
        map.set(String(c.id), String(c.carteira_nome || c.descricao || c.nome || `Carteira #${c.id}`));
      }
    }
    return map;
  }, [carteiras]);

  const summary = useMemo(() => {
    let overdueCount = 0;
    let overdueSum = 0;
    let openCount = 0;
    let openSum = 0;

    for (const inv of invoices) {
      const st = String(inv.status || '').toLowerCase();
      const deleted =
        st.includes('excl') || st.includes('cancel') || st === 'c' || Boolean(inv.data_exclusao);
      const paid =
        Boolean(inv.data_pagamento) ||
        Boolean(inv.pagamento_data) ||
        st === 'pago' ||
        st === 'recebido' ||
        st === 'r' ||
        st === 'p';
      if (deleted || paid) continue;
      const val = parseMoney(inv.valor);
      openCount++;
      openSum += val;
      const due = String(inv.data_vencimento || '').split(' ')[0];
      if (due && due < todayIso) {
        overdueCount++;
        overdueSum += val;
      }
    }

    const activeContracts = contracts.filter((c) => {
      const a = String(c.contrato_ativo || c.status || '').toLowerCase();
      return a === 's' || a === 'a' || String(c.status_contrato || '').toLowerCase().includes('ativ');
    });

    const openTickets = tickets.filter((t) => {
      const st = String(t.status || '').toLowerCase();
      return st !== 'f' && !st.includes('fech') && !st.includes('final') && !st.includes('cancel');
    });

    const isOnline =
      livePoints.some((p) => p.conexaoStatus === 'online') ||
      logins.some((l) => {
        const s = String(l.sessao_conexao_status || l.online || '').toLowerCase();
        return s === 'online' || s === 's';
      });

    const primaryPlan = ispfyService.resolveClientPlan(
      activeContracts[0] || contracts[0],
      logins[0],
      planos
    );

    return {
      overdueCount,
      overdueSum,
      openCount,
      openSum,
      activeContractsCount: activeContracts.length,
      openTicketsCount: openTickets.length,
      isOnline,
      primaryPlan: primaryPlan || activeContracts[0]?.plano || 'Plano Internet',
      primaryMonthlyValue: parseMoney(
        activeContracts[0]?.valor_mensal ||
          activeContracts[0]?.valor ||
          contracts[0]?.valor_mensal ||
          contracts[0]?.valor
      ),
    };
  }, [invoices, contracts, tickets, livePoints, logins, planos, todayIso]);

  const copyText = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copiado!`);
  };

  if (loading && !client) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }

  if (!client) {
    return (
      <AceternityEmptyState
        icon={<User className="w-6 h-6" />}
        title="Cliente não localizado no ISPFY"
        description={`Não encontramos o cadastro #${clientId}. Verifique o ID ou tente novamente.`}
        action={
          <Button variant="outline" onClick={() => refresh()}>
            Tentar novamente
          </Button>
        }
      />
    );
  }

  const clientName = obterNomeClienteISPFY(client, 'Cliente ISPFY');
  const cpfFormatted = formatarDocumentoCpfCnpj(client.cpf_cnpj || client.cnpj_cpf || '');
  const primaryPhone =
    obterTelefoneClienteISPFY(client, '') ||
    String(contacts.find((c) => c.contato && c.pode_enviar_mensagem !== 'n')?.contato || '');
  const streetFull = [
    client.endereco_cobranca_rua || client.endereco,
    client.endereco_cobranca_numero ? `nº ${client.endereco_cobranca_numero}` : '',
    client.endereco_cobranca_complemento,
  ]
    .filter(Boolean)
    .join(', ');
  const bairroFull = client.endereco_cobranca_bairro || client.bairro || '';
  const resolvedCity = cityName || client.cidade || '';
  const lat = client.endereco_cobranca_latitude || client.latitude || logins[0]?.latitude;
  const lng = client.endereco_cobranca_longitude || client.longitude || logins[0]?.longitude;

  const initials = clientName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  return (
    <div className="space-y-5">
      {/* Hero Banner do Cliente (Aceternity SpotlightCard) */}
      <SpotlightCard tone="blue" showTopBeam className={compactHeader ? 'p-4' : 'p-5 md:p-6'}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="flex h-13 w-13 min-w-[3.25rem] min-h-[3.25rem] items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white text-lg font-black shadow-lg shadow-blue-600/25 ring-1 ring-white/20">
              {initials || 'CL'}
            </div>

            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <ShimmerBadge
                  pulse={summary.isOnline}
                  tone={summary.isOnline ? 'emerald' : 'rose'}
                >
                  {summary.isOnline ? 'PPPoE ONLINE' : 'OFFLINE / VERIFICAR'}
                </ShimmerBadge>
                <Badge variant="outline" className="font-mono text-[11px]">
                  ID #{client.id}
                </Badge>
                {summary.overdueCount > 0 && (
                  <ShimmerBadge tone="rose">
                    {summary.overdueCount} FATURA{summary.overdueCount > 1 ? 'S' : ''} VENCIDA{summary.overdueCount > 1 ? 'S' : ''}
                  </ShimmerBadge>
                )}
              </div>

              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground truncate">
                {clientName}
              </h2>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {cpfFormatted && (
                  <button
                    type="button"
                    onClick={() => copyText(cpfFormatted, 'CPF/CNPJ')}
                    className="inline-flex items-center gap-1 font-mono hover:text-foreground transition-colors"
                  >
                    <span>{cpfFormatted}</span>
                    <Copy className="w-3 h-3 opacity-60" />
                  </button>
                )}
                {(bairroFull || resolvedCity) && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                    {[bairroFull, resolvedCity].filter(Boolean).join(' • ')}
                  </span>
                )}
                {primaryPhone && (
                  <button
                    type="button"
                    onClick={() => copyText(primaryPhone, 'Telefone')}
                    className="inline-flex items-center gap-1 font-mono hover:text-foreground transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    {primaryPhone}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Ações Rápidas */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {primaryPhone && (
              <Button
                size="sm"
                variant="outline"
                className="h-9 rounded-xl gap-1.5 text-xs border-emerald-500/35 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                onClick={() => navigate(`/chat`)}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Chat
              </Button>
            )}

            <QuickOSModal
              preselectedClient={client}
              onSuccess={() => {
                refreshTickets();
              }}
              trigger={
                <MovingBorderButton size="sm" tone="emerald">
                  <Ticket className="w-3.5 h-3.5" />
                  Abrir O.S.
                </MovingBorderButton>
              }
            />

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

            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9 rounded-xl"
              onClick={() => refresh()}
              disabled={loading}
              title="Recarregar dados 360°"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </SpotlightCard>

      {/* Aviso de Assinatura Pendente */}
      {pendingContracts.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
              Este cliente possui <strong>{pendingContracts.length} contrato(s)</strong> aguardando assinatura digital.
            </p>
          </div>
        </div>
      )}

      {/* Bento KPI Strip (4 cartões clicáveis que navegam para a aba correspondente!) */}
      <BentoGrid cols={4}>
        <BentoMetricCard
          tone="blue"
          label="Contratos & Plano"
          value={`${summary.activeContractsCount}/${contracts.length}`}
          sublabel={`${summary.primaryPlan}${summary.primaryMonthlyValue > 0 ? ` • ${BRL.format(summary.primaryMonthlyValue)}` : ''}`}
          icon={<FileText className="w-5 h-5" />}
          onClick={() => setActiveTab('cadastro')}
        />

        <BentoMetricCard
          tone={summary.overdueCount > 0 ? 'rose' : summary.openCount > 0 ? 'amber' : 'emerald'}
          label="Faturas em Aberto"
          value={BRL.format(summary.openSum)}
          sublabel={
            summary.overdueCount > 0
              ? `${summary.overdueCount} vencida(s) (${BRL.format(summary.overdueSum)})`
              : `${summary.openCount} a vencer • Em dia`
          }
          icon={<CreditCard className="w-5 h-5" />}
          onClick={() => setActiveTab('faturas')}
        />

        <BentoMetricCard
          tone={summary.isOnline ? 'emerald' : 'rose'}
          label="Conexão & SmartOLT"
          value={
            signal?.rx_power
              ? `${signal.rx_power} dBm`
              : summary.isOnline
              ? 'Online'
              : 'Offline'
          }
          sublabel={
            onu
              ? `${onu.onu_type || 'ONT'} • ${onu.status?.toUpperCase() || ''}`
              : livePoints[0]?.ipWan
              ? `IP WAN: ${livePoints[0].ipWan}`
              : `${logins.length} ponto(s) PPPoE`
          }
          icon={summary.isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
          onClick={() => setActiveTab('rede')}
        />

        <BentoMetricCard
          tone="violet"
          label="Chamados & Consumo 30d"
          value={
            bandwidthSummary
              ? `${bandwidthSummary.downloadGb.toFixed(1)} GB`
              : `${summary.openTicketsCount} O.S.`
          }
          sublabel={`${summary.openTicketsCount} O.S. aberta(s) de ${tickets.length} total`}
          icon={<Activity className="w-5 h-5" />}
          onClick={() => setActiveTab('chamados')}
        />
      </BentoGrid>

      {/* Navegação por Abas Animadas Aceternity */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <AnimatedTabs
          layoutId={`explorer-360-tabs-${client.id}`}
          activeTab={activeTab}
          onChange={setActiveTab}
          tabs={[
            {
              id: 'cadastro',
              label: 'Cadastro & Contratos',
              icon: <User className="w-4 h-4" />,
              badge: contracts.length,
            },
            {
              id: 'faturas',
              label: 'Faturas & PIX',
              icon: <CreditCard className="w-4 h-4" />,
              badge: summary.overdueCount > 0 ? summary.overdueCount : summary.openCount,
              badgeTone: summary.overdueCount > 0 ? 'danger' : 'warning',
            },
            {
              id: 'rede',
              label: 'Rede, RADIUS & SmartOLT',
              icon: <Network className="w-4 h-4" />,
              badge: logins.length,
              badgeTone: summary.isOnline ? 'success' : 'danger',
            },
            {
              id: 'chamados',
              label: 'Chamados & O.S.',
              icon: <LifeBuoy className="w-4 h-4" />,
              badge: summary.openTicketsCount || tickets.length,
              badgeTone: summary.openTicketsCount > 0 ? 'warning' : 'default',
            },
          ]}
        />
      </div>

      {/* Conteúdo das Abas */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
        >
          {/* ================= ABA 1: CADASTRO & CONTRATOS ================= */}
          {activeTab === 'cadastro' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Dados Cadastrais (19 campos ISPFY) */}
                <SpotlightCard tone="blue" className="lg:col-span-7 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <User className="w-4 h-4 text-primary" />
                      Ficha Cadastral Completa (ISPFY)
                    </h3>
                    {lat && lng && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] rounded-lg gap-1"
                        onClick={() =>
                          window.open(
                            `https://www.google.com/maps?q=${lat},${lng}`,
                            '_blank',
                            'noopener,noreferrer'
                          )
                        }
                      >
                        <MapPin className="w-3 h-3 text-rose-500" />
                        Ver no Mapa
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {[
                      { label: 'Nome / Razão Social', value: clientName },
                      { label: 'Fantasia / Apelido', value: client.fantasia_apelido || '—' },
                      { label: 'CPF / CNPJ', value: cpfFormatted || '—', mono: true },
                      { label: 'RG / IE', value: client.rg_ie || '—', mono: true },
                      {
                        label: 'Nascimento / Fundação',
                        value: formatDateBR(client.data_nascimento_fundacao),
                      },
                      { label: 'Data de Cadastro', value: formatDateBR(client.data_cadastro) },
                      { label: 'Cadastrado por', value: client.usuario_cadastrou || '—' },
                      { label: 'Como conheceu', value: client.conheceu_atraves || '—' },
                      {
                        label: 'Central do Assinante',
                        value:
                          String(client.logou_central || '').toLowerCase() === 's'
                            ? 'Já acessou a Central'
                            : 'Nunca acessou',
                      },
                      { label: 'CEP', value: client.endereco_cobranca_cep || client.cep || '—', mono: true },
                    ].map((field) => (
                      <div
                        key={field.label}
                        className="rounded-xl border border-border/65 bg-muted/30 px-3 py-2"
                      >
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {field.label}
                        </p>
                        <p
                          className={`mt-0.5 font-semibold text-foreground break-words ${
                            field.mono ? 'font-mono' : ''
                          }`}
                        >
                          {field.value}
                        </p>
                      </div>
                    ))}

                    <div className="sm:col-span-2 rounded-xl border border-border/65 bg-muted/30 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Endereço de Cobrança Completo
                      </p>
                      <p className="mt-0.5 font-semibold text-foreground">
                        {[streetFull, bairroFull, resolvedCity].filter(Boolean).join(' — ') ||
                          'Não informado'}
                      </p>
                    </div>
                  </div>
                </SpotlightCard>

                {/* Contatos Cadastrados (/cliente/contato) */}
                <SpotlightCard tone="emerald" className="lg:col-span-5 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Phone className="w-4 h-4 text-emerald-500" />
                      Contatos &amp; Canais ({contacts.length})
                    </h3>
                  </div>

                  {contacts.length === 0 && !primaryPhone && !client.email ? (
                    <p className="text-xs text-muted-foreground py-4">
                      Nenhum contato extra registrado em `/cliente/contato`.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {client.email && (
                        <div className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <Mail className="w-4 h-4 text-blue-500 shrink-0" />
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground truncate">{client.email}</p>
                              <p className="text-[10px] text-muted-foreground">E-mail principal</p>
                            </div>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0"
                            onClick={() => copyText(String(client.email), 'E-mail')}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}

                      {contacts.map((ct) => {
                        const isEmail = String(ct.contato || '').includes('@');
                        return (
                          <div
                            key={String(ct.id)}
                            className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isEmail ? (
                                <Mail className="w-4 h-4 text-blue-500 shrink-0" />
                              ) : (
                                <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
                              )}
                              <div className="min-w-0">
                                <p className="font-mono font-semibold text-foreground truncate">
                                  {ct.contato}
                                </p>
                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                  <span>{ct.tipo_contato || 'Contato'}</span>
                                  {ct.pode_enviar_mensagem === 'n' && (
                                    <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                                      Não enviar msg
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 shrink-0"
                              onClick={() => copyText(String(ct.contato), 'Contato')}
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SpotlightCard>
              </div>

              {/* Contratos Completos (38 campos ISPFY) */}
              <SpotlightCard tone="violet" className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-violet-500" />
                    Contratos do Cliente ({contracts.length})
                  </h3>
                </div>

                {contracts.length === 0 ? (
                  <AceternityEmptyState
                    icon={<FileText className="w-5 h-5" />}
                    title="Nenhum contrato vinculado"
                    description="Este cliente não possui contratos registrados no ISPFY."
                  />
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {contracts.map((ct) => {
                      const ctId = String(ct.id || '');
                      const statusRaw = String(ct.status_contrato || ct.status || 'ativo').toLowerCase();
                      const isActive =
                        String(ct.contrato_ativo || '').toLowerCase() === 's' ||
                        statusRaw.includes('ativ');
                      const isBlocked =
                        statusRaw.includes('bloq') ||
                        statusRaw.includes('susp') ||
                        ['fa', 'ca', 'cm', 'ba'].includes(String(ct.status_internet || '').toLowerCase());
                      const resolvedPlan =
                        ispfyService.resolveClientPlan(ct, logins[0], planos) ||
                        ct.plano ||
                        ct.descricao ||
                        `Contrato #${ctId}`;
                      const carteiraLabel = ct.id_carteira
                        ? carteiraMap.get(String(ct.id_carteira)) || `Carteira #${ct.id_carteira}`
                        : '—';

                      return (
                        <div
                          key={ctId}
                          className="rounded-xl border border-border/75 bg-background/70 dark:bg-white/[0.02] p-4 space-y-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-foreground">
                                  {resolvedPlan}
                                </span>
                                <Badge variant="outline" className="font-mono text-[10px]">
                                  #{ctId}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {carteiraLabel} • Faturamento:{' '}
                                <strong className="uppercase">{String(ct.tipo_faturamento || 'auto')}</strong>
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <Badge
                                className={
                                  isBlocked
                                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-[10px]'
                                    : isActive
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px]'
                                    : 'bg-muted text-muted-foreground text-[10px]'
                                }
                              >
                                {String(ct.status_contrato || (isActive ? 'Ativo' : 'Inativo')).toUpperCase()}
                              </Badge>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                            <div className="rounded-lg bg-muted/40 px-2.5 py-1.5">
                              <span className="text-muted-foreground block">Valor Mensal</span>
                              <strong className="text-foreground font-mono">
                                {BRL.format(parseMoney(ct.valor_mensal || ct.valor))}
                              </strong>
                            </div>
                            <div className="rounded-lg bg-muted/40 px-2.5 py-1.5">
                              <span className="text-muted-foreground block">Dia Vencimento</span>
                              <strong className="text-foreground font-mono">
                                Dia {ct.dia_vencimento || '—'}
                              </strong>
                            </div>
                            <div className="rounded-lg bg-muted/40 px-2.5 py-1.5">
                              <span className="text-muted-foreground block">Fidelidade</span>
                              <strong className="text-foreground">
                                {ct.fidelidade_meses ? `${ct.fidelidade_meses} meses` : 'Sem'}
                              </strong>
                            </div>
                            <div className="rounded-lg bg-muted/40 px-2.5 py-1.5">
                              <span className="text-muted-foreground block">Adesão</span>
                              <strong className="text-foreground">
                                {formatDateBR(ct.data_adesao || ct.data_inicio)}
                              </strong>
                            </div>
                            <div className="rounded-lg bg-muted/40 px-2.5 py-1.5">
                              <span className="text-muted-foreground block">Carência até</span>
                              <strong className="text-foreground">
                                {formatDateBR(ct.data_final_carencia)}
                              </strong>
                            </div>
                            <div className="rounded-lg bg-muted/40 px-2.5 py-1.5">
                              <span className="text-muted-foreground block">Dias p/ Bloqueio</span>
                              <strong className="text-foreground">
                                {ct.dias_para_bloqueio ? `${ct.dias_para_bloqueio} dias` : 'Padrão'}
                              </strong>
                            </div>
                          </div>

                          {ct.observacoes && (
                            <p className="text-xs text-muted-foreground bg-muted/35 rounded-lg p-2 border border-border/60">
                              {String(ct.observacoes)}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/60">
                            <span className="text-[11px] text-muted-foreground">
                              Operação acesso: {formatDateBR(String(ct.data_oper_acesso || ''))}
                            </span>

                            <Button
                              size="sm"
                              variant={isBlocked ? 'default' : 'outline'}
                              disabled={unlockingId === ctId}
                              className="h-8 text-xs rounded-lg gap-1.5"
                              onClick={async () => {
                                setUnlockingId(ctId);
                                await unlock(ctId);
                                setUnlockingId(null);
                              }}
                            >
                              {unlockingId === ctId ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Unlock className="w-3.5 h-3.5" />
                              )}
                              Liberar em Confiança (3 dias)
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SpotlightCard>
            </div>
          )}

          {/* ================= ABA 2: FATURAS & PIX ================= */}
          {activeTab === 'faturas' && (
            <ClientInvoicesTab
              client={client}
              contacts={contacts}
              contracts={contracts}
              invoices={invoices}
              carteiras={carteiras}
              onGetPix={getPix}
            />
          )}

          {/* ================= ABA 3: REDE, RADIUS & SMARTOLT ================= */}
          {activeTab === 'rede' && (
            <div className="space-y-5">
              {/* SmartOLT ao Vivo */}
              {onu && (
                <SpotlightCard tone="cyan" showTopBeam className="p-5">
                  <div className="grid gap-4 md:grid-cols-12 items-center">
                    <div className="md:col-span-8 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <ShimmerBadge
                              pulse={onu.status === 'online'}
                              tone={onu.status === 'online' ? 'emerald' : 'rose'}
                            >
                              SmartOLT • {String(onu.status || '').toUpperCase()}
                            </ShimmerBadge>
                            {onu.olt_name && (
                              <Badge variant="outline" className="text-[10px]">
                                {onu.olt_name}
                              </Badge>
                            )}
                          </div>
                          <h3 className="font-bold text-base text-foreground">{onu.name}</h3>
                          <p className="text-xs text-muted-foreground font-mono">
                            {onu.onu_type || 'ONT'} • SN: {onu.sn}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-xl bg-muted/40 border border-border/60 p-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Sinal ONU (RX)
                          </p>
                          <div className="flex items-baseline gap-1 mt-1">
                            <span className="text-2xl font-black tabular-nums text-foreground">
                              {signal?.rx_power || '--'}
                            </span>
                            <span className="text-xs text-muted-foreground">dBm</span>
                          </div>
                          {signal?.rx_power_numeric && (
                            <div className="mt-2 h-1.5 w-full rounded-full bg-background overflow-hidden">
                              <div
                                className={`h-full transition-all ${
                                  signal.rx_power_numeric > -25
                                    ? 'bg-emerald-500'
                                    : signal.rx_power_numeric > -28
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                }`}
                                style={{
                                  width: `${Math.max(
                                    5,
                                    Math.min(100, (signal.rx_power_numeric + 40) * 2.5)
                                  )}%`,
                                }}
                              />
                            </div>
                          )}
                        </div>
                        <div className="rounded-xl bg-muted/40 border border-border/60 p-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Sinal OLT (TX)
                          </p>
                          <div className="flex items-baseline gap-1 mt-1">
                            <span className="text-2xl font-black tabular-nums text-foreground">
                              {signal?.olt_rx_power || '--'}
                            </span>
                            <span className="text-xs text-muted-foreground">dBm</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-4 flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl gap-2"
                        onClick={refreshSignal}
                        disabled={loadingSignal}
                      >
                        <Signal className={`w-4 h-4 ${loadingSignal ? 'animate-spin' : ''}`} />
                        Ler Sinal Óptico Agora
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl gap-2 border-rose-500/35 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                        onClick={() => {
                          if (
                            confirm(
                              'Atenção: A ONU será reiniciada e a conexão cairá por cerca de 1 minuto. Continuar?'
                            )
                          ) {
                            rebootOnu();
                          }
                        }}
                      >
                        <Zap className="w-4 h-4" />
                        Reiniciar ONU (OLT)
                      </Button>
                    </div>
                  </div>
                </SpotlightCard>
              )}

              {/* Pontos ISPFY (42 campos) + Turbo */}
              <SpotlightCard tone="blue" className="p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-primary" />
                    Pontos de Acesso PPPoE ({logins.length})
                  </h3>
                  {livePoints.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {livePoints.map((pt) => (
                        <Badge
                          key={pt.idPonto}
                          className={
                            pt.conexaoStatus === 'online'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px]'
                              : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-[10px]'
                          }
                        >
                          Ponto #{pt.idPonto}: {pt.conexaoStatus.toUpperCase()}
                          {pt.ipWan ? ` • ${pt.ipWan}` : ''}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {logins.length === 0 ? (
                  <AceternityEmptyState
                    icon={<WifiOff className="w-5 h-5" />}
                    title="Nenhum ponto PPPoE cadastrado"
                    description="Não localizamos pontos de acesso nos contratos deste cliente."
                  />
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {logins.map((pt) => {
                      const ptId = String(pt.id || '');
                      const userLogin = String(pt.usuario || pt.login || '—');
                      const isOn =
                        String(pt.sessao_conexao_status || pt.online || '').toLowerCase() ===
                          'online' ||
                        String(pt.online || '').toLowerCase() === 's';
                      const showPwd = Boolean(revealedPasswords[ptId]);

                      return (
                        <div
                          key={ptId}
                          className="rounded-xl border border-border/75 bg-background/70 dark:bg-white/[0.02] p-4 space-y-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-sm text-foreground">
                                  {userLogin}
                                </span>
                                <Badge variant="outline" className="font-mono text-[10px]">
                                  Ponto #{ptId}
                                </Badge>
                              </div>
                              {pt.nome_ponto && (
                                <p className="text-xs text-muted-foreground">{String(pt.nome_ponto)}</p>
                              )}
                            </div>
                            <Badge
                              className={
                                isOn
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px]'
                                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-[10px]'
                              }
                            >
                              {isOn ? 'ONLINE' : 'OFFLINE'}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div className="rounded-lg bg-muted/40 px-2.5 py-1.5">
                              <span className="text-muted-foreground block">Senha PPPoE</span>
                              <div className="flex items-center justify-between gap-1">
                                <strong className="font-mono text-foreground truncate">
                                  {pt.senha ? (showPwd ? String(pt.senha) : '••••••••') : '—'}
                                </strong>
                                {pt.senha && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setRevealedPasswords((prev) => ({
                                        ...prev,
                                        [ptId]: !prev[ptId],
                                      }))
                                    }
                                    className="text-muted-foreground hover:text-foreground"
                                  >
                                    {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="rounded-lg bg-muted/40 px-2.5 py-1.5">
                              <span className="text-muted-foreground block">IPv4 Alocado / WAN</span>
                              <strong className="font-mono text-foreground">
                                {String(pt.sessao_ipv4_wan_endereco_alocado || pt.ipv4_wan_endereco || pt.ip || 'Dinâmico')}
                              </strong>
                            </div>

                            <div className="rounded-lg bg-muted/40 px-2.5 py-1.5">
                              <span className="text-muted-foreground block">MAC</span>
                              <strong className="font-mono text-foreground">
                                {String(pt.mac || 'N/D')}
                              </strong>
                            </div>

                            <div className="rounded-lg bg-muted/40 px-2.5 py-1.5">
                              <span className="text-muted-foreground block">Banda Contratada</span>
                              <strong className="font-mono text-foreground">
                                {String(pt.banda_contratada || '—')}
                              </strong>
                            </div>

                            <div className="rounded-lg bg-muted/40 px-2.5 py-1.5">
                              <span className="text-muted-foreground block">NAS / Concentrador</span>
                              <strong className="font-mono text-foreground truncate block">
                                {String(pt.nas || '—')}
                              </strong>
                            </div>

                            <div className="rounded-lg bg-muted/40 px-2.5 py-1.5">
                              <span className="text-muted-foreground block">Último Login</span>
                              <strong className="font-mono text-foreground">
                                {formatDateBR(String(pt.ultimo_login || pt.sessao_ultimo_login || ''))}
                              </strong>
                            </div>
                          </div>

                          {pt.ipv6_wan_prefixo || pt.sessao_ipv6_wan_prefixo_alocado ? (
                            <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-1.5">
                              <Globe className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                              IPv6: {String(pt.sessao_ipv6_wan_prefixo_alocado || pt.ipv6_wan_prefixo)}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Turbo Temporário Real (/api/tool/assinante/plano/teste) */}
                {testablePlans.length > 0 && (livePoints[0]?.idPonto || logins[0]?.id) && (
                  <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/8 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Rocket className="w-4 h-4 text-indigo-500" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Turbo de Velocidade Temporário (API Oficial ISPFY)
                      </h4>
                    </div>
                    <div className="flex flex-col md:flex-row gap-2 items-end">
                      <div className="flex-1 w-full space-y-1">
                        <Label className="text-xs">Plano de Degustação / Turbo</Label>
                        <Select
                          value={turboPlanId || String(testablePlans[0]?.id || '')}
                          onValueChange={setTurboPlanId}
                        >
                          <SelectTrigger className="h-9 text-xs rounded-xl">
                            <SelectValue placeholder="Selecione um plano..." />
                          </SelectTrigger>
                          <SelectContent>
                            {testablePlans.map((p) => (
                              <SelectItem key={String(p.id)} value={String(p.id)}>
                                {String(p.nome || p.plano || p.descricao || `Plano #${p.id}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-full md:w-32 space-y-1">
                        <Label className="text-xs">Duração</Label>
                        <Select value={turboDays} onValueChange={setTurboDays}>
                          <SelectTrigger className="h-9 text-xs rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="3">3 dias</SelectItem>
                            <SelectItem value="7">7 dias</SelectItem>
                            <SelectItem value="15">15 dias</SelectItem>
                            <SelectItem value="30">30 dias</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        size="sm"
                        className="h-9 rounded-xl gap-1.5"
                        disabled={turboBusy}
                        onClick={async () => {
                          const targetPoint = livePoints[0]?.idPonto || String(logins[0]?.id || '');
                          const planToApply = turboPlanId || String(testablePlans[0]?.id || '');
                          if (!targetPoint || !planToApply) return;
                          setTurboBusy(true);
                          const days = Number(turboDays || 7);
                          const finalDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
                            .toISOString()
                            .split('T')[0];
                          await activateTurbo(targetPoint, planToApply, finalDate);
                          setTurboBusy(false);
                        }}
                      >
                        <Zap className="w-3.5 h-3.5" />
                        Ativar Turbo
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 rounded-xl"
                        disabled={turboBusy}
                        onClick={async () => {
                          const targetPoint = livePoints[0]?.idPonto || String(logins[0]?.id || '');
                          if (!targetPoint) return;
                          setTurboBusy(true);
                          await removeTurbo(targetPoint);
                          setTurboBusy(false);
                        }}
                      >
                        Reverter
                      </Button>
                    </div>
                  </div>
                )}
              </SpotlightCard>

              {/* Consumo 30 dias + Gráfico 7 dias */}
              {(bandwidthSummary || bandwidthUsage.length > 0) && (
                <SpotlightCard tone="violet" className="p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">
                        Consumo Real de Tráfego (ISPFY)
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Download e upload oficiais via `/api/tool/assinante/ponto/consumo`.
                      </p>
                    </div>
                    {bandwidthSummary && (
                      <div className="flex items-center gap-3 text-xs">
                        <Badge className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 font-mono">
                          DL 30d: {bandwidthSummary.downloadGb.toFixed(2)} GB
                        </Badge>
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-mono">
                          UL 30d: {bandwidthSummary.uploadGb.toFixed(2)} GB
                        </Badge>
                      </div>
                    )}
                  </div>

                  {bandwidthUsage.length > 0 && (
                    <div className="h-[220px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={bandwidthUsage}>
                          <defs>
                            <linearGradient id="explorerColorDown" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="rgba(148,163,184,0.16)"
                          />
                          <XAxis
                            dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11 }}
                          />
                          <YAxis hide />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'rgba(15, 23, 42, 0.92)',
                              border: '1px solid rgba(255,255,255,0.12)',
                              borderRadius: '12px',
                              fontSize: '12px',
                              color: '#f8fafc',
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="download"
                            stroke="#6366f1"
                            fill="url(#explorerColorDown)"
                            strokeWidth={2}
                            name="Download (GB)"
                          />
                          <Area
                            type="monotone"
                            dataKey="upload"
                            stroke="#10b981"
                            fill="transparent"
                            strokeWidth={2}
                            name="Upload (GB)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </SpotlightCard>
              )}

              {/* Sessões RADIUS & Histórico da Estação */}
              {stationDetails &&
                (stationDetails.sessoes.length > 0 || stationDetails.history.length > 0) && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <SpotlightCard tone="emerald" className="p-5 space-y-3">
                      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-500" />
                        Sessões RADIUS ({stationDetails.sessoes.length})
                      </h3>
                      {stationDetails.sessoes.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Sem sessões RADIUS recentes.</p>
                      ) : (
                        <div className="max-h-60 overflow-y-auto divide-y divide-border/70 text-xs">
                          {stationDetails.sessoes.slice(0, 12).map((s, idx) => (
                            <div key={String(s.id || idx)} className="py-2 space-y-0.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono font-semibold text-foreground">
                                  {String(s.usuario || s.login || 'PPPoE')} •{' '}
                                  {String(s.ipv4_wan_endereco_alocado || s.ip || 'IP N/D')}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] uppercase"
                                >
                                  {String(s.status || 'sessão')}
                                </Badge>
                              </div>
                              <p className="text-[11px] font-mono text-muted-foreground">
                                MAC: {String(s.mac || '—')} {s.chave ? `• Chave: ${String(s.chave)}` : ''}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </SpotlightCard>

                    <SpotlightCard tone="amber" className="p-5 space-y-3">
                      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-500" />
                        Histórico da Estação ({stationDetails.history.length})
                      </h3>
                      {stationDetails.history.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Nenhum evento de queda recente na estação.
                        </p>
                      ) : (
                        <div className="max-h-60 overflow-y-auto divide-y divide-border/70 text-xs">
                          {stationDetails.history.slice(0, 12).map((ev, idx) => (
                            <div
                              key={idx}
                              className="py-2 flex items-center justify-between gap-2"
                            >
                              <span className="font-medium text-foreground truncate">
                                {String(ev.evento || ev.status || ev.mensagem || ev.ip || 'Evento')}
                              </span>
                              <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                                {formatDateBR(
                                  String(ev.data || ev.created_at || ev.data_cadastro || '')
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </SpotlightCard>
                  </div>
                )}

              {livePoints[0] && (
                <div className="text-[11px] text-muted-foreground flex flex-wrap gap-4 px-1">
                  <span>
                    Download acumulado mês (ponto):{' '}
                    <strong className="text-foreground">
                      {formatBytesKbytes(livePoints[0].downloadMesKbytes)}
                    </strong>
                  </span>
                  <span>
                    Upload acumulado mês (ponto):{' '}
                    <strong className="text-foreground">
                      {formatBytesKbytes(livePoints[0].uploadMesKbytes)}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ================= ABA 4: CHAMADOS & O.S. ================= */}
          {activeTab === 'chamados' && (
            <SpotlightCard tone="violet" className="p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                    <LifeBuoy className="w-4 h-4 text-violet-500" />
                    Ordens de Serviço &amp; Chamados ({tickets.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Abertura e encerramento integrados diretamente via API oficial do ISPFY.
                  </p>
                </div>

                <QuickOSModal
                  preselectedClient={client}
                  onSuccess={() => {
                    refreshTickets();
                  }}
                  trigger={
                    <MovingBorderButton size="sm" tone="emerald">
                      <Ticket className="w-3.5 h-3.5" />
                      Nova Ordem de Serviço
                    </MovingBorderButton>
                  }
                />
              </div>

              {tickets.length === 0 ? (
                <AceternityEmptyState
                  icon={<Ticket className="w-5 h-5" />}
                  title="Nenhum chamado registrado"
                  description="Este cliente não possui O.S. no histórico do ISPFY."
                />
              ) : (
                <div className="space-y-2.5">
                  {tickets.map((tk) => {
                    const tkId = String(tk.id || '');
                    const st = String(tk.status || '').toLowerCase();
                    const isClosed =
                      st === 'f' ||
                      st.includes('fech') ||
                      st.includes('final') ||
                      st.includes('cancel') ||
                      Boolean(tk.data_fechamento);

                    return (
                      <div
                        key={tkId}
                        className="rounded-xl border border-border/75 bg-background/70 dark:bg-white/[0.02] p-3.5 space-y-2"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="font-mono text-[10px]">
                                O.S. #{tkId}
                              </Badge>
                              <Badge
                                className={
                                  isClosed
                                    ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px]'
                                    : 'bg-amber-500/12 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px]'
                                }
                              >
                                {isClosed ? 'Finalizado' : String(tk.status || 'Aberto')}
                              </Badge>
                              {tk.prioridade && (
                                <span className="text-[11px] font-semibold text-muted-foreground">
                                  Prioridade: {String(tk.prioridade)}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-bold text-foreground">
                              {String(tk.assunto || tk.titulo || `Chamado #${tkId}`)}
                            </p>
                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Abertura: {formatDateBR(tk.data_abertura || String(tk.data_cadastro || ''))}
                              </span>
                              {tk.data_fechamento && (
                                <span>Fechamento: {formatDateBR(tk.data_fechamento)}</span>
                              )}
                              {tk.tecnico && <span>Técnico: <strong>{tk.tecnico}</strong></span>}
                            </div>
                          </div>

                          {!isClosed && tkId && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={closingTicketId === tkId}
                              className="h-8 text-xs rounded-lg gap-1.5 border-emerald-500/35 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 shrink-0"
                              onClick={async () => {
                                if (!confirm(`Finalizar o chamado #${tkId} no ISPFY?`)) return;
                                setClosingTicketId(tkId);
                                await closeTicket(tkId);
                                setClosingTicketId(null);
                              }}
                            >
                              {closingTicketId === tkId ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              Finalizar O.S.
                            </Button>
                          )}
                        </div>

                        {(tk.descricao || tk.mensagem || tk.requisicao) && (
                          <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2.5 border border-border/60 whitespace-pre-wrap">
                            {String(tk.descricao || tk.mensagem || tk.requisicao)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </SpotlightCard>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  ClipboardList,
  Copy,
  CreditCard,
  ExternalLink,
  FileDown,
  Globe,
  Loader2,
  MapPin,
  MessageSquare,
  Phone,
  Radio,
  RefreshCw,
  Send,
  Signal,
  User,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ispfyService } from '@/services/ispfy/ispfyService';
import { smartOltService } from '@/services/smartolt/smartOltService';
import { whapiService } from '@/services/whapi/whapiService';
import { useAuth } from '@/contexts/AuthContext';
import type { QuickClientPreviewSeed } from '@/contexts/QuickClientDrawerContext';
import type {
  ISPFYClienteData,
  ISPFYContratoData,
  ISPFYFaturaData,
  ISPFYLivePointStatus,
  ISPFYLoginData,
} from '@/types/ispfy';
import type { SmartOltOnu } from '@/types/smartOlt';
import { getOntStatusMeta } from '@/utils/smartOltUi';
import { partitionCurrentAndFutureInvoices } from '@/utils/invoiceHelpers';
import { abrirConversaWhatsApp } from '@/lib/utils';
import { prefetchRoute } from '@/config/routePrefetch';
import {
  isAvlDesktopRuntime,
  openIspfyDockedWindow,
} from '@/components/ispfy/IspfyWebViewKeepAlive';

interface QuickClientDrawerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seed: QuickClientPreviewSeed | null;
}

interface QuickDrawerCacheEntry {
  fetchedAt: number;
  client: ISPFYClienteData | null;
  contracts: ISPFYContratoData[];
  logins: ISPFYLoginData[];
  livePoints: ISPFYLivePointStatus[];
  openInvoices: ISPFYFaturaData[];
  onu: SmartOltOnu | null;
}

const CACHE_TTL_MS = 2 * 60 * 1000;
const quickDrawerCache = new Map<string, QuickDrawerCacheEntry>();

function resolveClientName(c: ISPFYClienteData | null, fallback?: string): string {
  return String(c?.nome_razao || c?.razao || c?.nome || fallback || 'Cliente ISPFY').trim();
}

function resolveClientPhone(c: ISPFYClienteData | null, fallback?: string): string {
  return String(
    c?.fone_whatsapp ||
      c?.fone_celular ||
      c?.telefone_celular ||
      c?.fone_residencial ||
      fallback ||
      ''
  ).trim();
}

function resolveClientAddress(c: ISPFYClienteData | null, seed?: QuickClientPreviewSeed | null): string {
  if (c) {
    const rua = String(c.endereco_cobranca_rua || c.endereco || '').trim();
    const num = String(c.endereco_cobranca_numero || '').trim();
    const bairro = String(c.endereco_cobranca_bairro || c.bairro || '').trim();
    const cidade = String(c.cidade || '').trim();
    const line = [[rua, num].filter(Boolean).join(', '), bairro, cidade].filter(Boolean).join(' • ');
    if (line) return line;
  }
  return (
    seed?.enderecoCompleto ||
    [seed?.rua, seed?.bairro].filter(Boolean).join(' • ') ||
    'Endereço não informado'
  );
}

function isInvoiceOverdue(vencimento?: string): boolean {
  if (!vencimento) return false;
  const clean = String(vencimento).trim();
  let dateObj: Date | null = null;
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    dateObj = new Date(`${clean.slice(0, 10)}T23:59:59`);
  } else if (/^\d{2}\/\d{2}\/\d{4}/.test(clean)) {
    const [d, m, y] = clean.slice(0, 10).split('/');
    dateObj = new Date(`${y}-${m}-${d}T23:59:59`);
  }
  if (!dateObj || Number.isNaN(dateObj.getTime())) return false;
  return dateObj.getTime() < Date.now();
}

function formatDueDate(vencimento?: string): string {
  if (!vencimento) return '—';
  const clean = String(vencimento).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const [y, m, d] = clean.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  return clean;
}

function getSignalMeta(rx: number | null) {
  if (rx === null) return { label: 'Sem leitura', textClass: 'text-muted-foreground', barClass: 'bg-muted', pct: 0 };
  if (rx >= -24) return { label: 'Sinal Ótimo', textClass: 'text-emerald-600 dark:text-emerald-400', barClass: 'bg-emerald-500', pct: 88 };
  if (rx >= -27) return { label: 'Atenção', textClass: 'text-amber-600 dark:text-amber-400', barClass: 'bg-amber-500', pct: 55 };
  return { label: 'Crítico', textClass: 'text-rose-600 dark:text-rose-400', barClass: 'bg-rose-500', pct: 25 };
}

export const QuickClientDrawerSheet: React.FC<QuickClientDrawerSheetProps> = ({
  open,
  onOpenChange,
  seed,
}) => {
  const navigate = useNavigate();
  const { canAccessRoute } = useAuth();

  const [loading, setLoading] = useState(false);
  const [loadingOnt, setLoadingOnt] = useState(false);
  const [client, setClient] = useState<ISPFYClienteData | null>(null);
  const [contracts, setContracts] = useState<ISPFYContratoData[]>([]);
  const [logins, setLogins] = useState<ISPFYLoginData[]>([]);
  const [livePoints, setLivePoints] = useState<ISPFYLivePointStatus[]>([]);
  const [openInvoices, setOpenInvoices] = useState<ISPFYFaturaData[]>([]);
  const [onu, setOnu] = useState<SmartOltOnu | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [busyInvoiceId, setBusyInvoiceId] = useState<string | null>(null);

  const clienteId = seed?.clienteId || '';

  const copyText = useCallback((text: string, key: string, label: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text).catch(() => undefined);
    setCopiedKey(key);
    toast.success(`${label} copiado!`);
    window.setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 1500);
  }, []);

  const loadClientData = useCallback(
    async (targetId: string, forceFresh = false, forceLiveOnt = false) => {
      if (!targetId) return;

      if (!forceFresh) {
        const cached = quickDrawerCache.get(targetId);
        if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
          setClient(cached.client);
          setContracts(cached.contracts);
          setLogins(cached.logins);
          setLivePoints(cached.livePoints);
          setOpenInvoices(cached.openInvoices);
          setOnu(cached.onu);
          setLoading(false);
          setLoadingOnt(false);
          return;
        }
      }

      setLoading(true);
      setLoadingOnt(true);
      if (forceFresh) {
        ispfyService.clearRecentGetCache();
      }

      try {
        const [cliRes, contractsRes, loginsRes, invoicesRes, pointsRes] = await Promise.all([
          ispfyService.getClienteById(targetId).catch(() => null),
          ispfyService.getContratosByCliente(targetId).catch(() => []),
          ispfyService.getLoginsByCliente(targetId).catch(() => []),
          ispfyService.getFaturasByCliente(targetId).catch(() => []),
          ispfyService.getClientLivePointStatuses(targetId).catch(() => []),
        ]);

        const openOnly = partitionCurrentAndFutureInvoices(invoicesRes).current.map(
          (item) => item.invoice
        );

        setClient(cliRes);
        setContracts(contractsRes);
        setLogins(loginsRes);
        setLivePoints(pointsRes);
        setOpenInvoices(openOnly);
        setLoading(false);

        // Consulta SmartOLT em paralelo logo após obter logins PPPoE + nome
        const pppoeLogins = Array.from(
          new Set(
            [
              seed?.usuarioPppoe,
              ...loginsRes.map((l) => String(l.login || l.usuario || '')),
            ]
              .map((v) => String(v || '').trim())
              .filter((v) => v.length >= 3)
          )
        );
        const fullNames = Array.from(
          new Set(
            [resolveClientName(cliRes, seed?.nome)]
              .map((v) => v.trim())
              .filter((v) => v.length >= 4 && v !== 'Cliente ISPFY')
          )
        );

        let matchedOnu: SmartOltOnu | null = null;
        if (pppoeLogins.length > 0 || fullNames.length > 0) {
          const ontRes = await smartOltService
            .findClientOnu({
              pppoeLogins,
              fullNames,
              live: forceLiveOnt,
            })
            .catch(() => null);
          matchedOnu = ontRes?.onu || null;
        }

        setOnu(matchedOnu);
        quickDrawerCache.set(targetId, {
          fetchedAt: Date.now(),
          client: cliRes,
          contracts: contractsRes,
          logins: loginsRes,
          livePoints: pointsRes,
          openInvoices: openOnly,
          onu: matchedOnu,
        });
      } finally {
        setLoading(false);
        setLoadingOnt(false);
      }
    },
    [seed?.nome, seed?.usuarioPppoe]
  );

  useEffect(() => {
    if (!open || !clienteId) return;
    setClient(null);
    setContracts([]);
    setLogins([]);
    setLivePoints([]);
    setOpenInvoices([]);
    setOnu(null);
    void loadClientData(clienteId, false, false);
  }, [open, clienteId, loadClientData]);

  const displayName = resolveClientName(client, seed?.nome);
  const phone = resolveClientPhone(client, seed?.telefone);
  const cpfCnpj = String(client?.cpf_cnpj || client?.cnpj_cpf || '').trim();
  const addressLine = resolveClientAddress(client, seed);

  const connectionSummary = useMemo(() => {
    if (livePoints.length > 0) {
      const anyOnline = livePoints.some((p) => p.conexaoStatus.toLowerCase().includes('online'));
      const anyBlocked = livePoints.some((p) => p.isBlocked);
      if (anyBlocked) return { label: 'Bloqueado', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30', ok: false };
      if (anyOnline) return { label: 'Online', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30', ok: true };
      return { label: 'Sem Internet', cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/35', ok: false };
    }
    if (seed?.connectionHealth === 'ok') {
      return { label: 'Online', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30', ok: true };
    }
    if (seed?.connectionHealth === 'desconectado') {
      return { label: 'Sem Internet', cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/35', ok: false };
    }
    if (seed?.connectionHealth === 'bloqueado') {
      return { label: 'Bloqueado', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30', ok: false };
    }
    return null;
  }, [livePoints, seed?.connectionHealth]);

  const handleCopyPix = async (f: ISPFYFaturaData) => {
    if (!f.id) return;
    setBusyInvoiceId(`copy-${f.id}`);
    try {
      const pixData = await ispfyService.getPixQrCode(String(f.id), cpfCnpj, f);
      const code = String(
        pixData?.pix_copia_cola ||
          pixData?.qrcode_text ||
          pixData?.qr_code ||
          pixData?.linha_digitavel ||
          f.linha_digitavel ||
          ''
      ).trim();
      if (!code) {
        toast.warning('Fatura sem código PIX ou linha digitável no ISPFY.');
        return;
      }
      navigator.clipboard?.writeText(code).catch(() => undefined);
      toast.success(
        pixData?.pix_copia_cola || pixData?.qrcode_text
          ? 'PIX Copia e Cola copiado!'
          : 'Linha digitável copiada!'
      );
    } catch {
      toast.error('Não foi possível obter o código PIX agora.');
    } finally {
      setBusyInvoiceId(null);
    }
  };

  const handleSendPixWhatsApp = async (f: ISPFYFaturaData) => {
    if (!f.id) return;
    if (!phone) {
      toast.warning('Cliente sem telefone cadastrado para disparo no WhatsApp.');
      return;
    }
    setBusyInvoiceId(`send-${f.id}`);
    try {
      const pixData = await ispfyService.getPixQrCode(String(f.id), cpfCnpj, f);
      const pixCode = String(
        pixData?.pix_copia_cola || pixData?.qrcode_text || pixData?.qr_code || ''
      ).trim();
      if (!pixCode) {
        toast.warning('Sem código PIX disponível para envio direto. Tente abrir o PDF.');
        return;
      }
      const res = await whapiService.sendButtonPix({
        to: phone,
        pixCode,
        message: `💰 *Fatura AVL Telecom*\nValor: *R$ ${f.valor || '0,00'}* • Vencimento: *${formatDueDate(
          f.data_vencimento
        )}*\n\nToque no botão abaixo para copiar o PIX:`,
        merchantName: 'AVL Telecom',
      });
      if (res.sent) {
        toast.success(`Botão PIX enviado no WhatsApp de ${displayName}!`);
      } else {
        toast.error(res.error || 'Não foi possível enviar o PIX pelo WhatsApp.');
      }
    } catch {
      toast.error('Erro ao enviar PIX no WhatsApp.');
    } finally {
      setBusyInvoiceId(null);
    }
  };

  const handleOpenBoletoPdf = async (f: ISPFYFaturaData) => {
    if (!f.id) return;
    setBusyInvoiceId(`pdf-${f.id}`);
    try {
      let url = ispfyService.extractHttpLinkFromInvoiceRecord(f);
      if (!url) {
        const res = await ispfyService.getBoletoPdf(String(f.id), cpfCnpj).catch(() => null);
        if (res?.url && /^https?:\/\//i.test(res.url)) {
          url = res.url;
        }
      }
      if (!url) {
        toast.warning('Link/PDF do boleto não disponível nesta fatura.');
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setBusyInvoiceId(null);
    }
  };

  const ontMeta = onu ? getOntStatusMeta(onu.status) : null;
  const rxPower = onu ? onu.rx_power_numeric ?? onu.olt_rx_power_numeric ?? null : null;
  const signalMeta = getSignalMeta(rxPower);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[470px] p-0 flex flex-col bg-card/95 backdrop-blur-2xl border-l border-border/70"
      >
        {/* Cabeçalho fixo do cliente */}
        <SheetHeader className="px-5 py-4 border-b border-border/60 text-left space-y-2">
          <div className="flex items-start justify-between gap-2 pr-7">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <SheetTitle className="text-base font-bold tracking-tight truncate max-w-[270px]">
                  {displayName}
                </SheetTitle>
                {connectionSummary && (
                  <Badge variant="outline" className={`text-[10px] font-semibold ${connectionSummary.cls}`}>
                    {connectionSummary.ok ? (
                      <Wifi className="w-3 h-3 mr-1" />
                    ) : (
                      <WifiOff className="w-3 h-3 mr-1" />
                    )}
                    {connectionSummary.label}
                  </Badge>
                )}
              </div>
              <SheetDescription className="text-xs flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 shrink-0 text-primary" />
                <span className="truncate">{addressLine}</span>
              </SheetDescription>
            </div>
          </div>

          {/* Chips copiáveis rápidos: ID, CPF/CNPJ, Telefone */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {clienteId && (
              <button
                type="button"
                onClick={() => copyText(clienteId, 'id', 'ID ISPFY')}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-secondary/70 hover:bg-secondary text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>#{clienteId}</span>
                {copiedKey === 'id' ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5 opacity-60" />}
              </button>
            )}
            {cpfCnpj && (
              <button
                type="button"
                onClick={() => copyText(cpfCnpj, 'cpf', 'CPF/CNPJ')}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-secondary/70 hover:bg-secondary text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>{cpfCnpj}</span>
                {copiedKey === 'cpf' ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5 opacity-60" />}
              </button>
            )}
            {phone && (
              <button
                type="button"
                onClick={() => copyText(phone, 'phone', 'Telefone')}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-secondary/70 hover:bg-secondary text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
              >
                <Phone className="w-2.5 h-2.5 text-emerald-500" />
                <span>{phone}</span>
                {copiedKey === 'phone' ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5 opacity-60" />}
              </button>
            )}
          </div>

          {/* Barra de 4 Ações Rápidas */}
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!phone}
              onClick={() => {
                if (phone) abrirConversaWhatsApp(phone);
              }}
              className="h-8 rounded-xl text-[11px] font-semibold gap-1 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              WhatsApp
            </Button>

            {canAccessRoute('/ispfy/nova-os') && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onMouseEnter={() => prefetchRoute('/ispfy/nova-os')}
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/ispfy/nova-os?clienteId=${clienteId}`, {
                    state: client ? { preselectedClient: client } : undefined,
                  });
                }}
                className="h-8 rounded-xl text-[11px] font-semibold gap-1 border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary"
              >
                <ClipboardList className="w-3.5 h-3.5 shrink-0" />
                Nova O.S.
              </Button>
            )}

            {canAccessRoute('/ispfy/consulta') && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onMouseEnter={() => prefetchRoute(`/ispfy/cliente/${clienteId}`)}
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/ispfy/cliente/${clienteId}`);
                }}
                className="h-8 rounded-xl text-[11px] font-semibold gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                Ficha 360°
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading || loadingOnt}
              onClick={() => void loadClientData(clienteId, true, true)}
              className="h-8 rounded-xl text-[11px] font-semibold gap-1"
              title="Revalidar ISPFY e SmartOLT ao vivo"
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${loading || loadingOnt ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>

          {canAccessRoute('/ispfy/web') && (
            <div className="flex items-center gap-1.5 pt-0.5">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  const queryToCopy = cpfCnpj || displayName;
                  if (queryToCopy) {
                    navigator.clipboard?.writeText(queryToCopy).catch(() => undefined);
                    toast.success(`"${queryToCopy}" copiado! Cole (Ctrl+V) na busca do ISPFY.`);
                  }
                  if (isAvlDesktopRuntime()) {
                    onOpenChange(false);
                    navigate('/ispfy/web');
                  } else {
                    openIspfyDockedWindow('right');
                  }
                }}
                className="flex-1 h-7 rounded-xl text-[11px] font-medium gap-1.5 bg-secondary/70 hover:bg-secondary"
              >
                <Globe className="w-3.5 h-3.5 text-primary" />
                {isAvlDesktopRuntime()
                  ? 'Abrir no ISPFY Embutido (copia CPF/Nome)'
                  : 'Abrir no ISPFY (copia CPF/Nome)'}
              </Button>
            </div>
          )}
        </SheetHeader>

        {/* Corpo rolável */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* 1. Sinal Óptico SmartOLT */}
          <section className="rounded-2xl border border-border/70 bg-secondary/25 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-primary" />
                Fibra &amp; SmartOLT
              </span>
              {onu && (
                <button
                  type="button"
                  disabled={loadingOnt}
                  onClick={() => void loadClientData(clienteId, true, true)}
                  className="text-[11px] font-medium text-primary hover:underline inline-flex items-center gap-1"
                >
                  <Zap className="w-3 h-3" />
                  Medir ao vivo
                </button>
              )}
            </div>

            {loadingOnt ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-44" />
                <Skeleton className="h-3 w-full" />
              </div>
            ) : onu && ontMeta ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Badge variant="outline" className={`text-[11px] font-semibold ${ontMeta.badgeClass}`}>
                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${ontMeta.dotClass}`} />
                    {ontMeta.label}
                  </Badge>
                  <div className="flex items-center gap-1.5">
                    <Signal className={`w-3.5 h-3.5 ${signalMeta.textClass}`} />
                    <span className={`text-xs font-bold tabular-nums ${signalMeta.textClass}`}>
                      {rxPower !== null ? `${rxPower.toFixed(2)} dBm` : 'Sem sinal'}
                    </span>
                    <span className="text-[10px] text-muted-foreground">({signalMeta.label})</span>
                  </div>
                </div>

                {rxPower !== null && (
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${signalMeta.barClass}`}
                      style={{ width: `${signalMeta.pct}%` }}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-0.5">
                  <div className="rounded-xl bg-background/70 border border-border/50 px-2.5 py-1.5">
                    <span className="block text-[10px] text-muted-foreground">OLT / Porta PON</span>
                    <span className="font-semibold text-foreground truncate block">
                      {onu.olt_name || `OLT ${onu.olt_id}`} • {onu.board}/{onu.pon_port}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText(onu.sn, 'sn', 'Serial ONT')}
                    className="text-left rounded-xl bg-background/70 hover:bg-background border border-border/50 px-2.5 py-1.5 transition-colors"
                  >
                    <span className="block text-[10px] text-muted-foreground">Serial (SN)</span>
                    <span className="font-mono font-semibold text-foreground truncate flex items-center justify-between gap-1">
                      <span className="truncate">{onu.sn}</span>
                      <Copy className="w-3 h-3 opacity-60 shrink-0" />
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Nenhuma ONT vinculada automaticamente no SmartOLT para este assinante.
              </p>
            )}
          </section>

          {/* 2. Conexão & PPPoE */}
          <section className="rounded-2xl border border-border/70 bg-secondary/25 p-3.5 space-y-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5 text-primary" />
              Conexão &amp; PPPoE
            </span>

            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            ) : livePoints.length > 0 ? (
              <div className="space-y-2">
                {livePoints.map((pt) => {
                  const online = pt.conexaoStatus.toLowerCase().includes('online');
                  const loginObj = logins.find(
                    (l) => String(l.id_ponto || '') === String(pt.idPonto)
                  ) || logins[0];
                  const pppoeUser = String(
                    loginObj?.login || loginObj?.usuario || seed?.usuarioPppoe || ''
                  ).trim();

                  return (
                    <div
                      key={pt.idPonto}
                      className="rounded-xl bg-background/80 border border-border/60 p-2.5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-foreground truncate">
                          {pt.planoNome || seed?.plano || pt.nomePonto || `Ponto #${pt.idPonto}`}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            pt.isBlocked
                              ? 'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                              : online
                              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              : 'border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                          }`}
                        >
                          {pt.isBlocked ? 'Bloqueado' : online ? 'Online' : 'Offline'}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        {pppoeUser && (
                          <button
                            type="button"
                            onClick={() => copyText(pppoeUser, `pppoe-${pt.idPonto}`, 'Login PPPoE')}
                            className="inline-flex items-center gap-1 font-mono text-foreground/90 hover:text-primary"
                          >
                            <span>{pppoeUser}</span>
                            <Copy className="w-2.5 h-2.5 opacity-60" />
                          </button>
                        )}
                        {pt.ipWan && <span className="font-mono">• IP {pt.ipWan}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : logins.length > 0 ? (
              <div className="space-y-1.5">
                {logins.slice(0, 3).map((l, idx) => {
                  const userStr = String(l.login || l.usuario || '');
                  return (
                    <div
                      key={l.id || idx}
                      className="flex items-center justify-between rounded-xl bg-background/80 border border-border/60 px-3 py-2 text-xs"
                    >
                      <span className="font-mono font-semibold truncate">{userStr || 'Sem login'}</span>
                      {userStr && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => copyText(userStr, `login-${idx}`, 'Login PPPoE')}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sem pontos PPPoE ativos localizados.</p>
            )}
          </section>

          {/* 3. Faturas em Aberto & PIX */}
          <section className="rounded-2xl border border-border/70 bg-secondary/25 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-primary" />
                Faturas em Aberto ({openInvoices.length})
              </span>
            </div>

            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            ) : openInvoices.length === 0 ? (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                Nenhuma fatura em aberto ou vencida!
              </div>
            ) : (
              <div className="space-y-2">
                {openInvoices.map((f) => {
                  const overdue = isInvoiceOverdue(f.data_vencimento);
                  return (
                    <div
                      key={f.id}
                      className={`rounded-xl border p-2.5 space-y-2 ${
                        overdue
                          ? 'bg-rose-500/[0.06] border-rose-500/30'
                          : 'bg-background/80 border-border/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-foreground tabular-nums">
                            R$ {f.valor || '0,00'}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Venc.: {formatDueDate(f.data_vencimento)}
                          </p>
                        </div>
                        <Badge
                          variant={overdue ? 'destructive' : 'outline'}
                          className="text-[10px]"
                        >
                          {overdue ? (
                            <span className="flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Vencida
                            </span>
                          ) : (
                            'Em aberto'
                          )}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busyInvoiceId !== null}
                          onClick={() => void handleCopyPix(f)}
                          className="h-7 rounded-lg text-[11px] gap-1"
                        >
                          {busyInvoiceId === `copy-${f.id}` ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          Copiar PIX
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busyInvoiceId !== null || !phone}
                          onClick={() => void handleSendPixWhatsApp(f)}
                          className="h-7 rounded-lg text-[11px] gap-1 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                        >
                          {busyInvoiceId === `send-${f.id}` ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Send className="w-3 h-3" />
                          )}
                          Enviar PIX
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busyInvoiceId !== null}
                          onClick={() => void handleOpenBoletoPdf(f)}
                          className="h-7 rounded-lg text-[11px] gap-1"
                        >
                          {busyInvoiceId === `pdf-${f.id}` ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <FileDown className="w-3 h-3" />
                          )}
                          PDF
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 4. Contratos */}
          {contracts.length > 0 && (
            <section className="rounded-2xl border border-border/70 bg-secondary/25 p-3.5 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" />
                Contratos ({contracts.length})
              </span>
              <div className="space-y-1.5">
                {contracts.slice(0, 4).map((ct) => (
                  <div
                    key={ct.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-background/80 border border-border/60 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {ct.plano || ct.descricao || `Contrato #${ct.id}`}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {ct.valor_mensal || ct.valor ? `R$ ${ct.valor_mensal || ct.valor}` : 'Valor padrão'}
                        {ct.dia_vencimento ? ` • Dia ${ct.dia_vencimento}` : ''}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {ct.status_contrato || ct.status || 'Ativo'}
                    </Badge>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

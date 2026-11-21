import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Link2,
  Loader2,
  PowerOff,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Signal,
  TrendingUp,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { smartOltService } from '@/services/smartolt/smartOltService';
import { getOntStatusMeta } from '@/utils/smartOltUi';
import type {
  SmartOltMatchReason,
  SmartOltOnu,
  SmartOltOnuDiagnostics,
} from '@/types/smartOlt';
import { toast } from 'sonner';

interface ClientOntStatusCardProps {
  clientId: string;
  savedOnuId?: string | null;
  pppoeLogins: string[];
  fullNames: string[];
  onSendMessage?: (message: string) => void;
  onOntResolved?: (onu: SmartOltOnu | null) => void;
}

function getMatchReasonLabel(reason: SmartOltMatchReason): { label: string; className: string } | null {
  switch (reason) {
    case 'linked_id':
      return {
        label: 'Vinculada',
        className: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
      };
    case 'sn':
      return {
        label: 'Serial exato',
        className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
      };
    case 'pppoe_exact':
    case 'pppoe_base':
      return {
        label: 'PPPoE exato',
        className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
      };
    case 'full_name':
      return {
        label: 'Por nome',
        className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
      };
    default:
      return null;
  }
}

function getEffectiveRx(onu: SmartOltOnu): number | null {
  return onu.rx_power_numeric ?? onu.olt_rx_power_numeric ?? null;
}

function getSignalColor(rx: number | null): {
  text: string;
  bar: string;
  label: string;
} {
  if (rx === null) {
    return { text: 'text-muted-foreground', bar: 'bg-muted', label: 'Sem leitura' };
  }
  if (rx >= -24) {
    return {
      text: 'text-emerald-600 dark:text-emerald-400',
      bar: 'bg-emerald-500',
      label: 'Ótimo',
    };
  }
  if (rx >= -27) {
    return {
      text: 'text-amber-600 dark:text-amber-400',
      bar: 'bg-amber-500',
      label: 'Atenção',
    };
  }
  return {
    text: 'text-rose-600 dark:text-rose-400',
    bar: 'bg-rose-500',
    label: 'Crítico',
  };
}

function formatDurationShort(seconds: number): string {
  if (!seconds || seconds <= 0) return '0m';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs >= 24) {
    const days = Math.floor(hrs / 24);
    const remH = hrs % 24;
    return remH > 0 ? `${days}d ${remH}h` : `${days}d`;
  }
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${Math.max(1, mins)}m`;
}

function formatStatusTimestamp(raw?: string): string {
  if (!raw) return '';
  const cleaned = raw.split('.')[0].replace(' ', 'T');
  const d = new Date(cleaned);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 16);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildDiagnosticWhatsAppMessage(onu: SmartOltOnu): string {
  const rx = getEffectiveRx(onu);
  const rxStr = rx !== null ? `${rx.toFixed(2)} dBm` : null;

  if (onu.status === 'power_fail') {
    return (
      '⚡ *Diagnóstico da Fibra (AVL Telecom):*\n' +
      'Identifiquei aqui no nosso monitoramento óptico que o seu equipamento está *sem energia elétrica* (Power Fail).\n\n' +
      'Poderia verificar se a fonte da ONU/roteador está bem encaixada na tomada e se a luz *Power* está acesa?'
    );
  }
  if (onu.status === 'los') {
    return (
      '🔴 *Diagnóstico da Fibra (AVL Telecom):*\n' +
      'Verifiquei seu equipamento na nossa central e ele está com *perda de sinal óptico (LOS)*.\n\n' +
      'Poderia checar se o cabo fininho da fibra óptica está bem conectado no aparelho e sem dobras? Se estiver tudo certinho, já vou agilizar o suporte técnico para você!'
    );
  }
  if (onu.status === 'online' && rx !== null && rx < -27) {
    return (
      `⚠️ *Diagnóstico da Fibra (AVL Telecom):*\n` +
      `Seu equipamento está conectado, mas detectamos sinal óptico fraco (*${rxStr}*), o que pode causar lentidão ou oscilações.\n\n` +
      `Vou registrar a análise técnica para regularizarmos seu sinal!`
    );
  }
  if (onu.status === 'online') {
    return (
      `✅ *Diagnóstico da Fibra (AVL Telecom):*\n` +
      `Acabei de verificar seu equipamento na nossa central e a fibra está *Online com sinal normal*` +
      `${rxStr ? ` (*${rxStr}*)` : ''}.\n\n` +
      `Vamos verificar juntos a conexão do seu Wi-Fi/roteador para normalizar tudo!`
    );
  }
  return (
    '📡 *Diagnóstico da Fibra (AVL Telecom):*\n' +
    'Verifiquei aqui no monitoramento óptico que seu equipamento aparece *Offline* no momento.\n\n' +
    'Poderia reiniciar o aparelho retirando da tomada por 30 segundos e me avisar quais luzes acendem?'
  );
}

export function ClientOntStatusCard({
  clientId,
  savedOnuId,
  pppoeLogins,
  fullNames,
  onSendMessage,
  onOntResolved,
}: ClientOntStatusCardProps) {
  const [loading, setLoading] = useState(false);
  const [liveRefreshing, setLiveRefreshing] = useState(false);
  const [onu, setOnu] = useState<SmartOltOnu | null>(null);
  const [matchReason, setMatchReason] = useState<SmartOltMatchReason>('none');
  const [candidates, setCandidates] = useState<SmartOltOnu[]>([]);
  const [diagnostics, setDiagnostics] = useState<SmartOltOnuDiagnostics | null>(null);
  const [loadingDiag, setLoadingDiag] = useState(false);
  const [graphUrl, setGraphUrl] = useState<string | null>(null);
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [confirmReboot, setConfirmReboot] = useState(false);
  const [runningAction, setRunningAction] = useState<'reboot' | 'resync' | null>(null);
  const [copiedSn, setCopiedSn] = useState(false);

  // Busca manual inline de ONT
  const [showManualSearch, setShowManualSearch] = useState(false);
  const [manualQuery, setManualQuery] = useState('');
  const [manualSearching, setManualSearching] = useState(false);
  const [manualResults, setManualResults] = useState<SmartOltOnu[]>([]);

  const loginsKey = pppoeLogins.join('||');
  const namesKey = fullNames.join('||');
  const prevGraphRef = useRef<string | null>(null);

  useEffect(() => {
    prevGraphRef.current = graphUrl;
  }, [graphUrl]);

  useEffect(() => {
    return () => {
      if (prevGraphRef.current) {
        URL.revokeObjectURL(prevGraphRef.current);
      }
    };
  }, []);

  // Reseta estado ao trocar de cliente no chat
  useEffect(() => {
    setOnu(null);
    setMatchReason('none');
    setCandidates([]);
    setDiagnostics(null);
    setConfirmReboot(false);
    setShowManualSearch(false);
    setManualQuery('');
    setManualResults([]);
    if (prevGraphRef.current) {
      URL.revokeObjectURL(prevGraphRef.current);
      setGraphUrl(null);
    }
    onOntResolved?.(null);
  }, [clientId, onOntResolved]);

  // Busca automática da ONT no SmartOLT (prioriza ID salvo -> login PPPoE exato -> nome completo)
  useEffect(() => {
    if (!clientId) return;
    const loginsArr = loginsKey ? loginsKey.split('||').filter(Boolean) : [];
    const namesArr = namesKey ? namesKey.split('||').filter(Boolean) : [];
    if (!savedOnuId && loginsArr.length === 0 && namesArr.length === 0) {
      setOnu(null);
      setMatchReason('none');
      onOntResolved?.(null);
      return;
    }

    let cancelled = false;
    const locate = async () => {
      setLoading(true);
      try {
        const res = await smartOltService.findClientOnu({
          onuId: savedOnuId || undefined,
          pppoeLogins: loginsArr,
          fullNames: namesArr,
          live: false,
        });
        if (cancelled) return;
        setOnu(res.onu);
        setMatchReason(res.matchReason);
        setCandidates(res.candidates);
        onOntResolved?.(res.onu);
      } catch {
        if (!cancelled) {
          setOnu(null);
          setMatchReason('none');
          onOntResolved?.(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    locate();
    return () => {
      cancelled = true;
    };
  }, [clientId, savedOnuId, loginsKey, namesKey, onOntResolved]);

  const handleLoadLiveDiagnostics = useCallback(async () => {
    if (!onu) return;
    setLoadingDiag(true);
    setLiveRefreshing(true);
    try {
      const diag = await smartOltService.getOnuDiagnostics(
        onu.unique_external_id || onu.id,
        true
      );
      if (diag) {
        setDiagnostics(diag);
        setOnu(diag.onu);
        onOntResolved?.(diag.onu);
        toast.success('Leitura ao vivo da OLT atualizada!');
      } else {
        toast.error('Não foi possível consultar a OLT no momento.');
      }
    } finally {
      setLoadingDiag(false);
      setLiveRefreshing(false);
    }
  }, [onu, onOntResolved]);

  const handleToggleSignalGraph = async () => {
    if (!onu) return;
    if (graphUrl) {
      URL.revokeObjectURL(graphUrl);
      setGraphUrl(null);
      return;
    }
    setLoadingGraph(true);
    try {
      const url = await smartOltService.getOnuSignalGraphBlobUrl(
        onu.unique_external_id || onu.id,
        'daily'
      );
      if (url) {
        setGraphUrl(url);
      } else {
        toast.error('Gráfico indisponível para esta ONT.');
      }
    } finally {
      setLoadingGraph(false);
    }
  };

  const handleReboot = async () => {
    if (!onu) return;
    setRunningAction('reboot');
    setConfirmReboot(false);
    try {
      const res = await smartOltService.rebootOnu(onu.unique_external_id || onu.id);
      if (res.success) {
        toast.success('Comando de reinício enviado para a ONT!', {
          description: res.message,
          action: onSendMessage
            ? {
                label: 'Avisar cliente',
                onClick: () =>
                  onSendMessage(
                    '🔄 Acabei de reiniciar seu equipamento remotamente aqui pela central! Aguarde cerca de 2 minutinhos para a conexão normalizar.'
                  ),
              }
            : undefined,
        });
      } else {
        toast.error(res.message || 'Erro ao reiniciar ONT.');
      }
    } finally {
      setRunningAction(null);
    }
  };

  const handleResync = async () => {
    if (!onu) return;
    setRunningAction('resync');
    try {
      const res = await smartOltService.resyncOnu(onu.unique_external_id || onu.id);
      if (res.success) {
        toast.success('Configuração da ONT ressincronizada na OLT!');
      } else {
        toast.error(res.message || 'Erro ao ressincronizar ONT.');
      }
    } finally {
      setRunningAction(null);
    }
  };

  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = manualQuery.trim();
    if (q.length < 2) return;
    setManualSearching(true);
    try {
      const res = await smartOltService.searchOnus(q, 15);
      setManualResults(res);
      if (res.length === 0) {
        toast.info('Nenhuma ONT encontrada com esse termo.');
      }
    } finally {
      setManualSearching(false);
    }
  };

  const handleSelectOnu = async (selected: SmartOltOnu) => {
    setOnu(selected);
    setMatchReason('linked_id');
    setDiagnostics(null);
    setShowManualSearch(false);
    setManualResults([]);
    setManualQuery('');
    if (graphUrl) {
      URL.revokeObjectURL(graphUrl);
      setGraphUrl(null);
    }
    onOntResolved?.(selected);

    if (clientId) {
      await setDoc(
        doc(db, 'chat', clientId),
        {
          smartolt_onu_id: selected.unique_external_id || selected.id,
          smartolt_sn: selected.sn || '',
        },
        { merge: true }
      ).catch(() => undefined);
    }
    toast.success(`ONT ${selected.name || selected.sn} vinculada ao chat!`);
  };

  const handleCopySn = () => {
    if (!onu?.sn) return;
    navigator.clipboard.writeText(onu.sn).catch(() => undefined);
    setCopiedSn(true);
    toast.success('SN copiado!');
    setTimeout(() => setCopiedSn(false), 1800);
  };

  const meta = onu ? getOntStatusMeta(onu.status) : null;
  const rxVal = onu ? getEffectiveRx(onu) : null;
  const sigStyle = getSignalColor(rxVal);
  const sigPercent =
    rxVal !== null ? Math.max(6, Math.min(100, ((rxVal + 34) / 18) * 100)) : 0;

  return (
    <Card className="bg-card shadow-sm border-border overflow-hidden">
      <CardHeader className="p-3 border-b border-border/60 bg-muted/30 flex flex-row items-center justify-between space-y-0 gap-1">
        <CardTitle className="text-[11px] font-bold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider truncate">
          <Radio className="w-3.5 h-3.5 text-primary shrink-0" />
          Fibra / ONT (SmartOLT)
        </CardTitle>
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => setShowManualSearch((prev) => !prev)}
            title={onu ? 'Trocar ONT vinculada' : 'Buscar e vincular ONT manualmente'}
          >
            {showManualSearch ? <X className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
          </Button>
          {onu && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground hover:text-primary"
              disabled={liveRefreshing}
              onClick={handleLoadLiveDiagnostics}
              title="Ler status e sinal ao vivo direto na OLT"
            >
              <RefreshCw className={`w-3 h-3 ${liveRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-3 space-y-2.5">
        {/* Busca manual inline de ONT */}
        {showManualSearch && (
          <div className="p-2 rounded-xl bg-secondary/50 border border-border/80 space-y-2">
            <form onSubmit={handleManualSearch} className="flex gap-1.5">
              <Input
                value={manualQuery}
                onChange={(e) => setManualQuery(e.target.value)}
                placeholder="Login PPPoE, SN ou nome na OLT..."
                className="h-7 text-xs bg-background"
                autoFocus
              />
              <Button
                type="submit"
                size="sm"
                disabled={manualSearching || manualQuery.trim().length < 2}
                className="h-7 px-2.5 text-[10px] shrink-0"
              >
                {manualSearching ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Search className="w-3 h-3" />
                )}
              </Button>
            </form>

            {manualResults.length > 0 && (
              <div className="space-y-1 max-h-44 overflow-y-auto">
                {manualResults.map((cand) => {
                  const cm = getOntStatusMeta(cand.status);
                  return (
                    <button
                      key={cand.id}
                      type="button"
                      onClick={() => handleSelectOnu(cand)}
                      className="w-full text-left p-2 rounded-lg bg-card hover:bg-primary/10 border border-border/60 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <p className="text-[11px] font-bold text-foreground truncate">
                          {cand.name || cand.sn}
                        </p>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${cm.badgeClass}`}
                        >
                          {cm.shortLabel}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">
                        {cand.olt_name} • {cand.board}/{cand.pon_port}:{cand.onu_id} • {cand.sn}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="py-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            Consultando ONT na OLT...
          </div>
        ) : onu && meta ? (
          <>
            {/* Banner de Status da ONT */}
            <div className={`p-2.5 rounded-xl border ${meta.borderClass} ${meta.bgClass} space-y-1.5`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.dotClass}`} />
                  <span className="text-xs font-extrabold text-foreground truncate">
                    {meta.label}
                  </span>
                </div>
                {onu.status === 'power_fail' ? (
                  <PowerOff className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                ) : onu.status === 'los' ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                ) : onu.status === 'online' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                )}
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug">{meta.hint}</p>
              {onu.last_status_change && (
                <p className="text-[9px] text-muted-foreground/80 font-mono">
                  Última mudança: {formatStatusTimestamp(onu.last_status_change)}
                </p>
              )}
            </div>

            {/* Sinal Óptico + Localização OLT/PON */}
            <div className="p-2.5 rounded-xl bg-muted/35 border border-border/70 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Signal className={`w-3.5 h-3.5 ${sigStyle.text}`} />
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">
                    Sinal Óptico
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-sm font-black font-mono ${sigStyle.text}`}>
                    {rxVal !== null ? `${rxVal.toFixed(2)} dBm` : '--'}
                  </span>
                  <span className={`text-[9px] font-bold ${sigStyle.text}`}>
                    ({sigStyle.label})
                  </span>
                </div>
              </div>

              {rxVal !== null && (
                <div className="h-1.5 w-full rounded-full bg-background overflow-hidden border border-border/50">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${sigStyle.bar}`}
                    style={{ width: `${sigPercent}%` }}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-1.5 text-[10px] pt-0.5">
                <div className="bg-background/70 px-2 py-1 rounded border border-border/50">
                  <span className="text-[9px] text-muted-foreground block">OLT / PON</span>
                  <span className="font-semibold text-foreground truncate block" title={onu.olt_name}>
                    {onu.olt_name || `OLT #${onu.olt_id}`}
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground">
                    Slot {onu.board} / Porta {onu.pon_port} • #{onu.onu_id}
                  </span>
                </div>
                <div className="bg-background/70 px-2 py-1 rounded border border-border/50">
                  <span className="text-[9px] text-muted-foreground block">Serial (SN)</span>
                  <button
                    type="button"
                    onClick={handleCopySn}
                    className="flex items-center gap-1 font-mono text-[10px] font-semibold text-foreground hover:text-primary transition-colors w-full text-left truncate"
                    title="Copiar Serial Number"
                  >
                    <span className="truncate">{onu.sn || onu.id}</span>
                    {copiedSn ? (
                      <Check className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                    ) : (
                      <Copy className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                    )}
                  </button>
                  <span className="font-mono text-[9px] text-muted-foreground truncate block">
                    1310: {onu.signal_1310 || '-'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] text-muted-foreground truncate">
                  <span className="font-semibold text-foreground/80">Cadastro OLT:</span>{' '}
                  {onu.name || '—'}
                </p>
                {(() => {
                  const badge = getMatchReasonLabel(matchReason);
                  if (!badge) return null;
                  return (
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* Alternar se mais de 1 ONT bateu com o cliente */}
            {candidates.length > 1 && (
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[9px] font-bold text-muted-foreground uppercase mr-0.5">
                  ONTs:
                </span>
                {candidates.slice(0, 3).map((cand) => {
                  const active = cand.id === onu.id;
                  return (
                    <button
                      key={cand.id}
                      type="button"
                      onClick={() => handleSelectOnu(cand)}
                      className={`text-[9px] px-1.5 py-0.5 rounded-md border font-mono transition-colors ${
                        active
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/50 text-muted-foreground border-border hover:text-foreground'
                      }`}
                    >
                      {cand.sn.slice(-6) || cand.name.slice(0, 10)}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Diagnóstico 7 Dias + Perfis (carregado ao clicar em "Ao Vivo / 7d") */}
            {diagnostics && (
              <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5 text-[10px]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-primary uppercase tracking-tight flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    Histórico 7 dias &amp; Detalhes
                  </span>
                  {diagnostics.history_7d && (
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-mono">
                      {diagnostics.history_7d.online_percent.toFixed(1)}% ON
                    </Badge>
                  )}
                </div>

                {diagnostics.history_7d && (
                  <div className="grid grid-cols-3 gap-1 text-center">
                    <div className="bg-background/80 rounded p-1 border border-border/50">
                      <span className="block text-[9px] text-muted-foreground">Quedas</span>
                      <strong className="text-xs font-mono">
                        {diagnostics.history_7d.interruptions}
                      </strong>
                    </div>
                    <div className="bg-background/80 rounded p-1 border border-border/50">
                      <span className="block text-[9px] text-rose-500">LOS</span>
                      <strong className="text-xs font-mono">
                        {formatDurationShort(diagnostics.history_7d.seconds.los)}
                      </strong>
                    </div>
                    <div className="bg-background/80 rounded p-1 border border-border/50">
                      <span className="block text-[9px] text-amber-500">Energia</span>
                      <strong className="text-xs font-mono">
                        {formatDurationShort(diagnostics.history_7d.seconds.power_fail)}
                      </strong>
                    </div>
                  </div>
                )}

                <div className="text-[10px] text-muted-foreground space-y-0.5">
                  {diagnostics.details?.onu_type_name && (
                    <p className="truncate">
                      Modelo: <strong className="text-foreground">{diagnostics.details.onu_type_name}</strong>
                      {diagnostics.details.mode ? ` (${diagnostics.details.mode})` : ''}
                    </p>
                  )}
                  {(diagnostics.details?.odb_name || diagnostics.details?.zone_name) && (
                    <p className="truncate">
                      CTO/Zona:{' '}
                      <strong className="text-foreground">
                        {[diagnostics.details.odb_name, diagnostics.details.zone_name]
                          .filter(Boolean)
                          .join(' • ')}
                      </strong>
                    </p>
                  )}
                  {diagnostics.speed_profiles &&
                    (diagnostics.speed_profiles.download || diagnostics.speed_profiles.upload) && (
                      <p className="truncate">
                        Perfil OLT:{' '}
                        <strong className="text-foreground font-mono">
                          ↓ {diagnostics.speed_profiles.download} / ↑ {diagnostics.speed_profiles.upload}
                        </strong>
                      </p>
                    )}
                </div>
              </div>
            )}

            {/* Gráfico de sinal PNG oficial SmartOLT */}
            {graphUrl && (
              <div className="rounded-xl overflow-hidden border border-border bg-white p-1">
                <img
                  src={graphUrl}
                  alt="Gráfico de sinal óptico 24h"
                  className="w-full h-auto rounded-lg"
                />
              </div>
            )}

            {/* Confirmação inline de Reboot */}
            {confirmReboot ? (
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-2">
                <p className="text-[10px] font-semibold text-rose-700 dark:text-rose-300">
                  Reiniciar a ONT agora? A internet do cliente ficará fora por ~2 minutos.
                </p>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1 h-7 text-[10px] font-bold"
                    disabled={runningAction !== null}
                    onClick={handleReboot}
                  >
                    {runningAction === 'reboot' ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <Zap className="w-3 h-3 mr-1" />
                    )}
                    Confirmar Reboot
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px]"
                    onClick={() => setConfirmReboot(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              /* Ações Rápidas 1-Clique */
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] font-bold gap-1"
                    disabled={loadingDiag}
                    onClick={handleLoadLiveDiagnostics}
                    title="Consultar status ao vivo + histórico 7 dias + perfil na OLT"
                  >
                    {loadingDiag ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Activity className="w-3 h-3 text-primary" />
                    )}
                    Ao Vivo / 7d
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] font-bold gap-1"
                    disabled={loadingGraph}
                    onClick={handleToggleSignalGraph}
                    title="Exibir gráfico oficial de sinal óptico das últimas 24h"
                  >
                    {loadingGraph ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <TrendingUp className="w-3 h-3 text-sky-500" />
                    )}
                    {graphUrl ? 'Ocultar Gráfico' : 'Gráfico 24h'}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] font-bold gap-1 hover:border-rose-500/40 hover:text-rose-600 dark:hover:text-rose-400"
                    disabled={runningAction !== null}
                    onClick={() => setConfirmReboot(true)}
                  >
                    <Zap className="w-3 h-3" />
                    Reiniciar ONT
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] font-bold gap-1"
                    disabled={runningAction !== null}
                    onClick={handleResync}
                    title="Ressincronizar configuração da ONT na OLT"
                  >
                    {runningAction === 'resync' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3 h-3" />
                    )}
                    Resync OLT
                  </Button>
                </div>

                {onSendMessage && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full h-7 text-[10px] font-bold gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
                    onClick={() => onSendMessage(buildDiagnosticWhatsAppMessage(onu))}
                    title="Envia uma orientação pronta no WhatsApp baseada no status real da ONT"
                  >
                    <Send className="w-3 h-3" />
                    Enviar Diagnóstico no Chat
                  </Button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="py-2 text-center space-y-2">
            <p className="text-[11px] text-muted-foreground">
              ONT não identificada automaticamente na OLT para este cliente.
            </p>
            {!showManualSearch && (
              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 text-[10px] gap-1.5"
                onClick={() => setShowManualSearch(true)}
              >
                <Search className="w-3 h-3" />
                Buscar ONT por Login / SN
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

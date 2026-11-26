import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  Activity,
  AlertTriangle,
  Bell,
  BellOff,
  CheckCheck,
  CheckCircle2,
  Copy,
  Eye,
  Loader2,
  MapPin,
  MessageSquare,
  Phone,
  QrCode,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldAlert,
  Trash2,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/config/firebase';
import { whapiService } from '@/services/whapi/whapiService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNetworkMonitor } from '@/contexts/NetworkMonitorContext';
import { useQuickClientDrawer } from '@/contexts/QuickClientDrawerContext';
import { abrirConversaWhatsApp } from '@/lib/utils';
import { formatarHorarioCurto } from '@/utils/date';

interface ZapiHealthDoc {
  connected?: boolean;
  smartphoneConnected?: boolean;
  error?: string | null;
  checkedAtMs?: number;
  source?: string;
}

const ZAPI_STATUS_WEBHOOK_URL =
  'https://us-central1-avl-telecom.cloudfunctions.net/zapiStatusWebhook';

/**
 * Pílula unificada e silenciosa de Status do Sistema (Rede ISPFY + WhatsApp Z-API).
 * Fica discreta ("Sistema OK") quando está tudo saudável e só destaca alertas quando há incidente.
 */
const SystemHealthPillComponent: React.FC = () => {
  const navegar = useNavigate();
  const { openClientDrawer } = useQuickClientDrawer();
  const [aberto, setAberto] = useState(false);
  const [activeTab, setActiveTab] = useState<'network' | 'whatsapp'>('network');

  // Estado Z-API
  const [zapiHealth, setZapiHealth] = useState<ZapiHealthDoc | null>(null);
  const [checkingZapi, setCheckingZapi] = useState(false);
  const [loadingQr, setLoadingQr] = useState(false);
  const [restartingZapi, setRestartingZapi] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const hasAutoCheckedZapiRef = useRef(false);

  const {
    dadosRegiao,
    carregandoRegiao,
    verificandoAgora,
    ultimaAtualizacaoEm,
    eventosRecentes,
    quedasNaoLidas,
    somAtivo,
    sireneAtiva,
    sireneSilenciada,
    monitorAtivo,
    intervaloVerificacaoSeg,
    permissaoNotificacao,
    solicitarPermissaoNotificacao,
    atualizarConexoes,
    confirmarAlertas,
    limparEventos,
    alternarSom,
    alternarMonitor,
    tocarSireneRompimento,
    pararSirene,
    rompimentosEmMassa,
    rompimentosConfirmados,
    outagesMonitorados,
    ativarAlertaRompimentoRegiao,
    enviarAlertaRompimentoGrupo,
  } = useNetworkMonitor();

  const handleRefreshZapi = useCallback(async (silent = false) => {
    setCheckingZapi(true);
    try {
      const res = await whapiService.getInstanceStatus();
      setZapiHealth({
        connected: res.connected,
        smartphoneConnected: res.smartphoneConnected,
        error: res.error || null,
        checkedAtMs: Date.now(),
      });
      if (!silent) {
        if (res.connected) {
          toast.success('WhatsApp Z-API conectado e operando normalmente!');
        } else {
          toast.warning('Instância WhatsApp desconectada. Gere o QR Code para reconectar.');
        }
      }
    } catch (err) {
      if (!silent) {
        toast.error(err instanceof Error ? err.message : 'Erro ao verificar Z-API');
      }
    } finally {
      setCheckingZapi(false);
    }
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', 'zapi_health'),
      (snap) => {
        const data = snap.exists() ? (snap.data() as ZapiHealthDoc) : null;
        if (data) setZapiHealth(data);
        if (!hasAutoCheckedZapiRef.current) {
          hasAutoCheckedZapiRef.current = true;
          const isStale = !data?.checkedAtMs || Date.now() - data.checkedAtMs > 10 * 60 * 1000;
          if (isStale) {
            void handleRefreshZapi(true);
          }
        }
      },
      () => undefined
    );
    return () => unsub();
  }, [handleRefreshZapi]);

  const handleFetchQr = async () => {
    setLoadingQr(true);
    setQrCode(null);
    try {
      const res = await whapiService.getQrCode();
      if (res.connected) {
        toast.success('WhatsApp já está conectado!');
        await handleRefreshZapi(true);
        return;
      }
      if (res.qrCodeBase64) {
        const src = res.qrCodeBase64.startsWith('data:')
          ? res.qrCodeBase64
          : `data:image/png;base64,${res.qrCodeBase64}`;
        setQrCode(src);
      } else {
        toast.warning('A Z-API não retornou imagem do QR Code. Tente reiniciar a instância.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar QR Code.');
    } finally {
      setLoadingQr(false);
    }
  };

  const handleRestartZapi = async () => {
    setRestartingZapi(true);
    try {
      const ok = await whapiService.restartInstance();
      if (ok) {
        toast.success('Comando de reinício enviado para a Z-API! Aguarde ~10s.');
        window.setTimeout(() => {
          void handleRefreshZapi(true);
        }, 8000);
      } else {
        toast.error('Falha ao reiniciar instância Z-API.');
      }
    } finally {
      setRestartingZapi(false);
    }
  };

  const totais = dadosRegiao?.totals;
  const qtdOk = totais?.internetOk ?? 0;
  const qtdDesconectados = totais?.desconectados ?? 0;
  const qtdBloqueados = totais?.bloqueados ?? 0;

  const isZapiUnknown = zapiHealth === null;
  const isZapiConnected = zapiHealth?.connected === true;
  const isZapiOffline = !isZapiUnknown && !isZapiConnected;
  const hasOutages = rompimentosEmMassa.length > 0;
  const hasCriticalAlert = isZapiOffline || hasOutages || quedasNaoLidas > 0;

  const aoAlternarAbertura = (proximoEstado: boolean) => {
    setAberto(proximoEstado);
    if (proximoEstado) {
      if (isZapiOffline && !hasOutages && quedasNaoLidas === 0) {
        setActiveTab('whatsapp');
      } else {
        setActiveTab('network');
      }
      if (quedasNaoLidas > 0) {
        confirmarAlertas();
      }
    }
  };

  const navegarEFechar = (rota: string) => {
    setAberto(false);
    navegar(rota);
  };

  const atalhosPlacar = [
    {
      rota: '/ispfy/regiao?status=OK',
      valor: qtdOk,
      rotulo: 'Internet OK',
      classeCaixa: 'bg-emerald-500/12 hover:bg-emerald-500/20 border-emerald-500/25',
      classeNumero: 'text-emerald-600 dark:text-emerald-300',
      classeTexto: 'text-emerald-700/80 dark:text-emerald-200/80',
    },
    {
      rota: '/ispfy/regiao?status=DESCONECTADO',
      valor: qtdDesconectados,
      rotulo: 'Sem Internet',
      classeCaixa: 'bg-rose-500/12 hover:bg-rose-500/20 border-rose-500/25',
      classeNumero: 'text-rose-600 dark:text-rose-300',
      classeTexto: 'text-rose-700/80 dark:text-rose-200/80',
    },
    {
      rota: '/ispfy/regiao?status=BLOQUEADO',
      valor: qtdBloqueados,
      rotulo: 'Bloqueados',
      classeCaixa: 'bg-amber-500/12 hover:bg-amber-500/20 border-amber-500/25',
      classeNumero: 'text-amber-600 dark:text-amber-300',
      classeTexto: 'text-amber-700/80 dark:text-amber-200/80',
    },
  ];

  return (
    <div className="flex items-center gap-1.5">
      {hasOutages && (sireneAtiva || (somAtivo && !sireneSilenciada)) && (
        <Button
          type="button"
          size="sm"
          variant="destructive"
          onClick={() => pararSirene(true)}
          className="h-9 rounded-full px-3 text-xs font-bold shadow-lg animate-pulse gap-1.5"
          title="Silenciar sirene de rompimento"
        >
          <VolumeX className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Parar Sirene</span>
        </Button>
      )}

      <Popover open={aberto} onOpenChange={aoAlternarAbertura}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`relative h-9 px-2.5 sm:px-3 rounded-xl gap-2 text-xs font-medium transition-all ${
              hasCriticalAlert
                ? 'border-rose-500/60 bg-rose-500/12 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 ring-1 ring-rose-500/25'
                : 'border-border/70 bg-background/70 hover:bg-secondary/80 text-foreground'
            }`}
            title="Central de Saúde do Sistema (Rede ISPFY + WhatsApp Z-API)"
          >
            <span className="relative flex h-2 w-2 shrink-0">
              {hasCriticalAlert && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  hasCriticalAlert
                    ? 'bg-rose-500'
                    : carregandoRegiao && !totais
                    ? 'bg-blue-500'
                    : 'bg-emerald-500'
                }`}
              />
            </span>

            {isZapiOffline ? (
              <span className="font-semibold flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>WhatsApp OFF</span>
              </span>
            ) : hasOutages ? (
              <span className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>
                  {rompimentosEmMassa.length}{' '}
                  <span className="hidden sm:inline">Romp.</span>
                </span>
              </span>
            ) : quedasNaoLidas > 0 ? (
              <span className="font-semibold flex items-center gap-1.5 tabular-nums">
                <WifiOff className="w-3.5 h-3.5" />
                <span>+{quedasNaoLidas}</span>
                <span className="hidden md:inline">queda(s)</span>
              </span>
            ) : carregandoRegiao && !totais ? (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span className="hidden md:inline">Sincronizando...</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="hidden lg:inline font-semibold text-foreground/90">
                  Sistema OK
                </span>
                {qtdDesconectados > 0 ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                    <WifiOff className="w-3 h-3" />
                    {qtdDesconectados}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                    <Wifi className="w-3 h-3" />
                    {qtdOk}
                  </span>
                )}
                {verificandoAgora && (
                  <RefreshCw className="w-3 h-3 animate-spin text-muted-foreground" />
                )}
              </span>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          className="w-[360px] sm:w-[420px] p-0 overflow-hidden rounded-2xl shadow-2xl border-border/80 bg-card"
        >
          {/* Seletor de Abas: Rede & Alertas | WhatsApp Z-API */}
          <div className="p-2 bg-muted/40 border-b border-border/60">
            <div className="grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-secondary/70 border border-border/60">
              <button
                type="button"
                onClick={() => setActiveTab('network')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'network'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Activity className="w-3.5 h-3.5 text-primary" />
                <span>Rede ISPFY</span>
                {qtdDesconectados > 0 && (
                  <span className="px-1.5 py-0 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-300 tabular-nums">
                    {qtdDesconectados}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('whatsapp')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'whatsapp'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isZapiUnknown
                      ? 'bg-slate-400'
                      : isZapiConnected
                      ? 'bg-emerald-500'
                      : 'bg-rose-500 animate-pulse'
                  }`}
                />
                <span>WhatsApp Z-API</span>
              </button>
            </div>
          </div>

          {activeTab === 'network' ? (
            <>
              {/* Cabeçalho Rede */}
              <div className="p-3.5 border-b border-border/60 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-foreground">
                      Monitor Global em Tempo Real
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      {monitorAtivo
                        ? `Ativo a cada ${intervaloVerificacaoSeg}s`
                        : 'Monitoramento pausado'}
                      {ultimaAtualizacaoEm
                        ? ` • ${ultimaAtualizacaoEm.toLocaleTimeString('pt-BR')}`
                        : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg"
                      onClick={alternarSom}
                      title={somAtivo ? 'Silenciar alertas sonoros' : 'Ativar alertas sonoros'}
                    >
                      {somAtivo ? (
                        <Volume2 className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <VolumeX className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg"
                      onClick={alternarMonitor}
                      title={monitorAtivo ? 'Pausar monitor automático' : 'Retomar monitor'}
                    >
                      {monitorAtivo ? (
                        <Bell className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <BellOff className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg"
                      onClick={() => atualizarConexoes(true)}
                      disabled={verificandoAgora || carregandoRegiao}
                      title="Verificar agora no ISPFY"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${
                          verificandoAgora || carregandoRegiao ? 'animate-spin text-primary' : ''
                        }`}
                      />
                    </Button>
                  </div>
                </div>

                {/* Mini placar clicável */}
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  {atalhosPlacar.map((item) => (
                    <button
                      key={item.rota}
                      type="button"
                      onClick={() => navegarEFechar(item.rota)}
                      className={`rounded-xl border py-1.5 px-2 transition-colors ${item.classeCaixa}`}
                    >
                      <span
                        className={`block text-sm font-extrabold tabular-nums ${item.classeNumero}`}
                      >
                        {item.valor}
                      </span>
                      <span className={`block text-[10px] font-medium ${item.classeTexto}`}>
                        {item.rotulo}
                      </span>
                    </button>
                  ))}
                </div>

                {permissaoNotificacao === 'default' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={solicitarPermissaoNotificacao}
                    className="w-full h-7 text-[11px] bg-primary text-primary-foreground hover:bg-primary/90 border-0 rounded-xl"
                  >
                    <Bell className="w-3 h-3 mr-1.5" />
                    Permitir alertas do navegador em segundo plano
                  </Button>
                )}
              </div>

              {/* Banner de Rompimentos em Massa */}
              {hasOutages && (
                <div className="bg-amber-500/10 border-b border-amber-500/25 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                      Possível Rompimento ({rompimentosEmMassa.length})
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] px-2 border-amber-500/40"
                        onClick={() => tocarSireneRompimento(2)}
                      >
                        <Volume2 className="w-3 h-3 mr-1" />
                        Sirene
                      </Button>
                      {(sireneAtiva || (somAtivo && !sireneSilenciada)) && (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-6 text-[10px] px-2 font-bold"
                          onClick={() => pararSirene(true)}
                        >
                          <VolumeX className="w-3 h-3 mr-1" />
                          Parar
                        </Button>
                      )}
                    </div>
                  </div>
                  {rompimentosEmMassa.slice(0, 3).map((alerta) => {
                    const jaAtivoNoBot = rompimentosConfirmados.some((c) =>
                      c.bairros.some(
                        (b) => b.toLowerCase() === alerta.bairroLabel.toLowerCase()
                      )
                    );
                    const watch = outagesMonitorados.find(
                      (w) => w.incidentKey === alerta.incidentKey
                    );
                    const rp = alerta.ruaPrincipal;
                    return (
                      <div
                        key={alerta.incidentKey}
                        className="rounded-xl bg-background/85 border border-amber-500/30 p-2 text-[11px] space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-foreground truncate">
                            {alerta.tipoAlerta === 'rua_e_bairro' && rp
                              ? `${rp.ruaLabel} — ${alerta.bairroLabel}`
                              : alerta.bairroLabel}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] border-rose-500/40 text-rose-600 dark:text-rose-300 shrink-0"
                          >
                            {alerta.tipoAlerta === 'rua_e_bairro' && rp
                              ? `Rua ${rp.desconectados}/${rp.totalAtivos}`
                              : `${alerta.desconectados}/${alerta.totalAtivosNoBairro} off`}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                          <span>{alerta.percentualOffline}% offline no bairro</span>
                          <span>
                            {watch?.whatsappSentAtMs
                              ? `Avisado ${formatarHorarioCurto(
                                  new Date(watch.whatsappSentAtMs).toISOString()
                                )}`
                              : 'Monitorando (>5m avisa grupo)'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant={jaAtivoNoBot ? 'secondary' : 'outline'}
                            className="h-6 text-[10px] px-2 flex-1"
                            disabled={jaAtivoNoBot}
                            onClick={() => ativarAlertaRompimentoRegiao(alerta)}
                          >
                            <ShieldAlert className="w-3 h-3 mr-1" />
                            {jaAtivoNoBot ? 'Bot Avisando' : 'Avisar no Bot/IA'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] px-2 flex-1"
                            onClick={() => enviarAlertaRompimentoGrupo(alerta)}
                          >
                            <Send className="w-3 h-3 mr-1" />
                            EQUIPE AVL
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Feed de eventos */}
              <div className="max-h-64 overflow-y-auto divide-y divide-border/60">
                {eventosRecentes.length === 0 ? (
                  <div className="p-5 text-center space-y-1">
                    <p className="text-xs font-medium text-foreground">
                      Nenhuma queda nova registrada nesta sessão.
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Você será avisado instantaneamente caso algum cliente desconecte.
                    </p>
                  </div>
                ) : (
                  eventosRecentes.slice(0, 15).map((evento) => {
                    const ficouOffline = evento.type === 'dropped';
                    return (
                      <div
                        key={evento.id}
                        className={`p-2.5 px-3.5 flex items-center justify-between gap-2 text-xs hover:bg-secondary/40 transition-colors ${
                          ficouOffline ? 'bg-rose-500/[0.03]' : 'bg-emerald-500/[0.03]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (!evento.clienteId) return;
                            setAberto(false);
                            openClientDrawer({
                              clienteId: evento.clienteId,
                              nome: evento.nome,
                              telefone: evento.telefone,
                              bairro: evento.bairroLabel,
                              enderecoCompleto: evento.enderecoCompleto,
                              connectionHealth: ficouOffline ? 'desconectado' : 'ok',
                            });
                          }}
                          className="min-w-0 flex-1 text-left space-y-0.5"
                        >
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                ficouOffline ? 'bg-rose-500' : 'bg-emerald-500'
                              }`}
                            />
                            <span className="font-semibold text-foreground truncate">
                              {evento.nome}
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground ml-auto shrink-0">
                              {formatarHorarioCurto(evento.occurredAt)}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1 pl-3">
                            <MapPin className="w-3 h-3 shrink-0" />
                            {evento.bairroLabel} • {evento.enderecoCompleto}
                          </p>
                        </button>

                        <div className="flex items-center gap-0.5 shrink-0">
                          {evento.telefone && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-emerald-600"
                              onClick={() => abrirConversaWhatsApp(evento.telefone)}
                              title="Abrir WhatsApp"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {evento.clienteId && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-primary"
                              onClick={() => {
                                setAberto(false);
                                openClientDrawer({
                                  clienteId: evento.clienteId,
                                  nome: evento.nome,
                                  telefone: evento.telefone,
                                  bairro: evento.bairroLabel,
                                  enderecoCompleto: evento.enderecoCompleto,
                                  connectionHealth: ficouOffline ? 'desconectado' : 'ok',
                                });
                              }}
                              title="Abrir Gaveta 360° do cliente"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Rodapé Rede */}
              <div className="p-2.5 bg-muted/30 border-t border-border/60 flex items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => navegarEFechar('/ispfy/regiao?status=DESCONECTADO')}
                >
                  Ver sem internet ({qtdDesconectados})
                </Button>
                <div className="flex items-center gap-1">
                  {eventosRecentes.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[11px] text-muted-foreground"
                      onClick={limparEventos}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Limpar
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] rounded-lg"
                    onClick={() => {
                      confirmarAlertas();
                      navegarEFechar('/');
                    }}
                  >
                    <CheckCheck className="w-3 h-3 mr-1" />
                    Dashboard
                  </Button>
                </div>
              </div>
            </>
          ) : (
            /* Aba WhatsApp Z-API */
            <div className="p-3.5 space-y-3.5">
              <div
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                  isZapiConnected
                    ? 'border-emerald-500/30 bg-emerald-500/10'
                    : 'border-rose-500/30 bg-rose-500/10'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {isZapiConnected ? (
                    <Wifi className="w-5 h-5 text-emerald-500 shrink-0" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-rose-500 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground">
                      {isZapiConnected ? 'Instância Conectada' : 'Instância Desconectada'}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {zapiHealth?.checkedAtMs
                        ? `Lido às ${new Date(zapiHealth.checkedAtMs).toLocaleTimeString('pt-BR')}`
                        : 'Sem leitura recente'}
                      {zapiHealth?.error ? ` • ${zapiHealth.error}` : ''}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={isZapiConnected ? 'default' : 'destructive'}
                  className="text-[10px] shrink-0"
                >
                  {isZapiConnected ? 'ONLINE' : 'OFFLINE'}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs rounded-xl h-8"
                  disabled={checkingZapi}
                  onClick={() => handleRefreshZapi(false)}
                >
                  {checkingZapi ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  Status
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs rounded-xl h-8"
                  disabled={loadingQr}
                  onClick={handleFetchQr}
                >
                  {loadingQr ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <QrCode className="w-3.5 h-3.5" />
                  )}
                  QR Code
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs rounded-xl h-8"
                  disabled={restartingZapi}
                  onClick={handleRestartZapi}
                >
                  {restartingZapi ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5" />
                  )}
                  Reiniciar
                </Button>
              </div>

              {qrCode && (
                <div className="p-3 rounded-xl border bg-white flex flex-col items-center gap-2">
                  <img
                    src={qrCode}
                    alt="QR Code WhatsApp Z-API"
                    className="w-48 h-48 object-contain"
                  />
                  <p className="text-[11px] text-slate-600 text-center">
                    Escaneie no WhatsApp → Aparelhos conectados
                  </p>
                </div>
              )}

              <div className="p-2.5 rounded-xl bg-secondary/45 border border-border/60 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                    Webhook Status (Ticks Azuis)
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px] gap-1"
                    onClick={() => {
                      navigator.clipboard?.writeText(ZAPI_STATUS_WEBHOOK_URL);
                      toast.success('URL do webhook copiada!');
                    }}
                  >
                    <Copy className="w-3 h-3" />
                    Copiar
                  </Button>
                </div>
                <p className="text-[10px] font-mono text-muted-foreground break-all">
                  {ZAPI_STATUS_WEBHOOK_URL}
                </p>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
};

export const SystemHealthPill = React.memo(SystemHealthPillComponent);

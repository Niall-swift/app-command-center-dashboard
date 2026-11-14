import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Bell,
  BellOff,
  CheckCheck,
  ExternalLink,
  MapPin,
  Phone,
  RefreshCw,
  Send,
  ShieldAlert,
  Trash2,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useNetworkMonitor } from '@/contexts/NetworkMonitorContext';
import { abrirConversaWhatsApp } from '@/lib/utils';
import { formatarHorarioCurto } from '@/utils/date';

/** Indicador global de status da rede e alertas em tempo real no cabeçalho. */
export const GlobalNetworkAlertPill: React.FC = () => {
  const navegar = useNavigate();
  const [aberto, setAberto] = useState(false);

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

  const totais = dadosRegiao?.totals;
  const qtdOk = totais?.internetOk ?? 0;
  const qtdDesconectados = totais?.desconectados ?? 0;
  const qtdBloqueados = totais?.bloqueados ?? 0;

  const aoAlternarAbertura = (proximoEstado: boolean) => {
    setAberto(proximoEstado);
    if (proximoEstado && quedasNaoLidas > 0) {
      confirmarAlertas();
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
      classeCaixa:
        'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30',
      classeNumero: 'text-emerald-300',
      classeTexto: 'text-emerald-200/80',
    },
    {
      rota: '/ispfy/regiao?status=DESCONECTADO',
      valor: qtdDesconectados,
      rotulo: 'Sem Internet',
      classeCaixa: 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/30',
      classeNumero: 'text-rose-300',
      classeTexto: 'text-rose-200/80',
    },
    {
      rota: '/ispfy/regiao?status=BLOQUEADO',
      valor: qtdBloqueados,
      rotulo: 'Bloqueados',
      classeCaixa:
        'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/30',
      classeNumero: 'text-amber-300',
      classeTexto: 'text-amber-200/80',
    },
  ];

  return (
    <div className="flex items-center gap-1.5">
      {rompimentosEmMassa.length > 0 && (sireneAtiva || (somAtivo && !sireneSilenciada)) && (
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
          className={`relative h-9 px-2.5 sm:px-3 rounded-xl gap-2 text-xs font-semibold transition-all shadow-sm ${
            quedasNaoLidas > 0
              ? 'border-rose-500/70 bg-rose-500/15 text-rose-600 dark:text-rose-300 hover:bg-rose-500/20 ring-2 ring-rose-500/30 animate-pulse'
              : qtdDesconectados > 0
              ? 'border-border/80 bg-background hover:bg-secondary text-foreground'
              : 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          }`}
          title="Monitor Global de Clientes Sem Internet (Tempo Real)"
        >
          {carregandoRegiao && !totais ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
              <span className="hidden md:inline text-muted-foreground">
                Sincronizando rede...
              </span>
            </>
          ) : (
            <>
              <span className="relative flex items-center">
                {monitorAtivo ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-slate-400 mr-1.5" />
                )}
                <Wifi className="w-3.5 h-3.5 text-emerald-500 hidden sm:inline" />
                <span className="hidden sm:inline ml-1 text-emerald-700 dark:text-emerald-300 font-bold tabular-nums">
                  {qtdOk}
                </span>
              </span>

              <span className="hidden sm:inline text-border">|</span>

              <span
                className={`flex items-center gap-1 tabular-nums ${
                  qtdDesconectados > 0
                    ? 'text-rose-600 dark:text-rose-400 font-bold'
                    : 'text-muted-foreground'
                }`}
              >
                <WifiOff className="w-3.5 h-3.5" />
                <span>{qtdDesconectados}</span>
                <span className="hidden lg:inline">sem int.</span>
              </span>

              {verificandoAgora && (
                <RefreshCw className="w-3 h-3 animate-spin text-muted-foreground ml-0.5" />
              )}

              {quedasNaoLidas > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-extrabold shadow">
                  +{quedasNaoLidas}
                </span>
              )}

              {rompimentosEmMassa.length > 0 && (
                <span
                  className="ml-0.5 inline-flex items-center gap-0.5 px-1.5 h-[18px] rounded-full bg-amber-500 text-slate-950 text-[10px] font-black shadow"
                  title={`${rompimentosEmMassa.length} bairro(s) com possível rompimento`}
                >
                  <AlertTriangle className="w-2.5 h-2.5" />
                  {rompimentosEmMassa.length}
                </span>
              )}
            </>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[360px] sm:w-[410px] p-0 overflow-hidden shadow-2xl border-border"
      >
        {/* Cabeçalho do Monitor Global */}
        <div className="p-3.5 bg-slate-950 text-white border-b border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold tracking-tight">
                  Monitor Global em Tempo Real
                </h4>
                <p className="text-[11px] text-slate-400">
                  {monitorAtivo
                    ? `Ativo a cada ${intervaloVerificacaoSeg}s`
                    : 'Monitoramento automático pausado'}
                  {ultimaAtualizacaoEm
                    ? ` • Última: ${ultimaAtualizacaoEm.toLocaleTimeString('pt-BR')}`
                    : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-300 hover:text-white hover:bg-white/10"
                onClick={alternarSom}
                title={somAtivo ? 'Silenciar alertas sonoros' : 'Ativar alertas sonoros'}
              >
                {somAtivo ? (
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-300 hover:text-white hover:bg-white/10"
                onClick={alternarMonitor}
                title={
                  monitorAtivo
                    ? 'Pausar monitor automático'
                    : 'Retomar monitor automático'
                }
              >
                {monitorAtivo ? (
                  <Bell className="w-3.5 h-3.5 text-blue-400" />
                ) : (
                  <BellOff className="w-3.5 h-3.5 text-slate-400" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-300 hover:text-white hover:bg-white/10"
                onClick={() => atualizarConexoes(true)}
                disabled={verificandoAgora || carregandoRegiao}
                title="Verificar agora no ISPFY"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    verificandoAgora || carregandoRegiao
                      ? 'animate-spin text-blue-400'
                      : ''
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
                className={`rounded-lg border py-1.5 px-2 transition-colors ${item.classeCaixa}`}
              >
                <span
                  className={`block text-sm font-extrabold tabular-nums ${item.classeNumero}`}
                >
                  {item.valor}
                </span>
                <span className={`block text-[10px] ${item.classeTexto}`}>
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
              className="w-full h-7 text-[11px] bg-blue-600/90 hover:bg-blue-500 text-white border-0"
            >
              <Bell className="w-3 h-3 mr-1.5" />
              Permitir alerta no navegador mesmo com outra aba aberta
            </Button>
          )}
        </div>

        {/* Banner de Rompimentos em Massa */}
        {rompimentosEmMassa.length > 0 && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 p-3 space-y-2">
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
                  title="Tocar sirene de alerta NOC"
                >
                  <Volume2 className="w-3 h-3 mr-1" />
                  Sirene
                </Button>
                {(sireneAtiva || (somAtivo && !sireneSilenciada)) && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-6 text-[10px] px-2 font-bold animate-pulse"
                    onClick={() => pararSirene(true)}
                    title="Silenciar sirene para o rompimento atual"
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
                  className="rounded-lg bg-background/80 border border-amber-500/30 p-2 text-[11px] space-y-1.5"
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
                        ? `Rua ${rp.desconectados}/${rp.totalAtivos} (${rp.percentualOffline}%)`
                        : `${alerta.desconectados}/${alerta.totalAtivosNoBairro} off (${alerta.percentualOffline}%)`}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                    <span>
                      Bairro: {alerta.desconectados}/{alerta.totalAtivosNoBairro} off ({alerta.percentualOffline}%)
                    </span>
                    <span>
                      {watch?.whatsappSentAtMs
                        ? `EQUIPE AVL avisada (${formatarHorarioCurto(
                            new Date(watch.whatsappSentAtMs).toISOString()
                          )})`
                        : watch?.firstDetectedAtMs
                          ? `Início ${formatarHorarioCurto(
                              new Date(watch.firstDetectedAtMs).toISOString()
                            )} (envia >5m)`
                          : 'Monitorando (>5m envia EQUIPE AVL)'}
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

        {/* Feed de eventos em tempo real */}
        <div className="max-h-72 overflow-y-auto divide-y divide-border/70 bg-card">
          {eventosRecentes.length === 0 ? (
            <div className="p-5 text-center space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Nenhuma queda nova registrada nesta sessão.
              </p>
              <p className="text-[11px] text-muted-foreground/80">
                Você receberá alerta imediato com som e notificação em qualquer tela assim que um cliente ativo ficar sem internet.
              </p>
            </div>
          ) : (
            eventosRecentes.slice(0, 20).map((evento) => {
              const ficouOffline = evento.type === 'dropped';
              return (
                <div
                  key={evento.id}
                  className={`p-3 flex items-start justify-between gap-2 text-xs ${
                    ficouOffline ? 'bg-rose-500/5' : 'bg-emerald-500/5'
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${
                          ficouOffline
                            ? 'border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300'
                            : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        {ficouOffline ? 'Sem internet' : 'Voltou OK'}
                      </Badge>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {formatarHorarioCurto(evento.occurredAt)}
                      </span>
                    </div>
                    <p className="font-bold text-foreground truncate">
                      {evento.nome}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {evento.bairroLabel} • {evento.enderecoCompleto}
                    </p>
                  </div>

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
                        className="h-7 w-7 text-indigo-600"
                        onClick={() =>
                          navegarEFechar(`/ispfy/cliente/${evento.clienteId}`)
                        }
                        title="Ver ficha completa"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé */}
        <div className="p-2.5 bg-muted/40 border-t border-border flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px]"
            onClick={() => navegarEFechar('/ispfy/regiao?status=DESCONECTADO')}
          >
            Ver todos sem internet ({qtdDesconectados})
          </Button>
          <div className="flex items-center gap-1">
            {eventosRecentes.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] text-muted-foreground"
                onClick={limparEventos}
                title="Limpar histórico desta sessão"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Limpar
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
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
      </PopoverContent>
    </Popover>
    </div>
  );
};

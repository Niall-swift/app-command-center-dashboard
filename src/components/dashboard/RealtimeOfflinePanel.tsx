import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  ArrowRight,
  Bell,
  BellOff,
  ExternalLink,
  MapPin,
  Phone,
  RefreshCw,
  Volume2,
  VolumeX,
  WifiOff,
} from 'lucide-react';
import { useNetworkMonitor } from '@/contexts/NetworkMonitorContext';
import { abrirConversaWhatsApp } from '@/lib/utils';
import { formatarDataHoraCurta, formatarHorarioCurto } from '@/utils/date';
import { toast } from 'sonner';

/** Painel de clientes desconectados no momento e histórico de quedas/reconexões ao vivo. */
export const RealtimeOfflinePanel: React.FC = () => {
  const navegar = useNavigate();
  const {
    dadosRegiao,
    eventosRecentes,
    quedasNaoLidas,
    somAtivo,
    monitorAtivo,
    intervaloVerificacaoSeg,
    alternarSom,
    alternarMonitor,
    tocarSomAlertaQueda,
    revalidarPontoAoVivo,
    confirmarAlertas,
  } = useNetworkMonitor();

  const [pontoVerificandoId, setPontoVerificandoId] = useState<string | null>(
    null
  );

  const desconectadosAgora = useMemo(() => {
    if (!dadosRegiao?.records) return [];
    return dadosRegiao.records
      .filter((registro) => registro.connectionHealth === 'desconectado')
      .sort(
        (a, b) =>
          (b.ultimoLogin || '').localeCompare(a.ultimoLogin || '') ||
          a.bairroLabel.localeCompare(b.bairroLabel, 'pt-BR')
      );
  }, [dadosRegiao]);

  const aoRevalidarPonto = async (
    clienteId: string,
    pontoId: string,
    nomeCliente: string
  ) => {
    setPontoVerificandoId(pontoId);
    try {
      await revalidarPontoAoVivo(clienteId, pontoId);
      toast.success(`Status de ${nomeCliente} revalidado ao vivo no ISPFY!`);
    } catch {
      toast.error(`Falha ao consultar ponto de ${nomeCliente} ao vivo.`);
    } finally {
      setPontoVerificandoId(null);
    }
  };

  return (
    <Card className="border-border shadow-sm bg-card flex flex-col">
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-rose-500" />
              Sem Internet Agora &amp; Alertas ao Vivo
              {quedasNaoLidas > 0 && (
                <Badge className="bg-rose-600 text-white text-[10px] animate-pulse">
                  +{quedasNaoLidas} queda(s)
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs">
              Monitor global a cada {intervaloVerificacaoSeg}s — alerta imediato em qualquer página do sistema
            </CardDescription>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={alternarSom}
              title={somAtivo ? 'Silenciar alerta sonoro' : 'Ativar alerta sonoro'}
            >
              {somAtivo ? (
                <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={alternarMonitor}
              title={
                monitorAtivo
                  ? 'Pausar monitor automático'
                  : 'Ativar monitor automático'
              }
            >
              {monitorAtivo ? (
                <Bell className="w-3.5 h-3.5 text-blue-600" />
              ) : (
                <BellOff className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] px-2"
              onClick={() => {
                tocarSomAlertaQueda();
                toast.info('Teste de alerta sonoro disparado!');
              }}
              title="Testar som de alerta"
            >
              Testar som
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 flex-1 flex flex-col">
        <Tabs
          defaultValue="offline_now"
          onValueChange={(abaSelecionada) => {
            if (abaSelecionada === 'live_events' && quedasNaoLidas > 0) {
              confirmarAlertas();
            }
          }}
          className="flex-1 flex flex-col"
        >
          <TabsList className="grid grid-cols-2 w-full mb-3">
            <TabsTrigger value="offline_now" className="text-xs">
              Sem Internet ({desconectadosAgora.length})
            </TabsTrigger>
            <TabsTrigger value="live_events" className="text-xs">
              Alertas em Tempo Real ({eventosRecentes.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="offline_now"
            className="mt-0 flex-1 max-h-[300px] overflow-y-auto divide-y divide-border/70 border border-border rounded-xl"
          >
            {desconectadosAgora.length === 0 ? (
              <div className="p-6 text-center text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                Nenhum cliente ativo desconectado no momento!
              </div>
            ) : (
              desconectadosAgora.slice(0, 30).map((registro) => (
                <div
                  key={registro.pontoId}
                  className="p-2.5 flex items-center justify-between gap-2 text-xs hover:bg-secondary/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-foreground truncate">
                      {registro.nome}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0 text-rose-500" />
                      {registro.bairroLabel} • {registro.enderecoCompleto}
                    </p>
                    <p className="text-[10px] text-muted-foreground/80">
                      Últ. login:{' '}
                      {formatarDataHoraCurta(registro.ultimoLogin, {
                        incluirAno: false,
                      })}
                      {registro.plano ? ` • ${registro.plano}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-blue-600"
                      onClick={() =>
                        aoRevalidarPonto(
                          registro.clienteId,
                          registro.pontoId,
                          registro.nome
                        )
                      }
                      disabled={pontoVerificandoId === registro.pontoId}
                      title="Testar conexão no ISPFY agora"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${
                          pontoVerificandoId === registro.pontoId
                            ? 'animate-spin'
                            : ''
                        }`}
                      />
                    </Button>
                    {registro.telefone && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-emerald-600"
                        onClick={() => abrirConversaWhatsApp(registro.telefone)}
                        title="WhatsApp"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-indigo-600"
                      onClick={() =>
                        navegar(`/ispfy/cliente/${registro.clienteId}`)
                      }
                      title="Abrir ficha ISPFY"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent
            value="live_events"
            className="mt-0 flex-1 max-h-[300px] overflow-y-auto divide-y divide-border/70 border border-border rounded-xl"
          >
            {eventosRecentes.length === 0 ? (
              <div className="p-6 text-center space-y-1.5">
                <Activity className="w-7 h-7 mx-auto text-emerald-500/70" />
                <p className="text-xs font-medium text-muted-foreground">
                  Monitorando quedas e reconexões em tempo real.
                </p>
                <p className="text-[11px] text-muted-foreground/80">
                  Assim que qualquer cliente perder a internet ou reconectar, o evento aparecerá aqui e você receberá um alerta global.
                </p>
              </div>
            ) : (
              eventosRecentes.map((evento) => {
                const ficouOffline = evento.type === 'dropped';
                return (
                  <div
                    key={evento.id}
                    className={`p-2.5 flex items-center justify-between gap-2 text-xs ${
                      ficouOffline ? 'bg-rose-500/5' : 'bg-emerald-500/5'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${
                            ficouOffline
                              ? 'border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300'
                              : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {ficouOffline ? 'Ficou sem internet' : 'Voltou online'}
                        </Badge>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {formatarHorarioCurto(evento.occurredAt)}
                        </span>
                      </div>
                      <p className="font-bold text-foreground truncate mt-0.5">
                        {evento.nome}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {evento.bairroLabel} • {evento.enderecoCompleto}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-indigo-600 shrink-0"
                      onClick={() =>
                        navegar(`/ispfy/cliente/${evento.clienteId}`)
                      }
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );
              })
            )}
          </TabsContent>
        </Tabs>

        <div className="pt-2.5 mt-auto flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            Exibindo até 30 desconectados recentes
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-primary font-semibold gap-1 px-2"
            onClick={() => navegar('/ispfy/regiao?status=DESCONECTADO')}
          >
            Abrir tela completa
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

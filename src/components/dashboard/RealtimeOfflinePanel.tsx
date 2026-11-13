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
import { openWhatsAppChat } from '@/lib/utils';
import { toast } from 'sonner';

function formatClock(iso?: string): string {
  if (!iso) return '-';
  const cleaned = iso.replace('T', ' ').replace(/\.\d+Z?$/, '').replace(/Z$/, '');
  const [datePart, timePart] = cleaned.split(' ');
  const [y, m, d] = (datePart || '').split('-');
  if (y && m && d) {
    return timePart ? `${d}/${m} ${timePart.slice(0, 5)}` : `${d}/${m}/${y}`;
  }
  const dt = new Date(iso);
  if (!isNaN(dt.getTime())) {
    return dt.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
  return iso;
}

export const RealtimeOfflinePanel: React.FC = () => {
  const navigate = useNavigate();
  const {
    regionData,
    recentEvents,
    unreadDropCount,
    soundEnabled,
    monitorEnabled,
    pollIntervalSec,
    toggleSound,
    toggleMonitor,
    playDropAlertSound,
    recheckSinglePoint,
    acknowledgeAlerts,
  } = useNetworkMonitor();

  const [checkingPontoId, setCheckingPontoId] = useState<string | null>(null);

  const disconnectedNow = useMemo(() => {
    if (!regionData?.records) return [];
    return regionData.records
      .filter((r) => r.connectionHealth === 'desconectado')
      .sort(
        (a, b) =>
          (b.ultimoLogin || '').localeCompare(a.ultimoLogin || '') ||
          a.bairroLabel.localeCompare(b.bairroLabel, 'pt-BR')
      );
  }, [regionData]);

  const handleRecheck = async (clienteId: string, pontoId: string, nome: string) => {
    setCheckingPontoId(pontoId);
    try {
      await recheckSinglePoint(clienteId, pontoId);
      toast.success(`Status de ${nome} revalidado ao vivo no ISPFY!`);
    } catch {
      toast.error(`Falha ao consultar ponto de ${nome} ao vivo.`);
    } finally {
      setCheckingPontoId(null);
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
              {unreadDropCount > 0 && (
                <Badge className="bg-rose-600 text-white text-[10px] animate-pulse">
                  +{unreadDropCount} queda(s)
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs">
              Monitor global a cada {pollIntervalSec}s — alerta imediato em qualquer página do sistema
            </CardDescription>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={toggleSound}
              title={soundEnabled ? 'Silenciar alerta sonoro' : 'Ativar alerta sonoro'}
            >
              {soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={toggleMonitor}
              title={monitorEnabled ? 'Pausar monitor automático' : 'Ativar monitor automático'}
            >
              {monitorEnabled ? (
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
                playDropAlertSound();
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
          onValueChange={(val) => {
            if (val === 'live_events' && unreadDropCount > 0) {
              acknowledgeAlerts();
            }
          }}
          className="flex-1 flex flex-col"
        >
          <TabsList className="grid grid-cols-2 w-full mb-3">
            <TabsTrigger value="offline_now" className="text-xs">
              Sem Internet ({disconnectedNow.length})
            </TabsTrigger>
            <TabsTrigger value="live_events" className="text-xs">
              Alertas em Tempo Real ({recentEvents.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="offline_now"
            className="mt-0 flex-1 max-h-[300px] overflow-y-auto divide-y divide-border/70 border border-border rounded-xl"
          >
            {disconnectedNow.length === 0 ? (
              <div className="p-6 text-center text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                Nenhum cliente ativo desconectado no momento!
              </div>
            ) : (
              disconnectedNow.slice(0, 30).map((rec) => (
                <div
                  key={rec.pontoId}
                  className="p-2.5 flex items-center justify-between gap-2 text-xs hover:bg-secondary/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-foreground truncate">
                      {rec.nome}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0 text-rose-500" />
                      {rec.bairroLabel} • {rec.enderecoCompleto}
                    </p>
                    <p className="text-[10px] text-muted-foreground/80">
                      Últ. login: {formatClock(rec.ultimoLogin)}
                      {rec.plano ? ` • ${rec.plano}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-blue-600"
                      onClick={() =>
                        handleRecheck(rec.clienteId, rec.pontoId, rec.nome)
                      }
                      disabled={checkingPontoId === rec.pontoId}
                      title="Testar conexão no ISPFY agora"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${
                          checkingPontoId === rec.pontoId ? 'animate-spin' : ''
                        }`}
                      />
                    </Button>
                    {rec.telefone && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-emerald-600"
                        onClick={() => openWhatsAppChat(rec.telefone)}
                        title="WhatsApp"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-indigo-600"
                      onClick={() => navigate(`/ispfy/cliente/${rec.clienteId}`)}
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
            {recentEvents.length === 0 ? (
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
              recentEvents.map((ev) => {
                const isDrop = ev.type === 'dropped';
                return (
                  <div
                    key={ev.id}
                    className={`p-2.5 flex items-center justify-between gap-2 text-xs ${
                      isDrop ? 'bg-rose-500/5' : 'bg-emerald-500/5'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${
                            isDrop
                              ? 'border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300'
                              : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {isDrop ? 'Ficou sem internet' : 'Voltou online'}
                        </Badge>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {new Date(ev.occurredAt).toLocaleTimeString('pt-BR')}
                        </span>
                      </div>
                      <p className="font-bold text-foreground truncate mt-0.5">
                        {ev.nome}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {ev.bairroLabel} • {ev.enderecoCompleto}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-indigo-600 shrink-0"
                      onClick={() => navigate(`/ispfy/cliente/${ev.clienteId}`)}
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
            onClick={() => navigate('/ispfy/regiao?status=DESCONECTADO')}
          >
            Abrir tela completa
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

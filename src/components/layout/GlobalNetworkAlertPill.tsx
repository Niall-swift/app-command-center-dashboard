import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Bell,
  BellOff,
  CheckCheck,
  ExternalLink,
  MapPin,
  Phone,
  RefreshCw,
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
import { openWhatsAppChat } from '@/lib/utils';

function formatClock(iso?: string): string {
  if (!iso) return '--:--:--';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '--:--:--';
  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export const GlobalNetworkAlertPill: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const {
    regionData,
    loadingRegion,
    isPolling,
    lastUpdatedAt,
    recentEvents,
    unreadDropCount,
    soundEnabled,
    monitorEnabled,
    pollIntervalSec,
    browserNotifPermission,
    requestBrowserNotifPermission,
    refreshConnections,
    acknowledgeAlerts,
    clearEvents,
    toggleSound,
    toggleMonitor,
  } = useNetworkMonitor();

  const totals = regionData?.totals;
  const okCount = totals?.internetOk ?? 0;
  const offCount = totals?.desconectados ?? 0;
  const blockedCount = totals?.bloqueados ?? 0;

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen && unreadDropCount > 0) {
      acknowledgeAlerts();
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`relative h-9 px-2.5 sm:px-3 rounded-xl gap-2 text-xs font-semibold transition-all shadow-sm ${
            unreadDropCount > 0
              ? 'border-rose-500/70 bg-rose-500/15 text-rose-600 dark:text-rose-300 hover:bg-rose-500/20 ring-2 ring-rose-500/30 animate-pulse'
              : offCount > 0
              ? 'border-border/80 bg-background hover:bg-secondary text-foreground'
              : 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          }`}
          title="Monitor Global de Clientes Sem Internet (Tempo Real)"
        >
          {loadingRegion && !totals ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
              <span className="hidden md:inline text-muted-foreground">
                Sincronizando rede...
              </span>
            </>
          ) : (
            <>
              <span className="relative flex items-center">
                {monitorEnabled ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-slate-400 mr-1.5" />
                )}
                <Wifi className="w-3.5 h-3.5 text-emerald-500 hidden sm:inline" />
                <span className="hidden sm:inline ml-1 text-emerald-700 dark:text-emerald-300 font-bold tabular-nums">
                  {okCount}
                </span>
              </span>

              <span className="hidden sm:inline text-border">|</span>

              <span
                className={`flex items-center gap-1 tabular-nums ${
                  offCount > 0
                    ? 'text-rose-600 dark:text-rose-400 font-bold'
                    : 'text-muted-foreground'
                }`}
              >
                <WifiOff className="w-3.5 h-3.5" />
                <span>{offCount}</span>
                <span className="hidden lg:inline">sem int.</span>
              </span>

              {isPolling && (
                <RefreshCw className="w-3 h-3 animate-spin text-muted-foreground ml-0.5" />
              )}

              {unreadDropCount > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-extrabold shadow">
                  +{unreadDropCount}
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
                  {monitorEnabled
                    ? `Ativo a cada ${pollIntervalSec}s`
                    : 'Monitoramento automático pausado'}
                  {lastUpdatedAt ? ` • Última: ${lastUpdatedAt.toLocaleTimeString('pt-BR')}` : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-300 hover:text-white hover:bg-white/10"
                onClick={toggleSound}
                title={soundEnabled ? 'Silenciar alertas sonoros' : 'Ativar alertas sonoros'}
              >
                {soundEnabled ? (
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-300 hover:text-white hover:bg-white/10"
                onClick={toggleMonitor}
                title={monitorEnabled ? 'Pausar monitor automático' : 'Retomar monitor automático'}
              >
                {monitorEnabled ? (
                  <Bell className="w-3.5 h-3.5 text-blue-400" />
                ) : (
                  <BellOff className="w-3.5 h-3.5 text-slate-400" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-300 hover:text-white hover:bg-white/10"
                onClick={() => refreshConnections(true)}
                disabled={isPolling || loadingRegion}
                title="Verificar agora no ISPFY"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    isPolling || loadingRegion ? 'animate-spin text-blue-400' : ''
                  }`}
                />
              </Button>
            </div>
          </div>

          {/* Mini placar clicável */}
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate('/ispfy/regiao?status=OK');
              }}
              className="rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 py-1.5 px-2 transition-colors"
            >
              <span className="block text-sm font-extrabold text-emerald-300 tabular-nums">
                {okCount}
              </span>
              <span className="block text-[10px] text-emerald-200/80">
                Internet OK
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate('/ispfy/regiao?status=DESCONECTADO');
              }}
              className="rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 py-1.5 px-2 transition-colors"
            >
              <span className="block text-sm font-extrabold text-rose-300 tabular-nums">
                {offCount}
              </span>
              <span className="block text-[10px] text-rose-200/80">
                Sem Internet
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate('/ispfy/regiao?status=BLOQUEADO');
              }}
              className="rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 py-1.5 px-2 transition-colors"
            >
              <span className="block text-sm font-extrabold text-amber-300 tabular-nums">
                {blockedCount}
              </span>
              <span className="block text-[10px] text-amber-200/80">
                Bloqueados
              </span>
            </button>
          </div>

          {browserNotifPermission === 'default' && (
            <Button
              size="sm"
              variant="secondary"
              onClick={requestBrowserNotifPermission}
              className="w-full h-7 text-[11px] bg-blue-600/90 hover:bg-blue-500 text-white border-0"
            >
              <Bell className="w-3 h-3 mr-1.5" />
              Permitir alerta no navegador mesmo com outra aba aberta
            </Button>
          )}
        </div>

        {/* Feed de eventos em tempo real */}
        <div className="max-h-72 overflow-y-auto divide-y divide-border/70 bg-card">
          {recentEvents.length === 0 ? (
            <div className="p-5 text-center space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Nenhuma queda nova registrada nesta sessão.
              </p>
              <p className="text-[11px] text-muted-foreground/80">
                Você receberá alerta imediato com som e notificação em qualquer tela assim que um cliente ativo ficar sem internet.
              </p>
            </div>
          ) : (
            recentEvents.slice(0, 20).map((ev) => {
              const isDrop = ev.type === 'dropped';
              return (
                <div
                  key={ev.id}
                  className={`p-3 flex items-start justify-between gap-2 text-xs ${
                    isDrop ? 'bg-rose-500/5' : 'bg-emerald-500/5'
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${
                          isDrop
                            ? 'border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300'
                            : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        {isDrop ? 'Sem internet' : 'Voltou OK'}
                      </Badge>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {formatClock(ev.occurredAt)}
                      </span>
                    </div>
                    <p className="font-bold text-foreground truncate">
                      {ev.nome}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {ev.bairroLabel} • {ev.enderecoCompleto}
                    </p>
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0">
                    {ev.telefone && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-emerald-600"
                        onClick={() => openWhatsAppChat(ev.telefone)}
                        title="Abrir WhatsApp"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {ev.clienteId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-indigo-600"
                        onClick={() => {
                          setOpen(false);
                          navigate(`/ispfy/cliente/${ev.clienteId}`);
                        }}
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
            onClick={() => {
              setOpen(false);
              navigate('/ispfy/regiao?status=DESCONECTADO');
            }}
          >
            Ver todos sem internet ({offCount})
          </Button>
          <div className="flex items-center gap-1">
            {recentEvents.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] text-muted-foreground"
                onClick={clearEvents}
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
                acknowledgeAlerts();
                setOpen(false);
                navigate('/');
              }}
            >
              <CheckCheck className="w-3 h-3 mr-1" />
              Dashboard
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

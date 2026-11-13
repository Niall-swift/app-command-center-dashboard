import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ispfyService } from '@/services/ispfy/ispfyService';
import {
  aggregateRegionSummaries,
  classifyPointConnectionHealth,
  detectConnectionTransitions,
} from '@/services/ispfy/regionAuditHelpers';
import type {
  ISPFYClientsByRegionResult,
  ISPFYConnectionTransitionEvent,
  ISPFYOverdueAnalyticsResult,
} from '@/types/ispfy';

const POLL_INTERVAL_MS = 45 * 1000;
const OVERDUE_REFRESH_MS = 5 * 60 * 1000;
const SOUND_STORAGE_KEY = 'avl_network_monitor_sound';
const MONITOR_STORAGE_KEY = 'avl_network_monitor_enabled';
const EVENTS_STORAGE_KEY = 'avl_network_monitor_events_v1';
const MAX_STORED_EVENTS = 60;

interface NetworkMonitorContextType {
  regionData: ISPFYClientsByRegionResult | null;
  overdueData: ISPFYOverdueAnalyticsResult | null;
  loadingRegion: boolean;
  loadingOverdue: boolean;
  isPolling: boolean;
  error: string | null;
  lastUpdatedAt: Date | null;
  recentEvents: ISPFYConnectionTransitionEvent[];
  unreadDropCount: number;
  soundEnabled: boolean;
  monitorEnabled: boolean;
  pollIntervalSec: number;
  browserNotifPermission: NotificationPermission | 'unsupported';
  requestBrowserNotifPermission: () => Promise<boolean>;
  refreshConnections: (force?: boolean) => Promise<void>;
  refreshOverdue: (force?: boolean) => Promise<void>;
  refreshAll: () => Promise<void>;
  recheckSinglePoint: (clienteId: string, pontoId: string) => Promise<void>;
  acknowledgeAlerts: () => void;
  clearEvents: () => void;
  toggleSound: () => void;
  toggleMonitor: () => void;
  playDropAlertSound: () => void;
}

const NetworkMonitorContext = createContext<
  NetworkMonitorContextType | undefined
>(undefined);

export const useNetworkMonitor = (): NetworkMonitorContextType => {
  const ctx = useContext(NetworkMonitorContext);
  if (!ctx) {
    throw new Error(
      'useNetworkMonitor deve ser utilizado dentro de NetworkMonitorProvider'
    );
  }
  return ctx;
};

function readBoolPref(key: string, defaultValue: boolean): boolean {
  try {
    const val = localStorage.getItem(key);
    if (val === null) return defaultValue;
    return val === 'true';
  } catch {
    return defaultValue;
  }
}

function readStoredEvents(): ISPFYConnectionTransitionEvent[] {
  try {
    const raw = sessionStorage.getItem(EVENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_STORED_EVENTS) : [];
  } catch {
    return [];
  }
}

export const NetworkMonitorProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const navigate = useNavigate();

  const [regionData, setRegionData] =
    useState<ISPFYClientsByRegionResult | null>(null);
  const [overdueData, setOverdueData] =
    useState<ISPFYOverdueAnalyticsResult | null>(null);
  const [loadingRegion, setLoadingRegion] = useState<boolean>(true);
  const [loadingOverdue, setLoadingOverdue] = useState<boolean>(true);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [recentEvents, setRecentEvents] = useState<
    ISPFYConnectionTransitionEvent[]
  >(readStoredEvents);
  const [unreadDropCount, setUnreadDropCount] = useState<number>(0);

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() =>
    readBoolPref(SOUND_STORAGE_KEY, true)
  );
  const [monitorEnabled, setMonitorEnabled] = useState<boolean>(() =>
    readBoolPref(MONITOR_STORAGE_KEY, true)
  );
  const [browserNotifPermission, setBrowserNotifPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() =>
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );

  const regionDataRef = useRef<ISPFYClientsByRegionResult | null>(null);
  const inFlightConnRef = useRef<boolean>(false);
  const inFlightOverdueRef = useRef<boolean>(false);
  const soundEnabledRef = useRef<boolean>(soundEnabled);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    regionDataRef.current = regionData;
  }, [regionData]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // Libera AudioContext na primeira interação do usuário para evitar bloqueio de autoplay
  useEffect(() => {
    const unlockAudio = () => {
      try {
        if (!audioCtxRef.current && typeof window !== 'undefined') {
          const Ctor =
            window.AudioContext ||
            (window as { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext;
          if (Ctor) audioCtxRef.current = new Ctor();
        }
        if (audioCtxRef.current?.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => undefined);
        }
      } catch {
        // Ignora erro de audio context
      }
    };
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  const playDropAlertSound = useCallback(() => {
    try {
      if (typeof window === 'undefined') return;
      if (!audioCtxRef.current) {
        const Ctor =
          window.AudioContext ||
          (window as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (Ctor) audioCtxRef.current = new Ctor();
      }
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => undefined);
      }

      const now = ctx.currentTime;
      // Sequência distinta de alerta NOC (agudo -> grave -> agudo)
      const notes = [880, 587.33, 880];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.connect(gain);
        gain.connect(ctx.destination);

        const start = now + idx * 0.14;
        const dur = 0.12;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.28, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.start(start);
        osc.stop(start + dur);
      });
    } catch (err) {
      console.warn('Não foi possível reproduzir alerta sonoro:', err);
    }
  }, []);

  const requestBrowserNotifPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setBrowserNotifPermission('unsupported');
      return false;
    }
    try {
      const result = await Notification.requestPermission();
      setBrowserNotifPermission(result);
      return result === 'granted';
    } catch {
      return false;
    }
  }, []);

  const emitGlobalDropNotification = useCallback(
    (dropped: ISPFYConnectionTransitionEvent[]) => {
      if (dropped.length === 0) return;

      if (soundEnabledRef.current) {
        playDropAlertSound();
      }

      const first = dropped[0];
      const titleText =
        dropped.length === 1
          ? `⚠️ Cliente sem internet: ${first.nome}`
          : `🚨 ${dropped.length} clientes ficaram sem internet agora!`;

      const uniqueBairros = Array.from(
        new Set(dropped.map((d) => d.bairroLabel).filter(Boolean))
      );
      const descriptionText =
        dropped.length === 1
          ? `${first.bairroLabel} • ${first.enderecoCompleto}${
              first.plano ? ` (${first.plano})` : ''
            }`
          : `${dropped
              .slice(0, 3)
              .map((d) => d.nome)
              .join(', ')}${
              dropped.length > 3 ? ` e +${dropped.length - 3}` : ''
            } • Bairros: ${uniqueBairros.slice(0, 3).join(', ')}`;

      const targetBairroParam =
        uniqueBairros.length === 1
          ? `&bairro=${encodeURIComponent(dropped[0].bairroKey)}`
          : '';

      // 1. Toast interativo global (visível em qualquer rota do painel)
      toast.error(titleText, {
        description: descriptionText,
        duration: 12000,
        action: {
          label: 'Ver desconectados',
          onClick: () => {
            navigate(`/ispfy/regiao?status=DESCONECTADO${targetBairroParam}`);
          },
        },
      });

      // 2. Notificação do sistema operacional (caso operador esteja em outra aba/janela)
      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        try {
          const notif = new Notification(titleText, {
            body: descriptionText,
            icon: '/favicon.ico',
            tag: `ispfy-drop-${Date.now()}`,
          });
          notif.onclick = () => {
            window.focus();
            navigate(`/ispfy/regiao?status=DESCONECTADO${targetBairroParam}`);
            notif.close();
          };
          setTimeout(() => notif.close(), 9000);
        } catch {
          // Navegador bloqueou notificação fora de foco
        }
      }
    },
    [navigate, playDropAlertSound]
  );

  const applyNewSnapshot = useCallback(
    (next: ISPFYClientsByRegionResult) => {
      const prev = regionDataRef.current;

      if (prev && prev.records.length > 0) {
        const { dropped, reconnected } = detectConnectionTransitions(
          prev.records,
          next.records,
          next.fetchedAt
        );

        if (dropped.length > 0 || reconnected.length > 0) {
          setRecentEvents((current) => {
            const merged = [...dropped, ...reconnected, ...current].slice(
              0,
              MAX_STORED_EVENTS
            );
            try {
              sessionStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(merged));
            } catch {
              // Ignora quota do sessionStorage
            }
            return merged;
          });
        }

        if (dropped.length > 0) {
          setUnreadDropCount((c) => c + dropped.length);
          emitGlobalDropNotification(dropped);
        }
      }

      regionDataRef.current = next;
      setRegionData(next);
      setLastUpdatedAt(new Date());
      setError(null);
    },
    [emitGlobalDropNotification]
  );

  const refreshConnections = useCallback(
    async (force = false) => {
      if (inFlightConnRef.current) return;
      inFlightConnRef.current = true;

      const hasExisting = Boolean(regionDataRef.current);
      if (!hasExisting) {
        setLoadingRegion(true);
      } else {
        setIsPolling(true);
      }

      try {
        const next = hasExisting && !force
          ? await ispfyService.pollRealtimeConnectionStatus()
          : await ispfyService.getClientsByRegionAndStatus(undefined, force);

        applyNewSnapshot(next);
      } catch (err: any) {
        console.error('[NetworkMonitor] Erro ao consultar conexões ISPFY:', err);
        setError(err?.message || 'Erro ao monitorar conexões no ISPFY');
      } finally {
        inFlightConnRef.current = false;
        setLoadingRegion(false);
        setIsPolling(false);
      }
    },
    [applyNewSnapshot]
  );

  const refreshOverdue = useCallback(async (force = false) => {
    if (inFlightOverdueRef.current) return;
    inFlightOverdueRef.current = true;
    if (!overdueData) setLoadingOverdue(true);

    try {
      const result = await ispfyService.getOverdueByDueDateSummary(
        regionDataRef.current?.records,
        force
      );
      setOverdueData(result);
    } catch (err: any) {
      console.error('[NetworkMonitor] Erro ao carregar inadimplência por vencimento:', err);
    } finally {
      inFlightOverdueRef.current = false;
      setLoadingOverdue(false);
    }
  }, [overdueData]);

  const refreshAll = useCallback(async () => {
    await refreshConnections(true);
    await refreshOverdue(true);
  }, [refreshConnections, refreshOverdue]);

  const recheckSinglePoint = useCallback(
    async (clienteId: string, pontoId: string) => {
      if (!clienteId) return;
      const livePoints = await ispfyService.getClientLivePointStatuses(clienteId);
      const match =
        livePoints.find((p) => p.idPonto === pontoId) || livePoints[0];
      if (!match) return;

      const currentData = regionDataRef.current;
      if (!currentData) return;

      const updatedRecords = currentData.records.map((rec) => {
        if (rec.pontoId !== pontoId && rec.clienteId !== clienteId) return rec;
        const pointLive =
          livePoints.find((p) => p.idPonto === rec.pontoId) || match;
        const health = classifyPointConnectionHealth({
          contratoAtivo: rec.isContractActive ? 's' : 'n',
          pontoAtivo: rec.isContractActive ? 's' : 'n',
          bloqueadoFlag: pointLive.isBlocked,
          sessaoConexaoStatus: pointLive.conexaoStatus,
        });
        return {
          ...rec,
          sessaoConexaoStatus: pointLive.conexaoStatus,
          connectionHealth: health.connectionHealth,
          isOnline: health.isOnline,
          isBlocked: health.isBlocked,
          ipAlocado: pointLive.ipWan || (health.isOnline ? rec.ipAlocado : ''),
          ipv6Alocado:
            pointLive.ipv6Wan || (health.isOnline ? rec.ipv6Alocado : ''),
          ultimoLogin: pointLive.ultimoLogin || rec.ultimoLogin,
          uploadMesKbytes: pointLive.uploadMesKbytes,
          downloadMesKbytes: pointLive.downloadMesKbytes,
        };
      });

      const activeRecords = updatedRecords.filter((r) => r.isContractActive);
      const summary = aggregateRegionSummaries(activeRecords);
      const next: ISPFYClientsByRegionResult = {
        records: updatedRecords,
        bairros: summary.bairros,
        ruas: summary.ruas,
        fetchedAt: new Date().toISOString(),
        totals: {
          ...summary.totals,
          totalPontos: updatedRecords.length,
          inativos: updatedRecords.length - activeRecords.length,
        },
      };

      regionDataRef.current = next;
      setRegionData(next);
      setLastUpdatedAt(new Date());
    },
    []
  );

  // Carga inicial única + polling global contínuo
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      await refreshConnections(false);
      if (mounted) {
        await refreshOverdue(false);
      }
    };
    init();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!monitorEnabled) return;

    const connTimer = window.setInterval(() => {
      refreshConnections(false);
    }, POLL_INTERVAL_MS);

    const overdueTimer = window.setInterval(() => {
      refreshOverdue(false);
    }, OVERDUE_REFRESH_MS);

    return () => {
      window.clearInterval(connTimer);
      window.clearInterval(overdueTimer);
    };
  }, [monitorEnabled, refreshConnections, refreshOverdue]);

  const acknowledgeAlerts = useCallback(() => {
    setUnreadDropCount(0);
  }, []);

  const clearEvents = useCallback(() => {
    setRecentEvents([]);
    setUnreadDropCount(0);
    try {
      sessionStorage.removeItem(EVENTS_STORAGE_KEY);
    } catch {
      // Ignora erro
    }
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SOUND_STORAGE_KEY, String(next));
      } catch {
        // Ignora
      }
      return next;
    });
  }, []);

  const toggleMonitor = useCallback(() => {
    setMonitorEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(MONITOR_STORAGE_KEY, String(next));
      } catch {
        // Ignora
      }
      return next;
    });
  }, []);

  return (
    <NetworkMonitorContext.Provider
      value={{
        regionData,
        overdueData,
        loadingRegion,
        loadingOverdue,
        isPolling,
        error,
        lastUpdatedAt,
        recentEvents,
        unreadDropCount,
        soundEnabled,
        monitorEnabled,
        pollIntervalSec: POLL_INTERVAL_MS / 1000,
        browserNotifPermission,
        requestBrowserNotifPermission,
        refreshConnections,
        refreshOverdue,
        refreshAll,
        recheckSinglePoint,
        acknowledgeAlerts,
        clearEvents,
        toggleSound,
        toggleMonitor,
        playDropAlertSound,
      }}
    >
      {children}
    </NetworkMonitorContext.Provider>
  );
};


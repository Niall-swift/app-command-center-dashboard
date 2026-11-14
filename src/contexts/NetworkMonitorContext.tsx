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
  agregarResumosPorRegiao,
  classificarSaudeConexaoPonto,
  detectarTransicoesConexao,
} from '@/services/ispfy/regionAuditHelpers';
import type {
  ISPFYClientsByRegionResult,
  ISPFYConnectionTransitionEvent,
  ISPFYLivePointStatus,
  ISPFYOverdueAnalyticsResult,
} from '@/types/ispfy';

const INTERVALO_CONSULTA_MS = 45 * 1000;
const INTERVALO_INADIMPLENCIA_MS = 5 * 60 * 1000;
const CHAVE_PREF_SOM = 'avl_network_monitor_sound';
const CHAVE_PREF_MONITOR = 'avl_network_monitor_enabled';
const CHAVE_EVENTOS_SESSAO = 'avl_network_monitor_events_v1';
const MAX_EVENTOS_ARMAZENADOS = 60;
const FREQUENCIAS_BIP_ALERTA_NOC = [880, 587.33, 880];

/** Contrato público exposto pelo monitor global de rede em tempo real. */
interface ContextoMonitorRede {
  dadosRegiao: ISPFYClientsByRegionResult | null;
  dadosInadimplencia: ISPFYOverdueAnalyticsResult | null;
  carregandoRegiao: boolean;
  carregandoInadimplencia: boolean;
  verificandoAgora: boolean;
  erro: string | null;
  ultimaAtualizacaoEm: Date | null;
  eventosRecentes: ISPFYConnectionTransitionEvent[];
  quedasNaoLidas: number;
  somAtivo: boolean;
  monitorAtivo: boolean;
  intervaloVerificacaoSeg: number;
  permissaoNotificacao: NotificationPermission | 'unsupported';
  solicitarPermissaoNotificacao: () => Promise<boolean>;
  atualizarConexoes: (forcar?: boolean) => Promise<void>;
  atualizarInadimplencia: (forcar?: boolean) => Promise<void>;
  atualizarTudo: () => Promise<void>;
  revalidarPontoAoVivo: (
    clienteId: string,
    pontoId: string
  ) => Promise<ISPFYLivePointStatus | null>;
  confirmarAlertas: () => void;
  limparEventos: () => void;
  alternarSom: () => void;
  alternarMonitor: () => void;
  tocarSomAlertaQueda: () => void;
}

const ContextoMonitorRedeReact = createContext<ContextoMonitorRede | undefined>(
  undefined
);

/** Hook para consumir o estado e ações do monitoramento global de conexões. */
export const useNetworkMonitor = (): ContextoMonitorRede => {
  const contexto = useContext(ContextoMonitorRedeReact);
  if (!contexto) {
    throw new Error(
      'useNetworkMonitor deve ser utilizado dentro de NetworkMonitorProvider'
    );
  }
  return contexto;
};

function lerPreferenciaBooleana(chave: string, valorPadrao: boolean): boolean {
  try {
    const valor = localStorage.getItem(chave);
    if (valor === null) return valorPadrao;
    return valor === 'true';
  } catch {
    return valorPadrao;
  }
}

function lerEventosArmazenados(): ISPFYConnectionTransitionEvent[] {
  try {
    const bruto = sessionStorage.getItem(CHAVE_EVENTOS_SESSAO);
    if (!bruto) return [];
    const convertido = JSON.parse(bruto);
    return Array.isArray(convertido)
      ? convertido.slice(0, MAX_EVENTOS_ARMAZENADOS)
      : [];
  } catch {
    return [];
  }
}

function obterOuCriarAudioContext(
  refAudioCtx: React.MutableRefObject<AudioContext | null>
): AudioContext | null {
  try {
    if (typeof window === 'undefined') return null;
    if (!refAudioCtx.current) {
      const ConstrutorAudio =
        window.AudioContext ||
        (window as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (ConstrutorAudio) {
        refAudioCtx.current = new ConstrutorAudio();
      }
    }
    if (refAudioCtx.current?.state === 'suspended') {
      refAudioCtx.current.resume().catch(() => undefined);
    }
    return refAudioCtx.current;
  } catch {
    return null;
  }
}

/** Provider global que mantém a leitura periódica de rede e alertas entre rotas. */
export const NetworkMonitorProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const navegar = useNavigate();
  const navegarRef = useRef(navegar);
  navegarRef.current = navegar;

  const [dadosRegiao, setDadosRegiao] =
    useState<ISPFYClientsByRegionResult | null>(null);
  const [dadosInadimplencia, setDadosInadimplencia] =
    useState<ISPFYOverdueAnalyticsResult | null>(null);
  const [carregandoRegiao, setCarregandoRegiao] = useState<boolean>(true);
  const [carregandoInadimplencia, setCarregandoInadimplencia] =
    useState<boolean>(true);
  const [verificandoAgora, setVerificandoAgora] = useState<boolean>(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ultimaAtualizacaoEm, setUltimaAtualizacaoEm] = useState<Date | null>(
    null
  );
  const [eventosRecentes, setEventosRecentes] = useState<
    ISPFYConnectionTransitionEvent[]
  >(lerEventosArmazenados);
  const [quedasNaoLidas, setQuedasNaoLidas] = useState<number>(0);

  const [somAtivo, setSomAtivo] = useState<boolean>(() =>
    lerPreferenciaBooleana(CHAVE_PREF_SOM, true)
  );
  const [monitorAtivo, setMonitorAtivo] = useState<boolean>(() =>
    lerPreferenciaBooleana(CHAVE_PREF_MONITOR, true)
  );
  const [permissaoNotificacao, setPermissaoNotificacao] = useState<
    NotificationPermission | 'unsupported'
  >(() =>
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );

  const dadosRegiaoRef = useRef<ISPFYClientsByRegionResult | null>(null);
  const dadosInadimplenciaRef = useRef<ISPFYOverdueAnalyticsResult | null>(null);
  const consultaConexaoEmAndamentoRef = useRef<boolean>(false);
  const consultaInadimplenciaEmAndamentoRef = useRef<boolean>(false);
  const somAtivoRef = useRef<boolean>(somAtivo);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    dadosRegiaoRef.current = dadosRegiao;
  }, [dadosRegiao]);

  useEffect(() => {
    dadosInadimplenciaRef.current = dadosInadimplencia;
  }, [dadosInadimplencia]);

  useEffect(() => {
    somAtivoRef.current = somAtivo;
  }, [somAtivo]);

  // Libera AudioContext na primeira interação do usuário para evitar bloqueio de autoplay
  useEffect(() => {
    const liberarAudio = () => {
      obterOuCriarAudioContext(audioCtxRef);
    };
    window.addEventListener('pointerdown', liberarAudio, { passive: true });
    window.addEventListener('keydown', liberarAudio, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', liberarAudio);
      window.removeEventListener('keydown', liberarAudio);
    };
  }, []);

  const tocarSomAlertaQueda = useCallback(() => {
    try {
      const contextoAudio = obterOuCriarAudioContext(audioCtxRef);
      if (!contextoAudio) return;

      const instanteAtual = contextoAudio.currentTime;
      // Sequência distinta de alerta NOC (agudo -> grave -> agudo)
      FREQUENCIAS_BIP_ALERTA_NOC.forEach((frequencia, indice) => {
        const oscilador = contextoAudio.createOscillator();
        const ganho = contextoAudio.createGain();
        oscilador.type = 'triangle';
        oscilador.connect(ganho);
        ganho.connect(contextoAudio.destination);

        const inicio = instanteAtual + indice * 0.14;
        const duracao = 0.12;
        oscilador.frequency.setValueAtTime(frequencia, inicio);
        ganho.gain.setValueAtTime(0.001, inicio);
        ganho.gain.linearRampToValueAtTime(0.28, inicio + 0.015);
        ganho.gain.exponentialRampToValueAtTime(0.001, inicio + duracao);
        oscilador.start(inicio);
        oscilador.stop(inicio + duracao);
      });
    } catch (erroAudio) {
      console.warn('Não foi possível reproduzir alerta sonoro:', erroAudio);
    }
  }, []);

  const solicitarPermissaoNotificacao = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermissaoNotificacao('unsupported');
      return false;
    }
    try {
      const resultado = await Notification.requestPermission();
      setPermissaoNotificacao(resultado);
      return resultado === 'granted';
    } catch {
      return false;
    }
  }, []);

  const notificarQuedasGlobalmente = useCallback(
    (quedas: ISPFYConnectionTransitionEvent[]) => {
      if (quedas.length === 0) return;

      if (somAtivoRef.current) {
        tocarSomAlertaQueda();
      }

      const primeiraQueda = quedas[0];
      const tituloAlerta =
        quedas.length === 1
          ? `⚠️ Cliente sem internet: ${primeiraQueda.nome}`
          : `🚨 ${quedas.length} clientes ficaram sem internet agora!`;

      const bairrosAfetados = Array.from(
        new Set(quedas.map((queda) => queda.bairroLabel).filter(Boolean))
      );
      const descricaoAlerta =
        quedas.length === 1
          ? `${primeiraQueda.bairroLabel} • ${primeiraQueda.enderecoCompleto}${
              primeiraQueda.plano ? ` (${primeiraQueda.plano})` : ''
            }`
          : `${quedas
              .slice(0, 3)
              .map((queda) => queda.nome)
              .join(', ')}${
              quedas.length > 3 ? ` e +${quedas.length - 3}` : ''
            } • Bairros: ${bairrosAfetados.slice(0, 3).join(', ')}`;

      const parametroBairro =
        bairrosAfetados.length === 1
          ? `&bairro=${encodeURIComponent(primeiraQueda.bairroKey)}`
          : '';
      const rotaDesconectados = `/ispfy/regiao?status=DESCONECTADO${parametroBairro}`;

      // 1. Toast interativo global (visível em qualquer rota do painel)
      toast.error(tituloAlerta, {
        description: descricaoAlerta,
        duration: 12000,
        action: {
          label: 'Ver desconectados',
          onClick: () => navegarRef.current(rotaDesconectados),
        },
      });

      // 2. Notificação do sistema operacional (caso operador esteja em outra aba/janela)
      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        try {
          const notificacao = new Notification(tituloAlerta, {
            body: descricaoAlerta,
            icon: '/favicon.ico',
            tag: `ispfy-drop-${Date.now()}`,
          });
          notificacao.onclick = () => {
            window.focus();
            navegarRef.current(rotaDesconectados);
            notificacao.close();
          };
          setTimeout(() => notificacao.close(), 9000);
        } catch {
          // Navegador bloqueou notificação fora de foco
        }
      }
    },
    [tocarSomAlertaQueda]
  );

  const aplicarNovoSnapshot = useCallback(
    (proximoSnapshot: ISPFYClientsByRegionResult) => {
      const snapshotAnterior = dadosRegiaoRef.current;

      if (snapshotAnterior && snapshotAnterior.records.length > 0) {
        const { quedas, reconexoes } = detectarTransicoesConexao(
          snapshotAnterior.records,
          proximoSnapshot.records,
          proximoSnapshot.fetchedAt
        );

        if (quedas.length > 0 || reconexoes.length > 0) {
          setEventosRecentes((eventosAtuais) => {
            const listaMesclada = [
              ...quedas,
              ...reconexoes,
              ...eventosAtuais,
            ].slice(0, MAX_EVENTOS_ARMAZENADOS);
            try {
              sessionStorage.setItem(
                CHAVE_EVENTOS_SESSAO,
                JSON.stringify(listaMesclada)
              );
            } catch {
              // Ignora limite de armazenamento da sessão
            }
            return listaMesclada;
          });
        }

        if (quedas.length > 0) {
          setQuedasNaoLidas((quantidade) => quantidade + quedas.length);
          notificarQuedasGlobalmente(quedas);
        }
      }

      dadosRegiaoRef.current = proximoSnapshot;
      setDadosRegiao(proximoSnapshot);
      setUltimaAtualizacaoEm(new Date());
      setErro(null);
    },
    [notificarQuedasGlobalmente]
  );

  const atualizarConexoes = useCallback(
    async (forcar = false) => {
      if (consultaConexaoEmAndamentoRef.current) return;
      consultaConexaoEmAndamentoRef.current = true;

      const possuiSnapshotAtual = Boolean(dadosRegiaoRef.current);
      if (!possuiSnapshotAtual) {
        setCarregandoRegiao(true);
      } else {
        setVerificandoAgora(true);
      }

      try {
        const proximoSnapshot =
          possuiSnapshotAtual && !forcar
            ? await ispfyService.pollRealtimeConnectionStatus()
            : await ispfyService.getClientsByRegionAndStatus(undefined, forcar);

        aplicarNovoSnapshot(proximoSnapshot);
      } catch (erroCaptura: unknown) {
        const mensagemErro =
          erroCaptura instanceof Error
            ? erroCaptura.message
            : 'Erro ao monitorar conexões no ISPFY';
        console.error(
          '[MonitorRede] Erro ao consultar conexões ISPFY:',
          erroCaptura
        );
        setErro(mensagemErro);
      } finally {
        consultaConexaoEmAndamentoRef.current = false;
        setCarregandoRegiao(false);
        setVerificandoAgora(false);
      }
    },
    [aplicarNovoSnapshot]
  );

  const atualizarInadimplencia = useCallback(async (forcar = false) => {
    if (consultaInadimplenciaEmAndamentoRef.current) return;
    consultaInadimplenciaEmAndamentoRef.current = true;
    if (!dadosInadimplenciaRef.current) {
      setCarregandoInadimplencia(true);
    }

    try {
      const resumoAtrasos = await ispfyService.getOverdueByDueDateSummary(
        dadosRegiaoRef.current?.records,
        forcar
      );
      dadosInadimplenciaRef.current = resumoAtrasos;
      setDadosInadimplencia(resumoAtrasos);
    } catch (erroCaptura) {
      console.error(
        '[MonitorRede] Erro ao carregar inadimplência por vencimento:',
        erroCaptura
      );
    } finally {
      consultaInadimplenciaEmAndamentoRef.current = false;
      setCarregandoInadimplencia(false);
    }
  }, []);

  const atualizarTudo = useCallback(async () => {
    await atualizarConexoes(true);
    await atualizarInadimplencia(true);
  }, [atualizarConexoes, atualizarInadimplencia]);

  const revalidarPontoAoVivo = useCallback(
    async (
      clienteId: string,
      pontoId: string
    ): Promise<ISPFYLivePointStatus | null> => {
      if (!clienteId) return null;
      const pontosAoVivo =
        await ispfyService.getClientLivePointStatuses(clienteId);
      const pontoEncontrado =
        pontosAoVivo.find((ponto) => ponto.idPonto === pontoId) ||
        pontosAoVivo[0] ||
        null;
      if (!pontoEncontrado) return null;

      const dadosAtuais = dadosRegiaoRef.current;
      if (!dadosAtuais) return pontoEncontrado;

      const registrosAtualizados = dadosAtuais.records.map((registro) => {
        if (registro.pontoId !== pontoId && registro.clienteId !== clienteId) {
          return registro;
        }
        const statusPonto =
          pontosAoVivo.find((ponto) => ponto.idPonto === registro.pontoId) ||
          pontoEncontrado;
        const saude = classificarSaudeConexaoPonto({
          contratoAtivo: registro.isContractActive ? 's' : 'n',
          pontoAtivo: registro.isContractActive ? 's' : 'n',
          statusContrato: statusPonto.isBlocked ? 'bloqueado' : 'livre',
          bloqueadoFlag: statusPonto.isBlocked,
          sessaoConexaoStatus: statusPonto.conexaoStatus,
        });
        return {
          ...registro,
          sessaoConexaoStatus: statusPonto.conexaoStatus,
          connectionHealth: saude.connectionHealth,
          isOnline: saude.isOnline,
          isBlocked: saude.isBlocked,
          plano: statusPonto.planoNome || registro.plano,
          ipAlocado:
            statusPonto.ipWan || (saude.isOnline ? registro.ipAlocado : ''),
          ipv6Alocado:
            statusPonto.ipv6Wan || (saude.isOnline ? registro.ipv6Alocado : ''),
          ultimoLogin: statusPonto.ultimoLogin || registro.ultimoLogin,
          uploadMesKbytes: statusPonto.uploadMesKbytes,
          downloadMesKbytes: statusPonto.downloadMesKbytes,
        };
      });

      const registrosAtivos = registrosAtualizados.filter(
        (registro) => registro.isContractActive
      );
      const resumoRegiao = agregarResumosPorRegiao(registrosAtivos);
      const proximoSnapshot: ISPFYClientsByRegionResult = {
        records: registrosAtualizados,
        bairros: resumoRegiao.bairros,
        ruas: resumoRegiao.ruas,
        fetchedAt: new Date().toISOString(),
        totals: {
          ...resumoRegiao.totals,
          totalPontos: registrosAtualizados.length,
          inativos: registrosAtualizados.length - registrosAtivos.length,
        },
      };

      dadosRegiaoRef.current = proximoSnapshot;
      setDadosRegiao(proximoSnapshot);
      setUltimaAtualizacaoEm(new Date());

      return pontoEncontrado;
    },
    []
  );

  // Carga inicial única + polling global contínuo
  useEffect(() => {
    let componenteMontado = true;
    const inicializarMonitoramento = async () => {
      await atualizarConexoes(false);
      if (componenteMontado) {
        await atualizarInadimplencia(false);
      }
    };
    inicializarMonitoramento();

    return () => {
      componenteMontado = false;
    };
  }, [atualizarConexoes, atualizarInadimplencia]);

  useEffect(() => {
    if (!monitorAtivo) return;

    const temporizadorConexoes = window.setInterval(() => {
      atualizarConexoes(false);
    }, INTERVALO_CONSULTA_MS);

    const temporizadorInadimplencia = window.setInterval(() => {
      atualizarInadimplencia(false);
    }, INTERVALO_INADIMPLENCIA_MS);

    return () => {
      window.clearInterval(temporizadorConexoes);
      window.clearInterval(temporizadorInadimplencia);
    };
  }, [monitorAtivo, atualizarConexoes, atualizarInadimplencia]);

  const confirmarAlertas = useCallback(() => {
    setQuedasNaoLidas(0);
  }, []);

  const limparEventos = useCallback(() => {
    setEventosRecentes([]);
    setQuedasNaoLidas(0);
    try {
      sessionStorage.removeItem(CHAVE_EVENTOS_SESSAO);
    } catch {
      // Ignora erro
    }
  }, []);

  const alternarSom = useCallback(() => {
    setSomAtivo((anterior) => {
      const proximoEstado = !anterior;
      try {
        localStorage.setItem(CHAVE_PREF_SOM, String(proximoEstado));
      } catch {
        // Ignora erro
      }
      return proximoEstado;
    });
  }, []);

  const alternarMonitor = useCallback(() => {
    setMonitorAtivo((anterior) => {
      const proximoEstado = !anterior;
      try {
        localStorage.setItem(CHAVE_PREF_MONITOR, String(proximoEstado));
      } catch {
        // Ignora erro
      }
      return proximoEstado;
    });
  }, []);

  return (
    <ContextoMonitorRedeReact.Provider
      value={{
        dadosRegiao,
        dadosInadimplencia,
        carregandoRegiao,
        carregandoInadimplencia,
        verificandoAgora,
        erro,
        ultimaAtualizacaoEm,
        eventosRecentes,
        quedasNaoLidas,
        somAtivo,
        monitorAtivo,
        intervaloVerificacaoSeg: INTERVALO_CONSULTA_MS / 1000,
        permissaoNotificacao,
        solicitarPermissaoNotificacao,
        atualizarConexoes,
        atualizarInadimplencia,
        atualizarTudo,
        revalidarPontoAoVivo,
        confirmarAlertas,
        limparEventos,
        alternarSom,
        alternarMonitor,
        tocarSomAlertaQueda,
      }}
    >
      {children}
    </ContextoMonitorRedeReact.Provider>
  );
};

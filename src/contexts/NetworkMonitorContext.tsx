import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/config/firebase';
import { ispfyService } from '@/services/ispfy/ispfyService';
import { whapiService, DEFAULT_AVL_WHATSAPP_GROUPS } from '@/services/whapi/whapiService';
import {
  DEFAULT_OUTAGE_DETECTION_CONFIG,
  agregarResumosPorRegiao,
  classificarSaudeConexaoPonto,
  detectarRompimentosEmMassa,
  detectarTransicoesConexao,
} from '@/services/ispfy/regionAuditHelpers';
import type {
  ISPFYActiveRegionOutage,
  ISPFYClientsByRegionResult,
  ISPFYConnectionTransitionEvent,
  ISPFYLivePointStatus,
  ISPFYMassOutageAlert,
  ISPFYOutageDetectionConfig,
  ISPFYOutageWatchRecord,
  ISPFYOverdueAnalyticsResult,
} from '@/types/ispfy';

const INTERVALO_CONSULTA_MS = 45 * 1000;
const INTERVALO_INADIMPLENCIA_MS = 5 * 60 * 1000;
const CHAVE_PREF_SOM = 'avl_network_monitor_sound';
const CHAVE_PREF_MONITOR = 'avl_network_monitor_enabled';
const CHAVE_EVENTOS_SESSAO = 'avl_network_monitor_events_v1';
const MAX_EVENTOS_ARMAZENADOS = 60;
const FREQUENCIAS_BIP_ALERTA_NOC = [880, 587.33, 880];
const ID_GRUPO_EQUIPE_AVL = '120363040961050323-group';

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
  sireneAtiva: boolean;
  sireneSilenciada: boolean;
  monitorAtivo: boolean;
  intervaloVerificacaoSeg: number;
  permissaoNotificacao: NotificationPermission | 'unsupported';
  outageConfig: ISPFYOutageDetectionConfig;
  rompimentosEmMassa: ISPFYMassOutageAlert[];
  rompimentosConfirmados: ISPFYActiveRegionOutage[];
  outagesMonitorados: ISPFYOutageWatchRecord[];
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
  tocarSireneRompimento: (cycles?: number) => void;
  pararSirene: (silenciarIncidenteAtual?: boolean) => void;
  ativarAlertaRompimentoRegiao: (
    alerta: ISPFYMassOutageAlert,
    previsaoRetorno?: string
  ) => Promise<boolean>;
  resolverRompimentoRegiao: (outageId: string) => Promise<boolean>;
  enviarAlertaRompimentoGrupo: (alerta: ISPFYMassOutageAlert) => Promise<boolean>;
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
  const [rompimentosConfirmados, setRompimentosConfirmados] = useState<
    ISPFYActiveRegionOutage[]
  >([]);
  const [outagesMonitorados, setOutagesMonitorados] = useState<
    ISPFYOutageWatchRecord[]
  >([]);
  const [outageConfig, setOutageConfig] = useState<ISPFYOutageDetectionConfig>(
    DEFAULT_OUTAGE_DETECTION_CONFIG
  );
  const [sireneAtiva, setSireneAtiva] = useState<boolean>(false);
  const [sireneSilenciada, setSireneSilenciada] = useState<boolean>(false);
  const chavesAlertadasSessaoRef = useRef<Set<string>>(new Set());
  const sireneSilenciadaRef = useRef<boolean>(false);
  const sireneOscsRef = useRef<OscillatorNode[]>([]);
  const sireneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sireneLoopIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sincronizandoOutageRef = useRef<boolean>(false);
  const lastSyncedDigestRef = useRef<string>('');
  const qtdWatchesAtivosRef = useRef<number>(0);

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

  useEffect(() => {
    sireneSilenciadaRef.current = sireneSilenciada;
  }, [sireneSilenciada]);

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

  const pararNosOsciladoresSirene = useCallback(() => {
    if (sireneTimeoutRef.current) {
      clearTimeout(sireneTimeoutRef.current);
      sireneTimeoutRef.current = null;
    }
    sireneOscsRef.current.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // oscilador já encerrado
      }
    });
    sireneOscsRef.current = [];
  }, []);

  const pararSirene = useCallback(
    (silenciarIncidenteAtual = true) => {
      pararNosOsciladoresSirene();
      if (sireneLoopIntervalRef.current) {
        clearInterval(sireneLoopIntervalRef.current);
        sireneLoopIntervalRef.current = null;
      }
      setSireneAtiva(false);
      if (silenciarIncidenteAtual) {
        sireneSilenciadaRef.current = true;
        setSireneSilenciada(true);
      }
    },
    [pararNosOsciladoresSirene]
  );

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
        const duracao = 0.14;
        oscilador.frequency.setValueAtTime(frequencia, inicio);
        ganho.gain.setValueAtTime(0.001, inicio);
        ganho.gain.linearRampToValueAtTime(0.45, inicio + 0.015);
        ganho.gain.exponentialRampToValueAtTime(0.001, inicio + duracao);
        oscilador.start(inicio);
        oscilador.stop(inicio + duracao);
      });
    } catch (erroAudio) {
      console.warn('Não foi possível reproduzir alerta sonoro:', erroAudio);
    }
  }, []);

  /**
   * Sirene sonora alta e contínua de emergência NOC para possíveis rompimentos em massa.
   * Utiliza oscilador duplo (sawtooth + square) com compressor dinâmico para máxima clareza auditiva.
   */
  const tocarSireneRompimento = useCallback(
    (cycles = 3) => {
      try {
        const contextoAudio = obterOuCriarAudioContext(audioCtxRef);
        if (!contextoAudio) return;

        pararNosOsciladoresSirene();

        const qtdCiclos = Math.min(6, Math.max(1, cycles));
        const duracaoCicloSeg = 1.25;
        const duracaoTotalSeg = qtdCiclos * duracaoCicloSeg;
        const agora = contextoAudio.currentTime;

        const compressor = contextoAudio.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-16, agora);
        compressor.knee.setValueAtTime(6, agora);
        compressor.ratio.setValueAtTime(12, agora);
        compressor.attack.setValueAtTime(0.003, agora);
        compressor.release.setValueAtTime(0.15, agora);

        const masterGain = contextoAudio.createGain();
        masterGain.gain.setValueAtTime(0.001, agora);
        masterGain.gain.linearRampToValueAtTime(0.92, agora + 0.06);
        masterGain.gain.setValueAtTime(0.92, Math.max(agora + 0.08, agora + duracaoTotalSeg - 0.12));
        masterGain.gain.exponentialRampToValueAtTime(0.001, agora + duracaoTotalSeg);

        const oscPrincipal = contextoAudio.createOscillator();
        const oscHarmonica = contextoAudio.createOscillator();
        const subGain = contextoAudio.createGain();
        subGain.gain.setValueAtTime(0.42, agora);

        oscPrincipal.type = 'sawtooth';
        oscHarmonica.type = 'square';

        for (let c = 0; c < qtdCiclos; c++) {
          const t0 = agora + c * duracaoCicloSeg;
          const tMeio = t0 + duracaoCicloSeg * 0.52;
          const tFim = t0 + duracaoCicloSeg;

          oscPrincipal.frequency.setValueAtTime(620, t0);
          oscPrincipal.frequency.linearRampToValueAtTime(1380, tMeio);
          oscPrincipal.frequency.linearRampToValueAtTime(620, tFim);

          oscHarmonica.frequency.setValueAtTime(930, t0);
          oscHarmonica.frequency.linearRampToValueAtTime(690, tMeio);
          oscHarmonica.frequency.linearRampToValueAtTime(930, tFim);
        }

        oscPrincipal.connect(compressor);
        oscHarmonica.connect(subGain);
        subGain.connect(compressor);
        compressor.connect(masterGain);
        masterGain.connect(contextoAudio.destination);

        oscPrincipal.start(agora);
        oscHarmonica.start(agora);
        oscPrincipal.stop(agora + duracaoTotalSeg + 0.02);
        oscHarmonica.stop(agora + duracaoTotalSeg + 0.02);

        sireneOscsRef.current = [oscPrincipal, oscHarmonica];
        setSireneAtiva(true);

        sireneTimeoutRef.current = setTimeout(() => {
          sireneOscsRef.current = [];
          sireneTimeoutRef.current = null;
          setSireneAtiva(false);
        }, duracaoTotalSeg * 1000 + 80);
      } catch (erroAudio) {
        console.warn('Não foi possível reproduzir sirene NOC:', erroAudio);
      }
    },
    [pararNosOsciladoresSirene]
  );

  useEffect(() => {
    if (!somAtivo) {
      pararSirene(false);
    }
  }, [somAtivo, pararSirene]);

  useEffect(() => {
    return () => {
      pararNosOsciladoresSirene();
      if (sireneLoopIntervalRef.current) {
        clearInterval(sireneLoopIntervalRef.current);
        sireneLoopIntervalRef.current = null;
      }
    };
  }, [pararNosOsciladoresSirene]);

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

  // Sincroniza incidentes de rompimento regional confirmados no Firestore (`active_region_outages`)
  useEffect(() => {
    const q = query(
      collection(db, 'active_region_outages'),
      where('ativa', '==', true)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: ISPFYActiveRegionOutage[] = snap.docs.map((d) => {
          const raw = d.data() || {};
          const bairros = Array.isArray(raw.bairros)
            ? raw.bairros.map(String)
            : raw.bairro
            ? [String(raw.bairro)]
            : [];
          return {
            id: d.id,
            ativo: raw.ativa !== false && raw.ativo !== false,
            bairros,
            cidade: raw.cidade ? String(raw.cidade) : null,
            titulo: String(raw.titulo || raw.motivo || 'Manutenção Regional'),
            mensagem: String(
              raw.mensagem || raw.motivo || 'Equipe técnica em atuação na região.'
            ),
            previsaoRetorno: raw.previsao || raw.previsaoRetorno || null,
            updatedAt: raw.updatedAt,
          };
        });
        setRompimentosConfirmados(list);
      },
      () => {
        // Permissão ou ausência inicial não-bloqueante
      }
    );
    return () => unsub();
  }, []);

  // Sincroniza critérios anti-falso-positivo configurados em settings/ispfy_automations
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', 'ispfy_automations'),
      (snap) => {
        if (!snap.exists()) return;
        const raw = (snap.data()?.outageConfig || {}) as Partial<ISPFYOutageDetectionConfig>;
        setOutageConfig({
          ...DEFAULT_OUTAGE_DETECTION_CONFIG,
          ...raw,
        });
      },
      () => {
        // fallback silencioso para critérios padrão
      }
    );
    return () => unsub();
  }, []);

  const rompimentosEmMassa = useMemo(
    () => (dadosRegiao ? detectarRompimentosEmMassa(dadosRegiao.records, outageConfig) : []),
    [dadosRegiao, outageConfig]
  );

  // Escuta incidentes em observação (> 5 min para envio automático ao grupo EQUIPE AVL)
  useEffect(() => {
    const q = query(
      collection(db, 'outage_watch'),
      where('active', '==', true)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: ISPFYOutageWatchRecord[] = snap.docs.map((d) => {
          const data = d.data() as Omit<ISPFYOutageWatchRecord, 'incidentKey'>;
          return {
            ...data,
            incidentKey: d.id,
          };
        });
        qtdWatchesAtivosRef.current = list.length;
        setOutagesMonitorados(list);
      },
      (err) => {
        console.warn('Listener outage_watch indisponível:', err.message);
      }
    );
    return () => unsub();
  }, []);

  // Reporta snapshot atual de rompimentos ao backend apenas 1x por ciclo de atualização
  const fetchedAtSnapshot = dadosRegiao?.fetchedAt || '';
  useEffect(() => {
    if (!fetchedAtSnapshot) return;
    if (rompimentosEmMassa.length === 0 && qtdWatchesAtivosRef.current === 0) return;

    const digest = `${fetchedAtSnapshot}|${rompimentosEmMassa
      .map((r) => `${r.incidentKey}:${r.desconectados}:${r.ruaPrincipal?.desconectados ?? 0}`)
      .join(',')}`;
    if (lastSyncedDigestRef.current === digest || sincronizandoOutageRef.current) {
      return;
    }

    lastSyncedDigestRef.current = digest;
    sincronizandoOutageRef.current = true;
    const callable = httpsCallable<
      {
        fullScan: boolean;
        source: string;
        observedAlerts: ISPFYMassOutageAlert[];
      },
      { whatsappSentKeys?: string[] }
    >(functions, 'syncMassOutageWatch');

    callable({
      fullScan: true,
      source: 'frontend_poll',
      observedAlerts: rompimentosEmMassa,
    })
      .then((res) => {
        const enviados = res.data?.whatsappSentKeys || [];
        if (enviados.length > 0) {
          toast.success(
            `📲 Alerta automático enviado para o grupo EQUIPE AVL (${enviados.length} rompimento(s) > 5 min)`
          );
        }
      })
      .catch((err) => {
        lastSyncedDigestRef.current = '';
        console.warn('Falha ao sincronizar outage_watch:', err);
      })
      .finally(() => {
        sincronizandoOutageRef.current = false;
      });
  }, [fetchedAtSnapshot, rompimentosEmMassa]);

  // Agenda rechecagem ao vivo exatamente quando o primeiro incidente completar 5 minutos contínuos
  useEffect(() => {
    const pendentes = outagesMonitorados.filter(
      (w) => w.active && !w.whatsappSentAtMs && w.firstDetectedAtMs > 0
    );
    if (pendentes.length === 0) return;

    const earliestStart = Math.min(...pendentes.map((w) => w.firstDetectedAtMs));
    const alvoMs = earliestStart + 5 * 60 * 1000 + 2000;
    const delayMs = alvoMs - Date.now();
    if (delayMs <= 0 || delayMs > 6 * 60 * 1000) return;

    const timer = setTimeout(() => {
      atualizarConexoes(true);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [outagesMonitorados, atualizarConexoes]);

  // Toast NOC automático + Sirene sonora alta ao detectar rompimento de rua/bairro
  useEffect(() => {
    if (rompimentosEmMassa.length === 0) {
      chavesAlertadasSessaoRef.current.clear();
      sireneSilenciadaRef.current = false;
      setSireneSilenciada(false);
      pararSirene(false);
      return;
    }

    let detectouNovoRompimento = false;
    for (const alerta of rompimentosEmMassa) {
      if (!chavesAlertadasSessaoRef.current.has(alerta.incidentKey)) {
        chavesAlertadasSessaoRef.current.add(alerta.incidentKey);
        detectouNovoRompimento = true;
        if (dadosRegiaoRef.current) {
          const rp = alerta.ruaPrincipal;
          const tituloToast =
            alerta.tipoAlerta === 'rua_e_bairro' && rp
              ? `🚨 Rompimento: ${rp.ruaLabel} — ${alerta.bairroLabel}`
              : `🚨 Possível Rompimento em Massa: ${alerta.bairroLabel}`;
          const descToast =
            rp && alerta.tipoAlerta === 'rua_e_bairro'
              ? `Rua: ${rp.desconectados}/${rp.totalAtivos} off (${rp.percentualOffline}%) • Bairro: ${alerta.desconectados}/${alerta.totalAtivosNoBairro} off (${alerta.percentualOffline}%)`
              : `${alerta.desconectados}/${alerta.totalAtivosNoBairro} clientes offline (${alerta.percentualOffline}%). Ruas: ${alerta.ruasAfetadas
                  .slice(0, 2)
                  .map((r) => r.ruaLabel)
                  .join(', ')}`;

          toast.error(tituloToast, {
            description: descToast,
            duration: 15000,
            action: {
              label: 'Ver Região',
              onClick: () =>
                navegarRef.current(
                  `/ispfy/regiao?status=DESCONECTADO&bairro=${encodeURIComponent(
                    alerta.bairroKey
                  )}`
                ),
            },
          });

          if (
            typeof window !== 'undefined' &&
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            try {
              new Notification(tituloToast, {
                body: descToast,
                tag: `avl-rompimento-${alerta.incidentKey}`,
              });
            } catch {
              // navegador bloqueou notificação em segundo plano
            }
          }
        }
      }
    }

    if (detectouNovoRompimento) {
      sireneSilenciadaRef.current = false;
      setSireneSilenciada(false);
      if (somAtivoRef.current) {
        tocarSireneRompimento(3);
      }
    }
  }, [rompimentosEmMassa, pararSirene, tocarSireneRompimento]);

  // Repete pulsos da sirene a cada 18s enquanto o rompimento estiver ativo e não silenciado
  useEffect(() => {
    if (sireneLoopIntervalRef.current) {
      clearInterval(sireneLoopIntervalRef.current);
      sireneLoopIntervalRef.current = null;
    }

    if (rompimentosEmMassa.length === 0 || !somAtivo || sireneSilenciada) {
      return;
    }

    sireneLoopIntervalRef.current = setInterval(() => {
      if (somAtivoRef.current && !sireneSilenciadaRef.current) {
        tocarSireneRompimento(2);
      }
    }, 18000);

    return () => {
      if (sireneLoopIntervalRef.current) {
        clearInterval(sireneLoopIntervalRef.current);
        sireneLoopIntervalRef.current = null;
      }
    };
  }, [rompimentosEmMassa.length, somAtivo, sireneSilenciada, tocarSireneRompimento]);

  const ativarAlertaRompimentoRegiao = useCallback(
    async (alerta: ISPFYMassOutageAlert, previsaoRetorno?: string) => {
      try {
        const callable = httpsCallable(functions, 'ispfyToolActions');
        const topRuas = alerta.ruasAfetadas
          .slice(0, 3)
          .map((r) => r.ruaLabel)
          .join(', ');
        await callable({
          action: 'set_region_outage',
          bairros: [alerta.bairroLabel],
          titulo: `Instabilidade / Rompimento de Fibra em ${alerta.bairroLabel}`,
          mensagem: `Detectamos uma interrupção de sinal na região de ${alerta.bairroLabel}${
            topRuas ? ` (${topRuas})` : ''
          }. Nossa equipe técnica já está mobilizada no local.`,
          previsaoRetorno: previsaoRetorno || 'Em verificação em campo',
          clientesAfetados: alerta.desconectados,
        });
        toast.success(
          `Aviso automático no WhatsApp/Josué ativado para ${alerta.bairroLabel}!`
        );
        return true;
      } catch (err: unknown) {
        toast.error(
          err instanceof Error ? err.message : 'Erro ao registrar rompimento no Firestore.'
        );
        return false;
      }
    },
    []
  );

  const resolverRompimentoRegiao = useCallback(async (outageId: string) => {
    try {
      const callable = httpsCallable(functions, 'ispfyToolActions');
      await callable({
        action: 'set_region_outage',
        id: outageId,
        resolve: true,
      });
      toast.success('Incidente regional marcado como normalizado!');
      return true;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao encerrar incidente regional.');
      return false;
    }
  }, []);

  const enviarAlertaRompimentoGrupo = useCallback(
    async (alerta: ISPFYMassOutageAlert) => {
      try {
        const callable = httpsCallable<
          {
            fullScan: boolean;
            source: string;
            observedAlerts: ISPFYMassOutageAlert[];
            forceSendIncidentKey: string;
          },
          { whatsappSentKeys?: string[] }
        >(functions, 'syncMassOutageWatch');
        const callRes = await callable({
          fullScan: false,
          source: 'manual_button',
          observedAlerts: [alerta],
          forceSendIncidentKey: alerta.incidentKey,
        });

        if (callRes.data?.whatsappSentKeys?.includes(alerta.incidentKey)) {
          toast.success('Alerta enviado para o grupo EQUIPE AVL!');
          return true;
        }
      } catch (cloudErr) {
        console.warn('Fallback Z-API direto após erro na função:', cloudErr);
      }

      try {
        const equipeAvlGroup =
          DEFAULT_AVL_WHATSAPP_GROUPS.find((g) => g.phone === ID_GRUPO_EQUIPE_AVL) ||
          DEFAULT_AVL_WHATSAPP_GROUPS[1] ||
          DEFAULT_AVL_WHATSAPP_GROUPS[0];
        const rp = alerta.ruaPrincipal;
        const ruasTxt = alerta.ruasAfetadas
          .slice(0, 5)
          .map(
            (r) =>
              `• ${r.ruaLabel}: *${r.desconectados}* off de ${r.totalAtivos} (*${r.percentualOffline}%*)`
          )
          .join('\n');
        const msg =
          `🚨 *ALERTA NOC AVL — POSSÍVEL ROMPIMENTO*\n\n` +
          `📍 *Bairro:* ${alerta.bairroLabel}\n` +
          (rp
            ? `🛣️ *Rua:* ${rp.ruaLabel}\n` +
              `👥 *Na Rua:* *${rp.desconectados}* offline de *${rp.totalAtivos}* clientes (*${rp.percentualOffline}%*)\n`
            : '') +
          `🏘️ *No Bairro (${alerta.bairroLabel}):* *${alerta.desconectados}* offline de *${alerta.totalAtivosNoBairro}* clientes (*${alerta.percentualOffline}%*)\n` +
          (ruasTxt ? `\n📌 *Detalhamento por rua:*\n${ruasTxt}\n` : '') +
          `\n⚠️ _Verificar CTO / splitter / fibra óptica da região com prioridade!_`;

        const res = await whapiService.sendGroupMessage(equipeAvlGroup.phone, msg);
        if (res.sent) {
          toast.success(`Alerta enviado para ${equipeAvlGroup.name.trim()}!`);
          return true;
        }
        toast.error(res.error || 'Falha ao enviar alerta para o grupo EQUIPE AVL.');
        return false;
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Erro ao enviar alerta ao WhatsApp.');
        return false;
      }
    },
    []
  );

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
        sireneAtiva,
        sireneSilenciada,
        monitorAtivo,
        intervaloVerificacaoSeg: INTERVALO_CONSULTA_MS / 1000,
        permissaoNotificacao,
        outageConfig,
        rompimentosEmMassa,
        rompimentosConfirmados,
        outagesMonitorados,
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
        tocarSireneRompimento,
        pararSirene,
        ativarAlertaRompimentoRegiao,
        resolverRompimentoRegiao,
        enviarAlertaRompimentoGrupo,
      }}
    >
      {children}
    </ContextoMonitorRedeReact.Provider>
  );
};

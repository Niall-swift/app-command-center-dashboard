import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Loader2,
  User,
  Phone,
  MapPin,
  Ticket,
  CheckCircle2,
  AlertCircle,
  Send,
  X,
  Navigation,
  Copy,
  ClipboardList,
  ChevronRight,
  Radio,
  Wifi,
  WifiOff,
  Zap,
  Wrench,
  HelpCircle,
  Cable,
  Monitor,
  RotateCcw,
  Edit3,
  Sliders,
  Check,
  Key,
  CheckCheck,
  PlusCircle,
  Calendar,
  Pin,
  PinOff,
  RefreshCw,
  Eye,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import PageTransition from '@/components/PageTransition';
import { IconeWhatsApp } from '@/components/icons/IconeWhatsApp';
import { DailyOSModal } from '@/components/ispfy/DailyOSModal';
import { useDailyOS } from '@/hooks/useDailyOS';
import { usePinnedOsGroup } from '@/hooks/usePinnedOsGroup';
import { ispfyService } from '@/services/ispfy/ispfyService';
import { whapiService, DEFAULT_AVL_WHATSAPP_GROUPS } from '@/services/whapi/whapiService';
import type {
  ISPFYClienteData,
  ISPFYLoginData,
  ISPFYContratoData,
  ISPFYPlanoData,
} from '@/types/ispfy';
import type { WhapiGroup } from '@/types/whapi';
import {
  ROTULOS_PRIORIDADE_OS,
  buscarClientesISPFYHibrido,
  gerarLinksMapaCliente,
  isRegistroAtivo,
  montarEnderecoISPFY,
  obterNomeClienteISPFY,
  obterTelefoneClienteISPFY,
  selecionarGrupoWhatsAppPadrao,
} from '@/utils/ispfyFormatters';

const OPCOES_PROBLEMAS = [
  { id: 'instalacao', label: 'Nova Instalação', icon: PlusCircle, cor: 'emerald' },
  { id: 'sem_sinal', label: 'Sem Sinal / Internet', icon: WifiOff, cor: 'red' },
  { id: 'lentidao', label: 'Lentidão / Velocidade', icon: Zap, cor: 'orange' },
  { id: 'intermitencia', label: 'Conexão Intermitente', icon: Radio, cor: 'yellow' },
  { id: 'sem_wifi', label: 'Wi-Fi com Problema', icon: Wifi, cor: 'blue' },
  { id: 'roteador', label: 'Problema no Roteador', icon: Monitor, cor: 'purple' },
  { id: 'cabo', label: 'Cabo Danificado / Solto', icon: Cable, cor: 'pink' },
  { id: 'tecnica', label: 'Visita Técnica', icon: Wrench, cor: 'green' },
  { id: 'reinstalacao', label: 'Mudança / Reinstalação', icon: RotateCcw, cor: 'teal' },
  { id: 'outro', label: 'Outro Problema', icon: HelpCircle, cor: 'gray' },
];

const MAPA_CORES_PROBLEMAS: Record<
  string,
  { chip: string; chipSelecionado: string; iconColor: string }
> = {
  emerald: {
    chip: 'border-border/70 bg-background/60 text-foreground hover:border-emerald-500/40 hover:bg-emerald-500/[0.06]',
    chipSelecionado:
      'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/25',
    iconColor: 'text-emerald-500',
  },
  red: {
    chip: 'border-border/70 bg-background/60 text-foreground hover:border-red-500/40 hover:bg-red-500/[0.06]',
    chipSelecionado:
      'border-red-500 bg-red-500/15 text-red-700 dark:text-red-300 ring-1 ring-red-500/25',
    iconColor: 'text-red-500',
  },
  orange: {
    chip: 'border-border/70 bg-background/60 text-foreground hover:border-orange-500/40 hover:bg-orange-500/[0.06]',
    chipSelecionado:
      'border-orange-500 bg-orange-500/15 text-orange-700 dark:text-orange-300 ring-1 ring-orange-500/25',
    iconColor: 'text-orange-500',
  },
  yellow: {
    chip: 'border-border/70 bg-background/60 text-foreground hover:border-amber-500/40 hover:bg-amber-500/[0.06]',
    chipSelecionado:
      'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/25',
    iconColor: 'text-amber-500',
  },
  blue: {
    chip: 'border-border/70 bg-background/60 text-foreground hover:border-blue-500/40 hover:bg-blue-500/[0.06]',
    chipSelecionado:
      'border-blue-500 bg-blue-500/15 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/25',
    iconColor: 'text-blue-500',
  },
  purple: {
    chip: 'border-border/70 bg-background/60 text-foreground hover:border-purple-500/40 hover:bg-purple-500/[0.06]',
    chipSelecionado:
      'border-purple-500 bg-purple-500/15 text-purple-700 dark:text-purple-300 ring-1 ring-purple-500/25',
    iconColor: 'text-purple-500',
  },
  pink: {
    chip: 'border-border/70 bg-background/60 text-foreground hover:border-pink-500/40 hover:bg-pink-500/[0.06]',
    chipSelecionado:
      'border-pink-500 bg-pink-500/15 text-pink-700 dark:text-pink-300 ring-1 ring-pink-500/25',
    iconColor: 'text-pink-500',
  },
  green: {
    chip: 'border-border/70 bg-background/60 text-foreground hover:border-emerald-500/40 hover:bg-emerald-500/[0.06]',
    chipSelecionado:
      'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/25',
    iconColor: 'text-emerald-500',
  },
  teal: {
    chip: 'border-border/70 bg-background/60 text-foreground hover:border-teal-500/40 hover:bg-teal-500/[0.06]',
    chipSelecionado:
      'border-teal-500 bg-teal-500/15 text-teal-700 dark:text-teal-300 ring-1 ring-teal-500/25',
    iconColor: 'text-teal-500',
  },
  gray: {
    chip: 'border-border/70 bg-background/60 text-foreground hover:border-primary/40 hover:bg-secondary/70',
    chipSelecionado:
      'border-primary bg-primary/12 text-foreground ring-1 ring-primary/25',
    iconColor: 'text-muted-foreground',
  },
};

const PRIORIDADE_DOT: Record<string, string> = {
  B: 'bg-sky-500',
  N: 'bg-emerald-500',
  A: 'bg-amber-500',
  C: 'bg-rose-500',
};

// ─── Modelo Padrão da O.S. & Variáveis Dinâmicas ──────────────────────────────
export const DEFAULT_OS_TEMPLATE =
`🛠 *O.S. #{numero_diario} – Ordem de Serviço* (ISPFY #{numero_os})
👤 *Cliente:* {cliente}
📞 *Contato:* {telefone}
📶 *Plano:* {plano}
{logins}
{wifi}
{problemas}
📌 *Assunto:* {assunto}
⚡ *Prioridade:* {prioridade}
{endereco}
{referencia}
{observacao}
{mapa}`;

const CHAVE_STORAGE_TEMPLATE = 'avl_os_template_structure_v2';

const VARIAVEIS_TEMPLATE_OS = [
  { tag: '{numero_diario}', rotulo: 'Nº O.S. do Dia', desc: 'Ex: #01, #02 (Reinicia todo dia às 00:00)' },
  { tag: '{numero_os}', rotulo: 'ID ISPFY', desc: 'Ex: #12345 (ID oficial no sistema)' },
  { tag: '{data_hoje}', rotulo: 'Data Atual', desc: 'Ex: 15/10/2026' },
  { tag: '{cliente}', rotulo: 'Cliente', desc: 'Nome completo' },
  { tag: '{telefone}', rotulo: 'Telefone', desc: 'Contato / Celular' },
  { tag: '{plano}', rotulo: 'Plano', desc: 'Plano de Internet' },
  { tag: '{logins}', rotulo: 'PPPoE (Login/Senha)', desc: 'Credenciais completas' },
  { tag: '{pppoe}', rotulo: 'Usuário PPPoE', desc: 'Apenas login' },
  { tag: '{senha}', rotulo: 'Senha PPPoE', desc: 'Apenas senha' },
  { tag: '{wifi}', rotulo: 'Wi-Fi (Nome/Senha)', desc: 'Dados da rede Wi-Fi definidos' },
  { tag: '{wifi_nome}', rotulo: 'Nome do Wi-Fi (SSID)', desc: 'Nome da rede Wi-Fi' },
  { tag: '{wifi_senha}', rotulo: 'Senha do Wi-Fi', desc: 'Senha da rede Wi-Fi' },
  { tag: '{problemas}', rotulo: 'Problemas', desc: 'Lista de problemas selecionados' },
  { tag: '{assunto}', rotulo: 'Assunto', desc: 'Assunto do chamado' },
  { tag: '{prioridade}', rotulo: 'Prioridade', desc: 'Baixa, Normal, Alta, Crítica' },
  { tag: '{endereco}', rotulo: 'Endereço', desc: 'Endereço completo' },
  { tag: '{referencia}', rotulo: 'Ponto Ref.', desc: 'Ponto de referência' },
  { tag: '{observacao}', rotulo: 'Observação', desc: 'Observação adicional' },
  { tag: '{mapa}', rotulo: 'Link do Mapa', desc: 'Link direto do Google Maps' },
];

const ISPFYNovaOS: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const clienteIdParam = searchParams.get('clienteId')?.trim() || '';
  const buscaParam = searchParams.get('busca')?.trim() || '';
  const statePreselectedClient =
    (location.state as { preselectedClient?: ISPFYClienteData } | null)?.preselectedClient ?? null;

  // Busca de clientes e vínculo de plano/logins
  const [termoBusca, setTermoBusca] = useState('');
  const [todosClientes, setTodosClientes] = useState<ISPFYClienteData[]>([]);
  const [resultadosBusca, setResultadosBusca] = useState<ISPFYClienteData[]>([]);
  const [carregandoBusca, setCarregandoBusca] = useState(false);
  const [carregandoClientePreselecionado, setCarregandoClientePreselecionado] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState<ISPFYClienteData | null>(null);
  const [loginsCliente, setLoginsCliente] = useState<ISPFYLoginData[]>([]);
  const [contratosCliente, setContratosCliente] = useState<ISPFYContratoData[]>([]);
  const [planoCliente, setPlanoCliente] = useState('');
  const [todosPlanos, setTodosPlanos] = useState<ISPFYPlanoData[]>([]);
  const [carregandoPlano, setCarregandoPlano] = useState(false);
  const [editandoPlano, setEditandoPlano] = useState(false);
  const timerBuscaRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clienteSelecionadoRef = useRef<ISPFYClienteData | null>(null);
  const temPreselecaoInicialRef = useRef<boolean>(
    Boolean(clienteIdParam || statePreselectedClient?.id || buscaParam)
  );
  const preloadedKeyRef = useRef<string | null>(null);
  const preloadedBuscaRef = useRef<string | null>(null);
  const grupoCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    clienteSelecionadoRef.current = clienteSelecionado;
  }, [clienteSelecionado]);

  // Formulário da O.S.
  const [assuntos, setAssuntos] = useState<{ id: string; assunto: string }[]>([]);
  const [carregandoAssuntos, setCarregandoAssuntos] = useState(false);
  const [assuntoSelecionado, setAssuntoSelecionado] = useState('');
  const [nomeAssunto, setNomeAssunto] = useState('');
  const [problemasSelecionados, setProblemasSelecionados] = useState<string[]>([]);
  const [prioridade, setPrioridade] = useState('N');
  const [observacao, setObservacao] = useState('');
  const [pontoReferencia, setPontoReferencia] = useState('');
  const [nomeRedeWifi, setNomeRedeWifi] = useState('');
  const [senhaWifi, setSenhaWifi] = useState('');

  // Estado da criação e modal de acompanhamento diário
  const [criandoOS, setCriandoOS] = useState(false);
  const [osCriada, setOsCriada] = useState(false);
  const [idChamadoCriado, setIdChamadoCriado] = useState('');
  const [numeroDiarioCriado, setNumeroDiarioCriado] = useState<string | null>(null);
  const [modalOrdensDoDiaAberto, setModalOrdensDoDiaAberto] = useState(false);

  // ─── Contagem e Rastreamento Diário de O.S. (Reinicia a cada dia) ──────────
  const {
    count: contagemDiaria,
    formattedNextDailyNumber: proximoNumeroDiarioFormatado,
    orders: ordensDoDia,
    formattedDate: dataFormatada,
    registerOS: registrarOS,
  } = useDailyOS();

  // ─── Grupo WhatsApp Fixo (persistido no Firestore + localStorage) ─────────
  const {
    pinnedGroupPhone,
    pinnedGroupName,
    autoSendToGroup,
    savingPinnedGroup,
    pinGroup,
    clearPinnedGroup,
    setAutoSendToGroup,
  } = usePinnedOsGroup();

  const [gruposWhatsApp, setGruposWhatsApp] = useState<WhapiGroup[]>(DEFAULT_AVL_WHATSAPP_GROUPS);
  const [carregandoGrupos, setCarregandoGrupos] = useState(false);
  const [grupoSelecionadoPhone, setGrupoSelecionadoPhone] = useState<string>(
    () => pinnedGroupPhone || '120363426874994471-group'
  );
  const [enviarGrupoAoCriar, setEnviarGrupoAoCriar] = useState<boolean>(autoSendToGroup);
  const [enviandoParaGrupo, setEnviandoParaGrupo] = useState(false);
  const [grupoEnviadoComSucesso, setGrupoEnviadoComSucesso] = useState<string | null>(null);
  const grupoAlteradoManualRef = useRef(false);

  const gruposDisponiveis = useMemo(() => {
    if (!pinnedGroupPhone) return gruposWhatsApp;
    const exists = gruposWhatsApp.some((g) => g.phone === pinnedGroupPhone);
    if (exists) return gruposWhatsApp;
    return [
      { phone: pinnedGroupPhone, name: pinnedGroupName || 'Grupo fixo salvo' },
      ...gruposWhatsApp,
    ];
  }, [gruposWhatsApp, pinnedGroupPhone, pinnedGroupName]);

  const grupoAtualSelecionado = useMemo(
    () => gruposDisponiveis.find((g) => g.phone === grupoSelecionadoPhone) || null,
    [gruposDisponiveis, grupoSelecionadoPhone]
  );

  const isGrupoAtualFixo = Boolean(
    pinnedGroupPhone && grupoSelecionadoPhone === pinnedGroupPhone
  );

  useEffect(() => {
    setEnviarGrupoAoCriar(autoSendToGroup);
  }, [autoSendToGroup]);

  useEffect(() => {
    if (pinnedGroupPhone && !grupoAlteradoManualRef.current) {
      setGrupoSelecionadoPhone(pinnedGroupPhone);
    }
  }, [pinnedGroupPhone]);

  // Customização da Estrutura / Template da O.S.
  const [modeloOS, setModeloOS] = useState<string>(
    () => localStorage.getItem(CHAVE_STORAGE_TEMPLATE) || DEFAULT_OS_TEMPLATE
  );
  const [modalModeloAberto, setModalModeloAberto] = useState(false);
  const [textoTemporarioModelo, setTextoTemporarioModelo] = useState(modeloOS);
  const campoModeloRef = useRef<HTMLTextAreaElement | null>(null);

  // Edição Manual Direta do Texto da O.S.
  const [textoManualOS, setTextoManualOS] = useState<string | null>(null);
  const [editandoMensagemAoVivo, setEditandoMensagemAoVivo] = useState(false);

  // Endereço e Links de Localização do cliente selecionado
  const enderecoCliente = clienteSelecionado ? montarEnderecoISPFY(clienteSelecionado) : '';
  const linksMapa = clienteSelecionado
    ? gerarLinksMapaCliente(clienteSelecionado)
    : { urlDireta: '', urlIncorporada: '' };

  const carregarGruposWhatsApp = useCallback(
    async (silencioso = true) => {
      setCarregandoGrupos(true);
      try {
        const grupos = await whapiService.getGroups();
        if (!grupos || grupos.length === 0) return;
        setGruposWhatsApp(grupos);
        if (!pinnedGroupPhone && !grupoAlteradoManualRef.current) {
          const padrao = selecionarGrupoWhatsAppPadrao(grupos);
          if (padrao) {
            setGrupoSelecionadoPhone((atual) => atual || padrao.phone);
          }
        }
        if (!silencioso) {
          toast.success(`${grupos.length} grupos carregados do WhatsApp.`);
        }
      } catch (erro) {
        console.error('Erro ao buscar grupos do WhatsApp:', erro);
        if (!silencioso) {
          toast.error('Não foi possível atualizar os grupos do WhatsApp.');
        }
      } finally {
        setCarregandoGrupos(false);
      }
    },
    [pinnedGroupPhone]
  );

  useEffect(() => {
    void carregarGruposWhatsApp(true);
  }, [carregarGruposWhatsApp]);

  useEffect(() => {
    setCarregandoAssuntos(true);
    ispfyService
      .getTicketSubjects()
      .then(setAssuntos)
      .catch(() => toast.error('Erro ao carregar assuntos'))
      .finally(() => setCarregandoAssuntos(false));

    ispfyService
      .getPlanosAtivos()
      .then((planos) => {
        if (planos && planos.length > 0) setTodosPlanos(planos);
      })
      .catch((erro) => console.error('Erro ao carregar planos:', erro));
  }, []);

  const carregarClientesIniciais = useCallback(async () => {
    setCarregandoBusca(true);
    try {
      const resposta = await ispfyService.getClientesAtivos();
      setTodosClientes(resposta);
      if (!clienteSelecionadoRef.current && !temPreselecaoInicialRef.current) {
        setResultadosBusca(resposta);
      }
    } catch {
      setTodosClientes([]);
      if (!clienteSelecionadoRef.current && !temPreselecaoInicialRef.current) {
        setResultadosBusca([]);
      }
    } finally {
      setCarregandoBusca(false);
    }
  }, []);

  useEffect(() => {
    carregarClientesIniciais();
  }, [carregarClientesIniciais]);

  useEffect(() => {
    return () => {
      if (timerBuscaRef.current) clearTimeout(timerBuscaRef.current);
    };
  }, []);

  // ─── Busca híbrida (Memória + Servidor) ─────────────────────────────────────
  const aoAlterarBusca = useCallback(
    (valor: string) => {
      setTermoBusca(valor);
      if (timerBuscaRef.current) clearTimeout(timerBuscaRef.current);

      if (!valor.trim()) {
        setResultadosBusca(todosClientes);
        return;
      }

      timerBuscaRef.current = setTimeout(async () => {
        setCarregandoBusca(true);
        try {
          const resultados = await buscarClientesISPFYHibrido(valor, todosClientes, ispfyService);
          setResultadosBusca(resultados);
        } catch {
          setResultadosBusca([]);
        } finally {
          setCarregandoBusca(false);
        }
      }, 300);
    },
    [todosClientes]
  );

  // ─── Seleção de Cliente e Detecção do Plano ────────────────────────────────
  const aoSelecionarCliente = useCallback(async (cliente: ISPFYClienteData) => {
    const clienteBase: ISPFYClienteData = { ...cliente };
    clienteSelecionadoRef.current = clienteBase;
    setClienteSelecionado(clienteBase);
    setResultadosBusca([]);
    setTermoBusca(obterNomeClienteISPFY(clienteBase));
    setPontoReferencia(clienteBase.endereco_cobranca_complemento || '');
    setTextoManualOS(null);

    if (!clienteBase.id) {
      setLoginsCliente([]);
      setContratosCliente([]);
      setPlanoCliente('');
      setCarregandoPlano(false);
      return;
    }

    setCarregandoPlano(true);
    try {
      const contatos = await ispfyService.getClienteContatos(clienteBase.id);
      if (contatos && contatos.length > 0) {
        const foneCelular =
          contatos.find((ct) => ct.tipo_contato === 'c')?.contato || contatos[0].contato;
        const foneWhatsapp = contatos.find((ct) => ct.pode_enviar_mensagem === 's')?.contato;
        const clienteEnriquecido: ISPFYClienteData = {
          ...clienteBase,
          fone_celular: foneCelular || clienteBase.fone_celular,
          fone_whatsapp: foneWhatsapp || clienteBase.fone_whatsapp,
        };
        setClienteSelecionado((atual) =>
          atual && String(atual.id) === String(clienteBase.id) ? clienteEnriquecido : atual
        );
      }
    } catch (erro) {
      console.error('Erro ao buscar contatos:', erro);
    }

    try {
      const detalhes = await ispfyService.getClientPlanDetails(clienteBase.id);
      if (String(clienteSelecionadoRef.current?.id || '') !== String(clienteBase.id)) {
        return;
      }
      setContratosCliente(detalhes.contratos);
      setLoginsCliente(detalhes.logins);
      setPlanoCliente(detalhes.planName);
      if (detalhes.allPlanos && detalhes.allPlanos.length > 0) {
        setTodosPlanos(detalhes.allPlanos);
      }
    } catch (erro) {
      console.error('Erro ao resolver plano e detalhes do cliente:', erro);
      if (String(clienteSelecionadoRef.current?.id || '') === String(clienteBase.id)) {
        setContratosCliente([]);
        setLoginsCliente([]);
        setPlanoCliente('');
      }
    } finally {
      if (String(clienteSelecionadoRef.current?.id || '') === String(clienteBase.id)) {
        setCarregandoPlano(false);
      }
    }
  }, []);

  // ─── Pré-seleção automática via ?clienteId= ou state vindo do Chat / Inteligência ───
  useEffect(() => {
    const targetId =
      clienteIdParam || (statePreselectedClient?.id ? String(statePreselectedClient.id) : '');
    if (!targetId) return;
    if (preloadedKeyRef.current === targetId) return;

    preloadedKeyRef.current = targetId;
    temPreselecaoInicialRef.current = true;

    if (statePreselectedClient?.id && String(statePreselectedClient.id) === targetId) {
      void aoSelecionarCliente(statePreselectedClient);
      return;
    }

    let cancelado = false;
    setCarregandoClientePreselecionado(true);
    ispfyService
      .getClienteById(targetId)
      .then((clienteEncontrado) => {
        if (cancelado) return;
        if (clienteEncontrado) {
          void aoSelecionarCliente(clienteEncontrado);
        } else {
          temPreselecaoInicialRef.current = false;
          toast.warning(`Cliente #${targetId} não encontrado no ISPFY.`);
        }
      })
      .catch(() => {
        if (!cancelado) {
          temPreselecaoInicialRef.current = false;
          toast.error('Não foi possível carregar o cliente pré-selecionado.');
        }
      })
      .finally(() => {
        if (!cancelado) setCarregandoClientePreselecionado(false);
      });

    return () => {
      cancelado = true;
    };
  }, [clienteIdParam, statePreselectedClient, aoSelecionarCliente]);

  // ─── Pré-preenchimento de busca via ?busca= ───
  useEffect(() => {
    if (clienteIdParam || statePreselectedClient?.id || !buscaParam) return;
    if (preloadedBuscaRef.current === buscaParam) return;
    preloadedBuscaRef.current = buscaParam;
    aoAlterarBusca(buscaParam);
  }, [buscaParam, clienteIdParam, statePreselectedClient, aoAlterarBusca]);

  const alternarProblema = (idProblema: string) => {
    setProblemasSelecionados((anterior) =>
      anterior.includes(idProblema)
        ? anterior.filter((item) => item !== idProblema)
        : [...anterior, idProblema]
    );
  };

  const montarDescricaoChamado = (): string => {
    const rotulosProblemas = problemasSelecionados.map(
      (idProblema) => OPCOES_PROBLEMAS.find((item) => item.id === idProblema)?.label || idProblema
    );

    let descricao = '';
    if (rotulosProblemas.length > 0) {
      descricao += `Problemas reportados: ${rotulosProblemas.join(', ')}`;
    }
    if (planoCliente.trim()) {
      descricao += `\nPlano: ${planoCliente.trim()}`;
    }
    if (nomeRedeWifi.trim() || senhaWifi.trim()) {
      const partesWifi: string[] = [];
      if (nomeRedeWifi.trim()) partesWifi.push(`Wi-Fi: ${nomeRedeWifi.trim()}`);
      if (senhaWifi.trim()) partesWifi.push(`Senha: ${senhaWifi.trim()}`);
      descricao += `\n${partesWifi.join(' | ')}`;
    }
    if (pontoReferencia.trim()) {
      descricao += `\nPonto de referência: ${pontoReferencia.trim()}`;
    }
    if (observacao.trim()) {
      descricao += `\nObservação: ${observacao.trim()}`;
    }
    if (enderecoCliente) {
      descricao += `\nEndereço: ${enderecoCliente}`;
    }
    return descricao || 'Sem descrição';
  };

  // ─── Gerador da Estrutura da O.S. a partir do Template ──────────────────────
  const gerarTextoOS = useCallback(
    (idChamadoSobrescrito?: string, numeroDiarioSobrescrito?: string): string => {
      if (!clienteSelecionado) {
        return 'Selecione um cliente à esquerda para visualizar a mensagem da O.S. em tempo real.';
      }

      const idChamado = idChamadoSobrescrito || idChamadoCriado || 'PENDENTE';
      const diarioFormatado =
        numeroDiarioSobrescrito || numeroDiarioCriado || proximoNumeroDiarioFormatado;
      const nomeCliente = obterNomeClienteISPFY(clienteSelecionado);
      const telefoneCliente = obterTelefoneClienteISPFY(clienteSelecionado, 'Não informado');
      const plano = planoCliente.trim() || 'Não informado';

      let textoLogins = '';
      let usuarioPppoe = '';
      let senhaPppoe = '';
      if (loginsCliente && loginsCliente.length > 0) {
        usuarioPppoe = loginsCliente[0]?.usuario || loginsCliente[0]?.login || '';
        senhaPppoe = loginsCliente[0]?.senha || '';
        textoLogins = loginsCliente
          .map(
            (login) =>
              `🔑 *PPPoE:* ${login.usuario || login.login || 'Não informado'}\n🔒 *Senha:* ${login.senha || 'Não informada'}`
          )
          .join('\n');
      }

      let textoWifi = '';
      if (nomeRedeWifi.trim() || senhaWifi.trim()) {
        const linhasWifi: string[] = [];
        if (nomeRedeWifi.trim()) linhasWifi.push(`📶 *Rede Wi-Fi:* ${nomeRedeWifi.trim()}`);
        if (senhaWifi.trim()) linhasWifi.push(`🔒 *Senha Wi-Fi:* ${senhaWifi.trim()}`);
        textoWifi = linhasWifi.join('\n');
      }

      const rotulosProblemas = problemasSelecionados.map(
        (idProblema) => OPCOES_PROBLEMAS.find((item) => item.id === idProblema)?.label || idProblema
      );
      const textoProblemas =
        rotulosProblemas.length > 0 ? `📋 *Problemas:* ${rotulosProblemas.join(', ')}` : '';
      const rotuloPrioridade = ROTULOS_PRIORIDADE_OS[prioridade]?.rotulo || 'Normal';
      const textoEndereco = enderecoCliente ? `📍 *Endereço:* ${enderecoCliente}` : '';
      const textoReferencia = pontoReferencia.trim() ? `📍 *Ref:* ${pontoReferencia.trim()}` : '';
      const textoObservacao = observacao.trim() ? `📝 *Obs:* ${observacao.trim()}` : '';
      const textoMapa = linksMapa.urlDireta ? `🗺️ *Mapa:* ${linksMapa.urlDireta}` : '';

      let texto = modeloOS;

      if (!texto.includes('{numero_diario}')) {
        texto = texto.replace(/{numero_os}/g, `${diarioFormatado} (ISPFY #${idChamado})`);
      } else {
        texto = texto
          .replace(/{numero_diario}/g, diarioFormatado)
          .replace(/{numero_os}/g, idChamado);
      }

      if (texto.includes('{wifi}')) {
        texto = texto.replace(/{wifi}/g, textoWifi);
      } else if (textoWifi) {
        if (texto.includes('{problemas}')) {
          texto = texto.replace('{problemas}', `${textoWifi}\n{problemas}`);
        } else if (texto.includes('{assunto}')) {
          texto = texto.replace('{assunto}', `${textoWifi}\n{assunto}`);
        } else {
          texto = `${texto}\n${textoWifi}`;
        }
      }

      texto = texto
        .replace(/{data_hoje}/g, dataFormatada)
        .replace(/{cliente}/g, nomeCliente)
        .replace(/{telefone}/g, telefoneCliente)
        .replace(/{plano}/g, plano)
        .replace(/{logins}/g, textoLogins)
        .replace(/{pppoe}/g, usuarioPppoe)
        .replace(/{senha}/g, senhaPppoe)
        .replace(/{wifi_nome}/g, nomeRedeWifi.trim())
        .replace(/{wifi_senha}/g, senhaWifi.trim())
        .replace(/{problemas}/g, textoProblemas)
        .replace(/{assunto}/g, nomeAssunto || 'Não informado')
        .replace(/{prioridade}/g, rotuloPrioridade)
        .replace(/{endereco}/g, textoEndereco)
        .replace(/{referencia}/g, textoReferencia)
        .replace(/{observacao}/g, textoObservacao)
        .replace(/{mapa}/g, textoMapa);

      return texto
        .split('\n')
        .map((linha) => linha.trimEnd())
        .filter((linha, indice, lista) => !(linha.trim() === '' && lista[indice - 1]?.trim() === ''))
        .join('\n')
        .trim();
    },
    [
      clienteSelecionado,
      idChamadoCriado,
      numeroDiarioCriado,
      proximoNumeroDiarioFormatado,
      dataFormatada,
      planoCliente,
      loginsCliente,
      problemasSelecionados,
      prioridade,
      nomeAssunto,
      pontoReferencia,
      observacao,
      nomeRedeWifi,
      senhaWifi,
      modeloOS,
      enderecoCliente,
      linksMapa.urlDireta,
    ]
  );

  const mensagemEfetiva = textoManualOS !== null ? textoManualOS : gerarTextoOS();

  const handleTogglePinCurrentGroup = async () => {
    if (!grupoSelecionadoPhone) {
      toast.warning('Selecione um grupo primeiro.');
      return;
    }
    if (isGrupoAtualFixo) {
      await clearPinnedGroup();
      toast.info('Grupo fixo removido.');
      return;
    }
    const nome = grupoAtualSelecionado?.name || 'Grupo de Operação';
    const ok = await pinGroup(grupoSelecionadoPhone, nome);
    grupoAlteradoManualRef.current = false;
    if (ok) {
      toast.success(`Grupo fixo salvo: ${nome}`, {
        description: 'Todas as próximas O.S. já abrirão apontando para este grupo.',
      });
    } else {
      toast.success(`Grupo fixo salvo localmente: ${nome}`);
    }
  };

  const aoCriarOS = async () => {
    if (!clienteSelecionado?.id) {
      toast.warning('Selecione um cliente.');
      return;
    }
    if (!assuntoSelecionado) {
      toast.warning('Selecione o assunto da O.S.');
      return;
    }
    if (problemasSelecionados.length === 0 && !observacao.trim()) {
      toast.warning('Selecione pelo menos um problema ou escreva uma observação.');
      return;
    }

    setCriandoOS(true);
    try {
      const resultado = await ispfyService.createTicket({
        id_cliente: clienteSelecionado.id,
        id_assunto: assuntoSelecionado,
        prioridade,
        mensagem: montarDescricaoChamado(),
      });

      if (!resultado.success) {
        toast.error('Erro ao abrir O.S.', { description: resultado.message });
        return;
      }

      const novoChamadoId = resultado.id ?? '';
      setIdChamadoCriado(novoChamadoId);

      const grupoDestino = gruposDisponiveis.find((grupo) => grupo.phone === grupoSelecionadoPhone);
      const nomeGrupo = grupoDestino?.name || 'Grupo de Operação';

      const { formattedDailyNumber } = await registrarOS({
        ticketId: novoChamadoId,
        clientId: clienteSelecionado.id,
        clientName: obterNomeClienteISPFY(clienteSelecionado),
        phone: obterTelefoneClienteISPFY(clienteSelecionado, 'Não informado'),
        plan: planoCliente,
        subject: nomeAssunto || 'Não informado',
        priority: prioridade,
        address: enderecoCliente,
        referencePoint: pontoReferencia,
        observation: observacao,
        wifiSsid: nomeRedeWifi.trim() || undefined,
        wifiPassword: senhaWifi.trim() || undefined,
        whatsappSent: !!(enviarGrupoAoCriar && grupoSelecionadoPhone),
        whatsappGroup: nomeGrupo,
        fullMessage: '',
      });

      setNumeroDiarioCriado(formattedDailyNumber);
      setOsCriada(true);
      toast.success(`O.S. #${formattedDailyNumber} registrada hoje! (ISPFY #${novoChamadoId})`);

      const mensagemFinal =
        textoManualOS !== null
          ? textoManualOS
              .replace(/NOVA O.S.|PENDENTE/g, `#${novoChamadoId}`)
              .replace(/{numero_diario}/g, formattedDailyNumber)
          : gerarTextoOS(novoChamadoId, formattedDailyNumber);

      if (enviarGrupoAoCriar && grupoSelecionadoPhone) {
        whapiService
          .sendGroupMessage(grupoSelecionadoPhone, mensagemFinal)
          .then((resposta) => {
            if (resposta.sent) {
              setGrupoEnviadoComSucesso(nomeGrupo);
              toast.success(`O.S. #${formattedDailyNumber} enviada para "${nomeGrupo}"!`);
            } else {
              toast.error(`O.S. criada, mas falhou envio ao WhatsApp: ${resposta.error}`);
            }
          })
          .catch((erro) => {
            console.error('Erro ao enviar para grupo WhatsApp:', erro);
          });
      }
    } catch {
      toast.error('Erro de comunicação com o servidor.');
    } finally {
      setCriandoOS(false);
    }
  };

  const aoCopiarInformacoes = () => {
    if (!clienteSelecionado) {
      toast.warning('Selecione um cliente antes de copiar a O.S.');
      return;
    }
    navigator.clipboard
      .writeText(mensagemEfetiva)
      .then(() => toast.success('O.S. copiada para a área de transferência!'))
      .catch(() => toast.error('Falha ao copiar informações.'));
  };

  const copiarValorRapido = (valor: string, rotulo: string) => {
    if (!valor) return;
    navigator.clipboard
      .writeText(valor)
      .then(() => toast.success(`${rotulo} copiado!`))
      .catch(() => undefined);
  };

  const aoEnviarParaGrupo = async () => {
    if (!grupoSelecionadoPhone) {
      toast.warning('Selecione um grupo do WhatsApp de destino.');
      return;
    }
    const grupoDestino = gruposDisponiveis.find((grupo) => grupo.phone === grupoSelecionadoPhone);
    const nomeGrupo = grupoDestino?.name || 'Grupo selecionado';

    setEnviandoParaGrupo(true);
    try {
      const resposta = await whapiService.sendGroupMessage(grupoSelecionadoPhone, mensagemEfetiva);
      if (resposta.sent) {
        setGrupoEnviadoComSucesso(nomeGrupo);
        toast.success(`O.S. enviada para "${nomeGrupo}"!`);
      } else {
        toast.error(`Falha ao enviar para o grupo: ${resposta.error || 'Erro desconhecido'}`);
      }
    } catch {
      toast.error('Erro ao enviar mensagem para o WhatsApp.');
    } finally {
      setEnviandoParaGrupo(false);
    }
  };

  const limparParamsPreselecao = useCallback(() => {
    temPreselecaoInicialRef.current = false;
    preloadedKeyRef.current = null;
    preloadedBuscaRef.current = null;
    if (searchParams.has('clienteId') || searchParams.has('busca') || statePreselectedClient) {
      const proximos = new URLSearchParams(searchParams);
      proximos.delete('clienteId');
      proximos.delete('busca');
      setSearchParams(proximos, { replace: true, state: null });
    }
  }, [searchParams, setSearchParams, statePreselectedClient]);

  const aoLimparFormulario = () => {
    limparParamsPreselecao();
    clienteSelecionadoRef.current = null;
    setClienteSelecionado(null);
    setTermoBusca('');
    setResultadosBusca(todosClientes);
    setAssuntoSelecionado('');
    setNomeAssunto('');
    setProblemasSelecionados([]);
    setPrioridade('N');
    setObservacao('');
    setPontoReferencia('');
    setNomeRedeWifi('');
    setSenhaWifi('');
    setOsCriada(false);
    setIdChamadoCriado('');
    setNumeroDiarioCriado(null);
    setLoginsCliente([]);
    setContratosCliente([]);
    setPlanoCliente('');
    setGrupoEnviadoComSucesso(null);
    setTextoManualOS(null);
    setEditandoMensagemAoVivo(false);
    grupoAlteradoManualRef.current = false;
    if (pinnedGroupPhone) {
      setGrupoSelecionadoPhone(pinnedGroupPhone);
    }
  };

  const aoAbrirModalModelo = () => {
    setTextoTemporarioModelo(modeloOS);
    setModalModeloAberto(true);
  };

  const aoSalvarModelo = () => {
    setModeloOS(textoTemporarioModelo);
    localStorage.setItem(CHAVE_STORAGE_TEMPLATE, textoTemporarioModelo);
    setModalModeloAberto(false);
    toast.success('Estrutura da O.S. salva com sucesso!');
  };

  const aoRestaurarModeloPadrao = () => {
    setTextoTemporarioModelo(DEFAULT_OS_TEMPLATE);
    toast.info('Estrutura restaurada para o padrão AVL Telecom.');
  };

  const inserirTagNoModelo = (tag: string) => {
    const campo = campoModeloRef.current;
    if (!campo) {
      setTextoTemporarioModelo((anterior) => `${anterior}\n${tag}`);
      return;
    }
    const inicio = campo.selectionStart;
    const fim = campo.selectionEnd;
    const proximoTexto =
      textoTemporarioModelo.substring(0, inicio) + tag + textoTemporarioModelo.substring(fim);
    setTextoTemporarioModelo(proximoTexto);
    setTimeout(() => {
      campo.focus();
      campo.setSelectionRange(inicio + tag.length, inicio + tag.length);
    }, 50);
  };

  const telefoneClienteSelecionado = obterTelefoneClienteISPFY(clienteSelecionado);
  const infoPrioridadeAtual = ROTULOS_PRIORIDADE_OS[prioridade] || ROTULOS_PRIORIDADE_OS.N;

  const etapaClienteOk = Boolean(clienteSelecionado?.id);
  const etapaProblemaOk = problemasSelecionados.length > 0 || observacao.trim().length > 0;
  const etapaAssuntoOk = Boolean(assuntoSelecionado);
  const etapaGrupoOk = !enviarGrupoAoCriar || Boolean(grupoSelecionadoPhone);
  const formularioPronto = etapaClienteOk && etapaProblemaOk && etapaAssuntoOk;

  const pendenciasEnvio: string[] = [];
  if (!etapaClienteOk) pendenciasEnvio.push('Cliente');
  if (!etapaProblemaOk) pendenciasEnvio.push('Problema ou observação');
  if (!etapaAssuntoOk) pendenciasEnvio.push('Assunto');

  return (
    <PageTransition>
      <div className="max-w-[1440px] mx-auto space-y-5 text-foreground">
        {/* ─── Top Bar Minimalista ─── */}
        <div className="rounded-2xl border border-border/75 bg-card/90 backdrop-blur-md px-4 sm:px-5 py-3.5 shadow-sm space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                    Abertura de O.S.
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 border border-emerald-500/25 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">
                    <Calendar className="w-3 h-3" />
                    Próxima #{proximoNumeroDiarioFormatado}
                  </span>
                  {pinnedGroupPhone ? (
                    <button
                      type="button"
                      onClick={() =>
                        grupoCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      }
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/25 px-2.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/15 transition-colors max-w-[240px]"
                      title="Grupo fixo configurado para disparo das O.S."
                    >
                      <Pin className="w-3 h-3 shrink-0" />
                      <span className="truncate">Fixo: {pinnedGroupName || 'Salvo'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        grupoCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      }
                      className="inline-flex items-center gap-1 rounded-full bg-secondary/70 border border-border/70 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pin className="w-3 h-3" />
                      Definir grupo fixo
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Registro no ISPFY + despacho imediato no grupo do WhatsApp ({dataFormatada}).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalOrdensDoDiaAberto(true)}
                className="h-9 px-3 rounded-xl text-xs font-semibold gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                O.S. de Hoje
                <span className="ml-0.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-md bg-emerald-500/20 text-[11px] font-bold tabular-nums">
                  {contagemDiaria}
                </span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={aoAbrirModalModelo}
                className="h-9 px-3 rounded-xl text-xs font-medium gap-1.5 border-border/70 bg-background hover:bg-secondary"
              >
                <Sliders className="w-3.5 h-3.5 text-primary" />
                Modelo
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={aoLimparFormulario}
                className="h-9 px-3 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-secondary gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Limpar
              </Button>
            </div>
          </div>

          {/* Checklist de progresso em 4 etapas */}
          {!osCriada && (
            <div className="flex items-center gap-2 pt-2.5 border-t border-border/50 overflow-x-auto no-scrollbar">
              {[
                { num: 1, label: 'Cliente', done: etapaClienteOk },
                { num: 2, label: 'Problema', done: etapaProblemaOk },
                { num: 3, label: 'Assunto', done: etapaAssuntoOk },
                { num: 4, label: enviarGrupoAoCriar ? 'Grupo WhatsApp' : 'Envio opcional', done: etapaGrupoOk },
              ].map((step, idx, arr) => (
                <React.Fragment key={step.num}>
                  <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium shrink-0 transition-colors ${
                      step.done
                        ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                        : 'bg-secondary/60 text-muted-foreground'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        step.done
                          ? 'bg-emerald-500 text-white'
                          : 'bg-muted-foreground/20 text-muted-foreground'
                      }`}
                    >
                      {step.done ? <Check className="w-2.5 h-2.5" /> : step.num}
                    </span>
                    <span>{step.label}</span>
                  </div>
                  {idx < arr.length - 1 && (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        {/* ─── Tela de Sucesso vs Formulário ─── */}
        <AnimatePresence mode="wait">
          {osCriada ? (
            <motion.div
              key="sucesso"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="max-w-xl mx-auto"
            >
              <div className="rounded-2xl border border-emerald-500/30 bg-card p-6 sm:p-7 space-y-5 shadow-lg">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[11px] mb-1.5">
                      Protocolo ISPFY #{idChamadoCriado}
                    </Badge>
                    <h3 className="text-2xl font-bold tracking-tight text-foreground">
                      O.S. #{numeroDiarioCriado || proximoNumeroDiarioFormatado} registrada!
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cliente:{' '}
                      <strong className="text-foreground">
                        {obterNomeClienteISPFY(clienteSelecionado)}
                      </strong>{' '}
                      • Total hoje: {contagemDiaria} O.S.
                    </p>
                  </div>
                </div>

                {/* Resumo */}
                <div className="rounded-xl border border-border/70 divide-y divide-border/60 text-xs bg-secondary/25 overflow-hidden">
                  <div className="flex justify-between items-center px-3.5 py-2.5">
                    <span className="text-muted-foreground">Plano</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {planoCliente || 'Não especificado'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center px-3.5 py-2.5">
                    <span className="text-muted-foreground">Assunto</span>
                    <span className="font-medium text-foreground">{nomeAssunto}</span>
                  </div>
                  <div className="flex justify-between items-center px-3.5 py-2.5">
                    <span className="text-muted-foreground">Prioridade</span>
                    <span className={`font-semibold ${infoPrioridadeAtual.corTexto}`}>
                      {infoPrioridadeAtual.rotulo}
                    </span>
                  </div>
                  {telefoneClienteSelecionado && (
                    <div className="flex justify-between items-center px-3.5 py-2.5">
                      <span className="text-muted-foreground">Contato</span>
                      <span className="font-mono text-foreground">{telefoneClienteSelecionado}</span>
                    </div>
                  )}
                  {enderecoCliente && (
                    <div className="flex justify-between items-start px-3.5 py-2.5 gap-3">
                      <span className="text-muted-foreground shrink-0">Endereço</span>
                      <span className="text-foreground text-right">{enderecoCliente}</span>
                    </div>
                  )}
                </div>

                {/* Reenvio / Envio para grupo WhatsApp */}
                <div className="p-4 rounded-xl bg-emerald-500/[0.07] border border-emerald-500/25 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                      <IconeWhatsApp className="w-4 h-4 text-emerald-500" />
                      Grupo WhatsApp
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleTogglePinCurrentGroup()}
                      disabled={savingPinnedGroup || !grupoSelecionadoPhone}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors ${
                        isGrupoAtualFixo
                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                          : 'bg-background text-muted-foreground hover:text-foreground border-border'
                      }`}
                    >
                      <Pin className="w-2.5 h-2.5" />
                      {isGrupoAtualFixo ? 'Grupo fixo' : 'Fixar grupo'}
                    </button>
                  </div>

                  <Select
                    value={grupoSelecionadoPhone}
                    onValueChange={(val) => {
                      grupoAlteradoManualRef.current = true;
                      setGrupoSelecionadoPhone(val);
                    }}
                  >
                    <SelectTrigger className="w-full bg-background border-input text-foreground h-10 text-xs rounded-xl">
                      <SelectValue placeholder="Selecione o grupo..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 bg-popover border-border text-popover-foreground z-50">
                      {gruposDisponiveis.map((grupo) => (
                        <SelectItem
                          key={grupo.phone}
                          value={grupo.phone}
                          className="text-xs cursor-pointer"
                        >
                          {grupo.phone === pinnedGroupPhone ? '📌 ' : '👥 '}
                          {grupo.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {grupoEnviadoComSucesso && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs">
                      <CheckCheck className="w-4 h-4 shrink-0" />
                      <span>
                        Enviada para <strong>{grupoEnviadoComSucesso}</strong>
                      </span>
                    </div>
                  )}

                  <Button
                    onClick={aoEnviarParaGrupo}
                    disabled={enviandoParaGrupo || !grupoSelecionadoPhone || carregandoGrupos}
                    className="w-full h-10 rounded-xl font-semibold text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                  >
                    {enviandoParaGrupo ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        {grupoEnviadoComSucesso ? 'Reenviar para o Grupo' : 'Enviar para o Grupo'}
                      </>
                    )}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <Button
                    variant="outline"
                    onClick={aoCopiarInformacoes}
                    className="h-10 rounded-xl text-xs font-semibold gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5 text-emerald-500" />
                    Copiar Texto
                  </Button>
                  <Button
                    onClick={aoLimparFormulario}
                    className="h-10 rounded-xl text-xs font-semibold gap-1.5"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Abrir Nova O.S.
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="formulario"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start"
            >
              {/* ─── Coluna Esquerda: Formulário Estruturado (7 cols) ─── */}
              <div className="xl:col-span-7 space-y-4">
                {/* 1. Cliente & Acesso */}
                <SecaoFormularioOS
                  numero="1"
                  titulo="Cliente & Dados Técnicos"
                  icone={<User className="w-4 h-4" />}
                  concluido={etapaClienteOk}
                  badge={
                    clienteSelecionado
                      ? `ID #${clienteSelecionado.id}`
                      : todosClientes.length > 0
                      ? `${todosClientes.length} ativos`
                      : undefined
                  }
                >
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      value={termoBusca}
                      onChange={(e) => aoAlterarBusca(e.target.value)}
                      placeholder="Pesquisar cliente por nome, telefone, CPF ou bairro..."
                      className="pl-9 pr-9 bg-background border-input h-10 text-xs sm:text-sm rounded-xl"
                    />
                    {(carregandoBusca || carregandoClientePreselecionado) && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
                    )}
                    {clienteSelecionado && !carregandoBusca && !carregandoClientePreselecionado && (
                      <button
                        type="button"
                        onClick={() => {
                          limparParamsPreselecao();
                          clienteSelecionadoRef.current = null;
                          setClienteSelecionado(null);
                          setTermoBusca('');
                          setResultadosBusca(todosClientes);
                          setPlanoCliente('');
                          setLoginsCliente([]);
                          setContratosCliente([]);
                          setPontoReferencia('');
                          setTextoManualOS(null);
                        }}
                        title="Trocar cliente"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {carregandoClientePreselecionado && !clienteSelecionado && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary font-medium">
                      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                      <span>Carregando cliente selecionado...</span>
                    </div>
                  )}

                  {/* Lista de resultados da busca */}
                  <AnimatePresence>
                    {resultadosBusca.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="rounded-xl border border-border/80 overflow-hidden divide-y divide-border/60 max-h-[240px] overflow-y-auto bg-popover shadow-md"
                      >
                        {resultadosBusca.slice(0, 40).map((cliente) => {
                          const telefone = obterTelefoneClienteISPFY(cliente);
                          const localidade = cliente.endereco_cobranca_bairro || cliente.cidade;
                          return (
                            <button
                              key={cliente.id}
                              type="button"
                              onClick={() => void aoSelecionarCliente(cliente)}
                              className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-accent/70 transition-colors text-left group"
                            >
                              <div className="w-8 h-8 rounded-lg bg-secondary group-hover:bg-primary/15 flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground group-hover:text-primary">
                                {obterNomeClienteISPFY(cliente).charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
                                  {obterNomeClienteISPFY(cliente)}
                                </p>
                                <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                                  {telefone && (
                                    <span className="flex items-center gap-1 truncate">
                                      <Phone className="w-2.5 h-2.5 shrink-0" />
                                      {telefone}
                                    </span>
                                  )}
                                  {localidade && (
                                    <span className="flex items-center gap-1 truncate">
                                      <MapPin className="w-2.5 h-2.5 shrink-0" />
                                      {localidade}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {isRegistroAtivo(cliente.ativo) && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 shrink-0">
                                  Ativo
                                </span>
                              )}
                              <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-primary shrink-0" />
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Ficha compacta do cliente selecionado */}
                  <AnimatePresence>
                    {clienteSelecionado && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] dark:bg-emerald-500/[0.07] p-3.5 space-y-3"
                      >
                        {/* Identificação */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                              {obterNomeClienteISPFY(clienteSelecionado).charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-foreground truncate">
                                {obterNomeClienteISPFY(clienteSelecionado)}
                              </p>
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                <span className="font-mono">#{clienteSelecionado.id}</span>
                                {telefoneClienteSelecionado && (
                                  <>
                                    <span>•</span>
                                    <span className="font-mono">{telefoneClienteSelecionado}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                              isRegistroAtivo(clienteSelecionado.ativo)
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                            }`}
                          >
                            {isRegistroAtivo(clienteSelecionado.ativo) ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>

                        {/* Endereço + Plano + PPPoE em grid compacto */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {/* Plano */}
                          <div className="p-2.5 rounded-xl bg-card border border-border/70 space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                <Zap className="w-3 h-3 text-emerald-500" />
                                Plano
                                {carregandoPlano && (
                                  <Loader2 className="w-3 h-3 animate-spin text-emerald-500 ml-0.5" />
                                )}
                              </span>
                              <button
                                type="button"
                                onClick={() => setEditandoPlano(!editandoPlano)}
                                className="text-[10px] font-medium text-muted-foreground hover:text-primary transition-colors"
                              >
                                {editandoPlano ? 'Concluir' : 'Manual'}
                              </button>
                            </div>

                            {carregandoPlano ? (
                              <p className="text-[11px] text-muted-foreground">Carregando plano...</p>
                            ) : editandoPlano ? (
                              <div className="flex items-center gap-1.5">
                                <Input
                                  value={planoCliente}
                                  onChange={(e) => setPlanoCliente(e.target.value)}
                                  placeholder="Ex: FIBRA 700 MEGA"
                                  className="h-7 text-xs bg-background"
                                />
                                <Button
                                  type="button"
                                  size="icon"
                                  onClick={() => setEditandoPlano(false)}
                                  className="h-7 w-7 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-foreground truncate">
                                  {planoCliente || 'Não identificado'}
                                </span>
                                {contratosCliente.length > 1 && (
                                  <Badge variant="outline" className="text-[9px] shrink-0">
                                    {contratosCliente.length} contr.
                                  </Badge>
                                )}
                              </div>
                            )}

                            {!carregandoPlano && !editandoPlano && todosPlanos.length > 0 && (
                              <Select value={planoCliente} onValueChange={setPlanoCliente}>
                                <SelectTrigger className="h-7 text-[11px] bg-background border-border/70 rounded-lg">
                                  <SelectValue placeholder="Trocar plano..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-56 text-xs z-50">
                                  {todosPlanos.map((plano) => (
                                    <SelectItem
                                      key={plano.id}
                                      value={plano.nome || plano.descricao || `Plano #${plano.id}`}
                                      className="text-xs"
                                    >
                                      {plano.nome || plano.descricao}
                                      {plano.valor_mensal && plano.valor_mensal !== '0.00'
                                        ? ` — R$ ${plano.valor_mensal}`
                                        : ''}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>

                          {/* PPPoE ou Endereço */}
                          <div className="p-2.5 rounded-xl bg-card border border-border/70 space-y-1.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              <Key className="w-3 h-3 text-amber-500" />
                              Credenciais PPPoE
                            </span>
                            {loginsCliente.length > 0 ? (
                              <div className="space-y-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    copiarValorRapido(
                                      loginsCliente[0]?.usuario || loginsCliente[0]?.login || '',
                                      'Login PPPoE'
                                    )
                                  }
                                  className="w-full flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-secondary/50 hover:bg-secondary text-[11px] transition-colors"
                                  title="Clique para copiar login"
                                >
                                  <span className="text-muted-foreground">Login:</span>
                                  <span className="font-mono font-semibold text-foreground truncate">
                                    {loginsCliente[0]?.usuario || loginsCliente[0]?.login || '–'}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    copiarValorRapido(loginsCliente[0]?.senha || '', 'Senha PPPoE')
                                  }
                                  className="w-full flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-secondary/50 hover:bg-secondary text-[11px] transition-colors"
                                  title="Clique para copiar senha"
                                >
                                  <span className="text-muted-foreground">Senha:</span>
                                  <span className="font-mono font-semibold text-foreground truncate">
                                    {loginsCliente[0]?.senha || '–'}
                                  </span>
                                </button>
                              </div>
                            ) : (
                              <p className="text-[11px] text-muted-foreground italic">
                                Nenhum login PPPoE retornado
                              </p>
                            )}
                          </div>
                        </div>

                        {enderecoCliente && (
                          <div className="flex items-start gap-2 px-2.5 py-2 rounded-xl bg-card border border-border/70 text-xs">
                            <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                            <span className="text-foreground/90 leading-snug">{enderecoCliente}</span>
                          </div>
                        )}

                        {/* Wi-Fi e Ponto de Referência */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5">
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                              Wi-Fi (SSID)
                            </Label>
                            <Input
                              value={nomeRedeWifi}
                              onChange={(e) => setNomeRedeWifi(e.target.value)}
                              placeholder="Opcional"
                              className="h-8 text-xs bg-background rounded-lg"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                              Senha Wi-Fi
                            </Label>
                            <Input
                              value={senhaWifi}
                              onChange={(e) => setSenhaWifi(e.target.value)}
                              placeholder="Opcional"
                              className="h-8 text-xs font-mono bg-background rounded-lg"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                              Ponto de Referência
                            </Label>
                            <Input
                              value={pontoReferencia}
                              onChange={(e) => setPontoReferencia(e.target.value)}
                              placeholder="Ex: Perto da padaria..."
                              className="h-8 text-xs bg-background rounded-lg"
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </SecaoFormularioOS>

                {/* 2. Tipo de Problema (Compacto e tátil) */}
                <SecaoFormularioOS
                  numero="2"
                  titulo="Tipo de Problema"
                  icone={<AlertCircle className="w-4 h-4" />}
                  concluido={etapaProblemaOk}
                  badge={
                    problemasSelecionados.length > 0
                      ? `${problemasSelecionados.length} selecionado(s)`
                      : undefined
                  }
                >
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {OPCOES_PROBLEMAS.map((problema) => {
                      const selecionado = problemasSelecionados.includes(problema.id);
                      const cores = MAPA_CORES_PROBLEMAS[problema.cor];
                      const Icone = problema.icon;
                      return (
                        <button
                          key={problema.id}
                          type="button"
                          onClick={() => alternarProblema(problema.id)}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                            selecionado ? cores.chipSelecionado : cores.chip
                          }`}
                        >
                          <Icone
                            className={`w-4 h-4 shrink-0 ${
                              selecionado ? 'text-current' : cores.iconColor
                            }`}
                          />
                          <span className="leading-tight truncate flex-1">{problema.label}</span>
                          {selecionado && <Check className="w-3.5 h-3.5 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </SecaoFormularioOS>

                {/* 3. Assunto, Prioridade & Observações */}
                <SecaoFormularioOS
                  numero="3"
                  titulo="Assunto, Prioridade & Observações"
                  icone={<Ticket className="w-4 h-4" />}
                  concluido={etapaAssuntoOk}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">
                        Assunto do Chamado <span className="text-rose-500">*</span>
                      </Label>
                      {carregandoAssuntos ? (
                        <div className="flex items-center gap-2 text-muted-foreground text-xs h-10 px-3 rounded-xl bg-secondary/50 border border-border">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando assuntos...
                        </div>
                      ) : (
                        <Select
                          value={assuntoSelecionado}
                          onValueChange={(valor) => {
                            setAssuntoSelecionado(valor);
                            setNomeAssunto(
                              assuntos.find((item) => item.id === valor)?.assunto ?? valor
                            );
                          }}
                        >
                          <SelectTrigger className="bg-background border-input h-10 text-xs rounded-xl">
                            <SelectValue placeholder="Selecione o assunto..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-56 z-50">
                            {assuntos.map((assunto) => (
                              <SelectItem
                                key={assunto.id}
                                value={assunto.id}
                                className="text-xs cursor-pointer"
                              >
                                {assunto.assunto}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">Prioridade</Label>
                      <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-secondary/60 border border-border/60 h-10">
                        {Object.entries(ROTULOS_PRIORIDADE_OS).map(([chave, info]) => {
                          const active = prioridade === chave;
                          return (
                            <button
                              key={chave}
                              type="button"
                              onClick={() => setPrioridade(chave)}
                              className={`flex items-center justify-center gap-1 rounded-lg text-[11px] font-semibold transition-all ${
                                active
                                  ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${PRIORIDADE_DOT[chave] || 'bg-primary'}`}
                              />
                              <span>{info.rotulo}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">
                      Observações para o técnico
                    </Label>
                    <Textarea
                      value={observacao}
                      onChange={(e) => setObservacao(e.target.value)}
                      placeholder="Instruções específicas, melhor horário, equipamento a levar..."
                      rows={3}
                      className="bg-background border-input resize-none text-xs rounded-xl"
                    />
                  </div>
                </SecaoFormularioOS>

                {/* 4. Grupo WhatsApp Fixo & Disparo */}
                <div ref={grupoCardRef}>
                  <SecaoFormularioOS
                    numero="4"
                    titulo="Grupo WhatsApp de Envio"
                    icone={<IconeWhatsApp className="w-4 h-4 text-emerald-500" />}
                    concluido={etapaGrupoOk}
                    badge={
                      isGrupoAtualFixo
                        ? 'Grupo fixo ativo'
                        : `${gruposDisponiveis.length} grupo(s)`
                    }
                  >
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <Select
                            value={grupoSelecionadoPhone}
                            onValueChange={(val) => {
                              grupoAlteradoManualRef.current = true;
                              setGrupoSelecionadoPhone(val);
                            }}
                          >
                            <SelectTrigger className="w-full bg-background border-input h-10 text-xs rounded-xl">
                              <SelectValue placeholder="Selecione o grupo WhatsApp..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-64 z-50">
                              {gruposDisponiveis.map((grupo) => (
                                <SelectItem
                                  key={grupo.phone}
                                  value={grupo.phone}
                                  className="text-xs cursor-pointer"
                                >
                                  {grupo.phone === pinnedGroupPhone ? '📌 ' : '👥 '}
                                  {grupo.name}
                                  {grupo.phone === pinnedGroupPhone ? ' (Fixo)' : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            type="button"
                            size="sm"
                            variant={isGrupoAtualFixo ? 'default' : 'outline'}
                            disabled={savingPinnedGroup || !grupoSelecionadoPhone}
                            onClick={() => void handleTogglePinCurrentGroup()}
                            className={`h-10 px-3 rounded-xl text-xs font-semibold gap-1.5 ${
                              isGrupoAtualFixo
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10'
                            }`}
                            title={
                              isGrupoAtualFixo
                                ? 'Clique para desafixar este grupo padrão'
                                : 'Salvar este grupo como padrão fixo para todas as O.S.'
                            }
                          >
                            {savingPinnedGroup ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : isGrupoAtualFixo ? (
                              <PinOff className="w-3.5 h-3.5" />
                            ) : (
                              <Pin className="w-3.5 h-3.5" />
                            )}
                            {isGrupoAtualFixo ? 'Grupo Fixo' : 'Fixar grupo'}
                          </Button>

                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            disabled={carregandoGrupos}
                            onClick={() => void carregarGruposWhatsApp(false)}
                            className="h-10 w-10 rounded-xl shrink-0"
                            title="Recarregar lista de grupos do WhatsApp"
                          >
                            <RefreshCw
                              className={`w-3.5 h-3.5 ${carregandoGrupos ? 'animate-spin' : ''}`}
                            />
                          </Button>
                        </div>
                      </div>

                      {/* Aviso de status do grupo fixo */}
                      {pinnedGroupPhone && !isGrupoAtualFixo ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px]">
                          <span className="text-amber-800 dark:text-amber-300">
                            Alterado apenas para esta O.S. Grupo fixo atual:{' '}
                            <strong>{pinnedGroupName || 'Salvo'}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              grupoAlteradoManualRef.current = false;
                              setGrupoSelecionadoPhone(pinnedGroupPhone);
                            }}
                            className="font-semibold text-amber-700 dark:text-amber-200 underline hover:opacity-80"
                          >
                            Voltar ao fixo
                          </button>
                        </div>
                      ) : isGrupoAtualFixo ? (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-[11px] text-emerald-700 dark:text-emerald-300">
                          <Pin className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            <strong>{grupoAtualSelecionado?.name || pinnedGroupName}</strong> está
                            fixado como destino padrão para todas as O.S. (tela cheia e O.S. rápida).
                          </span>
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                          Clique em <strong>Fixar grupo</strong> para deixar esse grupo sempre
                          selecionado ao abrir novas O.S.
                        </p>
                      )}

                      <label className="flex items-center justify-between gap-3 pt-2 border-t border-border/50 cursor-pointer">
                        <div>
                          <p className="text-xs font-medium text-foreground">
                            Enviar automaticamente no WhatsApp ao abrir a O.S.
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Despacha a mensagem abaixo no grupo escolhido assim que o chamado for
                            criado.
                          </p>
                        </div>
                        <Switch
                          checked={enviarGrupoAoCriar}
                          onCheckedChange={(checked) => {
                            setEnviarGrupoAoCriar(checked);
                            void setAutoSendToGroup(checked);
                          }}
                        />
                      </label>
                    </div>
                  </SecaoFormularioOS>
                </div>
              </div>

              {/* ─── Coluna Direita: Console WhatsApp & Ação Principal (5 cols) ─── */}
              <div className="xl:col-span-5">
                <div className="rounded-2xl border border-border/75 bg-card shadow-sm overflow-hidden sticky top-20 flex flex-col">
                  {/* Topo do Preview WhatsApp */}
                  <div className="px-4 py-3 border-b border-border/70 flex items-center justify-between gap-2 bg-secondary/25">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <IconeWhatsApp className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">
                          Prévia da Mensagem
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                          {enviarGrupoAoCriar ? (
                            <>
                              {isGrupoAtualFixo && <Pin className="w-2.5 h-2.5 text-emerald-500" />}
                              <span className="truncate">
                                {grupoAtualSelecionado?.name || 'Selecione um grupo'}
                              </span>
                            </>
                          ) : (
                            <span>Envio automático desativado</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant={editandoMensagemAoVivo ? 'default' : 'outline'}
                        onClick={() => setEditandoMensagemAoVivo(!editandoMensagemAoVivo)}
                        className="h-8 px-2.5 text-[11px] rounded-lg gap-1"
                      >
                        {editandoMensagemAoVivo ? (
                          <>
                            <Eye className="w-3 h-3" />
                            Ver
                          </>
                        ) : (
                          <>
                            <Edit3 className="w-3 h-3" />
                            Editar
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        disabled={!clienteSelecionado}
                        onClick={aoCopiarInformacoes}
                        title="Copiar texto da O.S."
                        className="h-8 w-8 rounded-lg"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Corpo do preview */}
                  <div className="p-4 space-y-4">
                    <div className="p-3.5 rounded-xl border border-emerald-500/25 bg-emerald-50/75 dark:bg-emerald-950/30 text-xs font-mono leading-relaxed text-emerald-950 dark:text-emerald-100">
                      {editandoMensagemAoVivo ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[11px] font-sans">
                            <span className="text-amber-600 dark:text-amber-300 font-semibold">
                              Edição manual ativa
                            </span>
                            {textoManualOS !== null && (
                              <button
                                type="button"
                                onClick={() => {
                                  setTextoManualOS(null);
                                  setEditandoMensagemAoVivo(false);
                                }}
                                className="text-muted-foreground hover:text-foreground underline text-[11px]"
                              >
                                Restaurar automático
                              </button>
                            )}
                          </div>
                          <Textarea
                            value={textoManualOS !== null ? textoManualOS : gerarTextoOS()}
                            onChange={(e) => setTextoManualOS(e.target.value)}
                            rows={12}
                            className="bg-background border-emerald-500/35 text-foreground text-xs font-mono leading-relaxed rounded-lg resize-none"
                          />
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap select-text max-h-[300px] overflow-y-auto pr-1">
                          {mensagemEfetiva}
                        </div>
                      )}

                      <div className="mt-2.5 pt-2 border-t border-emerald-500/15 flex items-center justify-between text-[10px] font-sans text-muted-foreground">
                        <span className="tabular-nums">{mensagemEfetiva.length} caracteres</span>
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          {textoManualOS !== null ? 'Editado manualmente' : 'Sincronizado ao vivo'}
                          <CheckCheck className="w-3 h-3" />
                        </span>
                      </div>
                    </div>

                    {/* Mapa compacto */}
                    {linksMapa.urlIncorporada ? (
                      <div className="rounded-xl border border-border/75 overflow-hidden bg-secondary/20">
                        <div className="px-3 py-1.5 border-b border-border/60 flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                            Mapa do Cliente
                          </span>
                          {linksMapa.urlDireta && (
                            <a
                              href={linksMapa.urlDireta}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline inline-flex items-center gap-1 font-medium"
                            >
                              <Navigation className="w-3 h-3" />
                              Google Maps
                            </a>
                          )}
                        </div>
                        <div className="relative h-44">
                          <iframe
                            key={linksMapa.urlIncorporada}
                            src={linksMapa.urlIncorporada}
                            className="absolute inset-0 w-full h-full border-0"
                            allowFullScreen
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            title="Localização do cliente"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-dashed border-border/70 bg-secondary/20 text-xs text-muted-foreground">
                        <MapPin className="w-4 h-4 shrink-0 opacity-60" />
                        <span>O mapa de localização aparece automaticamente ao escolher o cliente.</span>
                      </div>
                    )}

                    {/* Botão principal */}
                    <div className="space-y-2 pt-1">
                      <Button
                        type="button"
                        onClick={() => void aoCriarOS()}
                        disabled={criandoOS || !formularioPronto}
                        className="w-full h-11 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 disabled:opacity-45 gap-2"
                      >
                        {criandoOS ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Registrando O.S....
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            {enviarGrupoAoCriar
                              ? `Abrir O.S. #${proximoNumeroDiarioFormatado} e Enviar`
                              : `Abrir O.S. #${proximoNumeroDiarioFormatado} no ISPFY`}
                          </>
                        )}
                      </Button>

                      {pendenciasEnvio.length > 0 ? (
                        <p className="text-[11px] text-center text-muted-foreground">
                          Pendente: <strong className="text-foreground">{pendenciasEnvio.join(' • ')}</strong>
                        </p>
                      ) : enviarGrupoAoCriar && grupoAtualSelecionado ? (
                        <p className="text-[11px] text-center text-emerald-700 dark:text-emerald-400 font-medium truncate">
                          Destino: {isGrupoAtualFixo ? '📌 ' : ''}
                          {grupoAtualSelecionado.name}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Modal de Configuração da Estrutura / Template da O.S. ─── */}
        <Dialog open={modalModeloAberto} onOpenChange={setModalModeloAberto}>
          <DialogContent className="max-w-2xl bg-card border-border text-card-foreground p-6 rounded-2xl shadow-2xl">
            <DialogHeader className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-500">
                  <Sliders className="w-4 h-4" />
                </div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Personalizar Estrutura da O.S.
                </DialogTitle>
              </div>
              <DialogDescription className="text-muted-foreground text-xs">
                Edite o modelo da mensagem gerada para o WhatsApp. Clique nas variáveis abaixo para
                inseri-las na posição do cursor.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-foreground font-medium">
                  Variáveis dinâmicas disponíveis:
                </Label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
                  {VARIAVEIS_TEMPLATE_OS.map((variavel) => (
                    <button
                      key={variavel.tag}
                      type="button"
                      onClick={() => inserirTagNoModelo(variavel.tag)}
                      title={variavel.desc}
                      className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-[11px] font-mono transition-colors flex items-center gap-1"
                    >
                      <span>+</span>
                      <strong className="font-semibold">{variavel.rotulo}:</strong>
                      <span className="opacity-75">{variavel.tag}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-foreground font-medium">Estrutura do Texto:</Label>
                <Textarea
                  ref={campoModeloRef}
                  value={textoTemporarioModelo}
                  onChange={(e) => setTextoTemporarioModelo(e.target.value)}
                  rows={10}
                  className="bg-background border-input text-foreground font-mono text-xs leading-relaxed rounded-xl"
                  placeholder="Defina o modelo da O.S...."
                />
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={aoRestaurarModeloPadrao}
                className="text-xs h-9 rounded-xl gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                Restaurar Padrão AVL
              </Button>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setModalModeloAberto(false)}
                  className="text-xs h-9 rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={aoSalvarModelo}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 px-4 rounded-xl font-semibold gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Salvar Modelo
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de O.S. Segmentadas de Hoje */}
        <DailyOSModal
          open={modalOrdensDoDiaAberto}
          onOpenChange={setModalOrdensDoDiaAberto}
          orders={ordensDoDia}
          formattedDate={dataFormatada}
          totalCount={contagemDiaria}
        />
      </div>
    </PageTransition>
  );
};

// ─── Subcomponente de Seção Minimalista ───────────────────────────────────────
const SecaoFormularioOS: React.FC<{
  numero: string;
  titulo: string;
  icone: React.ReactNode;
  concluido?: boolean;
  badge?: string;
  children: React.ReactNode;
}> = ({ numero, titulo, icone, concluido, badge, children }) => (
  <div className="rounded-2xl border border-border/75 bg-card shadow-sm overflow-hidden">
    <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between gap-2 bg-secondary/20">
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className={`w-6 h-6 rounded-lg text-[11px] font-bold flex items-center justify-center shrink-0 transition-colors ${
            concluido
              ? 'bg-emerald-500 text-white'
              : 'bg-secondary text-muted-foreground border border-border/70'
          }`}
        >
          {concluido ? <Check className="w-3.5 h-3.5" /> : numero}
        </span>
        <span className="text-emerald-600 dark:text-emerald-400 shrink-0">{icone}</span>
        <span className="text-foreground text-xs sm:text-sm font-semibold tracking-tight truncate">
          {titulo}
        </span>
      </div>
      {badge && (
        <Badge
          variant="outline"
          className="bg-background/80 text-muted-foreground border-border/70 text-[10px] font-medium shrink-0"
        >
          {badge}
        </Badge>
      )}
    </div>
    <div className="p-4 space-y-3.5">{children}</div>
  </div>
);

export default ISPFYNovaOS;

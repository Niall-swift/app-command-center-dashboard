import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Loader2, User, Phone, MapPin, Ticket, CheckCircle2,
  AlertCircle, Send, X, Navigation, Copy, ClipboardList,
  ChevronRight, Radio, Wifi, WifiOff, Zap, Wrench, HelpCircle,
  Cable, Monitor, RotateCcw, Edit3, Sliders, Check, Key,
  CheckCheck, PlusCircle, Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { ispfyService } from '@/services/ispfy/ispfyService';
import { whapiService, DEFAULT_AVL_WHATSAPP_GROUPS } from '@/services/whapi/whapiService';
import type { ISPFYClienteData, ISPFYLoginData, ISPFYContratoData, ISPFYPlanoData } from '@/types/ispfy';
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
  { id: 'lentidao', label: 'Lentidão / Queda de Velocidade', icon: Zap, cor: 'orange' },
  { id: 'intermitencia', label: 'Conexão Intermitente', icon: Radio, cor: 'yellow' },
  { id: 'sem_wifi', label: 'Wi-Fi com Problema', icon: Wifi, cor: 'blue' },
  { id: 'roteador', label: 'Problema no Roteador', icon: Monitor, cor: 'purple' },
  { id: 'cabo', label: 'Cabo Danificado / Solto', icon: Cable, cor: 'pink' },
  { id: 'tecnica', label: 'Visita Técnica Agendada', icon: Wrench, cor: 'green' },
  { id: 'reinstalacao', label: 'Reinstalação / Mudança', icon: RotateCcw, cor: 'teal' },
  { id: 'outro', label: 'Outro Problema', icon: HelpCircle, cor: 'gray' },
];

const MAPA_CORES_PROBLEMAS: Record<string, { chip: string; chipSelecionado: string }> = {
  emerald: { chip: 'border-emerald-500/20 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15', chipSelecionado: 'border-emerald-500 text-emerald-700 dark:text-emerald-300 bg-emerald-500/20 shadow-emerald-500/20' },
  red:     { chip: 'border-red-500/20 text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/15', chipSelecionado: 'border-red-500 text-red-700 dark:text-red-300 bg-red-500/20 shadow-red-500/20' },
  orange:  { chip: 'border-orange-500/20 text-orange-600 dark:text-orange-400 bg-orange-500/10 hover:bg-orange-500/15', chipSelecionado: 'border-orange-500 text-orange-700 dark:text-orange-300 bg-orange-500/20 shadow-orange-500/20' },
  yellow:  { chip: 'border-amber-500/20 text-amber-600 dark:text-yellow-400 bg-amber-500/10 hover:bg-amber-500/15', chipSelecionado: 'border-amber-500 text-amber-700 dark:text-yellow-300 bg-amber-500/20 shadow-amber-500/20' },
  blue:    { chip: 'border-blue-500/20 text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/15', chipSelecionado: 'border-blue-500 text-blue-700 dark:text-blue-300 bg-blue-500/20 shadow-blue-500/20' },
  purple:  { chip: 'border-purple-500/20 text-purple-600 dark:text-purple-400 bg-purple-500/10 hover:bg-purple-500/15', chipSelecionado: 'border-purple-500 text-purple-700 dark:text-purple-300 bg-purple-500/20 shadow-purple-500/20' },
  pink:    { chip: 'border-pink-500/20 text-pink-600 dark:text-pink-400 bg-pink-500/10 hover:bg-pink-500/15', chipSelecionado: 'border-pink-500 text-pink-700 dark:text-pink-300 bg-pink-500/20 shadow-pink-500/20' },
  green:   { chip: 'border-emerald-500/20 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15', chipSelecionado: 'border-emerald-500 text-emerald-700 dark:text-emerald-300 bg-emerald-500/20 shadow-emerald-500/20' },
  teal:    { chip: 'border-teal-500/20 text-teal-600 dark:text-teal-400 bg-teal-500/10 hover:bg-teal-500/15', chipSelecionado: 'border-teal-500 text-teal-700 dark:text-teal-300 bg-teal-500/20 shadow-teal-500/20' },
  gray:    { chip: 'border-border text-muted-foreground bg-secondary/60 hover:bg-secondary', chipSelecionado: 'border-primary/50 text-foreground bg-secondary shadow-sm' },
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

  // Estado dos Grupos WhatsApp
  const [gruposWhatsApp, setGruposWhatsApp] = useState<WhapiGroup[]>(DEFAULT_AVL_WHATSAPP_GROUPS);
  const [carregandoGrupos, setCarregandoGrupos] = useState(false);
  const [grupoSelecionadoPhone, setGrupoSelecionadoPhone] = useState('120363426874994471-group');
  const [enviarGrupoAoCriar, setEnviarGrupoAoCriar] = useState(true);
  const [enviandoParaGrupo, setEnviandoParaGrupo] = useState(false);
  const [grupoEnviadoComSucesso, setGrupoEnviadoComSucesso] = useState<string | null>(null);

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

  useEffect(() => {
    setCarregandoGrupos(true);
    whapiService
      .getGroups()
      .then((grupos) => {
        if (!grupos || grupos.length === 0) return;
        setGruposWhatsApp(grupos);
        const padrao = selecionarGrupoWhatsAppPadrao(grupos);
        if (padrao) {
          setGrupoSelecionadoPhone((atual) => atual || padrao.phone);
        }
      })
      .catch((erro) => {
        console.error('Erro ao buscar grupos do WhatsApp:', erro);
      })
      .finally(() => {
        setCarregandoGrupos(false);
      });
  }, []);

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
    const targetId = clienteIdParam || (statePreselectedClient?.id ? String(statePreselectedClient.id) : '');
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

  // ─── Pré-preenchimento de busca via ?busca= (quando chat ainda não tem vínculo ISPFY) ───
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
        return 'Selecione um cliente para gerar o formato da O.S.';
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

      // Compatibilidade retroativa com modelos salvos sem {numero_diario}
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

      const gruposValidos = gruposWhatsApp.length > 0 ? gruposWhatsApp : DEFAULT_AVL_WHATSAPP_GROUPS;
      const grupoDestino = gruposValidos.find((grupo) => grupo.phone === grupoSelecionadoPhone);
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
              toast.success(`O.S. #${formattedDailyNumber} enviada para o grupo "${nomeGrupo}"!`);
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
      .then(() => toast.success('Informações da O.S. copiadas para a área de transferência!'))
      .catch(() => toast.error('Falha ao copiar informações.'));
  };

  const aoEnviarParaGrupo = async () => {
    if (!grupoSelecionadoPhone) {
      toast.warning('Selecione um grupo do WhatsApp de destino.');
      return;
    }
    const grupoDestino = gruposWhatsApp.find((grupo) => grupo.phone === grupoSelecionadoPhone);
    const nomeGrupo = grupoDestino?.name || 'Grupo selecionado';

    setEnviandoParaGrupo(true);
    try {
      const resposta = await whapiService.sendGroupMessage(grupoSelecionadoPhone, mensagemEfetiva);
      if (resposta.sent) {
        setGrupoEnviadoComSucesso(nomeGrupo);
        toast.success(`O.S. enviada com sucesso para o grupo ${nomeGrupo}!`);
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
    setResultadosBusca([]);
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
  };

  const aoAbrirModalModelo = () => {
    setTextoTemporarioModelo(modeloOS);
    setModalModeloAberto(true);
  };

  const aoSalvarModelo = () => {
    setModeloOS(textoTemporarioModelo);
    localStorage.setItem(CHAVE_STORAGE_TEMPLATE, textoTemporarioModelo);
    setModalModeloAberto(false);
    toast.success('Estrutura e modelo da O.S. salvos com sucesso!');
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

  return (
    <PageTransition>
      <div className="space-y-6 text-foreground">
        {/* Header Premium */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-3xl bg-card border border-border shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-xl shadow-emerald-500/25 ring-1 ring-emerald-400/40">
              <ClipboardList className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Central de Abertura de O.S.</h1>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-semibold uppercase tracking-wider">
                  ISPFY + Z-API
                </Badge>
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 text-[11px] gap-1 px-2.5 py-0.5">
                  <Calendar className="w-3 h-3 text-emerald-500" />
                  Hoje: #{contagemDiaria} O.S. emitidas
                </Badge>
                <Badge variant="outline" className="bg-secondary/60 text-muted-foreground border-border text-[11px] px-2 py-0.5">
                  Próxima do dia: #{proximoNumeroDiarioFormatado}
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs sm:text-sm mt-0.5 font-medium">
                Emissão inteligente com contagem diária segmentada (reinicia automaticamente à meia-noite).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <Button
              variant="outline"
              onClick={() => setModalOrdensDoDiaAberto(true)}
              className="bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs h-10 gap-2 rounded-xl transition-all shadow-sm"
            >
              <ClipboardList className="w-4 h-4 text-emerald-500" />
              <span>Ver O.S. de Hoje</span>
              <Badge className="bg-emerald-500/25 text-emerald-700 dark:text-emerald-200 border-none text-[10px] px-1.5 py-0 h-5">
                {contagemDiaria}
              </Badge>
            </Button>
            <Button
              variant="outline"
              onClick={aoAbrirModalModelo}
              className="bg-secondary hover:bg-secondary/80 border-border text-foreground hover:text-emerald-600 dark:hover:text-emerald-400 text-xs h-10 gap-2 rounded-xl transition-all"
            >
              <Sliders className="w-3.5 h-3.5 text-emerald-500" />
              Editar Estrutura
            </Button>
            <Button
              variant="ghost"
              onClick={aoLimparFormulario}
              className="text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/60 text-xs h-10 gap-1.5 rounded-xl"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Limpar
            </Button>
          </div>
        </motion.div>

        {/* ─── Tela de Sucesso ─── */}
        <AnimatePresence mode="wait">
          {osCriada ? (
            <motion.div
              key="sucesso"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-xl mx-auto"
            >
              <div className="rounded-3xl border border-emerald-500/30 bg-card p-8 flex flex-col items-center gap-6 text-center shadow-xl shadow-emerald-500/5">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.1 }}
                  className="p-6 rounded-full bg-emerald-500/15 ring-8 ring-emerald-500/20 text-emerald-500"
                >
                  <CheckCircle2 className="w-16 h-16" />
                </motion.div>

                <div>
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-xs mb-2">
                    Ordem de Serviço Diária #{numeroDiarioCriado || proximoNumeroDiarioFormatado} Registrada
                  </Badge>
                  <p className="text-3xl font-extrabold text-foreground tracking-tight">
                    O.S. #{numeroDiarioCriado || proximoNumeroDiarioFormatado} do Dia
                  </p>
                  <p className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold mt-1">
                    Protocolo ISPFY: #{idChamadoCriado} • Total hoje: {contagemDiaria} O.S.
                  </p>
                  <p className="text-muted-foreground mt-1.5 text-sm">
                    Cadastrada com sucesso para{' '}
                    <span className="text-emerald-600 dark:text-emerald-300 font-semibold">
                      {obterNomeClienteISPFY(clienteSelecionado)}
                    </span>
                  </p>
                </div>

                {/* Resumo da O.S. criada */}
                <div className="w-full rounded-2xl border border-border divide-y divide-border text-left text-xs overflow-hidden bg-secondary/30">
                  <div className="flex justify-between items-center px-4 py-3">
                    <span className="text-muted-foreground">Plano de Internet</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{planoCliente || 'Não especificado'}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3">
                    <span className="text-muted-foreground">Assunto</span>
                    <span className="text-foreground font-medium">{nomeAssunto}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3">
                    <span className="text-muted-foreground">Prioridade</span>
                    <span className={`font-semibold ${infoPrioridadeAtual.corTexto}`}>
                      {infoPrioridadeAtual.rotulo}
                    </span>
                  </div>
                  {telefoneClienteSelecionado && (
                    <div className="flex justify-between items-center px-4 py-3">
                      <span className="text-muted-foreground">Contato do Cliente</span>
                      <span className="text-foreground">{telefoneClienteSelecionado}</span>
                    </div>
                  )}
                  {enderecoCliente && (
                    <div className="flex justify-between items-start px-4 py-3 gap-3">
                      <span className="text-muted-foreground shrink-0">Endereço</span>
                      <span className="text-foreground text-right">{enderecoCliente}</span>
                    </div>
                  )}
                  {(nomeRedeWifi.trim() || senhaWifi.trim()) && (
                    <div className="flex justify-between items-center px-4 py-3">
                      <span className="text-muted-foreground">Wi-Fi (Instalação)</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-mono font-medium">
                        {nomeRedeWifi.trim() ? `Rede: ${nomeRedeWifi.trim()}` : ''} {senhaWifi.trim() ? `| Senha: ${senhaWifi.trim()}` : ''}
                      </span>
                    </div>
                  )}
                </div>

                {/* Ações de Envio e Cópia */}
                <div className="w-full flex flex-col gap-3">
                  <div className="w-full p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-left space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <IconeWhatsApp className="w-4 h-4 text-emerald-500" />
                        Disparar para Grupo WhatsApp
                      </span>
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-400/30">
                        {gruposWhatsApp.length} grupos
                      </Badge>
                    </div>

                    <Select
                      value={grupoSelecionadoPhone}
                      onValueChange={setGrupoSelecionadoPhone}
                    >
                      <SelectTrigger className="w-full bg-background border-input text-foreground h-11 text-xs focus:ring-emerald-500">
                        <SelectValue placeholder="Selecione o grupo..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 bg-popover border-border text-popover-foreground z-50">
                        {gruposWhatsApp.map((grupo) => (
                          <SelectItem
                            key={grupo.phone}
                            value={grupo.phone}
                            className="text-xs focus:bg-emerald-500/20 focus:text-emerald-600 dark:focus:text-emerald-300 cursor-pointer"
                          >
                            👥 {grupo.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      onClick={aoEnviarParaGrupo}
                      disabled={enviandoParaGrupo || !grupoSelecionadoPhone || carregandoGrupos}
                      className="w-full h-11 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99]"
                      style={{
                        background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                        boxShadow: '0 4px 20px rgba(37,211,102,0.35)',
                      }}
                    >
                      {enviandoParaGrupo ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                      ) : (
                        <><Send className="w-4 h-4" /> Enviar para o Grupo Selecionado</>
                      )}
                    </Button>

                    {grupoEnviadoComSucesso && (
                      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs">
                        <CheckCheck className="w-4 h-4 shrink-0 text-emerald-500" />
                        <span>Enviada com sucesso para: <strong>{grupoEnviadoComSucesso}</strong></span>
                      </div>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    onClick={aoCopiarInformacoes}
                    className="w-full flex items-center justify-center gap-2 border-border text-foreground hover:bg-secondary h-11 rounded-xl text-sm font-semibold"
                  >
                    <Copy className="w-4 h-4 text-emerald-500" />
                    Copiar Dados da O.S.
                  </Button>

                  <Button
                    onClick={aoLimparFormulario}
                    className="w-full flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground bg-secondary hover:bg-secondary/80 border border-border"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Criar Nova Ordem de Serviço
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
              className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start"
            >
              {/* Coluna Principal: Formulário */}
              <div className="xl:col-span-7 space-y-6">
                {/* 1. Seleção de Cliente e Plano */}
                <SecaoFormularioOS
                  titulo="1. Cliente & Plano de Internet"
                  icone={<User className="w-4 h-4 text-emerald-500" />}
                >
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      value={termoBusca}
                      onChange={(e) => aoAlterarBusca(e.target.value)}
                      placeholder="Buscar por nome, telefone ou CPF..."
                      className="pl-10 pr-10 bg-background border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-emerald-500 h-11 text-sm rounded-xl"
                    />
                    {(carregandoBusca || carregandoClientePreselecionado) && (
                      <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 animate-spin" />
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
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {carregandoClientePreselecionado && !clienteSelecionado && (
                    <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-emerald-500" />
                      <span>Carregando dados do cliente selecionado...</span>
                    </div>
                  )}

                  {/* Resultados da busca */}
                  <AnimatePresence>
                    {resultadosBusca.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="rounded-2xl border border-border overflow-hidden divide-y divide-border max-h-[280px] overflow-y-auto custom-scrollbar bg-popover shadow-xl text-popover-foreground"
                      >
                        {resultadosBusca.map((cliente) => {
                          const telefone = obterTelefoneClienteISPFY(cliente);
                          const localidade = cliente.endereco_cobranca_bairro || cliente.cidade;
                          return (
                            <button
                              key={cliente.id}
                              onClick={() => aoSelecionarCliente(cliente)}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors text-left group"
                            >
                              <div className="w-8 h-8 rounded-xl bg-secondary group-hover:bg-emerald-500/20 flex items-center justify-center transition-colors shrink-0">
                                <User className="w-3.5 h-3.5 text-muted-foreground group-hover:text-emerald-500 transition-colors" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {obterNomeClienteISPFY(cliente)}
                                </p>
                                <div className="flex items-center gap-3 mt-0.5">
                                  {telefone && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Phone className="w-2.5 h-2.5" />{telefone}
                                    </span>
                                  )}
                                  {localidade && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <MapPin className="w-2.5 h-2.5" />{localidade}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {isRegistroAtivo(cliente.ativo) && (
                                <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                                  Ativo
                                </Badge>
                              )}
                              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-emerald-500 transition-colors shrink-0" />
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Card do Cliente Selecionado */}
                  <AnimatePresence>
                    {clienteSelecionado && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-2xl border border-emerald-500/30 p-4 space-y-4 bg-emerald-500/5 dark:bg-emerald-500/10"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400 font-bold text-base shadow-sm">
                              {obterNomeClienteISPFY(clienteSelecionado).charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-foreground font-bold text-base truncate">
                                {obterNomeClienteISPFY(clienteSelecionado)}
                              </p>
                              <p className="text-muted-foreground text-xs">ID ISPFY: #{clienteSelecionado.id}</p>
                            </div>
                          </div>
                          {isRegistroAtivo(clienteSelecionado.ativo) ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs shrink-0">
                              Ativo
                            </Badge>
                          ) : (
                            <Badge className="bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30 text-xs shrink-0">
                              Inativo
                            </Badge>
                          )}
                        </div>

                        {/* 📶 Card de Plano de Internet */}
                        <div className="p-3.5 rounded-xl bg-card border border-border space-y-2.5 shadow-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                              <Wifi className="w-3.5 h-3.5" /> Plano de Internet
                              {carregandoPlano && <Loader2 className="w-3 h-3 animate-spin text-emerald-500 ml-1" />}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setEditandoPlano(!editandoPlano)}
                                className="text-[11px] text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1 transition-colors"
                              >
                                <Edit3 className="w-3 h-3" />
                                {editandoPlano ? 'Concluir' : 'Digitar manual'}
                              </button>
                            </div>
                          </div>

                          {carregandoPlano ? (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                              <span>Identificando plano de internet no ISPFY...</span>
                            </div>
                          ) : editandoPlano ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={planoCliente}
                                onChange={(e) => setPlanoCliente(e.target.value)}
                                placeholder="Digite o nome do plano (ex: FIBRA 700 MEGA)..."
                                className="bg-background border-emerald-500/40 text-foreground text-xs h-9"
                              />
                              <Button
                                size="sm"
                                onClick={() => setEditandoPlano(false)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 px-3 text-xs"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-foreground tracking-wide flex items-center gap-1.5">
                                  {planoCliente ? (
                                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 text-xs py-1 px-2.5">
                                      <Zap className="w-3 h-3 mr-1 text-emerald-500" /> {planoCliente}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground italic text-xs">Nenhum plano identificado</span>
                                  )}
                                </span>
                                {contratosCliente.length > 1 && (
                                  <Badge variant="outline" className="text-[10px] bg-secondary text-muted-foreground border-border">
                                    {contratosCliente.length} contratos
                                  </Badge>
                                )}
                              </div>

                              {todosPlanos.length > 0 && (
                                <div className="flex items-center gap-2">
                                  <Select
                                    value={planoCliente}
                                    onValueChange={setPlanoCliente}
                                  >
                                    <SelectTrigger className="w-full sm:w-[240px] h-7 text-[11px] bg-background border-border text-foreground hover:border-emerald-500/40">
                                      <SelectValue placeholder="Trocar / Selecionar Plano..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-popover border-border text-popover-foreground text-xs max-h-64 z-50">
                                      {todosPlanos.map((plano) => (
                                        <SelectItem key={plano.id} value={plano.nome || plano.descricao || `Plano #${plano.id}`}>
                                          {plano.nome || plano.descricao} {plano.valor_mensal && plano.valor_mensal !== '0.00' ? `— R$ ${plano.valor_mensal}` : ''}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Credenciais PPPoE */}
                        {loginsCliente.length > 0 && (
                          <div className="p-3 rounded-xl bg-secondary/50 border border-border space-y-1.5 text-xs">
                            <span className="text-muted-foreground text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1">
                              <Key className="w-3 h-3 text-amber-500" /> Acesso PPPoE do Cliente
                            </span>
                            <div className="flex flex-wrap gap-3 items-center pt-0.5">
                              <div className="flex items-center gap-1.5 bg-background px-2.5 py-1 rounded-lg border border-border">
                                <span className="text-muted-foreground">Login:</span>
                                <span className="text-foreground font-mono font-medium">{loginsCliente[0]?.usuario || loginsCliente[0]?.login || '–'}</span>
                              </div>
                              <div className="flex items-center gap-1.5 bg-background px-2.5 py-1 rounded-lg border border-border">
                                <span className="text-muted-foreground">Senha:</span>
                                <span className="text-foreground font-mono font-medium">{loginsCliente[0]?.senha || '–'}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Detalhes de Contato e Endereço */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {telefoneClienteSelecionado && (
                            <LinhaDetalheOS
                              icone={<Phone className="w-3.5 h-3.5 text-emerald-500" />}
                              rotulo="Telefone / WhatsApp"
                              valor={telefoneClienteSelecionado}
                            />
                          )}
                          {enderecoCliente && (
                            <LinhaDetalheOS
                              icone={<MapPin className="w-3.5 h-3.5 text-blue-500" />}
                              rotulo="Endereço"
                              valor={enderecoCliente}
                            />
                          )}
                        </div>

                        {/* Configuração de Wi-Fi (Instalação / Troca de Roteador) */}
                        <div className="p-3.5 rounded-xl bg-card border border-border space-y-2.5 shadow-sm">
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                            <Wifi className="w-3.5 h-3.5 text-emerald-500" /> Rede Wi-Fi (Instalação / Roteador)
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                                Nome da Rede Wi-Fi (SSID)
                              </Label>
                              <Input
                                value={nomeRedeWifi}
                                onChange={(e) => setNomeRedeWifi(e.target.value)}
                                placeholder="Ex: AVL_FIBRA_CLIENTE"
                                className="bg-background border-input text-foreground placeholder:text-muted-foreground text-xs h-9 rounded-xl focus-visible:ring-emerald-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                                Senha do Wi-Fi
                              </Label>
                              <Input
                                value={senhaWifi}
                                onChange={(e) => setSenhaWifi(e.target.value)}
                                placeholder="Ex: @senha1234"
                                className="bg-background border-input text-foreground placeholder:text-muted-foreground text-xs h-9 rounded-xl focus-visible:ring-emerald-500 font-mono"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Ponto de Referência */}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                            <Navigation className="w-3 h-3 text-emerald-500" /> Ponto de Referência para a Equipe
                          </Label>
                          <Input
                            value={pontoReferencia}
                            onChange={(e) => setPontoReferencia(e.target.value)}
                            placeholder="Ex: Próximo à padaria, em frente ao poste com transformador..."
                            className="bg-background border-input text-foreground placeholder:text-muted-foreground text-xs h-9 rounded-xl focus-visible:ring-emerald-500"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </SecaoFormularioOS>

                {/* 2. Tipo de Problema */}
                <SecaoFormularioOS
                  titulo="2. Tipo de Problema"
                  icone={<AlertCircle className="w-4 h-4 text-emerald-500" />}
                  badge={problemasSelecionados.length > 0 ? `${problemasSelecionados.length} selecionado(s)` : undefined}
                >
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {OPCOES_PROBLEMAS.map((problema) => {
                      const selecionado = problemasSelecionados.includes(problema.id);
                      const cores = MAPA_CORES_PROBLEMAS[problema.cor];
                      const Icone = problema.icon;
                      return (
                        <motion.button
                          key={problema.id}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => alternarProblema(problema.id)}
                          className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl border text-xs font-medium transition-all duration-200 ${
                            selecionado
                              ? `${cores.chipSelecionado} scale-[1.02]`
                              : cores.chip
                          }`}
                        >
                          {selecionado && (
                            <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-current/20 flex items-center justify-center">
                              <CheckCircle2 className="w-3 h-3" />
                            </span>
                          )}
                          <Icone className="w-5 h-5" />
                          <span className="text-center leading-tight">{problema.label}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </SecaoFormularioOS>

                {/* 3. Assunto e Prioridade */}
                <SecaoFormularioOS
                  titulo="3. Assunto & Prioridade"
                  icone={<Ticket className="w-4 h-4 text-emerald-500" />}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-foreground font-medium">
                        Assunto do Chamado <span className="text-red-500">*</span>
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
                            setNomeAssunto(assuntos.find((item) => item.id === valor)?.assunto ?? valor);
                          }}
                        >
                          <SelectTrigger className="bg-background border-input text-foreground focus:ring-emerald-500 text-xs h-10 rounded-xl">
                            <SelectValue placeholder="Selecione o assunto..." />
                          </SelectTrigger>
                          <SelectContent className="bg-popover border-border text-popover-foreground max-h-52 z-50">
                            {assuntos.map((assunto) => (
                              <SelectItem
                                key={assunto.id}
                                value={assunto.id}
                                className="focus:bg-emerald-500/20 focus:text-emerald-700 dark:focus:text-emerald-300 text-xs cursor-pointer"
                              >
                                {assunto.assunto}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-foreground font-medium">Nível de Prioridade</Label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {Object.entries(ROTULOS_PRIORIDADE_OS).map(([chave, info]) => (
                          <button
                            key={chave}
                            onClick={() => setPrioridade(chave)}
                            className={`h-10 rounded-xl text-xs font-semibold border transition-all ${
                              prioridade === chave
                                ? `${info.classeChip} ${info.corTexto} scale-[1.04] shadow-sm`
                                : 'bg-secondary/40 border-border text-muted-foreground hover:bg-secondary hover:text-foreground'
                            }`}
                          >
                            {info.rotulo}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Observação adicional */}
                  <div className="space-y-1.5 pt-1">
                    <Label className="text-xs text-foreground font-medium">Observações adicionais para o técnico</Label>
                    <Textarea
                      value={observacao}
                      onChange={(e) => setObservacao(e.target.value)}
                      placeholder="Descreva observações específicas, instruções ou avisos..."
                      rows={3}
                      className="bg-background border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-emerald-500 resize-none text-xs rounded-xl"
                    />
                  </div>
                </SecaoFormularioOS>

                {/* 4. Destino no WhatsApp (Grupos da Equipe) */}
                <SecaoFormularioOS
                  titulo="4. Destino no WhatsApp (Equipe de Operações)"
                  icone={<IconeWhatsApp className="w-4 h-4 text-emerald-500" />}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-foreground font-medium">
                        Grupo WhatsApp que receberá a O.S.:
                      </Label>
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/30">
                        {gruposWhatsApp.length} grupos conectados
                      </Badge>
                    </div>

                    <Select
                      value={grupoSelecionadoPhone}
                      onValueChange={setGrupoSelecionadoPhone}
                    >
                      <SelectTrigger className="w-full bg-background border-input text-foreground h-11 text-xs focus:ring-emerald-500 rounded-xl">
                        <SelectValue placeholder="Selecione o grupo..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 bg-popover border-border text-popover-foreground z-50">
                        {gruposWhatsApp.map((grupo) => (
                          <SelectItem
                            key={grupo.phone}
                            value={grupo.phone}
                            className="text-xs focus:bg-emerald-500/20 focus:text-emerald-700 dark:focus:text-emerald-300 cursor-pointer"
                          >
                            👥 {grupo.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <label className="flex items-center gap-2.5 cursor-pointer pt-1 select-none">
                      <input
                        type="checkbox"
                        checked={enviarGrupoAoCriar}
                        onChange={(e) => setEnviarGrupoAoCriar(e.target.checked)}
                        className="w-4 h-4 rounded border-border bg-background text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="text-xs text-foreground">
                        Disparar mensagem no grupo selecionado automaticamente ao abrir a O.S.
                      </span>
                    </label>
                  </div>
                </SecaoFormularioOS>
              </div>

              {/* ─── Coluna Direita: Live Console & WhatsApp Preview (5 Colunas) ─── */}
              <div className="xl:col-span-5 flex flex-col gap-5">
                <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden sticky top-6 space-y-4 p-5">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                        <IconeWhatsApp className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-foreground uppercase tracking-wider">Pré-visualização</p>
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[9px] px-1.5 py-0 font-mono">
                            Próxima do dia: #{proximoNumeroDiarioFormatado}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">WhatsApp O.S. • {dataFormatada}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditandoMensagemAoVivo(!editandoMensagemAoVivo)}
                        className="h-8 px-2.5 text-xs text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg gap-1 border border-border"
                      >
                        <Edit3 className="w-3 h-3 text-emerald-500" />
                        {editandoMensagemAoVivo ? 'Visualizar' : 'Editar Texto'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={aoAbrirModalModelo}
                        title="Personalizar Estrutura Padrão"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg border border-border"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Bubble de Mensagem WhatsApp */}
                  <div className="p-4 rounded-2xl border border-emerald-500/30 text-xs font-mono relative leading-relaxed bg-emerald-50/90 text-emerald-950 dark:bg-emerald-950/40 dark:border-emerald-500/30 dark:text-emerald-100 shadow-inner">
                    {editandoMensagemAoVivo ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-amber-600 dark:text-amber-300 font-semibold">
                          <span>✏️ Modo de edição manual ativo:</span>
                          {textoManualOS !== null && (
                            <button
                              onClick={() => { setTextoManualOS(null); setEditandoMensagemAoVivo(false); }}
                              className="text-muted-foreground hover:text-foreground underline text-[10px]"
                            >
                              Restaurar gerado
                            </button>
                          )}
                        </div>
                        <Textarea
                          value={textoManualOS !== null ? textoManualOS : gerarTextoOS()}
                          onChange={(e) => setTextoManualOS(e.target.value)}
                          rows={14}
                          className="bg-background border-emerald-500/40 text-foreground text-xs font-mono leading-relaxed rounded-xl resize-none"
                        />
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap select-text max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
                        {mensagemEfetiva}
                      </div>
                    )}

                    <div className="mt-3 pt-2.5 border-t border-emerald-500/20 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{mensagemEfetiva.length} caracteres</span>
                      {textoManualOS !== null && (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">● Texto editado manualmente</span>
                      )}
                    </div>
                  </div>

                  {/* Ações Rápidas */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      variant="outline"
                      onClick={aoCopiarInformacoes}
                      disabled={!clienteSelecionado}
                      className="bg-secondary hover:bg-secondary/80 border-border text-foreground text-xs h-10 gap-1.5 rounded-xl"
                    >
                      <Copy className="w-3.5 h-3.5 text-emerald-500" />
                      Copiar O.S.
                    </Button>
                    <Button
                      variant="outline"
                      onClick={aoAbrirModalModelo}
                      className="bg-secondary hover:bg-secondary/80 border-border text-foreground text-xs h-10 gap-1.5 rounded-xl"
                    >
                      <Sliders className="w-3.5 h-3.5 text-blue-500" />
                      Modelo Base
                    </Button>
                  </div>

                  {/* Mapa Geográfico */}
                  <div className="rounded-2xl border border-border overflow-hidden bg-secondary/30">
                    <div className="px-3.5 py-2 border-b border-border flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-500" /> Localização do Cliente
                      </span>
                      {linksMapa.urlDireta && (
                        <a
                          href={linksMapa.urlDireta}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-600 dark:text-emerald-400 hover:underline text-[11px] flex items-center gap-1 transition-colors font-medium"
                        >
                          <Navigation className="w-3 h-3" /> Abrir Maps
                        </a>
                      )}
                    </div>

                    {linksMapa.urlIncorporada ? (
                      <div className="relative" style={{ paddingBottom: '60%' }}>
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
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/60">
                        <MapPin className="w-8 h-8 mb-1.5 opacity-40" />
                        <p className="text-xs">Selecione o cliente para visualizar o mapa</p>
                      </div>
                    )}
                  </div>

                  {/* Botão de Envio Principal */}
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={aoCriarOS}
                    disabled={criandoOS || !clienteSelecionado || !assuntoSelecionado}
                    className="w-full h-13 py-3.5 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-xl shadow-emerald-600/25"
                    style={{
                      background: 'linear-gradient(135deg, #059669 0%, #16a34a 100%)',
                    }}
                  >
                    {criandoOS ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Registrando e Despachando O.S....</>
                    ) : (
                      <><Send className="w-5 h-5" /> Abrir O.S. e Enviar para Grupo</>
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Modal de Configuração da Estrutura / Template da O.S. ─── */}
        <Dialog open={modalModeloAberto} onOpenChange={setModalModeloAberto}>
          <DialogContent className="max-w-2xl bg-card border-border text-card-foreground p-6 rounded-3xl shadow-2xl">
            <DialogHeader className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-500">
                  <Sliders className="w-5 h-5" />
                </div>
                <DialogTitle className="text-xl font-bold text-foreground">
                  Personalizar Estrutura da O.S.
                </DialogTitle>
              </div>
              <DialogDescription className="text-muted-foreground text-xs">
                Edite a forma e o layout como a Ordem de Serviço será gerada e enviada para o WhatsApp. Clique nas variáveis abaixo para inseri-las no modelo.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-foreground font-medium">
                  Variáveis dinâmicas disponíveis (clique para inserir):
                </Label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto custom-scrollbar p-1">
                  {VARIAVEIS_TEMPLATE_OS.map((variavel) => (
                    <button
                      key={variavel.tag}
                      type="button"
                      onClick={() => inserirTagNoModelo(variavel.tag)}
                      title={variavel.desc}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-mono transition-all flex items-center gap-1"
                    >
                      <span>+</span>
                      <strong className="font-semibold">{variavel.rotulo}:</strong>
                      <span className="opacity-75">{variavel.tag}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-foreground font-medium">
                  Estrutura do Texto:
                </Label>
                <Textarea
                  ref={campoModeloRef}
                  value={textoTemporarioModelo}
                  onChange={(e) => setTextoTemporarioModelo(e.target.value)}
                  rows={10}
                  className="bg-background border-input text-foreground font-mono text-xs leading-relaxed focus-visible:ring-emerald-500 rounded-xl"
                  placeholder="Defina o modelo da O.S...."
                />
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={aoRestaurarModeloPadrao}
                className="bg-secondary border-border text-foreground hover:bg-secondary/80 text-xs h-10 rounded-xl"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                Restaurar Padrão AVL
              </Button>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setModalModeloAberto(false)}
                  className="text-muted-foreground hover:text-foreground text-xs h-10 rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={aoSalvarModelo}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-10 px-5 rounded-xl font-semibold gap-1.5 shadow-lg shadow-emerald-600/30"
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

// ─── Subcomponentes auxiliares ────────────────────────────────────────────────
const SecaoFormularioOS: React.FC<{
  titulo: string;
  icone: React.ReactNode;
  badge?: string;
  children: React.ReactNode;
}> = ({ titulo, icone, badge, children }) => (
  <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
    <div className="px-5 py-3.5 border-b border-border/70 flex items-center justify-between bg-card">
      <div className="flex items-center gap-2">
        <span className="text-emerald-500 dark:text-emerald-400">{icone}</span>
        <span className="text-foreground text-sm font-semibold tracking-wide">{titulo}</span>
      </div>
      {badge && (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 text-[10px]">
          {badge}
        </Badge>
      )}
    </div>
    <div className="p-5 space-y-4">{children}</div>
  </div>
);

const LinhaDetalheOS: React.FC<{ icone: React.ReactNode; rotulo: string; valor: string }> = ({
  icone,
  rotulo,
  valor,
}) => (
  <div className="flex items-start gap-2.5 rounded-xl bg-secondary/50 border border-border px-3 py-2">
    <span className="mt-0.5 shrink-0">{icone}</span>
    <div className="min-w-0 flex-1">
      <p className="text-muted-foreground text-[10px] uppercase tracking-wide font-medium">{rotulo}</p>
      <p className="text-foreground text-xs font-medium break-all">{valor}</p>
    </div>
  </div>
);

export default ISPFYNovaOS;

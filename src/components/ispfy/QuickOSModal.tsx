import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { IconeWhatsApp } from '@/components/icons/IconeWhatsApp';
import { ispfyService } from '@/services/ispfy/ispfyService';
import type { ISPFYClienteData } from '@/types/ispfy';
import { whapiService, DEFAULT_AVL_WHATSAPP_GROUPS } from '@/services/whapi/whapiService';
import type { WhapiGroup } from '@/types/whapi';
import { toast } from 'sonner';
import { useDailyOS } from '@/hooks/useDailyOS';
import { usePinnedOsGroup } from '@/hooks/usePinnedOsGroup';
import { abrirConversaWhatsApp } from '@/lib/utils';
import {
  ROTULOS_PRIORIDADE_OS,
  buscarClientesISPFYHibrido,
  isRegistroAtivo,
  obterNomeClienteISPFY,
  obterTelefoneClienteISPFY,
  selecionarGrupoWhatsAppPadrao,
} from '@/utils/ispfyFormatters';
import {
  Search,
  Loader2,
  CheckCircle2,
  User,
  Phone,
  MapPin,
  Ticket,
  ChevronRight,
  ChevronLeft,
  Send,
  X,
  AlertCircle,
  PlusCircle,
  Copy,
  Wifi,
  Pin,
} from 'lucide-react';

interface QuickOSModalProps {
  /** Se fornecido, pula direto para o passo 2 (dados da O.S.) */
  preselectedClient?: ISPFYClienteData;
  /** Permite voltar ao passo 1 para trocar o cliente mesmo quando pré-selecionado */
  allowChangeClient?: boolean;
  /** Trigger personalizado — passe null para controlar via open/onOpenChange sem trigger */
  trigger?: React.ReactNode | null;
  /** Estado controlado de abertura (opcional) */
  open?: boolean;
  /** Callback controlado de abertura (opcional) */
  onOpenChange?: (open: boolean) => void;
  /** Callback chamado após criação bem-sucedida */
  onSuccess?: (ticketId: string) => void;
}

const obterRegiaoCliente = (cliente: ISPFYClienteData): string =>
  cliente.endereco_cobranca_bairro || cliente.cidade || '';

export const QuickOSModal: React.FC<QuickOSModalProps> = ({
  preselectedClient,
  allowChangeClient = false,
  trigger,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  onSuccess,
}) => {
  const [abertoInterno, setAbertoInterno] = useState(false);
  const aberto = openProp !== undefined ? openProp : abertoInterno;
  const setAberto = useCallback(
    (proximo: boolean) => {
      if (openProp === undefined) {
        setAbertoInterno(proximo);
      }
      onOpenChangeProp?.(proximo);
    },
    [openProp, onOpenChangeProp]
  );

  // Etapa 1 = buscar cliente | 2 = dados da O.S. | 3 = sucesso
  const [etapa, setEtapa] = useState<1 | 2 | 3>(preselectedClient ? 2 : 1);

  // ── Etapa 1: busca ─────────────────────────────────────────────────────────
  const [termoBusca, setTermoBusca] = useState('');
  const [todosClientes, setTodosClientes] = useState<ISPFYClienteData[]>([]);
  const [resultadosBusca, setResultadosBusca] = useState<ISPFYClienteData[]>([]);
  const [carregandoBusca, setCarregandoBusca] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState<ISPFYClienteData | null>(
    preselectedClient ?? null
  );
  const timerBuscaRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Etapa 2: dados da O.S. ─────────────────────────────────────────────────
  const [assuntos, setAssuntos] = useState<{ id: string; assunto: string }[]>([]);
  const [carregandoAssuntos, setCarregandoAssuntos] = useState(false);
  const [assuntoSelecionado, setAssuntoSelecionado] = useState('');
  const [nomeAssunto, setNomeAssunto] = useState('');
  const [prioridade, setPrioridade] = useState('N');
  const [mensagem, setMensagem] = useState('');
  const [planoCliente, setPlanoCliente] = useState('');
  const [nomeRedeWifi, setNomeRedeWifi] = useState('');
  const [senhaWifi, setSenhaWifi] = useState('');
  const [criandoOS, setCriandoOS] = useState(false);

  // ── Etapa 3: sucesso & Envio WhatsApp ──────────────────────────────────────
  const [chamadoCriadoId, setChamadoCriadoId] = useState('');
  const [numeroDiarioCriado, setNumeroDiarioCriado] = useState<string | null>(null);

  // ─── Contagem Diária de O.S. (Reinicia a cada dia às 00:00) ───────────────
  const {
    count: contagemDiaria,
    formattedNextDailyNumber: proximoNumeroDiarioFormatado,
    registerOS: registrarOS,
  } = useDailyOS();

  const {
    pinnedGroupPhone,
    pinnedGroupName,
    autoSendToGroup,
    pinGroup,
    setAutoSendToGroup,
  } = usePinnedOsGroup();

  const [gruposWhatsApp, setGruposWhatsApp] = useState<WhapiGroup[]>(DEFAULT_AVL_WHATSAPP_GROUPS);
  const [carregandoGrupos, setCarregandoGrupos] = useState(false);
  const [grupoSelecionadoPhone, setGrupoSelecionadoPhone] = useState(
    () => pinnedGroupPhone || '120363426874994471-group'
  );
  const [enviarGrupoAoCriar, setEnviarGrupoAoCriar] = useState(autoSendToGroup);
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

  useEffect(() => {
    setEnviarGrupoAoCriar(autoSendToGroup);
  }, [autoSendToGroup]);

  useEffect(() => {
    if (pinnedGroupPhone && !grupoAlteradoManualRef.current) {
      setGrupoSelecionadoPhone(pinnedGroupPhone);
    }
  }, [pinnedGroupPhone]);

  const gruposCarregadosRef = useRef(false);

  // Só busca grupos do WhatsApp na Z-API quando o modal é realmente aberto
  useEffect(() => {
    if (!aberto || gruposCarregadosRef.current) return;
    gruposCarregadosRef.current = true;
    setCarregandoGrupos(true);
    whapiService
      .getGroups()
      .then((grupos) => {
        if (!grupos || grupos.length === 0) return;
        setGruposWhatsApp(grupos);
        if (!pinnedGroupPhone) {
          const padrao = selecionarGrupoWhatsAppPadrao(grupos);
          if (padrao) {
            setGrupoSelecionadoPhone((atual) => atual || padrao.phone);
          }
        }
      })
      .catch((err) => {
        gruposCarregadosRef.current = false;
        console.error(err);
      })
      .finally(() => setCarregandoGrupos(false));
  }, [aberto, pinnedGroupPhone]);

  useEffect(() => {
    return () => {
      if (timerBuscaRef.current) clearTimeout(timerBuscaRef.current);
    };
  }, []);

  // ─── Reset quando abre/fecha ───────────────────────────────────────────────
  useEffect(() => {
    if (!aberto) return;
    let cancelado = false;

    setAssuntoSelecionado('');
    setNomeAssunto('');
    setPrioridade('N');
    setMensagem('');
    setNomeRedeWifi('');
    setSenhaWifi('');
    setChamadoCriadoId('');
    setNumeroDiarioCriado(null);
    setGrupoEnviadoComSucesso(null);
    grupoAlteradoManualRef.current = false;
    if (pinnedGroupPhone) {
      setGrupoSelecionadoPhone(pinnedGroupPhone);
    }

    if (preselectedClient) {
      setClienteSelecionado(preselectedClient);
      setPlanoCliente('');
      setEtapa(2);
      if (preselectedClient.id) {
        ispfyService
          .getClientPlanDetails(preselectedClient.id)
          .then((detalhes) => {
            if (!cancelado) setPlanoCliente(detalhes.planName);
          })
          .catch(console.error);

        if (!obterTelefoneClienteISPFY(preselectedClient)) {
          ispfyService
            .getClienteContatos(preselectedClient.id)
            .then((contatos) => {
              if (cancelado || !contatos || contatos.length === 0) return;
              const foneCelular =
                contatos.find((ct) => ct.tipo_contato === 'c')?.contato || contatos[0].contato;
              const foneWhatsapp = contatos.find((ct) => ct.pode_enviar_mensagem === 's')?.contato;
              setClienteSelecionado((atual) =>
                atual && atual.id === preselectedClient.id
                  ? {
                      ...atual,
                      fone_celular: atual.fone_celular || foneCelular,
                      fone_whatsapp: atual.fone_whatsapp || foneWhatsapp,
                    }
                  : atual
              );
            })
            .catch(console.error);
        }
      }
    } else {
      setEtapa(1);
      setClienteSelecionado(null);
      setTermoBusca('');
      setResultadosBusca([]);
      setPlanoCliente('');
    }

    return () => {
      cancelado = true;
    };
  }, [aberto, preselectedClient, pinnedGroupPhone]);

  // ─── Carregar assuntos ao entrar na etapa 2 ────────────────────────────────
  useEffect(() => {
    if (etapa !== 2 || assuntos.length > 0) return;
    setCarregandoAssuntos(true);
    ispfyService
      .getTicketSubjects()
      .then(setAssuntos)
      .catch(() => toast.error('Erro ao carregar assuntos'))
      .finally(() => setCarregandoAssuntos(false));
  }, [etapa, assuntos.length]);

  const carregarTodosClientes = useCallback(async () => {
    setCarregandoBusca(true);
    try {
      const clientes = await ispfyService.getClientesAtivos();
      setTodosClientes(clientes);
      setResultadosBusca(clientes);
    } catch {
      setTodosClientes([]);
      setResultadosBusca([]);
    } finally {
      setCarregandoBusca(false);
    }
  }, []);

  useEffect(() => {
    if (aberto && etapa === 1 && todosClientes.length === 0) {
      carregarTodosClientes();
    }
  }, [aberto, etapa, todosClientes.length, carregarTodosClientes]);

  // ─── Busca Híbrida ─────────────────────────────────────────────────────────
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

  useEffect(() => {
    if (aberto && etapa === 1 && !termoBusca) {
      aoAlterarBusca('');
    }
  }, [aberto, etapa, termoBusca, aoAlterarBusca]);

  const aoSelecionarCliente = (cliente: ISPFYClienteData) => {
    setClienteSelecionado(cliente);
    setEtapa(2);
    if (cliente.id) {
      ispfyService
        .getClientPlanDetails(cliente.id)
        .then((detalhes) => setPlanoCliente(detalhes.planName))
        .catch(console.error);
    }
  };

  const montarMensagemChamado = (): string => {
    const redeLimpa = nomeRedeWifi.trim();
    const senhaLimpa = senhaWifi.trim();
    if (!redeLimpa && !senhaLimpa) return mensagem;

    const partesWifi: string[] = [];
    if (redeLimpa) partesWifi.push(`Wi-Fi: ${redeLimpa}`);
    if (senhaLimpa) partesWifi.push(`Senha: ${senhaLimpa}`);
    return `${mensagem}\n${partesWifi.join(' | ')}`;
  };

  const montarTextoGrupoOS = (idChamadoSobrescrito?: string, numeroDiarioSobrescrito?: string): string => {
    const idChamado = idChamadoSobrescrito || chamadoCriadoId || 'PENDENTE';
    const numeroDiario =
      numeroDiarioSobrescrito || numeroDiarioCriado || proximoNumeroDiarioFormatado;
    const rotuloPrioridade = ROTULOS_PRIORIDADE_OS[prioridade]?.rotulo || prioridade;
    const nomeCliente = obterNomeClienteISPFY(clienteSelecionado);
    const telefoneCliente = obterTelefoneClienteISPFY(clienteSelecionado, 'Não informado');
    const regiaoCliente = clienteSelecionado ? obterRegiaoCliente(clienteSelecionado) : '';

    return (
      `🛠 *O.S. #${numeroDiario} – Ordem de Serviço* (ISPFY #${idChamado})\n` +
      `👤 *Cliente:* ${nomeCliente}\n` +
      `📞 *Contato:* ${telefoneCliente}\n` +
      (planoCliente ? `📶 *Plano:* ${planoCliente}\n` : '') +
      (nomeRedeWifi.trim() ? `📶 *Rede Wi-Fi:* ${nomeRedeWifi.trim()}\n` : '') +
      (senhaWifi.trim() ? `🔒 *Senha Wi-Fi:* ${senhaWifi.trim()}\n` : '') +
      `📌 *Assunto:* ${nomeAssunto}\n` +
      `⚡ *Prioridade:* ${rotuloPrioridade}\n` +
      (regiaoCliente ? `📍 *Endereço/Região:* ${regiaoCliente}\n` : '') +
      (mensagem ? `📝 *Descrição:* ${mensagem}\n` : '')
    );
  };

  const aoCriarOS = async () => {
    if (!clienteSelecionado?.id || !assuntoSelecionado || !mensagem.trim()) {
      toast.warning('Preencha todos os campos obrigatórios.');
      return;
    }

    setCriandoOS(true);
    try {
      const resultado = await ispfyService.createTicket({
        id_cliente: clienteSelecionado.id,
        id_assunto: assuntoSelecionado,
        prioridade,
        mensagem: montarMensagemChamado(),
      });

      if (!resultado.success) {
        toast.error('Erro ao abrir O.S.', { description: resultado.message });
        return;
      }

      const idChamado = resultado.id ?? '';
      setChamadoCriadoId(idChamado);

      const gruposValidos = gruposDisponiveis.length > 0 ? gruposDisponiveis : DEFAULT_AVL_WHATSAPP_GROUPS;
      const grupoDestino = gruposValidos.find((grupo) => grupo.phone === grupoSelecionadoPhone);
      const nomeGrupo = grupoDestino?.name || 'Grupo selecionado';

      const { formattedDailyNumber } = await registrarOS({
        ticketId: idChamado,
        clientId: clienteSelecionado.id,
        clientName: obterNomeClienteISPFY(clienteSelecionado),
        phone: obterTelefoneClienteISPFY(clienteSelecionado, 'Não informado'),
        plan: planoCliente,
        subject: nomeAssunto,
        priority: prioridade,
        address: obterRegiaoCliente(clienteSelecionado),
        observation: mensagem,
        wifiSsid: nomeRedeWifi.trim() || undefined,
        wifiPassword: senhaWifi.trim() || undefined,
        whatsappSent: !!(enviarGrupoAoCriar && grupoSelecionadoPhone),
        whatsappGroup: nomeGrupo,
        fullMessage: montarTextoGrupoOS(idChamado, proximoNumeroDiarioFormatado),
      });

      setNumeroDiarioCriado(formattedDailyNumber);
      setEtapa(3);
      onSuccess?.(idChamado);
      toast.success(`O.S. #${formattedDailyNumber} criada hoje! (ISPFY #${idChamado})`);

      if (enviarGrupoAoCriar && grupoSelecionadoPhone) {
        const texto = montarTextoGrupoOS(idChamado, formattedDailyNumber);
        whapiService
          .sendGroupMessage(grupoSelecionadoPhone, texto)
          .then((resposta) => {
            if (resposta.sent) {
              setGrupoEnviadoComSucesso(nomeGrupo);
              toast.success(`O.S. #${formattedDailyNumber} enviada para o grupo "${nomeGrupo}"!`);
            } else {
              toast.error(`O.S. criada, mas falhou envio ao WhatsApp: ${resposta.error}`);
            }
          })
          .catch(console.error);
      }
    } catch {
      toast.error('Erro de comunicação com o servidor.');
    } finally {
      setCriandoOS(false);
    }
  };

  const aoCopiarInformacoes = () => {
    const texto = montarTextoGrupoOS();
    navigator.clipboard
      .writeText(texto)
      .then(() => toast.success('Informações da O.S. copiadas!'))
      .catch(() => toast.error('Falha ao copiar.'));
  };

  const aoEnviarParaGrupo = async () => {
    if (!grupoSelecionadoPhone) {
      toast.warning('Selecione um grupo do WhatsApp.');
      return;
    }
    const grupoDestino = gruposDisponiveis.find((grupo) => grupo.phone === grupoSelecionadoPhone);
    const nomeGrupo = grupoDestino?.name || 'Grupo selecionado';

    setEnviandoParaGrupo(true);
    try {
      const texto = montarTextoGrupoOS();
      const resposta = await whapiService.sendGroupMessage(grupoSelecionadoPhone, texto);
      if (resposta.sent) {
        setGrupoEnviadoComSucesso(nomeGrupo);
        toast.success(`O.S. enviada com sucesso para o grupo ${nomeGrupo}!`);
      } else {
        toast.error(`Falha ao enviar para o grupo: ${resposta.error || 'Erro desconhecido'}`);
      }
    } catch {
      toast.error('Erro ao enviar mensagem.');
    } finally {
      setEnviandoParaGrupo(false);
    }
  };

  const aoNotificarClienteWhatsApp = () => {
    const telefoneBruto =
      clienteSelecionado?.fone_whatsapp ||
      clienteSelecionado?.fone_celular ||
      clienteSelecionado?.telefone_celular ||
      '';

    if (!telefoneBruto.replace(/\D/g, '')) {
      toast.warning('Este cliente não possui número de WhatsApp cadastrado.');
      return;
    }

    const nomeCliente = obterNomeClienteISPFY(clienteSelecionado, 'Cliente');
    const rotuloPrioridade = ROTULOS_PRIORIDADE_OS[prioridade]?.rotulo || prioridade;

    const textoCodificado = encodeURIComponent(
      `🛠 *Ordem de Serviço Aberta*\n` +
      `Olá, *${nomeCliente}*!\n` +
      `Seu chamado foi registrado com sucesso.\n\n` +
      `📋 *O.S. Nº:* ${chamadoCriadoId || 'N/A'}\n` +
      `📌 *Assunto:* ${nomeAssunto}\n` +
      `⚡ *Prioridade:* ${rotuloPrioridade}\n` +
      `📝 *Descrição:* ${mensagem}\n\n` +
      `Nossa equipe entrará em contato em breve. Obrigado! 🙏`
    );

    abrirConversaWhatsApp(telefoneBruto, textoCodificado);
  };

  const possuiWhatsApp = !!(
    clienteSelecionado?.fone_whatsapp ||
    clienteSelecionado?.fone_celular ||
    clienteSelecionado?.telefone_celular
  );

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      {trigger !== null && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button
              size="sm"
              className="bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-700 hover:to-green-600 text-white shadow-lg shadow-green-500/20 border-0 gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              Nova O.S.
            </Button>
          )}
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-lg p-0 overflow-hidden border border-border bg-card shadow-2xl text-card-foreground">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-green-500/30">
              <Ticket className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-foreground text-lg font-bold">
                  {etapa === 1 && 'Nova Ordem de Serviço'}
                  {etapa === 2 && 'Dados da O.S.'}
                  {etapa === 3 && 'O.S. Criada com Sucesso!'}
                </DialogTitle>
                <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-semibold">
                  Hoje: #{contagemDiaria}
                </Badge>
              </div>
              {/* Indicador de etapas */}
              <div className="flex items-center gap-1.5 mt-1">
                {[1, 2, 3].map((passo) => (
                  <div
                    key={passo}
                    className={`h-1.5 rounded-full transition-all duration-300 ${passo === etapa
                        ? 'w-6 bg-emerald-500'
                        : passo < etapa
                          ? 'w-3 bg-emerald-600'
                          : 'w-3 bg-secondary'
                      }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="px-6 py-5 min-h-[320px]">
          <AnimatePresence mode="wait">
            {/* ─── ETAPA 1: Buscar Cliente ─── */}
            {etapa === 1 && (
              <motion.div
                key="etapa1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    autoFocus
                    value={termoBusca}
                    onChange={(e) => aoAlterarBusca(e.target.value)}
                    placeholder="Buscar cliente por nome..."
                    className="pl-10 bg-background border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-emerald-500"
                  />
                  {carregandoBusca && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 animate-spin" />
                  )}
                </div>

                <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1 custom-scroll">
                  {resultadosBusca.length > 0 ? (
                    resultadosBusca.map((cliente) => {
                      const telefone = obterTelefoneClienteISPFY(cliente, 'Não informado');
                      const regiao = obterRegiaoCliente(cliente);
                      return (
                        <motion.button
                          key={cliente.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          onClick={() => aoSelecionarCliente(cliente)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl bg-secondary/40 hover:bg-secondary border border-border hover:border-emerald-500/40 transition-all text-left group"
                        >
                          <div className="p-2 rounded-lg bg-secondary group-hover:bg-emerald-500/20 transition-colors">
                            <User className="w-4 h-4 text-muted-foreground group-hover:text-emerald-500 transition-colors" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors truncate">
                              {obterNomeClienteISPFY(cliente)}
                            </p>
                            <div className="flex items-center gap-3 mt-1">
                              {telefone && (
                                <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-emerald-500" />
                                  {telefone}
                                </span>
                              )}
                              {regiao && (
                                <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-sky-500" />
                                  {regiao}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isRegistroAtivo(cliente.ativo) && (
                              <Badge className="h-5 text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 border">
                                Ativo
                              </Badge>
                            )}
                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-emerald-500 transition-colors" />
                          </div>
                        </motion.button>
                      );
                    })
                  ) : termoBusca.length > 1 && !carregandoBusca ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                      <AlertCircle className="w-8 h-8 mb-2 opacity-60" />
                      <p className="text-sm font-medium">Nenhum cliente encontrado para "{termoBusca}"</p>
                    </div>
                  ) : !termoBusca ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                      <Search className="w-8 h-8 mb-2 opacity-60" />
                      <p className="text-sm font-medium">Digite o nome do cliente para buscar</p>
                    </div>
                  ) : null}
                </div>
              </motion.div>
            )}

            {/* ─── ETAPA 2: Dados da OS ─── */}
            {etapa === 2 && (
              <motion.div
                key="etapa2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {clienteSelecionado && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                    <div className="p-2 rounded-lg bg-emerald-500/20">
                      <User className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {obterNomeClienteISPFY(clienteSelecionado)}
                      </p>
                      <p className="text-xs text-muted-foreground font-medium truncate mt-0.5">
                        {obterTelefoneClienteISPFY(clienteSelecionado, 'Sem telefone')} · ID {clienteSelecionado.id}
                      </p>
                    </div>
                    {(!preselectedClient || allowChangeClient) && (
                      <button
                        type="button"
                        onClick={() => setEtapa(1)}
                        title="Trocar cliente"
                        className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}

                {/* Plano de Internet */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/40 border border-border text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                    <Wifi className="w-3.5 h-3.5 text-emerald-500" /> Plano do Cliente:
                  </span>
                  <input
                    value={planoCliente}
                    onChange={(e) => setPlanoCliente(e.target.value)}
                    placeholder="Clique para informar plano..."
                    className="bg-transparent border-b border-border text-emerald-600 dark:text-emerald-400 font-semibold text-xs px-1 text-right focus:outline-none focus:border-emerald-500 max-w-[220px]"
                  />
                </div>

                {/* Wi-Fi SSID e Senha */}
                <div className="p-3 rounded-xl bg-secondary/40 border border-border space-y-2 text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                    <Wifi className="w-3.5 h-3.5 text-emerald-500" /> Rede Wi-Fi (Instalação / Troca)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Nome da Rede (SSID)</Label>
                      <Input
                        value={nomeRedeWifi}
                        onChange={(e) => setNomeRedeWifi(e.target.value)}
                        placeholder="Ex: AVL_FIBRA_CLIENTE"
                        className="bg-background border-input text-foreground h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Senha do Wi-Fi</Label>
                      <Input
                        value={senhaWifi}
                        onChange={(e) => setSenhaWifi(e.target.value)}
                        placeholder="Ex: @senha1234"
                        className="bg-background border-input text-foreground h-8 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Assunto */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Assunto <span className="text-red-500">*</span>
                  </Label>
                  {carregandoAssuntos ? (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm p-2">
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                      Carregando assuntos...
                    </div>
                  ) : (
                    <Select
                      value={assuntoSelecionado}
                      onValueChange={(valor) => {
                        setAssuntoSelecionado(valor);
                        const encontrado = assuntos.find((item) => item.id === valor);
                        setNomeAssunto(encontrado?.assunto ?? valor);
                      }}
                    >
                      <SelectTrigger className="bg-background border-input text-foreground focus:ring-emerald-500">
                        <SelectValue placeholder="Selecione o assunto..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border text-popover-foreground">
                        {assuntos.map((assunto) => (
                          <SelectItem
                            key={assunto.id}
                            value={assunto.id}
                            className="focus:bg-emerald-500/20 focus:text-emerald-700 dark:focus:text-emerald-300"
                          >
                            {assunto.assunto}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Prioridade */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Prioridade</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {Object.entries(ROTULOS_PRIORIDADE_OS).map(([chave, info]) => (
                      <button
                        key={chave}
                        onClick={() => setPrioridade(chave)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all ${prioridade === chave
                            ? `${info.classeBadge} scale-[1.02] shadow-sm`
                            : 'bg-secondary/50 border-border text-muted-foreground hover:bg-secondary hover:text-foreground'
                          }`}
                      >
                        {info.rotulo}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mensagem */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Descrição do problema <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                    placeholder="Descreva o problema do cliente..."
                    rows={3}
                    className="bg-background border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-emerald-500 resize-none text-xs"
                  />
                </div>

                {/* Destino WhatsApp Grupo */}
                <div className="space-y-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <IconeWhatsApp /> Grupo WhatsApp de Destino
                    </Label>
                    <button
                      type="button"
                      onClick={() => {
                        const target = gruposDisponiveis.find((g) => g.phone === grupoSelecionadoPhone);
                        if (!target) return;
                        void pinGroup(target.phone, target.name).then(() => {
                          grupoAlteradoManualRef.current = false;
                          toast.success(`Grupo fixo para O.S. salvo: ${target.name}`);
                        });
                      }}
                      disabled={!grupoSelecionadoPhone || pinnedGroupPhone === grupoSelecionadoPhone}
                      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                        pinnedGroupPhone === grupoSelecionadoPhone
                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                          : 'bg-background text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-300 border-border hover:border-emerald-500/40'
                      }`}
                    >
                      <Pin className="w-2.5 h-2.5" />
                      {pinnedGroupPhone === grupoSelecionadoPhone ? 'Grupo fixo' : 'Fixar grupo'}
                    </button>
                  </div>

                  <Select
                    value={grupoSelecionadoPhone}
                    onValueChange={(val) => {
                      grupoAlteradoManualRef.current = true;
                      setGrupoSelecionadoPhone(val);
                    }}
                  >
                    <SelectTrigger className="bg-background border-input text-foreground h-9 text-xs focus:ring-emerald-500">
                      <SelectValue placeholder="Selecione o grupo..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-56 bg-popover border-border text-popover-foreground z-50">
                      {gruposDisponiveis.map((grupo) => (
                        <SelectItem
                          key={grupo.phone}
                          value={grupo.phone}
                          className="text-xs focus:bg-emerald-500/20 focus:text-emerald-700 dark:focus:text-emerald-300 cursor-pointer"
                        >
                          {grupo.phone === pinnedGroupPhone ? '📌 ' : '👥 '}
                          {grupo.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <label className="flex items-center gap-2 cursor-pointer pt-0.5 select-none">
                    <input
                      type="checkbox"
                      checked={enviarGrupoAoCriar}
                      onChange={(e) => {
                        setEnviarGrupoAoCriar(e.target.checked);
                        void setAutoSendToGroup(e.target.checked);
                      }}
                      className="w-3.5 h-3.5 rounded border-border bg-background text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="text-[11px] text-foreground">
                      Enviar automaticamente para o grupo ao registrar
                    </span>
                  </label>
                </div>
              </motion.div>
            )}

            {/* ─── ETAPA 3: Sucesso ─── */}
            {etapa === 3 && (
              <motion.div
                key="etapa3"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center justify-center py-6 space-y-5"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.1 }}
                  className="p-5 rounded-full bg-emerald-500/15 ring-4 ring-emerald-500/20"
                >
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </motion.div>

                <div className="text-center space-y-1">
                  <p className="text-foreground font-bold text-lg">
                    O.S. #{numeroDiarioCriado || proximoNumeroDiarioFormatado} do Dia Aberta!
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                    Protocolo ISPFY: #{chamadoCriadoId}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    A ordem de serviço foi criada para{' '}
                    <span className="text-foreground font-semibold">
                      {clienteSelecionado ? obterNomeClienteISPFY(clienteSelecionado) : 'o cliente'}
                    </span>
                    .
                  </p>
                </div>

                {/* Resumo da O.S. */}
                <div className="w-full p-4 rounded-xl bg-secondary/40 border border-border space-y-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-muted-foreground font-medium">Assunto</span>
                    <span className="text-foreground text-right font-semibold truncate max-w-[200px]">
                      {nomeAssunto}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-medium">Prioridade</span>
                    <Badge
                      className={`text-[10px] border ${ROTULOS_PRIORIDADE_OS[prioridade]?.classeBadge || ''}`}
                    >
                      {ROTULOS_PRIORIDADE_OS[prioridade]?.rotulo || prioridade}
                    </Badge>
                  </div>
                  {(nomeRedeWifi.trim() || senhaWifi.trim()) && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-medium">Wi-Fi</span>
                      <span className="text-emerald-600 dark:text-emerald-400 text-xs font-mono font-medium">
                        {nomeRedeWifi.trim() ? `Rede: ${nomeRedeWifi.trim()}` : ''} {senhaWifi.trim() ? `| Senha: ${senhaWifi.trim()}` : ''}
                      </span>
                    </div>
                  )}
                  {clienteSelecionado && obterTelefoneClienteISPFY(clienteSelecionado) && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-medium">WhatsApp</span>
                      <span className="text-foreground text-xs font-semibold">
                        {obterTelefoneClienteISPFY(clienteSelecionado)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Envio Direto para Grupos do WhatsApp */}
                <div className="w-full p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-left space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <IconeWhatsApp />
                      Enviar para Grupo WhatsApp
                    </span>
                    {gruposWhatsApp.length > 0 && (
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/30 font-medium">
                        {gruposWhatsApp.length} grupos
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-foreground text-xs font-medium">
                      Grupo de Destino:
                    </Label>
                    {carregandoGrupos ? (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary border border-border text-xs text-muted-foreground">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                        Carregando grupos...
                      </div>
                    ) : (
                      <Select
                        value={grupoSelecionadoPhone}
                        onValueChange={setGrupoSelecionadoPhone}
                      >
                        <SelectTrigger className="w-full bg-background border-input text-foreground h-10 text-xs focus:ring-emerald-500">
                          <SelectValue placeholder="Selecione o grupo..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-60 bg-popover border-border text-popover-foreground">
                          {gruposDisponiveis.map((grupo) => (
                            <SelectItem
                              key={grupo.phone}
                              value={grupo.phone}
                              className="text-xs focus:bg-emerald-500/20 focus:text-emerald-700 dark:focus:text-emerald-300 cursor-pointer"
                            >
                              {grupo.phone === pinnedGroupPhone ? '📌 ' : '👥 '}
                              {grupo.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <Button
                    onClick={aoEnviarParaGrupo}
                    disabled={enviandoParaGrupo || !grupoSelecionadoPhone || carregandoGrupos}
                    className="w-full h-11 rounded-lg font-semibold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] text-xs"
                    style={{
                      background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                      boxShadow: '0 4px 16px rgba(37,211,102,0.3)',
                    }}
                  >
                    {enviandoParaGrupo ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Enviando O.S. para o grupo...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        Enviar O.S. para o Grupo Selecionado
                      </>
                    )}
                  </Button>

                  {grupoEnviadoComSucesso && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                      <span>Enviada para <strong>{grupoEnviadoComSucesso}</strong>!</span>
                    </div>
                  )}
                </div>

                {/* Copiar e Envio Individual ao Cliente */}
                <div className="w-full space-y-2">
                  <Button
                    variant="outline"
                    onClick={aoCopiarInformacoes}
                    className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-secondary hover:bg-secondary/80 border-border text-foreground text-xs font-semibold"
                  >
                    <Copy className="w-3.5 h-3.5 text-emerald-500" />
                    Copiar Informações da O.S.
                  </Button>

                  {possuiWhatsApp && (
                    <Button
                      variant="ghost"
                      onClick={aoNotificarClienteWhatsApp}
                      className="w-full flex items-center justify-center gap-2 h-10 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-500/10 text-xs"
                    >
                      <IconeWhatsApp />
                      Notificar Cliente via WhatsApp Direto
                    </Button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center justify-between gap-3 border-t border-border pt-4">
          {etapa === 1 && (
            <Button
              variant="ghost"
              onClick={() => setAberto(false)}
              className="text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              Cancelar
            </Button>
          )}
          {etapa === 2 && (
            <>
              {!preselectedClient || allowChangeClient ? (
                <Button
                  variant="ghost"
                  onClick={() => setEtapa(1)}
                  className="text-muted-foreground hover:text-foreground hover:bg-secondary gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {preselectedClient ? 'Trocar cliente' : 'Voltar'}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => setAberto(false)}
                  className="text-muted-foreground hover:text-foreground hover:bg-secondary"
                >
                  Cancelar
                </Button>
              )}
              <Button
                onClick={aoCriarOS}
                disabled={criandoOS || !assuntoSelecionado || !mensagem.trim()}
                className="bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-700 hover:to-green-600 text-white border-0 shadow-lg shadow-green-500/20 disabled:opacity-40 gap-2"
              >
                {criandoOS ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Ticket className="w-4 h-4" />
                )}
                {criandoOS ? 'Criando...' : 'Criar O.S.'}
              </Button>
            </>
          )}
          {etapa === 3 && (
            <Button
              variant="ghost"
              onClick={() => setAberto(false)}
              className="ml-auto text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              Fechar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuickOSModal;

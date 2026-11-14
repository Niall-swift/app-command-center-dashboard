import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FilterX,
  Lock,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import { useNetworkMonitor } from '@/contexts/NetworkMonitorContext';
import {
  agregarResumosPorRegiao,
  normalizarTextoSemAcento,
} from '@/services/ispfy/regionAuditHelpers';
import type {
  ISPFYClientRegionRecord,
  ISPFYConnectionHealthStatus,
  ISPFYRegionGroupSummary,
  ISPFYStreetGroupSummary,
} from '@/types/ispfy';
import { abrirConversaWhatsApp, baixarArquivoCsv } from '@/lib/utils';
import { formatarDataHoraCurta } from '@/utils/date';
import {
  formatarConsumoDados,
  formatarDocumentoCpfCnpj,
} from '@/utils/ispfyFormatters';
import { toast } from 'sonner';

type FiltroStatusConexao =
  | 'ALL'
  | 'OK'
  | 'DESCONECTADO'
  | 'BLOQUEADO'
  | 'INATIVO';
type ModoOrdenacaoResumo = 'disconnected' | 'volume' | 'alpha';

const TAMANHO_PAGINA = 50;

const PRIORIDADE_SAUDE_TABELA: Record<ISPFYConnectionHealthStatus, number> = {
  desconectado: 0,
  bloqueado_offline: 1,
  bloqueado_online: 2,
  ok: 3,
  inativo: 4,
};

const ROTULOS_EXPORTACAO_SAUDE: Record<ISPFYConnectionHealthStatus, string> = {
  ok: 'Internet OK (Online)',
  desconectado: 'Desconectado (Offline)',
  bloqueado_online: 'Bloqueado (Pool Bloqueio Online)',
  bloqueado_offline: 'Bloqueado (Offline)',
  inativo: 'Contrato Inativo/Cancelado',
};

function correspondeFiltroStatus(
  saude: ISPFYConnectionHealthStatus,
  filtro: FiltroStatusConexao
): boolean {
  if (filtro === 'ALL') return true;
  if (filtro === 'OK') return saude === 'ok';
  if (filtro === 'DESCONECTADO') return saude === 'desconectado';
  if (filtro === 'BLOQUEADO') {
    return saude === 'bloqueado_online' || saude === 'bloqueado_offline';
  }
  return saude === 'inativo';
}

function ordenarGruposRegiao<T extends ISPFYRegionGroupSummary>(
  itens: T[],
  modo: ModoOrdenacaoResumo
): T[] {
  const copia = [...itens];
  if (modo === 'disconnected') {
    return copia.sort(
      (a, b) =>
        b.desconectados - a.desconectados ||
        b.totalPontos - a.totalPontos ||
        a.label.localeCompare(b.label, 'pt-BR')
    );
  }
  if (modo === 'alpha') {
    return copia.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }
  return copia.sort(
    (a, b) =>
      b.totalPontos - a.totalPontos || a.label.localeCompare(b.label, 'pt-BR')
  );
}

/** Exibe badges padronizadas com totais OK, desconectados e bloqueados de um bairro ou rua. */
const BadgesSaudeGrupo: React.FC<{ grupo: ISPFYRegionGroupSummary }> = ({
  grupo,
}) => (
  <div className="flex items-center gap-1.5 shrink-0">
    <Badge
      variant="outline"
      className="text-[10px] border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-500/5"
    >
      {grupo.internetOk} OK
    </Badge>
    <Badge
      variant="outline"
      className={`text-[10px] ${
        grupo.desconectados > 0
          ? 'border-rose-500/50 text-rose-700 dark:text-rose-300 bg-rose-500/10 font-bold'
          : 'border-slate-300/60 text-muted-foreground'
      }`}
    >
      {grupo.desconectados} off
    </Badge>
    {grupo.bloqueados > 0 && (
      <Badge
        variant="outline"
        className="text-[10px] border-amber-500/30 text-amber-700 dark:text-amber-300 bg-amber-500/5"
      >
        {grupo.bloqueados} bloq
      </Badge>
    )}
  </div>
);

function renderizarBadgeConexao(registro: ISPFYClientRegionRecord) {
  switch (registro.connectionHealth) {
    case 'ok':
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[11px] gap-1 font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Internet OK
        </Badge>
      );
    case 'desconectado':
      return (
        <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-[11px] gap-1 font-semibold">
          <WifiOff className="w-3 h-3" />
          Desconectado (
          {registro.sessaoConexaoStatus === 'none'
            ? 'Sem sessão'
            : registro.sessaoConexaoStatus}
          )
        </Badge>
      );
    case 'bloqueado_online':
      return (
        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[11px] gap-1 font-semibold">
          <Lock className="w-3 h-3" />
          Bloqueado (Online)
        </Badge>
      );
    case 'bloqueado_offline':
      return (
        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[11px] gap-1 font-semibold">
          <Lock className="w-3 h-3" />
          Bloqueado (Off)
        </Badge>
      );
    case 'inativo':
      return (
        <Badge variant="secondary" className="text-[11px] gap-1">
          Contrato Inativo
        </Badge>
      );
  }
}

/** Tela territorial com agrupamento de clientes por bairro, rua e saúde da conexão. */
export default function ISPFYClientesRegiao() {
  const navegar = useNavigate();
  const [parametrosUrl] = useSearchParams();
  const {
    dadosRegiao,
    carregandoRegiao,
    atualizarConexoes,
    revalidarPontoAoVivo,
    rompimentosEmMassa,
    rompimentosConfirmados,
    outagesMonitorados,
    outageConfig,
    sireneAtiva,
    sireneSilenciada,
    tocarSireneRompimento,
    pararSirene,
    ativarAlertaRompimentoRegiao,
    resolverRompimentoRegiao,
    enviarAlertaRompimentoGrupo,
  } = useNetworkMonitor();

  const [agoraMs, setAgoraMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const temPendente = outagesMonitorados.some((w) => w.active && !w.whatsappSentAtMs);
    if (!temPendente) return;
    setAgoraMs(Date.now());
    const id = setInterval(() => setAgoraMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [outagesMonitorados]);

  const [recarregamentoManual, setRecarregamentoManual] =
    useState<boolean>(false);
  const [mensagemProgresso, setMensagemProgresso] = useState<string>(
    'Carregando clientes e conexões do ISPFY...'
  );
  const carregando = recarregamentoManual || (!dadosRegiao && carregandoRegiao);

  // Filtros
  const [bairroSelecionado, setBairroSelecionado] = useState<string>('ALL');
  const [ruaSelecionadaComp, setRuaSelecionadaComp] = useState<string>('ALL');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatusConexao>('ALL');
  const [termoBusca, setTermoBusca] = useState<string>('');
  const [incluirInativos, setIncluirInativos] = useState<boolean>(false);
  const [ordenacaoResumo, setOrdenacaoResumo] =
    useState<ModoOrdenacaoResumo>('disconnected');
  const [paginaAtual, setPaginaAtual] = useState<number>(1);
  const [pontoVerificandoId, setPontoVerificandoId] = useState<string | null>(
    null
  );

  // Sincroniza query params (?status=DESCONECTADO&bairro=FIGUEIRAS&search=...)
  useEffect(() => {
    const paramStatus = parametrosUrl.get('status')?.toUpperCase();
    const paramBairro = parametrosUrl.get('bairro');
    const paramBusca = parametrosUrl.get('search');

    if (
      paramStatus === 'ALL' ||
      paramStatus === 'OK' ||
      paramStatus === 'DESCONECTADO' ||
      paramStatus === 'BLOQUEADO' ||
      paramStatus === 'INATIVO'
    ) {
      setFiltroStatus(paramStatus);
      if (paramStatus === 'INATIVO') setIncluirInativos(true);
      setPaginaAtual(1);
    }

    if (paramBairro) {
      setBairroSelecionado(paramBairro);
      setRuaSelecionadaComp('ALL');
      setPaginaAtual(1);
    }

    if (paramBusca !== null) {
      setTermoBusca(paramBusca);
      setPaginaAtual(1);
    }
  }, [parametrosUrl]);

  const carregarDados = async (forcarAtualizacao = false) => {
    setRecarregamentoManual(true);
    setMensagemProgresso(
      'Atualizando base de clientes e status PPPoE no ISPFY...'
    );
    try {
      await atualizarConexoes(forcarAtualizacao);
      if (forcarAtualizacao) {
        toast.success('Conexões e endereços atualizados ao vivo do ISPFY!');
      }
    } catch (erroCaptura: unknown) {
      const mensagemErro =
        erroCaptura instanceof Error
          ? erroCaptura.message
          : 'Falha de comunicação';
      console.error('Erro ao carregar clientes por bairro/rua:', erroCaptura);
      toast.error('Erro ao consultar dados no ISPFY: ' + mensagemErro);
    } finally {
      setRecarregamentoManual(false);
    }
  };

  // Ao mudar o bairro, limpa a seleção de rua se ela não pertence ao bairro escolhido
  const aoSelecionarBairro = (chaveBairro: string) => {
    setBairroSelecionado(chaveBairro);
    if (
      chaveBairro !== 'ALL' &&
      ruaSelecionadaComp !== 'ALL' &&
      !ruaSelecionadaComp.startsWith(`${chaveBairro}::`)
    ) {
      setRuaSelecionadaComp('ALL');
    }
    setPaginaAtual(1);
  };

  const aoSelecionarRua = (rua: ISPFYStreetGroupSummary) => {
    if (ruaSelecionadaComp === rua.key) {
      setRuaSelecionadaComp('ALL');
    } else {
      setBairroSelecionado(rua.bairroKey);
      setRuaSelecionadaComp(rua.key);
    }
    setPaginaAtual(1);
  };

  const aoLimparFiltros = () => {
    setBairroSelecionado('ALL');
    setRuaSelecionadaComp('ALL');
    setFiltroStatus('ALL');
    setTermoBusca('');
    setPaginaAtual(1);
  };

  const possuiFiltrosAtivos =
    bairroSelecionado !== 'ALL' ||
    ruaSelecionadaComp !== 'ALL' ||
    filtroStatus !== 'ALL' ||
    termoBusca.trim() !== '';

  // Base respeitando o toggle "Incluir cancelados/inativos"
  const registrosEscopoAtivo = useMemo(() => {
    if (!dadosRegiao) return [];
    return incluirInativos
      ? dadosRegiao.records
      : dadosRegiao.records.filter((registro) => registro.isContractActive);
  }, [dadosRegiao, incluirInativos]);

  // Busca textual isolada (para manter as contagens consistentes entre os painéis e os selects)
  const registrosFiltradosBusca = useMemo(() => {
    const buscaNormalizada = normalizarTextoSemAcento(termoBusca);
    const buscaDigitos = termoBusca.replace(/\D/g, '');
    if (!buscaNormalizada && !buscaDigitos) return registrosEscopoAtivo;

    return registrosEscopoAtivo.filter((registro) => {
      const textoCompleto = normalizarTextoSemAcento(
        `${registro.nome} ${registro.ruaLabel} ${registro.numero} ${registro.complemento} ${registro.bairroLabel} ${registro.cidade} ${registro.usuarioPppoe} ${registro.ipAlocado} ${registro.mac} ${registro.plano}`
      );
      if (buscaNormalizada && textoCompleto.includes(buscaNormalizada)) {
        return true;
      }
      if (buscaDigitos.length > 0) {
        const cpfDigitos = registro.cpfCnpj.replace(/\D/g, '');
        const telefoneDigitos = registro.telefone.replace(/\D/g, '');
        if (
          cpfDigitos.includes(buscaDigitos) ||
          telefoneDigitos.includes(buscaDigitos) ||
          registro.clienteId.includes(buscaDigitos) ||
          registro.pontoId.includes(buscaDigitos)
        ) {
          return true;
        }
      }
      return false;
    });
  }, [registrosEscopoAtivo, termoBusca]);

  // Agregação por Bairro/Rua sobre a base filtrada por busca + toggle ativo
  const resumoBaseRegiao = useMemo(
    () => agregarResumosPorRegiao(registrosFiltradosBusca),
    [registrosFiltradosBusca]
  );

  // Recorte Bairro + Rua antes do filtro de Status (para calcular os contadores dos botões de Status)
  const registrosEscopoLocal = useMemo(() => {
    return registrosFiltradosBusca.filter((registro) => {
      if (
        bairroSelecionado !== 'ALL' &&
        registro.bairroKey !== bairroSelecionado
      ) {
        return false;
      }
      if (
        ruaSelecionadaComp !== 'ALL' &&
        `${registro.bairroKey}::${registro.ruaKey}` !== ruaSelecionadaComp
      ) {
        return false;
      }
      return true;
    });
  }, [registrosFiltradosBusca, bairroSelecionado, ruaSelecionadaComp]);

  const resumoLocal = useMemo(
    () => agregarResumosPorRegiao(registrosEscopoLocal),
    [registrosEscopoLocal]
  );

  // Registros finais na tabela (Bairro + Rua + Busca + Status)
  const registrosFinaisFiltrados = useMemo(() => {
    const listaFiltrada =
      filtroStatus === 'ALL'
        ? registrosEscopoLocal
        : registrosEscopoLocal.filter((registro) =>
            correspondeFiltroStatus(registro.connectionHealth, filtroStatus)
          );

    return [...listaFiltrada].sort(
      (a, b) =>
        PRIORIDADE_SAUDE_TABELA[a.connectionHealth] -
          PRIORIDADE_SAUDE_TABELA[b.connectionHealth] ||
        a.bairroLabel.localeCompare(b.bairroLabel, 'pt-BR') ||
        a.ruaLabel.localeCompare(b.ruaLabel, 'pt-BR') ||
        a.nome.localeCompare(b.nome, 'pt-BR')
    );
  }, [registrosEscopoLocal, filtroStatus]);

  const resumoFinalTabela = useMemo(
    () => agregarResumosPorRegiao(registrosFinaisFiltrados),
    [registrosFinaisFiltrados]
  );

  // Listas para os dropdowns e cards laterais
  const bairrosOrdenados = useMemo(
    () => ordenarGruposRegiao(resumoBaseRegiao.bairros, ordenacaoResumo),
    [resumoBaseRegiao.bairros, ordenacaoResumo]
  );

  const ruasDoEscopo = useMemo(() => {
    const listaRuas =
      bairroSelecionado === 'ALL'
        ? resumoBaseRegiao.ruas
        : resumoBaseRegiao.ruas.filter(
            (rua) => rua.bairroKey === bairroSelecionado
          );
    return ordenarGruposRegiao(listaRuas, ordenacaoResumo);
  }, [resumoBaseRegiao.ruas, bairroSelecionado, ordenacaoResumo]);

  // Paginação da tabela
  const totalPaginas = Math.max(
    1,
    Math.ceil(registrosFinaisFiltrados.length / TAMANHO_PAGINA)
  );
  const paginaSegura = Math.min(paginaAtual, totalPaginas);
  const registrosPaginados = useMemo(() => {
    const inicio = (paginaSegura - 1) * TAMANHO_PAGINA;
    return registrosFinaisFiltrados.slice(inicio, inicio + TAMANHO_PAGINA);
  }, [registrosFinaisFiltrados, paginaSegura]);

  // Consulta individual ao vivo no ISPFY (/api/tool/assinante/ponto/status)
  const aoRevalidarClienteAoVivo = async (registro: ISPFYClientRegionRecord) => {
    if (!registro.clienteId) return;
    setPontoVerificandoId(registro.pontoId);
    try {
      const pontoAtualizado = await revalidarPontoAoVivo(
        registro.clienteId,
        registro.pontoId
      );

      if (!pontoAtualizado) {
        toast.info(
          `Ponto #${registro.pontoId} não retornou sessão ativa no ISPFY.`
        );
        return;
      }

      const textoStatus = pontoAtualizado.isBlocked
        ? `Bloqueado (${pontoAtualizado.conexaoStatus.toUpperCase()})`
        : pontoAtualizado.conexaoStatus === 'online'
        ? 'Internet OK (ONLINE)'
        : `Desconectado (${pontoAtualizado.conexaoStatus.toUpperCase()})`;
      toast.success(`${registro.nome}: ${textoStatus}`);
    } catch (erroCaptura: unknown) {
      const mensagemErro =
        erroCaptura instanceof Error ? erroCaptura.message : 'Erro de API';
      toast.error(
        'Não foi possível verificar o ponto ao vivo: ' + mensagemErro
      );
    } finally {
      setPontoVerificandoId(null);
    }
  };

  const aoCopiarTexto = (texto: string, rotulo: string) => {
    navigator.clipboard.writeText(texto);
    toast.success(`${rotulo} copiado!`);
  };

  const aoExportarCsv = () => {
    if (registrosFinaisFiltrados.length === 0) return;

    const nomeBairroFiltro =
      bairroSelecionado === 'ALL'
        ? 'Todos'
        : dadosRegiao?.bairros.find((b) => b.key === bairroSelecionado)?.label ||
          bairroSelecionado;

    let conteudoCsv = '\uFEFF';
    conteudoCsv +=
      'RELATÓRIO DE CLIENTES POR BAIRRO / RUA E CONEXÃO - AVL TELECOM\n';
    conteudoCsv += `Gerado em:;${new Date().toLocaleString('pt-BR')}\n`;
    conteudoCsv += `Bairro Filtro:;${nomeBairroFiltro}\n`;
    conteudoCsv += `Total no Filtro:;${registrosFinaisFiltrados.length}\n`;
    conteudoCsv += `Internet OK:;${resumoFinalTabela.totals.internetOk};Desconectados:;${resumoFinalTabela.totals.desconectados};Bloqueados:;${resumoFinalTabela.totals.bloqueados}\n\n`;
    conteudoCsv +=
      'ID Cliente;ID Ponto;Cliente;CPF/CNPJ;Telefone;Bairro;Rua/Logradouro;Número;Complemento;Cidade;Plano;Login PPPoE;Status Internet;Sessão;IP WAN;MAC;Último Login\n';

    registrosFinaisFiltrados.forEach((registro) => {
      conteudoCsv += `${registro.clienteId};${registro.pontoId};"${registro.nome}";"${formatarDocumentoCpfCnpj(
        registro.cpfCnpj,
        '-'
      )}";"${registro.telefone || '-'}";"${registro.bairroLabel}";"${
        registro.ruaLabel
      }";"${registro.numero || '-'}";"${registro.complemento || '-'}";"${
        registro.cidade || '-'
      }";"${registro.plano || '-'}";"${registro.usuarioPppoe || '-'}";"${
        ROTULOS_EXPORTACAO_SAUDE[registro.connectionHealth]
      }";"${registro.sessaoConexaoStatus}";"${registro.ipAlocado || '-'}";"${
        registro.mac || '-'
      }";"${registro.ultimoLogin || '-'}"\n`;
    });

    baixarArquivoCsv(
      `clientes_regiao_conexao_${new Date().toISOString().slice(0, 10)}.csv`,
      conteudoCsv
    );
    toast.success(
      `Exportados ${registrosFinaisFiltrados.length} registros para CSV!`
    );
  };

  const taxaOnlineEscopo = useMemo(() => {
    const qtdAtivos = resumoLocal.totals.totalAtivos;
    if (qtdAtivos <= 0) return 0;
    return Math.round((resumoLocal.totals.internetOk / qtdAtivos) * 1000) / 10;
  }, [resumoLocal]);

  return (
    <PageTransition>
      <div className="space-y-6 text-foreground pb-12">
        {/* ── Header Hero ────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-6 border border-blue-500/20 shadow-xl"
        >
          <div className="absolute -right-24 -top-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-24 -bottom-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-300 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-400/20">
                  <MapPin className="w-3.5 h-3.5" />
                  Monitoramento Territorial &amp; Conexão
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-400/20">
                  <Activity className="w-3.5 h-3.5" />
                  ISPFY em Tempo Real
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Clientes por Bairro, Rua &amp; Status da Internet
              </h1>
              <p className="text-slate-300 text-sm max-w-2xl">
                Separe os assinantes por bairro, endereço ou rua, acompanhe a quantidade exata em cada recorte e identifique rapidamente quem está com a internet OK ou desconectado.
              </p>
              {dadosRegiao?.fetchedAt && (
                <p className="text-xs text-slate-400 flex items-center gap-1.5 pt-1">
                  <Clock className="w-3.5 h-3.5 text-blue-300" />
                  Última leitura completa:{' '}
                  {formatarDataHoraCurta(dadosRegiao.fetchedAt)} •{' '}
                  {dadosRegiao.totals.totalAtivos} pontos ativos em{' '}
                  {dadosRegiao.bairros.length} bairros e{' '}
                  {dadosRegiao.ruas.length} ruas
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => carregarDados(true)}
                disabled={carregando}
                className="bg-blue-600 hover:bg-blue-500 border-blue-400 text-white text-xs h-9"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 mr-1.5 ${
                    carregando ? 'animate-spin' : ''
                  }`}
                />
                Atualizar Conexões
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={aoExportarCsv}
                disabled={carregando || registrosFinaisFiltrados.length === 0}
                className="bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white text-xs h-9"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Exportar Filtro ({registrosFinaisFiltrados.length})
              </Button>
            </div>
          </div>

          {carregando && (
            <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-3">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-400 border-t-transparent" />
              <span className="text-xs text-blue-200 font-medium">
                {mensagemProgresso}
              </span>
            </div>
          )}
        </motion.div>

        {/* ── Detector de Rompimentos em Massa & Incidentes Regionais ── */}
        {(rompimentosEmMassa.length > 0 || rompimentosConfirmados.length > 0) && (
          <Card className="border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-rose-500/5 to-transparent shadow-md">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-300">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-foreground">
                      Detector de Rompimentos em Massa &amp; Avisos Regionais
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Dispara alerta e sirene quando uma rua (&ge; {outageConfig.minPercentualRua}% offline, mín. {outageConfig.minClientesOfflineRua} clientes únicos) ou bairro (&ge; {outageConfig.minPercentualBairro}%, mín. {outageConfig.minClientesOfflineBairro}) concentra quedas recentes. Acima de 5 minutos contínuos e confirmação ao vivo, envia WhatsApp para <strong>EQUIPE AVL</strong>.
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-amber-500/40"
                    onClick={() => tocarSireneRompimento(2)}
                  >
                    <Volume2 className="w-3.5 h-3.5 mr-1.5" />
                    Testar Sirene
                  </Button>
                  {rompimentosEmMassa.length > 0 && (sireneAtiva || !sireneSilenciada) && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 text-xs font-bold animate-pulse"
                      onClick={() => pararSirene(true)}
                    >
                      <VolumeX className="w-3.5 h-3.5 mr-1.5" />
                      Parar Sirene
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {rompimentosConfirmados.map((incidente) => (
                <div
                  key={incidente.id}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-emerald-600 text-white text-[10px]">
                        Aviso Ativo no Bot/IA
                      </Badge>
                      <span className="font-bold text-sm text-foreground">
                        {incidente.bairros.join(', ')}
                      </span>
                      {incidente.previsaoRetorno && (
                        <Badge variant="outline" className="text-[10px]">
                          Previsão: {incidente.previsaoRetorno}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {incidente.mensagem}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs shrink-0 border-emerald-500/40 hover:bg-emerald-500/20"
                    onClick={() => resolverRompimentoRegiao(incidente.id)}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
                    Marcar Normalizado
                  </Button>
                </div>
              ))}

              {rompimentosEmMassa.map((alerta) => {
                const jaAtivo = rompimentosConfirmados.some((c) =>
                  c.bairros.some(
                    (b) => b.toLowerCase() === alerta.bairroLabel.toLowerCase()
                  )
                );
                const watch = outagesMonitorados.find(
                  (w) => w.incidentKey === alerta.incidentKey
                );
                const elapsedSec = watch?.firstDetectedAtMs
                  ? Math.max(0, Math.floor((agoraMs - watch.firstDetectedAtMs) / 1000))
                  : null;
                const mins = elapsedSec !== null ? Math.floor(elapsedSec / 60) : 0;
                const secs = elapsedSec !== null ? elapsedSec % 60 : 0;
                const rp = alerta.ruaPrincipal;

                return (
                  <div
                    key={alerta.incidentKey}
                    className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-background/80 p-3.5"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {alerta.tipoAlerta === 'rua_e_bairro' && rp && (
                          <Badge className="bg-rose-600 text-white text-[11px] font-bold">
                            Rua: {rp.desconectados} / {rp.totalAtivos} off ({rp.percentualOffline}%)
                          </Badge>
                        )}
                        <Badge
                          variant={alerta.tipoAlerta === 'rua_e_bairro' ? 'outline' : 'destructive'}
                          className="text-[11px] font-bold border-rose-500/40 text-rose-600 dark:text-rose-300"
                        >
                          Bairro: {alerta.desconectados} / {alerta.totalAtivosNoBairro} off ({alerta.percentualOffline}%)
                        </Badge>
                        <span className="font-bold text-sm text-foreground">
                          {alerta.tipoAlerta === 'rua_e_bairro' && rp
                            ? `${rp.ruaLabel} — ${alerta.bairroLabel}`
                            : alerta.bairroLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap text-[11px]">
                        {watch?.whatsappSentAtMs ? (
                          <Badge className="bg-emerald-600/90 text-white text-[10px] gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            EQUIPE AVL notificada às{' '}
                            {new Date(watch.whatsappSentAtMs).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Badge>
                        ) : watch?.whatsappBlockedReason ? (
                          <Badge
                            variant="outline"
                            className="border-amber-500/50 text-amber-700 dark:text-amber-300 text-[10px] gap-1"
                          >
                            <AlertTriangle className="w-3 h-3" />
                            Envio retido: {watch.whatsappBlockedReason}
                          </Badge>
                        ) : elapsedSec !== null ? (
                          <Badge
                            variant="outline"
                            className="border-amber-500/50 text-amber-700 dark:text-amber-300 text-[10px] gap-1"
                          >
                            <Clock className="w-3 h-3" />
                            Persistência: {mins}m {String(secs).padStart(2, '0')}s / 5m 00s
                            {typeof watch?.consecutiveHits === 'number'
                              ? ` • ${watch.consecutiveHits}/${outageConfig.minChecagensConsecutivas} checagens`
                              : ''}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Clock className="w-3 h-3" />
                            Iniciando contagem de 5 min para EQUIPE AVL...
                          </Badge>
                        )}
                        {(alerta.offlineAntigosIgnorados ?? 0) > 0 && (
                          <Badge variant="outline" className="text-[10px]">
                            {alerta.offlineAntigosIgnorados} offline antigo(s) ignorado(s)
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Ruas afetadas:{' '}
                        {alerta.ruasAfetadas
                          .slice(0, 4)
                          .map(
                            (r) =>
                              `${r.ruaLabel} (${r.desconectados}/${r.totalAtivos} off • ${r.percentualOffline}%)`
                          )
                          .join(' • ')}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => {
                          setBairroSelecionado(alerta.bairroKey);
                          setFiltroStatus('DESCONECTADO');
                          setPaginaAtual(1);
                        }}
                      >
                        Filtrar Bairro
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs border-blue-500/40 text-blue-600 dark:text-blue-400"
                        onClick={() => enviarAlertaRompimentoGrupo(alerta)}
                      >
                        <Send className="w-3.5 h-3.5 mr-1.5" />
                        Alertar EQUIPE AVL
                      </Button>
                      <Button
                        size="sm"
                        variant={jaAtivo ? 'secondary' : 'default'}
                        className="h-8 text-xs"
                        disabled={jaAtivo}
                        onClick={() => ativarAlertaRompimentoRegiao(alerta)}
                      >
                        <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />
                        {jaAtivo ? 'Bot já avisando' : 'Ativar Aviso no Bot/IA'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* ── 4 KPIs do Recorte Selecionado ───────────────────────── */}
        {dadosRegiao && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-blue-500/20 bg-gradient-to-br from-blue-50/50 via-white to-blue-50/20 dark:from-blue-950/20 dark:via-slate-900 dark:to-blue-950/10 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                  Clientes no Filtro
                </CardTitle>
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400">
                  <Users className="w-5 h-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">
                  {resumoFinalTabela.totals.totalPontos}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {resumoFinalTabela.totals.totalClientesUnicos} assinantes únicos •{' '}
                  {possuiFiltrosAtivos ? 'Recorte aplicado' : 'Base completa'}
                </p>
              </CardContent>
            </Card>

            <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-50/50 via-white to-emerald-50/20 dark:from-emerald-950/20 dark:via-slate-900 dark:to-emerald-950/10 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Internet OK (Online)
                </CardTitle>
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400">
                  <Wifi className="w-5 h-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  {resumoLocal.totals.internetOk}
                </div>
                <div className="mt-1.5 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    <strong>{taxaOnlineEscopo}%</strong> dos pontos ativos do recorte conectados
                  </p>
                  <Progress
                    value={taxaOnlineEscopo}
                    className="h-1.5 bg-emerald-500/15 [&>div]:bg-emerald-500"
                  />
                </div>
              </CardContent>
            </Card>

            <Card
              className={`border-rose-500/30 bg-gradient-to-br from-rose-50/60 via-white to-rose-50/20 dark:from-rose-950/25 dark:via-slate-900 dark:to-rose-950/10 shadow-sm ${
                resumoLocal.totals.desconectados > 0
                  ? 'ring-1 ring-rose-500/20'
                  : ''
              }`}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                  Desconectados
                </CardTitle>
                <div className="p-2 bg-rose-500/10 rounded-lg text-rose-600 dark:text-rose-400">
                  <WifiOff className="w-5 h-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-rose-600 dark:text-rose-400">
                  {resumoLocal.totals.desconectados}
                </div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  {resumoLocal.totals.desconectados > 0 ? (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      Contratos ativos offline (sem bloqueio)
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      Nenhuma queda detectada no recorte
                    </>
                  )}
                </p>
              </CardContent>
            </Card>

            <Card className="border-amber-500/20 bg-gradient-to-br from-amber-50/50 via-white to-amber-50/20 dark:from-amber-950/20 dark:via-slate-900 dark:to-amber-950/10 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Bloqueados (Financeiro)
                </CardTitle>
                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
                  <Lock className="w-5 h-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">
                  {resumoLocal.totals.bloqueados}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {resumoLocal.totals.bloqueadosOnline} online em pool bloqueio •{' '}
                  {resumoLocal.totals.bloqueadosOffline} offline
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Barra de Filtros: Bairro, Rua, Busca e Status ───────── */}
        <Card className="p-4 bg-card/70 backdrop-blur-md border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Filtro de Bairro */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">
                Filtrar por Bairro ({resumoBaseRegiao.bairros.length})
              </Label>
              <Select
                value={bairroSelecionado}
                onValueChange={aoSelecionarBairro}
              >
                <SelectTrigger className="h-10 text-xs">
                  <SelectValue placeholder="Todos os Bairros" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">
                    Todos os Bairros ({resumoBaseRegiao.totals.totalPontos}{' '}
                    clientes)
                  </SelectItem>
                  {ordenarGruposRegiao(resumoBaseRegiao.bairros, 'volume').map(
                    (bairro) => (
                      <SelectItem key={bairro.key} value={bairro.key}>
                        {bairro.label} — {bairro.totalPontos} (
                        {bairro.internetOk} ok • {bairro.desconectados} off)
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro de Rua / Logradouro */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">
                Filtrar por Rua / Endereço ({ruasDoEscopo.length})
              </Label>
              <Select
                value={ruaSelecionadaComp}
                onValueChange={(valor) => {
                  if (valor === 'ALL') {
                    setRuaSelecionadaComp('ALL');
                  } else {
                    const ruaEncontrada = resumoBaseRegiao.ruas.find(
                      (rua) => rua.key === valor
                    );
                    if (ruaEncontrada) {
                      setBairroSelecionado(ruaEncontrada.bairroKey);
                      setRuaSelecionadaComp(ruaEncontrada.key);
                    }
                  }
                  setPaginaAtual(1);
                }}
              >
                <SelectTrigger className="h-10 text-xs">
                  <SelectValue placeholder="Todas as Ruas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">
                    Todas as Ruas ({ruasDoEscopo.length} logradouros)
                  </SelectItem>
                  {ordenarGruposRegiao(ruasDoEscopo, 'volume').map((rua) => (
                    <SelectItem key={rua.key} value={rua.key}>
                      {rua.label}
                      {bairroSelecionado === 'ALL'
                        ? ` (${rua.bairroLabel})`
                        : ''}{' '}
                      — {rua.totalPontos} ({rua.desconectados} off)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Busca Textual */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">
                Buscar endereço, número, nome, PPPoE ou IP
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Ex: Rua Coelho, casa, joao, 100.64..."
                  value={termoBusca}
                  onChange={(evento) => {
                    setTermoBusca(evento.target.value);
                    setPaginaAtual(1);
                  }}
                  className="pl-9 h-10 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Linha 2: Pills de Status + Controles */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant={filtroStatus === 'ALL' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setFiltroStatus('ALL');
                  setPaginaAtual(1);
                }}
                className="h-8 text-xs"
              >
                Todos ({resumoLocal.totals.totalPontos})
              </Button>
              <Button
                variant={filtroStatus === 'OK' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setFiltroStatus('OK');
                  setPaginaAtual(1);
                }}
                className={`h-8 text-xs ${
                  filtroStatus === 'OK'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                }`}
              >
                <Wifi className="w-3.5 h-3.5 mr-1.5" />
                Internet OK ({resumoLocal.totals.internetOk})
              </Button>
              <Button
                variant={
                  filtroStatus === 'DESCONECTADO' ? 'default' : 'outline'
                }
                size="sm"
                onClick={() => {
                  setFiltroStatus('DESCONECTADO');
                  setPaginaAtual(1);
                }}
                className={`h-8 text-xs ${
                  filtroStatus === 'DESCONECTADO'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'text-rose-700 dark:text-rose-300 border-rose-500/30'
                }`}
              >
                <WifiOff className="w-3.5 h-3.5 mr-1.5" />
                Desconectados ({resumoLocal.totals.desconectados})
              </Button>
              <Button
                variant={filtroStatus === 'BLOQUEADO' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setFiltroStatus('BLOQUEADO');
                  setPaginaAtual(1);
                }}
                className={`h-8 text-xs ${
                  filtroStatus === 'BLOQUEADO'
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'text-amber-700 dark:text-amber-300 border-amber-500/30'
                }`}
              >
                <Lock className="w-3.5 h-3.5 mr-1.5" />
                Bloqueados ({resumoLocal.totals.bloqueados})
              </Button>
              {incluirInativos && (
                <Button
                  variant={filtroStatus === 'INATIVO' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setFiltroStatus('INATIVO');
                    setPaginaAtual(1);
                  }}
                  className="h-8 text-xs"
                >
                  Inativos ({resumoLocal.totals.inativos})
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="include-inactive"
                  checked={incluirInativos}
                  onCheckedChange={(marcado) => {
                    setIncluirInativos(marcado);
                    if (!marcado && filtroStatus === 'INATIVO') {
                      setFiltroStatus('ALL');
                    }
                    setPaginaAtual(1);
                  }}
                />
                <Label
                  htmlFor="include-inactive"
                  className="text-xs text-muted-foreground cursor-pointer"
                >
                  Incluir inativos ({dadosRegiao?.totals.inativos ?? 0})
                </Label>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">
                  Ordenar grupos:
                </span>
                <Select
                  value={ordenacaoResumo}
                  onValueChange={(valor) =>
                    setOrdenacaoResumo(valor as ModoOrdenacaoResumo)
                  }
                >
                  <SelectTrigger className="h-8 w-44 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disconnected">
                      Mais desconectados (quedas)
                    </SelectItem>
                    <SelectItem value="volume">
                      Maior qtd. de clientes
                    </SelectItem>
                    <SelectItem value="alpha">
                      Ordem alfabética (A-Z)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {possuiFiltrosAtivos && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={aoLimparFiltros}
                  className="h-8 text-xs text-rose-600 hover:text-rose-700"
                >
                  <FilterX className="w-3.5 h-3.5 mr-1" />
                  Limpar filtros
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* ── Painel Duplo Clicável: Bairros & Ruas com Contagens ── */}
        {dadosRegiao && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Bairros */}
            <Card className="border border-slate-200 dark:border-slate-800 overflow-hidden">
              <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 py-3 px-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-500" />
                      Bairros ({bairrosOrdenados.length})
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Clique em um bairro para filtrar seus clientes e ruas
                    </CardDescription>
                  </div>
                  {bairroSelecionado !== 'ALL' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => aoSelecionarBairro('ALL')}
                      className="h-7 text-[11px]"
                    >
                      Ver todos
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-2 max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/70">
                {bairrosOrdenados.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    Nenhum bairro corresponde à busca atual.
                  </p>
                ) : (
                  bairrosOrdenados.map((bairro) => {
                    const selecionado = bairroSelecionado === bairro.key;
                    return (
                      <button
                        type="button"
                        key={bairro.key}
                        onClick={() =>
                          aoSelecionarBairro(selecionado ? 'ALL' : bairro.key)
                        }
                        className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center justify-between gap-2 ${
                          selecionado
                            ? 'bg-blue-500/15 ring-1 ring-blue-500/40'
                            : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs truncate">
                              {bairro.label}
                            </span>
                            <Badge
                              variant="secondary"
                              className="text-[10px] font-mono"
                            >
                              {bairro.totalPontos}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Progress
                              value={bairro.onlineRate}
                              className="h-1 flex-1 max-w-[120px] bg-slate-200 dark:bg-slate-800 [&>div]:bg-emerald-500"
                            />
                            <span className="text-[10px] text-muted-foreground">
                              {bairro.onlineRate}% OK
                            </span>
                          </div>
                        </div>

                        <BadgesSaudeGrupo grupo={bairro} />
                      </button>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* Ruas / Endereços */}
            <Card className="border border-slate-200 dark:border-slate-800 overflow-hidden">
              <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 py-3 px-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Navigation className="w-4 h-4 text-indigo-500" />
                      Ruas / Logradouros ({ruasDoEscopo.length})
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {bairroSelecionado === 'ALL'
                        ? 'Mostrando ruas de toda a rede — clique para isolar uma rua'
                        : `Ruas em ${
                            bairrosOrdenados.find(
                              (b) => b.key === bairroSelecionado
                            )?.label || 'Bairro selecionado'
                          }`}
                    </CardDescription>
                  </div>
                  {ruaSelecionadaComp !== 'ALL' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRuaSelecionadaComp('ALL');
                        setPaginaAtual(1);
                      }}
                      className="h-7 text-[11px]"
                    >
                      Todas as ruas
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-2 max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/70">
                {ruasDoEscopo.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    Nenhuma rua encontrada para os filtros aplicados.
                  </p>
                ) : (
                  ruasDoEscopo.map((rua) => {
                    const selecionada = ruaSelecionadaComp === rua.key;
                    return (
                      <button
                        type="button"
                        key={rua.key}
                        onClick={() => aoSelecionarRua(rua)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center justify-between gap-2 ${
                          selecionada
                            ? 'bg-indigo-500/15 ring-1 ring-indigo-500/40'
                            : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs truncate">
                              {rua.label}
                            </span>
                            <Badge
                              variant="secondary"
                              className="text-[10px] font-mono"
                            >
                              {rua.totalPontos}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                            {rua.bairroLabel} • {rua.onlineRate}% OK
                          </p>
                        </div>

                        <BadgesSaudeGrupo grupo={rua} />
                      </button>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Tabela Detalhada de Clientes & Conexão ─────────────── */}
        <Card className="border border-slate-200 dark:border-slate-800 overflow-hidden">
          <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 pb-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Wifi className="w-5 h-5 text-blue-500" />
                  Clientes no Filtro &amp; Diagnóstico de Internet
                </CardTitle>
                <CardDescription>
                  Exibindo {registrosPaginados.length} de{' '}
                  {registrosFinaisFiltrados.length} pontos encontrados (página{' '}
                  {paginaSegura} de {totalPaginas})
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-xs"
                >
                  {resumoFinalTabela.totals.internetOk} OK
                </Badge>
                <Badge
                  variant="outline"
                  className="bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30 text-xs"
                >
                  {resumoFinalTabela.totals.desconectados} Desconectados
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Cliente / Contato</TableHead>
                    <TableHead>Endereço (Rua, Nº &amp; Bairro)</TableHead>
                    <TableHead>Plano &amp; Login PPPoE</TableHead>
                    <TableHead>Status da Internet</TableHead>
                    <TableHead>Última Conexão / IP</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {carregando && !dadosRegiao ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-40 text-center text-muted-foreground"
                      >
                        <div className="flex flex-col items-center justify-center gap-2">
                          <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                          <span>{mensagemProgresso}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : registrosPaginados.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-32 text-center text-muted-foreground"
                      >
                        Nenhum cliente encontrado para os filtros aplicados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    registrosPaginados.map((registro) => (
                      <TableRow
                        key={registro.pontoId}
                        className={`hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition-colors ${
                          registro.connectionHealth === 'desconectado'
                            ? 'bg-rose-500/[0.03]'
                            : ''
                        }`}
                      >
                        <TableCell>
                          <div className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                            {registro.nome}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                            Cliente #{registro.clienteId || '-'} • Ponto #
                            {registro.pontoId} •{' '}
                            {formatarDocumentoCpfCnpj(registro.cpfCnpj, '-')}
                          </div>
                          {registro.telefone && (
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5 font-medium">
                              <Phone className="w-3 h-3" />
                              {registro.telefone}
                            </div>
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                            {registro.ruaLabel}
                            {registro.numero ? `, ${registro.numero}` : ''}
                          </div>
                          {registro.complemento && (
                            <div className="text-[10px] text-muted-foreground truncate max-w-[260px]">
                              {registro.complemento}
                            </div>
                          )}
                          <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium mt-0.5">
                            {registro.bairroLabel}
                            {registro.cidade ? ` • ${registro.cidade}` : ''}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                            {registro.plano || 'Não identificado'}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                            PPPoE: {registro.usuarioPppoe || '-'}
                          </div>
                          {registro.mac && (
                            <div className="text-[10px] text-muted-foreground font-mono">
                              MAC: {registro.mac}
                            </div>
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="space-y-1">
                            {renderizarBadgeConexao(registro)}
                            {(registro.downloadMesKbytes !== undefined ||
                              registro.uploadMesKbytes !== undefined) && (
                              <div className="text-[10px] text-muted-foreground">
                                Mês: ↓{' '}
                                {formatarConsumoDados(
                                  registro.downloadMesKbytes
                                )}{' '}
                                / ↑{' '}
                                {formatarConsumoDados(registro.uploadMesKbytes)}
                              </div>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="text-xs space-y-0.5">
                          <div className="font-mono text-[11px] text-slate-800 dark:text-slate-200">
                            {registro.ipAlocado
                              ? `IP: ${registro.ipAlocado}`
                              : 'Sem IP ativo'}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            Últ. login:{' '}
                            {formatarDataHoraCurta(registro.ultimoLogin)}
                          </div>
                          {registro.ultimoAccounting && (
                            <div className="text-[10px] text-muted-foreground">
                              Accounting:{' '}
                              {formatarDataHoraCurta(registro.ultimoAccounting)}
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                              title="Verificar conexão deste cliente agora (tempo real)"
                              disabled={pontoVerificandoId === registro.pontoId}
                              onClick={() => aoRevalidarClienteAoVivo(registro)}
                            >
                              <RefreshCw
                                className={`w-3.5 h-3.5 ${
                                  pontoVerificandoId === registro.pontoId
                                    ? 'animate-spin'
                                    : ''
                                }`}
                              />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Copiar endereço e dados"
                              onClick={() =>
                                aoCopiarTexto(
                                  `${registro.nome} | ${registro.enderecoCompleto} - ${registro.bairroLabel}`,
                                  'Endereço do cliente'
                                )
                              }
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                            {registro.telefone && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                title="Abrir WhatsApp"
                                onClick={() =>
                                  abrirConversaWhatsApp(registro.telefone)
                                }
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {registro.clienteId && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                                title="Abrir ficha completa no ISPFY"
                                onClick={() =>
                                  navegar(`/ispfy/cliente/${registro.clienteId}`)
                                }
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Paginação */}
            {registrosFinaisFiltrados.length > TAMANHO_PAGINA && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
                <span className="text-xs text-muted-foreground">
                  Página {paginaSegura} de {totalPaginas} •{' '}
                  {registrosFinaisFiltrados.length} clientes neste recorte
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={paginaSegura <= 1}
                    onClick={() =>
                      setPaginaAtual((pagina) => Math.max(1, pagina - 1))
                    }
                    className="h-8 text-xs"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={paginaSegura >= totalPaginas}
                    onClick={() =>
                      setPaginaAtual((pagina) =>
                        Math.min(totalPaginas, pagina + 1)
                      )
                    }
                    className="h-8 text-xs"
                  >
                    Próxima
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}

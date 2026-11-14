import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  AlertTriangle,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Info,
  Phone,
  Printer,
  RefreshCw,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import { ispfyService } from '@/services/ispfy/ispfyService';
import type {
  ISPFYAuditCancelledContract,
  ISPFYAuditData,
} from '@/types/ispfy';
import {
  abrirConversaWhatsApp,
  baixarArquivoCsv,
  formatarMoedaBRL,
} from '@/lib/utils';
import { formatarDataHoraCurta } from '@/utils/date';
import { formatarDocumentoCpfCnpj } from '@/utils/ispfyFormatters';
import { toast } from 'sonner';

const NOMES_MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function formatarLocalidade(bairro?: string, cidade?: string): string {
  const partes = [bairro?.trim(), cidade?.trim()].filter(Boolean);
  return partes.length > 0 ? partes.join(', ') : '-';
}

function formatarDataAuditoria(valor?: string): string {
  return formatarDataHoraCurta(valor, {
    incluirAno: true,
    incluirSegundos: true,
    textoSeparador: ' às ',
  });
}

interface PropsAcoesLinhaAuditoria {
  textoCopia: string;
  rotuloCopia: string;
  telefone?: string;
  clienteId?: string;
  aoCopiar: (texto: string, rotulo: string) => void;
  aoAbrirCliente: (clienteId: string) => void;
}

const AcoesLinhaAuditoria: React.FC<PropsAcoesLinhaAuditoria> = ({
  textoCopia,
  rotuloCopia,
  telefone,
  clienteId,
  aoCopiar,
  aoAbrirCliente,
}) => (
  <div className="flex items-center justify-end gap-1">
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 text-muted-foreground hover:text-foreground"
      title={`Copiar ${rotuloCopia.toLowerCase()}`}
      onClick={() => aoCopiar(textoCopia, rotuloCopia)}
    >
      <Copy className="w-3.5 h-3.5" />
    </Button>
    {telefone && (
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
        title="Abrir WhatsApp"
        onClick={() => abrirConversaWhatsApp(telefone)}
      >
        <Phone className="w-3.5 h-3.5" />
      </Button>
    )}
    {clienteId && (
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
        title="Ver no ISPFY"
        onClick={() => aoAbrirCliente(clienteId)}
      >
        <ExternalLink className="w-3.5 h-3.5" />
      </Button>
    )}
  </div>
);

/** Tela de auditoria mensal do ISPFY: novos cadastros, cancelamentos, retiradas e exclusões. */
export default function ISPFYAuditoria() {
  const navegar = useNavigate();
  const dataAtual = new Date();

  // Estado de mês e ano selecionados (padrão: mês e ano atual)
  const [mesSelecionado, setMesSelecionado] = useState<number>(
    dataAtual.getMonth() + 1
  );
  const [anoSelecionado, setAnoSelecionado] = useState<number>(
    dataAtual.getFullYear()
  );

  const [carregando, setCarregando] = useState<boolean>(true);
  const [mensagemProgresso, setMensagemProgresso] = useState<string>(
    'Carregando dados de auditoria...'
  );
  const [dadosAuditoria, setDadosAuditoria] = useState<ISPFYAuditData | null>(
    null
  );

  // Filtros de busca
  const [termoBusca, setTermoBusca] = useState<string>('');
  const [filtroAtendente, setFiltroAtendente] = useState<string>('ALL');
  const [abaAtiva, setAbaAtiva] = useState<string>('overview');
  const [modoExclusoes, setModoExclusoes] = useState<'periodo' | 'historico'>(
    'periodo'
  );

  const carregarDadosAuditoria = async (
    ano: number,
    mes: number,
    forcarAtualizacao = false
  ) => {
    setCarregando(true);
    setMensagemProgresso('Iniciando auditoria no ISPFY...');
    try {
      const resultado = await ispfyService.getAuditData(
        ano,
        mes,
        (mensagem) => setMensagemProgresso(mensagem),
        forcarAtualizacao
      );
      setDadosAuditoria(resultado);
      toast.success(
        `Auditoria de ${NOMES_MESES[mes - 1]}/${ano} atualizada!`
      );
    } catch (erroCaptura: unknown) {
      const mensagemErro =
        erroCaptura instanceof Error
          ? erroCaptura.message
          : 'Falha de conexão';
      console.error('Erro ao carregar auditoria:', erroCaptura);
      toast.error('Erro ao consultar dados no ISPFY: ' + mensagemErro);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDadosAuditoria(anoSelecionado, mesSelecionado);
  }, [anoSelecionado, mesSelecionado]);

  const aoCopiarTexto = (texto: string, rotulo: string) => {
    navigator.clipboard.writeText(texto);
    toast.success(`${rotulo} copiado!`);
  };

  const filtrarListaCancelamentos = useCallback(
    (lista: ISPFYAuditCancelledContract[]) => {
      const termo = termoBusca.trim().toLowerCase();
      const buscaDigitos = termoBusca.replace(/\D/g, '');

      return lista.filter((contrato) => {
        const correspondeBusca =
          !termo ||
          (contrato.nome_cliente &&
            contrato.nome_cliente.toLowerCase().includes(termo)) ||
          (buscaDigitos.length > 0 &&
            contrato.cpf_cnpj &&
            contrato.cpf_cnpj.replace(/\D/g, '').includes(buscaDigitos)) ||
          contrato.id_cliente.includes(termo) ||
          contrato.id.includes(termo) ||
          (contrato.ticket_id && contrato.ticket_id.includes(termo)) ||
          (contrato.plano && contrato.plano.toLowerCase().includes(termo)) ||
          (contrato.cidade && contrato.cidade.toLowerCase().includes(termo)) ||
          (contrato.bairro && contrato.bairro.toLowerCase().includes(termo)) ||
          (contrato.observacoes &&
            contrato.observacoes.toLowerCase().includes(termo)) ||
          (contrato.usuario_cadastrou &&
            contrato.usuario_cadastrou.toLowerCase().includes(termo));

        const correspondeAtendente =
          filtroAtendente === 'ALL' ||
          contrato.usuario_cadastrou === filtroAtendente;
        return correspondeBusca && correspondeAtendente;
      });
    },
    [termoBusca, filtroAtendente]
  );

  const cadastradosFiltrados = useMemo(() => {
    if (!dadosAuditoria) return [];
    const termo = termoBusca.trim().toLowerCase();
    const buscaDigitos = termoBusca.replace(/\D/g, '');

    return dadosAuditoria.cadastrados.filter((cliente) => {
      const correspondeBusca =
        !termo ||
        cliente.nome_razao.toLowerCase().includes(termo) ||
        (buscaDigitos.length > 0 &&
          cliente.cpf_cnpj.replace(/\D/g, '').includes(buscaDigitos)) ||
        cliente.id.includes(termo) ||
        (cliente.telefone &&
          buscaDigitos.length > 0 &&
          cliente.telefone.replace(/\D/g, '').includes(buscaDigitos)) ||
        (cliente.bairro && cliente.bairro.toLowerCase().includes(termo)) ||
        (cliente.cidade && cliente.cidade.toLowerCase().includes(termo)) ||
        (cliente.plano && cliente.plano.toLowerCase().includes(termo)) ||
        (cliente.usuario_cadastrou &&
          cliente.usuario_cadastrou.toLowerCase().includes(termo));

      const correspondeAtendente =
        filtroAtendente === 'ALL' ||
        cliente.usuario_cadastrou === filtroAtendente;
      return correspondeBusca && correspondeAtendente;
    });
  }, [dadosAuditoria, termoBusca, filtroAtendente]);

  const canceladosFiltrados = useMemo(() => {
    if (!dadosAuditoria) return [];
    return filtrarListaCancelamentos(dadosAuditoria.cancelados);
  }, [dadosAuditoria, filtrarListaCancelamentos]);

  const ticketsRemocaoFiltrados = useMemo(() => {
    if (!dadosAuditoria?.ticketsRemocao) return [];
    return filtrarListaCancelamentos(dadosAuditoria.ticketsRemocao);
  }, [dadosAuditoria, filtrarListaCancelamentos]);

  const excluidosFiltrados = useMemo(() => {
    if (!dadosAuditoria) return [];
    const origemDados =
      modoExclusoes === 'historico'
        ? dadosAuditoria.lacunasHistoricas || dadosAuditoria.excluidos
        : dadosAuditoria.excluidos;

    const termo = termoBusca.trim().toLowerCase();
    const buscaDigitos = termoBusca.replace(/\D/g, '');

    return origemDados.filter((exclusao) => {
      if (!termo) return true;
      return (
        exclusao.id.includes(termo) ||
        (exclusao.nome && exclusao.nome.toLowerCase().includes(termo)) ||
        (exclusao.motivo && exclusao.motivo.toLowerCase().includes(termo)) ||
        (buscaDigitos.length > 0 &&
          exclusao.cpf_cnpj &&
          exclusao.cpf_cnpj.replace(/\D/g, '').includes(buscaDigitos)) ||
        (exclusao.referencia_anterior?.nome &&
          exclusao.referencia_anterior.nome.toLowerCase().includes(termo)) ||
        (exclusao.referencia_posterior?.nome &&
          exclusao.referencia_posterior.nome.toLowerCase().includes(termo))
      );
    });
  }, [dadosAuditoria, termoBusca, modoExclusoes]);

  const listaAtendentes = useMemo(() => {
    if (!dadosAuditoria) return [];
    const conjuntoOperadores = new Set<string>();
    dadosAuditoria.cadastrados.forEach((c) => {
      if (c.usuario_cadastrou) conjuntoOperadores.add(c.usuario_cadastrou);
    });
    dadosAuditoria.cancelados.forEach((c) => {
      if (c.usuario_cadastrou) conjuntoOperadores.add(c.usuario_cadastrou);
    });
    (dadosAuditoria.ticketsRemocao || []).forEach((c) => {
      if (c.usuario_cadastrou) conjuntoOperadores.add(c.usuario_cadastrou);
    });
    return Array.from(conjuntoOperadores).sort();
  }, [dadosAuditoria]);

  const aoExportarCsv = () => {
    if (!dadosAuditoria) return;

    const nomeMesMaiusculo = NOMES_MESES[mesSelecionado - 1].toUpperCase();
    let conteudoCsv = '\uFEFF';
    conteudoCsv += `AUDITORIA ISPFY - RELATÓRIO DO MÊS DE ${nomeMesMaiusculo}/${anoSelecionado}\n`;
    conteudoCsv += `Gerado em:;${new Date().toLocaleString('pt-BR')}\n`;
    conteudoCsv += `Total Cadastrados:;${dadosAuditoria.resumo.totalCadastrados}\n`;
    conteudoCsv += `Total Cancelados/Rescindidos:;${dadosAuditoria.resumo.totalCancelados}\n`;
    conteudoCsv += `Tickets de Retirada (Sem Rescisão):;${
      dadosAuditoria.resumo.totalTicketsRemocao || 0
    }\n`;
    conteudoCsv += `Total Excluídos no Período:;${dadosAuditoria.resumo.totalExcluidos}\n`;
    conteudoCsv += `Total Lacunas na Base (1..${
      dadosAuditoria.resumo.maiorIdBase || '-'
    }):;${
      dadosAuditoria.resumo.totalLacunasBase ??
      dadosAuditoria.resumo.totalExcluidos
    }\n`;
    conteudoCsv += `Saldo Líquido:;${dadosAuditoria.resumo.saldoLiquido}\n\n`;

    conteudoCsv += `=== CLIENTES CADASTRADOS NO MÊS (${dadosAuditoria.cadastrados.length}) ===\n`;
    conteudoCsv +=
      'ID;Nome / Razão Social;CPF / CNPJ;Data e Hora de Cadastro;Cadastrado por;Plano;Valor Mensal (R$);Bairro;Cidade;Telefone\n';
    dadosAuditoria.cadastrados.forEach((cliente) => {
      conteudoCsv += `${cliente.id};"${cliente.nome_razao}";"${formatarDocumentoCpfCnpj(
        cliente.cpf_cnpj
      )}";"${cliente.data_cadastro}";"${cliente.usuario_cadastrou}";"${
        cliente.plano || '-'
      }";"${cliente.valor_mensal || '0.00'}";"${cliente.bairro || '-'}";"${
        cliente.cidade || '-'
      }";"${cliente.telefone || '-'}"\n`;
    });

    conteudoCsv += `\n=== CONTRATOS CANCELADOS / RESCINDIDOS NO MÊS (${dadosAuditoria.cancelados.length}) ===\n`;
    conteudoCsv +=
      'ID Contrato;ID Cliente;Nome Cliente;CPF / CNPJ;Plano;Cidade;Bairro;Telefone;Data Adesão;Data Rescisão;Dias Ativo;Mensalidade (R$);Contratos Ativos Restantes;Cadastrado por;Observações\n';
    dadosAuditoria.cancelados.forEach((contrato) => {
      conteudoCsv += `${contrato.id};${contrato.id_cliente};"${
        contrato.nome_cliente || '-'
      }";"${formatarDocumentoCpfCnpj(contrato.cpf_cnpj)}";"${
        contrato.plano || '-'
      }";"${contrato.cidade || '-'}";"${contrato.bairro || '-'}";"${
        contrato.telefone || '-'
      }";"${contrato.data_adesao || '-'}";"${contrato.data_rescisao}";"${
        contrato.dias_ativo ?? '-'
      }";"${contrato.valor_mensal || '0.00'}";"${
        contrato.contratos_ativos_restantes ?? 0
      }";"${contrato.usuario_cadastrou || '-'}";"${
        contrato.observacoes?.replace(/\n/g, ' ') || '-'
      }"\n`;
    });

    if (
      dadosAuditoria.ticketsRemocao &&
      dadosAuditoria.ticketsRemocao.length > 0
    ) {
      conteudoCsv += `\n=== TICKETS DE RETIRADA SEM RESCISÃO FORMAL (${dadosAuditoria.ticketsRemocao.length}) ===\n`;
      conteudoCsv +=
        'Ticket;ID Contrato;ID Cliente;Nome Cliente;CPF / CNPJ;Plano;Cidade;Telefone;Data Abertura;Status Contrato;Cadastrado por;Assunto / Observação\n';
      dadosAuditoria.ticketsRemocao.forEach((ticket) => {
        conteudoCsv += `${ticket.ticket_id || '-'};${ticket.id};${
          ticket.id_cliente
        };"${ticket.nome_cliente || '-'}";"${formatarDocumentoCpfCnpj(
          ticket.cpf_cnpj
        )}";"${ticket.plano || '-'}";"${ticket.cidade || '-'}";"${
          ticket.telefone || '-'
        }";"${ticket.data_abertura_ticket || ticket.data_rescisao}";"${
          ticket.status_contrato || '-'
        }";"${ticket.usuario_cadastrou || '-'}";"${
          ticket.observacoes?.replace(/\n/g, ' ') || '-'
        }"\n`;
      });
    }

    const listaExcluidosExportacao =
      modoExclusoes === 'historico'
        ? dadosAuditoria.lacunasHistoricas || dadosAuditoria.excluidos
        : dadosAuditoria.excluidos;
    conteudoCsv += `\n=== AUDITORIA DE EXCLUSÕES E LACUNAS (${
      modoExclusoes === 'historico' ? 'BASE COMPLETA' : 'PERÍODO'
    }: ${listaExcluidosExportacao.length}) ===\n`;
    conteudoCsv +=
      'ID;Tipo;Nome Prévio;CPF/CNPJ;Data Estimada;Detectado em;Referência Anterior;Referência Posterior;Motivo / Análise Forense\n';
    listaExcluidosExportacao.forEach((exclusao) => {
      const refAnterior = exclusao.referencia_anterior
        ? `#${exclusao.referencia_anterior.id} ${exclusao.referencia_anterior.nome}`
        : '-';
      const refPosterior = exclusao.referencia_posterior
        ? `#${exclusao.referencia_posterior.id} ${exclusao.referencia_posterior.nome}`
        : '-';
      conteudoCsv += `${exclusao.id};"${exclusao.tipo}";"${
        exclusao.nome || 'Desconhecido'
      }";"${formatarDocumentoCpfCnpj(exclusao.cpf_cnpj)}";"${
        exclusao.provavel_data || '-'
      }";"${exclusao.detectado_em || '-'}";"${refAnterior}";"${refPosterior}";"${exclusao.motivo.replace(
        /\n/g,
        ' '
      )}"\n`;
    });

    baixarArquivoCsv(
      `auditoria_ispfy_${anoSelecionado}_${String(mesSelecionado).padStart(
        2,
        '0'
      )}.csv`,
      conteudoCsv
    );
    toast.success('Arquivo CSV exportado com sucesso!');
  };

  const aoSelecionarMesAtual = () => {
    const agora = new Date();
    setMesSelecionado(agora.getMonth() + 1);
    setAnoSelecionado(agora.getFullYear());
  };

  const aoSelecionarMesAnterior = () => {
    const agora = new Date();
    let mesAnterior = agora.getMonth();
    let anoAnterior = agora.getFullYear();
    if (mesAnterior === 0) {
      mesAnterior = 12;
      anoAnterior -= 1;
    }
    setMesSelecionado(mesAnterior);
    setAnoSelecionado(anoAnterior);
  };

  const nomeMesAtual = NOMES_MESES[mesSelecionado - 1];
  const barrasBalancoPeriodo = useMemo(() => {
    if (!dadosAuditoria) return [];
    const { totalCadastrados, totalCancelados, totalExcluidos } =
      dadosAuditoria.resumo;
    const somaTotal = totalCadastrados + totalCancelados + totalExcluidos;
    const calcularPct = (valor: number) =>
      somaTotal > 0 ? (valor / somaTotal) * 100 : 0;

    return [
      {
        rotulo: `Novos Cadastros (${totalCadastrados})`,
        porcentagem: calcularPct(totalCadastrados),
        classeTexto: 'text-emerald-600 dark:text-emerald-400',
        corPonto: 'bg-emerald-500',
        classeBarra:
          'h-2.5 bg-slate-100 dark:bg-slate-800 [&>div]:bg-emerald-500',
      },
      {
        rotulo: `Cancelamentos / Rescisões (${totalCancelados})`,
        porcentagem: calcularPct(totalCancelados),
        classeTexto: 'text-rose-600 dark:text-rose-400',
        corPonto: 'bg-rose-500',
        classeBarra:
          'h-2.5 bg-slate-100 dark:bg-slate-800 [&>div]:bg-rose-500',
      },
      {
        rotulo: `Exclusões de Banco (${totalExcluidos})`,
        porcentagem: calcularPct(totalExcluidos),
        classeTexto: 'text-amber-600 dark:text-amber-400',
        corPonto: 'bg-amber-500',
        classeBarra:
          'h-2.5 bg-slate-100 dark:bg-slate-800 [&>div]:bg-amber-500',
      },
    ];
  }, [dadosAuditoria]);

  return (
    <PageTransition>
      <div className="space-y-6 pb-16">
        {/* ── Top Header ────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-xl border border-indigo-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-64 h-64 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/30 backdrop-blur-md rounded-xl border border-indigo-400/30 text-indigo-300">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  Auditoria de Clientes ISPFY
                  <Badge
                    variant="outline"
                    className="bg-indigo-500/20 text-indigo-300 border-indigo-400/40 text-xs px-2 py-0.5"
                  >
                    Controle Mensal
                  </Badge>
                </h1>
                <p className="text-sm text-slate-300">
                  Rastreamento oficial de novos cadastros, cancelamentos/rescisões e exclusões de clientes no ISPFY
                </p>
              </div>
            </div>
          </div>

          <div className="relative z-10 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={aoSelecionarMesAtual}
              className="bg-white/10 hover:bg-white/20 border-white/20 text-white text-xs h-9"
            >
              Mês Atual
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={aoSelecionarMesAnterior}
              className="bg-white/10 hover:bg-white/20 border-white/20 text-white text-xs h-9"
            >
              Mês Anterior
            </Button>

            <Select
              value={String(mesSelecionado)}
              onValueChange={(valor) => setMesSelecionado(Number(valor))}
            >
              <SelectTrigger className="w-36 bg-slate-900/80 border-indigo-400/30 text-white h-9 text-xs">
                <Calendar className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                {NOMES_MESES.map((nomeMes, indice) => (
                  <SelectItem key={indice + 1} value={String(indice + 1)}>
                    {nomeMes}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={String(anoSelecionado)}
              onValueChange={(valor) => setAnoSelecionado(Number(valor))}
            >
              <SelectTrigger className="w-24 bg-slate-900/80 border-indigo-400/30 text-white h-9 text-xs">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026, 2027].map((ano) => (
                  <SelectItem key={ano} value={String(ano)}>
                    {ano}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                carregarDadosAuditoria(anoSelecionado, mesSelecionado, true)
              }
              disabled={carregando}
              className="bg-indigo-600 hover:bg-indigo-500 border-indigo-400 text-white text-xs h-9"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 mr-1.5 ${
                  carregando ? 'animate-spin' : ''
                }`}
              />
              Atualizar
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={aoExportarCsv}
              disabled={carregando || !dadosAuditoria}
              className="bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white text-xs h-9"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Excel / CSV
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              disabled={carregando || !dadosAuditoria}
              className="bg-slate-800 hover:bg-slate-700 border-slate-600 text-white text-xs h-9 hidden sm:flex"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Imprimir
            </Button>
          </div>
        </div>

        {/* ── Loading Banner ────────────────────────────────────── */}
        {carregando && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl flex items-center gap-3"
          >
            <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin" />
            <div className="flex-1">
              <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                {mensagemProgresso}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Buscando registros e cruzando contratos no ISPFY para o período selecionado...
              </p>
            </div>
          </motion.div>
        )}

        {/* ── KPI Cards ─────────────────────────────────────────── */}
        {dadosAuditoria && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-50/50 via-white to-emerald-50/20 dark:from-emerald-950/20 dark:via-slate-900 dark:to-emerald-950/10 shadow-sm relative overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Novos Cadastros no Mês
                  </CardTitle>
                  <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400">
                    <UserPlus className="w-5 h-5" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                    {dadosAuditoria.resumo.totalCadastrados}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500 inline" />
                    MRR adicionado est.:{' '}
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                      {formatarMoedaBRL(dadosAuditoria.resumo.mrrAdicionado)}
                    </span>
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-rose-500/20 bg-gradient-to-br from-rose-50/50 via-white to-rose-50/20 dark:from-rose-950/20 dark:via-slate-900 dark:to-rose-950/10 shadow-sm relative overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                    Cancelados / Rescindidos
                  </CardTitle>
                  <div className="p-2 bg-rose-500/10 rounded-lg text-rose-600 dark:text-rose-400">
                    <UserMinus className="w-5 h-5" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-extrabold text-rose-600 dark:text-rose-400">
                    {dadosAuditoria.resumo.totalCancelados}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500 inline" />
                    MRR perdido:{' '}
                    <span className="font-semibold text-rose-700 dark:text-rose-300">
                      {formatarMoedaBRL(dadosAuditoria.resumo.mrrPerdido)}
                    </span>
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card className="border-amber-500/20 bg-gradient-to-br from-amber-50/50 via-white to-amber-50/20 dark:from-amber-950/20 dark:via-slate-900 dark:to-amber-950/10 shadow-sm relative overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    Exclusões do ISPFY
                  </CardTitle>
                  <div className="p-2 bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">
                      {dadosAuditoria.resumo.totalExcluidos}
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        dadosAuditoria.resumo.snapshotCloudAtivo
                          ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5'
                          : 'border-amber-500/40 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {dadosAuditoria.resumo.snapshotCloudAtivo
                        ? 'Snapshot Nuvem'
                        : 'Snapshot Local'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {dadosAuditoria.resumo.totalExcluidos === 0 ? (
                      <span className="text-emerald-600 font-medium">
                        Nenhuma lacuna detectada no mês
                      </span>
                    ) : (
                      <span>Registros removidos ou lacunas no período</span>
                    )}
                  </p>
                  {dadosAuditoria.resumo.totalBaseAtiva !== undefined && (
                    <p className="text-[11px] text-muted-foreground mt-1.5 pt-1.5 border-t border-amber-500/15">
                      Base:{' '}
                      <strong>{dadosAuditoria.resumo.totalBaseAtiva}</strong>{' '}
                      ativos (ID #1..#{dadosAuditoria.resumo.maiorIdBase || '-'}) •{' '}
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        {dadosAuditoria.resumo.totalLacunasBase ??
                          dadosAuditoria.resumo.totalExcluidos}{' '}
                        lacunas históricas
                      </span>
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="border-blue-500/20 bg-gradient-to-br from-blue-50/50 via-white to-blue-50/20 dark:from-blue-950/20 dark:via-slate-900 dark:to-blue-950/10 shadow-sm relative overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                    Saldo Líquido do Mês
                  </CardTitle>
                  <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400">
                    <Scale className="w-5 h-5" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div
                    className={`text-3xl font-extrabold ${
                      dadosAuditoria.resumo.saldoLiquido >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {dadosAuditoria.resumo.saldoLiquido > 0
                      ? `+${dadosAuditoria.resumo.saldoLiquido}`
                      : dadosAuditoria.resumo.saldoLiquido}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {dadosAuditoria.resumo.saldoLiquido >= 0 ? (
                      <span className="text-emerald-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 inline" />{' '}
                        Crescimento de base
                      </span>
                    ) : (
                      <span className="text-rose-600 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 inline" /> Queda
                        líquida na base
                      </span>
                    )}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

        {/* ── Search & Filter Controls ──────────────────────────── */}
        <Card className="p-4 bg-card/60 backdrop-blur-md border border-slate-200 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por Nome, CPF/CNPJ, ID, Atendente, Plano ou Bairro..."
                value={termoBusca}
                onChange={(evento) => setTermoBusca(evento.target.value)}
                className="pl-9 h-10 text-sm"
              />
            </div>

            <div className="w-full sm:w-60">
              <Select
                value={filtroAtendente}
                onValueChange={setFiltroAtendente}
              >
                <SelectTrigger className="h-10 text-xs">
                  <SelectValue placeholder="Filtrar por Atendente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">
                    Todos os Atendentes ({listaAtendentes.length})
                  </SelectItem>
                  {listaAtendentes.map((atendente) => (
                    <SelectItem key={atendente} value={atendente}>
                      {atendente}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {termoBusca && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTermoBusca('')}
                className="text-xs h-10 px-3"
              >
                Limpar Busca
              </Button>
            )}
          </div>
        </Card>

        {/* ── Main Tabs & Content ───────────────────────────────── */}
        <Tabs
          value={abaAtiva}
          onValueChange={setAbaAtiva}
          className="space-y-4"
        >
          <TabsList className="bg-muted/80 p-1 rounded-xl flex flex-wrap h-auto gap-1">
            <TabsTrigger
              value="overview"
              className="text-xs py-2 px-3 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800"
            >
              <Info className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger
              value="cadastrados"
              className="text-xs py-2 px-3 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800"
            >
              <UserPlus className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
              Cadastrados no Mês ({dadosAuditoria?.cadastrados.length || 0})
            </TabsTrigger>
            <TabsTrigger
              value="cancelados"
              className="text-xs py-2 px-3 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800"
            >
              <UserMinus className="w-3.5 h-3.5 mr-1.5 text-rose-500" />
              Cancelados no Mês ({dadosAuditoria?.cancelados.length || 0}
              {(dadosAuditoria?.ticketsRemocao?.length || 0) > 0 &&
                ` + ${dadosAuditoria?.ticketsRemocao?.length} ret.`}
              )
            </TabsTrigger>
            <TabsTrigger
              value="excluidos"
              className="text-xs py-2 px-3 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800"
            >
              <ShieldAlert className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
              Excluídos do ISPFY ({dadosAuditoria?.excluidos.length || 0}
              {(dadosAuditoria?.lacunasHistoricas?.length || 0) >
                (dadosAuditoria?.excluidos.length || 0) &&
                ` / ${dadosAuditoria?.lacunasHistoricas?.length}`}
              )
            </TabsTrigger>
            <TabsTrigger
              value="atendentes"
              className="text-xs py-2 px-3 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800"
            >
              <Award className="w-3.5 h-3.5 mr-1.5 text-purple-500" />
              Produtividade por Atendente
            </TabsTrigger>
          </TabsList>

          {/* ABA 1: VISÃO GERAL */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 border border-slate-200 dark:border-slate-800">
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Scale className="w-4 h-4 text-indigo-500" />
                    Balanço do Período ({nomeMesAtual}/{anoSelecionado})
                  </CardTitle>
                  <CardDescription>
                    Distribuição percentual entre novos cadastros, cancelamentos contratuais e exclusões
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {dadosAuditoria && (
                    <>
                      <div className="space-y-4">
                        {barrasBalancoPeriodo.map((barra) => (
                          <div key={barra.rotulo}>
                            <div className="flex justify-between text-xs font-medium mb-1">
                              <span
                                className={`${barra.classeTexto} flex items-center gap-1.5`}
                              >
                                <span
                                  className={`w-2.5 h-2.5 rounded-full ${barra.corPonto} inline-block`}
                                />
                                {barra.rotulo}
                              </span>
                              <span className="font-bold">
                                {Math.round(barra.porcentagem)}%
                              </span>
                            </div>
                            <Progress
                              value={barra.porcentagem}
                              className={barra.classeBarra}
                            />
                          </div>
                        ))}
                      </div>

                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-2 text-muted-foreground">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-500" />
                          Metodologia da Auditoria ISPFY (Dados Reais em Tempo Real)
                        </div>
                        <p>
                          • <strong>Cadastrados:</strong> Clientes criados na base completa{' '}
                          <code className="text-[11px] bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">
                            /cliente
                          </code>{' '}
                          no mês, cruzados com contratos, pontos/planos reais (
                          <code className="text-[11px] bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">
                            /ponto/planos
                          </code>
                          ), cidades (
                          <code className="text-[11px] bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">
                            /cidade
                          </code>
                          ) e telefones (
                          <code className="text-[11px] bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">
                            /cliente/contato
                          </code>
                          ).
                        </p>
                        <p>
                          • <strong>Cancelados &amp; Retiradas:</strong>{' '}
                          Contratos com{' '}
                          <code className="text-[11px] bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">
                            data_rescisao
                          </code>{' '}
                          no mês (distinguindo cancelamento total vs parcial), além de tickets de retirada de equipamentos (Tópico 7) ainda sem baixa contratual.
                        </p>
                        <p>
                          • <strong>Excluídos:</strong> Catálogo persistente na nuvem (Firestore) para registrar nome, CPF e data antes da exclusão + varredura global de lacunas na sequência de IDs da base inteira.
                        </p>
                        {(dadosAuditoria.resumo.totalTicketsRemocao || 0) >
                          0 && (
                          <div className="pt-2 mt-2 border-t border-amber-500/20 flex items-center justify-between text-amber-700 dark:text-amber-300 font-medium">
                            <span className="flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              {dadosAuditoria.resumo.totalTicketsRemocao} ticket(s) de retirada de equipamento aberto(s) no mês sem rescisão formal no contrato.
                            </span>
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => setAbaAtiva('cancelados')}
                              className="h-auto p-0 text-xs text-amber-700 dark:text-amber-300 underline"
                            >
                              Ver na aba Cancelados
                            </Button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="border border-slate-200 dark:border-slate-800">
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Award className="w-4 h-4 text-purple-500" />
                    Top Cadastradores
                  </CardTitle>
                  <CardDescription>
                    Atendentes com mais clientes no mês
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {dadosAuditoria?.resumo.rankingAtendentes.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Nenhum cadastro neste mês.
                    </p>
                  )}
                  {dadosAuditoria?.resumo.rankingAtendentes
                    .slice(0, 5)
                    .map((item, indice) => (
                      <div
                        key={item.usuario}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                              indice === 0
                                ? 'bg-amber-500 text-white'
                                : indice === 1
                                ? 'bg-slate-400 text-white'
                                : indice === 2
                                ? 'bg-amber-700 text-white'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {indice + 1}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {item.usuario}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {Math.round(
                                (item.cadastros /
                                  (dadosAuditoria.resumo.totalCadastrados ||
                                    1)) *
                                  100
                              )}
                              % dos cadastros
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className="font-mono text-xs bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800"
                        >
                          {item.cadastros} clientes
                        </Badge>
                      </div>
                    ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ABA 2: CADASTRADOS NO MÊS */}
          <TabsContent value="cadastrados" className="space-y-4">
            <Card className="border border-slate-200 dark:border-slate-800 overflow-hidden">
              <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 pb-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                      <UserPlus className="w-5 h-5" />
                      Clientes Cadastrados em {nomeMesAtual}/{anoSelecionado}
                    </CardTitle>
                    <CardDescription>
                      Exibindo {cadastradosFiltrados.length} de{' '}
                      {dadosAuditoria?.cadastrados.length || 0} clientes encontrados
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"
                  >
                    Total: {dadosAuditoria?.cadastrados.length || 0} registros
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="w-16">ID</TableHead>
                        <TableHead>Nome / Razão Social</TableHead>
                        <TableHead>CPF / CNPJ</TableHead>
                        <TableHead>Data de Cadastro</TableHead>
                        <TableHead>Atendente</TableHead>
                        <TableHead>Plano &amp; Valor</TableHead>
                        <TableHead>Localidade</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cadastradosFiltrados.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={8}
                            className="h-32 text-center text-muted-foreground"
                          >
                            Nenhum cliente cadastrado encontrado com os filtros aplicados.
                          </TableCell>
                        </TableRow>
                      ) : (
                        cadastradosFiltrados.map((cliente) => (
                          <TableRow
                            key={cliente.id}
                            className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition-colors"
                          >
                            <TableCell className="font-mono text-xs font-semibold text-slate-500">
                              #{cliente.id}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                {cliente.nome_razao}
                              </div>
                              {cliente.telefone && (
                                <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Phone className="w-3 h-3 text-emerald-500" />
                                  {cliente.telefone}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {formatarDocumentoCpfCnpj(cliente.cpf_cnpj)}
                            </TableCell>
                            <TableCell className="text-xs">
                              <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                {formatarDataAuditoria(cliente.data_cadastro)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className="text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                              >
                                {cliente.usuario_cadastrou}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {cliente.sem_contrato ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] border-amber-400/60 text-amber-700 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/30"
                                >
                                  Sem contrato vinculado
                                </Badge>
                              ) : (
                                <>
                                  <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                                    {cliente.plano || 'Não identificado'}
                                  </div>
                                  <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                    {formatarMoedaBRL(
                                      parseFloat(cliente.valor_mensal || '0')
                                    )}
                                    /mês
                                  </div>
                                </>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatarLocalidade(
                                cliente.bairro,
                                cliente.cidade
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <AcoesLinhaAuditoria
                                textoCopia={`${cliente.nome_razao} - ${formatarDocumentoCpfCnpj(
                                  cliente.cpf_cnpj
                                )}`}
                                rotuloCopia="Dados do cliente"
                                telefone={cliente.telefone}
                                clienteId={cliente.id}
                                aoCopiar={aoCopiarTexto}
                                aoAbrirCliente={(id) =>
                                  navegar(`/ispfy/cliente/${id}`)
                                }
                              />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA 3: CANCELADOS NO MÊS */}
          <TabsContent value="cancelados" className="space-y-4">
            <Card className="border border-slate-200 dark:border-slate-800 overflow-hidden">
              <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 pb-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2 text-rose-700 dark:text-rose-400">
                      <UserMinus className="w-5 h-5" />
                      Contratos Cancelados / Rescindidos em {nomeMesAtual}/
                      {anoSelecionado}
                    </CardTitle>
                    <CardDescription>
                      Exibindo {canceladosFiltrados.length} de{' '}
                      {dadosAuditoria?.cancelados.length || 0} cancelamentos formais registrados no ISPFY
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300"
                  >
                    Total: {dadosAuditoria?.cancelados.length || 0} rescisões
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="w-20">Contrato</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>CPF / CNPJ</TableHead>
                        <TableHead>Plano &amp; Valor</TableHead>
                        <TableHead>Localidade</TableHead>
                        <TableHead>Adesão / Rescisão</TableHead>
                        <TableHead>Cadastrado por / Vínculo</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {canceladosFiltrados.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={8}
                            className="h-32 text-center text-muted-foreground"
                          >
                            Nenhum contrato rescindido ou cancelado neste mês.
                          </TableCell>
                        </TableRow>
                      ) : (
                        canceladosFiltrados.map((contrato) => (
                          <TableRow
                            key={contrato.id}
                            className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition-colors"
                          >
                            <TableCell className="font-mono text-xs font-semibold text-slate-500">
                              #{contrato.id}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-xs text-slate-900 dark:text-slate-100">
                                {contrato.nome_cliente}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono">
                                ID Cliente: #{contrato.id_cliente}
                              </div>
                              {contrato.telefone && (
                                <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Phone className="w-3 h-3 text-emerald-500" />
                                  {contrato.telefone}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {formatarDocumentoCpfCnpj(contrato.cpf_cnpj)}
                            </TableCell>
                            <TableCell>
                              <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                                {contrato.plano || 'Não identificado'}
                              </div>
                              <div className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                                {formatarMoedaBRL(
                                  parseFloat(contrato.valor_mensal || '0')
                                )}
                                /mês
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatarLocalidade(
                                contrato.bairro,
                                contrato.cidade
                              )}
                            </TableCell>
                            <TableCell className="text-xs space-y-0.5">
                              <div className="text-muted-foreground">
                                Adesão:{' '}
                                {formatarDataAuditoria(contrato.data_adesao)}
                              </div>
                              <div className="font-medium text-rose-600 dark:text-rose-400">
                                Rescisão:{' '}
                                {formatarDataAuditoria(contrato.data_rescisao)}
                              </div>
                              {contrato.dias_ativo !== undefined && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-normal border-slate-300 mt-0.5"
                                >
                                  {contrato.dias_ativo} dias (~
                                  {Math.round(contrato.dias_ativo / 30)} meses)
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="space-y-1">
                              <Badge
                                variant="secondary"
                                className="text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                              >
                                {contrato.usuario_cadastrou}
                              </Badge>
                              <div>
                                {(contrato.contratos_ativos_restantes || 0) >
                                0 ? (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] border-amber-400/60 text-amber-700 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/30"
                                  >
                                    Mantém{' '}
                                    {contrato.contratos_ativos_restantes}{' '}
                                    ativo(s)
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] border-rose-400/60 text-rose-700 dark:text-rose-300 bg-rose-50/70 dark:bg-rose-950/30"
                                  >
                                    Cancelamento Total
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <AcoesLinhaAuditoria
                                textoCopia={`${contrato.nome_cliente} (ID: ${contrato.id_cliente}) - Rescisão: ${contrato.data_rescisao}`}
                                rotuloCopia="Dados do cancelamento"
                                telefone={contrato.telefone}
                                clienteId={contrato.id_cliente}
                                aoCopiar={aoCopiarTexto}
                                aoAbrirCliente={(id) =>
                                  navegar(`/ispfy/cliente/${id}`)
                                }
                              />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {(dadosAuditoria?.ticketsRemocao?.length || 0) > 0 && (
              <Card className="border border-amber-500/30 dark:border-amber-500/20 overflow-hidden">
                <CardHeader className="bg-amber-50/50 dark:bg-amber-950/20 pb-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <CardTitle className="text-base font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="w-5 h-5" />
                        Tickets de Retirada de Equipamentos (Sem Rescisão Formal no Contrato)
                      </CardTitle>
                      <CardDescription>
                        Chamados de remoção (Tópico 7) abertos em {nomeMesAtual}/
                        {anoSelecionado} cujo contrato ainda não possui{' '}
                        <code className="text-[11px]">data_rescisao</code> no ISPFY
                      </CardDescription>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-amber-100/80 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300"
                    >
                      {ticketsRemocaoFiltrados.length} chamado(s)
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="w-20">Ticket</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Plano &amp; Valor</TableHead>
                          <TableHead>Localidade</TableHead>
                          <TableHead>Abertura / Status Contrato</TableHead>
                          <TableHead>Assunto / Motivo</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ticketsRemocaoFiltrados.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={7}
                              className="h-24 text-center text-muted-foreground"
                            >
                              Nenhum ticket de retirada correspondente aos filtros aplicados.
                            </TableCell>
                          </TableRow>
                        ) : (
                          ticketsRemocaoFiltrados.map((ticket) => (
                            <TableRow
                              key={`tk-${ticket.ticket_id || ticket.id}`}
                              className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition-colors"
                            >
                              <TableCell className="font-mono text-xs font-semibold text-amber-700 dark:text-amber-400">
                                #{ticket.ticket_id || ticket.id}
                              </TableCell>
                              <TableCell>
                                <div className="font-medium text-xs text-slate-900 dark:text-slate-100">
                                  {ticket.nome_cliente}
                                </div>
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  Cliente #{ticket.id_cliente} • Contrato #
                                  {ticket.id}
                                </div>
                                {ticket.telefone && (
                                  <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                    <Phone className="w-3 h-3 text-emerald-500" />
                                    {ticket.telefone}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                                  {ticket.plano || 'Não identificado'}
                                </div>
                                <div className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                                  {formatarMoedaBRL(
                                    parseFloat(ticket.valor_mensal || '0')
                                  )}
                                  /mês
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {formatarLocalidade(
                                  ticket.bairro,
                                  ticket.cidade
                                )}
                              </TableCell>
                              <TableCell className="text-xs space-y-1">
                                <div>
                                  {formatarDataAuditoria(
                                    ticket.data_abertura_ticket ||
                                      ticket.data_rescisao
                                  )}
                                </div>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] uppercase border-amber-400/60 text-amber-700 dark:text-amber-300"
                                >
                                  {ticket.status_contrato || 'em aberto'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-[260px]">
                                <span className="line-clamp-2">
                                  {ticket.observacoes || '-'}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <AcoesLinhaAuditoria
                                  textoCopia={`${ticket.nome_cliente} (ID: ${ticket.id_cliente}) - Ticket #${ticket.ticket_id}`}
                                  rotuloCopia="Dados do ticket"
                                  telefone={ticket.telefone}
                                  clienteId={ticket.id_cliente}
                                  aoCopiar={aoCopiarTexto}
                                  aoAbrirCliente={(id) =>
                                    navegar(`/ispfy/cliente/${id}`)
                                  }
                                />
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ABA 4: EXCLUÍDOS DO ISPFY */}
          <TabsContent value="excluidos" className="space-y-4">
            <Card className="p-5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg shrink-0 mt-0.5">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="space-y-1 text-xs">
                  <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex flex-wrap items-center gap-2">
                    Auditoria Forense de Exclusões e Deleções no ISPFY
                    <Badge
                      variant="outline"
                      className="border-amber-400 text-amber-600 dark:text-amber-400 text-[10px]"
                    >
                      Detecção Sequencial Global &amp; Snapshot em Nuvem
                    </Badge>
                    {dadosAuditoria?.resumo.snapshotCloudAtivo !== undefined && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          dadosAuditoria.resumo.snapshotCloudAtivo
                            ? 'border-emerald-400 text-emerald-600 dark:text-emerald-400'
                            : 'border-slate-400 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {dadosAuditoria.resumo.snapshotCloudAtivo
                          ? 'Firestore Sincronizado'
                          : 'Somente Cache Local'}
                      </Badge>
                    )}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Quando um operador apaga um cliente no ISPFY, o registro sofre exclusão direta do banco (hard delete), deixando lacuna na numeração sequencial. O painel compara toda a base ativa (IDs #1 até #
                    {dadosAuditoria?.resumo.maiorIdBase || '...'}) contra o snapshot salvo em nuvem: registros excluídos após a implantação do snapshot exibem nome, CPF e responsável; lacunas antigas anteriores ao primeiro snapshot exibem os clientes vizinhos exatos para rastreio.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="border border-slate-200 dark:border-slate-800 overflow-hidden">
              <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 pb-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <ShieldAlert className="w-5 h-5" />
                      Registros Excluídos / Expurgados Detectados
                    </CardTitle>
                    <CardDescription>
                      {modoExclusoes === 'historico'
                        ? `Exibindo ${excluidosFiltrados.length} de ${
                            dadosAuditoria?.lacunasHistoricas?.length || 0
                          } lacunas na base completa (#1..#${
                            dadosAuditoria?.resumo.maiorIdBase || '-'
                          })`
                        : `Exibindo ${excluidosFiltrados.length} de ${
                            dadosAuditoria?.excluidos.length || 0
                          } ocorrências estimadas em ${nomeMesAtual}/${anoSelecionado}`}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant={
                        modoExclusoes === 'periodo' ? 'default' : 'outline'
                      }
                      size="sm"
                      onClick={() => setModoExclusoes('periodo')}
                      className="h-8 text-xs"
                    >
                      Do Período ({dadosAuditoria?.excluidos.length || 0})
                    </Button>
                    <Button
                      variant={
                        modoExclusoes === 'historico' ? 'default' : 'outline'
                      }
                      size="sm"
                      onClick={() => setModoExclusoes('historico')}
                      className="h-8 text-xs"
                    >
                      Todas as Lacunas da Base (
                      {dadosAuditoria?.lacunasHistoricas?.length ||
                        dadosAuditoria?.excluidos.length ||
                        0}
                      )
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="w-20">ID Excluído</TableHead>
                        <TableHead>Tipo de Detecção</TableHead>
                        <TableHead>Nome / Informações Prévias</TableHead>
                        <TableHead>Data Estimada / Detecção</TableHead>
                        <TableHead>Referência Anterior</TableHead>
                        <TableHead>Referência Posterior</TableHead>
                        <TableHead>Status da Auditoria</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {excluidosFiltrados.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="h-32 text-center text-muted-foreground"
                          >
                            <div className="flex flex-col items-center justify-center gap-2">
                              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {modoExclusoes === 'historico'
                                  ? 'Nenhuma exclusão ou lacuna encontrada com os filtros aplicados.'
                                  : `Nenhuma exclusão ou lacuna sequencial detectada em ${nomeMesAtual}/${anoSelecionado}.`}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {(dadosAuditoria?.lacunasHistoricas?.length ||
                                  0) > 0 && modoExclusoes === 'periodo'
                                  ? `Existem ${dadosAuditoria?.lacunasHistoricas?.length} lacunas históricas na base completa. Clique em "Todas as Lacunas da Base" para visualizar.`
                                  : 'Todos os IDs sequenciais estão íntegros no escopo selecionado.'}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        excluidosFiltrados.map((exclusao) => (
                          <TableRow
                            key={exclusao.id}
                            className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition-colors"
                          >
                            <TableCell className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                              #{exclusao.id}
                            </TableCell>
                            <TableCell>
                              {exclusao.tipo === 'snapshot_removido' ? (
                                <Badge className="bg-rose-500/20 text-rose-600 border border-rose-500/30 text-[10px]">
                                  Removido da Base
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[10px]">
                                  Lacuna Sequencial (Gap)
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-xs text-slate-900 dark:text-slate-100">
                                {exclusao.nome || 'Cadastro Excluído do ISPFY'}
                              </div>
                              {exclusao.cpf_cnpj && (
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  CPF/CNPJ:{' '}
                                  {formatarDocumentoCpfCnpj(exclusao.cpf_cnpj)}
                                </div>
                              )}
                              {exclusao.telefone && (
                                <div className="text-[10px] text-muted-foreground">
                                  Tel: {exclusao.telefone}
                                </div>
                              )}
                              {(exclusao.bairro || exclusao.cidade) && (
                                <div className="text-[10px] text-muted-foreground">
                                  {formatarLocalidade(
                                    exclusao.bairro,
                                    exclusao.cidade
                                  )}
                                </div>
                              )}
                              {exclusao.usuario_cadastrou && (
                                <div className="text-[10px] text-muted-foreground">
                                  Cadastrado por: {exclusao.usuario_cadastrou}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground space-y-0.5">
                              <div>
                                {formatarDataAuditoria(exclusao.provavel_data)}
                              </div>
                              {exclusao.detectado_em && (
                                <div className="text-[10px] text-rose-600 dark:text-rose-400">
                                  Detectado:{' '}
                                  {formatarDataAuditoria(exclusao.detectado_em)}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">
                              {exclusao.referencia_anterior ? (
                                <div>
                                  <span className="font-mono text-slate-500">
                                    #{exclusao.referencia_anterior.id}
                                  </span>
                                  <p className="text-[11px] text-slate-700 dark:text-slate-300 truncate max-w-[160px]">
                                    {exclusao.referencia_anterior.nome}
                                  </p>
                                  {exclusao.referencia_anterior.data_cadastro && (
                                    <p className="text-[10px] text-muted-foreground">
                                      {formatarDataAuditoria(
                                        exclusao.referencia_anterior
                                          .data_cadastro
                                      )}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell className="text-xs">
                              {exclusao.referencia_posterior ? (
                                <div>
                                  <span className="font-mono text-slate-500">
                                    #{exclusao.referencia_posterior.id}
                                  </span>
                                  <p className="text-[11px] text-slate-700 dark:text-slate-300 truncate max-w-[160px]">
                                    {exclusao.referencia_posterior.nome}
                                  </p>
                                  {exclusao.referencia_posterior
                                    .data_cadastro && (
                                    <p className="text-[10px] text-muted-foreground">
                                      {formatarDataAuditoria(
                                        exclusao.referencia_posterior
                                          .data_cadastro
                                      )}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/30 dark:text-rose-400"
                              >
                                ❌ Excluído
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA 5: PRODUTIVIDADE POR ATENDENTE */}
          <TabsContent value="atendentes" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dadosAuditoria?.resumo.rankingAtendentes.map((item, indice) => {
                const cadastrosAtendente = dadosAuditoria.cadastrados.filter(
                  (c) => c.usuario_cadastrou === item.usuario
                );
                const canceladosAtendente = dadosAuditoria.cancelados.filter(
                  (c) => c.usuario_cadastrou === item.usuario
                );
                const mrrGerado = cadastrosAtendente.reduce(
                  (soma, atual) =>
                    soma + (parseFloat(atual.valor_mensal || '0') || 0),
                  0
                );
                const participacaoPct =
                  (item.cadastros /
                    (dadosAuditoria.resumo.totalCadastrados || 1)) *
                  100;

                return (
                  <motion.div
                    key={item.usuario}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: indice * 0.05 }}
                  >
                    <Card className="border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
                              {item.usuario.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <CardTitle className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                {item.usuario}
                              </CardTitle>
                              <p className="text-[11px] text-muted-foreground">
                                Operador ISPFY
                              </p>
                            </div>
                          </div>
                          <Badge className="bg-indigo-600 text-white font-mono text-xs">
                            #{indice + 1}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 pt-0">
                        <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg text-xs">
                          <div>
                            <span className="text-muted-foreground text-[10px] block">
                              Cadastros
                            </span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-base">
                              {cadastrosAtendente.length}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-[10px] block">
                              Cancelamentos
                            </span>
                            <span className="font-bold text-rose-600 dark:text-rose-400 text-base">
                              {canceladosAtendente.length}
                            </span>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>Participação no total</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {Math.round(participacaoPct)}%
                            </span>
                          </div>
                          <Progress
                            value={participacaoPct}
                            className="h-2 bg-slate-100 dark:bg-slate-800 [&>div]:bg-indigo-600"
                          />
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-muted-foreground">
                            MRR Gerado:
                          </span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatarMoedaBRL(mrrGerado)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
}

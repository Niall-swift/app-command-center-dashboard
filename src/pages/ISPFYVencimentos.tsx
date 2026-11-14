import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
  Users,
  Search,
  Filter,
  Rocket,
  RefreshCw,
  CheckSquare,
  Square,
  Download,
} from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import { ispfyService } from '@/services/ispfy/ispfyService';
import type { ISPFYClienteData, ISPFYContratoData } from '@/types/ispfy';
import { baixarArquivoCsv } from '@/lib/utils';
import { obterDataLocalIso } from '@/utils/date';
import {
  formatarDocumentoCpfCnpj,
  isDataVaziaISPFY,
  isRegistroAtivo,
  obterNomeClienteISPFY,
  obterTelefoneClienteISPFY,
} from '@/utils/ispfyFormatters';
import { toast } from 'sonner';

type EscopoAlteracao = 'both' | 'contract' | 'client';
type StatusAlteracaoLote = 'pendente' | 'processando' | 'sucesso' | 'erro';

interface ItemClienteVencimento extends ISPFYClienteData {
  idContrato?: string;
  planoNome?: string;
  vencimentoAtual?: string;
  diaVencimentoBruto?: string;
  statusAlterado?: StatusAlteracaoLote;
  mensagemAlteracao?: string;
  novoVencimento?: string;
}

const DIAS_VENCIMENTO_PADRAO = ['05', '10', '15', '20', '25', '30'];

const obterCicloVencimentoPadrao = (diaBruto: string): string => {
  const dia = parseInt(diaBruto, 10);
  if (isNaN(dia)) return 'Não definido';
  if (dia >= 3 && dia <= 7) return 'Dia 5';
  if (dia >= 8 && dia <= 12) return 'Dia 10';
  if (dia >= 13 && dia <= 17) return 'Dia 15';
  if (dia >= 18 && dia <= 22) return 'Dia 20';
  if (dia >= 23 && dia <= 27) return 'Dia 25';
  if (dia >= 28 || dia <= 2) return 'Dia 30';
  return `Dia ${dia}`;
};

export default function ISPFYVencimentos() {
  const [clientes, setClientes] = useState<ItemClienteVencimento[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [mensagemStatus, setMensagemStatus] = useState('');

  // Filtros e pesquisa
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroVencimento, setFiltroVencimento] = useState<string>('todos');

  // Seleção em lote
  const [idsSelecionados, setIdsSelecionados] = useState<Set<string>>(new Set());

  // Configuração da alteração em massa
  const [diaDestino, setDiaDestino] = useState<string>('10');
  const [diaPersonalizado, setDiaPersonalizado] = useState<string>('');
  const [usarDiaPersonalizado, setUsarDiaPersonalizado] = useState<boolean>(false);
  const [escopoAlteracao, setEscopoAlteracao] = useState<EscopoAlteracao>('both');

  // Execução do processamento em lote
  const [processandoLote, setProcessandoLote] = useState(false);
  const [progressoLote, setProgressoLote] = useState(0);
  const [resumoLote, setResumoLote] = useState({ sucessos: 0, erros: 0, processados: 0 });

  const aoBuscarClientes = async () => {
    setCarregando(true);
    setProgresso(0);
    setMensagemStatus('Carregando lista de clientes ativos do ISPFY...');
    setClientes([]);
    setIdsSelecionados(new Set());

    try {
      const todosRegistrosClientes = await ispfyService.fetchAllClientes((total) => {
        setProgresso(Math.min(30, Math.floor((total / 1000) * 30)));
        setMensagemStatus(`Buscando clientes (ativos e inativos)... (${total} localizados)`);
      });

      if (todosRegistrosClientes.length === 0) {
        toast.warning('Nenhum cliente localizado no ISPFY.');
        return;
      }

      setProgresso(35);
      setMensagemStatus('Sincronizando contratos e faturas para identificar ciclo atual...');
      const contratos = await ispfyService.fetchAllContratos((total) => {
        setProgresso(Math.min(65, 35 + Math.floor((total / 1000) * 30)));
      });

      const mapaContratos = new Map<string, ISPFYContratoData>();
      contratos.forEach((contrato) => {
        if (contrato.id_cliente) {
          mapaContratos.set(String(contrato.id_cliente), contrato);
        }
      });

      setProgresso(70);
      setMensagemStatus('Analisando datas de faturas em aberto...');
      const faturas = await ispfyService.fetchAllFaturasAbertas((total) => {
        setProgresso(Math.min(95, 70 + Math.floor((total / 1000) * 20)));
      });

      const mapaVencimentosFaturas = new Map<string, string>();
      faturas.forEach((fatura) => {
        if (fatura.id_cliente && fatura.data_vencimento && !mapaVencimentosFaturas.has(String(fatura.id_cliente))) {
          mapaVencimentosFaturas.set(String(fatura.id_cliente), String(fatura.data_vencimento));
        }
      });

      setProgresso(98);
      setMensagemStatus('Organizando e processando grade de clientes...');

      const clientesEnriquecidos: ItemClienteVencimento[] = todosRegistrosClientes.map((cliente) => {
        const idCliente = String(cliente.id);
        const contrato = mapaContratos.get(idCliente);
        const dataFatura = mapaVencimentosFaturas.get(idCliente);

        let idContrato: string | undefined;
        let planoNome = 'Sem contrato ativo';
        let diaBruto = '';

        if (contrato) {
          idContrato = String(contrato.id);
          planoNome = String(contrato.contrato || contrato.plano || contrato.descricao || 'Plano Padrão');

          if (dataFatura && dataFatura.includes('-')) {
            diaBruto = dataFatura.split('-')[2];
          } else {
            const referencia = !isDataVaziaISPFY(contrato.pago_ate_data)
              ? contrato.pago_ate_data || ''
              : contrato.data_ativacao || '';
            if (referencia && referencia.includes('-')) {
              diaBruto = referencia.split('-')[2];
            }
          }
        }

        const vencimentoAtual = diaBruto ? obterCicloVencimentoPadrao(diaBruto) : 'Não definido';

        return {
          ...cliente,
          idContrato,
          planoNome,
          diaVencimentoBruto: diaBruto,
          vencimentoAtual,
          statusAlterado: 'pendente',
        };
      });

      setClientes(clientesEnriquecidos);
      setProgresso(100);
      toast.success(`${clientesEnriquecidos.length} clientes e seus vencimentos foram carregados com sucesso!`);
    } catch (erro: unknown) {
      const descricao = erro instanceof Error ? erro.message : 'Falha inesperada ao consultar o ISPFY';
      toast.error('Erro ao carregar clientes do ISPFY', { description: descricao });
    } finally {
      setCarregando(false);
    }
  };

  const clientesFiltrados = useMemo(() => {
    const consulta = termoBusca.toLowerCase();
    return clientes.filter((cliente) => {
      const correspondeBusca =
        termoBusca === '' ||
        obterNomeClienteISPFY(cliente, '').toLowerCase().includes(consulta) ||
        String(cliente.cnpj_cpf || '').includes(termoBusca) ||
        String(cliente.id || '').includes(termoBusca) ||
        String(cliente.cidade || '').toLowerCase().includes(consulta);

      const correspondeVencimento =
        filtroVencimento === 'todos' ||
        (filtroVencimento === 'nao_definido' && cliente.vencimentoAtual === 'Não definido') ||
        cliente.vencimentoAtual?.toLowerCase().includes(filtroVencimento.toLowerCase());

      return correspondeBusca && correspondeVencimento;
    });
  }, [clientes, termoBusca, filtroVencimento]);

  const aoAlternarSelecao = (idCliente: string) => {
    setIdsSelecionados((anterior) => {
      const proximo = new Set(anterior);
      if (proximo.has(idCliente)) proximo.delete(idCliente);
      else proximo.add(idCliente);
      return proximo;
    });
  };

  const aoSelecionarTodosVisiveis = () => {
    const idsVisiveis = clientesFiltrados.map((cliente) => String(cliente.id));
    const todosJaSelecionados = idsVisiveis.every((id) => idsSelecionados.has(id));

    setIdsSelecionados((anterior) => {
      const proximo = new Set(anterior);
      idsVisiveis.forEach((id) => {
        if (todosJaSelecionados) proximo.delete(id);
        else proximo.add(id);
      });
      return proximo;
    });
  };

  const todosVisiveisSelecionados =
    clientesFiltrados.length > 0 &&
    clientesFiltrados.every((cliente) => idsSelecionados.has(String(cliente.id)));

  const atualizarStatusCliente = (
    idCliente: string,
    atualizacao: Partial<ItemClienteVencimento>
  ) => {
    setClientes((anterior) =>
      anterior.map((item) => (String(item.id) === idCliente ? { ...item, ...atualizacao } : item))
    );
  };

  const aoExecutarAlteracaoEmMassa = async () => {
    if (idsSelecionados.size === 0) {
      toast.error('Selecione ao menos um cliente para alterar a data de vencimento.');
      return;
    }

    const diaFinal = usarDiaPersonalizado ? diaPersonalizado.trim() : diaDestino;
    const numeroDia = parseInt(diaFinal, 10);

    if (isNaN(numeroDia) || numeroDia < 1 || numeroDia > 31) {
      toast.error('O novo dia de vencimento deve ser um número entre 1 e 31.');
      return;
    }

    const diaFormatado = String(numeroDia).padStart(2, '0');
    const listaSelecionados = Array.from(idsSelecionados);

    setProcessandoLote(true);
    setProgressoLote(0);
    setResumoLote({ sucessos: 0, erros: 0, processados: 0 });

    toast.info(`Iniciando alteração em massa para o Dia ${diaFormatado}...`, {
      description: `Processando ${listaSelecionados.length} clientes selecionados.`,
    });

    let totalSucessos = 0;
    let totalErros = 0;

    for (let indice = 0; indice < listaSelecionados.length; indice++) {
      const idCliente = listaSelecionados[indice];
      const clienteAtual = clientes.find((item) => String(item.id) === idCliente);

      if (!clienteAtual) continue;

      atualizarStatusCliente(idCliente, {
        statusAlterado: 'processando',
        mensagemAlteracao: 'Enviando alteração para ISPFY...',
      });

      try {
        const resposta = await ispfyService.updateDueDate(
          idCliente,
          clienteAtual.idContrato,
          diaFormatado,
          escopoAlteracao
        );

        if (resposta.success) {
          totalSucessos++;
          atualizarStatusCliente(idCliente, {
            statusAlterado: 'sucesso',
            mensagemAlteracao: 'Vencimento alterado no ISPFY',
            vencimentoAtual: `Dia ${numeroDia}`,
            novoVencimento: diaFormatado,
          });
        } else {
          totalErros++;
          atualizarStatusCliente(idCliente, {
            statusAlterado: 'erro',
            mensagemAlteracao: resposta.message,
          });
        }
      } catch (erro: unknown) {
        totalErros++;
        const mensagemErro = erro instanceof Error ? erro.message : 'Falha na requisição';
        atualizarStatusCliente(idCliente, {
          statusAlterado: 'erro',
          mensagemAlteracao: mensagemErro,
        });
      }

      const processadosAteAgora = indice + 1;
      setResumoLote({ sucessos: totalSucessos, erros: totalErros, processados: processadosAteAgora });
      setProgressoLote(Math.round((processadosAteAgora / listaSelecionados.length) * 100));

      // Pequeno intervalo para não sobrecarregar a API do ISPFY
      if (indice % 5 === 0 && indice > 0) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    setProcessandoLote(false);
    toast[totalErros === 0 ? 'success' : 'warning'](
      `Alteração em massa concluída! ${totalSucessos} atualizados, ${totalErros} falhas.`,
      { description: 'Verifique a coluna de status para os detalhes de cada cliente.' }
    );
  };

  const aoExportarLog = () => {
    const processados = clientes.filter((cliente) => cliente.statusAlterado !== 'pendente');
    if (processados.length === 0) {
      toast.error('Nenhum cliente foi processado ainda nesta sessão para exportar.');
      return;
    }

    const cabecalhos = [
      'ID Cliente',
      'Nome',
      'CPF/CNPJ',
      'Contrato',
      'Status Alteração',
      'Mensagem / Retorno',
      'Vencimento Atual',
    ];
    const linhas = processados.map((cliente) => [
      cliente.id || '',
      `"${obterNomeClienteISPFY(cliente, '').replace(/"/g, '""')}"`,
      formatarDocumentoCpfCnpj(cliente.cnpj_cpf),
      cliente.idContrato || 'Sem contrato',
      cliente.statusAlterado === 'sucesso' ? 'SUCESSO' : 'ERRO',
      `"${String(cliente.mensagemAlteracao || '').replace(/"/g, '""')}"`,
      cliente.vencimentoAtual || '',
    ]);

    const conteudoCsv = [cabecalhos.join(';'), ...linhas.map((linha) => linha.join(';'))].join('\n');
    baixarArquivoCsv(`log_alteracao_vencimentos_${obterDataLocalIso()}.csv`, conteudoCsv);
  };

  return (
    <PageTransition>
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        {/* Cabeçalho */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/60 pb-5"
        >
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md shadow-blue-500/20">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
                  Alteração de Vencimento em Massa
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Selecione grupos de clientes do ISPFY e reajuste datas e ciclos de faturamento de forma sincronizada.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={aoExportarLog}
              disabled={!clientes.some((cliente) => cliente.statusAlterado !== 'pendente')}
              className="gap-2 rounded-xl"
            >
              <Download className="w-4 h-4" />
              Exportar Log
            </Button>

            <Button
              onClick={aoBuscarClientes}
              disabled={carregando || processandoLote}
              className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-indigo-500/20 rounded-xl px-5 py-2 font-medium"
            >
              {carregando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Carregando ISPFY...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Carregar Todos os Clientes
                </>
              )}
            </Button>
          </div>
        </motion.div>

        {/* Barra de Progresso do Carregamento Inicial */}
        <AnimatePresence>
          {carregando && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Card className="border-indigo-500/30 bg-indigo-500/5 backdrop-blur">
                <CardContent className="pt-6 pb-6">
                  <div className="flex flex-col space-y-3">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {mensagemStatus}
                      </span>
                      <span className="font-bold text-foreground">{progresso}%</span>
                    </div>
                    <Progress value={progresso} className="h-2.5 bg-indigo-950/20 dark:bg-indigo-950/40" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Painel de Filtros */}
        <Card className="border-border/50 shadow-sm bg-card/60 backdrop-blur">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Filter className="w-4 h-4 text-indigo-500" />
                Filtrar Clientes e Ciclos
              </CardTitle>
              <div className="text-xs text-muted-foreground">
                Total Localizado: <strong className="text-foreground">{clientes.length}</strong> |
                Selecionados: <strong className="text-blue-500">{idsSelecionados.size}</strong>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="col-span-1 md:col-span-2 relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, CPF/CNPJ, cidade ou ID..."
                  value={termoBusca}
                  onChange={(e) => setTermoBusca(e.target.value)}
                  disabled={carregando || clientes.length === 0}
                  className="pl-9 bg-background/80 rounded-xl"
                />
              </div>

              <div className="flex flex-col justify-center">
                <Label className="text-xs font-semibold text-muted-foreground mb-1">Filtrar por Ciclo Atual</Label>
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  <Badge
                    variant={filtroVencimento === 'todos' ? 'default' : 'outline'}
                    onClick={() => setFiltroVencimento('todos')}
                    className="cursor-pointer px-2.5 py-1 text-xs rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    Todos
                  </Badge>
                  {DIAS_VENCIMENTO_PADRAO.map((dia) => (
                    <Badge
                      key={dia}
                      variant={filtroVencimento === `Dia ${parseInt(dia, 10)}` ? 'default' : 'outline'}
                      onClick={() => setFiltroVencimento(`Dia ${parseInt(dia, 10)}`)}
                      className="cursor-pointer px-2.5 py-1 text-xs rounded-lg transition-colors"
                    >
                      Dia {dia}
                    </Badge>
                  ))}
                  <Badge
                    variant={filtroVencimento === 'nao_definido' ? 'default' : 'outline'}
                    onClick={() => setFiltroVencimento('nao_definido')}
                    className="cursor-pointer px-2 py-1 text-xs rounded-lg transition-colors"
                  >
                    Sem ciclo
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Controlador Flutuante de Alteração em Massa */}
        <AnimatePresence>
          {idsSelecionados.size > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="sticky top-4 z-40 shadow-2xl rounded-2xl overflow-hidden border border-blue-500/30 bg-gradient-to-r from-slate-900/95 via-indigo-950/95 to-slate-900/95 text-white backdrop-blur-xl p-5"
            >
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center font-black text-xl text-blue-400">
                    {idsSelecionados.size}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      Alteração em Massa Pronto para Envio
                      <Badge className="bg-blue-600 hover:bg-blue-600 text-[10px] uppercase font-bold tracking-wider">
                        ISPFY API Sync
                      </Badge>
                    </h3>
                    <p className="text-xs text-blue-200/80">
                      Os clientes selecionados terão a data e vencimento das faturas reajustados para o novo ciclo configurado abaixo.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 w-full lg:w-auto bg-white/5 p-3 rounded-xl border border-white/10">
                  <div>
                    <Label className="text-[11px] font-semibold uppercase text-slate-300 block mb-1">
                      Novo Dia de Vencimento
                    </Label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {!usarDiaPersonalizado && DIAS_VENCIMENTO_PADRAO.map((dia) => (
                        <button
                          key={dia}
                          onClick={() => setDiaDestino(dia)}
                          type="button"
                          disabled={processandoLote}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            diaDestino === dia && !usarDiaPersonalizado
                              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50 scale-105'
                              : 'bg-white/10 text-slate-300 hover:bg-white/20'
                          }`}
                        >
                          Dia {dia}
                        </button>
                      ))}

                      <button
                        onClick={() => setUsarDiaPersonalizado(!usarDiaPersonalizado)}
                        type="button"
                        disabled={processandoLote}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border border-white/20 ${
                          usarDiaPersonalizado ? 'bg-indigo-600 text-white' : 'bg-transparent text-slate-400 hover:text-white'
                        }`}
                      >
                        {usarDiaPersonalizado ? 'Padrões' : 'Outro dia...'}
                      </button>

                      {usarDiaPersonalizado && (
                        <Input
                          type="number"
                          min={1}
                          max={31}
                          placeholder="Dia (1-31)"
                          value={diaPersonalizado}
                          onChange={(e) => setDiaPersonalizado(e.target.value)}
                          className="w-24 h-8 bg-white/10 border-white/20 text-white text-xs rounded-lg"
                        />
                      )}
                    </div>
                  </div>

                  <div className="border-l border-white/10 pl-3">
                    <Label className="text-[11px] font-semibold uppercase text-slate-300 block mb-1">
                      Escopo da Alteração
                    </Label>
                    <select
                      value={escopoAlteracao}
                      onChange={(e) => setEscopoAlteracao(e.target.value as EscopoAlteracao)}
                      disabled={processandoLote}
                      className="bg-slate-800 border border-white/20 text-white text-xs rounded-lg px-2.5 py-1.5 h-8 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    >
                      <option value="both">Contrato & Cliente (Recomendado)</option>
                      <option value="contract">Apenas Contrato</option>
                      <option value="client">Apenas Cadastro Cliente</option>
                    </select>
                  </div>

                  <div className="flex items-center pl-2">
                    <Button
                      onClick={aoExecutarAlteracaoEmMassa}
                      disabled={processandoLote || (usarDiaPersonalizado && !diaPersonalizado)}
                      size="lg"
                      className="w-full md:w-auto bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold px-6 shadow-xl shadow-emerald-500/20 rounded-xl transition-all hover:scale-[1.02]"
                    >
                      {processandoLote ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processando... ({resumoLote.processados}/{idsSelecionados.size})
                        </>
                      ) : (
                        <>
                          <Rocket className="w-4 h-4 mr-2" />
                          Aplicar Alteração
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {processandoLote && (
                <div className="mt-4 pt-3 border-t border-white/10">
                  <div className="flex justify-between items-center text-xs mb-1.5 text-slate-200">
                    <span>
                      Progresso: <strong className="text-emerald-400">{resumoLote.sucessos} sucessos</strong> |
                      <strong className="text-rose-400 ml-1.5">{resumoLote.erros} falhas</strong>
                    </span>
                    <span className="font-bold">{progressoLote}%</span>
                  </div>
                  <Progress value={progressoLote} className="h-2 bg-white/10" />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabela Principal de Clientes */}
        <Card className="border-border/50 shadow-sm overflow-hidden bg-card/60 backdrop-blur">
          <CardHeader className="p-4 border-b border-border/50 flex flex-row justify-between items-center">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" />
              <span className="font-semibold text-sm">Listagem de Clientes e Contratos</span>
              <Badge variant="secondary" className="text-xs">
                Exibindo {clientesFiltrados.length} registros
              </Badge>
            </div>

            {clientesFiltrados.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={aoSelecionarTodosVisiveis}
                  className="h-8 text-xs rounded-lg font-medium gap-1.5"
                >
                  {todosVisiveisSelecionados ? (
                    <>
                      <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
                      Desmarcar da Tela
                    </>
                  ) : (
                    <>
                      <Square className="w-3.5 h-3.5 text-muted-foreground" />
                      Selecionar Todos ({clientesFiltrados.length})
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {clientes.length === 0 && !carregando && (
              <div className="text-center py-20 px-4 space-y-3">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto">
                  <Calendar className="w-8 h-8 opacity-80" />
                </div>
                <h3 className="text-base font-bold">Pronta para Gerenciar Vencimentos em Massa</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Clique no botão "Carregar Todos os Clientes" acima para puxar os cadastros do ISPFY (ativos e inativos) e reajustar datas em grupo com segurança.
                </p>
              </div>
            )}

            {clientesFiltrados.length > 0 && (
              <ScrollArea className="h-[550px] w-full">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur-md">
                    <TableRow>
                      <TableHead className="w-12 text-center">
                        <Checkbox
                          checked={todosVisiveisSelecionados}
                          onCheckedChange={aoSelecionarTodosVisiveis}
                          aria-label="Selecionar todos os clientes visíveis"
                        />
                      </TableHead>
                      <TableHead className="w-24">ID</TableHead>
                      <TableHead className="min-w-[220px]">Cliente / Razão Social</TableHead>
                      <TableHead>CPF / CNPJ</TableHead>
                      <TableHead className="min-w-[180px]">Plano / Contrato</TableHead>
                      <TableHead>Cidade</TableHead>
                      <TableHead className="text-center">Ciclo / Venc. Atual</TableHead>
                      <TableHead className="text-right pr-6">Status Alteração</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientesFiltrados.map((cliente) => {
                      const idCliente = String(cliente.id);
                      const selecionado = idsSelecionados.has(idCliente);
                      const clienteAtivo = isRegistroAtivo(cliente.ativo);
                      const nomeCliente = obterNomeClienteISPFY(cliente, 'Cliente Sem Nome');
                      const telefoneCliente = obterTelefoneClienteISPFY(cliente, 'Sem telefone');
                      const documentoFormatado = formatarDocumentoCpfCnpj(cliente.cnpj_cpf, '---');

                      return (
                        <TableRow
                          key={idCliente}
                          className={`transition-colors hover:bg-muted/40 cursor-pointer ${
                            selecionado ? 'bg-blue-500/5 dark:bg-blue-500/10' : ''
                          }`}
                          onClick={() => aoAlternarSelecao(idCliente)}
                        >
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selecionado}
                              onCheckedChange={() => aoAlternarSelecao(idCliente)}
                              aria-label={`Selecionar cliente ${nomeCliente}`}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs font-semibold text-muted-foreground">
                            #{idCliente}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-foreground">
                                  {nomeCliente}
                                </span>
                                <Badge variant="outline" className={`text-[9px] px-1.5 py-0 font-bold uppercase ${
                                  clienteAtivo
                                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                                    : 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                                }`}>
                                  {clienteAtivo ? 'Ativo' : 'Inativo'}
                                </Badge>
                              </div>
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                {telefoneCliente}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {documentoFormatado}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-xs text-foreground/90 font-medium">
                              <span className="truncate max-w-[190px]">{cliente.planoNome}</span>
                              {cliente.idContrato && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 border-indigo-500/30 text-indigo-500">
                                  #{cliente.idContrato}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {cliente.cidade || '---'}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                              cliente.vencimentoAtual?.includes('Dia')
                                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20'
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              {cliente.vencimentoAtual || 'N/D'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                            {cliente.statusAlterado === 'pendente' && (
                              <span className="text-xs text-muted-foreground opacity-60">Pronto para alterar</span>
                            )}
                            {cliente.statusAlterado === 'processando' && (
                              <Badge variant="outline" className="text-amber-500 border-amber-500/30 animate-pulse gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Processando...
                              </Badge>
                            )}
                            {cliente.statusAlterado === 'sucesso' && (
                              <div className="flex flex-col items-end">
                                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 gap-1 font-semibold">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Dia {cliente.novoVencimento} Confirmado
                                </Badge>
                                <span className="text-[10px] text-muted-foreground mt-0.5">Sincronizado via API</span>
                              </div>
                            )}
                            {cliente.statusAlterado === 'erro' && (
                              <div className="flex flex-col items-end">
                                <Badge variant="outline" className="bg-rose-500/10 text-rose-500 border-rose-500/30 gap-1 font-medium">
                                  <XCircle className="w-3.5 h-3.5" />
                                  Erro na API
                                </Badge>
                                <span className="text-[10px] text-rose-400 mt-0.5 max-w-[180px] truncate" title={cliente.mensagemAlteracao}>
                                  {cliente.mensagemAlteracao || 'Falha ao processar'}
                                </span>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}

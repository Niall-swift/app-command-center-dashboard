import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  Sliders, 
  ArrowUpRight, 
  AlertCircle,
  CheckSquare,
  Square,
  Download,
  Building
} from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import { ispfyService } from '@/services/ispfy/ispfyService';
import { ISPFYClienteData } from '@/types/ispfy';
import { toast } from 'sonner';

interface ClientItem extends ISPFYClienteData {
  idContrato?: string;
  planoNome?: string;
  vencimentoAtual?: string;
  diaVencimentoRaw?: string;
  statusAlterado?: 'pendente' | 'processando' | 'sucesso' | 'erro';
  mensagemAlteracao?: string;
  novoVencimento?: string;
}

const STANDARD_DUE_DAYS = ['05', '10', '15', '20', '25', '30'];

const getStandardDueDay = (rawDay: string): string => {
  const day = parseInt(rawDay, 10);
  if (isNaN(day)) return 'Não definido';
  if (day >= 3 && day <= 7) return 'Dia 5';
  if (day >= 8 && day <= 12) return 'Dia 10';
  if (day >= 13 && day <= 17) return 'Dia 15';
  if (day >= 18 && day <= 22) return 'Dia 20';
  if (day >= 23 && day <= 27) return 'Dia 25';
  if (day >= 28 || day <= 2) return 'Dia 30';
  return `Dia ${day}`;
};

export default function ISPFYVencimentos() {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  
  // Filtros & Pesquisa
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDueDay, setFilterDueDay] = useState<string>('todos');
  
  // Seleção
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Opções de Alteração
  const [targetDueDay, setTargetDueDay] = useState<string>('10');
  const [customDay, setCustomDay] = useState<string>('');
  const [useCustomDay, setUseCustomDay] = useState<boolean>(false);
  const [updateTarget, setUpdateTarget] = useState<'both' | 'contract' | 'client'>('both');
  
  // Processamento de Alteração em Massa
  const [processingBulk, setProcessingBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkStats, setBulkStats] = useState({ success: 0, errors: 0, processed: 0 });

  const handleFetchClients = async () => {
    setLoading(true);
    setProgress(0);
    setStatusMessage('Carregando lista de clientes ativos do ISPFY...');
    setClients([]);
    setSelectedIds(new Set());

    try {
      // 1. Todos os clientes (Ativos e Inativos)
      const allClientRecords = await ispfyService.fetchAllClientes((total) => {
        setProgress(Math.min(30, Math.floor((total / 1000) * 30)));
        setStatusMessage(`Buscando clientes (ativos e inativos)... (${total} localizados)`);
      });

      if (allClientRecords.length === 0) {
        toast.warning('Nenhum cliente localizado no ISPFY.');
        setLoading(false);
        return;
      }

      // 2. Contratos (ativos e inativos) para mapear dia de vencimento real
      setProgress(35);
      setStatusMessage('Sincronizando contratos e faturas para identificar ciclo atual...');
      const contracts = await ispfyService.fetchAllContratos((total) => {
        setProgress(Math.min(65, 35 + Math.floor((total / 1000) * 30)));
      });

      const clientContractsMap = new Map<string, any>();
      contracts.forEach(c => {
        if (c.id_cliente) clientContractsMap.set(String(c.id_cliente), c);
      });

      // 3. Faturas em aberto (mais precisão na data do vencimento atual)
      setProgress(70);
      setStatusMessage('Analisando datas de faturas em aberto...');
      const invoices = await ispfyService.fetchAllFaturasAbertas((total) => {
        setProgress(Math.min(95, 70 + Math.floor((total / 1000) * 20)));
      });

      const clientInvoicesMap = new Map<string, string>();
      invoices.forEach(f => {
        if (f.id_cliente && f.data_vencimento && !clientInvoicesMap.has(String(f.id_cliente))) {
          clientInvoicesMap.set(String(f.id_cliente), String(f.data_vencimento));
        }
      });

      setProgress(98);
      setStatusMessage('Organizando e processando grade de clientes...');

      // Enriquecer
      const enriched: ClientItem[] = allClientRecords.map(client => {
        const cId = String(client.id);
        const contract = clientContractsMap.get(cId);
        const invoiceDate = clientInvoicesMap.get(cId);
        
        let idContrato = undefined;
        let planoNome = 'Sem contrato ativo';
        let rawDay = '';
        
        if (contract) {
          idContrato = String(contract.id);
          planoNome = String(contract.contrato || contract.plano || contract.descricao || 'Plano Padrão');
          
          if (invoiceDate && invoiceDate.includes('-')) {
            rawDay = invoiceDate.split('-')[2];
          } else {
            const ref = contract.pago_ate_data && contract.pago_ate_data !== '0000-00-00'
              ? contract.pago_ate_data
              : (contract.data_ativacao || '');
            if (ref && ref.includes('-')) rawDay = ref.split('-')[2];
          }
        }
        
        const vencimentoAtual = rawDay ? getStandardDueDay(rawDay) : 'Não definido';
        
        return {
          ...client,
          idContrato,
          planoNome,
          diaVencimentoRaw: rawDay || '',
          vencimentoAtual,
          statusAlterado: 'pendente'
        };
      });

      setClients(enriched);
      setProgress(100);
      toast.success(`${enriched.length} clientes e seus vencimentos foram carregados com sucesso!`);
    } catch (err: any) {
      toast.error('Erro ao carregar clientes do ISPFY', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Filtragem da Tabela
  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const matchSearch = searchTerm === '' || 
        String(c.nome || c.razao || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(c.cnpj_cpf || '').includes(searchTerm) ||
        String(c.id || '').includes(searchTerm) ||
        String(c.cidade || '').toLowerCase().includes(searchTerm.toLowerCase());
        
      const matchDueDay = filterDueDay === 'todos' || 
        (filterDueDay === 'nao_definido' && c.vencimentoAtual === 'Não definido') ||
        c.vencimentoAtual?.toLowerCase().includes(filterDueDay.toLowerCase());
        
      return matchSearch && matchDueDay;
    });
  }, [clients, searchTerm, filterDueDay]);

  // Controles de Seleção
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    const visibleIds = filteredClients.map(c => String(c.id));
    const allSelected = visibleIds.every(id => selectedIds.has(id));
    
    setSelectedIds(prev => {
      const next = new Set(prev);
      visibleIds.forEach(id => {
        if (allSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  };

  const isAllVisibleSelected = filteredClients.length > 0 && filteredClients.every(c => selectedIds.has(String(c.id)));
  const isSomeVisibleSelected = filteredClients.some(c => selectedIds.has(String(c.id)));

  // Execução de Alteração em Massa
  const handleBulkUpdate = async () => {
    if (selectedIds.size === 0) {
      toast.error('Selecione ao menos um cliente para alterar a data de vencimento.');
      return;
    }

    const finalDay = useCustomDay ? customDay.trim() : targetDueDay;
    const dayNumber = parseInt(finalDay, 10);

    if (isNaN(dayNumber) || dayNumber < 1 || dayNumber > 31) {
      toast.error('O novo dia de vencimento deve ser um número entre 1 e 31.');
      return;
    }

    const formattedDay = String(dayNumber).padStart(2, '0');
    const selectedArray = Array.from(selectedIds);

    setProcessingBulk(true);
    setBulkProgress(0);
    setBulkStats({ success: 0, errors: 0, processed: 0 });

    toast.info(`Iniciando alteração em massa para o Dia ${formattedDay}...`, {
      description: `Processando ${selectedArray.length} clientes selecionados.`
    });

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < selectedArray.length; i++) {
      const clientId = selectedArray[i];
      const clientObj = clients.find(c => String(c.id) === clientId);

      if (!clientObj) continue;

      // Atualiza status local para processando
      setClients(prev => prev.map(item => String(item.id) === clientId ? {
        ...item, statusAlterado: 'processando', mensagemAlteracao: 'Enviando alteração para ISPFY...'
      } : item));

      try {
        const res = await ispfyService.updateDueDate(
          clientId,
          clientObj.idContrato,
          formattedDay,
          updateTarget
        );

        if (res.success) {
          successCount++;
          setClients(prev => prev.map(item => String(item.id) === clientId ? {
            ...item, 
            statusAlterado: 'sucesso', 
            mensagemAlteracao: 'Vencimento alterado no ISPFY',
            vencimentoAtual: `Dia ${dayNumber}`,
            novoVencimento: formattedDay
          } : item));
        } else {
          errorCount++;
          setClients(prev => prev.map(item => String(item.id) === clientId ? {
            ...item, statusAlterado: 'erro', mensagemAlteracao: res.message
          } : item));
        }
      } catch (err: any) {
        errorCount++;
        setClients(prev => prev.map(item => String(item.id) === clientId ? {
          ...item, statusAlterado: 'erro', mensagemAlteracao: err.message || 'Falha na requisição'
        } : item));
      }

      const currentProcessed = i + 1;
      setBulkStats({ success: successCount, errors: errorCount, processed: currentProcessed });
      setBulkProgress(Math.round((currentProcessed / selectedArray.length) * 100));

      // Pequeno intervalo para não sobrecarregar a API do ISPFY
      if (i % 5 === 0 && i > 0) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    setProcessingBulk(false);
    toast[errorCount === 0 ? 'success' : 'warning'](
      `Alteração em massa concluída! ${successCount} atualizados, ${errorCount} falhas.`,
      { description: 'Verifique a coluna de status para os detalhes de cada cliente.' }
    );
  };

  // Exportar Relatório
  const handleExportLog = () => {
    const changed = clients.filter(c => c.statusAlterado !== 'pendente');
    if (changed.length === 0) {
      toast.error('Nenhum cliente foi processado ainda nesta sessão para exportar.');
      return;
    }

    const headers = ['ID Cliente', 'Nome', 'CPF/CNPJ', 'Contrato', 'Status Alteração', 'Mensagem / Retorno', 'Vencimento Atual'];
    const rows = changed.map(c => [
      c.id || '',
      `"${String(c.nome || c.razao || '').replace(/"/g, '""')}"`,
      c.cnpj_cpf || '',
      c.idContrato || 'Sem contrato',
      c.statusAlterado === 'sucesso' ? 'SUCESSO' : 'ERRO',
      `"${String(c.mensagemAlteracao || '').replace(/"/g, '""')}"`,
      c.vencimentoAtual || ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + 
      [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `log_alteracao_vencimentos_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
              onClick={handleExportLog}
              disabled={!clients.some(c => c.statusAlterado !== 'pendente')}
              className="gap-2 rounded-xl"
            >
              <Download className="w-4 h-4" />
              Exportar Log
            </Button>

            <Button 
              onClick={handleFetchClients} 
              disabled={loading || processingBulk}
              className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-indigo-500/20 rounded-xl px-5 py-2 font-medium"
            >
              {loading ? (
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
          {loading && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Card className="border-indigo-500/30 bg-indigo-500/5 backdrop-blur">
                <CardContent className="pt-6 pb-6">
                  <div className="flex flex-col space-y-3">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {statusMessage}
                      </span>
                      <span className="font-bold text-foreground">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2.5 bg-indigo-950/20 dark:bg-indigo-950/40" />
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
                Total Localizado: <strong className="text-foreground">{clients.length}</strong> | 
                Selecionados: <strong className="text-blue-500">{selectedIds.size}</strong>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="col-span-1 md:col-span-2 relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, CPF/CNPJ, cidade ou ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  disabled={loading || clients.length === 0}
                  className="pl-9 bg-background/80 rounded-xl"
                />
              </div>

              <div className="flex flex-col justify-center">
                <Label className="text-xs font-semibold text-muted-foreground mb-1">Filtrar por Ciclo Atual</Label>
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  <Badge 
                    variant={filterDueDay === 'todos' ? 'default' : 'outline'}
                    onClick={() => setFilterDueDay('todos')}
                    className="cursor-pointer px-2.5 py-1 text-xs rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    Todos
                  </Badge>
                  {STANDARD_DUE_DAYS.map(day => (
                    <Badge 
                      key={day}
                      variant={filterDueDay === `Dia ${parseInt(day, 10)}` ? 'default' : 'outline'}
                      onClick={() => setFilterDueDay(`Dia ${parseInt(day, 10)}`)}
                      className="cursor-pointer px-2.5 py-1 text-xs rounded-lg transition-colors"
                    >
                      Dia {day}
                    </Badge>
                  ))}
                  <Badge 
                    variant={filterDueDay === 'nao_definido' ? 'default' : 'outline'}
                    onClick={() => setFilterDueDay('nao_definido')}
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
          {selectedIds.size > 0 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: -10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.96 }}
              className="sticky top-4 z-40 shadow-2xl rounded-2xl overflow-hidden border border-blue-500/30 bg-gradient-to-r from-slate-900/95 via-indigo-950/95 to-slate-900/95 text-white backdrop-blur-xl p-5"
            >
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center font-black text-xl text-blue-400">
                    {selectedIds.size}
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
                  {/* Seletor do Novo Dia */}
                  <div>
                    <Label className="text-[11px] font-semibold uppercase text-slate-300 block mb-1">
                      Novo Dia de Vencimento
                    </Label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {!useCustomDay && STANDARD_DUE_DAYS.map(day => (
                        <button
                          key={day}
                          onClick={() => setTargetDueDay(day)}
                          type="button"
                          disabled={processingBulk}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            targetDueDay === day && !useCustomDay
                              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50 scale-105'
                              : 'bg-white/10 text-slate-300 hover:bg-white/20'
                          }`}
                        >
                          Dia {day}
                        </button>
                      ))}

                      <button
                        onClick={() => setUseCustomDay(!useCustomDay)}
                        type="button"
                        disabled={processingBulk}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border border-white/20 ${
                          useCustomDay ? 'bg-indigo-600 text-white' : 'bg-transparent text-slate-400 hover:text-white'
                        }`}
                      >
                        {useCustomDay ? 'Padrões' : 'Outro dia...'}
                      </button>

                      {useCustomDay && (
                        <Input
                          type="number"
                          min={1}
                          max={31}
                          placeholder="Dia (1-31)"
                          value={customDay}
                          onChange={e => setCustomDay(e.target.value)}
                          className="w-24 h-8 bg-white/10 border-white/20 text-white text-xs rounded-lg"
                        />
                      )}
                    </div>
                  </div>

                  {/* Opção de Alvo */}
                  <div className="border-l border-white/10 pl-3">
                    <Label className="text-[11px] font-semibold uppercase text-slate-300 block mb-1">
                      Escopo da Alteração
                    </Label>
                    <select
                      value={updateTarget}
                      onChange={(e: any) => setUpdateTarget(e.target.value)}
                      disabled={processingBulk}
                      className="bg-slate-800 border border-white/20 text-white text-xs rounded-lg px-2.5 py-1.5 h-8 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    >
                      <option value="both">Contrato & Cliente (Recomendado)</option>
                      <option value="contract">Apenas Contrato</option>
                      <option value="client">Apenas Cadastro Cliente</option>
                    </select>
                  </div>

                  {/* Botão de Disparo */}
                  <div className="flex items-center pl-2">
                    <Button
                      onClick={handleBulkUpdate}
                      disabled={processingBulk || (useCustomDay && !customDay)}
                      size="lg"
                      className="w-full md:w-auto bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold px-6 shadow-xl shadow-emerald-500/20 rounded-xl transition-all hover:scale-[1.02]"
                    >
                      {processingBulk ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processando... ({bulkStats.processed}/{selectedIds.size})
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

              {/* Barra de progresso do processamento */}
              {processingBulk && (
                <div className="mt-4 pt-3 border-t border-white/10">
                  <div className="flex justify-between items-center text-xs mb-1.5 text-slate-200">
                    <span>
                      Progresso: <strong className="text-emerald-400">{bulkStats.success} sucessos</strong> | 
                      <strong className="text-rose-400 ml-1.5">{bulkStats.errors} falhas</strong>
                    </span>
                    <span className="font-bold">{bulkProgress}%</span>
                  </div>
                  <Progress value={bulkProgress} className="h-2 bg-white/10" />
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
                Exibindo {filteredClients.length} registros
              </Badge>
            </div>

            {filteredClients.length > 0 && (
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleSelectAllVisible}
                  className="h-8 text-xs rounded-lg font-medium gap-1.5"
                >
                  {isAllVisibleSelected ? (
                    <>
                      <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
                      Desmarcar da Tela
                    </>
                  ) : (
                    <>
                      <Square className="w-3.5 h-3.5 text-muted-foreground" />
                      Selecionar Todos ({filteredClients.length})
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {clients.length === 0 && !loading && (
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

            {filteredClients.length > 0 && (
              <ScrollArea className="h-[550px] w-full">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur-md">
                    <TableRow>
                      <TableHead className="w-12 text-center">
                        <Checkbox
                          checked={isAllVisibleSelected}
                          onCheckedChange={handleSelectAllVisible}
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
                    {filteredClients.map((client) => {
                      const cId = String(client.id);
                      const isSelected = selectedIds.has(cId);

                      return (
                        <TableRow 
                          key={cId} 
                          className={`transition-colors hover:bg-muted/40 cursor-pointer ${
                            isSelected ? 'bg-blue-500/5 dark:bg-blue-500/10' : ''
                          }`}
                          onClick={() => handleToggleSelect(cId)}
                        >
                          <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleToggleSelect(cId)}
                              aria-label={`Selecionar cliente ${client.nome}`}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs font-semibold text-muted-foreground">
                            #{cId}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-foreground">
                                  {client.nome || client.razao || 'Cliente Sem Nome'}
                                </span>
                                <Badge variant="outline" className={`text-[9px] px-1.5 py-0 font-bold uppercase ${
                                  client.ativo === 'S' || client.ativo === '1' 
                                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' 
                                    : 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                                }`}>
                                  {client.ativo === 'S' || client.ativo === '1' ? 'Ativo' : 'Inativo'}
                                </Badge>
                              </div>
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                {client.fone_celular || client.whatsapp || client.telefone || 'Sem telefone'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {client.cnpj_cpf || '---'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-xs text-foreground/90 font-medium">
                              <span className="truncate max-w-[190px]">{client.planoNome}</span>
                              {client.idContrato && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 border-indigo-500/30 text-indigo-500">
                                  #{client.idContrato}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {client.cidade || '---'}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                              client.vencimentoAtual?.includes('Dia')
                                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20'
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              {client.vencimentoAtual || 'N/D'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right pr-6" onClick={e => e.stopPropagation()}>
                            {client.statusAlterado === 'pendente' && (
                              <span className="text-xs text-muted-foreground opacity-60">Pronto para alterar</span>
                            )}
                            {client.statusAlterado === 'processando' && (
                              <Badge variant="outline" className="text-amber-500 border-amber-500/30 animate-pulse gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Processando...
                              </Badge>
                            )}
                            {client.statusAlterado === 'sucesso' && (
                              <div className="flex flex-col items-end">
                                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 gap-1 font-semibold">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Dia {client.novoVencimento} Confirmado
                                </Badge>
                                <span className="text-[10px] text-muted-foreground mt-0.5">Sincronizado via API</span>
                              </div>
                            )}
                            {client.statusAlterado === 'erro' && (
                              <div className="flex flex-col items-end">
                                <Badge variant="outline" className="bg-rose-500/10 text-rose-500 border-rose-500/30 gap-1 font-medium">
                                  <XCircle className="w-3.5 h-3.5" />
                                  Erro na API
                                </Badge>
                                <span className="text-[10px] text-rose-400 mt-0.5 max-w-[180px] truncate" title={client.mensagemAlteracao}>
                                  {client.mensagemAlteracao || 'Falha ao processar'}
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

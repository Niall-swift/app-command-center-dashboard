import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
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
  SelectValue 
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  UserPlus, 
  UserMinus, 
  ShieldAlert, 
  Scale, 
  Download, 
  Printer, 
  RefreshCw, 
  Search, 
  Calendar, 
  ExternalLink, 
  Phone, 
  Copy, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  DollarSign, 
  TrendingUp, 
  Award, 
  FileSpreadsheet, 
  ShieldCheck,
  Building,
  Info
} from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import { ispfyService } from '@/services/ispfy/ispfyService';
import type { 
  ISPFYAuditData, 
  ISPFYAuditClient, 
  ISPFYAuditCancelledContract, 
  ISPFYAuditDeletedRecord 
} from '@/types/ispfy';
import { toast } from 'sonner';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function ISPFYAuditoria() {
  const navigate = useNavigate();
  const currentDate = new Date();
  
  // Estado de mês e ano selecionados (padrão: mês e ano atual)
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  
  const [loading, setLoading] = useState<boolean>(true);
  const [progressMsg, setProgressMsg] = useState<string>('Carregando dados de auditoria...');
  const [auditData, setAuditData] = useState<ISPFYAuditData | null>(null);
  
  // Filtros de busca
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<string>('overview');

  // Carregar dados de auditoria
  const loadAuditData = async (ano: number, mes: number) => {
    setLoading(true);
    setProgressMsg('Iniciando auditoria no ISPFY...');
    try {
      const data = await ispfyService.getAuditData(ano, mes, (msg) => {
        setProgressMsg(msg);
      });
      setAuditData(data);
      toast.success(`Auditoria de ${MONTH_NAMES[mes - 1]}/${ano} atualizada!`);
    } catch (error: any) {
      console.error('Erro ao carregar auditoria:', error);
      toast.error('Erro ao consultar dados no ISPFY: ' + (error.message || 'Falha de conexão'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditData(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth]);

  // Formatar CPF/CNPJ
  const formatDocument = (doc: string = '') => {
    const clean = doc.replace(/\D/g, '');
    if (clean.length === 11) {
      return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    if (clean.length === 14) {
      return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return doc;
  };

  // Formatar Data
  const formatDate = (dateStr: string = '') => {
    if (!dateStr) return '-';
    // Se for formato ISO ou YYYY-MM-DD HH:mm:ss
    const parts = dateStr.split(' ');
    const datePart = parts[0];
    const timePart = parts[1] || '';
    const [y, m, d] = datePart.split('-');
    if (d && m && y) {
      return timePart ? `${d}/${m}/${y} às ${timePart}` : `${d}/${m}/${y}`;
    }
    return dateStr;
  };

  // Copiar para clipboard
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  // Filtragem de cadastrados
  const filteredCadastrados = useMemo(() => {
    if (!auditData) return [];
    return auditData.cadastrados.filter(c => {
      const matchesSearch = 
        !searchTerm ||
        c.nome_razao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.cpf_cnpj.includes(searchTerm.replace(/\D/g, '')) ||
        c.id.includes(searchTerm) ||
        (c.bairro && c.bairro.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.plano && c.plano.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesUser = selectedUserFilter === 'ALL' || c.usuario_cadastrou === selectedUserFilter;
      return matchesSearch && matchesUser;
    });
  }, [auditData, searchTerm, selectedUserFilter]);

  // Filtragem de cancelados
  const filteredCancelados = useMemo(() => {
    if (!auditData) return [];
    return auditData.cancelados.filter(c => {
      const matchesSearch = 
        !searchTerm ||
        (c.nome_cliente && c.nome_cliente.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.cpf_cnpj && c.cpf_cnpj.includes(searchTerm.replace(/\D/g, ''))) ||
        c.id_cliente.includes(searchTerm) ||
        c.id.includes(searchTerm) ||
        (c.usuario_cadastrou && c.usuario_cadastrou.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesUser = selectedUserFilter === 'ALL' || c.usuario_cadastrou === selectedUserFilter;
      return matchesSearch && matchesUser;
    });
  }, [auditData, searchTerm, selectedUserFilter]);

  // Filtragem de excluídos
  const filteredExcluidos = useMemo(() => {
    if (!auditData) return [];
    return auditData.excluidos.filter(e => {
      if (!searchTerm) return true;
      return (
        e.id.includes(searchTerm) ||
        (e.nome && e.nome.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (e.motivo && e.motivo.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (e.cpf_cnpj && e.cpf_cnpj.includes(searchTerm))
      );
    });
  }, [auditData, searchTerm]);

  // Lista de todos os atendentes que aparecem nos dados
  const atendentesList = useMemo(() => {
    if (!auditData) return [];
    const setUsers = new Set<string>();
    auditData.cadastrados.forEach(c => {
      if (c.usuario_cadastrou) setUsers.add(c.usuario_cadastrou);
    });
    auditData.cancelados.forEach(c => {
      if (c.usuario_cadastrou) setUsers.add(c.usuario_cadastrou);
    });
    return Array.from(setUsers).sort();
  }, [auditData]);

  // Exportar para CSV
  const handleExportCSV = () => {
    if (!auditData) return;

    let csvContent = '\uFEFF'; // BOM para compatibilidade com Excel em português
    csvContent += `AUDITORIA ISPFY - RELATÓRIO DO MÊS DE ${MONTH_NAMES[selectedMonth - 1].toUpperCase()}/${selectedYear}\n`;
    csvContent += `Gerado em:;${new Date().toLocaleString('pt-BR')}\n`;
    csvContent += `Total Cadastrados:;${auditData.resumo.totalCadastrados}\n`;
    csvContent += `Total Cancelados/Rescindidos:;${auditData.resumo.totalCancelados}\n`;
    csvContent += `Total Excluídos/Lacunas:;${auditData.resumo.totalExcluidos}\n`;
    csvContent += `Saldo Líquido:;${auditData.resumo.saldoLiquido}\n\n`;

    // Seção 1: Cadastrados
    csvContent += `=== CLIENTES CADASTRADOS NO MÊS (${auditData.cadastrados.length}) ===\n`;
    csvContent += `ID;Nome / Razão Social;CPF / CNPJ;Data e Hora de Cadastro;Atendente / Usuário;Plano;Valor Mensal (R$);Bairro;Cidade;Telefone\n`;
    auditData.cadastrados.forEach(c => {
      csvContent += `${c.id};"${c.nome_razao}";"${formatDocument(c.cpf_cnpj)}";"${c.data_cadastro}";"${c.usuario_cadastrou}";"${c.plano || '-'}";"${c.valor_mensal || '0.00'}";"${c.bairro || '-'}";"${c.cidade || '-'}";"${c.telefone || '-'}"\n`;
    });

    csvContent += `\n=== CONTRATOS CANCELADOS / RESCINDIDOS NO MÊS (${auditData.cancelados.length}) ===\n`;
    csvContent += `ID Contrato;ID Cliente;Nome Cliente;CPF / CNPJ;Data Adesão;Data Rescisão;Dias Ativo;Mensalidade (R$);Atendente;Observações\n`;
    auditData.cancelados.forEach(c => {
      csvContent += `${c.id};${c.id_cliente};"${c.nome_cliente || '-'}";"${formatDocument(c.cpf_cnpj || '')}";"${c.data_adesao || '-'}";"${c.data_rescisao}";"${c.dias_ativo || '-' }";"${c.valor_mensal || '0.00'}";"${c.usuario_cadastrou || '-'}";"${c.observacoes?.replace(/\n/g, ' ') || '-'}"\n`;
    });

    csvContent += `\n=== AUDITORIA DE EXCLUSÕES E LACUNAS DETECTADAS (${auditData.excluidos.length}) ===\n`;
    csvContent += `ID;Tipo;Nome Prévio;Data Estimada;Motivo / Análise Forense\n`;
    auditData.excluidos.forEach(e => {
      csvContent += `${e.id};"${e.tipo}";"${e.nome || 'Desconhecido'}";"${e.provavel_data || '-'}";"${e.motivo.replace(/\n/g, ' ')}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `auditoria_ispfy_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Arquivo CSV exportado com sucesso!');
  };

  // Impressão da tela
  const handlePrint = () => {
    window.print();
  };

  // Botões de atalho de período
  const handleSelectCurrentMonth = () => {
    const now = new Date();
    setSelectedMonth(now.getMonth() + 1);
    setSelectedYear(now.getFullYear());
  };

  const handleSelectPreviousMonth = () => {
    const now = new Date();
    let prevM = now.getMonth();
    let prevY = now.getFullYear();
    if (prevM === 0) {
      prevM = 12;
      prevY -= 1;
    }
    setSelectedMonth(prevM);
    setSelectedYear(prevY);
  };

  return (
    <PageTransition>
      <div className="space-y-6 pb-16">
        {/* ── Top Header ────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-xl border border-indigo-500/20 relative overflow-hidden">
          {/* Ambient Glow */}
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
                  <Badge variant="outline" className="bg-indigo-500/20 text-indigo-300 border-indigo-400/40 text-xs px-2 py-0.5">
                    Controle Mensal
                  </Badge>
                </h1>
                <p className="text-sm text-slate-300">
                  Rastreamento oficial de novos cadastros, cancelamentos/rescisões e exclusões de clientes no ISPFY
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons & Period Selectors */}
          <div className="relative z-10 flex flex-wrap items-center gap-2">
            {/* Quick buttons */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectCurrentMonth}
              className="bg-white/10 hover:bg-white/20 border-white/20 text-white text-xs h-9"
            >
              Mês Atual
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectPreviousMonth}
              className="bg-white/10 hover:bg-white/20 border-white/20 text-white text-xs h-9"
            >
              Mês Anterior
            </Button>

            {/* Mês */}
            <Select
              value={String(selectedMonth)}
              onValueChange={(val) => setSelectedMonth(Number(val))}
            >
              <SelectTrigger className="w-36 bg-slate-900/80 border-indigo-400/30 text-white h-9 text-xs">
                <Calendar className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, idx) => (
                  <SelectItem key={idx + 1} value={String(idx + 1)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Ano */}
            <Select
              value={String(selectedYear)}
              onValueChange={(val) => setSelectedYear(Number(val))}
            >
              <SelectTrigger className="w-24 bg-slate-900/80 border-indigo-400/30 text-white h-9 text-xs">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026, 2027].map((yr) => (
                  <SelectItem key={yr} value={String(yr)}>
                    {yr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Recarregar */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadAuditData(selectedYear, selectedMonth)}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 border-indigo-400 text-white text-xs h-9"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>

            {/* Exportar CSV */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={loading || !auditData}
              className="bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white text-xs h-9"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Excel / CSV
            </Button>

            {/* Imprimir */}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={loading || !auditData}
              className="bg-slate-800 hover:bg-slate-700 border-slate-600 text-white text-xs h-9 hidden sm:flex"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Imprimir
            </Button>
          </div>
        </div>

        {/* ── Loading Banner ────────────────────────────────────── */}
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl flex items-center gap-3"
          >
            <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin" />
            <div className="flex-1">
              <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                {progressMsg}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Buscando registros e cruzando contratos no ISPFY para o período selecionado...
              </p>
            </div>
          </motion.div>
        )}

        {/* ── KPI Cards ─────────────────────────────────────────── */}
        {auditData && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Cadastrados */}
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
                    {auditData.resumo.totalCadastrados}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500 inline" />
                    MRR adicionado est.:{' '}
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                      R$ {auditData.resumo.mrrAdicionado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Card 2: Cancelados / Rescindidos */}
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
                    {auditData.resumo.totalCancelados}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500 inline" />
                    MRR perdido:{' '}
                    <span className="font-semibold text-rose-700 dark:text-rose-300">
                      R$ {auditData.resumo.mrrPerdido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Card 3: Exclusões Detectadas */}
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
                  <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">
                    {auditData.resumo.totalExcluidos}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {auditData.resumo.totalExcluidos === 0 ? (
                      <span className="text-emerald-600 font-medium">Nenhuma lacuna detectada</span>
                    ) : (
                      <span>Registros removidos da base de dados</span>
                    )}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Card 4: Saldo Líquido */}
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
                  <div className={`text-3xl font-extrabold ${
                    auditData.resumo.saldoLiquido >= 0 
                      ? 'text-emerald-600 dark:text-emerald-400' 
                      : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {auditData.resumo.saldoLiquido > 0 ? `+${auditData.resumo.saldoLiquido}` : auditData.resumo.saldoLiquido}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {auditData.resumo.saldoLiquido >= 0 ? (
                      <span className="text-emerald-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 inline" /> Crescimento de base
                      </span>
                    ) : (
                      <span className="text-rose-600 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 inline" /> Queda líquida na base
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
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10 text-sm"
              />
            </div>

            {/* Filtro por Atendente */}
            <div className="w-full sm:w-60">
              <Select value={selectedUserFilter} onValueChange={setSelectedUserFilter}>
                <SelectTrigger className="h-10 text-xs">
                  <SelectValue placeholder="Filtrar por Atendente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os Atendentes ({atendentesList.length})</SelectItem>
                  {atendentesList.map(u => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {searchTerm && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSearchTerm('')}
                className="text-xs h-10 px-3"
              >
                Limpar Busca
              </Button>
            )}
          </div>
        </Card>

        {/* ── Main Tabs & Content ───────────────────────────────── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-muted/80 p-1 rounded-xl flex flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="text-xs py-2 px-3 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
              <Info className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="cadastrados" className="text-xs py-2 px-3 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
              <UserPlus className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
              Cadastrados no Mês ({auditData?.cadastrados.length || 0})
            </TabsTrigger>
            <TabsTrigger value="cancelados" className="text-xs py-2 px-3 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
              <UserMinus className="w-3.5 h-3.5 mr-1.5 text-rose-500" />
              Cancelados no Mês ({auditData?.cancelados.length || 0})
            </TabsTrigger>
            <TabsTrigger value="excluidos" className="text-xs py-2 px-3 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
              <ShieldAlert className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
              Excluídos do ISPFY ({auditData?.excluidos.length || 0})
            </TabsTrigger>
            <TabsTrigger value="atendentes" className="text-xs py-2 px-3 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
              <Award className="w-3.5 h-3.5 mr-1.5 text-purple-500" />
              Produtividade por Atendente
            </TabsTrigger>
          </TabsList>

          {/* ═══════════════════════════════════════════════════════ */}
          {/* ABA 1: VISÃO GERAL */}
          {/* ═══════════════════════════════════════════════════════ */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Resumo Gráfico e Proporção */}
              <Card className="lg:col-span-2 border border-slate-200 dark:border-slate-800">
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Scale className="w-4 h-4 text-indigo-500" />
                    Balanço do Período ({MONTH_NAMES[selectedMonth - 1]}/{selectedYear})
                  </CardTitle>
                  <CardDescription>
                    Distribuição percentual entre novos cadastros, cancelamentos contratuais e exclusões
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {auditData && (
                    <>
                      {/* Barras de Proporção */}
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-xs font-medium mb-1">
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                              Novos Cadastros ({auditData.resumo.totalCadastrados})
                            </span>
                            <span className="font-bold">
                              {auditData.resumo.totalCadastrados + auditData.resumo.totalCancelados + auditData.resumo.totalExcluidos > 0
                                ? Math.round((auditData.resumo.totalCadastrados / (auditData.resumo.totalCadastrados + auditData.resumo.totalCancelados + auditData.resumo.totalExcluidos)) * 100)
                                : 0}%
                            </span>
                          </div>
                          <Progress 
                            value={
                              auditData.resumo.totalCadastrados + auditData.resumo.totalCancelados + auditData.resumo.totalExcluidos > 0
                                ? (auditData.resumo.totalCadastrados / (auditData.resumo.totalCadastrados + auditData.resumo.totalCancelados + auditData.resumo.totalExcluidos)) * 100
                                : 0
                            }
                            className="h-2.5 bg-slate-100 dark:bg-slate-800 [&>div]:bg-emerald-500" 
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-xs font-medium mb-1">
                            <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                              Cancelamentos / Rescisões ({auditData.resumo.totalCancelados})
                            </span>
                            <span className="font-bold">
                              {auditData.resumo.totalCadastrados + auditData.resumo.totalCancelados + auditData.resumo.totalExcluidos > 0
                                ? Math.round((auditData.resumo.totalCancelados / (auditData.resumo.totalCadastrados + auditData.resumo.totalCancelados + auditData.resumo.totalExcluidos)) * 100)
                                : 0}%
                            </span>
                          </div>
                          <Progress 
                            value={
                              auditData.resumo.totalCadastrados + auditData.resumo.totalCancelados + auditData.resumo.totalExcluidos > 0
                                ? (auditData.resumo.totalCancelados / (auditData.resumo.totalCadastrados + auditData.resumo.totalCancelados + auditData.resumo.totalExcluidos)) * 100
                                : 0
                            }
                            className="h-2.5 bg-slate-100 dark:bg-slate-800 [&>div]:bg-rose-500" 
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-xs font-medium mb-1">
                            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                              Exclusões de Banco ({auditData.resumo.totalExcluidos})
                            </span>
                            <span className="font-bold">
                              {auditData.resumo.totalCadastrados + auditData.resumo.totalCancelados + auditData.resumo.totalExcluidos > 0
                                ? Math.round((auditData.resumo.totalExcluidos / (auditData.resumo.totalCadastrados + auditData.resumo.totalCancelados + auditData.resumo.totalExcluidos)) * 100)
                                : 0}%
                            </span>
                          </div>
                          <Progress 
                            value={
                              auditData.resumo.totalCadastrados + auditData.resumo.totalCancelados + auditData.resumo.totalExcluidos > 0
                                ? (auditData.resumo.totalExcluidos / (auditData.resumo.totalCadastrados + auditData.resumo.totalCancelados + auditData.resumo.totalExcluidos)) * 100
                                : 0
                            }
                            className="h-2.5 bg-slate-100 dark:bg-slate-800 [&>div]:bg-amber-500" 
                          />
                        </div>
                      </div>

                      {/* Quadro explicativo */}
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-2 text-muted-foreground">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-500" />
                          Metodologia da Auditoria ISPFY
                        </div>
                        <p>
                          • <strong>Cadastrados:</strong> Clientes criados na rota <code className="text-[11px] bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">/api/object/cliente</code> com <code className="text-[11px] bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">data_cadastro</code> pertencente ao mês.
                        </p>
                        <p>
                          • <strong>Cancelados:</strong> Clientes com contratos finalizados ou rescindidos (<code className="text-[11px] bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">data_rescisao</code> no mês e <code className="text-[11px] bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">contrato_ativo = n</code>).
                        </p>
                        <p>
                          • <strong>Excluídos:</strong> IDs sequenciais que foram criados e posteriormente deletados de forma definitiva do banco de dados ISPFY, deixando lacuna de numeração.
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Ranking Rápido de Atendentes */}
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
                  {auditData?.resumo.rankingAtendentes.length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhum cadastro neste mês.</p>
                  )}
                  {auditData?.resumo.rankingAtendentes.slice(0, 5).map((item, idx) => (
                    <div key={item.usuario} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                          idx === 0 
                            ? 'bg-amber-500 text-white' 
                            : idx === 1 
                            ? 'bg-slate-400 text-white' 
                            : idx === 2 
                            ? 'bg-amber-700 text-white' 
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}>
                          {idx + 1}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {item.usuario}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {Math.round((item.cadastros / (auditData.resumo.totalCadastrados || 1)) * 100)}% dos cadastros
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="font-mono text-xs bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800">
                        {item.cadastros} clientes
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════ */}
          {/* ABA 2: CADASTRADOS NO MÊS */}
          {/* ═══════════════════════════════════════════════════════ */}
          <TabsContent value="cadastrados" className="space-y-4">
            <Card className="border border-slate-200 dark:border-slate-800 overflow-hidden">
              <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 pb-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                      <UserPlus className="w-5 h-5" />
                      Clientes Cadastrados em {MONTH_NAMES[selectedMonth - 1]}/{selectedYear}
                    </CardTitle>
                    <CardDescription>
                      Exibindo {filteredCadastrados.length} de {auditData?.cadastrados.length || 0} clientes encontrados
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300">
                    Total: {auditData?.cadastrados.length || 0} registros
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
                        <TableHead>Plano & Valor</TableHead>
                        <TableHead>Localidade</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCadastrados.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                            Nenhum cliente cadastrado encontrado com os filtros aplicados.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredCadastrados.map((client) => (
                          <TableRow key={client.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition-colors">
                            <TableCell className="font-mono text-xs font-semibold text-slate-500">
                              #{client.id}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                {client.nome_razao}
                              </div>
                              {client.telefone && (
                                <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Phone className="w-3 h-3 text-emerald-500" />
                                  {client.telefone}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {formatDocument(client.cpf_cnpj)}
                            </TableCell>
                            <TableCell className="text-xs">
                              <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                {formatDate(client.data_cadastro)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {client.usuario_cadastrou}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                                {client.plano || 'Plano padrão'}
                              </div>
                              <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                R$ {parseFloat(client.valor_mensal || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {client.bairro ? `${client.bairro}` : '-'}
                              {client.cidade && `, ${client.cidade}`}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  title="Copiar Nome e CPF"
                                  onClick={() => handleCopy(`${client.nome_razao} - ${formatDocument(client.cpf_cnpj)}`, 'Dados do cliente')}
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </Button>
                                {client.telefone && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                    title="Abrir WhatsApp"
                                    onClick={() => {
                                      const clean = client.telefone?.replace(/\D/g, '') || '';
                                      const phone = clean.startsWith('55') ? clean : `55${clean}`;
                                      window.open(`https://wa.me/${phone}`, '_blank');
                                    }}
                                  >
                                    <Phone className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                  title="Ver no ISPFY"
                                  onClick={() => navigate(`/ispfy/cliente/${client.id}`)}
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </Button>
                              </div>
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

          {/* ═══════════════════════════════════════════════════════ */}
          {/* ABA 3: CANCELADOS NO MÊS */}
          {/* ═══════════════════════════════════════════════════════ */}
          <TabsContent value="cancelados" className="space-y-4">
            <Card className="border border-slate-200 dark:border-slate-800 overflow-hidden">
              <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 pb-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2 text-rose-700 dark:text-rose-400">
                      <UserMinus className="w-5 h-5" />
                      Contratos Cancelados / Rescindidos em {MONTH_NAMES[selectedMonth - 1]}/{selectedYear}
                    </CardTitle>
                    <CardDescription>
                      Exibindo {filteredCancelados.length} de {auditData?.cancelados.length || 0} cancelamentos registrados no ISPFY
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300">
                    Total: {auditData?.cancelados.length || 0} cancelamentos
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="w-16">ID</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>CPF / CNPJ</TableHead>
                        <TableHead>Data Adesão</TableHead>
                        <TableHead>Data Rescisão</TableHead>
                        <TableHead>Tempo de Base</TableHead>
                        <TableHead>Valor Mensal</TableHead>
                        <TableHead>Atendente / Resp.</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCancelados.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                            Nenhum contrato rescindido ou cancelado neste mês.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredCancelados.map((item) => (
                          <TableRow key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition-colors">
                            <TableCell className="font-mono text-xs font-semibold text-slate-500">
                              #{item.id}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-xs text-slate-900 dark:text-slate-100">
                                {item.nome_cliente}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono">
                                ID Cliente: #{item.id_cliente}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {formatDocument(item.cpf_cnpj)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDate(item.data_adesao)}
                            </TableCell>
                            <TableCell className="text-xs font-medium text-rose-600 dark:text-rose-400">
                              {formatDate(item.data_rescisao)}
                            </TableCell>
                            <TableCell className="text-xs">
                              {item.dias_ativo !== undefined ? (
                                <Badge variant="outline" className="text-[10px] font-normal border-slate-300">
                                  {item.dias_ativo} dias (~{Math.round(item.dias_ativo / 30)} meses)
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                              R$ {parseFloat(item.valor_mensal || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {item.usuario_cadastrou}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  title="Copiar dados"
                                  onClick={() => handleCopy(`${item.nome_cliente} (ID: ${item.id_cliente}) - Rescisão: ${item.data_rescisao}`, 'Dados do cancelamento')}
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </Button>
                                {item.id_cliente && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                    title="Ver cliente"
                                    onClick={() => navigate(`/ispfy/cliente/${item.id_cliente}`)}
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════ */}
          {/* ABA 4: EXCLUÍDOS DO ISPFY */}
          {/* ═══════════════════════════════════════════════════════ */}
          <TabsContent value="excluidos" className="space-y-4">
            {/* Banner de Explicação Forense */}
            <Card className="p-5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg shrink-0 mt-0.5">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="space-y-1 text-xs">
                  <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    Auditoria Forense de Exclusões e Deleções no ISPFY
                    <Badge variant="outline" className="border-amber-400 text-amber-600 dark:text-amber-400 text-[10px]">
                      Detecção Sequencial & Snapshot
                    </Badge>
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Quando um operador remove ou apaga um cliente/pré-cadastro no ISPFY, o registro sofre exclusão direta do banco de dados (hard delete). O sistema ISPFY atribui IDs sequenciais numéricos automáticos; portanto, qualquer lacuna na sequência ou cliente presente em histórico prévio ausente na consulta indica que o registro foi <strong>excluído/deletado permanentemente</strong> da base.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="border border-slate-200 dark:border-slate-800 overflow-hidden">
              <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 pb-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <ShieldAlert className="w-5 h-5" />
                      Registros Excluídos / Expurgados Detectados
                    </CardTitle>
                    <CardDescription>
                      {filteredExcluidos.length} lacunas ou registros excluídos catalogados no período
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300">
                    Total: {auditData?.excluidos.length || 0} ocorrências
                  </Badge>
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
                        <TableHead>Data Estimada</TableHead>
                        <TableHead>Referência Anterior</TableHead>
                        <TableHead>Referência Posterior</TableHead>
                        <TableHead>Status da Auditoria</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredExcluidos.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                Nenhuma exclusão ou lacuna sequencial encontrada no mês de {MONTH_NAMES[selectedMonth - 1]}/{selectedYear}.
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Todos os IDs sequenciais cadastrados estão preservados e íntegros no ISPFY.
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredExcluidos.map((item) => (
                          <TableRow key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition-colors">
                            <TableCell className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                              #{item.id}
                            </TableCell>
                            <TableCell>
                              {item.tipo === 'snapshot_removido' ? (
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
                                {item.nome || 'Cadastro Excluído do ISPFY'}
                              </div>
                              {item.cpf_cnpj && (
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  CPF/CNPJ: {formatDocument(item.cpf_cnpj)}
                                </div>
                              )}
                              {item.usuario_cadastrou && (
                                <div className="text-[10px] text-muted-foreground">
                                  Atendente: {item.usuario_cadastrou}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDate(item.provavel_data)}
                            </TableCell>
                            <TableCell className="text-xs">
                              {item.referencia_anterior ? (
                                <div>
                                  <span className="font-mono text-slate-500">#{item.referencia_anterior.id}</span>
                                  <p className="text-[11px] text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                                    {item.referencia_anterior.nome}
                                  </p>
                                </div>
                              ) : '-'}
                            </TableCell>
                            <TableCell className="text-xs">
                              {item.referencia_posterior ? (
                                <div>
                                  <span className="font-mono text-slate-500">#{item.referencia_posterior.id}</span>
                                  <p className="text-[11px] text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                                    {item.referencia_posterior.nome}
                                  </p>
                                </div>
                              ) : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/30 dark:text-rose-400">
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

          {/* ═══════════════════════════════════════════════════════ */}
          {/* ABA 5: PRODUTIVIDADE POR ATENDENTE */}
          {/* ═══════════════════════════════════════════════════════ */}
          <TabsContent value="atendentes" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {auditData?.resumo.rankingAtendentes.map((item, idx) => {
                // Calcular cadastros e cancelamentos desse atendente
                const userCadastros = auditData.cadastrados.filter(c => c.usuario_cadastrou === item.usuario);
                const userCancelados = auditData.cancelados.filter(c => c.usuario_cadastrou === item.usuario);
                const totalValor = userCadastros.reduce((acc, cur) => acc + (parseFloat(cur.valor_mensal || '0') || 0), 0);

                return (
                  <motion.div
                    key={item.usuario}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
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
                            #{idx + 1}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 pt-0">
                        <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg text-xs">
                          <div>
                            <span className="text-muted-foreground text-[10px] block">Cadastros</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-base">
                              {userCadastros.length}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-[10px] block">Cancelamentos</span>
                            <span className="font-bold text-rose-600 dark:text-rose-400 text-base">
                              {userCancelados.length}
                            </span>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>Participação no total</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {Math.round((item.cadastros / (auditData.resumo.totalCadastrados || 1)) * 100)}%
                            </span>
                          </div>
                          <Progress
                            value={(item.cadastros / (auditData.resumo.totalCadastrados || 1)) * 100}
                            className="h-2 bg-slate-100 dark:bg-slate-800 [&>div]:bg-indigo-600"
                          />
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-muted-foreground">MRR Gerado:</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            R$ {totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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

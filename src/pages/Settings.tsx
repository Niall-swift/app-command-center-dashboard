import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings2, Plus, Trash2, MessageSquare, UserPlus, Bot, Power } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PageTransition from '@/components/PageTransition';
import { db } from '@/config/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Switch } from '@/components/ui/switch';
import { Label as LabelUI } from '@/components/ui/label';
import { ixcService } from '@/services/ixc/ixcService';
import { IXCClienteData, IXCContratoData, IXCFaturaData } from '@/types/ixc';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from 'sonner';
import { formatDate } from '@/utils/date';
import { Loader2, Building2, User, RefreshCcw, ArrowRightLeft, AlertTriangle, CheckCircle2, ShieldCheck, Users, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Filial {
  id: string;
  razao: string;
  nome_fantasia: string;
}

interface CustomMessage {
  id: string;
  title: string;
  content: string;
}

interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: 'tecnico' | 'atendente';
  status: 'ativo' | 'inativo';
  createdAt: string;
}

export default function Settings() {
  const [customMessages, setCustomMessages] = useState<CustomMessage[]>([
    {
      id: '1',
      title: 'Boas vindas',
      content: 'Olá {nome}! Seja bem-vindo ao nosso atendimento. Como posso ajudá-lo hoje?'
    },
    {
      id: '2',
      title: 'Verificação',
      content: '{nome}, vou verificar essa informação para você. Por favor, aguarde um momento.'
    }
  ]);

  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([
    {
      id: '1',
      name: 'João Silva',
      email: 'joao@empresa.com',
      role: 'tecnico',
      status: 'ativo',
      createdAt: '2024-01-15'
    },
    {
      id: '2',
      name: 'Maria Santos',
      email: 'maria@empresa.com',
      role: 'atendente',
      status: 'ativo',
      createdAt: '2024-01-10'
    }
  ]);

  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Estados para adicionar usuário
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'tecnico' | 'atendente'>('atendente');
  const [isAddingUser, setIsAddingUser] = useState(false);

  // Estado do Robô WhatsApp
  const [botActive, setBotActive] = useState<boolean | null>(null);

  // Estados para Clientes por Filial
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [clientes, setClientes] = useState<IXCClienteData[]>([]);
  const [loadingIXC, setLoadingIXC] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [detectedFilialField, setDetectedFilialField] = useState<string | null>(null);
  const [clientStatus, setClientStatus] = useState<'S' | 'N'>('S');

  // Estados para Troca em Massa
  const [sourceFilialId, setSourceFilialId] = useState<string>('');
  const [targetFilialId, setTargetFilialId] = useState<string>('');
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapProgress, setSwapProgress] = useState({ current: 0, total: 0, success: 0, errors: 0 });

  // Estados para Auditoria Financeira
  const [contratos, setContratos] = useState<IXCContratoData[]>([]);
  const [faturasPagas, setFaturasPagas] = useState<IXCFaturaData[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditFilter, setAuditFilter] = useState<'todos' | 'incorretos'>('todos');

  const fetchIXCData = async () => {
    setLoadingIXC(true);
    setLoadingProgress(0);
    try {
      const filiaisData = await ixcService.getFiliais();
      setFiliais(filiaisData);

      const allClientes = await ixcService.fetchAllClientesByStatus(clientStatus, (total) => {
        setLoadingProgress(total);
      });
      setClientes(allClientes);

      // Detectar o campo de filial de forma robusta
      if (allClientes.length > 0 && filiaisData.length > 0) {
        const filialIds = new Set(filiaisData.map(f => String(f.id)));
        const keys = Object.keys(allClientes[0]);
        
        // Contar quantos matches cada campo tem
        const fieldMatches: Record<string, number> = {};
        keys.forEach(key => {
          if (key === 'id' || key === 'numero') return;
          const matches = allClientes.filter(c => c[key] && filialIds.has(String(c[key]))).length;
          if (matches > 0) fieldMatches[key] = matches;
        });

        const priorityFields = ['filial_id', 'id_filial'];
        let bestField = priorityFields.find(f => (fieldMatches[f] || 0) > 0);

        if (!bestField) {
          bestField = Object.entries(fieldMatches).reduce((a: any, b: any) => b[1] > a[1] ? b : a, ['', 0])[0];
        }
        
        if (bestField) {
          setDetectedFilialField(bestField);
        } else {
          setDetectedFilialField('filial_id');
        }
      }
      
      toast.success('Dados do IXC sincronizados com sucesso!');
    } catch (error) {
      console.error('Erro ao buscar dados do IXC:', error);
      toast.error('Erro ao sincronizar dados do IXC.');
    } finally {
      setLoadingIXC(false);
    }
  };

  const handleBulkSwap = async () => {
    if (!sourceFilialId || !targetFilialId) {
      toast.error('Selecione as filiais de origem e destino.');
      return;
    }

    if (sourceFilialId === targetFilialId) {
      toast.error('As filiais de origem e destino devem ser diferentes.');
      return;
    }

    const filialField = detectedFilialField || 'filial_id';
    const clientesParaTrocar = clientes.filter(c => String(c[filialField]) === String(sourceFilialId));

    if (clientesParaTrocar.length === 0) {
      toast.error('Nenhum cliente encontrado na filial de origem.');
      return;
    }

    if (!confirm(`Tem certeza que deseja mover ${clientesParaTrocar.length} clientes para a nova filial? Esta ação não pode ser desfeita facilmente.`)) {
      return;
    }

    setIsSwapping(true);
    setSwapProgress({ current: 0, total: clientesParaTrocar.length, success: 0, errors: 0 });

    for (let i = 0; i < clientesParaTrocar.length; i++) {
      const cliente = clientesParaTrocar[i];
      const updateData = {
        ...cliente,
        filial_id: targetFilialId
      };
      
      const result = await ixcService.updateCliente(cliente.id, updateData);
      
      setSwapProgress(prev => ({
        ...prev,
        current: i + 1,
        success: result.success ? prev.success + 1 : prev.success,
        errors: !result.success ? prev.errors + 1 : prev.errors
      }));

      await new Promise(resolve => setTimeout(resolve, 80));
    }

    toast.success('Operação concluída!');
    setIsSwapping(false);
    fetchIXCData();
  };

  const fetchAuditData = async () => {
    setLoadingAudit(true);
    try {
      toast.info('Iniciando auditoria... Isso pode levar alguns minutos.');
      
      const allContratos = await ixcService.fetchAllContratos((total) => {
        setLoadingProgress(total);
      });
      setContratos(allContratos);

      const recentFaturas = await ixcService.fetchRecentFaturasPagas(180, (total) => {
        setLoadingProgress(total);
      });
      setFaturasPagas(recentFaturas);

      toast.success('Dados para auditoria carregados!');
    } catch (error) {
      console.error('Erro na auditoria:', error);
      toast.error('Erro ao carregar dados de auditoria.');
    } finally {
      setLoadingAudit(false);
    }
  };

  const getAuditResults = () => {
    // Filtrar apenas clientes ativos para a auditoria
    const activeClientes = clientes.filter(c => c.ativo === 'S');
    return activeClientes.map(cliente => {
      const contrato = contratos.find(c => String(c.id_cliente) === String(cliente.id));
      const faturasDoCliente = faturasPagas.filter(f => String(f.id_cliente) === String(cliente.id));
      const ultimaFatura = faturasDoCliente.sort((a, b) => {
        const dateA = new Date(a.data_vencimento || 0).getTime();
        const dateB = new Date(b.data_vencimento || 0).getTime();
        return dateB - dateA;
      })[0];

      const pagoAte = (contrato?.pago_ate_data || contrato?.pago_ate) as string | undefined;
      const vencimentoUltimaFull = ultimaFatura?.data_vencimento as string | undefined;
      
      // Normalizar para YYYY-MM-DD para evitar problemas com horas ou espaços
      const pagoAteNorm = pagoAte?.substring(0, 10);
      const vencimentoUltimaNorm = vencimentoUltimaFull?.substring(0, 10);
      
      const isCorrect = pagoAteNorm && vencimentoUltimaNorm && pagoAteNorm === vencimentoUltimaNorm;

      return {
        cliente,
        pagoAte: pagoAteNorm,
        vencimentoUltima: vencimentoUltimaNorm,
        isCorrect,
        contratoId: contrato?.id
      };
    }).filter(res => {
      if (auditFilter === 'incorretos') return !res.isCorrect;
      return true;
    });
  };

  const handleExportAuditPDF = () => {
    const results = getAuditResults();
    if (results.length === 0) {
      toast.error('Nenhum dado de auditoria para exportar.');
      return;
    }

    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text('AVL TELCOM - Auditoria Financeira', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 30);
    doc.text(`Filtro: ${auditFilter === 'todos' ? 'Todos os clientes ativos' : 'Somente divergências'}`, 14, 35);

    const tableHeaders = [['ID', 'Cliente', 'Pago Ate (Contrato)', 'Ultima Paga (Vencimento)', 'Status']];
    const tableRows = results.map(res => [
      res.cliente.id,
      res.cliente.razao || res.cliente.nome,
      res.pagoAte ? formatDate(res.pagoAte) : 'Sem data',
      res.vencimentoUltima ? formatDate(res.vencimentoUltima) : 'Nenhuma fatura paga',
      res.isCorrect ? 'Correto' : 'Incorreto'
    ]);

    autoTable(doc, {
      head: tableHeaders,
      body: tableRows,
      startY: 45,
      theme: 'grid',
      headStyles: { fillColor: [124, 58, 237], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 20 },
        2: { cellWidth: 35 },
        3: { cellWidth: 35 },
        4: { cellWidth: 25 }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 4) {
          const status = data.cell.raw;
          if (status === 'Incorreto') {
            data.cell.styles.textColor = [220, 38, 38]; // Red
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [22, 163, 74]; // Green
          }
        }
      }
    });

    doc.save(`auditoria_financeira_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('Relatório PDF exportado com sucesso!');
  };

  React.useEffect(() => {
    const unsub = onSnapshot(doc(db, "bot_config", "global"), (snap) => {
      if (snap.exists()) {
        setBotActive(snap.data().active);
      } else {
        setBotActive(false);
      }
    });
    return () => unsub();
  }, []);

  const handleToggleBot = async (checked: boolean) => {
    try {
      await setDoc(doc(db, "bot_config", "global"), {
        active: checked,
        last_update: new Date()
      }, { merge: true });
    } catch (error) {
      console.error("Erro ao atualizar status do robô:", error);
    }
  };

  const handleAddMessage = () => {
    if (newTitle.trim() && newContent.trim()) {
      const newMessage: CustomMessage = {
        id: Date.now().toString(),
        title: newTitle,
        content: newContent
      };
      setCustomMessages([...customMessages, newMessage]);
      setNewTitle('');
      setNewContent('');
      setIsAdding(false);
    }
  };

  const handleDeleteMessage = (id: string) => {
    setCustomMessages(customMessages.filter(msg => msg.id !== id));
  };

  const handleAddUser = () => {
    if (newUserName.trim() && newUserEmail.trim()) {
      const newUser: TeamUser = {
        id: Date.now().toString(),
        name: newUserName,
        email: newUserEmail,
        role: newUserRole,
        status: 'ativo',
        createdAt: new Date().toISOString().split('T')[0]
      };
      setTeamUsers([...teamUsers, newUser]);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserRole('atendente');
      setIsAddingUser(false);
    }
  };

  const handleDeleteUser = (id: string) => {
    setTeamUsers(teamUsers.filter(user => user.id !== id));
  };

  const toggleUserStatus = (id: string) => {
    setTeamUsers(teamUsers.map(user => 
      user.id === id 
        ? { ...user, status: user.status === 'ativo' ? 'inativo' : 'ativo' as 'ativo' | 'inativo' }
        : user
    ));
  };

  const getRoleBadgeColor = (role: string) => {
    return role === 'tecnico' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
  };

  const getStatusBadgeColor = (status: string) => {
    return status === 'ativo' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
  };

  const messageVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: {
        duration: 0.3,
        ease: "easeOut"
      }
    },
    exit: { 
      opacity: 0, 
      y: -20, 
      scale: 0.95,
      transition: {
        duration: 0.2
      }
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Settings2 className="w-8 h-8 text-blue-600" />
              Configurações
            </h1>
            <p className="text-gray-600 mt-2">Gerencie suas configurações e equipe</p>
          </motion.div>

            <Button 
            onClick={fetchIXCData} 
            disabled={loadingIXC}
            variant="outline"
            className="gap-2"
          >
            {loadingIXC ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
            Sincronizar IXC
          </Button>
        </div>

        <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Status dos Clientes:</span>
          </div>
          <Select value={clientStatus} onValueChange={(v: 'S' | 'N') => setClientStatus(v)}>
            <SelectTrigger className="w-48 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="S">Ativos</SelectItem>
              <SelectItem value="N">Inativos</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">
            {clientStatus === 'S' ? 'Gerencie clientes com contrato ativo' : 'Gerencie clientes com contrato inativo/cancelado'}
          </p>
        </div>

        {/* Seção de Clientes por Filial */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="bg-white shadow-sm overflow-hidden border-2 border-blue-100">
            <CardHeader className="bg-blue-50/50">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  Agrupamento de Clientes ({clientStatus === 'S' ? 'Ativos' : 'Inativos'}) por Filial
                </div>
                {loadingIXC && (
                  <Badge variant="secondary" className="animate-pulse">
                    Carregando {loadingProgress} clientes...
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {filiais.length > 0 ? (
                <Accordion type="single" collapsible className="w-full">
                  {filiais.map((filial) => {
                    const filialField = detectedFilialField || 'filial_id';
                    const clientesDaFilial = clientes.filter(c => String(c[filialField]) === String(filial.id));
                    return (
                      <AccordionItem key={filial.id} value={filial.id} className="border-b last:border-0">
                        <AccordionTrigger className="px-6 py-4 hover:bg-gray-50 flex items-center justify-between">
                          <div className="flex items-center gap-3 text-left">
                            <span className="font-bold text-gray-900">
                              {filial.nome_fantasia || filial.razao} 
                            </span>
                            <Badge variant="outline" className="bg-blue-50">
                              {clientesDaFilial.length} clientes
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="bg-gray-50/50 px-6 py-4">
                          {clientesDaFilial.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {clientesDaFilial.map((cliente) => (
                                <div key={cliente.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                    <User className="w-4 h-4 text-blue-600" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{cliente.razao || cliente.nome}</p>
                                    <p className="text-xs text-gray-500">ID: {cliente.id}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-center py-4 text-gray-500 text-sm italic">Nenhum cliente vinculado a esta filial.</p>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>Clique em "Sincronizar IXC" para carregar os grupos por filial</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Seção de Troca em Massa */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card className="bg-white shadow-sm border-2 border-orange-100 overflow-hidden">
            <CardHeader className="bg-orange-50/50">
              <CardTitle className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-orange-600" />
                Troca em Massa de Filial ({clientStatus === 'S' ? 'Clientes Ativos' : 'Clientes Inativos'})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Filial de Origem</label>
                  <Select value={sourceFilialId} onValueChange={setSourceFilialId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a origem" />
                    </SelectTrigger>
                    <SelectContent>
                      {filiais.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.nome_fantasia || f.razao}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-center pb-2">
                  <div className="bg-orange-100 p-2 rounded-full">
                    <ArrowRightLeft className="w-5 h-5 text-orange-600" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Filial de Destino</label>
                  <Select value={targetFilialId} onValueChange={setTargetFilialId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {filiais.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.nome_fantasia || f.razao}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isSwapping ? (
                <div className="mt-8 space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">Processando...</span>
                    <span className="text-blue-600 font-bold">{swapProgress.current} / {swapProgress.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                    <motion.div 
                      className="bg-blue-600 h-2.5"
                      initial={{ width: 0 }}
                      animate={{ width: `${(swapProgress.current / swapProgress.total) * 100}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 p-3 rounded-lg border border-green-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span className="text-xs font-medium text-green-800">Sucesso</span>
                      </div>
                      <span className="text-lg font-bold text-green-700">{swapProgress.success}</span>
                    </div>
                    <div className="bg-red-50 p-3 rounded-lg border border-red-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <span className="text-xs font-medium text-red-800">Erros</span>
                      </div>
                      <span className="text-lg font-bold text-red-700">{swapProgress.errors}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-8">
                  <Button 
                    onClick={handleBulkSwap}
                    disabled={!sourceFilialId || !targetFilialId || loadingIXC}
                    className="w-full bg-orange-600 hover:bg-orange-700 h-12 text-lg font-bold"
                  >
                    Iniciar Troca em Massa
                  </Button>
                  <p className="text-xs text-center text-gray-500 mt-2 flex items-center justify-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Esta operação irá atualizar individualmente cada cliente via API.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Seção de Auditoria Financeira */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="bg-white shadow-sm border-2 border-purple-100 overflow-hidden">
            <CardHeader className="bg-purple-50/50">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-purple-600" />
                  Auditoria Financeira: Pago Até vs Última Fatura
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={auditFilter} onValueChange={(v: 'todos' | 'incorretos') => setAuditFilter(v)}>
                    <SelectTrigger className="w-40 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="incorretos">Somente Incorretos</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={handleExportAuditPDF}
                    disabled={loadingAudit || contratos.length === 0}
                    size="sm"
                    variant="outline"
                    className="border-purple-200 text-purple-700 hover:bg-purple-50 h-8 font-medium"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Exportar PDF
                  </Button>
                  <Button 
                    onClick={fetchAuditData} 
                    disabled={loadingAudit || loadingIXC}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700 h-8 font-medium"
                  >
                    {loadingAudit ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
                    Rodar Auditoria
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {contratos.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-700 uppercase text-xs font-bold border-b">
                      <tr>
                        <th className="px-6 py-3">Cliente</th>
                        <th className="px-6 py-3">Pago Até (Contrato)</th>
                        <th className="px-6 py-3">Última Paga (Vencimento)</th>
                        <th className="px-6 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {getAuditResults().map((res) => (
                        <tr key={res.cliente.id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900 text-sm">{res.cliente.razao || res.cliente.nome}</div>
                            <div className="text-[10px] text-gray-500">ID: {res.cliente.id}</div>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs">
                            {res.pagoAte ? formatDate(res.pagoAte) : 'Sem data'}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs">
                            {res.vencimentoUltima ? formatDate(res.vencimentoUltima) : 'Nenhuma fatura paga'}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {res.isCorrect ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">Correto</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px]">Incorreto</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 text-center text-gray-500">
                  <ShieldCheck className="w-16 h-16 mx-auto mb-4 opacity-10" />
                  <p className="text-lg font-medium">Nenhum dado de auditoria carregado.</p>
                  <p className="text-sm">Clique em "Rodar Auditoria" para comparar os contratos com as faturas.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Seção de Configuração do Robô */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Card className={`border-2 transition-all duration-300 ${botActive ? 'border-green-500/50 shadow-lg shadow-green-500/5' : 'border-gray-200 shadow-sm'}`}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${botActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Assistente Virtual (Bot WhatsApp)</h3>
                    <p className="text-sm font-normal text-muted-foreground">Controle a ativação do atendimento automático</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-secondary/20 p-2 rounded-full px-4 border">
                  <span className={`text-xs font-bold uppercase ${botActive ? 'text-green-600' : 'text-gray-500'}`}>
                    {botActive === null ? 'Carregando...' : botActive ? 'Ligado' : 'Desligado'}
                  </span>
                  <Switch 
                    checked={botActive || false} 
                    onCheckedChange={handleToggleBot}
                    disabled={botActive === null}
                  />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-secondary/10 border border-secondary/20 flex items-start gap-4">
                  <div className="p-2 rounded-full bg-blue-100 text-blue-600">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Saudação Ativa</p>
                    <p className="text-xs text-muted-foreground italic">"Olá [Nome]! Como posso te ajudar hoje?"</p>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-secondary/10 border border-secondary/20 flex items-start gap-4">
                  <div className="p-2 rounded-full bg-purple-100 text-purple-600">
                    <Power className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Comandos de Emergência</p>
                    <p className="text-xs text-muted-foreground">Use #robo:desligar no WhatsApp para desativar remotamente.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Seção de Gerenciamento de Usuários */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card className="bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Gerenciamento de Usuários da Equipe
                </div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    onClick={() => setIsAddingUser(!isAddingUser)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Adicionar Usuário
                  </Button>
                </motion.div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <AnimatePresence>
                {isAddingUser && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                  >
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nome Completo
                          </label>
                          <Input
                            value={newUserName}
                            onChange={(e) => setNewUserName(e.target.value)}
                            placeholder="Ex: João Silva"
                            className="w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            E-mail
                          </label>
                          <Input
                            type="email"
                            value={newUserEmail}
                            onChange={(e) => setNewUserEmail(e.target.value)}
                            placeholder="joao@empresa.com"
                            className="w-full"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Função
                        </label>
                        <Select value={newUserRole} onValueChange={(value: 'tecnico' | 'atendente') => setNewUserRole(value)}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecione a função" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="atendente">Atendente</SelectItem>
                            <SelectItem value="tecnico">Técnico</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2">
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                          <Button onClick={handleAddUser} size="sm">
                            Salvar Usuário
                          </Button>
                        </motion.div>
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                          <Button 
                            onClick={() => setIsAddingUser(false)} 
                            variant="outline" 
                            size="sm"
                          >
                            Cancelar
                          </Button>
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-3"
              >
                <AnimatePresence>
                  {teamUsers.map((user) => (
                    <motion.div
                      key={user.id}
                      variants={messageVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      layout
                      className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-medium text-gray-900">{user.name}</h4>
                            <Badge className={getRoleBadgeColor(user.role)}>
                              {user.role === 'tecnico' ? 'Técnico' : 'Atendente'}
                            </Badge>
                            <Badge className={getStatusBadgeColor(user.status)}>
                              {user.status === 'ativo' ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <p><strong>E-mail:</strong> {user.email}</p>
                            <p><strong>Cadastrado em:</strong> {new Date(user.createdAt).toLocaleDateString('pt-BR')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                            <Button
                              onClick={() => toggleUserStatus(user.id)}
                              variant="outline"
                              size="sm"
                              className={user.status === 'ativo' ? 'text-orange-600 hover:text-orange-700' : 'text-green-600 hover:text-green-700'}
                            >
                              {user.status === 'ativo' ? 'Desativar' : 'Ativar'}
                            </Button>
                          </motion.div>
                          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                            <Button
                              onClick={() => handleDeleteUser(user.id)}
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </motion.div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>

              {teamUsers.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8 text-gray-500"
                >
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>Nenhum usuário cadastrado</p>
                  <p className="text-sm">Clique em "Adicionar Usuário" para começar</p>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Seção de Mensagens Rápidas */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Mensagens Rápidas Personalizadas
                </div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    onClick={() => setIsAdding(!isAdding)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Mensagem
                  </Button>
                </motion.div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <AnimatePresence>
                {isAdding && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                  >
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Título da Mensagem
                        </label>
                        <Input
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          placeholder="Ex: Saudação personalizada"
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Conteúdo da Mensagem
                        </label>
                        <Textarea
                          value={newContent}
                          onChange={(e) => setNewContent(e.target.value)}
                          placeholder="Use {nome} para inserir o nome do cliente automaticamente"
                          rows={3}
                          className="w-full"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Dica: Use {"{nome}"} para inserir automaticamente o nome do cliente
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                          <Button onClick={handleAddMessage} size="sm">
                            Salvar
                          </Button>
                        </motion.div>
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                          <Button 
                            onClick={() => setIsAdding(false)} 
                            variant="outline" 
                            size="sm"
                          >
                            Cancelar
                          </Button>
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-3"
              >
                <AnimatePresence>
                  {customMessages.map((message) => (
                    <motion.div
                      key={message.id}
                      variants={messageVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      layout
                      className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium text-gray-900">{message.title}</h4>
                            <Badge variant="secondary" className="text-xs">
                              Personalizada
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded border">
                            {message.content}
                          </p>
                        </div>
                        <motion.div
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <Button
                            onClick={() => handleDeleteMessage(message.id)}
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 ml-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </motion.div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>

              {customMessages.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8 text-gray-500"
                >
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>Nenhuma mensagem personalizada cadastrada</p>
                  <p className="text-sm">Clique em "Nova Mensagem" para começar</p>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </PageTransition>
  );
}

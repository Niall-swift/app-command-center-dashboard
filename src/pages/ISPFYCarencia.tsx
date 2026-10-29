import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PageTransition from '@/components/PageTransition';
import { ispfyService } from '@/services/ispfy/ispfyService';
import { whapiService } from '@/services/whapi/whapiService';
import { ISPFYCarenciaItem } from '@/types/ispfy';
import { db } from '@/config/firebase';
import { collection, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { 
  Bot, 
  Send, 
  RefreshCw, 
  Calendar, 
  Search, 
  Smartphone, 
  Gift, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ExternalLink, 
  ShieldAlert, 
  Plus, 
  Check, 
  X,
  Sparkles,
  MessageSquare
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';

export const ISPFYCarencia: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [processingRobot, setProcessingRobot] = useState<boolean>(false);
  const [items, setItems] = useState<ISPFYCarenciaItem[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'sent'>('all');
  const [selectedItemForMessage, setSelectedItemForMessage] = useState<ISPFYCarenciaItem | null>(null);
  const [sendingIndividual, setSendingIndividual] = useState<string | null>(null);

  // Modal de conceder carência
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [modalContratoId, setModalContratoId] = useState<string>('');
  const [modalDataCarencia, setModalDataCarencia] = useState<string>('');
  const [modalSendWhatsapp, setModalSendWhatsapp] = useState<boolean>(true);
  const [savingCarencia, setSavingCarencia] = useState<boolean>(false);

  // Formata data YYYY-MM-DD para DD/MM/YYYY
  const formatDateBR = (dateStr: string) => {
    if (!dateStr) return 'Não definida';
    const clean = dateStr.split(' ')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Mensagem padronizada com AVL Telecom e Pré-Mix
  const generateMessageText = (name: string, dataCarencia: string) => {
    const firstName = (name || 'Cliente').trim().split(' ')[0] || 'Cliente';
    const dataFormatada = formatDateBR(dataCarencia);

    return `Olá, *${firstName}*! Tudo bem? 📶

Passando para confirmar que a sua fatura/conexão foi agendada em *carência até o dia ${dataFormatada}*. 📅

⚠️ *Aviso Importante:*
Lembramos que se passar dessa data limite, o sistema realiza o bloqueio automático e *não será possível agendar novamente*.

📲 *Fique em Dia e Concorra a Prêmios:*
Baixe o aplicativo da *AVL Telecom*, mantenha suas faturas sempre em dia e concorra a vários prêmios incríveis nos sorteios do *Pré-Mix*! 🎁🍀

_Caso tenha dúvidas ou já tenha efetuado o pagamento, entre em contato com nosso atendimento._
_Att, Equipe AVL Telecom_`;
  };

  // Carrega contratos em carência do ISPFY e cruza com logs do Firestore
  const loadCarenciaData = async () => {
    setLoading(true);
    try {
      // 1. Busca contratos do ISPFY
      const ispfyContracts = await ispfyService.getCarenciaContracts();

      // 2. Busca histórico de envios no Firestore
      const notificationsSnapshot = await getDocs(collection(db, 'carencia_notifications'));
      const sentMap = new Map<string, any>();
      notificationsSnapshot.forEach((docSnap) => {
        sentMap.set(docSnap.id, docSnap.data());
      });

      // 3. Mescla dados
      const enrichedItems: ISPFYCarenciaItem[] = ispfyContracts.map((c) => {
        const key = `${c.contratoId}_${(c.dataFinalCarencia || '').split(' ')[0]}`;
        const notif = sentMap.get(key);

        return {
          ...c,
          notificado: notif ? notif.status === 'sent' : false,
          notificadoEm: notif?.enviadoEm?.toDate?.() 
            ? notif.enviadoEm.toDate().toLocaleString('pt-BR') 
            : notif?.enviadoEm || undefined,
          notificacaoId: notif?.messageId || undefined,
          mensagemErro: notif?.erro || undefined,
        };
      });

      // Ordenar: primeiro os pendentes, depois por data da carência
      enrichedItems.sort((a, b) => {
        if (!a.notificado && b.notificado) return -1;
        if (a.notificado && !b.notificado) return 1;
        return (a.dataFinalCarencia || '').localeCompare(b.dataFinalCarencia || '');
      });

      setItems(enrichedItems);
    } catch (error) {
      console.error('Erro ao carregar dados de carência:', error);
      toast.error('Erro ao conectar à API do ISPFY');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCarenciaData();
  }, []);

  // Enviar WhatsApp individual para um cliente
  const handleSendIndividual = async (item: ISPFYCarenciaItem) => {
    if (!item.clienteTelefone) {
      toast.error(`Cliente ${item.clienteNome} não possui WhatsApp cadastrado.`);
      return;
    }

    setSendingIndividual(item.contratoId);
    try {
      const messageBody = generateMessageText(item.clienteNome, item.dataFinalCarencia);
      const cleanDate = (item.dataFinalCarencia || '').split(' ')[0];
      const notificationDocId = `${item.contratoId}_${cleanDate}`;

      const res = await whapiService.sendMessage({
        to: item.clienteTelefone,
        body: messageBody,
      });

      if (res.sent) {
        // Salva registro no Firestore
        await setDoc(doc(db, 'carencia_notifications', notificationDocId), {
          contratoId: item.contratoId,
          clienteId: item.clienteId,
          clienteNome: item.clienteNome,
          telefone: item.clienteTelefone,
          dataFinalCarencia: cleanDate,
          mensagem: messageBody,
          messageId: res.id || null,
          status: 'sent',
          enviadoEm: serverTimestamp(),
        }, { merge: true });

        toast.success(`Mensagem enviada com sucesso para ${item.clienteNome}!`);

        // Atualiza estado local
        setItems((prev) =>
          prev.map((i) =>
            i.contratoId === item.contratoId
              ? { ...i, notificado: true, notificadoEm: new Date().toLocaleString('pt-BR') }
              : i
          )
        );
      } else {
        toast.error(`Falha no envio: ${res.error || 'Erro na Z-API'}`);
      }
    } catch (error: any) {
      console.error(error);
      toast.error('Erro ao disparar mensagem');
    } finally {
      setSendingIndividual(null);
    }
  };

  // Disparar Robô para todos os pendentes
  const handleRunRobotBatch = async () => {
    const pendentes = items.filter((i) => !i.notificado && !!i.clienteTelefone);

    if (pendentes.length === 0) {
      toast.info('Nenhum cliente pendente de notificação no momento!');
      return;
    }

    setProcessingRobot(true);
    let sucessos = 0;
    let falhas = 0;

    toast.loading(`Robô iniciado: processando ${pendentes.length} cliente(s)...`, { id: 'robot-batch' });

    for (const item of pendentes) {
      try {
        const messageBody = generateMessageText(item.clienteNome, item.dataFinalCarencia);
        const cleanDate = (item.dataFinalCarencia || '').split(' ')[0];
        const notificationDocId = `${item.contratoId}_${cleanDate}`;

        const res = await whapiService.sendMessage({
          to: item.clienteTelefone,
          body: messageBody,
        });

        if (res.sent) {
          await setDoc(doc(db, 'carencia_notifications', notificationDocId), {
            contratoId: item.contratoId,
            clienteId: item.clienteId,
            clienteNome: item.clienteNome,
            telefone: item.clienteTelefone,
            dataFinalCarencia: cleanDate,
            mensagem: messageBody,
            messageId: res.id || null,
            status: 'sent',
            enviadoEm: serverTimestamp(),
          }, { merge: true });

          sucessos++;
        } else {
          falhas++;
        }

        // Intervalo de segurança anti-ban entre mensagens (1.5 segundos)
        await new Promise((r) => setTimeout(r, 1500));
      } catch (e) {
        falhas++;
      }
    }

    setProcessingRobot(false);
    toast.dismiss('robot-batch');

    if (sucessos > 0) {
      toast.success(`Robô finalizado: ${sucessos} mensagem(ns) enviada(s) com sucesso!`);
      loadCarenciaData();
    } else {
      toast.error(`Ocorreram falhas ao processar as notificações.`);
    }
  };

  // Conceder carência manual
  const handleSaveManualCarencia = async () => {
    if (!modalContratoId || !modalDataCarencia) {
      toast.error('Preencha o ID do contrato e a data da carência');
      return;
    }

    setSavingCarencia(true);
    try {
      const res = await ispfyService.setContratoCarencia(modalContratoId, modalDataCarencia);
      if (!res.success) {
        toast.error(res.message || 'Erro ao registrar carência no ISPFY');
        return;
      }

      toast.success('Carência registrada no ISPFY com sucesso!');
      setIsAddModalOpen(false);

      // Se marcou para enviar WhatsApp imediatamente
      if (modalSendWhatsapp) {
        try {
          const contratos = await ispfyService.getCarenciaContracts();
          const target = contratos.find((c) => c.contratoId === modalContratoId);
          if (target && target.clienteTelefone) {
            await handleSendIndividual({ ...target, dataFinalCarencia: modalDataCarencia });
          } else if (target && !target.clienteTelefone) {
            toast.warning(`Cliente ${target.clienteNome} não possui WhatsApp cadastrado para envio automático.`);
          }
        } catch (e) {
          console.error(e);
        }
      }

      await loadCarenciaData();
    } catch (error: any) {
      toast.error('Erro ao processar carência');
    } finally {
      setSavingCarencia(false);
    }
  };

  // Filtragem dos itens
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.clienteNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.contratoId.includes(searchTerm) ||
        (item.clienteCpfCnpj && item.clienteCpfCnpj.includes(searchTerm)) ||
        (item.clienteTelefone && item.clienteTelefone.includes(searchTerm));

      if (!matchesSearch) return false;

      if (statusFilter === 'pending') return !item.notificado;
      if (statusFilter === 'sent') return item.notificado;
      return true;
    });
  }, [items, searchTerm, statusFilter]);

  // Estatísticas dos cards
  const stats = useMemo(() => {
    const total = items.length;
    const sent = items.filter((i) => i.notificado).length;
    const pending = total - sent;
    const semTelefone = items.filter((i) => !i.clienteTelefone).length;
    return { total, sent, pending, semTelefone };
  }, [items]);

  return (
    <PageTransition>
      <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8">
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-900/30 via-indigo-900/20 to-purple-900/30 p-6 rounded-2xl border border-blue-500/20 backdrop-blur-md">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-600/20 rounded-xl border border-blue-500/30 text-blue-400">
                <Bot className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  Robô de Carência & Agendamento
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs">
                    <Sparkles className="w-3 h-3 mr-1" /> ISPFY Ativo
                  </Badge>
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  Disparo automático via WhatsApp avisando prazo de tolerância, app AVL Telecom e prêmios Pré-Mix.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={loadCarenciaData}
              disabled={loading}
              className="border-slate-700 bg-slate-800/60 hover:bg-slate-700 text-slate-200"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
            >
              <Plus className="w-4 h-4 mr-2" />
              Lançar Carência
            </Button>

            <Button
              size="sm"
              onClick={handleRunRobotBatch}
              disabled={processingRobot || stats.pending === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
            >
              <Bot className={`w-4 h-4 mr-2 ${processingRobot ? 'animate-spin' : ''}`} />
              {processingRobot ? 'Executando Robô...' : `Disparar Robô (${stats.pending} Pendentes)`}
            </Button>
          </div>
        </div>

        {/* Cards de Métricas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Total em Carência</CardTitle>
              <Calendar className="w-4 h-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-white">{stats.total}</div>
              <p className="text-xs text-slate-400 mt-1">Contratos com tolerância no ISPFY</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Notificados (WhatsApp)</CardTitle>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-emerald-400">{stats.sent}</div>
              <p className="text-xs text-slate-400 mt-1">Clientes cientes do agendamento</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Pendentes de Disparo</CardTitle>
              <Clock className="w-4 h-4 text-amber-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-amber-400">{stats.pending}</div>
              <p className="text-xs text-slate-400 mt-1">Aguardando envio pelo robô</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Sem WhatsApp Válido</CardTitle>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-rose-400">{stats.semTelefone}</div>
              <p className="text-xs text-slate-400 mt-1">Necessitam atualização de contato</p>
            </CardContent>
          </Card>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-900/40 p-4 rounded-xl border border-slate-800">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Buscar por nome, CPF ou contrato..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant={statusFilter === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter('all')}
              className={statusFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400'}
            >
              Todos ({stats.total})
            </Button>
            <Button
              variant={statusFilter === 'pending' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter('pending')}
              className={statusFilter === 'pending' ? 'bg-amber-600 text-white' : 'text-slate-400'}
            >
              Pendentes ({stats.pending})
            </Button>
            <Button
              variant={statusFilter === 'sent' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter('sent')}
              className={statusFilter === 'sent' ? 'bg-emerald-600 text-white' : 'text-slate-400'}
            >
              Notificados ({stats.sent})
            </Button>
          </div>
        </div>

        {/* Tabela de Contratos em Carência */}
        <Card className="bg-slate-900/60 border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/70 text-slate-400 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4">Cliente / Contrato</th>
                  <th className="px-6 py-4">WhatsApp</th>
                  <th className="px-6 py-4">Carência Até</th>
                  <th className="px-6 py-4">Status Envio</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-500">
                      <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
                      Consultando contratos no ISPFY...
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-500">
                      Nenhum contrato em carência encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.contratoId} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-white text-base">{item.clienteNome}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>Contrato #{item.contratoId}</span>
                          {item.clienteCpfCnpj && (
                            <>
                              <span>•</span>
                              <span>{item.clienteCpfCnpj}</span>
                            </>
                          )}
                          {item.valorMensal && (
                            <>
                              <span>•</span>
                              <span className="text-emerald-400 font-medium">R$ {parseFloat(item.valorMensal).toFixed(2)}</span>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {item.clienteTelefone ? (
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <Smartphone className="w-4 h-4 text-emerald-400" />
                            <span>{item.clienteTelefone}</span>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-rose-400 border-rose-500/30 bg-rose-500/10 text-xs">
                            Sem WhatsApp
                          </Badge>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-blue-400" />
                          <span className="font-semibold text-white">
                            {formatDateBR(item.dataFinalCarencia)}
                          </span>
                        </div>
                        {item.dataUltimaCarencia && (
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Concedido em: {formatDateBR(item.dataUltimaCarencia)}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {item.notificado ? (
                          <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 gap-1 py-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Enviado {item.notificadoEm ? `(${item.notificadoEm.split(' ')[0]})` : ''}
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/30 gap-1 py-1">
                            <Clock className="w-3.5 h-3.5" />
                            Pendente
                          </Badge>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedItemForMessage(item)}
                            title="Ver Modelo da Mensagem"
                            className="text-slate-400 hover:text-white"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </Button>

                          {item.clienteTelefone && (
                            <a
                              href={`https://wa.me/${item.clienteTelefone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                generateMessageText(item.clienteNome, item.dataFinalCarencia)
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-slate-400 hover:text-emerald-400 transition-colors"
                              title="Abrir no WhatsApp Web"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}

                          <Button
                            size="sm"
                            disabled={!item.clienteTelefone || sendingIndividual === item.contratoId}
                            onClick={() => handleSendIndividual(item)}
                            className={
                              item.notificado
                                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white font-semibold'
                            }
                          >
                            {sendingIndividual === item.contratoId ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                            ) : (
                              <Send className="w-3.5 h-3.5 mr-1" />
                            )}
                            {item.notificado ? 'Reenviar' : 'Enviar'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Modal: Prévia da Mensagem */}
        <Dialog open={!!selectedItemForMessage} onOpenChange={() => setSelectedItemForMessage(null)}>
          <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold text-white">
                <Smartphone className="w-5 h-5 text-emerald-400" />
                Mensagem WhatsApp (Pré-visualização)
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs">
                Esta é a mensagem que o cliente recebe no celular via Z-API.
              </DialogDescription>
            </DialogHeader>

            {selectedItemForMessage && (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 font-sans text-sm text-slate-200 whitespace-pre-wrap leading-relaxed shadow-inner">
                {generateMessageText(selectedItemForMessage.clienteNome, selectedItemForMessage.dataFinalCarencia)}
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setSelectedItemForMessage(null)}>
                Fechar
              </Button>
              {selectedItemForMessage && (
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold"
                  onClick={() => {
                    handleSendIndividual(selectedItemForMessage);
                    setSelectedItemForMessage(null);
                  }}
                  disabled={!selectedItemForMessage.clienteTelefone}
                >
                  <Send className="w-4 h-4" />
                  Enviar Agora
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal: Conceder Carência Manual */}
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold text-white">
                <Calendar className="w-5 h-5 text-blue-400" />
                Lançar Carência no ISPFY
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs">
                Altera a data de carência do contrato no ISPFY e agenda o aviso no WhatsApp.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-2">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  ID do Contrato no ISPFY
                </label>
                <Input
                  placeholder="Ex: 72 ou 406"
                  value={modalContratoId}
                  onChange={(e) => setModalContratoId(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Data Limite da Carência (YYYY-MM-DD)
                </label>
                <Input
                  type="date"
                  value={modalDataCarencia}
                  onChange={(e) => setModalDataCarencia(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                />
                <div className="flex gap-2 mt-2">
                  {[3, 5, 7, 10].map((days) => {
                    const d = new Date();
                    d.setDate(d.getDate() + days);
                    const iso = d.toISOString().split('T')[0];
                    return (
                      <Button
                        key={days}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setModalDataCarencia(iso)}
                        className={`text-xs h-7 px-2.5 ${
                          modalDataCarencia === iso
                            ? 'bg-blue-600 text-white border-blue-500'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        +{days} dias
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="sendWhatsappCheckbox"
                  checked={modalSendWhatsapp}
                  onChange={(e) => setModalSendWhatsapp(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0"
                />
                <label htmlFor="sendWhatsappCheckbox" className="text-xs text-slate-300 cursor-pointer">
                  Disparar mensagem no WhatsApp automaticamente após salvar
                </label>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                onClick={handleSaveManualCarencia}
                disabled={savingCarencia}
              >
                {savingCarencia ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : null}
                Salvar Carência
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
};

export default ISPFYCarencia;

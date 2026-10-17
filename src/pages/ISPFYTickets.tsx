import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Ticket,
  AlertCircle,
  CheckCircle,
  Search,
  Loader2,
  Clock,
  Database,
  Copy,
  Send,
  ClipboardList,
  Calendar,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import PageTransition from '@/components/PageTransition';
import { ispfyService } from '@/services/ispfy/ispfyService';
import { ISPFYTicketData } from '@/types/ispfy';
import { whapiService, DEFAULT_AVL_WHATSAPP_GROUPS } from '@/services/whapi/whapiService';
import type { WhapiGroup } from '@/types/whapi';
import TicketCard from '@/components/ispfy/TicketCard';
import { useDailyOS } from '@/hooks/useDailyOS';
import { DailyOSModal } from '@/components/ispfy/DailyOSModal';

const ISPFYTickets: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<ISPFYTicketData[]>([]);
  const [ticketsAbertos, setTicketsAbertos] = useState<ISPFYTicketData[]>([]);
  const [searchClienteId, setSearchClienteId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('abertos');
  const [selectedTicket, setSelectedTicket] = useState<ISPFYTicketData | null>(null);

  // Contagem diária de O.S. (Reinicia todo dia)
  const {
    count: dailyCount,
    formattedNextDailyNumber,
    orders: dailyOrders,
    formattedDate,
  } = useDailyOS();
  const [isDailyModalOpen, setIsDailyModalOpen] = useState(false);

  // WhatsApp Groups
  const [whatsappGroups, setWhatsappGroups] = useState<WhapiGroup[]>(DEFAULT_AVL_WHATSAPP_GROUPS);
  const [selectedGroupPhone, setSelectedGroupPhone] = useState('120363426874994471-group');
  const [sendingToGroup, setSendingToGroup] = useState(false);

  useEffect(() => {
    whapiService.getGroups().then((groups) => {
      if (groups && groups.length > 0) {
        setWhatsappGroups(groups);
      }
    }).catch(console.error);
  }, []);

  const formatTicketText = (t: ISPFYTicketData) => {
    return (
      `🛠 *O.S. #${t.id || ''} – Ordem de Serviço*\n` +
      (t.id_cliente ? `Cliente ID: #${t.id_cliente}\n` : '') +
      `📌 *Assunto:* ${t.assunto || 'Sem assunto'}\n` +
      (t.prioridade ? `⚡ *Prioridade:* ${t.prioridade}\n` : '') +
      (t.status ? `📊 *Status:* ${t.status}\n` : '') +
      (t.tecnico ? `👷 *Técnico:* ${t.tecnico}\n` : '') +
      (t.data_abertura ? `📅 *Abertura:* ${t.data_abertura}\n` : '') +
      (t.descricao || t.mensagem ? `📝 *Descrição:* ${t.descricao || t.mensagem}\n` : '')
    );
  };

  const handleCopyTicket = (t: ISPFYTicketData) => {
    navigator.clipboard.writeText(formatTicketText(t))
      .then(() => toast.success('Dados da O.S. copiados!'))
      .catch(() => toast.error('Falha ao copiar dados.'));
  };

  const handleSendTicketToGroup = async (t: ISPFYTicketData) => {
    if (!selectedGroupPhone) {
      toast.warning('Selecione um grupo do WhatsApp.');
      return;
    }
    const target = whatsappGroups.find(g => g.phone === selectedGroupPhone);
    const groupName = target?.name || 'Grupo selecionado';
    setSendingToGroup(true);
    try {
      const res = await whapiService.sendGroupMessage(selectedGroupPhone, formatTicketText(t));
      if (res.sent) {
        toast.success(`O.S. enviada com sucesso para o grupo "${groupName}"!`);
      } else {
        toast.error(`Falha ao enviar para o grupo: ${res.error}`);
      }
    } catch {
      toast.error('Erro ao enviar mensagem.');
    } finally {
      setSendingToGroup(false);
    }
  };

  // Carregar tickets abertos ao montar o componente
  useEffect(() => {
    loadTicketsAbertos();
  }, []);

  const loadTicketsAbertos = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await ispfyService.getTicketsAbertos();
      setTicketsAbertos(result);
    } catch (err) {
      setError('Erro ao carregar tickets abertos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const searchTicketsByCliente = async () => {
    if (!searchClienteId.trim()) {
      setError('Por favor, insira o ID do cliente');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await ispfyService.getTicketsByCliente(searchClienteId);
      setTickets(result);
      setActiveTab('todos');
    } catch (err) {
      setError('Erro ao buscar tickets do cliente');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTicketClick = (ticket: ISPFYTicketData) => {
    setSelectedTicket(ticket);
  };

  // Calcular métricas
  const calcularMetricas = () => {
    const ticketsFechados = ticketsAbertos.filter(t => 
      t.status?.toLowerCase().includes('fechado') || 
      t.status?.toLowerCase().includes('resolvido')
    );

    const ticketsEmAndamento = ticketsAbertos.filter(t => 
      t.status?.toLowerCase().includes('andamento') || 
      t.status?.toLowerCase().includes('progresso')
    );

    return {
      totalAbertos: ticketsAbertos.length - ticketsFechados.length,
      totalFechados: ticketsFechados.length,
      totalEmAndamento: ticketsEmAndamento.length,
    };
  };

  const metricas = calcularMetricas();

  return (
    <PageTransition>
      <div className="space-y-6 text-foreground">
        {/* Header com Breadcrumb */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Database className="w-4 h-4" />
            <span>Sistema ISPFY</span>
            <span>/</span>
            <span className="text-foreground font-medium">Tickets de Suporte</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-md">
                  <Ticket className="w-6 h-6 text-white" />
                </div>
                Tickets de Suporte
              </h1>
              <p className="text-muted-foreground mt-2 text-sm">
                Gerencie chamados e solicitações de suporte com contagem diária de O.S.
              </p>
            </div>
            <Button
              onClick={() => setIsDailyModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 text-xs font-semibold shadow-md shadow-emerald-600/20"
            >
              <ClipboardList className="w-4 h-4" />
              <span>O.S. de Hoje</span>
              <span className="bg-emerald-800 text-emerald-100 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                #{dailyCount}
              </span>
            </Button>
          </div>
        </motion.div>

        {/* Métricas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card
            className="border-emerald-500/30 bg-emerald-500/10 hover:shadow-md transition-all cursor-pointer"
            onClick={() => setIsDailyModalOpen(true)}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">O.S. de Hoje</p>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold px-1.5 py-0.5 rounded">
                      Zera 00h
                    </span>
                  </div>
                  <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                    #{dailyCount}
                  </p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
                    Próxima: #{formattedNextDailyNumber} • Ver lista
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <ClipboardList className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Tickets Abertos</p>
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {metricas.totalAbertos}
                  </p>
                </div>
                <AlertCircle className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Em Andamento</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {metricas.totalEmAndamento}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Resolvidos</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {metricas.totalFechados}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Busca por Cliente */}
        <Card>
          <CardHeader>
            <CardTitle>Buscar Tickets por Cliente</CardTitle>
            <CardDescription>
              Insira o ID do cliente para visualizar seus tickets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="cliente-id">ID do Cliente</Label>
                <Input
                  id="cliente-id"
                  value={searchClienteId}
                  onChange={(e) => setSearchClienteId(e.target.value)}
                  placeholder="Digite o ID do cliente..."
                  onKeyPress={(e) => e.key === 'Enter' && searchTicketsByCliente()}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={searchTicketsByCliente} disabled={loading}>
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Search className="w-4 h-4 mr-2" />
                  )}
                  <span>Buscar</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alertas de Erro */}
        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {/* Lista de Tickets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Lista de Tickets</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="abertos">
                      Abertos ({ticketsAbertos.length})
                    </TabsTrigger>
                    <TabsTrigger value="todos">
                      Todos ({tickets.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="abertos" className="mt-4">
                    {loading ? (
                      <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                          <Skeleton key={i} className="h-32 w-full" />
                        ))}
                      </div>
                    ) : ticketsAbertos.length > 0 ? (
                      <div className="space-y-3">
                        {ticketsAbertos.map((ticket, index) => (
                          <motion.div
                            key={ticket.id || index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                          >
                            <TicketCard
                              ticket={ticket}
                              onClick={() => handleTicketClick(ticket)}
                            />
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Nenhum ticket em aberto</p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="todos" className="mt-4">
                    {tickets.length > 0 ? (
                      <div className="space-y-3">
                        {tickets.map((ticket, index) => (
                          <motion.div
                            key={ticket.id || index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                          >
                            <TicketCard
                              ticket={ticket}
                              onClick={() => handleTicketClick(ticket)}
                            />
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Ticket className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Busque por um cliente para ver seus tickets</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Detalhes do Ticket Selecionado */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Detalhes do Ticket</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedTicket ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Assunto</Label>
                      <p className="text-foreground mt-1 font-semibold">
                        {selectedTicket.assunto || 'Não informado'}
                      </p>
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Descrição</Label>
                      <p className="text-foreground mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                        {selectedTicket.descricao || 'Sem descrição'}
                      </p>
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                      <p className="text-foreground mt-1 font-medium">
                        {selectedTicket.status || 'Não informado'}
                      </p>
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Prioridade</Label>
                      <p className="text-foreground mt-1 font-medium">
                        {selectedTicket.prioridade || 'Não informado'}
                      </p>
                    </div>

                    {selectedTicket.tecnico && (
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Técnico Responsável</Label>
                        <p className="text-foreground mt-1 font-medium">{selectedTicket.tecnico}</p>
                      </div>
                    )}

                    {selectedTicket.tipo && (
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Tipo</Label>
                        <p className="text-foreground mt-1 font-medium">{selectedTicket.tipo}</p>
                      </div>
                    )}

                    {/* Ações: Enviar Grupo WhatsApp & Copiar */}
                    <div className="pt-4 border-t border-border space-y-3">
                      <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                            Enviar para Grupo WhatsApp
                          </Label>
                          <span className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded font-medium">
                            {whatsappGroups.length} grupos
                          </span>
                        </div>

                        <Select
                          value={selectedGroupPhone}
                          onValueChange={setSelectedGroupPhone}
                        >
                          <SelectTrigger className="w-full bg-background border-input text-foreground h-9 text-xs focus:ring-emerald-500">
                            <SelectValue placeholder="Selecione o grupo..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-56 bg-popover border-border text-popover-foreground z-50">
                            {whatsappGroups.map((g) => (
                              <SelectItem key={g.phone} value={g.phone} className="text-xs focus:bg-emerald-500/20 focus:text-emerald-700 dark:focus:text-emerald-300">
                                👥 {g.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button
                          size="sm"
                          onClick={() => handleSendTicketToGroup(selectedTicket)}
                          disabled={sendingToGroup || !selectedGroupPhone}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 gap-1.5"
                        >
                          {sendingToGroup ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          Enviar O.S. para o Grupo
                        </Button>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyTicket(selectedTicket)}
                        className="w-full text-xs h-9 border-border bg-secondary hover:bg-secondary/80 text-foreground gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copiar Informações da O.S.
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Ticket className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Selecione um ticket para ver os detalhes</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Modal de O.S. Segmentadas de Hoje (Contagem Diária) */}
        <DailyOSModal
          open={isDailyModalOpen}
          onOpenChange={setIsDailyModalOpen}
          orders={dailyOrders}
          formattedDate={formattedDate}
          totalCount={dailyCount}
        />
      </div>
    </PageTransition>
  );
};

export default ISPFYTickets;

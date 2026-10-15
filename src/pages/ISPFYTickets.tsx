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

const ISPFYTickets: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<ISPFYTicketData[]>([]);
  const [ticketsAbertos, setTicketsAbertos] = useState<ISPFYTicketData[]>([]);
  const [searchClienteId, setSearchClienteId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('abertos');
  const [selectedTicket, setSelectedTicket] = useState<ISPFYTicketData | null>(null);

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
      <div className="flex flex-col gap-6 p-6 bg-gray-50 min-h-screen">
        {/* Header com Breadcrumb */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Database className="w-4 h-4" />
            <span>Sistema ISPFY</span>
            <span>/</span>
            <span className="text-gray-900 font-medium">Tickets de Suporte</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                  <Ticket className="w-6 h-6 text-white" />
                </div>
                Tickets de Suporte
              </h1>
              <p className="text-gray-600 mt-2">
                Gerencie chamados e solicitações de suporte
              </p>
            </div>
          </div>
        </motion.div>

        {/* Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Tickets Abertos</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {metricas.totalAbertos}
                  </p>
                </div>
                <AlertCircle className="w-8 h-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Em Andamento</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {metricas.totalEmAndamento}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Resolvidos</p>
                  <p className="text-2xl font-bold text-green-600">
                    {metricas.totalFechados}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
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
                      <Label className="text-sm font-medium text-gray-600">Assunto</Label>
                      <p className="text-gray-900 mt-1">
                        {selectedTicket.assunto || 'Não informado'}
                      </p>
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-gray-600">Descrição</Label>
                      <p className="text-gray-900 mt-1 whitespace-pre-wrap">
                        {selectedTicket.descricao || 'Sem descrição'}
                      </p>
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-gray-600">Status</Label>
                      <p className="text-gray-900 mt-1">
                        {selectedTicket.status || 'Não informado'}
                      </p>
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-gray-600">Prioridade</Label>
                      <p className="text-gray-900 mt-1">
                        {selectedTicket.prioridade || 'Não informado'}
                      </p>
                    </div>

                    {selectedTicket.tecnico && (
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Técnico Responsável</Label>
                        <p className="text-gray-900 mt-1">{selectedTicket.tecnico}</p>
                      </div>
                    )}

                    {selectedTicket.tipo && (
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Tipo</Label>
                        <p className="text-gray-900 mt-1">{selectedTicket.tipo}</p>
                      </div>
                    )}

                    {/* Ações: Enviar Grupo WhatsApp & Copiar */}
                    <div className="pt-4 border-t border-gray-100 space-y-3">
                      <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold text-emerald-800">
                            Enviar para Grupo WhatsApp
                          </Label>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-medium">
                            {whatsappGroups.length} grupos
                          </span>
                        </div>

                        <Select
                          value={selectedGroupPhone}
                          onValueChange={setSelectedGroupPhone}
                        >
                          <SelectTrigger className="w-full bg-white border-emerald-200 h-9 text-xs">
                            <SelectValue placeholder="Selecione o grupo..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-56 bg-white border-gray-200 z-50">
                            {whatsappGroups.map((g) => (
                              <SelectItem key={g.phone} value={g.phone} className="text-xs">
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
                        className="w-full text-xs h-9 border-gray-300 text-gray-700 hover:bg-gray-50 gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copiar Informações da O.S.
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Ticket className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Selecione um ticket para ver os detalhes</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

export default ISPFYTickets;

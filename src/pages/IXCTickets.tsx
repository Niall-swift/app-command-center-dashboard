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
} from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import { ixcService } from '@/services/ixc/ixcService';
import { IXCTicketData } from '@/types/ixc';
import TicketCard from '@/components/ixc/TicketCard';

const IXCTickets: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<IXCTicketData[]>([]);
  const [ticketsAbertos, setTicketsAbertos] = useState<IXCTicketData[]>([]);
  const [searchClienteId, setSearchClienteId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('abertos');
  const [selectedTicket, setSelectedTicket] = useState<IXCTicketData | null>(null);

  // Carregar tickets abertos ao montar o componente
  useEffect(() => {
    loadTicketsAbertos();
  }, []);

  const loadTicketsAbertos = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await ixcService.getTicketsAbertos();
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
      const result = await ixcService.getTicketsByCliente(searchClienteId);
      setTickets(result);
      setActiveTab('todos');
    } catch (err) {
      setError('Erro ao buscar tickets do cliente');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTicketClick = (ticket: IXCTicketData) => {
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
            <span>Sistema IXC</span>
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
                  Buscar
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

export default IXCTickets;

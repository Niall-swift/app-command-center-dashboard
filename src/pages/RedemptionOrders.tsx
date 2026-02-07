import React, { useState, useEffect } from 'react';
import PageTransition from '@/components/PageTransition';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Send, 
  Search, 
  User, 
  Calendar,
  CreditCard,
  Gift
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/use-toast';
import { redemptionsService } from '@/services/redemptionsService';
import { RedeemedReward } from '@/types/rewards';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function RedemptionOrders() {
  const { toast } = useToast();
  const [redemptions, setRedemptions] = useState<RedeemedReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRedemption, setSelectedRedemption] = useState<RedeemedReward | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('pending');

  // Carregar resgates
  const fetchRedemptions = async () => {
    setLoading(true);
    try {
      const data = await redemptionsService.getAllRedemptions();
      setRedemptions(data);
    } catch (error) {
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar os pedidos.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRedemptions();
  }, []);

  // Alterar status
  const handleStatusChange = async (id: string, newStatus: 'approved' | 'applied' | 'expired') => {
    try {
      await redemptionsService.updateStatus(id, newStatus);
      toast({
        title: 'Status atualizado',
        description: `O pedido foi marcado como ${
          newStatus === 'approved' ? 'Aprovado' : 
          newStatus === 'applied' ? 'Aplicado' : 'Expirado'
        }.`,
      });
      setIsDialogOpen(false);
      fetchRedemptions();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o status.',
        variant: 'destructive',
      });
    }
  };

  // Filtrar resgates
  const filteredRedemptions = redemptions.filter(r => {
    const matchesSearch = 
      r.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.rewardName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.code.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === 'all') return matchesSearch;
    return matchesSearch && r.status === activeTab;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">Pendente</Badge>;
      case 'approved': return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">Aprovado</Badge>;
      case 'applied': return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">Aplicado</Badge>;
      case 'expired': return <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200">Expirado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (date: any) => {
    if (!date) return '-';
    try {
      // Se for Firestore Timestamp
      const d = date.toDate ? date.toDate() : new Date(date);
      return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch (e) {
      return 'Data inválida';
    }
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pedidos de Resgate</h1>
          <p className="text-gray-600">Gerencie as solicitações de troca de pontos</p>
        </div>

        {/* Busca */}
        <div className="bg-white p-4 rounded-lg shadow-sm border flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Buscar por usuário, prêmio ou código..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Abas e Lista */}
        <Tabs defaultValue="pending" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 lg:w-[600px]">
            <TabsTrigger value="pending">Pendentes</TabsTrigger>
            <TabsTrigger value="approved">Aprovados</TabsTrigger>
            <TabsTrigger value="applied">Aplicados</TabsTrigger>
            <TabsTrigger value="expired">Expirados</TabsTrigger>
            <TabsTrigger value="all">Todos</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  {activeTab === 'pending' ? 'Solicitações Pendentes' :
                   activeTab === 'approved' ? 'Solicitações Aprovadas' :
                   activeTab === 'applied' ? 'Recompensas Aplicadas' :
                   activeTab === 'expired' ? 'Solicitações Expiradas' : 'Todos os Pedidos'}
                </CardTitle>
                <CardDescription>
                  {filteredRedemptions.length} pedidos encontrados
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-10">Carregando...</div>
                ) : filteredRedemptions.length === 0 ? (
                  <div className="text-center py-10 text-gray-500">
                    Nenhum pedido encontrado nesta categoria.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredRedemptions.map((redemption) => (
                      <div 
                        key={redemption.id} 
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedRedemption(redemption);
                          setIsDialogOpen(true);
                        }}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                            redemption.status === 'pending' ? 'bg-yellow-100 text-yellow-600' :
                            redemption.status === 'approved' ? 'bg-blue-100 text-blue-600' :
                            redemption.status === 'applied' ? 'bg-green-100 text-green-600' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {redemption.status === 'pending' ? <Clock size={20} /> :
                             redemption.status === 'approved' ? <CheckCircle size={20} /> :
                             redemption.status === 'applied' ? <Gift size={20} /> :
                             <XCircle size={20} />}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{redemption.rewardName}</p>
                            <p className="text-sm text-gray-600 flex items-center gap-1">
                              <User size={12} /> {redemption.userName || 'Usuário desconhecido'}
                              <span className="text-gray-300 mx-1">•</span>
                              <CreditCard size={12} /> {redemption.pointsSpent} pts
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {getStatusBadge(redemption.status)}
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Calendar size={10} /> {formatDate(redemption.redeemedAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modal de Detalhes */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Detalhes do Pedido</DialogTitle>
              <DialogDescription>
                Informações completas sobre a solicitação de resgate.
              </DialogDescription>
            </DialogHeader>

            {selectedRedemption && (
              <div className="grid gap-6 py-4">
                {/* Status e Código */}
                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Status Atual</p>
                    {getStatusBadge(selectedRedemption.status)}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500 mb-1">Código de Resgate</p>
                    <p className="font-mono font-bold text-lg text-gray-900 tracking-wider">
                      {selectedRedemption.code}
                    </p>
                  </div>
                </div>

                {/* Detalhes do Usuário */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <User size={16} className="text-purple-600" />
                      Usuário
                    </h4>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-gray-500">Nome:</span> {selectedRedemption.userName || '-'}</p>
                      <p><span className="text-gray-500">Email:</span> {selectedRedemption.userEmail || '-'}</p>
                      <p><span className="text-gray-500">ID:</span> {selectedRedemption.userId}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Gift size={16} className="text-purple-600" />
                      Recompensa
                    </h4>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-gray-500">Item:</span> {selectedRedemption.rewardName}</p>
                      <p><span className="text-gray-500">Custo:</span> {selectedRedemption.pointsSpent} pontos</p>
                      <p><span className="text-gray-500">Data:</span> {formatDate(selectedRedemption.redeemedAt)}</p>
                    </div>
                  </div>
                </div>

                {/* Ações */}
                <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between mt-4 border-t pt-4">
                  <div className="flex gap-2">
                    {selectedRedemption.status === 'pending' && (
                      <Button 
                        variant="destructive" 
                        onClick={() => handleStatusChange(selectedRedemption.id, 'expired')}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Rejeitar
                      </Button>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Fechar
                    </Button>
                    
                    {selectedRedemption.status === 'pending' && (
                      <Button 
                        className="bg-blue-600 hover:bg-blue-700" 
                        onClick={() => handleStatusChange(selectedRedemption.id, 'approved')}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Aprovar
                      </Button>
                    )}
                    
                    {selectedRedemption.status === 'approved' && (
                      <Button 
                        className="bg-green-600 hover:bg-green-700" 
                        onClick={() => handleStatusChange(selectedRedemption.id, 'applied')}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Marcar como Aplicado
                      </Button>
                    )}
                  </div>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
}

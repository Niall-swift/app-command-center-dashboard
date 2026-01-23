import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Wrench, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Filter, 
  MessageCircle, 
  Plus, 
  MapPin,
  User,
  Phone,
  AlertTriangle
} from 'lucide-react';
import { motion } from 'framer-motion';
import PageTransition from '@/components/PageTransition';

interface TechnicalCall {
  id: string;
  clientName: string;
  clientPhone: string;
  address: string;
  problemDescription: string;
  status: 'pending' | 'in-progress' | 'resolved' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: Date;
  assignedTechnician?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export default function TechnicalSupport() {
  const [calls, setCalls] = useState<TechnicalCall[]>([
    {
      id: '1',
      clientName: 'João Silva',
      clientPhone: '(11) 99999-9999',
      address: 'Rua das Flores, 123 - São Paulo, SP',
      problemDescription: 'Internet sem sinal há 2 horas, modem piscando vermelho',
      status: 'pending',
      priority: 'high',
      createdAt: new Date(Date.now() - 3600000),
      coordinates: { lat: -23.550520, lng: -46.633308 }
    },
    {
      id: '2',
      clientName: 'Maria Santos',
      clientPhone: '(21) 88888-8888',
      address: 'Av. Copacabana, 456 - Rio de Janeiro, RJ',
      problemDescription: 'Velocidade muito baixa, não consegue fazer videochamadas',
      status: 'in-progress',
      priority: 'medium',
      createdAt: new Date(Date.now() - 7200000),
      assignedTechnician: 'Carlos Técnico',
      coordinates: { lat: -22.906847, lng: -43.172896 }
    },
    {
      id: '3',
      clientName: 'Pedro Costa',
      clientPhone: '(31) 77777-7777',
      address: 'Rua Minas Gerais, 789 - Belo Horizonte, MG',
      problemDescription: 'Roteador não liga após queda de energia',
      status: 'resolved',
      priority: 'low',
      createdAt: new Date(Date.now() - 86400000),
      assignedTechnician: 'Ana Técnica',
      coordinates: { lat: -19.916681, lng: -43.934493 }
    }
  ]);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isNewCallOpen, setIsNewCallOpen] = useState(false);
  const [newCall, setNewCall] = useState({
    clientName: '',
    clientPhone: '',
    address: '',
    problemDescription: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent'
  });
  const { toast } = useToast();

  // ID do grupo de técnicos no WhatsApp (formato: groupid@g.us ou link de convite)
  const techniciansGroupId = 'CHAT_GROUP_ID_HERE'; // Substitua pelo ID real do grupo

  const handleStatusChange = (callId: string, newStatus: TechnicalCall['status']) => {
    setCalls(calls.map(call => 
      call.id === callId ? { ...call, status: newStatus } : call
    ));
    
    toast({
      title: "Status atualizado",
      description: `Chamado ${newStatus === 'resolved' ? 'resolvido' : 'atualizado'} com sucesso`,
    });
  };

  const handleSendToWhatsAppGroup = (call: TechnicalCall) => {
    const mapsUrl = call.coordinates 
      ? `https://maps.google.com/maps?q=${call.coordinates.lat},${call.coordinates.lng}`
      : `https://maps.google.com/maps?q=${encodeURIComponent(call.address)}`;

    const message = `🔧 *CHAMADO TÉCNICO - NOVO*

👤 *Cliente:* ${call.clientName}
📞 *Telefone:* ${call.clientPhone}
📍 *Endereço:* ${call.address}

⚠️ *Problema:*
${call.problemDescription}

🗺️ *Localização no Maps:*
${mapsUrl}

🔴 *Prioridade:* ${call.priority === 'urgent' ? 'URGENTE' : 
                   call.priority === 'high' ? 'Alta' :
                   call.priority === 'medium' ? 'Média' : 'Baixa'}

📋 *ID do Chamado:* ${call.id}

⏰ *Horário:* ${call.createdAt.toLocaleDateString('pt-BR')} às ${call.createdAt.toLocaleTimeString('pt-BR')}`;

    // Para grupo, use o link de convite do grupo ou o chat://group_id
    const whatsappGroupUrl = `https://chat.whatsapp.com/${techniciansGroupId}?text=${encodeURIComponent(message)}`;
    window.open(whatsappGroupUrl, '_blank');
    
    toast({
      title: "Enviado para grupo de técnicos",
      description: "Chamado encaminhado para o grupo de técnicos no WhatsApp",
    });
  };

  const handleCreateCall = () => {
    if (!newCall.clientName || !newCall.clientPhone || !newCall.address || !newCall.problemDescription) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    const call: TechnicalCall = {
      id: (calls.length + 1).toString(),
      ...newCall,
      status: 'pending',
      createdAt: new Date(),
    };

    setCalls([call, ...calls]);
    setNewCall({
      clientName: '',
      clientPhone: '',
      address: '',
      problemDescription: '',
      priority: 'medium'
    });
    setIsNewCallOpen(false);

    toast({
      title: "Chamado criado",
      description: "Novo chamado técnico registrado com sucesso",
    });
  };

  const filteredCalls = calls.filter(call => 
    statusFilter === 'all' || call.status === statusFilter
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'in-progress':
        return <Wrench className="w-4 h-4 text-blue-600" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'in-progress':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500 text-white';
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendente';
      case 'in-progress':
        return 'Em Andamento';
      case 'resolved':
        return 'Resolvido';
      case 'cancelled':
        return 'Cancelado';
      default:
        return status;
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'Urgente';
      case 'high':
        return 'Alta';
      case 'medium':
        return 'Média';
      case 'low':
        return 'Baixa';
      default:
        return priority;
    }
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Suporte Técnico</h2>
            <p className="text-gray-600">Gerencie chamados técnicos e ordens de serviço</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="in-progress">Em Andamento</SelectItem>
                  <SelectItem value="resolved">Resolvido</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Dialog open={isNewCallOpen} onOpenChange={setIsNewCallOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Chamado
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Criar Novo Chamado</DialogTitle>
                  <DialogDescription>
                    Registre um novo chamado técnico
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="clientName">Nome do Cliente *</Label>
                    <Input
                      id="clientName"
                      value={newCall.clientName}
                      onChange={(e) => setNewCall({...newCall, clientName: e.target.value})}
                      placeholder="Digite o nome do cliente"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="clientPhone">Telefone *</Label>
                    <Input
                      id="clientPhone"
                      value={newCall.clientPhone}
                      onChange={(e) => setNewCall({...newCall, clientPhone: e.target.value})}
                      placeholder="(11) 99999-9999"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Endereço *</Label>
                    <Input
                      id="address"
                      value={newCall.address}
                      onChange={(e) => setNewCall({...newCall, address: e.target.value})}
                      placeholder="Endereço completo"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priority">Prioridade</Label>
                    <Select value={newCall.priority} onValueChange={(value: string) => setNewCall({...newCall, priority: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baixa</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="urgent">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="problemDescription">Descrição do Problema *</Label>
                    <Textarea
                      id="problemDescription"
                      value={newCall.problemDescription}
                      onChange={(e) => setNewCall({...newCall, problemDescription: e.target.value})}
                      placeholder="Descreva detalhadamente o problema"
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setIsNewCallOpen(false)}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleCreateCall}
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                      Criar Chamado
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid gap-6">
          {filteredCalls.map((call, index) => (
            <motion.div
              key={call.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Card className="bg-white shadow-sm hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <User className="w-5 h-5 text-blue-600" />
                        {call.clientName}
                        <span className="text-sm text-gray-500">#{call.id}</span>
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={getPriorityColor(call.priority)}>
                          {call.priority === 'urgent' && <AlertTriangle className="w-3 h-3 mr-1" />}
                          {getPriorityText(call.priority)}
                        </Badge>
                        <Badge className={getStatusColor(call.status)} variant="outline">
                          <div className="flex items-center gap-1">
                            {getStatusIcon(call.status)}
                            {getStatusText(call.status)}
                          </div>
                        </Badge>
                        {call.assignedTechnician && (
                          <Badge variant="secondary">
                            Técnico: {call.assignedTechnician}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="w-4 h-4" />
                      {call.clientPhone}
                    </div>
                    
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <MapPin className="w-4 h-4 mt-0.5" />
                      {call.address}
                    </div>

                    <div className="bg-gray-50 p-3 rounded-lg">
                      <h4 className="font-medium text-sm mb-1">Problema relatado:</h4>
                      <p className="text-sm text-gray-700">{call.problemDescription}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-4">
                    <div>
                      <p className="text-sm text-gray-400">
                        Criado em: {call.createdAt.toLocaleDateString('pt-BR')} às {call.createdAt.toLocaleTimeString('pt-BR')}
                      </p>
                    </div>
                    
                    <div className="flex gap-2 items-center flex-wrap">
                      <Button
                        onClick={() => handleSendToWhatsAppGroup(call)}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <MessageCircle className="w-4 h-4 mr-1" />
                        Enviar p/ Grupo
                      </Button>
                      
                      {call.status === 'pending' && (
                        <Button
                          onClick={() => handleStatusChange(call.id, 'in-progress')}
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Wrench className="w-4 h-4 mr-1" />
                          Iniciar
                        </Button>
                      )}
                      
                      {call.status === 'in-progress' && (
                        <Button
                          onClick={() => handleStatusChange(call.id, 'resolved')}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Resolver
                        </Button>
                      )}
                      
                      {(call.status === 'pending' || call.status === 'in-progress') && (
                        <Button
                          onClick={() => handleStatusChange(call.id, 'cancelled')}
                          size="sm"
                          variant="destructive"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {filteredCalls.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <Wrench className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum chamado encontrado</h3>
            <p className="text-gray-500">
              {statusFilter === 'all' 
                ? 'Não há chamados técnicos no momento.' 
                : `Não há chamados com status "${getStatusText(statusFilter)}".`
              }
            </p>
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
}

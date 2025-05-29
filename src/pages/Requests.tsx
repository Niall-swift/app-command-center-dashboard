import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, XCircle, Clock, Filter, MessageCircle, Eye } from 'lucide-react';
import UserDetailsModal from '@/components/UserDetailsModal';
import IXCSoftPreRegistration from '@/components/IXCSoftPreRegistration';
import type { Request } from '@/types/dashboard';

export default function Requests() {
  const [requests, setRequests] = useState<Request[]>([
    {
      id: '1',
      title: 'Solicitação de nova funcionalidade',
      description: 'Gostaria de solicitar a implementação de notificações push no aplicativo',
      status: 'pending',
      user: 'João Silva',
      createdAt: new Date(Date.now() - 86400000),
      priority: 'high',
      userDetails: {
        name: 'João Silva',
        email: 'joao.silva@email.com',
        phone: '(11) 99999-9999',
        cpf: '123.456.789-00',
        cep: '01234-567',
        address: 'Rua das Flores, 123',
        city: 'São Paulo',
        state: 'SP'
      }
    },
    {
      id: '2',
      title: 'Relatório de bug',
      description: 'O botão de login não está funcionando no iOS',
      status: 'approved',
      user: 'Maria Santos',
      createdAt: new Date(Date.now() - 172800000),
      priority: 'medium',
      userDetails: {
        name: 'Maria Santos',
        email: 'maria.santos@email.com',
        phone: '(21) 88888-8888',
        cpf: '987.654.321-00',
        cep: '20000-000',
        address: 'Av. Copacabana, 456',
        city: 'Rio de Janeiro',
        state: 'RJ'
      }
    },
    {
      id: '3',
      title: 'Solicitação de suporte',
      description: 'Preciso de ajuda para configurar minha conta',
      status: 'rejected',
      user: 'Pedro Costa',
      createdAt: new Date(Date.now() - 259200000),
      priority: 'low',
      userDetails: {
        name: 'Pedro Costa',
        email: 'pedro.costa@email.com',
        phone: '(31) 77777-7777',
        cpf: '456.789.123-00',
        cep: '30000-000',
        address: 'Rua Minas Gerais, 789',
        city: 'Belo Horizonte',
        state: 'MG'
      }
    }
  ]);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<Request | null>(null);

  const handleStatusChange = (requestId: string, newStatus: 'approved' | 'rejected') => {
    setRequests(requests.map(req => 
      req.id === requestId ? { ...req, status: newStatus } : req
    ));
  };

  const handleWhatsAppClick = (phone: string) => {
    const phoneNumber = phone.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/55${phoneNumber}`;
    window.open(whatsappUrl, '_blank');
  };

  const filteredRequests = requests.filter(req => 
    statusFilter === 'all' || req.status === statusFilter
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Solicitações</h2>
          <p className="text-gray-600">Gerencie todas as solicitações dos usuários</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="approved">Aprovado</SelectItem>
              <SelectItem value="rejected">Rejeitado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6">
        {filteredRequests.map((request) => (
          <Card key={request.id} className="bg-white shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg font-semibold text-gray-900">
                    {request.title}
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={getPriorityColor(request.priority)}>
                      {request.priority === 'high' ? 'Alta' : 
                       request.priority === 'medium' ? 'Média' : 'Baixa'}
                    </Badge>
                    <Badge className={getStatusColor(request.status)} variant="outline">
                      <div className="flex items-center gap-1">
                        {getStatusIcon(request.status)}
                        {request.status === 'pending' ? 'Pendente' :
                         request.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                      </div>
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">{request.description}</p>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">
                    Por: <span className="font-medium">{request.user}</span>
                  </p>
                  <p className="text-sm text-gray-400">
                    {request.createdAt.toLocaleDateString('pt-BR')}
                  </p>
                </div>
                
                <div className="flex gap-2 items-center flex-wrap">
                  <Button
                    onClick={() => handleWhatsAppClick(request.userDetails.phone)}
                    size="sm"
                    variant="outline"
                    className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                  >
                    <MessageCircle className="w-4 h-4 mr-1" />
                    WhatsApp
                  </Button>
                  
                  <Button
                    onClick={() => setSelectedUser(request)}
                    size="sm"
                    variant="outline"
                    className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Detalhes
                  </Button>

                  <IXCSoftPreRegistration 
                    userDetails={request.userDetails}
                    requestId={request.id}
                  />
                  
                  {request.status === 'pending' && (
                    <>
                      <Button
                        onClick={() => handleStatusChange(request.id, 'approved')}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Aprovar
                      </Button>
                      <Button
                        onClick={() => handleStatusChange(request.id, 'rejected')}
                        size="sm"
                        variant="destructive"
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Rejeitar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedUser && (
        <UserDetailsModal
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          userDetails={selectedUser.userDetails}
        />
      )}
    </div>
  );
}

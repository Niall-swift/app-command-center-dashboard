import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, Calendar, User, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { ixcService } from '@/services/ixc/ixcService';
import { IXCTicketData } from '@/types/ixc';
import { format } from 'date-fns';

interface ClientTicketsProps {
  idCliente: string;
}

export const ClientTickets: React.FC<ClientTicketsProps> = ({ idCliente }) => {
  const [tickets, setTickets] = useState<IXCTicketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (idCliente) {
      fetchTickets();
    }
  }, [idCliente]);

  const fetchTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ixcService.getTicketsByCliente(idCliente);
      setTickets(data);
    } catch (err) {
      setError('Erro ao carregar chamados.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string | undefined) => {
    switch (status) {
      case 'A': // Aberto
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200"><Clock className="w-3 h-3 mr-1"/> Aberto</Badge>;
      case 'F': // Fechado / Finalizado
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-200"><CheckCircle2 className="w-3 h-3 mr-1"/> Finalizado</Badge>;
      case 'E': // Execução / Em andamento
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200"><Clock className="w-3 h-3 mr-1"/> Em Andamento</Badge>;
      case 'C': // Cancelado
        return <Badge variant="destructive">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityColor = (priority: string | undefined) => {
    switch (priority) {
      case 'C': return 'text-red-600 font-bold';
      case 'A': return 'text-orange-600 font-medium';
      case 'B': return 'text-gray-500';
      default: return 'text-gray-700';
    }
  };

  const getPriorityLabel = (priority: string | undefined) => {
    switch (priority) {
      case 'C': return 'Crítica';
      case 'A': return 'Alta';
      case 'M': // Médio/Normal varia
      case 'N': return 'Normal';
      case 'B': return 'Baixa';
      default: return priority || 'Normal';
    }
  };

  if (loading) return <Skeleton className="h-32 w-full" />;
  if (error) return <div className="text-red-500 text-sm">{error}</div>;

  if (tickets.length === 0) {
    return (
      <Card className="bg-gray-50 border-dashed">
        <CardContent className="pt-6 text-center text-gray-500">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Nenhum chamado encontrado para este cliente.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-purple-600" />
          Histórico de Chamados
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
        {tickets.map((ticket) => (
          <div 
            key={ticket.id} 
            className="flex flex-col p-3 border rounded-lg bg-white gap-2 hover:bg-gray-50 transition-colors"
          >
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="font-medium text-gray-900 line-clamp-1">
                  {ticket.assunto || `Chamado #${ticket.id}`}
                </span>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {ticket.data_abertura ? format(new Date(ticket.data_abertura), 'dd/MM/yyyy HH:mm') : '-'}
                  </span>
                  {ticket.tecnico && (
                    <span className="flex items-center gap-1" title="Técnico Responsável">
                      <User className="w-3 h-3" />
                      {ticket.tecnico}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {getStatusBadge(ticket.status)}
                <span className={`text-xs ${getPriorityColor(ticket.prioridade)}`}>
                  Prioridade: {getPriorityLabel(ticket.prioridade)}
                </span>
              </div>
            </div>
            
            {ticket.mensagem && (
              <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded line-clamp-2">
                {ticket.mensagem}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

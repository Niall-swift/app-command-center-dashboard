import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, User, AlertCircle } from 'lucide-react';
import { IXCTicketData } from '@/types/ixc';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TicketCardProps {
  ticket: IXCTicketData;
  onClick?: () => void;
}

export const TicketCard: React.FC<TicketCardProps> = ({ ticket, onClick }) => {
  // Determinar cor da prioridade
  const getPrioridadeColor = (prioridade?: string) => {
    if (!prioridade) return 'bg-gray-100 text-gray-800';
    
    const p = prioridade.toLowerCase();
    if (p.includes('alta') || p.includes('urgente')) {
      return 'bg-red-100 text-red-800';
    }
    if (p.includes('média') || p.includes('normal')) {
      return 'bg-yellow-100 text-yellow-800';
    }
    return 'bg-blue-100 text-blue-800';
  };

  // Determinar cor do status
  const getStatusColor = (status?: string) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    
    const s = status.toLowerCase();
    if (s.includes('aberto') || s.includes('pendente')) {
      return 'bg-yellow-100 text-yellow-800';
    }
    if (s.includes('andamento') || s.includes('progresso')) {
      return 'bg-blue-100 text-blue-800';
    }
    if (s.includes('fechado') || s.includes('resolvido') || s.includes('concluído')) {
      return 'bg-green-100 text-green-800';
    }
    if (s.includes('cancelado')) {
      return 'bg-red-100 text-red-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  // Formatar data
  const formatarData = (data?: string) => {
    if (!data) return 'Não informado';
    try {
      return format(new Date(data), 'dd/MM/yyyy HH:mm', { locale: ptBR });
    } catch {
      return data;
    }
  };

  // Calcular tempo desde abertura
  const getTempoAbertura = (data?: string) => {
    if (!data) return null;
    try {
      return formatDistanceToNow(new Date(data), { 
        addSuffix: true, 
        locale: ptBR 
      });
    } catch {
      return null;
    }
  };

  const tempoAbertura = getTempoAbertura(ticket.data_abertura);

  return (
    <Card 
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900">
                {ticket.assunto || `Ticket #${ticket.id}`}
              </h3>
            </div>
            {ticket.descricao && (
              <p className="text-sm text-gray-600 line-clamp-2">
                {ticket.descricao}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {ticket.status && (
            <Badge className={getStatusColor(ticket.status)}>
              {ticket.status}
            </Badge>
          )}
          {ticket.prioridade && (
            <Badge className={getPrioridadeColor(ticket.prioridade)}>
              <AlertCircle className="w-3 h-3 mr-1" />
              {ticket.prioridade}
            </Badge>
          )}
          {ticket.tipo && (
            <Badge variant="outline">
              {ticket.tipo}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <div>
              <p className="text-gray-600">Abertura</p>
              <p className="font-medium text-gray-900">
                {formatarData(ticket.data_abertura)}
              </p>
              {tempoAbertura && (
                <p className="text-xs text-gray-500">{tempoAbertura}</p>
              )}
            </div>
          </div>

          {ticket.tecnico && (
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-gray-600">Técnico</p>
                <p className="font-medium text-gray-900">
                  {ticket.tecnico}
                </p>
              </div>
            </div>
          )}
        </div>

        {ticket.data_fechamento && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-green-600" />
              <div>
                <p className="text-gray-600">Fechamento</p>
                <p className="font-medium text-gray-900">
                  {formatarData(ticket.data_fechamento)}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TicketCard;

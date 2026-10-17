import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, User, AlertCircle } from 'lucide-react';
import { ISPFYTicketData } from '@/types/ispfy';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TicketCardProps {
  ticket: ISPFYTicketData;
  onClick?: () => void;
}

export const TicketCard: React.FC<TicketCardProps> = ({ ticket, onClick }) => {
  // Determinar cor da prioridade
  const getPrioridadeColor = (prioridade?: string) => {
    if (!prioridade) return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    
    const p = prioridade.toLowerCase();
    if (p.includes('alta') || p.includes('urgente')) {
      return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30';
    }
    if (p.includes('média') || p.includes('normal')) {
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30';
    }
    return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30';
  };

  // Determinar cor do status
  const getStatusColor = (status?: string) => {
    if (!status) return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
    
    const s = status.toLowerCase();
    if (s.includes('aberto') || s.includes('pendente')) {
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30';
    }
    if (s.includes('andamento') || s.includes('progresso')) {
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30';
    }
    if (s.includes('fechado') || s.includes('resolvido') || s.includes('concluído')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30';
    }
    if (s.includes('cancelado')) {
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30';
    }
    return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
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
      className="hover:shadow-md hover:border-primary/40 transition-all cursor-pointer bg-card border-border/80"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-foreground text-base tracking-tight">
                {ticket.assunto || `Ticket #${ticket.id}`}
              </h3>
            </div>
            {ticket.descricao && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {ticket.descricao}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {ticket.status && (
            <Badge className={`border ${getStatusColor(ticket.status)} font-medium`}>
              {ticket.status}
            </Badge>
          )}
          {ticket.prioridade && (
            <Badge className={`border ${getPrioridadeColor(ticket.prioridade)} font-medium`}>
              <AlertCircle className="w-3 h-3 mr-1" />
              {ticket.prioridade}
            </Badge>
          )}
          {ticket.tipo && (
            <Badge variant="outline" className="border-border text-muted-foreground font-medium">
              {ticket.tipo}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground font-medium">Abertura</p>
              <p className="font-semibold text-foreground text-xs sm:text-sm">
                {formatarData(ticket.data_abertura)}
              </p>
              {tempoAbertura && (
                <p className="text-[11px] text-muted-foreground/80">{tempoAbertura}</p>
              )}
            </div>
          </div>

          {ticket.tecnico && (
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground font-medium">Técnico</p>
                <p className="font-semibold text-foreground text-xs sm:text-sm">
                  {ticket.tecnico}
                </p>
              </div>
            </div>
          )}
        </div>

        {ticket.data_fechamento && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-emerald-500" />
              <div>
                <p className="text-xs text-muted-foreground font-medium">Fechamento</p>
                <p className="font-semibold text-foreground text-xs sm:text-sm">
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

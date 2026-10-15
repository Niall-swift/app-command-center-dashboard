import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ClipboardList,
  Search,
  Calendar,
  Clock,
  Send,
  Copy,
  User,
  Phone,
  Tag,
  Wifi,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import type { DailyOSOrder } from '@/types/ispfy';
import { whapiService, DEFAULT_AVL_WHATSAPP_GROUPS } from '@/services/whapi/whapiService';

interface DailyOSModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: DailyOSOrder[];
  formattedDate: string;
  totalCount: number;
}

const PRIORITY_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  B: { label: 'Baixa',   color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/30' },
  N: { label: 'Normal',  color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/30' },
  A: { label: 'Alta',    color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' },
  C: { label: 'Crítica', color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30' },
};

export const DailyOSModal: React.FC<DailyOSModalProps> = ({
  open,
  onOpenChange,
  orders,
  formattedDate,
  totalCount,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<DailyOSOrder | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const filteredOrders = orders.filter((o) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      o.clientName.toLowerCase().includes(term) ||
      o.subject.toLowerCase().includes(term) ||
      o.formattedDailyNumber.includes(term) ||
      (o.ticketId && o.ticketId.includes(term)) ||
      (o.phone && o.phone.includes(term))
    );
  });

  const handleCopyOrderText = (order: DailyOSOrder) => {
    if (!order.fullMessage) {
      toast.warning('Esta O.S. não possui o texto completo gravado.');
      return;
    }
    navigator.clipboard
      .writeText(order.fullMessage)
      .then(() => toast.success(`Texto da O.S. #${order.formattedDailyNumber} copiado!`))
      .catch(() => toast.error('Falha ao copiar texto.'));
  };

  const handleResendToGroup = async (order: DailyOSOrder) => {
    if (!order.fullMessage) {
      toast.warning('Esta O.S. não possui o texto completo para reenvio.');
      return;
    }
    setResendingId(order.id);
    try {
      const groups = await whapiService.getGroups();
      const validGroups = groups && groups.length > 0 ? groups : DEFAULT_AVL_WHATSAPP_GROUPS;
      const target = validGroups.find(g => 
        (order.whatsappGroup && g.name.toLowerCase() === order.whatsappGroup.toLowerCase()) ||
        g.phone === '120363426874994471-group'
      ) || validGroups[0];

      const res = await whapiService.sendGroupMessage(target.phone, order.fullMessage);
      if (res.sent) {
        toast.success(`O.S. #${order.formattedDailyNumber} reenviada para o grupo "${target.name}"!`);
      } else {
        toast.error(`Falha no reenvio: ${res.error}`);
      }
    } catch {
      toast.error('Erro de conexão ao reenviar para o WhatsApp.');
    } finally {
      setResendingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] bg-slate-950/95 border-white/10 text-white backdrop-blur-2xl p-0 overflow-hidden flex flex-col rounded-3xl shadow-2xl">
        {/* Header com Estatísticas */}
        <div className="p-6 border-b border-white/10 bg-gradient-to-r from-emerald-950/40 via-slate-900/40 to-slate-950">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30">
                <ClipboardList className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                  O.S. Segmentadas de Hoje
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs">
                    {totalCount} {totalCount === 1 ? 'aberta' : 'abertas'}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-white/50 text-xs mt-0.5 flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  {formattedDate} • Nova contagem diária iniciada à meia-noite
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-2xl border border-white/10 text-xs">
              <span className="text-white/40">Contagem de hoje:</span>
              <span className="text-emerald-400 font-bold text-sm">#{totalCount} emitidas</span>
            </div>
          </div>

          {/* Barra de Busca rápida */}
          <div className="mt-4 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por cliente, assunto, nº diário ou ID ISPFY..."
              className="bg-black/40 border-white/10 pl-10 pr-4 h-10 text-xs rounded-xl text-white placeholder:text-white/30 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Lista de Ordens do Dia */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
          {filteredOrders.length === 0 ? (
            <div className="py-12 text-center text-white/40 space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-white/5 flex items-center justify-center text-white/20">
                <ClipboardList className="w-7 h-7" />
              </div>
              {searchTerm ? (
                <p className="text-sm">Nenhuma O.S. encontrada para "{searchTerm}".</p>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white/70">Nenhuma O.S. aberta hoje ainda</p>
                  <p className="text-xs text-white/40">
                    A contagem de hoje iniciará em <span className="text-emerald-400 font-bold">#01</span> na primeira O.S. que você abrir!
                  </p>
                </div>
              )}
            </div>
          ) : (
            filteredOrders.map((order) => {
              const priorityInfo = PRIORITY_LABELS[order.priority] || PRIORITY_LABELS.N;
              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    {/* Badge do Número Diário */}
                    <div className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-emerald-300 shrink-0">
                      <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">O.S.</span>
                      <span className="text-lg font-black leading-none">#{order.formattedDailyNumber}</span>
                    </div>

                    {/* Informações da O.S. */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-sm">{order.clientName}</span>
                        {order.ticketId && order.ticketId !== 'PENDENTE' && (
                          <Badge variant="outline" className="text-[10px] bg-sky-500/10 text-sky-300 border-sky-500/20">
                            ISPFY #{order.ticketId}
                          </Badge>
                        )}
                        <Badge variant="outline" className={`text-[10px] ${priorityInfo.bg} ${priorityInfo.color}`}>
                          {priorityInfo.label}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-white/50 flex-wrap">
                        <span className="flex items-center gap-1 text-emerald-300">
                          <Tag className="w-3 h-3" />
                          {order.subject}
                        </span>
                        {order.timeStr && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-white/40" />
                            {order.timeStr}
                          </span>
                        )}
                        {order.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-white/40" />
                            {order.phone}
                          </span>
                        )}
                        {order.plan && (
                          <span className="flex items-center gap-1 text-white/70">
                            <Wifi className="w-3 h-3 text-emerald-400" />
                            {order.plan}
                          </span>
                        )}
                      </div>

                      {order.address && (
                        <p className="text-[11px] text-white/40 flex items-center gap-1 truncate max-w-md">
                          <MapPin className="w-3 h-3 shrink-0 text-white/30" />
                          {order.address}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Ações Rápidas */}
                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    {order.whatsappSent && (
                      <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px] gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Disparado
                      </Badge>
                    )}

                    {order.fullMessage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyOrderText(order)}
                        className="h-8 px-2.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 text-xs gap-1.5"
                        title="Copiar mensagem da O.S."
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copiar
                      </Button>
                    )}

                    {order.fullMessage && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={resendingId === order.id}
                        onClick={() => handleResendToGroup(order)}
                        className="h-8 px-2.5 rounded-lg border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs gap-1.5"
                        title="Reenviar para grupo do WhatsApp"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {resendingId === order.id ? 'Reenviando...' : 'Reenviar'}
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Rodapé Informativo */}
        <div className="p-4 border-t border-white/10 bg-black/40 flex items-center justify-between text-xs text-white/40">
          <span>
            Ciclo diário: <span className="text-white/60">00:00 às 23:59 (Horário de Brasília)</span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-white/60 hover:text-white text-xs h-8"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

import React, { useState } from 'react';
import { motion } from 'framer-motion';
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
  Phone,
  Tag,
  Wifi,
  MapPin,
  CheckCircle2,
} from 'lucide-react';
import type { DailyOSOrder } from '@/types/ispfy';
import { whapiService, DEFAULT_AVL_WHATSAPP_GROUPS } from '@/services/whapi/whapiService';
import {
  ROTULOS_PRIORIDADE_OS,
  selecionarGrupoWhatsAppPadrao,
} from '@/utils/ispfyFormatters';

interface DailyOSModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: DailyOSOrder[];
  formattedDate: string;
  totalCount: number;
}

export const DailyOSModal: React.FC<DailyOSModalProps> = ({
  open,
  onOpenChange,
  orders: ordens,
  formattedDate: dataFormatada,
  totalCount: totalEmitidas,
}) => {
  const [termoBusca, setTermoBusca] = useState('');
  const [idReenviando, setIdReenviando] = useState<string | null>(null);

  const ordensFiltradas = ordens.filter((ordem) => {
    if (!termoBusca.trim()) return true;
    const termo = termoBusca.toLowerCase();
    return (
      ordem.clientName.toLowerCase().includes(termo) ||
      ordem.subject.toLowerCase().includes(termo) ||
      ordem.formattedDailyNumber.includes(termo) ||
      (ordem.ticketId && ordem.ticketId.includes(termo)) ||
      (ordem.phone && ordem.phone.includes(termo))
    );
  });

  const aoCopiarTextoOrdem = (ordem: DailyOSOrder) => {
    if (!ordem.fullMessage) {
      toast.warning('Esta O.S. não possui o texto completo gravado.');
      return;
    }
    navigator.clipboard
      .writeText(ordem.fullMessage)
      .then(() => toast.success(`Texto da O.S. #${ordem.formattedDailyNumber} copiado!`))
      .catch(() => toast.error('Falha ao copiar texto.'));
  };

  const aoReenviarParaGrupo = async (ordem: DailyOSOrder) => {
    if (!ordem.fullMessage) {
      toast.warning('Esta O.S. não possui o texto completo para reenvio.');
      return;
    }
    setIdReenviando(ordem.id);
    try {
      const grupos = await whapiService.getGroups();
      const gruposValidos = grupos && grupos.length > 0 ? grupos : DEFAULT_AVL_WHATSAPP_GROUPS;
      const grupoPorNome = ordem.whatsappGroup
        ? gruposValidos.find(
            (grupo) => grupo.name.toLowerCase() === ordem.whatsappGroup?.toLowerCase()
          )
        : undefined;
      const grupoDestino =
        grupoPorNome || selecionarGrupoWhatsAppPadrao(gruposValidos) || gruposValidos[0];

      const resposta = await whapiService.sendGroupMessage(grupoDestino.phone, ordem.fullMessage);
      if (resposta.sent) {
        toast.success(`O.S. #${ordem.formattedDailyNumber} reenviada para o grupo "${grupoDestino.name}"!`);
      } else {
        toast.error(`Falha no reenvio: ${resposta.error}`);
      }
    } catch {
      toast.error('Erro de conexão ao reenviar para o WhatsApp.');
    } finally {
      setIdReenviando(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] bg-card border border-border text-card-foreground p-0 overflow-hidden flex flex-col rounded-3xl shadow-2xl">
        {/* Header com Estatísticas */}
        <div className="p-6 border-b border-border bg-gradient-to-r from-emerald-500/10 via-card to-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-500 ring-1 ring-emerald-500/30">
                <ClipboardList className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                  O.S. Segmentadas de Hoje
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-xs font-semibold">
                    {totalEmitidas} {totalEmitidas === 1 ? 'aberta' : 'abertas'}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs mt-1 flex items-center gap-2 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                  {dataFormatada} • Nova contagem diária iniciada à meia-noite
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-secondary px-3.5 py-2 rounded-2xl border border-border text-xs">
              <span className="text-muted-foreground font-medium">Contagem de hoje:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">#{totalEmitidas} emitidas</span>
            </div>
          </div>

          {/* Barra de Busca rápida */}
          <div className="mt-4 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              placeholder="Buscar por cliente, assunto, nº diário ou ID ISPFY..."
              className="bg-background border-input pl-10 pr-4 h-10 text-xs rounded-xl text-foreground placeholder:text-muted-foreground focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Lista de Ordens do Dia */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
          {ordensFiltradas.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
                <ClipboardList className="w-7 h-7" />
              </div>
              {termoBusca ? (
                <p className="text-sm font-medium">Nenhuma O.S. encontrada para "{termoBusca}".</p>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Nenhuma O.S. aberta hoje ainda</p>
                  <p className="text-xs text-muted-foreground font-medium">
                    A contagem de hoje iniciará em <span className="text-emerald-600 dark:text-emerald-400 font-bold">#01</span> na primeira O.S. que você abrir!
                  </p>
                </div>
              )}
            </div>
          ) : (
            ordensFiltradas.map((ordem) => {
              const infoPrioridade = ROTULOS_PRIORIDADE_OS[ordem.priority] || ROTULOS_PRIORIDADE_OS.N;
              return (
                <motion.div
                  key={ordem.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-2xl border border-border bg-secondary/30 hover:bg-secondary/70 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    {/* Badge do Número Diário */}
                    <div className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 shrink-0">
                      <span className="text-[10px] uppercase font-bold tracking-wider opacity-70">O.S.</span>
                      <span className="text-lg font-black leading-none">#{ordem.formattedDailyNumber}</span>
                    </div>

                    {/* Informações da O.S. */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-foreground text-sm">{ordem.clientName}</span>
                        {ordem.ticketId && ordem.ticketId !== 'PENDENTE' && (
                          <Badge variant="outline" className="text-[10px] bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30 font-medium">
                            ISPFY #{ordem.ticketId}
                          </Badge>
                        )}
                        <Badge variant="outline" className={`text-[10px] ${infoPrioridade.classeBadge}`}>
                          {infoPrioridade.rotulo}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-medium">
                          <Tag className="w-3 h-3 text-emerald-500" />
                          {ordem.subject}
                        </span>
                        {ordem.timeStr && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            {ordem.timeStr}
                          </span>
                        )}
                        {ordem.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-muted-foreground" />
                            {ordem.phone}
                          </span>
                        )}
                        {ordem.plan && (
                          <span className="flex items-center gap-1 text-foreground font-medium">
                            <Wifi className="w-3 h-3 text-emerald-500" />
                            {ordem.plan}
                          </span>
                        )}
                        {(ordem.wifiSsid || ordem.wifiPassword) && (
                          <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            <Wifi className="w-3 h-3 text-emerald-500" />
                            {ordem.wifiSsid ? `SSID: ${ordem.wifiSsid}` : ''} {ordem.wifiPassword ? `| Senha: ${ordem.wifiPassword}` : ''}
                          </span>
                        )}
                      </div>

                      {ordem.address && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate max-w-md font-medium">
                          <MapPin className="w-3 h-3 shrink-0 text-muted-foreground" />
                          {ordem.address}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Ações Rápidas */}
                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    {ordem.whatsappSent && (
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] gap-1 font-semibold">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        Disparado
                      </Badge>
                    )}

                    {ordem.fullMessage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => aoCopiarTextoOrdem(ordem)}
                        className="h-8 px-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary text-xs gap-1.5 font-medium"
                        title="Copiar mensagem da O.S."
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copiar
                      </Button>
                    )}

                    {ordem.fullMessage && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={idReenviando === ordem.id}
                        onClick={() => aoReenviarParaGrupo(ordem)}
                        className="h-8 px-2.5 rounded-lg border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs gap-1.5 font-medium"
                        title="Reenviar para grupo do WhatsApp"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {idReenviando === ordem.id ? 'Reenviando...' : 'Reenviar'}
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Rodapé Informativo */}
        <div className="p-4 border-t border-border bg-secondary/30 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Ciclo diário: <span className="text-foreground font-medium">00:00 às 23:59 (Horário de Brasília)</span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground text-xs h-8"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  FileEdit,
  PlusCircle,
  Receipt,
  Trash2,
  User,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AceternityEmptyState,
  AnimatedTabs,
  SpotlightCard,
} from '@/components/ui/aceternity';
import { useAuth } from '@/contexts/AuthContext';
import { ispfyService } from '@/services/ispfy/ispfyService';
import {
  deleteInvoiceActionRequest,
  INVOICE_ACTION_LABELS,
  subscribeAllInvoiceRequests,
  subscribeClientInvoiceRequests,
  updateInvoiceActionStatus,
  type InvoiceActionRequest,
  type InvoiceActionType,
  type InvoiceRequestStatus,
} from '@/services/ispfy/invoiceActionQueueService';

interface InvoiceActionQueuePanelProps {
  clientId?: string;
  compact?: boolean;
  onPendingCountChange?: (count: number) => void;
}

type StatusFilter = 'pendente' | 'concluido' | 'rejeitado' | 'todas';

function getActionIcon(tipo: InvoiceActionType) {
  switch (tipo) {
    case 'baixa_manual':
      return <Receipt className="w-4 h-4 text-emerald-500" />;
    case 'gerar_fatura':
      return <PlusCircle className="w-4 h-4 text-blue-500" />;
    case 'alterar_fatura':
      return <FileEdit className="w-4 h-4 text-amber-500" />;
    case 'excluir_fatura':
      return <Trash2 className="w-4 h-4 text-rose-500" />;
  }
}

function getStatusBadge(status: InvoiceRequestStatus) {
  if (status === 'concluido') {
    return (
      <Badge className="bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 gap-1 text-[10px]">
        <CheckCircle2 className="w-3 h-3" /> Concluído no ISPFY
      </Badge>
    );
  }
  if (status === 'rejeitado') {
    return (
      <Badge className="bg-rose-500/12 text-rose-700 dark:text-rose-300 border border-rose-500/30 gap-1 text-[10px]">
        <XCircle className="w-3 h-3" /> Rejeitado
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-500/12 text-amber-700 dark:text-amber-300 border border-amber-500/30 gap-1 text-[10px]">
      <Clock className="w-3 h-3" /> Aguardando ISPFY
    </Badge>
  );
}

export const InvoiceActionQueuePanel: React.FC<InvoiceActionQueuePanelProps> = ({
  clientId,
  compact = false,
  onPendingCountChange,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<InvoiceActionRequest[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('pendente');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = clientId
      ? subscribeClientInvoiceRequests(clientId, setItems)
      : subscribeAllInvoiceRequests(setItems);
    return () => unsub();
  }, [clientId]);

  const counts = useMemo(() => {
    let pendente = 0;
    let concluido = 0;
    let rejeitado = 0;
    for (const item of items) {
      if (item.status === 'pendente') pendente++;
      else if (item.status === 'concluido') concluido++;
      else if (item.status === 'rejeitado') rejeitado++;
    }
    return { pendente, concluido, rejeitado, todas: items.length };
  }, [items]);

  useEffect(() => {
    onPendingCountChange?.(counts.pendente);
  }, [counts.pendente, onPendingCountChange]);

  const visibleItems = useMemo(() => {
    if (filter === 'todas') return items;
    return items.filter((item) => item.status === filter);
  }, [items, filter]);

  const operatorName =
    user?.displayName || user?.email?.split('@')[0] || 'Financeiro';

  const handleSetStatus = async (item: InvoiceActionRequest, status: InvoiceRequestStatus) => {
    setBusyId(item.id);
    try {
      await updateInvoiceActionStatus(item.id, status, operatorName);
      toast.success(
        status === 'concluido'
          ? 'Marcado como efetivado no ISPFY!'
          : 'Solicitação marcada como rejeitada.'
      );
    } catch {
      toast.error('Erro ao atualizar status da solicitação.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (item: InvoiceActionRequest) => {
    setBusyId(item.id);
    try {
      await deleteInvoiceActionRequest(item.id);
      toast.success('Solicitação removida da fila.');
    } catch {
      toast.error('Erro ao remover solicitação.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SpotlightCard tone="amber" showTopBeam className={compact ? 'p-4' : 'p-5'}>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
              <Receipt className="w-4 h-4 text-amber-500" />
              {clientId
                ? 'Fila de Pré-Baixas & Solicitações Financeiras deste Cliente'
                : 'Fila Global de Pré-Baixas, Emissões, Alterações & Exclusões'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Registro auditável em tempo real para ações financeiras que precisam de confirmação no painel ISPFY.
            </p>
          </div>

          <AnimatedTabs
            layoutId={clientId ? `queue-client-${clientId}` : 'queue-global-tabs'}
            size="sm"
            activeTab={filter}
            onChange={setFilter}
            tabs={[
              { id: 'pendente', label: 'Pendentes', badge: counts.pendente, badgeTone: 'warning' },
              { id: 'concluido', label: 'Concluídas', badge: counts.concluido, badgeTone: 'success' },
              { id: 'rejeitado', label: 'Rejeitadas', badge: counts.rejeitado, badgeTone: 'danger' },
              { id: 'todas', label: 'Todas', badge: counts.todas },
            ]}
          />
        </div>

        {visibleItems.length === 0 ? (
          <AceternityEmptyState
            className="py-8"
            icon={<CheckCircle2 className="w-5 h-5" />}
            title={
              filter === 'pendente'
                ? 'Nenhuma solicitação financeira pendente'
                : 'Nenhum registro neste filtro'
            }
            description={
              filter === 'pendente'
                ? 'Quando um operador registrar uma Pré-Baixa, Nova Fatura, Alteração ou Exclusão, ela aparecerá aqui em tempo real.'
                : 'Altere o filtro acima para visualizar outros status.'
            }
          />
        ) : (
          <div className="space-y-2.5">
            {visibleItems.map((item) => {
              const meta = INVOICE_ACTION_LABELS[item.tipo];
              const createdStr = new Date(item.createdAtMs).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-border/75 bg-background/70 dark:bg-white/[0.02] p-3.5 transition-colors hover:border-primary/30"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {getActionIcon(item.tipo)}
                        <span className="text-sm font-bold text-foreground">
                          {meta.label}
                        </span>
                        {getStatusBadge(item.status)}
                        {item.invoiceId && (
                          <Badge variant="outline" className="font-mono text-[10px]">
                            Fatura #{item.invoiceId}
                          </Badge>
                        )}
                        {item.contractId && (
                          <Badge variant="outline" className="font-mono text-[10px]">
                            Contrato #{item.contractId}
                          </Badge>
                        )}
                      </div>

                      {!clientId && (
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                            <User className="w-3.5 h-3.5 text-primary" />
                            {item.clientName}
                          </span>
                          <span className="text-muted-foreground font-mono">
                            ID #{item.clientId}
                          </span>
                          {item.clientCpfCnpj && (
                            <span className="text-muted-foreground font-mono">
                              • {item.clientCpfCnpj}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {item.payload.valorPago && (
                          <span>
                            Recebido: <strong className="text-emerald-600 dark:text-emerald-400">R$ {item.payload.valorPago}</strong> ({item.payload.formaPagamento || 'PIX'})
                          </span>
                        )}
                        {item.payload.dataPagamento && (
                          <span>Data pgto: <strong className="text-foreground">{item.payload.dataPagamento}</strong></span>
                        )}
                        {item.payload.novoValor && (
                          <span>
                            Novo valor: <strong className="text-foreground">R$ {item.payload.novoValor}</strong>
                          </span>
                        )}
                        {item.payload.novoVencimento && (
                          <span>
                            Vencimento: <strong className="text-foreground">{item.payload.novoVencimento}</strong>
                          </span>
                        )}
                        {item.payload.descricao && (
                          <span>Desc.: <strong className="text-foreground">{item.payload.descricao}</strong></span>
                        )}
                        {item.payload.comprovanteRef && (
                          <span className="font-mono">Ref.: {item.payload.comprovanteRef}</span>
                        )}
                      </div>

                      {item.payload.motivo && (
                        <p className="text-xs text-foreground/85 bg-muted/50 rounded-lg px-2.5 py-1.5 border border-border/60">
                          {item.payload.motivo}
                        </p>
                      )}

                      <p className="text-[11px] text-muted-foreground">
                        Solicitado por <strong>{item.requestedByName}</strong> em {createdStr}
                        {item.resolvedByName && item.resolvedAtMs && (
                          <>
                            {' '}• Atualizado por <strong>{item.resolvedByName}</strong> em{' '}
                            {new Date(item.resolvedAtMs).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </>
                        )}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      {!clientId && item.clientId && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs rounded-lg"
                          onClick={() => navigate(`/ispfy/cliente/${item.clientId}`)}
                        >
                          Ficha 360°
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs rounded-lg gap-1"
                        onClick={() =>
                          window.open(
                            ispfyService.getIspfyWebPanelUrl(),
                            '_blank',
                            'noopener,noreferrer'
                          )
                        }
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        ISPFY
                      </Button>

                      {item.status === 'pendente' && (
                        <>
                          <Button
                            size="sm"
                            disabled={busyId === item.id}
                            className="h-8 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                            onClick={() => handleSetStatus(item, 'concluido')}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Concluir
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busyId === item.id}
                            className="h-8 text-xs rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                            onClick={() => handleSetStatus(item, 'rejeitado')}
                          >
                            Rejeitar
                          </Button>
                        </>
                      )}

                      {item.status !== 'pendente' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyId === item.id}
                          className="h-8 text-xs text-muted-foreground hover:text-rose-600"
                          onClick={() => handleRemove(item)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SpotlightCard>
  );
};

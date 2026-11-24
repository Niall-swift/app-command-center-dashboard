import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { ispfyService } from '@/services/ispfy/ispfyService';
import {
  createInvoiceActionRequest,
  INVOICE_ACTION_LABELS,
  type InvoiceActionPayload,
  type InvoiceActionType,
} from '@/services/ispfy/invoiceActionQueueService';
import type { ISPFYClienteData, ISPFYContratoData, ISPFYFaturaData } from '@/types/ispfy';
import { obterNomeClienteISPFY } from '@/utils/ispfyFormatters';

interface InvoiceActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionType: InvoiceActionType;
  client: ISPFYClienteData;
  contracts: ISPFYContratoData[];
  invoice?: ISPFYFaturaData | null;
}

const PAYMENT_METHODS = [
  'PIX',
  'Dinheiro (Caixa)',
  'Cartão de Débito',
  'Cartão de Crédito',
  'Transferência Bancária',
  'Boleto Compensado',
];

export const InvoiceActionDialog: React.FC<InvoiceActionDialogProps> = ({
  open,
  onOpenChange,
  actionType,
  client,
  contracts,
  invoice,
}) => {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const todayIso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
  }).format(new Date());

  const [contractId, setContractId] = useState<string>('');
  const [valorPago, setValorPago] = useState<string>('');
  const [formaPagamento, setFormaPagamento] = useState<string>('PIX');
  const [dataPagamento, setDataPagamento] = useState<string>(todayIso);
  const [comprovanteRef, setComprovanteRef] = useState<string>('');
  const [novoValor, setNovoValor] = useState<string>('');
  const [novoVencimento, setNovoVencimento] = useState<string>(todayIso);
  const [descricao, setDescricao] = useState<string>('');
  const [motivo, setMotivo] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    const defaultContract =
      String(invoice?.id_contrato || contracts[0]?.id || '');
    setContractId(defaultContract);
    setValorPago(String(invoice?.valor || contracts[0]?.valor_mensal || ''));
    setFormaPagamento('PIX');
    setDataPagamento(todayIso);
    setComprovanteRef('');
    setNovoValor(String(invoice?.valor || contracts[0]?.valor_mensal || ''));
    setNovoVencimento(String(invoice?.data_vencimento || todayIso).split(' ')[0]);
    setDescricao(
      actionType === 'gerar_fatura'
        ? 'Mensalidade / Cobrança Avulsa'
        : String(invoice?.observacoes || invoice?.descricao || '')
    );
    setMotivo('');
  }, [open, actionType, invoice, contracts, todayIso]);

  const meta = INVOICE_ACTION_LABELS[actionType];

  const handleSubmit = async (openIspfyAfter: boolean) => {
    if (actionType === 'baixa_manual' && !valorPago.trim()) {
      toast.error('Informe o valor recebido para registrar a pré-baixa.');
      return;
    }
    if (actionType === 'gerar_fatura' && (!novoValor.trim() || !novoVencimento.trim())) {
      toast.error('Informe valor e data de vencimento da nova fatura.');
      return;
    }
    if (actionType === 'alterar_fatura' && !motivo.trim() && !novoValor.trim() && !novoVencimento.trim()) {
      toast.error('Informe ao menos uma alteração ou justificativa.');
      return;
    }
    if (actionType === 'excluir_fatura' && !motivo.trim()) {
      toast.error('Informe o motivo da exclusão/cancelamento para auditoria.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: InvoiceActionPayload = {};
      if (actionType === 'baixa_manual') {
        payload.valorPago = valorPago.trim();
        payload.formaPagamento = formaPagamento;
        payload.dataPagamento = dataPagamento;
        if (comprovanteRef.trim()) payload.comprovanteRef = comprovanteRef.trim();
        if (motivo.trim()) payload.motivo = motivo.trim();
      } else if (actionType === 'gerar_fatura') {
        payload.novoValor = novoValor.trim();
        payload.novoVencimento = novoVencimento;
        payload.descricao = descricao.trim() || 'Cobrança avulsa';
        if (motivo.trim()) payload.motivo = motivo.trim();
      } else if (actionType === 'alterar_fatura') {
        if (novoValor.trim()) payload.novoValor = novoValor.trim();
        if (novoVencimento.trim()) payload.novoVencimento = novoVencimento;
        if (motivo.trim()) payload.motivo = motivo.trim();
      } else if (actionType === 'excluir_fatura') {
        payload.motivo = motivo.trim();
      }

      await createInvoiceActionRequest({
        tipo: actionType,
        clientId: String(client.id || ''),
        clientName: obterNomeClienteISPFY(client, 'Cliente'),
        clientCpfCnpj: String(client.cpf_cnpj || client.cnpj_cpf || ''),
        contractId: contractId || undefined,
        invoiceId: invoice?.id ? String(invoice.id) : undefined,
        invoiceDueDate: invoice?.data_vencimento ? String(invoice.data_vencimento) : undefined,
        invoiceValue: invoice?.valor ? String(invoice.valor) : undefined,
        payload,
        requestedByName: user?.displayName || user?.email?.split('@')[0] || 'Operador',
        requestedByEmail: user?.email || undefined,
      });

      toast.success(`${meta.label} registrada na Fila Financeira!`, {
        description: openIspfyAfter
          ? 'Abrindo o painel oficial do ISPFY para efetivação.'
          : 'A equipe financeira já pode visualizar e concluir no ISPFY.',
      });

      onOpenChange(false);

      if (openIspfyAfter) {
        window.open(ispfyService.getIspfyWebPanelUrl(), '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao registrar solicitação na Fila Financeira.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl border-border/80">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            {actionType === 'excluir_fatura' ? (
              <ShieldAlert className="w-5 h-5 text-rose-500" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-primary" />
            )}
            {meta.label}
          </DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>

        {/* Aviso transparente sobre limitação da API ISPFY */}
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
          <p className="leading-relaxed">
            A API pública do ISPFY não expõe escrita direta em cobranças (<code className="font-mono">PUT/POST/DELETE</code>).
            O pedido fica salvo com auditoria na <strong>Fila Financeira</strong> para conferência e efetivação em 1 clique no painel ISPFY.
          </p>
        </div>

        {/* Contexto da Fatura / Cliente */}
        <div className="rounded-xl border border-border/70 bg-muted/40 p-3 text-xs space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Cliente</span>
            <span className="font-semibold text-foreground truncate">
              {obterNomeClienteISPFY(client)} (#{client.id})
            </span>
          </div>
          {invoice?.id && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Fatura alvo</span>
              <span className="font-mono font-semibold text-foreground">
                #{invoice.id} • R$ {invoice.valor} • Venc. {invoice.data_vencimento}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-4 py-1">
          {actionType === 'gerar_fatura' && (
            <>
              <div className="space-y-1.5">
                <Label>Contrato vinculado</Label>
                <Select value={contractId} onValueChange={setContractId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o contrato" />
                  </SelectTrigger>
                  <SelectContent>
                    {contracts.map((ct) => (
                      <SelectItem key={String(ct.id)} value={String(ct.id)}>
                        Contrato #{ct.id} — R$ {ct.valor_mensal || ct.valor || '0.00'} ({ct.status_contrato || 'Ativo'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Valor (R$)</Label>
                  <Input
                    value={novoValor}
                    onChange={(e) => setNovoValor(e.target.value)}
                    placeholder="99.90"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Vencimento</Label>
                  <Input
                    type="date"
                    value={novoVencimento}
                    onChange={(e) => setNovoVencimento(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Descrição / Referência</Label>
                <Input
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex.: Mensalidade avulsa, taxa de instalação, acordo..."
                />
              </div>
            </>
          )}

          {actionType === 'baixa_manual' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Valor Recebido (R$)</Label>
                  <Input
                    value={valorPago}
                    onChange={(e) => setValorPago(e.target.value)}
                    placeholder="99.90"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Data do Pagamento</Label>
                  <Input
                    type="date"
                    value={dataPagamento}
                    onChange={(e) => setDataPagamento(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Forma de Pagamento</Label>
                  <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>ID / Ref. Comprovante</Label>
                  <Input
                    value={comprovanteRef}
                    onChange={(e) => setComprovanteRef(e.target.value)}
                    placeholder="Ex.: E2E PIX ou NSU"
                  />
                </div>
              </div>
            </>
          )}

          {actionType === 'alterar_fatura' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Novo Valor (R$)</Label>
                <Input
                  value={novoValor}
                  onChange={(e) => setNovoValor(e.target.value)}
                  placeholder="99.90"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Novo Vencimento</Label>
                <Input
                  type="date"
                  value={novoVencimento}
                  onChange={(e) => setNovoVencimento(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>
              {actionType === 'excluir_fatura'
                ? 'Motivo da Exclusão / Cancelamento *'
                : 'Observação / Justificativa'}
            </Label>
            <Textarea
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={
                actionType === 'excluir_fatura'
                  ? 'Ex.: Cobrança duplicada, cliente cancelou antes do ciclo, acordo financeiro...'
                  : 'Detalhes adicionais para o setor financeiro...'
              }
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            variant="outline"
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            className="gap-1.5"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Registrar na Fila
          </Button>
          <Button
            onClick={() => handleSubmit(true)}
            disabled={submitting}
            className="gap-1.5"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ExternalLink className="w-3.5 h-3.5" />
            )}
            Registrar e Abrir ISPFY
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

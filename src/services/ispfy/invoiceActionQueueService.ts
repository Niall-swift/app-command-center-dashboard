import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/config/firebase';

export type InvoiceActionType =
  | 'baixa_manual'
  | 'gerar_fatura'
  | 'alterar_fatura'
  | 'excluir_fatura';

export type InvoiceRequestStatus = 'pendente' | 'concluido' | 'rejeitado';

export interface InvoiceActionPayload {
  valorPago?: string;
  formaPagamento?: string;
  dataPagamento?: string;
  novoValor?: string;
  novoVencimento?: string;
  descricao?: string;
  motivo?: string;
  comprovanteRef?: string;
}

export interface InvoiceActionRequest {
  id: string;
  tipo: InvoiceActionType;
  status: InvoiceRequestStatus;
  clientId: string;
  clientName: string;
  clientCpfCnpj?: string;
  contractId?: string;
  invoiceId?: string;
  invoiceDueDate?: string;
  invoiceValue?: string;
  payload: InvoiceActionPayload;
  requestedByName: string;
  requestedByEmail?: string;
  createdAtMs: number;
  resolvedByName?: string;
  resolvedAtMs?: number;
  resolutionNote?: string;
}

export interface CreateInvoiceActionInput {
  tipo: InvoiceActionType;
  clientId: string;
  clientName: string;
  clientCpfCnpj?: string;
  contractId?: string;
  invoiceId?: string;
  invoiceDueDate?: string;
  invoiceValue?: string;
  payload: InvoiceActionPayload;
  requestedByName: string;
  requestedByEmail?: string;
}

const COLLECTION_NAME = 'ispfy_invoice_requests';

export const INVOICE_ACTION_LABELS: Record<
  InvoiceActionType,
  { label: string; shortLabel: string; description: string }
> = {
  baixa_manual: {
    label: 'Pré-Baixa de Fatura',
    shortLabel: 'Pré-Baixa',
    description: 'Registra comprovante/recebimento para baixa no caixa oficial ISPFY.',
  },
  gerar_fatura: {
    label: 'Gerar Nova Fatura',
    shortLabel: 'Nova Fatura',
    description: 'Solicita emissão de cobrança avulsa/adicional no contrato.',
  },
  alterar_fatura: {
    label: 'Alterar Fatura',
    shortLabel: 'Alteração',
    description: 'Solicita ajuste de valor, vencimento, desconto ou juros.',
  },
  excluir_fatura: {
    label: 'Excluir / Cancelar Fatura',
    shortLabel: 'Exclusão',
    description: 'Solicita cancelamento/baixa administrativa do título no ISPFY.',
  },
};

function mapSnapshotDoc(docId: string, raw: Record<string, unknown>): InvoiceActionRequest {
  const payloadRaw =
    raw.payload && typeof raw.payload === 'object'
      ? (raw.payload as InvoiceActionPayload)
      : {};

  return {
    id: docId,
    tipo: (String(raw.tipo || 'baixa_manual') as InvoiceActionType),
    status: (String(raw.status || 'pendente') as InvoiceRequestStatus),
    clientId: String(raw.clientId || ''),
    clientName: String(raw.clientName || 'Cliente'),
    clientCpfCnpj: raw.clientCpfCnpj ? String(raw.clientCpfCnpj) : undefined,
    contractId: raw.contractId ? String(raw.contractId) : undefined,
    invoiceId: raw.invoiceId ? String(raw.invoiceId) : undefined,
    invoiceDueDate: raw.invoiceDueDate ? String(raw.invoiceDueDate) : undefined,
    invoiceValue: raw.invoiceValue ? String(raw.invoiceValue) : undefined,
    payload: payloadRaw,
    requestedByName: String(raw.requestedByName || 'Operador'),
    requestedByEmail: raw.requestedByEmail ? String(raw.requestedByEmail) : undefined,
    createdAtMs: Number(raw.createdAtMs || Date.now()),
    resolvedByName: raw.resolvedByName ? String(raw.resolvedByName) : undefined,
    resolvedAtMs: raw.resolvedAtMs ? Number(raw.resolvedAtMs) : undefined,
    resolutionNote: raw.resolutionNote ? String(raw.resolutionNote) : undefined,
  };
}

export async function createInvoiceActionRequest(
  input: CreateInvoiceActionInput
): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    ...input,
    status: 'pendente' as InvoiceRequestStatus,
    createdAt: serverTimestamp(),
    createdAtMs: Date.now(),
  });
  return docRef.id;
}

export function subscribeClientInvoiceRequests(
  clientId: string,
  onUpdate: (items: InvoiceActionRequest[]) => void
): Unsubscribe {
  if (!clientId) {
    onUpdate([]);
    return () => undefined;
  }

  const q = query(
    collection(db, COLLECTION_NAME),
    where('clientId', '==', String(clientId)),
    limit(60)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => mapSnapshotDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
      onUpdate(items);
    },
    (err) => {
      console.error('[invoiceActionQueue] Erro ao ouvir fila do cliente:', err);
      onUpdate([]);
    }
  );
}

export function subscribeAllInvoiceRequests(
  onUpdate: (items: InvoiceActionRequest[]) => void
): Unsubscribe {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy('createdAtMs', 'desc'),
    limit(150)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) =>
        mapSnapshotDoc(d.id, d.data() as Record<string, unknown>)
      );
      onUpdate(items);
    },
    (err) => {
      console.error('[invoiceActionQueue] Erro ao ouvir fila global:', err);
      onUpdate([]);
    }
  );
}

export async function updateInvoiceActionStatus(
  requestId: string,
  status: InvoiceRequestStatus,
  resolvedByName: string,
  resolutionNote?: string
): Promise<void> {
  await updateDoc(doc(db, COLLECTION_NAME, requestId), {
    status,
    resolvedByName,
    resolvedAt: serverTimestamp(),
    resolvedAtMs: Date.now(),
    ...(resolutionNote !== undefined ? { resolutionNote } : {}),
  });
}

export async function deleteInvoiceActionRequest(requestId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION_NAME, requestId));
}

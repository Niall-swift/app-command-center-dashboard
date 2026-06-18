/**
 * Tipos e interfaces para a Cloud Function
 */

export interface ClientData {
  name: string;
  nome?: string;
  whatsapp: string;
  phone?: string;
  cpf?: string;
  cep?: string;
  instagram?: string;
  imageUrl?: string;
  address?: string;
  city?: string;
  state?: string;
  createdAt?: any;
}

export interface WelcomeMessageLog {
  clientId: string;
  clientName: string;
  phone: string;
  status: "success" | "failed";
  error?: string;
  messageId?: string;
  timestamp: string;
}


export interface UserSession {
  lastIntent?: string;
  state?: 'IDLE' | 'WAITING_FOR_CPF';
  pendingAction?: 'request_invoice' | 'trust_unlock' | null;
  pausedUntil?: any;
  updatedAt: any;
  phone: string;
  ixcCliente?: any;
  ixcClienteUpdatedAt?: any;
}

export interface WhapiResponse {
  sent: boolean;
  id?: string;
  message?: string;
  error?: string;
}

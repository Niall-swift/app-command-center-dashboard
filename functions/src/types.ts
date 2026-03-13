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
  updatedAt: any;
  phone: string;
}

export interface WhapiResponse {
  sent: boolean;
  id?: string;
  message?: string;
  error?: string;
}

// Types para integração com Whapi.Cloud

export interface WhapiMessage {
  to: string; // Número no formato internacional (5511999999999)
  body: string; // Texto da mensagem
  typing_time?: number; // Tempo de digitação simulado (ms)
}

export interface WhapiImageMessage {
  to: string; // Número no formato internacional (5511999999999)
  imageDataUrl: string; // Data URL da imagem (base64)
  caption?: string; // Legenda da imagem
}

export interface WhapiResponse {
  sent: boolean;
  message?: string;
  id?: string;
  error?: string;
}

export interface WhapiBulkRecipient {
  clienteId: string;
  nome: string;
  telefone: string;
  fatura: {
    id: string;
    valor: number;
    dataVencimento: string;
    diasAtraso: number;
    linkBoleto: string;
  };
  allPhones?: string[]; // All phone numbers for this client (for multi-contact sending)
}


export interface WhapiSendProgress {
  total: number;
  sent: number;
  failed: number;
  current?: string; // Nome do cliente atual
}

export interface WhapiSendLog {
  timestamp: string;
  clienteId: string;
  clienteNome: string;
  telefone: string;
  status: 'success' | 'failed';
  error?: string;
  messageId?: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[]; // Ex: ['nome', 'valor', 'data_vencimento']
}


export type VencimentoGroup = string;


export interface GroupedClients {
  group: VencimentoGroup;
  label: string;
  count: number;
  clients: WhapiBulkRecipient[];
  color: string;
  icon: string;
}

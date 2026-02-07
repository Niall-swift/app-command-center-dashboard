import axios, { AxiosInstance } from 'axios';
import type {
  WhapiMessage,
  WhapiResponse,
  WhapiBulkRecipient,
  WhapiSendProgress,
  WhapiSendLog
} from '@/types/whapi';
import { fillTemplate, getTemplateForGroup, formatCurrency, formatDate, calculateDaysOverdue, calculateDaysRemaining } from './messageTemplates';
import { spin } from '@/utils/spintax';
import { db } from '@/config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export class WhapiService {
  private client: AxiosInstance;
  private apiKey: string;
  private rateLimit: number; // mensagens por segundo

  constructor() {
    const apiKey = import.meta.env.VITE_WHAPI_API_KEY;
    const baseURL = import.meta.env.VITE_WHAPI_BASE_URL || 'https://gate.whapi.cloud';
    const rateLimit = parseInt(import.meta.env.VITE_WHAPI_RATE_LIMIT || '10');

    if (!apiKey) {
      throw new Error('VITE_WHAPI_API_KEY não configurado');
    }

    this.apiKey = apiKey;
    this.rateLimit = rateLimit;

    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Formatar número de telefone para formato internacional
   * Entrada: (11) 99999-9999 ou 11999999999
   * Saída: 5511999999999
   */
  private formatPhoneNumber(phone: string): string {
    // Remover caracteres não numéricos
    const cleaned = phone.replace(/\D/g, '');
    
    // Se não começar com 55, adicionar
    let formatted = cleaned;
    if (!formatted.startsWith('55')) {
      formatted = '55' + formatted;
    }
    
    return formatted;
  }

  /**
   * Aguardar um tempo (para rate limiting)
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Salvar progresso no Firebase
   */
  async saveProgress(groupId: string, lastClientId: string, lastClientName: string): Promise<void> {
    try {
      const docRef = doc(db, 'bulk_send_states', groupId);
      await setDoc(docRef, {
        lastClientId,
        lastClientName,
        timestamp: Date.now(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.error('Erro ao salvar progresso no Firebase:', error);
    }
  }

  /**
   * Ler último progresso do Firebase
   */
  async getLastProgress(groupId: string): Promise<string | null> {
    try {
      const docRef = doc(db, 'bulk_send_states', groupId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data().lastClientId as string;
      }
      return null;
    } catch (error) {
      console.error('Erro ao ler progresso do Firebase:', error);
      return null;
    }
  }

  /**
   * Enviar mensagem individual
   */
  async sendMessage(message: WhapiMessage): Promise<WhapiResponse> {
    try {
      const formattedPhone = this.formatPhoneNumber(message.to);
      
      const payload = {
        to: formattedPhone,
        body: message.body
      };
      
      console.log('📦 Enviando para Whapi:', JSON.stringify(payload, null, 2));

      const response = await this.client.post('/messages/text', payload);

      return {
        sent: true,
        id: response.data.id,
        message: 'Mensagem enviada com sucesso'
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          sent: false,
          error: error.response?.data?.message || error.message
        };
      }
      return {
        sent: false,
        error: 'Erro desconhecido ao enviar mensagem'
      };
    }
  }

  /**
   * Enviar imagem via WhatsApp
   */
  async sendImage(params: {
    to: string;
    imageDataUrl: string;
    caption?: string;
  }): Promise<WhapiResponse> {
    try {
      const formattedPhone = this.formatPhoneNumber(params.to);
      
      // Converter data URL para Blob
      const response = await fetch(params.imageDataUrl);
      const blob = await response.blob();
      
      // Criar FormData
      const formData = new FormData();
      formData.append('to', formattedPhone);
      formData.append('media', blob, 'winner_card.png');
      
      if (params.caption) {
        formData.append('caption', params.caption);
      }
      
      console.log('📸 Enviando imagem para Whapi:', formattedPhone);

      const apiResponse = await this.client.post('/messages/image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return {
        sent: true,
        id: apiResponse.data.id,
        message: 'Imagem enviada com sucesso'
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('❌ Erro ao enviar imagem:', error.response?.data);
        return {
          sent: false,
          error: error.response?.data?.message || error.message
        };
      }
      return {
        sent: false,
        error: 'Erro desconhecido ao enviar imagem'
      };
    }
  }

  /**
   * Enviar mensagens em massa com rate limiting
   */
  async sendBulkMessages(
    recipients: WhapiBulkRecipient[],
    group: string,
    onProgress?: (progress: WhapiSendProgress) => void,
    onLog?: (log: WhapiSendLog) => void,
    onBeforeSend?: (recipient: WhapiBulkRecipient) => Promise<void>
  ): Promise<WhapiSendLog[]> {
    const logs: WhapiSendLog[] = [];

    // Variável para contar mensagens enviadas NESTA sessão para controlar os lotes de 5
    let messagesSentInSession = 0;

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      
      // Atualizar progresso
      if (onProgress) {
        onProgress({
          total: recipients.length,
          sent: i,
          failed: logs.filter(l => l.status === 'failed').length,
          current: recipient.nome
        });
      }

      // Executar ação prévia (ex: enviar e-mail)
      if (onBeforeSend) {
        try {
          await onBeforeSend(recipient);
        } catch (error) {
          console.error(`Erro na ação prévia para ${recipient.nome}:`, error);
        }
      }

      // Preparar dados para o template
      const templateData = {
        nome: recipient.nome,
        valor: formatCurrency(recipient.fatura.valor),
        data_vencimento: formatDate(recipient.fatura.dataVencimento),
        dias_atraso: recipient.fatura.diasAtraso.toString(),
        dias_restantes: calculateDaysRemaining(recipient.fatura.dataVencimento).toString(),
        link_boleto: recipient.fatura.linkBoleto || 'Solicite a 2ª via pelo nosso atendimento'
      };

      // Obter template apropriado
      const template = getTemplateForGroup(group);
      let messageBody = fillTemplate(template, templateData);
      
      // APLICAR SPINTAX (Variação de mensagem)
      messageBody = spin(messageBody);

      // Enviar mensagem
      // Typing time calculado baseado no tamanho da mensagem (Simular humano)
      // ~5 caracteres por segundo
      const estimatedTypingTime = Math.min(Math.floor(messageBody.length / 5) * 1000, 10000); 
      
      const result = await this.sendMessage({
        to: recipient.telefone,
        body: messageBody,
        typing_time: estimatedTypingTime
      });

      // Criar log
      const log: WhapiSendLog = {
        timestamp: new Date().toISOString(),
        clienteId: recipient.clienteId,
        clienteNome: recipient.nome,
        telefone: recipient.telefone,
        status: result.sent ? 'success' : 'failed',
        error: result.error,
        messageId: result.id
      };

      logs.push(log);
      
      if (onLog) {
        onLog(log);
      }

      // Salvar progresso após cada envio bem-sucedido (ou falha, para não repetir)
      await this.saveProgress(group, recipient.clienteId, recipient.nome);

      messagesSentInSession++;

      // Rate limiting humanizado (Anti-Ban)
      if (i < recipients.length - 1) {
        
        // SUPER BATCH PAUSE: A cada 50 mensagens (5 lotes de 10), fazer pausa de 30 minutos
        if (messagesSentInSession > 0 && messagesSentInSession % 50 === 0) {
           const longPause = 30 * 60 * 1000; // 30 minutos
           
           console.log(`☕ PAUSA LONGA (5 LOTES / 50 MSGS): Aguardando 30 minutos...`);
           
           // Timer regressivo no console/progresso
           if (onProgress) {
             for (let remaining = 30; remaining > 0; remaining--) {
                onProgress({
                    total: recipients.length,
                    sent: i + 1,
                    failed: logs.filter(l => l.status === 'failed').length,
                    current: `PAUSA DE SEGURANÇA (30m): ${remaining} minutos restantes...`
                });
                await this.sleep(60000);
             }
           } else {
             await this.sleep(longPause);
           }

        // BATCH PAUSE: A cada 10 mensagens, fazer uma pausa média e ALEATÓRIA (1 a 5 minutos)
        } else if (messagesSentInSession > 0 && messagesSentInSession % 10 === 0) {
           const minTime = 3 * 60 * 1000; // 3 minutos
           const maxTime = 13 * 60 * 1000; // 13 minutos
           const mediumPause = Math.floor(Math.random() * (maxTime - minTime + 1) + minTime); 
           
           const minutes = Math.floor(mediumPause / 60000);
           const seconds = Math.floor((mediumPause % 60000) / 1000);

           console.log(`☕ PAUSA ALEATÓRIA (LOTE DE 10): Aguardando ${minutes}m ${seconds}s...`);
           
           if (onProgress) {
             onProgress({
                total: recipients.length,
                sent: i + 1,
                failed: logs.filter(l => l.status === 'failed').length,
                current: `PAUSA DE LOTE (${minutes}m ${seconds}s)...`
             });
           }
           
           await this.sleep(mediumPause);

        } else {
           // Pausa normal entre mensagens (1 a 4 minutos)
           const minDelay = 1 * 60 * 1000;
           const maxDelay = 4 * 60 * 1000;
           const baseDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
           
           const minutes = Math.floor(baseDelay / 60000);
           const seconds = Math.floor((baseDelay % 60000) / 1000);
           
           console.log(`⏳ Aguardando ${minutes}m ${seconds}s para a próxima mensagem...`);
           await this.sleep(baseDelay);
        }
      }
    }

    // Progresso final
    if (onProgress) {
      onProgress({
        total: recipients.length,
        sent: logs.filter(l => l.status === 'success').length,
        failed: logs.filter(l => l.status === 'failed').length
      });
    }

    return logs;
  }

  /**
   * Verificar status da conexão com Whapi
   */
  async checkConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/settings');
      return response.status === 200;
    } catch (error) {
      console.error('Erro ao verificar conexão Whapi:', error);
      return false;
    }
  }

  /**
   * Obter informações da conta
   */
  async getAccountInfo(): Promise<any> {
    try {
      const response = await this.client.get('/settings');
      return response.data;
    } catch (error) {
      console.error('Erro ao obter informações da conta:', error);
      return null;
    }
  }
}

// Instância singleton
export const whapiService = new WhapiService();

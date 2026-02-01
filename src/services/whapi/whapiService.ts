import axios, { AxiosInstance } from 'axios';
import type {
  WhapiMessage,
  WhapiResponse,
  WhapiBulkRecipient,
  WhapiSendProgress,
  WhapiSendLog
} from '@/types/whapi';
import { fillTemplate, getTemplateForGroup, formatCurrency, formatDate, calculateDaysOverdue } from './messageTemplates';

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
    if (!cleaned.startsWith('55')) {
      return '55' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Aguardar um tempo (para rate limiting)
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Enviar mensagem individual
   */
  async sendMessage(message: WhapiMessage): Promise<WhapiResponse> {
    try {
      const formattedPhone = this.formatPhoneNumber(message.to);
      
      const response = await this.client.post('/messages/text', {
        to: formattedPhone,
        body: message.body,
        typing_time: message.typing_time || 0
      });

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
   * Enviar mensagens em massa com rate limiting
   */
  async sendBulkMessages(
    recipients: WhapiBulkRecipient[],
    group: string,
    onProgress?: (progress: WhapiSendProgress) => void,
    onLog?: (log: WhapiSendLog) => void
  ): Promise<WhapiSendLog[]> {
    const logs: WhapiSendLog[] = [];
    const delayBetweenMessages = 1000 / this.rateLimit; // ms entre mensagens

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

      // Preparar dados para o template
      const templateData = {
        nome: recipient.nome,
        valor: formatCurrency(recipient.fatura.valor),
        data_vencimento: formatDate(recipient.fatura.dataVencimento),
        dias_atraso: recipient.fatura.diasAtraso.toString(),
        link_boleto: recipient.fatura.linkBoleto || 'Solicite a 2ª via pelo nosso atendimento'
      };

      // Obter template apropriado
      const template = getTemplateForGroup(group);
      const messageBody = fillTemplate(template, templateData);

      // Enviar mensagem
      const result = await this.sendMessage({
        to: recipient.telefone,
        body: messageBody,
        typing_time: 1000
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

      // Rate limiting - aguardar antes da próxima mensagem
      if (i < recipients.length - 1) {
        await this.sleep(delayBetweenMessages);
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

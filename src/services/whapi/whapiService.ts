import axios, { AxiosInstance } from 'axios';
import type {
  WhapiMessage,
  WhapiResponse,
  WhapiBulkRecipient,
  WhapiSendProgress,
  WhapiSendLog,
  WhapiGroup
} from '@/types/whapi';
import { fillTemplate, getTemplateForGroup, formatCurrency, formatDate, calculateDaysOverdue, calculateDaysRemaining } from './messageTemplates';
import { spin } from '@/utils/spintax';
import { db } from '@/config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { generateAIBillingMessage } from '@/services/gemini/geminiService';

export const DEFAULT_AVL_WHATSAPP_GROUPS: WhapiGroup[] = [
  { phone: "120363426874994471-group", name: "⚙️ OPERAÇÃO INTERNA DAS OS  • AVL TELECOM" },
  { phone: "120363040961050323-group", name: "EQUIPE AVL " },
  { phone: "120363406862014109-group", name: "IMPORTANTE AVL" },
  { phone: "120363040545792966-group", name: "IMPORTANTE  BASE 1💼" },
  { phone: "120363424849771979-group", name: "🚀 OPERAÇÃO GOL • AVL TELECOM" },
  { phone: "120363424698066312-group", name: "🚀 OPERAÇÃO UNO  • AVL TELECOM" },
  { phone: "120363428422691143-group", name: "* 📍 AVL | LOCALIZAÇÃO DE CLIENTES" },
  { phone: "120363426375742932-group", name: "🔥 💼 MIGUEL COUTO | VENDA • TROCA • OPORTUNIDADES 💼 🔥" },
  { phone: "120363426865123546-group", name: "🍀COMUNIDADE  PRE-MIX 🍀" },
  { phone: "120363413676936204-group", name: "Grupo de estudos" },
];

export class WhapiService {
  private client: AxiosInstance;
  private apiKey: string;
  private rateLimit: number; // mensagens por segundo

  constructor() {
    const instanceId = import.meta.env.VITE_ZAPI_INSTANCE_ID || '3F95A6BAE5232173E9473AA12C97C203';
    const token = import.meta.env.VITE_ZAPI_TOKEN || 'FC515FBAF1E892D0F1E3FFAB';
    const baseURL = `https://api.z-api.io/instances/${instanceId}/token/${token}`;
    const rateLimit = parseInt(import.meta.env.VITE_WHAPI_RATE_LIMIT || '10');

    this.rateLimit = rateLimit;

    const clientToken = import.meta.env.VITE_ZAPI_CLIENT_TOKEN || 'Fa64a52f41c274de0847cf445392dbeedS'; 
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (clientToken) {
      headers['Client-Token'] = clientToken;
    }

    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers,
    });
  }

  /**
   * Formatar número de telefone para formato internacional
   * Entrada: (11) 99999-9999 ou 11999999999
   * Saída: 5511999999999
   */
  private formatPhoneNumber(phone: string): string {
    // Preservar identificadores de grupos WhatsApp (ex: 120363040961050323-group ou @g.us)
    if (phone.includes('-group') || phone.includes('@g.us') || phone.includes('-')) {
      return phone.trim();
    }

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
      
      // Simular digitação usando a rota /presence da Z-API, se solicitado
      if (message.typing_time && message.typing_time > 0) {
        try {
           await this.client.post('/presence', { phone: formattedPhone, presence: 'composing' });
           // Aguarda o tempo de digitação estipulado
           await new Promise(resolve => setTimeout(resolve, message.typing_time));
           // (A Z-API pode limpar o status de "escrevendo..." automaticamente após o envio da mensagem)
        } catch (presenceError) {
           console.warn('⚠️ Não foi possível definir o status de "escrevendo":', presenceError);
        }
      }

      const payload = {
        phone: formattedPhone,
        message: message.body
      };
      
      console.log(`📦 Enviando texto para Z-API:`, JSON.stringify(payload, null, 2));
      const response = await this.client.post('/send-text', payload);

      return {
        sent: true,
        id: response.data?.messageId || response.data?.id,
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
      
      // Converter data URL para Base64
      const response = await fetch(params.imageDataUrl);
      const blob = await response.blob();
      
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      const payload = {
        phone: formattedPhone,
        image: base64,
        caption: params.caption || ""
      };
      
      console.log('📸 Enviando imagem para Z-API:', formattedPhone);

      const apiResponse = await this.client.post('/send-image', payload);

      return {
        sent: true,
        id: apiResponse.data.messageId || apiResponse.data.id,
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
    onBeforeSend?: (recipient: WhapiBulkRecipient) => Promise<void>,
    messageOverride?: (recipient: WhapiBulkRecipient) => Promise<string | null>
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

      // Preparar dados
      const linkBoleto = recipient.fatura.linkBoleto || 'Solicite a 2ª via pelo nosso atendimento';
      const valorFormatado = `R$ ${formatCurrency(recipient.fatura.valor)}`;
      const dataFormatada = formatDate(recipient.fatura.dataVencimento);

      // Tentar gerar mensagem com IA (Gemini) ou usar o override fornecido
      let messageBody: string | null = null;

      if (messageOverride) {
        messageBody = await messageOverride(recipient);
      } else if (group !== 'warmup') {
        messageBody = await generateAIBillingMessage({
          nomeCliente: recipient.nome,
          valor: valorFormatado,
          dataVencimento: dataFormatada,
          diasAtraso: recipient.fatura.diasAtraso,
          linkBoleto,
        });
      }

      // Fallback: usar template + spintax se Gemini falhar ou for warmup
      if (!messageBody) {
        const templateData = {
          nome: recipient.nome,
          valor: formatCurrency(recipient.fatura.valor),
          data_vencimento: dataFormatada,
          dias_atraso: recipient.fatura.diasAtraso.toString(),
          dias_restantes: calculateDaysRemaining(recipient.fatura.dataVencimento).toString(),
          link_boleto: linkBoleto,
        };
        const template = getTemplateForGroup(group);
        messageBody = spin(fillTemplate(template, templateData));
      }

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
   * Buscar foto de perfil do WhatsApp de um contato
   */
  async getContactProfilePicture(phone: string): Promise<string | null> {
    try {
      const contactId = this.formatPhoneNumber(phone);
      console.log('📸 Buscando foto de perfil de:', contactId);

      // Tentar até 3 vezes
      for (let attempt = 1; attempt <= 3; attempt++) {
        const response = await this.client.get(`/profile-picture?phone=${contactId}`);
        const data = response.data;

        console.log(`📸 Resposta perfil (tentativa ${attempt}):`, JSON.stringify(data));

        // Z-API retorna pictureUrl
        const imageUrl = data?.pictureUrl || data?.link || null;

        if (imageUrl && imageUrl.trim() !== '') {
          console.log('✅ Foto de perfil encontrada:', imageUrl);
          return imageUrl;
        }

        if (attempt < 3) {
          console.log(`ℹ️ Foto vazia na tentativa ${attempt}, aguardando 2s...`);
          await this.sleep(2000);
        }
      }

      console.log('ℹ️ Contato sem foto de perfil após 3 tentativas.');
      return null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.warn('⚠️ Não foi possível buscar foto de perfil:', error.response?.data || error.message);
      } else {
        console.warn('⚠️ Erro desconhecido ao buscar foto de perfil:', error);
      }
      return null;
    }
  }

  /**
   * Verificar status da conexão com Z-API
   */
  async checkConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/status');
      return response.data?.connected === true || response.status === 200;
    } catch (error) {
      console.error('Erro ao verificar conexão Z-API:', error);
      return false;
    }
  }

  /**
   * Obter informações da conta
   */
  async getAccountInfo(): Promise<any> {
    try {
      const response = await this.client.get('/status');
      return response.data;
    } catch (error) {
      console.error('Erro ao obter informações da conta:', error);
      return null;
    }
  }

  /**
   * Obter lista de grupos do WhatsApp conectados via Z-API
   */
  async getGroups(): Promise<WhapiGroup[]> {
    try {
      const response = await this.client.get('/groups');
      const data = response.data;
      if (Array.isArray(data) && data.length > 0) {
        return data
          .filter((g: any) => g.phone && g.name)
          .map((g: any) => ({
            phone: g.phone,
            name: g.name.trim(),
            unread: g.unread || g.messagesUnread || '0',
            lastMessageTime: g.lastMessageTime || '',
          }));
      }
      return DEFAULT_AVL_WHATSAPP_GROUPS;
    } catch (error) {
      console.warn('Usando lista padrão de grupos AVL Telecom devido a:', error);
      return DEFAULT_AVL_WHATSAPP_GROUPS;
    }
  }

  /**
   * Enviar mensagem diretamente para um grupo do WhatsApp
   */
  async sendGroupMessage(groupPhone: string, messageText: string): Promise<WhapiResponse> {
    try {
      const payload = {
        phone: groupPhone.trim(),
        message: messageText,
      };
      console.log(`📦 Enviando O.S. para Grupo WhatsApp (${groupPhone}):`, payload);
      const response = await this.client.post('/send-text', payload);
      return {
        sent: true,
        message: 'Mensagem enviada para o grupo com sucesso!',
        id: response.data?.zaapId || response.data?.id,
      };
    } catch (error: any) {
      console.error('Erro ao enviar mensagem para grupo WhatsApp:', error);
      return {
        sent: false,
        error: error.response?.data?.message || error.message || 'Falha ao enviar para o grupo',
      };
    }
  }
}

// Instância singleton
export const whapiService = new WhapiService();

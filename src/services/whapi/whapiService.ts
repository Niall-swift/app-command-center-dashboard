import axios, { AxiosInstance } from 'axios';
import { httpsCallable } from 'firebase/functions';
import type {
  WhapiMessage,
  WhapiResponse,
  WhapiBulkRecipient,
  WhapiSendProgress,
  WhapiSendLog,
  WhapiGroup,
} from '@/types/whapi';
import {
  fillTemplate,
  getTemplateForGroup,
  formatCurrency,
  formatDate,
  calculateDaysRemaining,
} from './messageTemplates';
import { spin } from '@/utils/spintax';
import { db, functions } from '@/config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { generateAIBillingMessage } from '@/services/gemini/geminiService';

export const DEFAULT_AVL_WHATSAPP_GROUPS: WhapiGroup[] = [
  { phone: '120363426874994471-group', name: '⚙️ OPERAÇÃO INTERNA DAS OS • AVL TELECOM' },
  { phone: '120363040961050323-group', name: 'EQUIPE AVL' },
  { phone: '120363406862014109-group', name: 'IMPORTANTE AVL' },
  { phone: '120363040545792966-group', name: 'IMPORTANTE BASE 1💼' },
  { phone: '120363424849771979-group', name: '🚀 OPERAÇÃO GOL • AVL TELECOM' },
  { phone: '120363424698066312-group', name: '🚀 OPERAÇÃO UNO • AVL TELECOM' },
  { phone: '120363428422691143-group', name: '📍 AVL | LOCALIZAÇÃO DE CLIENTES' },
  { phone: '120363426375742932-group', name: '🔥 💼 MIGUEL COUTO | VENDA • TROCA • OPORTUNIDADES 💼 🔥' },
  { phone: '120363426865123546-group', name: '🍀 COMUNIDADE PRE-MIX 🍀' },
  { phone: '120363413676936204-group', name: 'Grupo de estudos' },
];

export interface ZapiStatusResult {
  connected: boolean;
  smartphoneConnected: boolean;
  error?: string | null;
  raw?: Record<string, unknown>;
}

export interface ZapiQrResult {
  connected: boolean;
  qrCodeBase64: string | null;
}

export interface ZapiButtonOption {
  id: string;
  label: string;
}

export class WhapiService {
  private fallbackClient: AxiosInstance | null = null;
  private rateLimit: number;

  constructor() {
    this.rateLimit = parseInt(import.meta.env.VITE_WHAPI_RATE_LIMIT || '10', 10);

    // Fallback direto somente se variáveis VITE_ZAPI_* estiverem explícitas no .env local;
    // em produção todas as chamadas passam pela Cloud Function autenticada `zapiToolActions`.
    const instanceId = import.meta.env.VITE_ZAPI_INSTANCE_ID;
    const token = import.meta.env.VITE_ZAPI_TOKEN;
    const clientToken = import.meta.env.VITE_ZAPI_CLIENT_TOKEN;
    if (instanceId && token) {
      this.fallbackClient = axios.create({
        baseURL: `https://api.z-api.io/instances/${instanceId}/token/${token}`,
        timeout: 35000,
        headers: {
          'Content-Type': 'application/json',
          ...(clientToken ? { 'Client-Token': clientToken } : {}),
        },
      });
    }
  }

  private async callZapiProxy<T = Record<string, unknown>>(
    payload: Record<string, unknown>
  ): Promise<T> {
    const fn = httpsCallable<Record<string, unknown>, T>(functions, 'zapiToolActions');
    const res = await fn(payload);
    return res.data;
  }

  private formatPhoneNumber(phone: string): string {
    if (phone.includes('-group') || phone.includes('@g.us') || phone.includes('-')) {
      return phone.trim();
    }
    const cleaned = phone.replace(/\D/g, '');
    if (!cleaned) return '';
    return cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async saveProgress(groupId: string, lastClientId: string, lastClientName: string): Promise<void> {
    try {
      const docRef = doc(db, 'bulk_send_states', groupId);
      await setDoc(
        docRef,
        {
          lastClientId,
          lastClientName,
          timestamp: Date.now(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error('Erro ao salvar progresso no Firebase:', error);
    }
  }

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

  async sendMessage(message: WhapiMessage): Promise<WhapiResponse> {
    const formattedPhone = this.formatPhoneNumber(message.to);
    if (!formattedPhone) {
      return { sent: false, error: 'Número de telefone inválido' };
    }

    try {
      if (message.typing_time && message.typing_time > 0) {
        await this.callZapiProxy({
          action: 'presence',
          phone: formattedPhone,
          presence: 'composing',
        }).catch(() => undefined);
        await this.sleep(Math.min(message.typing_time, 6000));
      }

      const res = await this.callZapiProxy<{ sent?: boolean; id?: string; error?: string }>({
        action: 'send_text',
        phone: formattedPhone,
        message: message.body,
      });

      return {
        sent: res.sent !== false,
        id: res.id,
        message: 'Mensagem enviada com sucesso',
      };
    } catch (proxyErr) {
      if (this.fallbackClient) {
        try {
          const response = await this.fallbackClient.post('/send-text', {
            phone: formattedPhone,
            message: message.body,
          });
          return {
            sent: true,
            id: response.data?.messageId || response.data?.id,
            message: 'Mensagem enviada com sucesso',
          };
        } catch (err) {
          return {
            sent: false,
            error: axios.isAxiosError(err) ? err.response?.data?.message || err.message : 'Erro Z-API',
          };
        }
      }
      return {
        sent: false,
        error: proxyErr instanceof Error ? proxyErr.message : 'Erro ao enviar mensagem',
      };
    }
  }

  async sendImage(params: {
    to: string;
    imageDataUrl: string;
    caption?: string;
  }): Promise<WhapiResponse> {
    const formattedPhone = this.formatPhoneNumber(params.to);
    try {
      let base64 = params.imageDataUrl;
      if (!base64.startsWith('data:') && !base64.startsWith('http')) {
        const response = await fetch(params.imageDataUrl);
        const blob = await response.blob();
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }

      const res = await this.callZapiProxy<{ sent?: boolean; id?: string }>({
        action: 'send_image',
        phone: formattedPhone,
        image: base64,
        caption: params.caption || '',
      });
      return {
        sent: res.sent !== false,
        id: res.id,
        message: 'Imagem enviada com sucesso',
      };
    } catch (error) {
      return {
        sent: false,
        error: error instanceof Error ? error.message : 'Erro ao enviar imagem',
      };
    }
  }

  async sendButtonPix(params: {
    to: string;
    pixCode: string;
    message?: string;
    merchantName?: string;
  }): Promise<WhapiResponse> {
    try {
      const res = await this.callZapiProxy<{ sent?: boolean; id?: string; error?: string }>({
        action: 'send_button_pix',
        phone: this.formatPhoneNumber(params.to),
        pixCode: params.pixCode,
        message: params.message,
        merchantName: params.merchantName || 'AVL Telecom',
      });
      return {
        sent: Boolean(res.sent),
        id: res.id,
        error: res.error,
        message: res.sent ? 'Botão PIX enviado com sucesso!' : undefined,
      };
    } catch (error) {
      return {
        sent: false,
        error: error instanceof Error ? error.message : 'Erro ao enviar botão PIX',
      };
    }
  }

  async sendButtonList(params: {
    to: string;
    message: string;
    buttons: ZapiButtonOption[];
  }): Promise<WhapiResponse> {
    try {
      const res = await this.callZapiProxy<{ sent?: boolean; id?: string; error?: string }>({
        action: 'send_button_list',
        phone: this.formatPhoneNumber(params.to),
        message: params.message,
        buttons: params.buttons,
      });
      return { sent: Boolean(res.sent), id: res.id, error: res.error };
    } catch (error) {
      return {
        sent: false,
        error: error instanceof Error ? error.message : 'Erro ao enviar botões',
      };
    }
  }

  async sendCsatSurvey(params: {
    to: string;
    clientName?: string;
    ticketId?: string;
    chatId?: string;
  }): Promise<WhapiResponse> {
    try {
      const res = await this.callZapiProxy<{ sent?: boolean; id?: string; error?: string }>({
        action: 'send_csat_survey',
        phone: this.formatPhoneNumber(params.to),
        clientName: params.clientName,
        ticketId: params.ticketId,
        chatId: params.chatId,
      });
      return { sent: Boolean(res.sent), id: res.id, error: res.error };
    } catch (error) {
      return {
        sent: false,
        error: error instanceof Error ? error.message : 'Erro ao enviar pesquisa de satisfação',
      };
    }
  }

  async sendDocument(params: {
    to: string;
    document: string;
    fileName?: string;
    caption?: string;
    extension?: string;
  }): Promise<WhapiResponse> {
    try {
      const res = await this.callZapiProxy<{ sent?: boolean; id?: string; error?: string }>({
        action: 'send_document',
        phone: this.formatPhoneNumber(params.to),
        document: params.document,
        fileName: params.fileName,
        caption: params.caption,
        extension: params.extension || 'pdf',
      });
      return { sent: Boolean(res.sent), id: res.id, error: res.error };
    } catch (error) {
      return {
        sent: false,
        error: error instanceof Error ? error.message : 'Erro ao enviar documento',
      };
    }
  }

  async sendLocation(params: {
    to: string;
    latitude: number;
    longitude: number;
    title?: string;
    address?: string;
  }): Promise<WhapiResponse> {
    try {
      const res = await this.callZapiProxy<{ sent?: boolean; id?: string; error?: string }>({
        action: 'send_location',
        phone: this.formatPhoneNumber(params.to),
        latitude: params.latitude,
        longitude: params.longitude,
        title: params.title,
        address: params.address,
      });
      return { sent: Boolean(res.sent), id: res.id, error: res.error };
    } catch (error) {
      return {
        sent: false,
        error: error instanceof Error ? error.message : 'Erro ao enviar localização',
      };
    }
  }

  async sendReaction(to: string, messageId: string, reaction: string): Promise<WhapiResponse> {
    try {
      const res = await this.callZapiProxy<{ sent?: boolean; error?: string }>({
        action: 'send_reaction',
        phone: this.formatPhoneNumber(to),
        messageId,
        reaction,
      });
      return { sent: Boolean(res.sent), error: res.error };
    } catch (error) {
      return {
        sent: false,
        error: error instanceof Error ? error.message : 'Erro ao enviar reação',
      };
    }
  }

  async editMessage(to: string, messageId: string, newMessage: string): Promise<WhapiResponse> {
    try {
      const res = await this.callZapiProxy<{ sent?: boolean; id?: string; error?: string }>({
        action: 'edit_message',
        phone: this.formatPhoneNumber(to),
        messageId,
        message: newMessage,
      });
      return { sent: Boolean(res.sent), id: res.id, error: res.error };
    } catch (error) {
      return {
        sent: false,
        error: error instanceof Error ? error.message : 'Erro ao editar mensagem',
      };
    }
  }

  async deleteMessage(
    to: string,
    messageId: string,
    options?: { owner?: boolean; deleteForMe?: boolean }
  ): Promise<WhapiResponse> {
    try {
      const res = await this.callZapiProxy<{ sent?: boolean; error?: string }>({
        action: 'delete_message',
        phone: this.formatPhoneNumber(to),
        messageId,
        owner: options?.owner !== false,
        deleteForMe: options?.deleteForMe === true,
      });
      return { sent: Boolean(res.sent), error: res.error };
    } catch (error) {
      return {
        sent: false,
        error: error instanceof Error ? error.message : 'Erro ao apagar mensagem',
      };
    }
  }

  async markChatAsRead(phone: string, messageId?: string | null): Promise<boolean> {
    try {
      const formattedPhone = this.formatPhoneNumber(phone);
      if (!formattedPhone) return false;
      await this.callZapiProxy<{ success?: boolean }>({
        action: 'mark_chat_read',
        phone: formattedPhone,
        ...(messageId ? { messageId } : {}),
      });
      return true;
    } catch {
      return false;
    }
  }

  async markChatAsUnread(phone: string): Promise<boolean> {
    try {
      const formattedPhone = this.formatPhoneNumber(phone);
      if (!formattedPhone) return false;
      await this.callZapiProxy<{ success?: boolean }>({
        action: 'mark_chat_unread',
        phone: formattedPhone,
      });
      return true;
    } catch {
      return false;
    }
  }

  async checkPhoneExists(phone: string): Promise<boolean> {
    try {
      const res = await this.callZapiProxy<{ exists?: boolean }>({
        action: 'phone_exists',
        phone: this.formatPhoneNumber(phone),
      });
      return Boolean(res.exists);
    } catch {
      return true;
    }
  }

  async checkPhonesBatch(
    phones: string[]
  ): Promise<Array<{ phone: string; exists: boolean }>> {
    const res = await this.callZapiProxy<{
      results?: Array<{ phone: string; exists: boolean }>;
    }>({
      action: 'phone_exists_batch',
      phones,
    });
    return res.results || [];
  }

  async getInstanceStatus(): Promise<ZapiStatusResult> {
    try {
      const res = await this.callZapiProxy<{
        connected?: boolean;
        smartphoneConnected?: boolean;
        raw?: Record<string, unknown>;
      }>({ action: 'status' });
      return {
        connected: Boolean(res.connected),
        smartphoneConnected: res.smartphoneConnected !== false,
        raw: res.raw,
      };
    } catch (err) {
      return {
        connected: false,
        smartphoneConnected: false,
        error: err instanceof Error ? err.message : 'Erro ao consultar status Z-API',
      };
    }
  }

  async getQrCode(): Promise<ZapiQrResult> {
    const res = await this.callZapiProxy<{
      connected?: boolean;
      qrCodeBase64?: string | null;
    }>({ action: 'qr_code' });
    return {
      connected: Boolean(res.connected),
      qrCodeBase64: res.qrCodeBase64 || null,
    };
  }

  async restartInstance(): Promise<boolean> {
    try {
      await this.callZapiProxy({ action: 'restart' });
      return true;
    } catch {
      return false;
    }
  }

  async sendBulkMessages(
    recipients: WhapiBulkRecipient[],
    group: string,
    onProgress?: (progress: WhapiSendProgress) => void,
    onLog?: (log: WhapiSendLog) => void,
    onBeforeSend?: (recipient: WhapiBulkRecipient) => Promise<void>,
    messageOverride?: (recipient: WhapiBulkRecipient) => Promise<string | null>
  ): Promise<WhapiSendLog[]> {
    const logs: WhapiSendLog[] = [];
    let messagesSentInSession = 0;

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];

      if (onProgress) {
        onProgress({
          total: recipients.length,
          sent: i,
          failed: logs.filter((l) => l.status === 'failed').length,
          current: recipient.nome,
        });
      }

      if (onBeforeSend) {
        try {
          await onBeforeSend(recipient);
        } catch (error) {
          console.error(`Erro na ação prévia para ${recipient.nome}:`, error);
        }
      }

      const linkBoleto =
        recipient.fatura.linkBoleto || 'Solicite a 2ª via pelo nosso atendimento';
      const valorFormatado = `R$ ${formatCurrency(recipient.fatura.valor)}`;
      const dataFormatada = formatDate(recipient.fatura.dataVencimento);

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

      const estimatedTypingTime = Math.min(Math.floor(messageBody.length / 5) * 1000, 6000);
      const result = await this.sendMessage({
        to: recipient.telefone,
        body: messageBody,
        typing_time: estimatedTypingTime,
      });

      const log: WhapiSendLog = {
        timestamp: new Date().toISOString(),
        clienteId: recipient.clienteId,
        clienteNome: recipient.nome,
        telefone: recipient.telefone,
        status: result.sent ? 'success' : 'failed',
        error: result.error,
        messageId: result.id,
      };
      logs.push(log);
      if (onLog) onLog(log);

      await this.saveProgress(group, recipient.clienteId, recipient.nome);
      messagesSentInSession++;

      if (i < recipients.length - 1) {
        if (messagesSentInSession > 0 && messagesSentInSession % 50 === 0) {
          if (onProgress) {
            for (let remaining = 30; remaining > 0; remaining--) {
              onProgress({
                total: recipients.length,
                sent: i + 1,
                failed: logs.filter((l) => l.status === 'failed').length,
                current: `PAUSA DE SEGURANÇA (30m): ${remaining} minutos restantes...`,
              });
              await this.sleep(60000);
            }
          } else {
            await this.sleep(30 * 60 * 1000);
          }
        } else if (messagesSentInSession > 0 && messagesSentInSession % 10 === 0) {
          const minTime = 3 * 60 * 1000;
          const maxTime = 13 * 60 * 1000;
          const mediumPause = Math.floor(Math.random() * (maxTime - minTime + 1) + minTime);
          const minutes = Math.floor(mediumPause / 60000);
          const seconds = Math.floor((mediumPause % 60000) / 1000);
          if (onProgress) {
            onProgress({
              total: recipients.length,
              sent: i + 1,
              failed: logs.filter((l) => l.status === 'failed').length,
              current: `PAUSA DE LOTE (${minutes}m ${seconds}s)...`,
            });
          }
          await this.sleep(mediumPause);
        } else {
          const minDelay = 1 * 60 * 1000;
          const maxDelay = 4 * 60 * 1000;
          const baseDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
          await this.sleep(baseDelay);
        }
      }
    }

    if (onProgress) {
      onProgress({
        total: recipients.length,
        sent: logs.filter((l) => l.status === 'success').length,
        failed: logs.filter((l) => l.status === 'failed').length,
      });
    }

    return logs;
  }

  async getContactProfilePicture(phone: string): Promise<string | null> {
    try {
      const contactId = this.formatPhoneNumber(phone);
      const res = await this.callZapiProxy<{ pictureUrl?: string | null }>({
        action: 'get_profile_picture',
        phone: contactId,
      });
      return res.pictureUrl || null;
    } catch {
      return null;
    }
  }

  async getContactInfo(phone: string): Promise<{
    name: string | null;
    phoneBookName: string | null;
    pushName: string | null;
    pictureUrl: string | null;
  }> {
    try {
      const contactId = phone.includes('@lid') ? phone.trim() : this.formatPhoneNumber(phone);
      if (!contactId) {
        return { name: null, phoneBookName: null, pushName: null, pictureUrl: null };
      }
      const res = await this.callZapiProxy<{
        name?: string | null;
        phoneBookName?: string | null;
        pushName?: string | null;
        pictureUrl?: string | null;
      }>({
        action: 'get_contact_info',
        phone: contactId,
      });
      return {
        name: res.name || null,
        phoneBookName: res.phoneBookName || null,
        pushName: res.pushName || null,
        pictureUrl: res.pictureUrl || null,
      };
    } catch {
      return { name: null, phoneBookName: null, pushName: null, pictureUrl: null };
    }
  }

  async saveContactToWhatsApp(
    phone: string,
    name: string
  ): Promise<{ syncedToWhatsApp: boolean; reason?: string }> {
    try {
      const contactId = this.formatPhoneNumber(phone);
      const cleanName = name.trim();
      if (!contactId || !cleanName) {
        return { syncedToWhatsApp: false, reason: 'Telefone ou nome inválido' };
      }
      const res = await this.callZapiProxy<{
        syncedToWhatsApp?: boolean;
        reason?: string;
      }>({
        action: 'add_contact',
        phone: contactId,
        name: cleanName,
      });
      return {
        syncedToWhatsApp: Boolean(res.syncedToWhatsApp),
        reason: res.reason,
      };
    } catch (err) {
      return {
        syncedToWhatsApp: false,
        reason: err instanceof Error ? err.message : 'Erro ao sincronizar agenda WhatsApp',
      };
    }
  }

  async checkConnection(): Promise<boolean> {
    const status = await this.getInstanceStatus();
    return status.connected;
  }

  async getAccountInfo(): Promise<Record<string, unknown> | null> {
    const status = await this.getInstanceStatus();
    return status.raw || null;
  }

  async getGroups(): Promise<WhapiGroup[]> {
    try {
      const res = await this.callZapiProxy<{ groups?: WhapiGroup[] }>({
        action: 'get_groups',
      });
      if (Array.isArray(res.groups) && res.groups.length > 0) {
        return res.groups;
      }
      return DEFAULT_AVL_WHATSAPP_GROUPS;
    } catch {
      return DEFAULT_AVL_WHATSAPP_GROUPS;
    }
  }

  async sendGroupMessage(groupPhone: string, messageText: string): Promise<WhapiResponse> {
    return this.sendMessage({
      to: groupPhone.trim(),
      body: messageText,
    });
  }
}

export const whapiService = new WhapiService();

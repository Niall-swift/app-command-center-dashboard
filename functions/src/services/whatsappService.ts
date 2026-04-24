import axios, { AxiosInstance } from 'axios';

export interface WhatsAppMessage {
  to: string;
  body?: string;
  media?: string;
  caption?: string;
}

export class WhatsAppService {
  private client: AxiosInstance;

  constructor(baseURL: string, apiKey: string) {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async sendTextMessage(to: string, body: string): Promise<any> {
    try {
      const response = await this.client.post('/messages/text', {
        to: this.formatPhone(to),
        body,
      });
      return response.data;
    } catch (error: any) {
      console.error('❌ Erro ao enviar mensagem WhatsApp:', error.response?.data || error.message);
      throw error;
    }
  }

  async sendListMessage(to: string, body: string, buttonText: string, sections: any[]): Promise<any> {
    try {
      const response = await this.client.post('/messages/list', {
        to: this.formatPhone(to),
        body,
        list: {
          button: buttonText,
          sections
        }
      });
      return response.data;
    } catch (error: any) {
      console.error('❌ Erro ao enviar lista WhatsApp:', error.response?.data || error.message);
      throw error;
    }
  }

  async sendMediaMessage(to: string, mediaUrl: string, caption?: string): Promise<any> {
    try {
      const isPdf = mediaUrl.toLowerCase().includes('.pdf');
      const isVideo = mediaUrl.toLowerCase().includes('.mp4');
      let endpoint = '/messages/image';
      
      if (isPdf) endpoint = '/messages/document';
      else if (isVideo) endpoint = '/messages/video';

      const response = await this.client.post(endpoint, {
        to: this.formatPhone(to),
        media: mediaUrl,
        caption,
      });
      return response.data;
    } catch (error: any) {
      console.error('❌ Erro ao enviar mídia WhatsApp:', error.response?.data || error.message);
      throw error;
    }
  }

  private formatPhone(phone: string): string {
    let clean = phone.replace(/\D/g, '');
    
    // Se tiver 11 dígitos (com DDD) e não tiver o 55, adiciona
    if (clean.length >= 10 && !clean.startsWith('55')) {
      clean = '55' + clean;
    }
    
    // Whapi geralmente prefere o formato sem o 9 extra para alguns DDDs, 
    // mas o formato internacional padrão costuma funcionar.
    return clean;
  }
}

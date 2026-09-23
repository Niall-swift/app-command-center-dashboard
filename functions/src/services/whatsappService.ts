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
    const finalBaseURL = baseURL.includes('z-api') ? baseURL : "https://api.z-api.io/instances/3F95A6BAE5232173E9473AA12C97C203/token/FC515FBAF1E892D0F1E3FFAB";
    this.client = axios.create({
      baseURL: finalBaseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async sendTextMessage(to: string, body: string): Promise<any> {
    try {
      const response = await this.client.post('/send-text', {
        phone: this.formatPhone(to),
        message: body,
      });
      return response.data;
    } catch (error: any) {
      console.error('❌ Erro ao enviar mensagem WhatsApp:', error.response?.data || error.message);
      throw error;
    }
  }

  async sendListMessage(to: string, body: string, buttonText: string, sections: any[]): Promise<any> {
    try {
      const response = await this.client.post('/send-option-list', {
        phone: this.formatPhone(to),
        message: body,
        optionList: {
          title: buttonText,
          options: sections
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
      let endpoint = '/send-image';
      let mediaKey = 'image';
      
      if (isPdf) {
        endpoint = '/send-document';
        mediaKey = 'document';
      } else if (isVideo) {
        endpoint = '/send-video';
        mediaKey = 'video';
      }

      const response = await this.client.post(endpoint, {
        phone: this.formatPhone(to),
        [mediaKey]: mediaUrl,
        caption: caption || "",
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

  async downloadMedia(mediaId: string): Promise<Buffer> {
    try {
      const response = await this.client.get(`/media/${mediaId}`, {
        responseType: 'arraybuffer'
      });
      return Buffer.from(response.data);
    } catch (error: any) {
      console.error('❌ Erro ao baixar mídia WhatsApp da Whapi:', error.response?.data || error.message);
      throw error;
    }
  }
}

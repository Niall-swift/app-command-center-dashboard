import axios, {AxiosInstance} from "axios";
import {WhapiResponse} from "./types";
import {premixWelcomeTemplate, fillTemplate, spin} from "./messageTemplates";

/**
 * Serviço para enviar mensagens via Whapi.Cloud
 */
export class WhapiService {
  private client: AxiosInstance;

  constructor(apiKey: string, baseURL: string = "https://api.z-api.io/instances/3F95A6BAE5232173E9473AA12C97C203/token/FC515FBAF1E892D0F1E3FFAB") {
    // Para simplificar a transição, ignoramos a apiKey antiga se baseURL não contiver api.z-api.io
    const finalBaseURL = baseURL.includes('z-api') ? baseURL : "https://api.z-api.io/instances/3F95A6BAE5232173E9473AA12C97C203/token/FC515FBAF1E892D0F1E3FFAB";

    this.client = axios.create({
      baseURL: finalBaseURL,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
        "Client-Token": apiKey,
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
    const cleaned = phone.replace(/\D/g, "");

    // Se não começar com 55, adicionar
    let formatted = cleaned;
    if (!formatted.startsWith("55")) {
      formatted = "55" + formatted;
    }

    return formatted;
  }

  /**
   * Enviar mensagem de boas-vindas com logo
   */
  async sendWelcomeMessage(
    name: string,
    phone: string
  ): Promise<WhapiResponse> {
    // URL da logo da Pre-Mix
    const logoUrl = "https://firebasestorage.googleapis.com/v0/b/avl-telecom.appspot.com/o/logo-pre-mix%2FWhatsApp%20Image%202026-02-11%20at%2014.52.11.jpeg?alt=media&token=b6d398d2-60df-4f09-a9bc-340a7ecb37d1"; 
    
    // Tenta enviar com imagem, se falhar, envia apenas texto
    try {
      const result = await this.sendImageMessage(name, phone, logoUrl);
      if (result.sent) return result;
      throw new Error(result.error || "Falha no envio de imagem");
    } catch (error) {
      console.warn("⚠️ Falha ao enviar imagem, tentando enviar apenas texto...", error);
      return this.sendTextMessage(name, phone);
    }
  }

  /**
   * Helper para converter URL em Base64
   */
  private async getBase64FromUrl(url: string): Promise<string> {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary');
    const mimeType = response.headers['content-type'] || 'image/jpeg';
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  }

  /**
   * Enviar mensagem apenas de texto (Fallback)
   */
  async sendTextMessage(
    name: string,
    phone: string
  ): Promise<WhapiResponse> {
    try {
      const formattedPhone = this.formatPhoneNumber(phone);
      const template = premixWelcomeTemplate;
      let messageBody = fillTemplate(template, {nome: name});
      messageBody = spin(messageBody);

      const payload = {
        phone: formattedPhone,
        message: messageBody,
      };

      console.log("📦 Enviando mensagem de TEXTO (Fallback):", {
        phone: formattedPhone,
        name: name,
      });

      const response = await this.client.post("/send-text", payload);
      console.log("✅ Mensagem de texto enviada com sucesso:", response.data);

      return {
        sent: true,
        id: response.data.messageId || response.data.id,
        message: "Mensagem de texto enviada com sucesso",
      };
    } catch (error) {
      console.error("❌ Erro ao enviar mensagem de texto:", error);
      if (axios.isAxiosError(error)) {
        return {
          sent: false,
          error: error.response?.data?.message || error.message,
        };
      }
      return {
        sent: false,
        error: "Erro desconhecido ao enviar mensagem de texto",
      };
    }
  }

  /**
   * Enviar mensagem com imagem e legenda
   */
  async sendImageMessage(
    name: string,
    phone: string,
    imageUrl: string
  ): Promise<WhapiResponse> {
    try {
      const formattedPhone = this.formatPhoneNumber(phone);

      // Preencher template
      const template = premixWelcomeTemplate;
      let messageBody = fillTemplate(template, {nome: name});

      // Aplicar Spintax
      messageBody = spin(messageBody);

      // 🔄 Converter imagem para Base64 para garantir envio
      console.log("🔄 Baixando imagem para converter em Base64...");
      const base64Image = await this.getBase64FromUrl(imageUrl);
      console.log("✅ Imagem convertida!");

      // Payload para imagem Z-API
      const payload = {
        phone: formattedPhone,
        image: base64Image, // Enviando Base64 direto
        caption: messageBody,
      };

      console.log("📦 Enviando imagem de boas-vindas:", {
        phone: formattedPhone,
        name: name,
        imageLength: base64Image.length // Logando tamanho para debug
      });

      const response = await this.client.post("/send-image", payload);

      console.log("✅ Imagem enviada com sucesso:", response.data);

      return {
        sent: true,
        id: response.data.messageId || response.data.id,
        message: "Imagem enviada com sucesso",
      };
    } catch (error) {
      console.error("❌ Erro ao enviar imagem:", error);

      // Retornar erro para permitir fallback
      if (axios.isAxiosError(error)) {
        return {
          sent: false,
          error: error.response?.data?.message || error.message,
        };
      }

      return {
        sent: false,
        error: "Erro desconhecido ao enviar imagem",
      };
    }
  }

  /**
   * Enviar comprovante de pagamento formatado
   */
  async sendPaymentReceipt(
    name: string,
    phone: string,
    receiptData: { valor: string; data: string; hora: string; descricao: string }
  ): Promise<WhapiResponse> {
    try {
      const formattedPhone = this.formatPhoneNumber(phone);
      
      const messageBody = `🧾 *COMPROVANTE DE PAGAMENTO* 🧾\n\n` +
        `Olá, *${name.split(' ')[0]}*! Recebemos e confirmamos o seu pagamento. Muito obrigado! 🎉\n\n` +
        `*Detalhes da Baixa:*\n` +
        `🔹 *Referência:* ${receiptData.descricao}\n` +
        `💰 *Valor Pago:* ${receiptData.valor}\n` +
        `📅 *Data do Pagamento:* ${receiptData.data}\n` +
        `⏰ *Hora do Pagamento:* ${receiptData.hora}\n\n` +
        `Sua conexão já está garantida. Qualquer dúvida, conte conosco!\n\n` +
        `_Att, Equipe AVL Telecom_`;

      const payload = {
        phone: formattedPhone,
        message: messageBody,
      };

      console.log(`📦 Enviando comprovante para ${formattedPhone}`);
      const response = await this.client.post("/send-text", payload);
      
      return {
        sent: true,
        id: response.data?.messageId || response.data?.id,
        message: "Comprovante enviado com sucesso",
      };
    } catch (error) {
      console.error("❌ Erro ao enviar comprovante:", error);
      return {
        sent: false,
        error: "Erro ao enviar comprovante",
      };
    }
  }

  /**
   * Enviar mensagem de texto personalizada de forma direta
   */
  async sendCustomMessage(
    phone: string,
    text: string
  ): Promise<WhapiResponse> {
    try {
      const formattedPhone = this.formatPhoneNumber(phone);
      const payload = {
        phone: formattedPhone,
        message: text,
      };

      console.log(`📦 Enviando mensagem personalizada para ${formattedPhone}`);
      const response = await this.client.post("/send-text", payload);
      console.log("✅ Mensagem personalizada enviada com sucesso:", response.data);

      return {
        sent: true,
        id: response.data.messageId || response.data.id,
        message: "Mensagem enviada com sucesso",
      };
    } catch (error) {
      console.error("❌ Erro ao enviar mensagem personalizada:", error);
      if (axios.isAxiosError(error)) {
        return {
          sent: false,
          error: error.response?.data?.message || error.message,
        };
      }
      return {
        sent: false,
        error: "Erro desconhecido ao enviar mensagem",
      };
    }
  }
}

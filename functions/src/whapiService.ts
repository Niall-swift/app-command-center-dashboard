import axios, {AxiosInstance} from "axios";
import {WhapiResponse} from "./types";
import {premixWelcomeTemplate, fillTemplate, spin} from "./messageTemplates";

/**
 * Serviço para enviar mensagens via Whapi.Cloud
 */
export class WhapiService {
  private client: AxiosInstance;

  constructor(apiKey: string, baseURL: string = "https://gate.whapi.cloud") {

    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
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
        to: formattedPhone,
        body: messageBody,
      };

      console.log("📦 Enviando mensagem de TEXTO (Fallback):", {
        to: formattedPhone,
        name: name,
      });

      const response = await this.client.post("/messages/text", payload);
      console.log("✅ Mensagem de texto enviada com sucesso:", response.data);

      return {
        sent: true,
        id: response.data.id,
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

      // Payload para imagem
      const payload = {
        to: formattedPhone,
        media: base64Image, // Enviando Base64 direto
        caption: messageBody,
      };

      console.log("📦 Enviando imagem de boas-vindas:", {
        to: formattedPhone,
        name: name,
        imageLength: base64Image.length // Logando tamanho para debug
      });

      const response = await this.client.post("/messages/image", payload);

      console.log("✅ Imagem enviada com sucesso:", response.data);

      return {
        sent: true,
        id: response.data.id,
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
}

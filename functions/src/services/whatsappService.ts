import axios, { AxiosInstance } from 'axios';

export interface WhatsAppMessage {
  to: string;
  body?: string;
  media?: string;
  caption?: string;
}

export interface SendMediaOptions {
  fileName?: string | null;
  mimeType?: string | null;
  replyToMessageId?: string | null;
}

const PLACEHOLDER_CAPTIONS = new Set([
  "📎 foto",
  "📎 imagem",
  "🎵 áudio",
  "🎥 vídeo",
  "📄 documento",
  "📎 mídia",
]);

function cleanCaptionText(caption?: string): string {
  const trimmed = String(caption || "").trim();
  if (!trimmed) return "";
  if (PLACEHOLDER_CAPTIONS.has(trimmed.toLowerCase())) return "";
  return trimmed;
}

function extractExtension(
  fileName?: string | null,
  mediaUrl?: string,
  mimeType?: string | null
): string {
  const tryFromName = (raw?: string | null): string => {
    if (!raw) return "";
    const withoutQuery = raw.split("?")[0].split("#")[0];
    let decoded = withoutQuery;
    try {
      decoded = decodeURIComponent(withoutQuery);
    } catch {
      // ignore malformed URI encoding
    }
    const base = decoded.split("/").pop() || "";
    const dotIdx = base.lastIndexOf(".");
    if (dotIdx > 0 && dotIdx < base.length - 1) {
      const candidate = base.slice(dotIdx + 1).replace(/[^a-z0-9]/gi, "").toLowerCase();
      if (candidate.length >= 1 && candidate.length <= 8) return candidate;
    }
    return "";
  };

  const fromFile = tryFromName(fileName);
  if (fromFile) return fromFile;

  const fromUrl = tryFromName(mediaUrl);
  if (fromUrl) return fromUrl;

  const mime = String(mimeType || "").toLowerCase();
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("wordprocessingml") || mime.includes("msword")) return "docx";
  if (mime.includes("spreadsheetml") || mime.includes("excel")) return "xlsx";
  if (mime.includes("presentationml") || mime.includes("powerpoint")) return "pptx";
  if (mime.includes("csv")) return "csv";
  if (mime.includes("plain")) return "txt";
  if (mime.includes("zip")) return "zip";
  if (mime.includes("xml")) return "xml";
  if (mime.includes("json")) return "json";
  return "pdf";
}

export class WhatsAppService {
  private client: AxiosInstance;

  constructor(baseURL: string, apiKey: string) {
    if (!baseURL?.trim()) {
      throw new Error("WHAPI_BASE_URL não configurada.");
    }
    this.client = axios.create({
      baseURL: baseURL.replace(/\/$/, ""),
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'Client-Token': apiKey } : {}),
      },
    });
  }

  async sendTextMessage(
    to: string,
    body: string,
    replyToMessageId?: string | null
  ): Promise<any> {
    try {
      const payload: Record<string, any> = {
        phone: this.formatPhone(to),
        message: body,
      };
      if (replyToMessageId && String(replyToMessageId).trim()) {
        payload.messageId = String(replyToMessageId).trim();
      }
      const response = await this.client.post('/send-text', payload);
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

  async sendMediaMessage(
    to: string,
    mediaUrl: string,
    caption?: string,
    explicitType?: string,
    options?: SendMediaOptions
  ): Promise<any> {
    try {
      const lower = mediaUrl.toLowerCase();
      const mime = String(options?.mimeType || "").toLowerCase();
      const type = String(explicitType || "").toLowerCase();
      const cleanCaption = cleanCaptionText(caption);
      const formattedPhone = this.formatPhone(to);

      const isAudio =
        type === "audio" ||
        mime.startsWith("audio/") ||
        /\.(webm|ogg|opus|mp3|m4a|wav|aac)(\?|$)/i.test(lower);
      const isVideo =
        type === "video" ||
        mime.startsWith("video/") ||
        /\.(mp4|mov|mkv|avi|3gp)(\?|$)/i.test(lower);
      const isDocument =
        type === "document" ||
        mime.startsWith("application/") ||
        mime.startsWith("text/") ||
        /\.(pdf|docx?|xlsx?|pptx?|txt|csv|zip|rar|xml)(\?|$)/i.test(lower);

      const replyId = String(options?.replyToMessageId || "").trim();

      if (isAudio) {
        const payload: Record<string, any> = {
          phone: formattedPhone,
          audio: mediaUrl,
          waveform: true,
        };
        if (replyId) payload.messageId = replyId;
        const response = await this.client.post("/send-audio", payload, { timeout: 60000 });
        if (cleanCaption) {
          await this.sendTextMessage(formattedPhone, cleanCaption).catch(() => undefined);
        }
        return response.data;
      }

      if (isVideo) {
        const payload: Record<string, any> = {
          phone: formattedPhone,
          video: mediaUrl,
        };
        if (cleanCaption) payload.caption = cleanCaption;
        if (replyId) payload.messageId = replyId;
        const response = await this.client.post("/send-video", payload, { timeout: 120000 });
        return response.data;
      }

      if (isDocument) {
        const ext = extractExtension(options?.fileName, mediaUrl, options?.mimeType);
        const safeFileName =
          String(options?.fileName || "").trim() || `documento_avl.${ext}`;
        const payload: Record<string, any> = {
          phone: formattedPhone,
          document: mediaUrl,
          fileName: safeFileName,
        };
        if (cleanCaption) payload.caption = cleanCaption;
        if (replyId) payload.messageId = replyId;

        try {
          const response = await this.client.post(`/send-document/${ext}`, payload, {
            timeout: 90000,
          });
          return response.data;
        } catch (docErr: any) {
          console.warn(
            `⚠️ Falha em /send-document/${ext}, tentando fallback /send-document:`,
            docErr.response?.data || docErr.message
          );
          const fallbackResp = await this.client.post("/send-document", payload, {
            timeout: 90000,
          });
          return fallbackResp.data;
        }
      }

      // Imagem (padrão)
      const payload: Record<string, any> = {
        phone: formattedPhone,
        image: mediaUrl,
      };
      if (cleanCaption) payload.caption = cleanCaption;
      if (replyId) payload.messageId = replyId;
      const response = await this.client.post("/send-image", payload, { timeout: 60000 });
      return response.data;
    } catch (error: any) {
      console.error('❌ Erro ao enviar mídia WhatsApp:', error.response?.data || error.message);
      throw error;
    }
  }

  async sendReaction(to: string, messageId: string, reaction: string): Promise<any> {
    try {
      const response = await this.client.post('/send-reaction', {
        phone: this.formatPhone(to),
        messageId,
        reaction,
      });
      return response.data;
    } catch (error: any) {
      console.warn('⚠️ Falha ao enviar reação WhatsApp:', error.response?.data || error.message);
      return null;
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

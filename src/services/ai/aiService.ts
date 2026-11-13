import { httpsCallable } from "firebase/functions";
import { functions } from "@/config/firebase";
import { Message } from "@/types/dashboard";

interface AiChatRequest {
  messages: Array<{ content: string; isAdmin: boolean }>;
  clientName: string;
}

interface AiChatResponse {
  text: string;
}

/**
 * Encaminha o chat do assistente "Josué" para a Cloud Function autenticada (aiChatJosue),
 * garantindo que a chave Gemini e as chamadas ao ISPFY fiquem protegidas no servidor.
 */
export const aiService = {
  generateResponse: async (messages: Message[], clientName: string): Promise<string> => {
    try {
      const callable = httpsCallable<AiChatRequest, AiChatResponse>(functions, "aiChatJosue");
      const serialized = messages.slice(-15).map((m) => ({
        content: m.content || "",
        isAdmin: Boolean(m.isAdmin),
      }));

      const result = await callable({ messages: serialized, clientName });
      if (result.data?.text) {
        return result.data.text;
      }

      return "Puxa, deu um tilt aqui no meu sistema... 😵 Pode repetir o que você precisa? O Josué aqui está pronto para tentar de novo!";
    } catch (error: any) {
      console.error("❌ Erro no Josué:", error);
      if (error?.message?.includes("503")) {
        return "Puxa, meus servidores estão passando por uma instabilidade momentânea (muito movimento hoje!). Você poderia mandar um 'Oi' de novo daqui a um minutinho? 🙏";
      }
      return "Puxa, deu um tilt aqui no meu sistema... 😵 Pode repetir o que você precisa? O Josué aqui está pronto para tentar de novo!";
    }
  },
};

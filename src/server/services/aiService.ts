import { GoogleGenerativeAI } from "@google/generative-ai";

export type Intent = 'request_invoice' | 'human_support' | 'other' | 'greeting';

export interface AiResponse {
  intent: Intent;
  explanation: string;
  data?: {
    cpf_cnpj?: string;
  };
}

export class AiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    // Usar model com alias 'latest' ou string curta para maior compatibilidade
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  }

  async detectIntent(message: string): Promise<AiResponse> {
    const prompt = `
      Você é um assistente de atendimento de um provedor de internet (AVL Telecom).
      Analise a mensagem abaixo do cliente e identifique a intenção predominante.
      
      Categorias:
      - 'request_invoice': O cliente quer boleto, fatura, segunda via, pagamento, código pix, código de barras.
      - 'human_support': O cliente quer falar com atendente, suporte técnico, reclamação, problema de sinal.
      - 'greeting': Apenas saudação (oi, bom dia, etc).
      - 'other': Outros assuntos.
      
      Se o cliente fornecer um CPF ou CNPJ na mensagem, extraia-o.
      
      Mensagem do cliente: "${message}"
      
      Responda APENAS em formato JSON:
      {
        "intent": "categoria",
        "explanation": "breve explicação",
        "data": {
          "cpf_cnpj": "apenas números se encontrado"
        }
      }
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Limpar texto para garantir JSON válido
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error("Erro no AiService:", error);
      return { intent: 'other', explanation: 'Erro ao processar IA' };
    }
  }
}

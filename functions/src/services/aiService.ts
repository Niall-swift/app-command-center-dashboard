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
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
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

  async answerGeneralQuestion(
    message: string,
    clientName?: string
  ): Promise<{ response: string; shouldEscalate: boolean }> {
    const nameIntro = clientName ? `O nome do cliente é ${clientName}. ` : "";
    
    const prompt = `
      Você é a ARIA, assistente virtual inteligente da AVL Telecom, um provedor de internet de alta velocidade em fibra óptica.
      Responda à mensagem do cliente de forma simpática, prestativa e profissional.
      
      ${nameIntro}
      
      ### Informações sobre a AVL Telecom:
      - **Serviços**: Oferecemos planos de internet banda larga residencial e corporativa via fibra óptica ultrarrápida (FTTH).
      - **Diferenciais**: Fibra óptica de ponta a ponta, estabilidade de conexão, suporte rápido e atendimento humanizado.
      - **Horário de Atendimento Humano**: Segunda a Sexta das 08h às 20h, e Sábados das 08h às 18h. Aos domingos e feriados, operamos em regime de plantão para casos graves de queda de sinal.
      - **Endereço**: Atendemos toda a região metropolitana. Nossa sede fica na Av. Principal.
      - **Formas de Pagamento**: Aceitamos PIX (baixa automática imediata), boleto bancário e cartão.
      - **Desbloqueio de Confiança**: Clientes com a internet bloqueada por atraso no pagamento podem liberar o sinal temporariamente por 3 dias (Desbloqueio de Confiança), disponível no menu principal (opção 3).
      - **Aplicativo Mobile (Pre-Mix)**: Temos um aplicativo onde os clientes cadastrados concorrem a sorteios de prêmios mensais (programa Pre-Mix).
      
      ### Diretrizes de Resposta:
      1. Use o nome do cliente se fornecido. Mantenha o tom profissional, prestativo e caloroso. Use emojis de forma moderada.
      2. Responda diretamente e em parágrafos curtos.
      3. Se o cliente solicitar explicitamente falar com um atendente, suporte humano, pessoa real, ou estiver reclamando de forma que necessite de atendimento humano imediato, defina "shouldEscalate" como true.
      4. Se a pergunta for sobre valores específicos de plano do cliente, detalhes do contrato dele ou algo que exija acesso a dados restritos que não temos no contexto, responda que vai transferir para o suporte humano e defina "shouldEscalate" como true.
      5. Se for uma dúvida geral sobre planos (ex: "quais os planos?", "como funciona?"), responda de forma geral e defina "shouldEscalate" como false, lembrando-o de que se quiser contratar, pode pedir para falar com um atendente.
      6. Se a pergunta for sobre a fatura, boleto ou segunda via, oriente-o a usar a opção 1 do menu ("Minha Fatura") que o bot enviará o boleto e o código Pix na hora, e defina "shouldEscalate" como false.
      7. Se ele apenas disser algo genérico ou fizer perguntas frequentes listadas acima, responda a pergunta e defina "shouldEscalate" como false.
      
      Mensagem do cliente: "${message}"
      
      Responda APENAS em formato JSON com as seguintes chaves (não coloque código em markdown extra além do JSON):
      {
        "response": "sua resposta aqui formatada para WhatsApp (use *negrito* se necessário para destacar palavras importantes, emojis moderados, sem asteriscos duplos)",
        "shouldEscalate": true ou false
      }
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Limpar texto para garantir JSON válido
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      
      return {
        response: parsed.response || "Entendi. Vou te passar para um de nossos especialistas. Aguarde um instante.",
        shouldEscalate: parsed.shouldEscalate ?? true
      };
    } catch (error) {
      console.error("Erro no AiService answerGeneralQuestion:", error);
      return {
        response: "Entendi. Vou transferir você para um atendente para te ajudar melhor. Aguarde um momento. 🎧",
        shouldEscalate: true
      };
    }
  }
}

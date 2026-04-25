import { Message } from "@/types/dashboard";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { ixcService } from "@/services/ixc/ixcService";

// Chave recuperada do geminiService.ts
const GEMINI_API_KEY = 'AIzaSyA4Q6BN5vKPUQrEiEONprIknhS-loVYYo0';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Definição das ferramentas (Tools) que o Josué pode usar
const tools = [
  {
    functionDeclarations: [
      {
        name: "get_client_info",
        description: "Busca informações detalhadas do cliente no IXC através do CPF ou CNPJ.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            cpf: { type: SchemaType.STRING, description: "O CPF ou CNPJ do cliente (apenas números)." }
          },
          required: ["cpf"]
        }
      },
      {
        name: "list_invoices",
        description: "Lista as faturas em aberto do cliente no IXC.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            clientId: { type: SchemaType.STRING, description: "O ID do cliente no IXC." }
          },
          required: ["clientId"]
        }
      },
      {
        name: "trust_unlock",
        description: "Realiza o desbloqueio de confiança (liberação temporária) da internet do cliente.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            contractId: { type: SchemaType.STRING, description: "O ID do contrato que deve ser desbloqueado." }
          },
          required: ["contractId"]
        }
      }
    ]
  }
];

const model = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash",
  tools: tools,
  systemInstruction: `Você é o Josué, o atendente de elite da AVL Telecom.
  Sua missão é ajudar os clientes de forma rápida, inteligente e divertida.
  
  PERSONALIDADE:
  - Você é educado, alegre e usa gírias leves para parecer humano.
  - Sabe dar "Bom dia", "Boa tarde" e "Boa noite" de acordo com o horário (simule baseado no contexto).
  - Se o cliente for rude ou usar xingamentos, você deve manter a classe: ignore a ofensa ou dê um "sermão" educado, explicando que você está ali para ajudar e exige respeito.
  - Nunca saia do contexto da AVL Telecom.
  
  PROCEDIMENTOS:
  1. Para qualquer ação financeira ou suporte técnico avançado, PEÇA O CPF do cliente se você ainda não tiver as informações dele.
  2. Use 'get_client_info' assim que receber o CPF para validar quem é o cliente.
  3. Se o cliente pedir boleto ou fatura, use 'list_invoices' após identificar o cliente.
  4. Se o cliente estiver sem internet por falta de pagamento, ofereça a "Liberação de Confiança" e use 'trust_unlock'.
  
  REGRAS DE WHATSAPP:
  - Use negritos (*texto*) em informações importantes.
  - Use emojis para deixar a conversa leve.
  - Seja direto: ninguém gosta de ler textão no Zap.`
});

export const aiService = {
  generateResponse: async (messages: Message[], clientName: string): Promise<string> => {
    try {
      let history = messages.slice(-15).map(m => ({
        role: m.isAdmin ? "model" : "user",
        parts: [{ text: m.content || "" }],
      }));

      const firstUserIndex = history.findIndex(h => h.role === "user");
      if (firstUserIndex !== -1) history = history.slice(firstUserIndex);
      else history = [];

      const chat = model.startChat({ history: history.slice(0, -1) });
      const lastMessage = messages[messages.length - 1].content || "";
      
      // Enviar mensagem para o Josué
      let result = await chat.sendMessage(`Cliente ${clientName} diz: ${lastMessage}`);
      let response = result.response;
      
      // Lógica de Function Calling (Loop para tratar múltiplas chamadas se necessário)
      const call = response.functionCalls()?.[0];
      if (call) {
        console.log(`🛠️ Josué chamando ferramenta: ${call.name}`, call.args);
        let toolResult;

        if (call.name === "get_client_info") {
          const client = await ixcService.getClienteByCPF(call.args.cpf as string);
          if (client) {
            // Buscar contratos também para ter o ID do contrato para desbloqueio futuro
            const contracts = await ixcService.getContratosByCliente(client.id);
            toolResult = { 
              status: "sucesso", 
              cliente: { 
                id: client.id, 
                nome: client.razao || client.nome, 
                endereco: client.endereco,
                contratos: contracts.map(c => ({ id: c.id, plano: c.contrato, status: c.status }))
              } 
            };
          } else {
            toolResult = { status: "erro", mensagem: "Cliente não encontrado com este CPF." };
          }
        } 
        else if (call.name === "list_invoices") {
          const faturas = await ixcService.getFaturasAbertas(call.args.clientId as string);
          toolResult = { 
            status: "sucesso", 
            faturas: faturas.map(f => ({ id: f.id, valor: f.valor, vencimento: f.data_vencimento })) 
          };
        }
        else if (call.name === "trust_unlock") {
          const res = await ixcService.unlockContract(call.args.contractId as string);
          toolResult = res;
        }

        // Enviar o resultado da ferramenta de volta para o Josué gerar a resposta final
        result = await chat.sendMessage([{ functionResponse: { name: call.name, response: toolResult } }]);
        response = result.response;
      }

      return response.text();
    } catch (error) {
      console.error("❌ Erro no Josué:", error);
      return "Puxa, deu um tilt aqui no meu sistema... 😵 Pode repetir o que você precisa? O Josué aqui está pronto para tentar de novo!";
    }
  }
};

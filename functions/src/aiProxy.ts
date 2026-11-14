import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { verifyAuth } from "./config/auth";
import { getIspfyConfig } from "./config/env";
import { IspfyBackendService } from "./ispfyBackendService";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const GEMINI_MODEL = "gemini-2.5-flash";

type CopyTaskType = "billing" | "blocked" | "financial_analysis" | "individual_debt";

interface CopyTaskSpec {
  temperature: number;
  maxOutputTokens: number;
  trimQuotes: boolean;
  buildPrompt: (payload: Record<string, any>) => string;
}

function requireGeminiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "GEMINI_API_KEY não configurada nos Secrets do Firebase Functions."
    );
  }
  return apiKey;
}

function getIspfyService(): IspfyBackendService {
  const { host, token } = getIspfyConfig();
  return new IspfyBackendService(host, token);
}

function formatDateIso(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatKbytesToReadable(kbytes: unknown): string {
  const kb = Number(kbytes || 0);
  if (!Number.isFinite(kb) || kb <= 0) return "0 MB";
  if (kb >= 1024 * 1024) {
    return `${(kb / (1024 * 1024)).toFixed(2)} GB`;
  }
  return `${(kb / 1024).toFixed(2)} MB`;
}

function buildBillingPrompt(params: Record<string, any>): string {
  const nomeCliente = String(params.nomeCliente || "");
  const valor = String(params.valor || "");
  const dataVencimento = String(params.dataVencimento || "");
  const diasAtraso = Number(params.diasAtraso || 0);
  const linkBoleto = String(params.linkBoleto || "");
  const primeiroNome = nomeCliente.trim().split(" ")[0] || "Cliente";

  let situacao = "";
  if (diasAtraso > 0) {
    situacao = `A fatura está em atraso há ${diasAtraso} dia${diasAtraso > 1 ? "s" : ""}`;
  } else if (diasAtraso === 0) {
    situacao = "A fatura vence HOJE";
  } else {
    const diasRestantes = Math.abs(diasAtraso);
    situacao = `A fatura vence em ${diasRestantes} dia${diasRestantes > 1 ? "s" : ""}`;
  }

  let tom = "amigável e leve";
  if (diasAtraso > 5) {
    tom = "sério, formal, mas educado e profissional";
  } else if (diasAtraso > 0) {
    tom = "educado, gentil, focado em resolver um possível esquecimento";
  } else if (diasAtraso === 0) {
    tom = "animado e prestativo, como um lembrete amigável do dia";
  } else {
    tom = "agradecido e atencioso, valorizando a antecipação";
  }

  return `Você é um(a) Assistente de Sucesso do Cliente da "AVL Telecom", focado(a) em garantir a melhor experiência para os assinantes de internet.
Sua missão é escrever UMA única mensagem de WhatsApp cobrando o cliente ${nomeCliente}.

CONTEXTO:
- Nome: ${primeiroNome}
- Valor: *${valor}*
- Vencimento: *${dataVencimento}*
- Situação: ${situacao}
- Tom exigido: ${tom}

REGRAS ESTRITAS:
1. Comece com uma saudação calorosa e chame pelo nome (${primeiroNome}).
2. Escreva o valor e a data de vencimento obrigatoriamente.
3. Adapte a mensagem para a situação e o tom exigido. Use gatilhos mentais de reciprocidade (mostrar que valorizamos o cliente) e escassez/urgência (para evitar cortes, se estiver muito atrasado).
4. Varie a mensagem para que cada cliente sinta que foi escrita exclusivamente para ele.
5. A PENÚLTIMA linha da sua mensagem OBRIGATORIAMENTE DEVE SER EXATAMENTE O TEXTO ABAIXO:
${linkBoleto}

6. A ÚLTIMA linha da sua mensagem DEVE SER EXATAMENTE:
_Mensagem automática gerada por IA. Equipe AVL Telecom_`;
}

function buildBlockedPrompt(params: Record<string, any>): string {
  const nomeCliente = String(params.nomeCliente || "");
  const dataVencimento = String(params.dataVencimento || "");
  const totalFaturas = Number(params.totalFaturas || 1);
  const valorTotal = String(params.valorTotal || "");
  const linkBoleto = params.linkBoleto ? String(params.linkBoleto) : "";
  const primeiroNome = nomeCliente.trim().split(" ")[0] || "Cliente";

  const faturasInfo = totalFaturas > 1
    ? `${totalFaturas} faturas em aberto com um total de *${valorTotal}*, sendo a mais antiga com vencimento em *${dataVencimento}*`
    : `1 fatura em aberto no valor de *${valorTotal}* com vencimento em *${dataVencimento}*`;

  const linkLinha = linkBoleto
    ? `\n- Se desejar pagar pelo link direto: ${linkBoleto}`
    : "";

  return `Você é um atendente da AVL Telecom. Gere UMA mensagem de WhatsApp para um cliente cuja internet foi BLOQUEADA por inadimplência.

REGRAS OBRIGATÓRIAS:
1. Tom: Empático, humano e firme. Nunca agressivo ou robótico.
2. DEVE mencionar claramente que a internet está bloqueada por fatura(s) em atraso.
3. DEVE mencionar o número de faturas e o valor total: ${faturasInfo}.
4. Comprimento: Curto e direto (4 a 6 linhas).
5. Gênero: Analise "${primeiroNome}" para adaptar flexões (ex: "Fica tranquilo" vs "Fica tranquila").
6. NUNCA use asteriscos duplos (**texto**). Use apenas *texto* para WhatsApp.
7. Inclua 1 a 2 emojis no máximo.
8. Ação esperada: Peça para responder a mensagem ou usar o link para regularizar e reativar a internet.
9. Use um toque de humor leve e moderado (ex: "queremos te ver navegando de novo e não apenas nas ondas do mar"), mas mantenha o respeito.
10. Varie bem o texto para que não pareça repetitivo.
11. NUNCA encurte ou altere o link de pagamento. Ele deve ser escrito OBRIGATORIAMENTE por extenso exatamente como fornecido.
12. Assine como um nome humano (ex: Estela, Josué, Luan) seguido de " – AVL Telecom".
${linkBoleto ? "13. DEVE incluir o link de pagamento na penúltima linha exatamente assim: 👉 Link para pagamento: " + linkBoleto : "13. NÃO inclua link de pagamento. O cliente deve responder para ser atendido."}
14. A ÚLTIMA linha da sua mensagem DEVE SER EXATAMENTE: "_Mensagem automática gerada por IA (Gemini). Att, [Nome] – AVL Telecom_"
15. NUNCA PARE DE ESCREVER NO MEIO DA FRASE. Você DEVE terminar a mensagem com a assinatura completa acima.

ESTRUTURA DESEJADA:
{Saudação}, ${primeiroNome}! {Emoji}

{Explicação do bloqueio + ${faturasInfo}}.

{Instrução de como regularizar${linkBoleto ? " (link abaixo + responder a mensagem)" : " (responder a mensagem)"}}.
${linkBoleto ? "👉 Link para pagamento: " + linkBoleto + "\n" : ""}
_Mensagem automática gerada por IA (Gemini). Att, Nome do Atendente – AVL Telecom_

DADOS DO CLIENTE:
- Nome: ${nomeCliente}${linkLinha}
- Situação financeira: ${faturasInfo}

Retorne APENAS a mensagem final formatada.`;
}

function buildFinancialAnalysisPrompt(params: Record<string, any>): string {
  const inflow = String(params.inflow || "");
  const outflow = String(params.outflow || "");
  const balance = String(params.balance || "");
  const debtTotal = String(params.debtTotal || "");
  const period = String(params.period || "");
  const topDebtors = Array.isArray(params.topDebtors) ? params.topDebtors : [];
  const debtorsText = topDebtors
    .map((d: any) => `- ${d.nome}: *${d.valor}*`)
    .join("\n");

  return `Você é um consultor financeiro inteligente da AVL Telecom. Analise os seguintes dados financeiros do período de ${period} e gere um resumo humanizado, direto e estratégico para o gestor (Niall).

DADOS:
- Entradas: *${inflow}*
- Saídas: *${outflow}*
- Saldo Líquido: *${balance}*
- Inadimplência Total: *${debtTotal}*

PRINCIPAIS DEVEDORES CRÍTICOS:
${debtorsText}

REGRAS:
1. Comece com uma saudação amigável (ex: "Fala, Niall!", "Tudo certo por aí?").
2. Seja analítico mas humano. Comente se o saldo está positivo ou se a inadimplência está preocupante.
3. Dê uma sugestão rápida de ação (ex: "Vale focar na cobrança desses top 10 aqui...").
4. Use emojis moderados para destacar pontos.
5. Formatação: Use apenas asteriscos simples (*) para negrito no WhatsApp.
6. Assinatura: "_Análise inteligente gerada por IA (Gemini)._"

Retorne APENAS o texto da mensagem.`;
}

function buildIndividualDebtPrompt(params: Record<string, any>): string {
  const nomeCliente = String(params.nomeCliente || "");
  const valorOriginal = String(params.valorOriginal || "");
  const diasAtraso = Number(params.diasAtraso || 0);
  const dataVencimento = String(params.dataVencimento || "");
  const linkBoleto = params.linkBoleto ? String(params.linkBoleto) : undefined;
  const primeiroNome = nomeCliente.trim().split(" ")[0] || "Cliente";

  return `Gere uma mensagem de WhatsApp ÚNICA, amigável e descontraída para o cliente ${nomeCliente} que está com uma fatura de *${valorOriginal}* vencida há ${diasAtraso} dias (vencimento em ${dataVencimento}).

REGRAS:
1. Tom: Muito humano, use gírias leves se fizer sentido, seja empático (ex: "vimos que o boleto acabou ficando pra trás no corre do dia...").
2. NUNCA pareça um robô de cobrança padrão.
3. Use o primeiro nome: ${primeiroNome}.
4. Obrigatoriamente inclua o valor (*${valorOriginal}*) e a data (*${dataVencimento}*).
5. Se houver link (${linkBoleto}), inclua-o de forma natural.
6. A assinatura final deve ser: "_Atenciosamente, Equipe de Sucesso AVL Telecom_".

Retorne APENAS o texto.`;
}

const COPY_TASK_SPECS: Record<CopyTaskType, CopyTaskSpec> = {
  billing: {
    temperature: 0.7,
    maxOutputTokens: 2048,
    trimQuotes: true,
    buildPrompt: buildBillingPrompt,
  },
  blocked: {
    temperature: 0.2,
    maxOutputTokens: 1500,
    trimQuotes: true,
    buildPrompt: buildBlockedPrompt,
  },
  financial_analysis: {
    temperature: 0.7,
    maxOutputTokens: 1000,
    trimQuotes: false,
    buildPrompt: buildFinancialAnalysisPrompt,
  },
  individual_debt: {
    temperature: 0.9,
    maxOutputTokens: 800,
    trimQuotes: false,
    buildPrompt: buildIndividualDebtPrompt,
  },
};

/**
 * Proxy autenticado para geração de mensagens e análises financeiras via Gemini no servidor.
 */
export const aiGenerateCopy = functions
  .runWith({ secrets: ["GEMINI_API_KEY"], timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    verifyAuth(context);

    const task = data?.task as CopyTaskType;
    const payload = (data?.payload || {}) as Record<string, any>;
    const spec = COPY_TASK_SPECS[task];

    if (!spec) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Tipo de tarefa de IA inválido."
      );
    }

    const apiKey = requireGeminiKey();
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        temperature: spec.temperature,
        topP: 0.95,
        maxOutputTokens: spec.maxOutputTokens,
      },
    });

    try {
      const prompt = spec.buildPrompt(payload);
      const result = await model.generateContent(prompt);
      const rawText = result.response.text()?.trim();
      if (!rawText) {
        return { text: null };
      }

      const text = spec.trimQuotes
        ? rawText.replace(/^["']|["']$/g, "")
        : rawText;
      return { text };
    } catch (error: any) {
      console.error(`❌ [aiGenerateCopy:${task}] Erro:`, error.message);
      return { text: null };
    }
  });

const josueTools: any[] = [
  {
    functionDeclarations: [
      {
        name: "get_client_info",
        description:
          "Busca informações cadastrais completas do cliente no ISPFY (nome, endereço, bairro, contratos e se há manutenção ativa na região) pelo CPF ou CNPJ.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            cpf: { type: SchemaType.STRING, description: "CPF ou CNPJ do cliente (apenas números ou formatado)." },
          },
          required: ["cpf"],
        },
      },
      {
        name: "list_invoices",
        description:
          "Lista as faturas em aberto do cliente no ISPFY com código PIX Copia e Cola, linha digitável do boleto e link de pagamento.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            clientId: { type: SchemaType.STRING, description: "O ID do cliente no ISPFY (opcional se enviar cpf)." },
            cpf: { type: SchemaType.STRING, description: "CPF ou CNPJ do cliente (preferencial para PIX e boleto)." },
          },
        },
      },
      {
        name: "trust_unlock",
        description:
          "Realiza a Liberação em Confiança (desbloqueio temporário) de um contrato suspenso por atraso no ISPFY.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            contractId: { type: SchemaType.STRING, description: "ID do contrato a ser liberado em confiança." },
            cpf: { type: SchemaType.STRING, description: "CPF ou CNPJ do cliente (opcional, recomendado)." },
          },
          required: ["contractId"],
        },
      },
      {
        name: "check_connection_status",
        description:
          "Diagnostica o status em tempo real da conexão/ponto de acesso do assinante no ISPFY (online/offline, IP, CTO/OLT, sinal óptico) e verifica rompimentos na região.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            cpf: { type: SchemaType.STRING, description: "CPF ou CNPJ do cliente para consulta de ponto." },
          },
          required: ["cpf"],
        },
      },
      {
        name: "get_bandwidth_usage",
        description:
          "Consulta o consumo real de dados (download e upload) de um ponto de acesso nos últimos dias.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            cpf: { type: SchemaType.STRING, description: "CPF ou CNPJ do cliente (caso não tenha idPonto)." },
            idPonto: { type: SchemaType.STRING, description: "ID do ponto de acesso no ISPFY (opcional)." },
            dias: { type: SchemaType.INTEGER, description: "Quantidade de dias (máximo 30, padrão 30)." },
          },
        },
      },
      {
        name: "open_support_ticket",
        description:
          "Abre uma Ordem de Serviço / Ticket de suporte no ISPFY para o contrato do cliente, somente quando necessário e quando não houver manutenção regional em andamento.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            contractId: { type: SchemaType.STRING, description: "ID do contrato no ISPFY." },
            cpf: { type: SchemaType.STRING, description: "CPF/CNPJ do cliente para validação e checagem de manutenção regional." },
            assunto: { type: SchemaType.STRING, description: "Resumo curto do problema (ex: Cliente sem conexão / ONU LOS)." },
            descricao: { type: SchemaType.STRING, description: "Descrição detalhada relatada pelo cliente no atendimento." },
          },
          required: ["contractId", "assunto", "descricao"],
        },
      },
    ],
  },
];

const JOSUE_SYSTEM_INSTRUCTION = `Você é o Josué, atendente de elite e suporte técnico N1 da "AVL Telecom".
Sua missão é resolver o problema do cliente no WhatsApp/painel com agilidade, clareza e simpatia.

PERSONALIDADE:
- Educado, alegre, humano e direto (ninguém gosta de ler textão no WhatsApp).
- Cumprimente conforme o contexto ("Bom dia", "Boa tarde", "Boa noite").
- Se o cliente for rude, mantenha a postura profissional e acolhedora, focando na solução.
- Nunca saia do contexto da AVL Telecom e nunca invente dados que não vieram das ferramentas.

PROCEDIMENTOS OBRIGATÓRIOS:
1. Para qualquer consulta financeira ou técnica, SEMPRE peça o CPF ou CNPJ se ainda não tiver identificado o assinante na conversa.
2. Assim que receber o CPF/CNPJ, chame 'get_client_info'.
3. Se o retorno de 'get_client_info' ou 'check_connection_status' indicar *manutencao_regiao* ativa, avise IMEDIATAMENTE o cliente com transparência sobre a manutenção/rompimento na região dele e a previsão de retorno — NÃO abra novo ticket repetido se a causa já for o rompimento informado!
4. Se o cliente pedir 2ª via, boleto ou PIX, use 'list_invoices' enviando o CPF sempre que possível e entregue o código *PIX Copia e Cola* em mensagem fácil de copiar (se disponível), além do valor, vencimento e link.
5. Se o contrato estiver bloqueado/suspenso por falta de pagamento e o cliente pedir para liberar ou estiver sem internet por bloqueio, chame 'trust_unlock'.
6. Se o cliente relatar lentidão, queda ou "sem internet", chame 'check_connection_status' (e 'get_bandwidth_usage' se pedir consumo).
7. Se o ponto estiver offline e NÃO houver rompimento ativo na região nem bloqueio financeiro, peça para verificar se o roteador/ONU está ligado na tomada e se a luz vermelha (LOS) pisca; persistindo a falha, use 'open_support_ticket' e informe o protocolo ao cliente.

REGRAS DE WHATSAPP:
- Use negritos (*texto*) em valores, vencimentos, protocolos e avisos importantes.
- Use poucos emojis estratégicos.`;

const josueToolHandlers: Record<string, (args: Record<string, any>) => Promise<any>> = {
  get_client_info: async (args) => {
    const ispfy = getIspfyService();
    const docRaw = String(args.cpf || "");
    const client = await ispfy.buscarClientePorDocumento(docRaw);
    if (!client) {
      return { status: "erro", mensagem: "Cliente não encontrado com este CPF/CNPJ." };
    }

    const [contracts, assinaturaInfo, manutencao] = await Promise.all([
      ispfy.buscarContratosPorCliente(client.id),
      ispfy.consultarAssinanteInfo(client.cpf_cnpj || docRaw).catch(() => null),
      ispfy.verificarManutencaoAtivaNaRegiao(admin.firestore(), client.bairro, client.cidade),
    ]);

    return {
      status: "sucesso",
      cliente: {
        id: client.id,
        nome: client.razao || client.nome_razao || client.nome,
        cpf_cnpj: client.cpf_cnpj,
        endereco: `${client.endereco || ""}${client.numero ? `, ${client.numero}` : ""}`.trim(),
        bairro: client.bairro || "",
        cidade: client.cidade || "",
        contratos: contracts.map((c: any) => ({
          id: c.id,
          plano: c.contrato || c.plano,
          status: c.status,
          ativo: c.ativo,
        })),
        pontos: assinaturaInfo?.pontos ?? [],
      },
      manutencao_regiao: manutencao
        ? {
            ativa: true,
            titulo: manutencao.titulo || manutencao.motivo || "Manutenção Regional",
            mensagem: manutencao.mensagem || manutencao.motivo || "Equipe em atuação na região.",
            previsaoRetorno: manutencao.previsao || "Equipe técnica já em atuação",
          }
        : { ativa: false },
    };
  },

  list_invoices: async (args) => {
    const ispfy = getIspfyService();
    let doc = String(args.cpf || "").trim();
    let clientId = String(args.clientId || "").trim();

    if (!doc && clientId) {
      const cliente = await ispfy.buscarClientePorId(clientId);
      doc = String(cliente?.cpf_cnpj || "");
    } else if (doc && !clientId) {
      const cliente = await ispfy.buscarClientePorDocumento(doc);
      if (cliente) {
        clientId = String(cliente.id);
        doc = String(cliente.cpf_cnpj || doc);
      }
    }

    if (!doc && !clientId) {
      return { status: "erro", mensagem: "CPF/CNPJ ou ID do cliente não informado." };
    }

    const boletosTool = doc
      ? await ispfy.consultarBoletosAssinante(doc, { status: "aberto" }).catch(() => [])
      : [];

    if (boletosTool.length > 0) {
      return {
        status: "sucesso",
        faturas: boletosTool.map((b) => ({
          id: b.id,
          valor: b.valor,
          vencimento: b.vencimento,
          linha_digitavel: b.linha || "",
          pix_copia_cola: b.pix || "",
          link: b.linkPublico || b.linkInterno || "",
        })),
      };
    }

    if (!clientId) {
      return { status: "sucesso", faturas: [] };
    }

    const openInvoices = await ispfy.buscarFaturasAbertasPorCliente(clientId);
    return {
      status: "sucesso",
      faturas: openInvoices.map((f: any) => ({
        id: f.id,
        valor: f.valor,
        vencimento: f.data_vencimento,
        linha_digitavel: f.linha_digitavel || "",
        pix_copia_cola: f.pix_copia_cola || f.qr_code || "",
        link: f.link_boleto || f.link || "",
      })),
    };
  },

  trust_unlock: async (args) => {
    const ispfy = getIspfyService();
    const contractId = String(args.contractId || "").trim();
    if (!contractId) {
      return { success: false, message: "ID do contrato não informado." };
    }
    return ispfy.liberarEmConfianca(contractId);
  },

  check_connection_status: async (args) => {
    const ispfy = getIspfyService();
    const docRaw = String(args.cpf || "").trim();
    if (!docRaw) {
      return { status: "erro", mensagem: "CPF/CNPJ obrigatório para verificar o ponto." };
    }

    const client = await ispfy.buscarClientePorDocumento(docRaw);
    const [info, pontos, manutencao] = await Promise.all([
      ispfy.consultarAssinanteInfo(client?.cpf_cnpj || docRaw).catch(() => null),
      client?.id ? ispfy.consultarStatusPontos(String(client.id)).catch(() => []) : Promise.resolve([]),
      ispfy.verificarManutencaoAtivaNaRegiao(admin.firestore(), client?.bairro, client?.cidade),
    ]);

    return {
      status: "sucesso",
      cliente_nome: client?.razao || client?.nome || info?.nome || "",
      bairro: client?.bairro || info?.bairro || "",
      pontos: pontos.length > 0 ? pontos : info?.pontos ?? [],
      manutencao_regiao: manutencao
        ? {
            ativa: true,
            titulo: manutencao.titulo || manutencao.motivo || "Manutenção Regional",
            mensagem: manutencao.mensagem || manutencao.motivo || "Equipe em atuação na região.",
            previsaoRetorno: manutencao.previsao || "Em atuação",
          }
        : { ativa: false },
    };
  },

  get_bandwidth_usage: async (args) => {
    const ispfy = getIspfyService();
    let idPonto = String(args.idPonto || "").trim();
    const doc = String(args.cpf || "").trim();
    const dias = Math.min(30, Math.max(1, Number(args.dias || 30)));

    if (!idPonto && doc) {
      const client = await ispfy.buscarClientePorDocumento(doc).catch(() => null);
      const pontos = client?.id ? await ispfy.consultarStatusPontos(String(client.id)).catch(() => []) : [];
      if (pontos[0]?.id_ponto) {
        idPonto = String(pontos[0].id_ponto);
      } else {
        const info = await ispfy.consultarAssinanteInfo(doc).catch(() => null);
        const firstPoint = Array.isArray(info?.pontos) ? info.pontos[0] : null;
        if (firstPoint?.id_ponto || firstPoint?.id) {
          idPonto = String(firstPoint.id_ponto || firstPoint.id);
        }
      }
    }

    if (!idPonto) {
      return { status: "erro", mensagem: "Ponto de acesso não encontrado para consulta de consumo." };
    }

    const hoje = new Date();
    const inicio = new Date(hoje.getTime() - dias * 24 * 60 * 60 * 1000);
    const consumo = await ispfy.consultarConsumoPonto(
      idPonto,
      formatDateIso(inicio),
      formatDateIso(hoje)
    );

    return {
      status: "sucesso",
      id_ponto: idPonto,
      periodo_dias: dias,
      download: formatKbytesToReadable(consumo?.download_mes_kbytes),
      upload: formatKbytesToReadable(consumo?.upload_mes_kbytes),
    };
  },

  open_support_ticket: async (args) => {
    const ispfy = getIspfyService();
    const doc = String(args.cpf || "").trim();
    const assunto = String(args.assunto || "Suporte Técnico via WhatsApp").trim();
    const descricao = String(args.descricao || "").trim();
    let clientId = String(args.clientId || "").trim();

    if (!descricao) {
      return { success: false, message: "Descrição é obrigatória para abrir chamado." };
    }

    if (doc) {
      const client = await ispfy.buscarClientePorDocumento(doc);
      if (client) {
        if (!clientId) clientId = String(client.id);
        const manutencao = await ispfy.verificarManutencaoAtivaNaRegiao(
          admin.firestore(),
          client.bairro,
          client.cidade
        );
        if (manutencao) {
          const areaLabel = manutencao.bairros?.join(", ") || manutencao.bairro || "Região";
          return {
            success: false,
            blocked_by_regional_outage: true,
            manutencao_regiao: manutencao,
            message: `Região ${areaLabel} já possui manutenção ativa (${manutencao.titulo || manutencao.motivo || "Incidente regional"}). Informe o cliente ao invés de abrir novo chamado.`,
          };
        }
      }
    }

    if (!clientId) {
      return { success: false, message: "Informe o CPF para localizar o cliente antes de abrir o chamado." };
    }

    return ispfy.criarTicket({
      id_cliente: clientId,
      requisicao: `${assunto}: ${descricao}\n\n[Aberto automaticamente pelo Assistente Josué IA]`,
    });
  },
};

async function sendChatWithRetry(chat: any, payload: any, retries = 3): Promise<any> {
  try {
    return await chat.sendMessage(payload);
  } catch (error: any) {
    if (retries > 0 && error?.message?.includes("503")) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return sendChatWithRetry(chat, payload, retries - 1);
    }
    throw error;
  }
}

/**
 * Executa o assistente Josué IA com histórico e Function Calling ISPFY.
 * Compartilhado entre o chat interno do painel (`aiChatJosue`) e o webhook do WhatsApp.
 */
export async function runJosueChat(params: {
  messages: Array<{ isAdmin?: boolean; content: string }>;
  clientName?: string;
  contextInfo?: string;
}): Promise<string> {
  const apiKey = requireGeminiKey();
  const genAI = new GoogleGenerativeAI(apiKey);
  const systemInstruction = params.contextInfo
    ? `${JOSUE_SYSTEM_INSTRUCTION}\n\nCONTEXTO DETECTADO DA SESSÃO:\n${params.contextInfo}`
    : JOSUE_SYSTEM_INSTRUCTION;

  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    tools: josueTools,
    systemInstruction,
  });

  const rawMessages = params.messages.slice(-15);
  let history = rawMessages.map((m) => ({
    role: m.isAdmin ? "model" : "user",
    parts: [{ text: String(m.content || "") }],
  }));

  const firstUserIndex = history.findIndex((h) => h.role === "user");
  if (firstUserIndex !== -1) history = history.slice(firstUserIndex);
  else history = [];

  const chat = model.startChat({ history: history.slice(0, -1) });
  const lastMessage = String(rawMessages[rawMessages.length - 1]?.content || "");
  const clientName = params.clientName || "Cliente";

  let result = await sendChatWithRetry(chat, `Cliente ${clientName} diz: ${lastMessage}`);
  let response = result.response;

  for (let round = 0; round < 5; round++) {
    const calls = response.functionCalls?.();
    if (!calls || calls.length === 0) break;

    const functionResponses = await Promise.all(
      calls.map(async (call: any) => {
        const handler = josueToolHandlers[call.name];
        const toolResult = handler
          ? await handler((call.args || {}) as Record<string, any>)
          : { status: "erro", mensagem: `Ferramenta desconhecida: ${call.name}` };

        return {
          functionResponse: {
            name: call.name,
            response: toolResult,
          },
        };
      })
    );

    result = await sendChatWithRetry(chat, functionResponses);
    response = result.response;
  }

  return response.text();
}

/**
 * Proxy autenticado para o assistente "Josué" (chat no painel) com Function Calling no ISPFY.
 */
export const aiChatJosue = functions
  .runWith({ secrets: ["GEMINI_API_KEY"], timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    verifyAuth(context);

    const rawMessages = Array.isArray(data?.messages) ? data.messages : [];
    const clientName = String(data?.clientName || "Cliente");

    if (rawMessages.length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Lista de mensagens é obrigatória."
      );
    }

    try {
      const text = await runJosueChat({
        messages: rawMessages,
        clientName,
      });
      return { text };
    } catch (error: any) {
      console.error("❌ Erro no aiChatJosue:", error);
      if (error?.message?.includes("503")) {
        return {
          text: "Puxa, meus servidores estão passando por uma instabilidade momentânea (muito movimento hoje!). Você poderia mandar um 'Oi' de novo daqui a um minutinho? 🙏",
        };
      }
      return {
        text: "Puxa, deu um tilt aqui no meu sistema... 😵 Pode repetir o que você precisa? O Josué aqui está pronto para tentar de novo!",
      };
    }
  });


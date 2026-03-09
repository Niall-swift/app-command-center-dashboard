/**
 * Gemini AI Service
 * Gera mensagens de cobrança únicas e humanizadas para cada cliente via Google Gemini API.
 */

const GEMINI_API_KEY = 'AIzaSyA4Q6BN5vKPUQrEiEONprIknhS-loVYYo0';
// Mantendo gemini-2.5-flash pois a key não tem acesso ao 1.5-pro.
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

export interface GeminiMessageParams {
  nomeCliente: string;
  valor: string;            // ex: "R$ 89,90"
  dataVencimento: string;   // ex: "05/03/2026"
  diasAtraso: number;       // >0 = atrasado, 0 = vence hoje, <0 = a vencer
  linkBoleto: string;
}

function buildPrompt(params: GeminiMessageParams): string {
  const { nomeCliente, valor, dataVencimento, diasAtraso, linkBoleto } = params;
  const primeiroNome = nomeCliente.trim().split(' ')[0];

  let situacao = '';
  if (diasAtraso > 0) {
    situacao = `A fatura está em atraso há ${diasAtraso} dia${diasAtraso > 1 ? 's' : ''}`;
  } else if (diasAtraso === 0) {
    situacao = `A fatura vence HOJE`;
  } else {
    const diasRestantes = Math.abs(diasAtraso);
    situacao = `A fatura vence em ${diasRestantes} dia${diasRestantes > 1 ? 's' : ''}`;
  }

  return `Escreva UMA única mensagem humanizada de WhatsApp cobrando o cliente ${nomeCliente}.

REGRAS ESTRITAS:
- Diga: Olá, ${primeiroNome} (ou E aí/Tudo bem).
- Você DEVE escrever o valor: *${valor}*
- Você DEVE escrever a data: *${dataVencimento}*
- O motivo: ${situacao}.
- Peça o pagamento com educação. 
- A PENÚLTIMA linha da sua mensagem OBRIGATORIAMENTE DEVE SER EXATAMENTE O TEXTO ABAIXO, SEM CORTAR NADA:
  👉 Segue o link para pagamento: ${linkBoleto}
- A ÚLTIMA linha da sua mensagem deve ser a despedida: "Abraços da equipe AVL Telecom! (Caso já tenha pago, por favor desconsidere)".

Não pare de escrever até a despedida final.`;
}

/**
 * Gera uma mensagem de cobrança humanizada usando o Google Gemini.
 * Em caso de erro, retorna null para que o chamador use o fallback.
 */
export async function generateAIBillingMessage(params: GeminiMessageParams): Promise<string | null> {
  try {
    const prompt = buildPrompt(params);

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          topP: 0.95,
          maxOutputTokens: 1500,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Gemini API error:', response.status, errorData);
      return null;
    }

    const data = await response.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error('❌ Gemini retornou resposta vazia:', data);
      return null;
    }

    // Limpar possíveis aspas no início/fim
    const cleaned = text.trim().replace(/^["']|["']$/g, '');
    console.log('🤖 Mensagem Gemini gerada para', params.nomeCliente, ':', cleaned.slice(0, 60) + '...');
    return cleaned;
  } catch (error) {
    console.error('❌ Erro ao chamar Gemini AI:', error);
    return null;
  }
}

export interface GeminiBlockedMessageParams {
  nomeCliente: string;
  dataVencimento: string;  // ex: "05/03/2026" — fatura mais antiga
  totalFaturas: number;    // quantas faturas estão em aberto
  valorTotal: string;      // ex: "R$ 189,80" — soma de todas
  linkBoleto?: string;     // link de pagamento da fatura mais antiga (quando disponível)
}

/**
 * Gera uma mensagem humanizada para cliente BLOQUEADO usando o Google Gemini.
 * Inclui dados financeiros completos do IXC: quantidade de faturas, valor total e link.
 * Em caso de erro, retorna null para o chamador usar o fallback.
 */
export async function generateAIBlockedMessage(params: GeminiBlockedMessageParams): Promise<string | null> {
  const { nomeCliente, dataVencimento, totalFaturas, valorTotal, linkBoleto } = params;
  const primeiroNome = nomeCliente.trim().split(' ')[0];

  const faturasInfo = totalFaturas > 1
    ? `${totalFaturas} faturas em aberto com um total de *${valorTotal}*, sendo a mais antiga com vencimento em *${dataVencimento}*`
    : `1 fatura em aberto no valor de *${valorTotal}* com vencimento em *${dataVencimento}*`;

  const linkLinha = linkBoleto
    ? `\n- Se desejar pagar pelo link direto: ${linkBoleto}`
    : '';

  const prompt = `Você é um atendente da AVL Telecom. Gere UMA mensagem de WhatsApp para um cliente cuja internet foi BLOQUEADA por inadimplência.

REGRAS OBRIGATÓRIAS:
1. Tom: Empático, humano e firme. Nunca agressivo ou robótico.
2. DEVE mencionar claramente que a internet está bloqueada por fatura(s) em atraso.
3. DEVE mencionar o número de faturas e o valor total: ${faturasInfo}.
4. Comprimento: Curto e direto (4 a 6 linhas).
5. Gênero: Analise "${primeiroNome}" para adaptar flexões (ex: "Fica tranquilo" vs "Fica tranquila").
6. NUNCA use asteriscos duplos (**texto**). Use apenas *texto* para WhatsApp.
7. Inclua 1 a 2 emojis no máximo.
8. Ação esperada: Peça para responder a mensagem ou usar o link para regularizar e reativar a internet.
9. Assine como um nome humano (ex: Estela, Josué, Luan) seguido de " – AVL Telecom".
${linkBoleto ? '10. DEVE incluir o link de pagamento na penúltima linha exatamente assim: 👉 Link para pagamento: ' + linkBoleto : '10. NÃO inclua link de pagamento. O cliente deve responder para ser atendido.'}
11. NUNCA PARE DE ESCREVER NO MEIO DA FRASE. Você DEVE terminar a mensagem com a assinatura.

ESTRUTURA DESEJADA:
{Saudação}, ${primeiroNome}! {Emoji}

{Explicação do bloqueio + ${faturasInfo}}.

{Instrução de como regularizar${linkBoleto ? ' (link abaixo + responder a mensagem)' : ' (responder a mensagem)'}}.
${linkBoleto ? '👉 Link para pagamento: ' + linkBoleto + '\n' : ''}
_Att, Nome do Atendente – AVL Telecom_

DADOS DO CLIENTE:
- Nome: ${nomeCliente}${linkLinha}
- Situação financeira: ${faturasInfo}

Retorne APENAS a mensagem final formatada.`;

  try {
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          topP: 0.95,
          maxOutputTokens: 1500,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Gemini API error (bloqueado):', response.status, errorData);
      return null;
    }

    const data = await response.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error('❌ Gemini retornou resposta vazia (bloqueado):', data);
      return null;
    }

    const cleaned = text.trim().replace(/^["']|["']$/g, '');
    console.log('🤖 Mensagem Gemini (bloqueado) gerada para', nomeCliente, ':', cleaned.slice(0, 60) + '...');
    return cleaned;
  } catch (error) {
    console.error('❌ Erro ao chamar Gemini AI (bloqueado):', error);
    return null;
  }
}

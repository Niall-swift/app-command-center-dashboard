/**
 * @fileoverview Gerador de Comprovante de Pagamento via Canvas
 * Tenta gerar um PNG usando node-canvas. Se falhar, retorna null
 * para que o chamador use a mensagem de texto como fallback.
 */

export interface ReceiptData {
  clientName: string;
  valor: string;
  data: string;
  hora: string;
  descricao: string;
  cobrancaId?: string;
}

/**
 * Tenta gerar o comprovante em PNG (base64 com data URI).
 * Retorna `null` se canvas nao estiver disponivel ou falhar.
 */
export async function generatePaymentReceiptImage(data: ReceiptData): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createCanvas } = require("canvas") as typeof import("canvas");

    const WIDTH = 760;
    const HEIGHT = 440;
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    // Fundo gradiente
    const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(1, "#1e293b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Barra lateral verde
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(0, 0, 6, HEIGHT);

    // Cabecalho
    ctx.fillStyle = "#22c55e";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText("Pagamento Recebido!", 36, 56);

    ctx.fillStyle = "#64748b";
    ctx.font = "14px sans-serif";
    ctx.fillText("AVL Telecom  -  Comprovante de Pagamento", 36, 80);

    // Linha divisoria
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(36, 98);
    ctx.lineTo(WIDTH - 36, 98);
    ctx.stroke();

    // Saudacao
    const firstName = data.clientName.split(" ")[0];
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "16px sans-serif";
    ctx.fillText(
      `Ola, ${firstName}! Confirmamos o recebimento do seu pagamento. Obrigado!`,
      36, 128
    );

    // Campos em grid
    const labelColor = "#64748b";
    const valueColor = "#f1f5f9";
    const col1x = 36;
    const col2x = 400;

    const drawField = (label: string, value: string, x: number, y: number) => {
      ctx.fillStyle = labelColor;
      ctx.font = "12px sans-serif";
      ctx.fillText(label.toUpperCase(), x, y);
      ctx.fillStyle = valueColor;
      ctx.font = "bold 16px sans-serif";
      ctx.fillText(value, x, y + 22);
    };

    drawField("Referencia",        data.descricao,  col1x, 162);
    drawField("Nr da Fatura",      data.cobrancaId ? `#${data.cobrancaId}` : "-", col2x, 162);
    drawField("Data do Pagamento", data.data,        col1x, 224);
    drawField("Hora",              data.hora,        col2x, 224);

    // Caixa de valor em destaque
    const boxY = 290;
    const boxH = 90;

    ctx.shadowColor = "rgba(34,197,94,0.25)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#14532d";
    roundRect(ctx, 36, boxY, WIDTH - 72, boxH, 12);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 1.5;
    roundRect(ctx, 36, boxY, WIDTH - 72, boxH, 12);
    ctx.stroke();

    ctx.fillStyle = "#86efac";
    ctx.font = "13px sans-serif";
    ctx.fillText("VALOR PAGO", 60, boxY + 26);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px sans-serif";
    ctx.fillText(data.valor, 60, boxY + 66);

    ctx.fillStyle = "#22c55e";
    ctx.font = "bold 50px sans-serif";
    ctx.fillText("V", WIDTH - 90, boxY + 66);

    // Rodape
    ctx.fillStyle = "#334155";
    ctx.font = "11px sans-serif";
    const now = new Date();
    const ts = `Gerado em: ${now.toLocaleDateString("pt-BR")} as ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    ctx.fillText(ts, 36, HEIGHT - 16);
    ctx.fillText("AVL Telecom  -  Obrigado pela preferencia!", WIDTH / 2 - 120, HEIGHT - 16);

    const buffer = canvas.toBuffer("image/png");
    console.log(`[receiptGenerator] Comprovante gerado (${Math.round(buffer.length / 1024)} KB)`);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch (err: any) {
    console.warn("[receiptGenerator] Canvas falhou, usando fallback de texto.", err.message);
    return null;
  }
}

/**
 * Monta a mensagem de texto usada como fallback.
 */
export function buildPaymentTextFallback(clientName: string, data: ReceiptData): string {
  const firstName = clientName.split(" ")[0];
  return [
    `*COMPROVANTE DE PAGAMENTO*`,
    ``,
    `Ola, *${firstName}*! Recebemos e confirmamos o seu pagamento. Muito obrigado!`,
    ``,
    `*Detalhes da Baixa:*`,
    `- *Referencia:* ${data.descricao}`,
    `- *Valor Pago:* ${data.valor}`,
    `- *Data do Pagamento:* ${data.data}`,
    `- *Hora:* ${data.hora}`,
    ...(data.cobrancaId ? [`- *Nr Fatura:* #${data.cobrancaId}`] : []),
    ``,
    `Sua conexao esta garantida! Qualquer duvida, conte conosco.`,
    ``,
    `_Att, Equipe AVL Telecom_`,
  ].join("\n");
}

function roundRect(
  ctx: any,
  x: number, y: number, w: number, h: number, r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}


export interface RaffleTicketData {
  clientName: string;
  raffleTitle: string;
  ticketQuantity: number;
  ticketNumbers: number[];
}

/**
 * Gera imagem de comprovante dos Bilhetes da Sorte em PNG (base64).
 * Retorna null se canvas falhar para usar fallback de texto.
 */
export async function generateRaffleTicketImage(data: RaffleTicketData): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createCanvas } = require("canvas") as typeof import("canvas");

    const WIDTH = 760;
    const HEIGHT = 440;
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    // Fundo gradiente moderno
    const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(1, "#1e1b4b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Borda lateral dourada
    ctx.fillStyle = "#eab308";
    ctx.fillRect(0, 0, 6, HEIGHT);

    // Cabecalho
    ctx.fillStyle = "#eab308";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText("Bilhetes da Sorte Confirmados!", 36, 56);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "14px sans-serif";
    ctx.fillText("AVL Telecom  -  Sorteio Oficial", 36, 80);

    // Linha divisoria
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(36, 96);
    ctx.lineTo(WIDTH - 36, 96);
    ctx.stroke();

    // Saudacao
    const firstName = (data.clientName || "Cliente").split(" ")[0];
    ctx.fillStyle = "#f1f5f9";
    ctx.font = "16px sans-serif";
    ctx.fillText("Ola, " + firstName + "! Seu pagamento foi aprovado. Boa sorte!", 36, 126);

    // Dados do sorteio
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px sans-serif";
    ctx.fillText("SORTEIO", 36, 160);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(data.raffleTitle || "Sorteio AVL", 36, 182);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px sans-serif";
    ctx.fillText("QUANTIDADE DE BILHETES", 450, 160);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(data.ticketQuantity + " bilhete(s)", 450, 182);

    // Caixa dos numeros da sorte
    const boxY = 220;
    const boxH = 140;

    ctx.shadowColor = "rgba(234, 179, 8, 0.25)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#422006";
    roundRect(ctx, 36, boxY, WIDTH - 72, boxH, 12);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = "#eab308";
    ctx.lineWidth = 1.5;
    roundRect(ctx, 36, boxY, WIDTH - 72, boxH, 12);
    ctx.stroke();

    ctx.fillStyle = "#fef08a";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText("SEUS NUMEROS DA SORTE", 56, boxY + 30);

    const numbersStr = (data.ticketNumbers || []).join("   ");
    ctx.fillStyle = "#ffffff";
    const fontSize = numbersStr.length > 30 ? 22 : 32;
    ctx.font = "bold " + fontSize + "px monospace";
    ctx.fillText(numbersStr, 56, boxY + 75);

    ctx.fillStyle = "#fde047";
    ctx.font = "12px sans-serif";
    ctx.fillText("Guarde estes numeros para a apuracao!", 56, boxY + 112);

    // Rodape
    ctx.fillStyle = "#475569";
    ctx.font = "11px sans-serif";
    ctx.fillText("Gerado automaticamente por AVL Telecom  -  Boa sorte! 🍀", 36, HEIGHT - 18);

    const buffer = canvas.toBuffer("image/png");
    console.log("[receiptGenerator] Imagem de bilhetes gerada (" + Math.round(buffer.length / 1024) + " KB)");
    return "data:image/png;base64," + buffer.toString("base64");
  } catch (err: any) {
    console.warn("[receiptGenerator] Falha ao gerar imagem de bilhetes:", err.message);
    return null;
  }
}
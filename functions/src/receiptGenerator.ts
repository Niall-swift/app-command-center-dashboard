/**
 * @fileoverview Gerador de Comprovante de Pagamento e Bilhetes via Canvas (HiDPI)
 * Gera PNG de alta definição com aparência de comprovante bancário/comercial real.
 */

import * as crypto from "crypto";

export interface ReceiptData {
  clientName: string;
  valor: string;
  data: string;
  hora: string;
  descricao: string;
  cobrancaId?: string;
  cpfCnpj?: string;
  telefone?: string;
  endereco?: string;
  plano?: string;
  contratoId?: string;
  vencimento?: string;
  formaPagamento?: string;
  valorOriginal?: string;
  desconto?: string;
  acrescimo?: string;
  nossoNumero?: string;
  authCode?: string;
}

/** Formata e protege parcialmente CPF (mascarado) ou formata CNPJ mantendo padrão bancário. */
export function formatDocumentForReceipt(rawDoc?: string): string {
  if (!rawDoc) return "";
  const digits = String(rawDoc).replace(/\D/g, "");
  if (digits.length === 11) {
    return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
  }
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }
  return String(rawDoc).trim();
}

/** Formata telefone brasileiro para exibição legível no comprovante. */
export function formatPhoneForReceipt(rawPhone?: string): string {
  if (!rawPhone) return "";
  let digits = String(rawPhone).replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) {
    digits = digits.slice(2);
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return String(rawPhone).trim();
}

/** Gera código autenticador determinístico curto no padrão AVL-XXXX-XXXX-XXXX. */
export function buildReceiptAuthCode(data: ReceiptData): string {
  if (data.authCode?.trim()) return data.authCode.trim().toUpperCase();
  const seed = `${data.cobrancaId || ""}|${data.clientName}|${data.valor}|${data.data}|${data.hora}`;
  const hash = crypto.createHash("sha256").update(seed).digest("hex").toUpperCase();
  return `AVL-${hash.slice(0, 4)}-${hash.slice(4, 8)}-${hash.slice(8, 12)}`;
}

function wrapTextLines(ctx: any, text: string, maxWidth: number): string[] {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [""];

  const words = clean.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      if (ctx.measureText(word).width > maxWidth) {
        let partial = "";
        for (const ch of word) {
          if (ctx.measureText(partial + ch).width <= maxWidth) {
            partial += ch;
          } else {
            if (partial) lines.push(partial);
            partial = ch;
          }
        }
        current = partial;
      } else {
        current = word;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawRoundedRectPath(ctx: any, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawReceiptPaperPath(
  ctx: any,
  x: number,
  y: number,
  w: number,
  h: number,
  toothW = 14,
  toothH = 7
): void {
  const count = Math.floor(w / toothW);
  const actualToothW = w / count;

  ctx.beginPath();
  ctx.moveTo(x, y + toothH);
  for (let i = 0; i < count; i++) {
    const px = x + i * actualToothW;
    ctx.lineTo(px + actualToothW / 2, y);
    ctx.lineTo(px + actualToothW, y + toothH);
  }
  ctx.lineTo(x + w, y + h - toothH);
  for (let i = count; i > 0; i--) {
    const px = x + i * actualToothW;
    ctx.lineTo(px - actualToothW / 2, y + h);
    ctx.lineTo(px - actualToothW, y + h - toothH);
  }
  ctx.closePath();
}

function drawCheckCircleIcon(ctx: any, cx: number, cy: number, radius: number): void {
  ctx.save();
  ctx.fillStyle = "#dcfce7";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#16a34a";
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.72, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(2.6, radius * 0.14);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx - radius * 0.3, cy + radius * 0.02);
  ctx.lineTo(cx - radius * 0.06, cy + radius * 0.25);
  ctx.lineTo(cx + radius * 0.34, cy - radius * 0.2);
  ctx.stroke();
  ctx.restore();
}

function drawDashedTearLine(
  ctx: any,
  cardX: number,
  cardW: number,
  y: number,
  outerBg: string
): void {
  ctx.save();
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(cardX + 22, y);
  ctx.lineTo(cardX + cardW - 22, y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Recortes semicirculares laterais de recibo
  ctx.fillStyle = outerBg;
  ctx.beginPath();
  ctx.arc(cardX, y, 10, -Math.PI / 2, Math.PI / 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cardX + cardW, y, 10, Math.PI / 2, (Math.PI * 3) / 2);
  ctx.fill();
  ctx.restore();
}

function drawAuthBarcode(ctx: any, x: number, y: number, w: number, h: number, authCode: string): void {
  ctx.save();
  ctx.fillStyle = "#0f172a";
  const digest = crypto.createHash("md5").update(authCode).digest();
  let cursor = x;
  let idx = 0;
  while (cursor < x + w - 2) {
    const byte = digest[idx % digest.length];
    const barW = ((byte + idx) % 3) + 1.5;
    const gap = (((byte >> 3) + idx) % 2) + 1.8;
    const barH = byte % 5 === 0 ? h : h * 0.86;
    if (cursor + barW <= x + w) {
      ctx.fillRect(cursor, y + (h - barH) / 2, barW, barH);
    }
    cursor += barW + gap;
    idx++;
  }
  ctx.restore();
}

interface LedgerRow {
  label: string;
  value: string;
  valueColor?: string;
  boldValue?: boolean;
}

/**
 * Gera comprovante de pagamento em PNG de alta definição (HiDPI 2x, base64 Data URI).
 * Retorna `null` se canvas não estiver disponível ou falhar.
 */
export async function generatePaymentReceiptImage(data: ReceiptData): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createCanvas } = require("canvas") as typeof import("canvas");

    const SCALE = 2; // HiDPI 2x para nitidez em telas mobile
    const W = 720;
    const OUTER_BG = "#e2e8f0";
    const CARD_X = 28;
    const CARD_W = W - CARD_X * 2;
    const PAD_X = 34;
    const INNER_X = CARD_X + PAD_X;
    const INNER_W = CARD_W - PAD_X * 2;

    const authCode = buildReceiptAuthCode(data);
    const formattedDoc = formatDocumentForReceipt(data.cpfCnpj);
    const formattedPhone = formatPhoneForReceipt(data.telefone);
    const paymentDateTime =
      data.hora && data.hora !== "00:00"
        ? `${data.data} às ${data.hora}`
        : data.data || "-";

    const payerRows: LedgerRow[] = [
      { label: "Pagador / Titular", value: data.clientName || "Cliente", boldValue: true },
      ...(formattedDoc ? [{ label: "CPF / CNPJ", value: formattedDoc }] : []),
      ...(formattedPhone ? [{ label: "Telefone", value: formattedPhone }] : []),
      { label: "Endereço", value: data.endereco?.trim() || "Não informado no cadastro" },
    ];

    const contratoLabel = [
      data.contratoId ? `#${data.contratoId}` : "",
      data.plano || "",
    ]
      .filter(Boolean)
      .join(" • ");

    const paymentRows: LedgerRow[] = [
      { label: "Referência", value: data.descricao || "Mensalidade de Internet" },
      ...(contratoLabel ? [{ label: "Contrato / Plano", value: contratoLabel }] : []),
      { label: "Nº da Fatura", value: data.cobrancaId ? `#${data.cobrancaId}` : "-" },
      ...(data.nossoNumero ? [{ label: "Nosso Número", value: data.nossoNumero }] : []),
      ...(data.vencimento ? [{ label: "Vencimento", value: data.vencimento }] : []),
      { label: "Data do Pagamento", value: paymentDateTime },
      { label: "Forma / Carteira", value: data.formaPagamento || "Baixa Confirmada (ISPFY)" },
      ...(data.valorOriginal && data.valorOriginal !== data.valor
        ? [{ label: "Valor Original", value: data.valorOriginal }]
        : []),
      ...(data.desconto ? [{ label: "Desconto", value: `- ${data.desconto}`, valueColor: "#15803d" }] : []),
      ...(data.acrescimo ? [{ label: "Juros / Multa", value: `+ ${data.acrescimo}`, valueColor: "#b45309" }] : []),
      { label: "Total Pago", value: data.valor, valueColor: "#15803d", boldValue: true },
    ];

    // Pass 1: Medir altura exata de todas as linhas com wrap para evitar cortes
    const measureCanvas = createCanvas(10, 10);
    const mCtx = measureCanvas.getContext("2d");

    const computeRowsHeight = (rows: LedgerRow[]): number => {
      const labelColW = 190;
      const valueMaxW = INNER_W - labelColW - 14;
      let total = 0;
      for (const row of rows) {
        mCtx.font = `${row.boldValue ? "bold " : ""}14px sans-serif`;
        const lines = wrapTextLines(mCtx, row.value, valueMaxW);
        const rowH = Math.max(30, lines.length * 20 + 12);
        total += rowH;
      }
      return total;
    };

    const headerH = 92;
    const heroH = 198;
    const sectionHeaderH = 34;
    const payerBlockH = sectionHeaderH + computeRowsHeight(payerRows) + 14;
    const paymentBlockH = sectionHeaderH + computeRowsHeight(paymentRows) + 14;
    const receiverAuthH = 112;
    const footerH = 60;

    const CARD_TOP = 24;
    const CARD_H =
      18 +
      headerH +
      heroH +
      26 +
      payerBlockH +
      26 +
      paymentBlockH +
      26 +
      receiverAuthH +
      footerH +
      16;
    const H = CARD_TOP * 2 + CARD_H;

    // Pass 2: Renderização HiDPI 2x
    const canvas = createCanvas(W * SCALE, H * SCALE);
    const ctx = canvas.getContext("2d");
    ctx.scale(SCALE, SCALE);

    // Fundo externo neutro
    ctx.fillStyle = OUTER_BG;
    ctx.fillRect(0, 0, W, H);

    // Sombra suave sob a folha do comprovante
    ctx.save();
    ctx.shadowColor = "rgba(15, 23, 42, 0.16)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = "#ffffff";
    drawReceiptPaperPath(ctx, CARD_X, CARD_TOP, CARD_W, CARD_H, 14, 7);
    ctx.fill();
    ctx.restore();

    // Borda fina no papel + clip interno para marca d'água
    ctx.save();
    drawReceiptPaperPath(ctx, CARD_X, CARD_TOP, CARD_W, CARD_H, 14, 7);
    ctx.clip();

    // Faixa sutil no topo do recibo
    const topBarGrad = ctx.createLinearGradient(CARD_X, CARD_TOP, CARD_X + CARD_W, CARD_TOP);
    topBarGrad.addColorStop(0, "#0f172a");
    topBarGrad.addColorStop(0.6, "#065f46");
    topBarGrad.addColorStop(1, "#16a34a");
    ctx.fillStyle = topBarGrad;
    ctx.fillRect(CARD_X, CARD_TOP, CARD_W, 14);

    // Marca d'água diagonal discreta (estilo recibo bancário)
    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.025)";
    ctx.font = "bold 24px sans-serif";
    ctx.translate(CARD_X + CARD_W / 2, CARD_TOP + CARD_H / 2);
    ctx.rotate(-Math.PI / 6);
    for (let wy = -520; wy <= 520; wy += 130) {
      for (let wx = -500; wx <= 500; wx += 360) {
        ctx.fillText("AVL TELECOM • PAGO", wx, wy);
      }
    }
    ctx.restore();

    let y = CARD_TOP + 34;

    // --- CABEÇALHO INSTITUCIONAL ---
    const badgeGrad = ctx.createLinearGradient(INNER_X, y, INNER_X + 52, y + 52);
    badgeGrad.addColorStop(0, "#0f172a");
    badgeGrad.addColorStop(1, "#059669");
    ctx.fillStyle = badgeGrad;
    drawRoundedRectPath(ctx, INNER_X, y, 52, 52, 12);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("AVL", INNER_X + 26, y + 32);
    ctx.textAlign = "left";

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText("AVL TELECOMUNICAÇÕES", INNER_X + 66, y + 22);

    ctx.fillStyle = "#64748b";
    ctx.font = "13px sans-serif";
    ctx.fillText("Fibra Óptica • Comprovante Oficial de Pagamento", INNER_X + 66, y + 44);

    // Selo direito "PAGO"
    const pillW = 114;
    const pillH = 30;
    const pillX = INNER_X + INNER_W - pillW;
    ctx.fillStyle = "#dcfce7";
    drawRoundedRectPath(ctx, pillX, y + 10, pillW, pillH, 15);
    ctx.fill();
    ctx.strokeStyle = "#86efac";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = "#16a34a";
    ctx.beginPath();
    ctx.arc(pillX + 18, y + 25, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#15803d";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText("QUITADO", pillX + 30, y + 29);

    y += 74;

    // Linha separadora header
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(INNER_X, y);
    ctx.lineTo(INNER_X + INNER_W, y);
    ctx.stroke();

    y += 26;

    // --- HERO DE CONFIRMAÇÃO E VALOR ---
    drawCheckCircleIcon(ctx, INNER_X + 24, y + 24, 24);

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 23px sans-serif";
    ctx.fillText("Pagamento Confirmado", INNER_X + 62, y + 20);

    ctx.fillStyle = "#475569";
    ctx.font = "13px sans-serif";
    ctx.fillText(`Transação registrada em ${paymentDateTime}`, INNER_X + 62, y + 42);

    y += 66;

    const valueBoxH = 104;
    ctx.fillStyle = "#f0fdf4";
    drawRoundedRectPath(ctx, INNER_X, y, INNER_W, valueBoxH, 12);
    ctx.fill();

    ctx.strokeStyle = "#86efac";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Barra esquerda esmeralda contida no raio arredondado do card de valor
    ctx.save();
    drawRoundedRectPath(ctx, INNER_X, y, INNER_W, valueBoxH, 12);
    ctx.clip();
    ctx.fillStyle = "#16a34a";
    ctx.fillRect(INNER_X, y, 7, valueBoxH);
    ctx.restore();

    ctx.fillStyle = "#15803d";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText("VALOR TOTAL PAGO", INNER_X + 24, y + 29);

    ctx.fillStyle = "#052e16";
    ctx.font = "bold 36px sans-serif";
    ctx.fillText(data.valor, INNER_X + 24, y + 73);

    // Chip direito com número da fatura
    const chipText = data.cobrancaId ? `FATURA #${data.cobrancaId}` : "BAIXA CONFIRMADA";
    ctx.font = "bold 12px sans-serif";
    const chipW = Math.max(132, ctx.measureText(chipText).width + 26);
    const chipX = INNER_X + INNER_W - chipW - 18;
    ctx.fillStyle = "#ffffff";
    drawRoundedRectPath(ctx, chipX, y + 22, chipW, 28, 8);
    ctx.fill();
    ctx.strokeStyle = "#bbf7d0";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#15803d";
    ctx.textAlign = "center";
    ctx.fillText(chipText, chipX + chipW / 2, y + 40);
    ctx.fillStyle = "#475569";
    ctx.font = "11px sans-serif";
    ctx.fillText("Compensação realizada", chipX + chipW / 2, y + 72);
    ctx.textAlign = "left";

    y += valueBoxH + 26;

    // --- DIVISOR SERRILHADO / PONTILHADO ---
    drawDashedTearLine(ctx, CARD_X, CARD_W, y, OUTER_BG);
    y += 26;

    // Helper de renderização de seções no estilo ledger bancário
    const renderSection = (title: string, rows: LedgerRow[]) => {
      ctx.fillStyle = "#059669";
      drawRoundedRectPath(ctx, INNER_X, y + 2, 4, 16, 2);
      ctx.fill();

      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(title, INNER_X + 12, y + 15);
      y += sectionHeaderH;

      const labelColW = 190;
      const valueMaxW = INNER_W - labelColW - 14;

      rows.forEach((row, index) => {
        ctx.font = `${row.boldValue ? "bold " : ""}14px sans-serif`;
        const lines = wrapTextLines(ctx, row.value, valueMaxW);
        const rowH = Math.max(30, lines.length * 20 + 12);

        // Fundo alternado super sutil para facilitar leitura
        if (index % 2 === 0) {
          ctx.fillStyle = "#f8fafc";
          drawRoundedRectPath(ctx, INNER_X, y - 4, INNER_W, rowH - 2, 6);
          ctx.fill();
        }

        ctx.fillStyle = "#64748b";
        ctx.font = "13px sans-serif";
        ctx.fillText(row.label, INNER_X + 10, y + 16);

        ctx.fillStyle = row.valueColor || "#0f172a";
        ctx.font = `${row.boldValue ? "bold " : ""}14px sans-serif`;
        ctx.textAlign = "right";
        lines.forEach((line, lIdx) => {
          ctx.fillText(line, INNER_X + INNER_W - 10, y + 16 + lIdx * 20);
        });
        ctx.textAlign = "left";

        if (index < rows.length - 1) {
          ctx.strokeStyle = "#e2e8f0";
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(INNER_X + 8, y + rowH - 3);
          ctx.lineTo(INNER_X + INNER_W - 8, y + rowH - 3);
          ctx.stroke();
        }

        y += rowH;
      });
    };

    // --- SEÇÃO 1: DADOS DO PAGADOR (CLIENTE) ---
    renderSection("DADOS DO CLIENTE (PAGADOR)", payerRows);
    y += 18;
    drawDashedTearLine(ctx, CARD_X, CARD_W, y, OUTER_BG);
    y += 26;

    // --- SEÇÃO 2: DADOS DO PAGAMENTO ---
    renderSection("DADOS DO PAGAMENTO", paymentRows);
    y += 18;
    drawDashedTearLine(ctx, CARD_X, CARD_W, y, OUTER_BG);
    y += 24;

    // --- SEÇÃO 3: RECEBEDOR & AUTENTICAÇÃO ELETRÔNICA ---
    const authBoxH = 92;
    ctx.fillStyle = "#f8fafc";
    drawRoundedRectPath(ctx, INNER_X, y, INNER_W, authBoxH, 10);
    ctx.fill();
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#64748b";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText("RECEBEDOR / BENEFICIÁRIO", INNER_X + 16, y + 24);
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText("AVL TELECOMUNICAÇÕES", INNER_X + 16, y + 44);

    ctx.fillStyle = "#64748b";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText("AUTENTICAÇÃO ELETRÔNICA", INNER_X + 16, y + 66);
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 13px monospace";
    ctx.fillText(authCode, INNER_X + 16, y + 83);

    // Código de barras visual determinístico à direita
    const barcodeW = 195;
    drawAuthBarcode(ctx, INNER_X + INNER_W - barcodeW - 16, y + 20, barcodeW, 44, authCode);
    ctx.fillStyle = "#64748b";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("REGISTRO VERIFICADO", INNER_X + INNER_W - barcodeW / 2 - 16, y + 80);
    ctx.textAlign = "left";

    y += authBoxH + 22;

    // --- RODAPÉ ---
    ctx.fillStyle = "#64748b";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      "Comprovante emitido eletronicamente. Válido para conferência de pagamento na AVL Telecom.",
      W / 2,
      y
    );

    const now = new Date();
    const emittedAt = now.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px sans-serif";
    ctx.fillText(`Gerado em ${emittedAt}  •  Obrigado pela preferência!`, W / 2, y + 19);
    ctx.textAlign = "left";

    ctx.restore();

    const buffer = canvas.toBuffer("image/png");
    console.log(`[receiptGenerator] Comprovante HiDPI gerado (${Math.round(buffer.length / 1024)} KB)`);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch (err: any) {
    console.warn("[receiptGenerator] Canvas falhou, usando fallback de texto.", err.message);
    return null;
  }
}

/**
 * Monta legenda concisa enviada junto à imagem do comprovante (Z-API /send-image).
 */
export function buildPaymentImageCaption(clientName: string, data: ReceiptData): string {
  const firstName = (clientName || "Cliente").trim().split(" ")[0] || "Cliente";
  const authCode = buildReceiptAuthCode(data);
  return [
    `✅ *Pagamento Confirmado!*`,
    ``,
    `Olá, *${firstName}*! Recebemos a confirmação do pagamento da ${data.cobrancaId ? `fatura *#${data.cobrancaId}*` : "sua fatura"} no valor de *${data.valor}*.`,
    `Segue acima o seu comprovante completo em imagem.`,
    ``,
    `🔐 *Autenticação:* \`${authCode}\``,
    `_Att, Equipe AVL Telecom_`,
  ].join("\n");
}

/**
 * Monta a mensagem de texto completa usada como fallback caso o envio da imagem falhe.
 */
export function buildPaymentTextFallback(clientName: string, data: ReceiptData): string {
  const firstName = (clientName || "Cliente").trim().split(" ")[0] || "Cliente";
  const formattedDoc = formatDocumentForReceipt(data.cpfCnpj);
  const formattedPhone = formatPhoneForReceipt(data.telefone);
  const authCode = buildReceiptAuthCode(data);
  const contratoInfo = [
    data.contratoId ? `#${data.contratoId}` : "",
    data.plano || "",
  ]
    .filter(Boolean)
    .join(" • ");

  return [
    `🧾 *COMPROVANTE OFICIAL DE PAGAMENTO*`,
    ``,
    `Olá, *${firstName}*! Recebemos e confirmamos o seu pagamento. Muito obrigado!`,
    ``,
    `*Dados do Cliente:*`,
    `- *Titular:* ${data.clientName}`,
    ...(formattedDoc ? [`- *CPF/CNPJ:* ${formattedDoc}`] : []),
    ...(formattedPhone ? [`- *Telefone:* ${formattedPhone}`] : []),
    ...(data.endereco ? [`- *Endereço:* ${data.endereco}`] : []),
    ``,
    `*Dados do Pagamento:*`,
    `- *Referência:* ${data.descricao}`,
    ...(contratoInfo ? [`- *Contrato / Plano:* ${contratoInfo}`] : []),
    ...(data.cobrancaId ? [`- *Nº Fatura:* #${data.cobrancaId}`] : []),
    ...(data.vencimento ? [`- *Vencimento:* ${data.vencimento}`] : []),
    `- *Data/Hora:* ${data.data}${data.hora && data.hora !== "00:00" ? ` às ${data.hora}` : ""}`,
    ...(data.formaPagamento ? [`- *Forma/Carteira:* ${data.formaPagamento}`] : []),
    `- *Valor Pago:* *${data.valor}*`,
    ``,
    `🔐 *Autenticação:* \`${authCode}\``,
    `_Recebedor: AVL Telecomunicações_`,
  ].join("\n");
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
    drawRoundedRectPath(ctx, 36, boxY, WIDTH - 72, boxH, 12);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = "#eab308";
    ctx.lineWidth = 1.5;
    drawRoundedRectPath(ctx, 36, boxY, WIDTH - 72, boxH, 12);
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
    ctx.fillText("Gerado automaticamente por AVL Telecom  -  Boa sorte!", 36, HEIGHT - 18);

    const buffer = canvas.toBuffer("image/png");
    console.log("[receiptGenerator] Imagem de bilhetes gerada (" + Math.round(buffer.length / 1024) + " KB)");
    return "data:image/png;base64," + buffer.toString("base64");
  } catch (err: any) {
    console.warn("[receiptGenerator] Falha ao gerar imagem de bilhetes:", err.message);
    return null;
  }
}

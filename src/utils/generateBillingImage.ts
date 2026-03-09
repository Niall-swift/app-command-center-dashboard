/**
 * Gera uma imagem de cobrança personalizada via Canvas HTML5.
 * Exemplo de saída: "Josué, sua fatura AVL chegou! 🎉"
 */

const EMOJIS = [
  '🌟', '⚡', '🔔', '📣', '🎯', '💡', '🚀', '🎊', '💥', '✨',
  '🔥', '📢', '⭐', '💫', '🎶', '📱', '💰', '🤝', '💎', '🏆',
];

function getRandomEmoji(): string {
  return EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
}

/**
 * Retorna apenas o primeiro nome do cliente.
 * Ex: "JOSUÉ DA SILVA" → "Josué"
 */
function getFirstName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0];
  // Capitalizar: primeira letra maiúscula, resto minúsculo
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export interface BillingImageOptions {
  nomeCliente: string;
  valor?: string;
  dataVencimento?: string;
  diasAtraso?: number;
}

/**
 * Gera uma imagem PNG de cobrança via Canvas e retorna um Data URL.
 */
export async function generateBillingImage(options: BillingImageOptions): Promise<string> {
  const { nomeCliente, valor, dataVencimento, diasAtraso } = options;

  const firstName = getFirstName(nomeCliente);
  const emoji = getRandomEmoji();

  // Determinar status da fatura
  let statusText = '';
  let statusColor = '';
  if (diasAtraso !== undefined && diasAtraso > 0) {
    statusText = `${diasAtraso} dia${diasAtraso > 1 ? 's' : ''} em atraso`;
    statusColor = '#FF4D4D';
  } else if (diasAtraso === 0) {
    statusText = 'Vence hoje!';
    statusColor = '#FFB800';
  } else {
    statusText = 'Fatura em aberto';
    statusColor = '#00D1B2';
  }

  // Dimensões do canvas
  const W = 800;
  const H = 420;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // ── Fundo gradiente escuro ──────────────────────────────────────────────────
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, '#0A0F1E');
  bgGrad.addColorStop(1, '#131B30');
  ctx.fillStyle = bgGrad;
  ctx.roundRect(0, 0, W, H, 24);
  ctx.fill();

  // ── Faixa lateral esquerda colorida ────────────────────────────────────────
  const sideGrad = ctx.createLinearGradient(0, 0, 0, H);
  sideGrad.addColorStop(0, '#00D1FF');
  sideGrad.addColorStop(1, '#7B2FFF');
  ctx.fillStyle = sideGrad;
  ctx.fillRect(0, 0, 8, H);

  // ── Círculo decorativo de fundo (direita) ───────────────────────────────────
  const circleGrad = ctx.createRadialGradient(W - 80, 60, 10, W - 80, 60, 180);
  circleGrad.addColorStop(0, 'rgba(0, 209, 255, 0.12)');
  circleGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = circleGrad;
  ctx.beginPath();
  ctx.arc(W - 80, 60, 180, 0, Math.PI * 2);
  ctx.fill();

  // ── Logo / marca AVL ───────────────────────────────────────────────────────
  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.fillStyle = '#00D1FF';
  ctx.letterSpacing = '3px';
  ctx.fillText('AVL TELECOM', 36, 52);

  // Linha separadora
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(36, 70);
  ctx.lineTo(W - 36, 70);
  ctx.stroke();

  // ── Saudação com primeiro nome ─────────────────────────────────────────────
  ctx.font = 'bold 46px Arial, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.letterSpacing = '0px';
  ctx.fillText(`Olá, ${firstName}! ${emoji}`, 36, 130);

  // ── Mensagem principal ─────────────────────────────────────────────────────
  ctx.font = '28px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('sua fatura AVL chegou.', 36, 172);

  // ── Card de valor (se fornecido) ───────────────────────────────────────────
  if (valor || dataVencimento) {
    // Fundo do card
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(36, 200, W - 72, 110, 16);
    ctx.fill();
    ctx.stroke();

    // Valor
    if (valor) {
      ctx.font = 'bold 48px Arial, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(valor, 60, 264);

      // Label valor
      ctx.font = '16px Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('VALOR DA FATURA', 60, 218);
    }

    // Data de vencimento
    if (dataVencimento) {
      const labelX = valor ? 400 : 60;

      ctx.font = '16px Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('VENCIMENTO', labelX, 218);

      ctx.font = 'bold 32px Arial, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(dataVencimento, labelX, 264);
    }

    // Badge de status
    ctx.fillStyle = statusColor + '22';
    ctx.beginPath();
    ctx.roundRect(60, 278, 280, 24, 12);
    ctx.fill();

    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.fillStyle = statusColor;
    ctx.fillText(`● ${statusText.toUpperCase()}`, 75, 295);
  }

  // ── Rodapé ─────────────────────────────────────────────────────────────────
  ctx.font = '15px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText('Responda esta mensagem para mais informações  •  avltelecom.com.br', 36, H - 24);

  return canvas.toDataURL('image/png');
}

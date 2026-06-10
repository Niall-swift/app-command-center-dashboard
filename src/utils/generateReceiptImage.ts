const PREMIX_LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/avl-telecom.appspot.com/o/logo-pre-mix%2FWhatsApp%20Image%202026-02-11%20at%2014.52.11.jpeg?alt=media&token=b6d398d2-60df-4f09-a9bc-340a7ecb37d1";

export interface ReceiptImageOptions {
  winnerName: string;
  prize: string;
  rescueCode: string;
}

export async function generateReceiptImage(options: ReceiptImageOptions): Promise<string> {
  const { winnerName, prize, rescueCode } = options;
  const W = 800;
  const H = 500;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Could not get canvas context");

  // ── Background dark gradient (Minimalist Black & Green) ──────────────────────
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#080A09');
  bg.addColorStop(0.5, '#040605');
  bg.addColorStop(1, '#010201');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ── Minimalist green border ──────────────────────────────────────────────────
  ctx.strokeStyle = '#10B981';
  ctx.lineWidth = 3;
  const br = 16;
  ctx.beginPath();
  ctx.roundRect(24, 24, W - 48, H - 48, br);
  ctx.stroke();

  // ── Pre-Mix branding (top logo loading with cache buster) ───────────────────
  try {
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      logoImg.onload = () => {
        const maxW = 220;
        const maxH = 80;
        let drawW = logoImg.width;
        let drawH = logoImg.height;
        const ratio = Math.min(maxW / drawW, maxH / drawH);
        drawW *= ratio;
        drawH *= ratio;
        ctx.drawImage(logoImg, (W - drawW) / 2, 70 - drawH / 2, drawW, drawH);
        resolve();
      };
      logoImg.onerror = () => reject();
      logoImg.src = PREMIX_LOGO_URL + '&cb=' + Date.now();
    });
  } catch {
    // Fallback
    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '6px';
    ctx.fillText('PRE-MIX', W / 2, 70);
  }

  // ── Divider line ──────────────────────────────────────────────────────────
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, 120);
  ctx.lineTo(W - 60, 120);
  ctx.stroke();

  // ── Title "COMPROVANTE DE ENTREGA" ──────────────────────────────────────────
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 22px Arial';
  ctx.textAlign = 'center';
  ctx.letterSpacing = '3px';
  ctx.fillText('COMPROVANTE DE ENTREGA', W / 2, 160);

  // ── Success Status ──────────────────────────────────────────────────────────
  ctx.fillStyle = '#10B981';
  ctx.font = 'bold 26px Arial';
  ctx.textAlign = 'center';
  ctx.letterSpacing = '1px';
  ctx.fillText('🏆 PRÊMIO ENTREGUE COM SUCESSO!', W / 2, 210);

  // Details box background
  ctx.fillStyle = '#030E0A';
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.2)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(60, 240, W - 120, 160, 12);
  ctx.fill();
  ctx.stroke();

  // Details
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  const labelX = 90;
  const valueX = 260;

  // Winner
  ctx.font = '16px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('GANHADOR:', labelX, 280);
  ctx.font = 'bold 18px Arial';
  ctx.fillStyle = '#FFFFFF';
  const nameToDraw = winnerName.length > 35 ? winnerName.substring(0, 35) + '...' : winnerName;
  ctx.fillText(nameToDraw.toUpperCase(), valueX, 280);

  // Prize
  ctx.font = '16px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('PRÊMIO ENTREGUE:', labelX, 320);
  ctx.font = 'bold 18px Arial';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(prize.toUpperCase(), valueX, 320);

  // Code
  ctx.font = '16px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('CÓDIGO RESGATE:', labelX, 360);
  ctx.font = 'bold 20px Arial';
  ctx.fillStyle = '#10B981';
  ctx.fillText(rescueCode, valueX, 360);

  // ── Footer ──────────────────────────────────────────────────────────────────
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`Entrega registrada em ${dateStr}`, W / 2, 435);

  ctx.fillStyle = 'rgba(16, 185, 129, 0.5)';
  ctx.font = 'bold 13px Arial';
  ctx.letterSpacing = '2px';
  ctx.fillText('AVL TELECOM  •  PRE-MIX', W / 2, 460);

  return canvas.toDataURL('image/png');
}

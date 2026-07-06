import React, { useState } from 'react';
import { Download, X, MessageCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Client } from '@/types/dashboard';
import { whapiService } from '@/services/whapi/whapiService';
import { useToast } from '@/hooks/use-toast';

declare global {
  interface Window {
    whatsappWindowRef?: Window;
  }
}

const PREMIX_LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/avl-telecom.appspot.com/o/logo-pre-mix%2FWhatsApp%20Image%202026-02-11%20at%2014.52.11.jpeg?alt=media&token=b6d398d2-60df-4f09-a9bc-340a7ecb37d1";

interface WinnerCardProps {
  winner: Client;
  prize: string;
  onClose: () => void;
  winnerProfilePic?: string | null;
  isFetchingProfilePic?: boolean;
}

// Confetti particle component
function ConfettiParticle({ index }: { index: number }) {
  const colors = ['#FFD700', '#FF6B9D', '#A855F7', '#60A5FA', '#34D399', '#FB923C'];
  const color = colors[index % colors.length];
  const size = Math.random() * 8 + 4;
  const startX = Math.random() * 100;
  const duration = Math.random() * 3 + 2;
  const delay = Math.random() * 2;

  return (
    <motion.div
      className="absolute rounded-sm"
      style={{
        width: size,
        height: size * 0.4,
        backgroundColor: color,
        left: `${startX}%`,
        top: '-10px',
      }}
      animate={{
        y: ['0vh', '110vh'],
        x: [0, (Math.random() - 0.5) * 100],
        rotate: [0, Math.random() * 720 - 360],
        opacity: [1, 1, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  );
}

export default function WinnerCard({ winner, prize, onClose, winnerProfilePic, isFetchingProfilePic }: WinnerCardProps) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

  // Helper to proxy URLs from Whapi and WhatsApp CDN to avoid CORS issues
  const getProxiedImageUrl = (url: string | null | undefined): string => {
    if (!url) return '';
    if (url.startsWith('https://gate.whapi.cloud')) {
      return url.replace('https://gate.whapi.cloud', '/api/whapi');
    }
    if (url.startsWith('https://pps.whatsapp.net')) {
      return url.replace('https://pps.whatsapp.net', '/api/whatsapp-cdn');
    }
    return url;
  };

  // Helper to load image on canvas with CORS support
  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      // Se for base64 (data URL), carrega direto sem CORS nem cache buster
      if (url.startsWith('data:')) {
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Erro ao carregar imagem base64'));
        img.src = url;
        return;
      }

      // Se for URL do Whapi ou do CDN do WhatsApp, reescreve para usar o proxy local para contornar problemas de CORS
      let finalUrl = url;
      if (url.startsWith('https://gate.whapi.cloud')) {
        finalUrl = url.replace('https://gate.whapi.cloud', '/api/whapi');
      } else if (url.startsWith('https://pps.whatsapp.net')) {
        finalUrl = url.replace('https://pps.whatsapp.net', '/api/whatsapp-cdn');
      }

      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => {
        // Fallback: se falhou com proxy ou cache buster, tentamos a URL original pura sem cb
        if (finalUrl !== url) {
          const retryImg = new Image();
          retryImg.crossOrigin = 'anonymous';
          retryImg.onload = () => resolve(retryImg);
          retryImg.onerror = () => reject(new Error('Erro no retry da imagem'));
          retryImg.src = url;
        } else {
          reject(new Error('Erro ao carregar imagem'));
        }
      };

      // Adiciona cache buster apenas para URLs externas (não locais nem proxy)
      if (finalUrl.startsWith('http') && !finalUrl.includes('localhost') && !finalUrl.startsWith('/api/whapi') && !finalUrl.startsWith('/api/whatsapp-cdn')) {
        img.src = finalUrl + (finalUrl.includes('?') ? '&' : '?') + 'cb=' + Date.now();
      } else {
        img.src = finalUrl;
      }
    });
  };

  // Prioridade: foto do WhatsApp > avatar do Firebase > inicial do nome
  const effectiveAvatar = winnerProfilePic || winner.avatar || '';

  /**
   * Gera o card como imagem PNG em ALTA RESOLUÇÃO (1200x1800px)
   */
  const generateCardImage = async (): Promise<string | null> => {
    const W = 1200;
    const H = 1800;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    canvas.width = W;
    canvas.height = H;

    // ── Background dark gradient (Minimalist Black & Green) ──────────────────────
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#080A09');
    bg.addColorStop(0.5, '#050605');
    bg.addColorStop(1, '#010201');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // ── Glow radial in center (Subtle Green Glow) ────────────────────────────────
    const glow = ctx.createRadialGradient(W / 2, H * 0.38, 0, W / 2, H * 0.38, 500);
    glow.addColorStop(0, 'rgba(16, 185, 129, 0.15)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // ── Minimalist green border ──────────────────────────────────────────────────
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 4;
    const br = 24;
    ctx.beginPath();
    ctx.roundRect(40, 40, W - 80, H - 80, br);
    ctx.stroke();

    // ── Pre-Mix branding (top logo loading) ───────────────────
    try {
      const logoImg = await loadImage(PREMIX_LOGO_URL);
      const maxW = 340;
      const maxH = 120;
      let drawW = logoImg.width;
      let drawH = logoImg.height;
      const ratio = Math.min(maxW / drawW, maxH / drawH);
      drawW *= ratio;
      drawH *= ratio;
      ctx.drawImage(logoImg, (W - drawW) / 2, 110 - drawH / 2, drawW, drawH);
    } catch (err) {
      console.warn('Erro ao carregar logo no canvas:', err);
      // Fallback
      ctx.fillStyle = '#10B981';
      ctx.font = 'bold 54px Arial';
      ctx.textAlign = 'center';
      ctx.letterSpacing = '8px';
      ctx.fillText('PRE-MIX', W / 2, 110);
    }

    // ── Divider line ──────────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(100, 180);
    ctx.lineTo(W - 100, 180);
    ctx.stroke();

    // ── Title "SORTEIO PRE-MIX" ──────────────────────────────────────────────
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '4px';
    ctx.fillText('SORTEIO PRE-MIX', W / 2, 260);

    // ── GRANDE VENCEDOR title ─────────────────────────────────────────────────
    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 80px Arial';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '2px';
    ctx.fillText('GRANDE VENCEDOR', W / 2, 360);

    // ── Avatar circle ─────────────────────────────────────────────────────────
    const avatarX = W / 2;
    const avatarY = 610;
    const avatarR = 150;

    // Green ring
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarR + 10, 0, Math.PI * 2);
    ctx.stroke();

    // Avatar image or fallback
    const avatarSrc = winnerProfilePic || winner.avatar || '';
    try {
      if (avatarSrc) {
        const img = await loadImage(avatarSrc);
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
        ctx.restore();
      } else {
        throw new Error('no avatar');
      }
    } catch (err) {
      console.warn('Erro ao carregar avatar no canvas:', err);
      // Fallback: green gradient with initial
      const fallbackGrad = ctx.createRadialGradient(avatarX, avatarY, 0, avatarX, avatarY, avatarR);
      fallbackGrad.addColorStop(0, '#1E3A2F');
      fallbackGrad.addColorStop(1, '#061C12');
      ctx.fillStyle = fallbackGrad;
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${avatarR * 0.9}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText((winner.name || 'V').charAt(0).toUpperCase(), avatarX, avatarY + avatarR * 0.32);
    }

    // ── Winner name ───────────────────────────────────────────────────────────
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 76px Arial';
    ctx.textAlign = 'center';
    // Split name if too long
    const safeName = winner.name || 'Participante VIP';
    const nameParts = safeName.split(' ');
    if (nameParts.length > 2 || safeName.length > 18) {
      const mid = Math.ceil(nameParts.length / 2);
      ctx.fillText(nameParts.slice(0, mid).join(' '), W / 2, 830);
      ctx.fillText(nameParts.slice(mid).join(' '), W / 2, 910);
    } else {
      ctx.fillText(safeName, W / 2, 870);
    }

    // ── Prize box ─────────────────────────────────────────────────────────────
    const boxY = 980;
    const boxH = 200;
    const boxW = W - 200;
    const boxX = 100;

    // Clean dark green box with thin green border
    ctx.fillStyle = '#061C12';
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '3px';
    ctx.fillText('PRÊMIO', W / 2, boxY + 60);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 56px Arial';
    const prizeText = prize.toUpperCase();
    // Shrink font if too long
    if (prizeText.length > 20) ctx.font = 'bold 42px Arial';
    ctx.fillText(prizeText, W / 2, boxY + 140);

    // ── Bottom section (Date) ──────────────────────────────────────────────────
    const now = new Date();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '28px Arial';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '1px';
    ctx.fillText(now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }), W / 2, 1240);

    // ── Rules box ─────────────────────────────────────────────────────────────
    const rulesY = 1290;
    const rulesH = 290;
    const rulesW = W - 200;
    const rulesX = 100;

    ctx.fillStyle = '#030E0A';
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(rulesX, rulesY, rulesW, rulesH, 16);
    ctx.fill();
    ctx.stroke();

    // Rules title
    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '2px';
    ctx.fillText('REGRAS DE RESGATE DO PRÊMIO', W / 2, rulesY + 55);

    // Rule items
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';
    ctx.letterSpacing = '0.5px';
    const textX = rulesX + 50;
    ctx.fillText('• O cliente tem 5 dias corridos para fazer o resgate do prêmio.', textX, rulesY + 120);
    ctx.fillText('• É obrigatório ter o aplicativo AVL instalado no celular.', textX, rulesY + 180);
    ctx.fillText('• As informações cadastradas no app devem coincidir com as do vencedor.', textX, rulesY + 240);

    // Bottom brand
    ctx.fillStyle = 'rgba(16, 185, 129, 0.6)';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '3px';
    ctx.fillText('SORTEIO PRE-MIX  •  BOA SORTE AO VENCEDOR! 🌾', W / 2, 1680);

    return canvas.toDataURL('image/png');
  };

  const downloadCard = async () => {
    const dataUrl = await generateCardImage();
    if (!dataUrl) return;
    const link = document.createElement('a');
    const safeNameUrl = (winner.name || 'Vencedor').replace(/\s+/g, '_');
    link.download = `vencedor_${safeNameUrl}.png`;
    link.href = dataUrl;
    link.click();
  };

  const sendCardToWinner = async () => {
    const phoneNumber = winner.phone?.replace(/\D/g, '') || '';
    if (!phoneNumber) {
      toast({ title: 'Telefone não cadastrado', description: 'Este participante não possui telefone cadastrado.', variant: 'destructive' });
      return;
    }
    setSending(true);
    const congratsMessage = `🎉 *PARABÉNS ${(winner.name || 'PARTICIPANTE').toUpperCase()}!* 🎉\n\n` +
      `Você foi o(a) grande vencedor(a) do sorteio *Pre-Mix* e ganhou:\n\n` +
      `🏆 *${prize}* 🏆\n\n` +
      `⚠️ *REGRAS IMPORTANTES PARA RESGATE:*\n` +
      `1️⃣ Você tem *5 dias corridos* a partir de hoje para fazer o resgate do seu prêmio.\n` +
      `2️⃣ É necessário ter o *App AVL* instalado no seu celular.\n` +
      `3️⃣ As informações cadastradas no app devem coincidir com as do vencedor.\n\n` +
      `Entre em contato conosco para realizar o resgate do seu prêmio!\n\n` +
      `✨ *Equipe Pre-Mix* agradece a sua participação! ✨`;
    try {
      const dataUrl = await generateCardImage();
      if (!dataUrl) throw new Error('Erro ao gerar o card');
      const result = await whapiService.sendImage({ to: phoneNumber, imageDataUrl: dataUrl, caption: congratsMessage });
      if (result.sent) {
        toast({ title: '✅ Card enviado!', description: `Card enviado para ${winner.name || 'Vencedor'} via WhatsApp.` });
      } else {
        throw new Error(result.error || 'Falha no envio');
      }
    } catch (error) {
      // Fallback: WhatsApp Web
      const whatsappUrl = `https://web.whatsapp.com/send?phone=55${phoneNumber}&text=${encodeURIComponent(congratsMessage)}`;
      window.open(whatsappUrl, '_blank');
      toast({ title: 'WhatsApp aberto', description: 'Envie o card manualmente no WhatsApp.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 flex items-center justify-center z-50 p-4"
        style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(16px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.7, y: 60, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.7, y: 60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 180, damping: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-sm"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute -top-3 -right-3 z-20 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Card */}
          <div
            className="relative rounded-3xl overflow-hidden shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, #020604 0%, #06150F 50%, #010403 100%)',
              border: '2px solid transparent',
              backgroundClip: 'padding-box',
            }}
          >
            {/* Minimalist border via box-shadow */}
            <div className="absolute inset-0 rounded-3xl pointer-events-none" style={{
              boxShadow: 'inset 0 0 0 2px rgba(16,185,129,0.4), 0 0 40px rgba(16,185,129,0.1)',
            }} />

            <div className="relative z-10 flex flex-col items-center p-6 pb-8 text-center">
              {/* Brand Logo */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mb-2 mt-1 flex justify-center"
              >
                <img 
                  src={PREMIX_LOGO_URL} 
                  alt="Logo Pre-Mix" 
                  crossOrigin="anonymous"
                  className="h-12 object-contain rounded-lg border border-emerald-500/20 bg-white/5 p-1 shadow-md"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </motion.div>

              {/* Divider */}
              <div className="w-full h-px mb-6" style={{ background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.3), transparent)' }} />

              {/* Title */}
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="text-2xl font-black tracking-widest mb-6"
                style={{ color: '#10B981', textShadow: '0 0 15px rgba(16,185,129,0.3)' }}
              >
                GRANDE VENCEDOR
              </motion.h2>

              {/* Avatar */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.5 }}
                className="relative mb-6"
              >
                {/* Glow ring */}
                <div className="absolute inset-0 rounded-full" style={{
                  boxShadow: '0 0 0 4px #10B981, 0 0 20px rgba(16,185,129,0.2)',
                  borderRadius: '50%',
                }} />
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-emerald-500 relative">
                  {isFetchingProfilePic ? (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1E3A2F, #061C12)' }}>
                      <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                    </div>
                  ) : effectiveAvatar ? (
                    <img src={getProxiedImageUrl(effectiveAvatar)} alt={winner.name || 'Vencedor'} className="w-full h-full object-cover" crossOrigin="anonymous" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl font-black text-white" style={{ background: 'linear-gradient(135deg, #1E3A2F, #061C12)' }}>
                      {(winner.name || 'V').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Winner name */}
              <motion.h3
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="text-2xl font-black text-white mb-1 leading-tight"
              >
                {winner.name || 'Participante VIP'}
              </motion.h3>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-sm mb-5"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </motion.p>

              {/* Prize box */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.9 }}
                className="w-full rounded-2xl p-4 mb-4"
                style={{
                  background: 'rgba(16,185,129,0.06)',
                  border: '1.5px solid rgba(16,185,129,0.4)',
                  boxShadow: '0 0 15px rgba(16,185,129,0.05) inset',
                }}
              >
                <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: '#10B981' }}>
                  🎁 Prêmio
                </p>
                <p className="text-xl font-black text-white">
                  {prize}
                </p>
              </motion.div>

              {/* Rules box */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.0 }}
                className="w-full text-left bg-[#030E0A] border border-emerald-500/20 rounded-2xl p-4 mb-5 text-xs space-y-2"
              >
                <div className="flex items-center gap-1.5 text-emerald-400 font-black uppercase tracking-wider text-[10px]">
                  Regras de Resgate do Prêmio
                </div>
                <ul className="space-y-1.5 text-gray-300">
                  <li className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold">•</span>
                    <span>Prazo de <strong className="text-white font-semibold">5 dias corridos</strong> para fazer o resgate.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold">•</span>
                    <span>Deve ter o <strong className="text-white font-semibold">App AVL instalado</strong> no celular.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-emerald-500 font-bold">•</span>
                    <span>Dados cadastrados devem <strong className="text-white font-semibold">coincidir com o vencedor</strong>.</span>
                  </li>
                </ul>
              </motion.div>

              {/* Actions */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1 }}
                className="flex gap-3 w-full"
              >
                <button
                  onClick={downloadCard}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-105 active:scale-95"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1.5px solid rgba(255,255,255,0.15)',
                    color: 'white',
                  }}
                >
                  <Download className="w-4 h-4" />
                  Salvar
                </button>
                <button
                  onClick={sendCardToWinner}
                  disabled={!winner.phone || sending}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                  style={{
                    background: sending ? 'rgba(16,185,129,0.5)' : '#10B981',
                    border: '1.5px solid rgba(16,185,129,0.3)',
                    color: 'white',
                    boxShadow: '0 4px 15px rgba(16,185,129,0.2)',
                  }}
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                  {sending ? 'Enviando...' : 'Enviar'}
                </button>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

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

    // ── Background dark gradient ──────────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0D0618');
    bg.addColorStop(0.4, '#1A0533');
    bg.addColorStop(0.7, '#120826');
    bg.addColorStop(1, '#06030E');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // ── Glow radial in center ─────────────────────────────────────────────────
    const glow = ctx.createRadialGradient(W / 2, H * 0.38, 0, W / 2, H * 0.38, 500);
    glow.addColorStop(0, 'rgba(168, 85, 247, 0.35)');
    glow.addColorStop(0.5, 'rgba(168, 85, 247, 0.08)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // ── Decorative dots ───────────────────────────────────────────────────────
    const dotColors = ['rgba(255,215,0,0.4)', 'rgba(168,85,247,0.4)', 'rgba(255,107,157,0.3)', 'rgba(255,255,255,0.15)'];
    for (let i = 0; i < 120; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const r = Math.random() * 2.5 + 0.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = dotColors[Math.floor(Math.random() * dotColors.length)];
      ctx.fill();
    }

    // ── Golden border ─────────────────────────────────────────────────────────
    const borderGrad = ctx.createLinearGradient(0, 0, W, H);
    borderGrad.addColorStop(0, '#FFD700');
    borderGrad.addColorStop(0.25, '#FFF8DC');
    borderGrad.addColorStop(0.5, '#FFD700');
    borderGrad.addColorStop(0.75, '#DAA520');
    borderGrad.addColorStop(1, '#FFD700');
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 8;
    const br = 40;
    ctx.beginPath();
    ctx.roundRect(20, 20, W - 40, H - 40, br);
    ctx.stroke();

    // Inner subtle border
    ctx.strokeStyle = 'rgba(255,215,0,0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(32, 32, W - 64, H - 64, br - 8);
    ctx.stroke();

    // ── AVL Telecom branding (top) ────────────────────────────────────────────
    ctx.fillStyle = 'rgba(255,215,0,0.6)';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '8px';
    ctx.fillText('AVL TELECOM', W / 2, 100);

    // ── Divider line ──────────────────────────────────────────────────────────
    const divGrad = ctx.createLinearGradient(100, 0, W - 100, 0);
    divGrad.addColorStop(0, 'transparent');
    divGrad.addColorStop(0.3, 'rgba(255,215,0,0.6)');
    divGrad.addColorStop(0.7, 'rgba(255,215,0,0.6)');
    divGrad.addColorStop(1, 'transparent');
    ctx.strokeStyle = divGrad;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(100, 120);
    ctx.lineTo(W - 100, 120);
    ctx.stroke();

    // ── Trophy emoji ──────────────────────────────────────────────────────────
    ctx.font = '120px serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏆', W / 2, 280);

    // ── GRANDE VENCEDOR title ─────────────────────────────────────────────────
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 72px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('GRANDE VENCEDOR', W / 2, 380);

    // Gold underline
    ctx.strokeStyle = 'rgba(255,215,0,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 260, 400);
    ctx.lineTo(W / 2 + 260, 400);
    ctx.stroke();

    // Sparkles around title
    const sparkles = ['✨', '⭐', '✨'];
    const sparkX = [W / 2 - 340, W / 2, W / 2 + 340];
    ctx.font = '36px serif';
    sparkles.forEach((s, i) => { ctx.fillText(s, sparkX[i], 380); });

    // ── Avatar circle ─────────────────────────────────────────────────────────
    const avatarX = W / 2;
    const avatarY = 700;
    const avatarR = 180;

    // Outer golden glow
    const haloGrad = ctx.createRadialGradient(avatarX, avatarY, avatarR - 20, avatarX, avatarY, avatarR + 60);
    haloGrad.addColorStop(0, 'rgba(255,215,0,0.5)');
    haloGrad.addColorStop(0.5, 'rgba(255,215,0,0.15)');
    haloGrad.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.fillStyle = haloGrad;
    ctx.fillRect(avatarX - avatarR - 60, avatarY - avatarR - 60, (avatarR + 60) * 2, (avatarR + 60) * 2);

    // Golden ring
    const ringGrad = ctx.createLinearGradient(avatarX - avatarR, avatarY - avatarR, avatarX + avatarR, avatarY + avatarR);
    ringGrad.addColorStop(0, '#FFD700');
    ringGrad.addColorStop(0.25, '#FFF8DC');
    ringGrad.addColorStop(0.5, '#DAA520');
    ringGrad.addColorStop(0.75, '#FFD700');
    ringGrad.addColorStop(1, '#B8860B');
    ctx.strokeStyle = ringGrad;
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarR + 10, 0, Math.PI * 2);
    ctx.stroke();

    // Avatar image or fallback
    const avatarSrc = winnerProfilePic || winner.avatar || '';
    try {
      if (avatarSrc) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(img, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
            ctx.restore();
            resolve();
          };
          img.onerror = () => reject();
          img.src = avatarSrc;
        });
      } else {
        throw new Error('no avatar');
      }
    } catch {
      // Fallback: gradient circle with initial
      const fallbackGrad = ctx.createRadialGradient(avatarX, avatarY, 0, avatarX, avatarY, avatarR);
      fallbackGrad.addColorStop(0, '#6D28D9');
      fallbackGrad.addColorStop(1, '#2D1B69');
      ctx.fillStyle = fallbackGrad;
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'white';
      ctx.font = `bold ${avatarR * 0.9}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText(winner.name.charAt(0).toUpperCase(), avatarX, avatarY + avatarR * 0.32);
    }

    // ── Winner name ───────────────────────────────────────────────────────────
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 80px Arial';
    ctx.textAlign = 'center';
    // Split name if too long
    const nameParts = winner.name.split(' ');
    if (nameParts.length > 2 || winner.name.length > 18) {
      const mid = Math.ceil(nameParts.length / 2);
      ctx.fillText(nameParts.slice(0, mid).join(' '), W / 2, 975);
      ctx.fillText(nameParts.slice(mid).join(' '), W / 2, 1070);
    } else {
      ctx.fillText(winner.name, W / 2, 1020);
    }

    // ── Prize box ─────────────────────────────────────────────────────────────
    const boxY = 1140;
    const boxH = 220;
    const boxW = W - 160;
    const boxX = 80;

    // Box background with glassmorphism feel
    ctx.fillStyle = 'rgba(255,215,0,0.06)';
    ctx.strokeStyle = 'rgba(255,215,0,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 24);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,215,0,0.7)';
    ctx.font = '38px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🎁  PRÊMIO', W / 2, boxY + 65);

    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 60px Arial';
    const prizeText = prize.toUpperCase();
    // Shrink font if too long
    if (prizeText.length > 20) ctx.font = 'bold 44px Arial';
    ctx.fillText(prizeText, W / 2, boxY + 162);

    // ── Bottom section ────────────────────────────────────────────────────────
    const now = new Date();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }), W / 2, 1470);

    // Bottom confetti emojis
    const emojis = ['🎉', '🎊', '⭐', '✨', '🎉', '🎊', '⭐'];
    ctx.font = '48px serif';
    emojis.forEach((e, i) => {
      ctx.fillText(e, 80 + i * (W - 160) / (emojis.length - 1), 1560);
    });

    // Bottom brand
    ctx.fillStyle = 'rgba(255,215,0,0.4)';
    ctx.font = '28px Arial';
    ctx.fillText('Sorteio AVL Telecom • Boa sorte ao vencedor! 🙏', W / 2, 1640);

    return canvas.toDataURL('image/png');
  };

  const downloadCard = async () => {
    const dataUrl = await generateCardImage();
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.download = `vencedor_${winner.name.replace(/\s+/g, '_')}.png`;
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
    const congratsMessage = `🎉 *PARABÉNS ${winner.name.toUpperCase()}!* 🎉\n\nVocê foi o(a) grande vencedor(a) do nosso sorteio e ganhou:\n\n🏆 *${prize}* 🏆\n\nSua sorte chegou! Entre em contato conosco para retirar seu prêmio.\n\n✨ *AVL Telecom* agradece a sua participação! ✨`;
    try {
      const dataUrl = await generateCardImage();
      if (!dataUrl) throw new Error('Erro ao gerar o card');
      const result = await whapiService.sendImage({ to: phoneNumber, imageDataUrl: dataUrl, caption: congratsMessage });
      if (result.sent) {
        toast({ title: '✅ Card enviado!', description: `Card enviado para ${winner.name} via WhatsApp.` });
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
        style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)' }}
        onClick={onClose}
      >
        {/* Confetti */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 40 }).map((_, i) => <ConfettiParticle key={i} index={i} />)}
        </div>

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
              background: 'linear-gradient(135deg, #0D0618 0%, #1A0533 40%, #120826 70%, #06030E 100%)',
              border: '2px solid transparent',
              backgroundClip: 'padding-box',
            }}
          >
            {/* Golden border via box-shadow */}
            <div className="absolute inset-0 rounded-3xl pointer-events-none" style={{
              boxShadow: 'inset 0 0 0 2px rgba(255,215,0,0.6), 0 0 60px rgba(168,85,247,0.4), 0 0 100px rgba(168,85,247,0.2)',
            }} />

            {/* Stars background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {Array.from({ length: 60 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full bg-white"
                  style={{
                    width: Math.random() * 2 + 1,
                    height: Math.random() * 2 + 1,
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    opacity: Math.random() * 0.6 + 0.1,
                  }}
                  animate={{ opacity: [0.1, 0.8, 0.1] }}
                  transition={{ duration: Math.random() * 3 + 1.5, repeat: Infinity, delay: Math.random() * 2 }}
                />
              ))}
            </div>

            <div className="relative z-10 flex flex-col items-center p-6 pb-8 text-center">
              {/* Brand */}
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-xs font-bold tracking-[0.3em] uppercase mb-1"
                style={{ color: 'rgba(255,215,0,0.6)' }}
              >
                AVL Telecom
              </motion.p>

              {/* Divider */}
              <div className="w-full h-px mb-4" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.5), transparent)' }} />

              {/* Trophy */}
              <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.2 }}
                className="text-5xl mb-1"
              >
                🏆
              </motion.div>

              {/* Title */}
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="text-xl font-black tracking-widest mb-5"
                style={{ color: '#FFD700', textShadow: '0 0 20px rgba(255,215,0,0.6)' }}
              >
                GRANDE VENCEDOR
              </motion.h2>

              {/* Avatar */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.5 }}
                className="relative mb-5"
              >
                {/* Glow ring */}
                <div className="absolute inset-0 rounded-full" style={{
                  boxShadow: '0 0 0 4px #FFD700, 0 0 30px rgba(255,215,0,0.5), 0 0 60px rgba(168,85,247,0.3)',
                  borderRadius: '50%',
                }} />
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-yellow-400 relative">
                  {isFetchingProfilePic ? (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6D28D9, #2D1B69)' }}>
                      <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
                    </div>
                  ) : effectiveAvatar ? (
                    <img src={effectiveAvatar} alt={winner.name} className="w-full h-full object-cover" crossOrigin="anonymous" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl font-black text-white" style={{ background: 'linear-gradient(135deg, #6D28D9, #2D1B69)' }}>
                      {winner.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                {/* Spinning star */}
                <motion.div
                  className="absolute -top-1 -right-1 text-2xl"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                >
                  ⭐
                </motion.div>
              </motion.div>

              {/* Winner name */}
              <motion.h3
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="text-2xl font-black text-white mb-1 leading-tight"
                style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}
              >
                {winner.name}
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
                className="w-full rounded-2xl p-4 mb-6"
                style={{
                  background: 'rgba(255,215,0,0.07)',
                  border: '1.5px solid rgba(255,215,0,0.35)',
                  boxShadow: '0 0 20px rgba(255,215,0,0.1) inset',
                }}
              >
                <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: 'rgba(255,215,0,0.6)' }}>
                  🎁 Prêmio
                </p>
                <p className="text-xl font-black" style={{ color: '#FFD700', textShadow: '0 0 15px rgba(255,215,0,0.5)' }}>
                  {prize}
                </p>
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
                    background: 'rgba(255,255,255,0.1)',
                    border: '1.5px solid rgba(255,255,255,0.2)',
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
                    background: sending ? 'rgba(34,197,94,0.5)' : 'linear-gradient(135deg, #16A34A, #15803D)',
                    border: '1.5px solid rgba(34,197,94,0.4)',
                    color: 'white',
                    boxShadow: '0 4px 15px rgba(34,197,94,0.3)',
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

import React, { useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Download, X, Trophy, Star, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Client } from '@/types/dashboard';

interface WinnerCardProps {
  winner: Client;
  prize: string;
  onClose: () => void;
}

export default function WinnerCard({ winner, prize, onClose }: WinnerCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const downloadCard = async () => {
    if (!cardRef.current) return;

    // Create a canvas to draw the card
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = 600;
    canvas.height = 800;

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 600, 800);
    gradient.addColorStop(0, '#8B5CF6');
    gradient.addColorStop(0.5, '#EC4899');
    gradient.addColorStop(1, '#F59E0B');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 600, 800);

    // Add decorative elements
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * 600;
      const y = Math.random() * 800;
      const size = Math.random() * 10 + 5;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Title
    ctx.fillStyle = 'white';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🏆 VENCEDOR 🏆', 300, 100);

    // Load and draw avatar image
    try {
      if (winner.avatar) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        await new Promise((resolve, reject) => {
          img.onload = () => {
            // Draw circular avatar
            const avatarSize = 120;
            const avatarX = 300;
            const avatarY = 250;
            
            // Create circular clipping path
            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            
            // Draw the image
            ctx.drawImage(img, avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
            ctx.restore();
            
            // Draw avatar border
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(avatarX, avatarY, avatarSize / 2 + 2, 0, Math.PI * 2);
            ctx.stroke();
            
            resolve(true);
          };
          img.onerror = () => reject(false);
          img.src = winner.avatar;
        });
      } else {
        // Draw fallback circle with initials if no avatar
        const avatarSize = 120;
        const avatarX = 300;
        const avatarY = 250;
        
        // Draw circle background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw border
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
        ctx.stroke();
        
        // Draw initials
        ctx.fillStyle = 'white';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(winner.name.charAt(0), avatarX, avatarY + 15);
      }
    } catch (error) {
      console.log('Erro ao carregar avatar, usando fallback');
      // Draw fallback circle with initials
      const avatarSize = 120;
      const avatarX = 300;
      const avatarY = 250;
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.fillStyle = 'white';
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(winner.name.charAt(0), avatarX, avatarY + 15);
    }

    // Winner name
    ctx.fillStyle = 'white';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(winner.name, 300, 400);

    // Handle
    ctx.font = '24px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(`@${winner.name.toLowerCase().replace(' ', '')}`, 300, 450);

    // Prize
    ctx.font = 'bold 28px Arial';
    ctx.fillStyle = 'white';
    ctx.fillText('Ganhou:', 300, 550);
    ctx.font = 'bold 32px Arial';
    ctx.fillText(prize, 300, 600);

    // Date
    const now = new Date();
    ctx.font = '18px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText(now.toLocaleDateString('pt-BR'), 300, 700);

    // Download the image
    const link = document.createElement('a');
    link.download = `vencedor_${winner.name.replace(' ', '_')}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.8, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.8, y: 50 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-md w-full"
      >
        <Card className="bg-gradient-to-br from-purple-600 via-pink-500 to-yellow-500 border-0 shadow-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-600/90 via-pink-500/90 to-yellow-500/90" />
          
          {/* Decorative elements */}
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 bg-white/30 rounded-full"
                initial={{ 
                  x: Math.random() * 400,
                  y: Math.random() * 600,
                  scale: 0
                }}
                animate={{
                  scale: [0, 1, 0],
                  rotate: [0, 360]
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: "easeInOut"
                }}
              />
            ))}
          </div>
          
          <div ref={cardRef} className="relative z-10">
            <CardContent className="p-8 text-center text-white">
              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="absolute top-4 right-4 text-white/80 hover:text-white hover:bg-white/20"
              >
                <X className="w-5 h-5" />
              </Button>
              
              {/* Header */}
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mb-6"
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Trophy className="w-8 h-8 text-yellow-300" />
                  <h2 className="text-2xl font-bold">VENCEDOR</h2>
                  <Trophy className="w-8 h-8 text-yellow-300" />
                </div>
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="flex justify-center"
                >
                  <Sparkles className="w-6 h-6 text-yellow-300" />
                </motion.div>
              </motion.div>
              
              {/* Winner Avatar */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ 
                  type: "spring", 
                  stiffness: 200, 
                  damping: 15,
                  delay: 0.4 
                }}
                className="relative mb-6"
              >
                <div className="relative inline-block">
                  <Avatar className="w-32 h-32 border-4 border-white/50 shadow-xl">
                    <AvatarImage src={winner.avatar} alt={winner.name} />
                    <AvatarFallback className="bg-white/20 text-white text-4xl font-bold">
                      {winner.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <motion.div
                    className="absolute -top-2 -right-2"
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  >
                    <Star className="w-12 h-12 text-yellow-300 fill-current" />
                  </motion.div>
                </div>
              </motion.div>
              
              {/* Winner Info */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mb-6"
              >
                <h3 className="text-3xl font-bold mb-2">{winner.name}</h3>
                <p className="text-xl text-white/90 mb-4">
                  @{winner.name.toLowerCase().replace(' ', '')}
                </p>
                <div className="bg-white/20 rounded-lg p-4">
                  <p className="text-lg font-semibold mb-1">Ganhou:</p>
                  <p className="text-2xl font-bold text-yellow-300">{prize}</p>
                </div>
              </motion.div>
              
              {/* Date */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="mb-6"
              >
                <p className="text-white/70">
                  {new Date().toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </motion.div>
              
              {/* Download Button */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1 }}
              >
                <Button
                  onClick={downloadCard}
                  className="bg-white text-purple-600 hover:bg-white/90 font-semibold px-6 py-2"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Salvar Card
                </Button>
              </motion.div>
            </CardContent>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}

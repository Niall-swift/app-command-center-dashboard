import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, Shield, ShieldCheck } from 'lucide-react';
import { getRoleDisplayLabel, type PanelUserRole } from '@/config/permissions';

export interface Ps5SplashUserInfo {
  name?: string | null;
  email?: string | null;
  photoUrl?: string | null;
  role?: PanelUserRole | null;
  jobTitle?: string | null;
}

interface Ps5UserSplashScreenProps {
  user?: Ps5SplashUserInfo | null;
  statusText?: string;
  eyebrowText?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
}

interface DustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  elongation: number;
  angle: number;
  spin: number;
  depth: number;
  alpha: number;
  phase: number;
  twinkleSpeed: number;
  rgb: string;
  kind: 'bokeh' | 'flake' | 'dust';
}

interface SilkRibbonConfig {
  yRatio: number;
  ampA1: number;
  ampA2: number;
  ampB1: number;
  ampB2: number;
  freq1: number;
  freq2: number;
  speed1: number;
  speed2: number;
  phase: number;
  twistPhase: number;
  baseSpread: number;
  fillAlpha: number;
  edgeAlpha: number;
  tintRgb: string;
}

interface UnderwaterRayConfig {
  originOffsetX: number;
  baseAngle: number;
  swayAmp: number;
  swaySpeed: number;
  widthNear: number;
  widthFar: number;
  lengthRatio: number;
  alpha: number;
  phase: number;
}

// 2 fitas sedosas translúcidas bem sutis com torção 3D estilo PlayStation
const SILK_RIBBONS: SilkRibbonConfig[] = [
  {
    yRatio: 0.58,
    ampA1: 86,
    ampA2: 28,
    ampB1: 54,
    ampB2: 40,
    freq1: 0.00175,
    freq2: 0.0034,
    speed1: 0.25,
    speed2: -0.17,
    phase: 0.3,
    twistPhase: 0.95,
    baseSpread: 18,
    fillAlpha: 0.032,
    edgeAlpha: 0.135,
    tintRgb: '245, 232, 210',
  },
  {
    yRatio: 0.65,
    ampA1: 64,
    ampA2: 24,
    ampB1: 82,
    ampB2: 28,
    freq1: 0.0015,
    freq2: 0.0031,
    speed1: -0.22,
    speed2: 0.19,
    phase: 2.1,
    twistPhase: 1.25,
    baseSpread: 22,
    fillAlpha: 0.026,
    edgeAlpha: 0.115,
    tintRgb: '235, 212, 178',
  },
];

// Feixes solares subaquáticos bem suaves descendo do canto superior esquerdo
const UNDERWATER_RAYS: UnderwaterRayConfig[] = [
  { originOffsetX: -0.04, baseAngle: 0.54, swayAmp: 0.045, swaySpeed: 0.42, widthNear: 34, widthFar: 170, lengthRatio: 0.74, alpha: 0.04, phase: 0.0 },
  { originOffsetX: 0.03, baseAngle: 0.68, swayAmp: 0.038, swaySpeed: 0.55, widthNear: 28, widthFar: 145, lengthRatio: 0.8, alpha: 0.048, phase: 1.1 },
  { originOffsetX: 0.10, baseAngle: 0.82, swayAmp: 0.052, swaySpeed: 0.36, widthNear: 40, widthFar: 210, lengthRatio: 0.86, alpha: 0.036, phase: 2.3 },
  { originOffsetX: 0.17, baseAngle: 0.94, swayAmp: 0.042, swaySpeed: 0.48, widthNear: 22, widthFar: 130, lengthRatio: 0.7, alpha: 0.03, phase: 3.4 },
  { originOffsetX: 0.24, baseAngle: 1.08, swayAmp: 0.035, swaySpeed: 0.61, widthNear: 30, widthFar: 155, lengthRatio: 0.64, alpha: 0.024, phase: 4.5 },
  { originOffsetX: -0.08, baseAngle: 0.40, swayAmp: 0.032, swaySpeed: 0.50, widthNear: 26, widthFar: 135, lengthRatio: 0.68, alpha: 0.028, phase: 5.6 },
];

const GOLD_PALETTE = [
  '255, 238, 208', // champanhe claro
  '246, 209, 152', // dourado suave PS5
  '226, 179, 114', // ouro âmbar quente
  '255, 248, 236', // branco quente
  '201, 156, 102', // bronze iluminado
];

function pickGoldTint(): string {
  return GOLD_PALETTE[Math.floor(Math.random() * GOLD_PALETTE.length)];
}

function createPs5Particles(width: number, height: number): DustParticle[] {
  const particles: DustParticle[] = [];

  // 1. Bokehs dourados grandes e desfocados (mais concentrados nas bordas/direita, como no boot do PS5)
  const bokehCount = Math.min(24, Math.max(14, Math.round(width / 75)));
  for (let i = 0; i < bokehCount; i++) {
    const preferRight = Math.random() < 0.65;
    const x = preferRight
      ? width * (0.68 + Math.random() * 0.34)
      : Math.random() * width;
    const y = Math.random() * height;
    const depth = 0.6 + Math.random() * 0.4;
    particles.push({
      x,
      y,
      vx: (0.08 + Math.random() * 0.16) * (Math.random() < 0.4 ? -1 : 1),
      vy: -(0.06 + Math.random() * 0.18),
      radius: 5.5 + Math.random() * 12.5,
      elongation: 1,
      angle: 0,
      spin: 0,
      depth,
      alpha: 0.14 + Math.random() * 0.34,
      phase: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.7 + Math.random() * 1.1,
      rgb: pickGoldTint(),
      kind: 'bokeh',
    });
  }

  // 2. Micro-flocos / partículas anguladas douradas flutuando sob a luz (como sedimentos iluminados)
  const flakeCount = Math.min(115, Math.max(70, Math.round((width * height) / 14000)));
  for (let i = 0; i < flakeCount; i++) {
    const depth = 0.3 + Math.random() * 0.7;
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (0.1 + Math.random() * 0.24) * depth * (Math.random() < 0.35 ? -1 : 1),
      vy: -(0.08 + Math.random() * 0.26) * depth,
      radius: (0.9 + Math.random() * 1.8) * depth,
      elongation: 1.3 + Math.random() * 1.9,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.025,
      depth,
      alpha: 0.32 + Math.random() * 0.62,
      phase: Math.random() * Math.PI * 2,
      twinkleSpeed: 1.1 + Math.random() * 2.4,
      rgb: pickGoldTint(),
      kind: 'flake',
    });
  }

  // 3. Poeira luminosa fina em todo o fundo escuro
  const dustCount = Math.min(95, Math.max(55, Math.round((width * height) / 18000)));
  for (let i = 0; i < dustCount; i++) {
    const depth = 0.2 + Math.random() * 0.55;
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (0.04 + Math.random() * 0.12) * depth,
      vy: -(0.04 + Math.random() * 0.16) * depth,
      radius: 0.55 + Math.random() * 1.15,
      elongation: 1,
      angle: 0,
      spin: 0,
      depth,
      alpha: 0.25 + Math.random() * 0.55,
      phase: Math.random() * Math.PI * 2,
      twinkleSpeed: 1.4 + Math.random() * 2.8,
      rgb: pickGoldTint(),
      kind: 'dust',
    });
  }

  return particles;
}

function getInitials(name?: string | null, email?: string | null): string {
  const raw = String(name || email || 'AVL').trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return raw.substring(0, 2).toUpperCase();
}

export const Ps5UserSplashScreen: React.FC<Ps5UserSplashScreenProps> = ({
  user,
  statusText = 'Preparando seu ambiente operacional...',
  eyebrowText,
  dismissible = false,
  onDismiss,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  const photoUrl = String(user?.photoUrl || '').trim();
  const hasValidPhoto = Boolean(photoUrl) && !imgFailed;
  const hasUserIdentity = Boolean(user?.name || user?.email);
  const displayName = String(user?.name || user?.email || 'AVL Telecom').trim();
  const roleLabel = user?.role ? getRoleDisplayLabel(user.role) : null;
  const resolvedEyebrow = eyebrowText || 'AVL TELECOM • NOC';

  useEffect(() => {
    setImgFailed(false);
  }, [photoUrl]);

  useEffect(() => {
    if (!dismissible || !onDismiss) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        onDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dismissible, onDismiss]);

  // Canvas 60fps: Fundo obsidiana PS5 + luz solar subaquática no canto superior esquerdo + ondas sedosas 3D + brilhos dourados
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let particles = createPs5Particles(width, height);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = createPs5Particles(width, height);
    };

    resize();
    window.addEventListener('resize', resize);

    const startMs = performance.now();

    const draw = (nowMs: number) => {
      const t = (nowMs - startMs) * 0.001;

      // 1. Base obsidiana profunda (como no boot PS5)
      ctx.globalCompositeOperation = 'source-over';
      const baseGrad = ctx.createLinearGradient(0, 0, width * 0.85, height);
      baseGrad.addColorStop(0, '#0a0807');
      baseGrad.addColorStop(0.26, '#050505');
      baseGrad.addColorStop(0.65, '#030304');
      baseGrad.addColorStop(1, '#010102');
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Luz volumétrica solar subaquática bem suave emanando do canto superior esquerdo
      ctx.globalCompositeOperation = 'lighter';

      const sunX = width * (0.08 + Math.sin(t * 0.32) * 0.025);
      const sunY = height * (-0.04 + Math.cos(t * 0.26) * 0.015);
      const sunRadius = Math.max(width, height) * 0.68;

      const topLeftHaze = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, sunRadius);
      topLeftHaze.addColorStop(0, 'rgba(242, 206, 158, 0.105)');
      topLeftHaze.addColorStop(0.24, 'rgba(198, 152, 102, 0.05)');
      topLeftHaze.addColorStop(0.52, 'rgba(122, 88, 56, 0.018)');
      topLeftHaze.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = topLeftHaze;
      ctx.fillRect(0, 0, width, height);

      // Raios de sol subaquáticos (god rays) balançando suavemente a partir do canto superior esquerdo
      const diag = Math.hypot(width, height);
      for (const ray of UNDERWATER_RAYS) {
        const ox = width * ray.originOffsetX + Math.sin(t * 0.35 + ray.phase) * 24;
        const oy = -height * 0.08;
        const angle = ray.baseAngle + Math.sin(t * ray.swaySpeed + ray.phase) * ray.swayAmp;
        const rayLen = diag * ray.lengthRatio;
        const endX = ox + Math.cos(angle) * rayLen;
        const endY = oy + Math.sin(angle) * rayLen;
        const perpX = -Math.sin(angle);
        const perpY = Math.cos(angle);

        const shimmer = 0.68 + 0.32 * Math.sin(t * (ray.swaySpeed * 1.45) + ray.phase * 1.7);
        const rayAlpha = ray.alpha * shimmer;

        const w1 = ray.widthNear * (0.9 + 0.15 * Math.sin(t * 0.7 + ray.phase));
        const w2 = ray.widthFar * (0.9 + 0.18 * Math.cos(t * 0.55 + ray.phase));

        ctx.beginPath();
        ctx.moveTo(ox + perpX * w1, oy + perpY * w1);
        ctx.lineTo(endX + perpX * w2, endY + perpY * w2);
        ctx.lineTo(endX - perpX * w2, endY - perpY * w2);
        ctx.lineTo(ox - perpX * w1, oy - perpY * w1);
        ctx.closePath();

        const rayGrad = ctx.createLinearGradient(ox, oy, endX, endY);
        rayGrad.addColorStop(0, `rgba(255, 232, 192, ${(rayAlpha * 1.15).toFixed(3)})`);
        rayGrad.addColorStop(0.28, `rgba(226, 184, 130, ${(rayAlpha * 0.68).toFixed(3)})`);
        rayGrad.addColorStop(0.65, `rgba(176, 134, 86, ${(rayAlpha * 0.22).toFixed(3)})`);
        rayGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = rayGrad;
        ctx.fill();
      }

      // Reflexos cáusticos sutis de água ondulando no canto superior esquerdo
      for (let c = 0; c < 3; c++) {
        const cx = width * (0.06 + c * 0.11 + Math.sin(t * (0.52 + c * 0.14) + c) * 0.03);
        const cy = height * (0.04 + c * 0.06 + Math.cos(t * (0.44 + c * 0.12) + c) * 0.02);
        const rx = width * (0.14 + c * 0.04);
        const ry = height * (0.045 + c * 0.015);
        const causticAlpha = 0.022 + 0.012 * Math.sin(t * 1.2 + c * 2.1);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(0.42 + Math.sin(t * 0.35 + c) * 0.08);
        const cGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, rx);
        cGrad.addColorStop(0, `rgba(255, 238, 205, ${causticAlpha.toFixed(3)})`);
        cGrad.addColorStop(0.5, `rgba(218, 174, 122, ${(causticAlpha * 0.4).toFixed(3)})`);
        cGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.scale(1, ry / rx);
        ctx.fillStyle = cGrad;
        ctx.beginPath();
        ctx.arc(0, 0, rx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 3. Ondas sedosas translúcidas com torção 3D (estilo XMB/PlayStation — cruzamentos luminosos)
      const segments = Math.max(68, Math.min(110, Math.round(width / 16)));
      const stepX = (width + 80) / segments;

      for (const r of SILK_RIBBONS) {
        const baseY = height * r.yRatio;
        const topPts: Array<{ x: number; y: number }> = [];
        const botPts: Array<{ x: number; y: number }> = [];

        let minY = height;
        let maxY = 0;

        for (let i = 0; i <= segments; i++) {
          const x = -40 + i * stepX;
          const u = x * r.freq1 + t * r.speed1 + r.phase;
          const v = x * r.freq2 + t * r.speed2 - r.phase * 0.65;

          const y1 = baseY + Math.sin(u) * r.ampA1 + Math.cos(v) * r.ampA2;
          const y2 =
            baseY +
            Math.sin(u + r.twistPhase) * r.ampB1 +
            Math.cos(v + r.twistPhase * 0.85) * r.ampB2 +
            Math.sin(u * 0.55 - t * 0.22) * r.baseSpread;

          if (y1 < minY) minY = y1;
          if (y2 < minY) minY = y2;
          if (y1 > maxY) maxY = y1;
          if (y2 > maxY) maxY = y2;

          topPts.push({ x, y: y1 });
          botPts.push({ x, y: y2 });
        }

        // Preenchimento translúcido sedoso entre as duas bordas da fita (afinamento natural nos cruzamentos)
        ctx.beginPath();
        ctx.moveTo(topPts[0].x, topPts[0].y);
        for (let i = 1; i < topPts.length; i++) {
          const prev = topPts[i - 1];
          const curr = topPts[i];
          ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + curr.x) * 0.5, (prev.y + curr.y) * 0.5);
        }
        const lastTop = topPts[topPts.length - 1];
        ctx.lineTo(lastTop.x, lastTop.y);

        for (let i = botPts.length - 1; i >= 1; i--) {
          const curr = botPts[i];
          const prev = botPts[i - 1];
          ctx.quadraticCurveTo(curr.x, curr.y, (curr.x + prev.x) * 0.5, (curr.y + prev.y) * 0.5);
        }
        ctx.lineTo(botPts[0].x, botPts[0].y);
        ctx.closePath();

        const ribbonGrad = ctx.createLinearGradient(0, minY, 0, maxY);
        ribbonGrad.addColorStop(0, `rgba(${r.tintRgb}, ${(r.fillAlpha * 1.35).toFixed(3)})`);
        ribbonGrad.addColorStop(0.5, `rgba(${r.tintRgb}, ${(r.fillAlpha * 0.45).toFixed(3)})`);
        ribbonGrad.addColorStop(1, `rgba(${r.tintRgb}, ${(r.fillAlpha * 1.25).toFixed(3)})`);
        ctx.fillStyle = ribbonGrad;
        ctx.fill();

        // Bordas luminosas nítidas + auréola macia (efeito de seda iluminada cruzando no escuro)
        const strokeCurve = (pts: Array<{ x: number; y: number }>, lineW: number, alpha: number) => {
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            const prev = pts[i - 1];
            const curr = pts[i];
            ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + curr.x) * 0.5, (prev.y + curr.y) * 0.5);
          }
          ctx.strokeStyle = `rgba(${r.tintRgb}, ${alpha.toFixed(3)})`;
          ctx.lineWidth = lineW;
          ctx.stroke();
        };

        // Halo suave nas bordas da fita
        strokeCurve(topPts, 5.5, r.edgeAlpha * 0.16);
        strokeCurve(botPts, 5.5, r.edgeAlpha * 0.14);
        // Fio especular fino principal
        strokeCurve(topPts, 1.35, r.edgeAlpha);
        strokeCurve(botPts, 1.15, r.edgeAlpha * 0.82);
      }

      // 4. Brilhos dourados, flocos iluminados e bokeh de profundidade estilo PS5
      for (const p of particles) {
        p.x += p.vx + Math.sin(t * 0.55 + p.phase) * 0.11 * p.depth;
        p.y += p.vy + Math.cos(t * 0.42 + p.phase) * 0.06 * p.depth;
        p.angle += p.spin;

        if (p.y < -30) {
          p.y = height + 30;
          p.x = Math.random() * width;
        }
        if (p.x < -30) p.x = width + 30;
        if (p.x > width + 30) p.x = -30;

        // Partículas perto do facho solar do canto superior esquerdo brilham ligeiramente mais
        const distTopLeft = Math.hypot(p.x / width, p.y / height);
        const sunBoost = distTopLeft < 0.6 ? 1 + (0.6 - distTopLeft) * 0.55 : 1;
        const twinkle = 0.42 + 0.58 * (0.5 + 0.5 * Math.sin(t * p.twinkleSpeed + p.phase));
        const alpha = Math.min(1, p.alpha * twinkle * sunBoost);

        if (p.kind === 'bokeh') {
          const rOuter = p.radius * 1.45;
          const bGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rOuter);
          bGrad.addColorStop(0, `rgba(${p.rgb}, ${(alpha * 0.85).toFixed(3)})`);
          bGrad.addColorStop(0.55, `rgba(${p.rgb}, ${(alpha * 0.45).toFixed(3)})`);
          bGrad.addColorStop(0.85, `rgba(${p.rgb}, ${(alpha * 0.14).toFixed(3)})`);
          bGrad.addColorStop(1, `rgba(${p.rgb}, 0)`);
          ctx.fillStyle = bGrad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, rOuter, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === 'flake') {
          // Halo sutil ao redor do floco dourado
          const glowR = p.radius * 3.4;
          const fGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
          fGrad.addColorStop(0, `rgba(${p.rgb}, ${(alpha * 0.65).toFixed(3)})`);
          fGrad.addColorStop(1, `rgba(${p.rgb}, 0)`);
          ctx.fillStyle = fGrad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
          ctx.fill();

          // Floco elíptico angulado cintilando na água
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          ctx.fillStyle = `rgba(${p.rgb}, ${Math.min(1, alpha * 1.05).toFixed(3)})`;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.radius * p.elongation, p.radius * 0.52, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          // Poeira dourada/branca super fina
          const dGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 3);
          dGrad.addColorStop(0, `rgba(${p.rgb}, ${alpha.toFixed(3)})`);
          dGrad.addColorStop(1, `rgba(${p.rgb}, 0)`);
          ctx.fillStyle = dGrad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 5. Vinheta cinematográfica sutil preservando o brilho do canto superior esquerdo
      ctx.globalCompositeOperation = 'source-over';
      const vignette = ctx.createRadialGradient(
        width * 0.45,
        height * 0.46,
        Math.min(width, height) * 0.28,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.82
      );
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignette.addColorStop(1, 'rgba(0, 0, 0, 0.58)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);

      animFrame = requestAnimationFrame(draw);
    };

    animFrame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      onClick={dismissible ? onDismiss : undefined}
      role="status"
      aria-label={`Carregando perfil de ${displayName}`}
      className={`fixed inset-0 z-[99998] overflow-hidden flex flex-col items-center justify-center select-none bg-[#050404] text-white ${
        dismissible ? 'cursor-pointer' : ''
      }`}
    >
      {/* Fundo animado estilo PlayStation 5 (luz solar subaquática + ondas sedosas + brilhos dourados) */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* Conteúdo central: Foto circular grande do usuário logado ao centro da tela */}
      <div className="relative z-10 flex flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ scale: 0.84, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex items-center justify-center mb-9"
        >
          {/* Halo difuso champanhe/dourado quente atrás do círculo */}
          <div
            aria-hidden="true"
            className="absolute -inset-12 rounded-full blur-3xl opacity-80 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(246,214,162,0.38) 0%, rgba(196,148,92,0.20) 48%, transparent 74%)',
            }}
          />

          {/* Anel externo pulsante 1 */}
          <motion.div
            aria-hidden="true"
            animate={{ scale: [1, 1.11, 1], opacity: [0.42, 0.12, 0.42] }}
            transition={{ duration: 2.9, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -inset-6 rounded-full border border-amber-100/30 pointer-events-none"
          />

          {/* Anel externo pulsante 2 */}
          <motion.div
            aria-hidden="true"
            animate={{ scale: [1.04, 1.2, 1.04], opacity: [0.26, 0.05, 0.26] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.45 }}
            className="absolute -inset-12 rounded-full border border-amber-200/20 pointer-events-none"
          />

          {/* Aro especular giratório champanhe-pérola ao redor da foto */}
          <motion.div
            aria-hidden="true"
            animate={{ rotate: 360 }}
            transition={{ duration: 7.5, repeat: Infinity, ease: 'linear' }}
            className="absolute -inset-2 rounded-full p-[3px] pointer-events-none"
            style={{
              background:
                'conic-gradient(from 0deg, rgba(255,250,240,0.94) 0deg, rgba(245,208,148,0.85) 70deg, rgba(186,138,84,0.45) 145deg, rgba(255,255,255,0.06) 225deg, rgba(245,222,182,0.55) 305deg, rgba(255,250,240,0.94) 360deg)',
            }}
          >
            <div className="w-full h-full rounded-full bg-[#090706]" />
          </motion.div>

          {/* Círculo central bem grande com a foto do usuário logado */}
          <div className="relative w-44 h-44 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-full overflow-hidden bg-gradient-to-br from-[#1b1612] via-[#0e0b09] to-[#050404] ring-2 ring-amber-100/30 shadow-[0_28px_90px_-10px_rgba(218,172,108,0.48)] flex items-center justify-center">
            {hasValidPhoto ? (
              <img
                src={photoUrl}
                alt={displayName}
                onError={() => setImgFailed(true)}
                className="w-full h-full object-cover rounded-full"
              />
            ) : hasUserIdentity ? (
              <span className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-amber-50 drop-shadow-[0_4px_22px_rgba(245,208,148,0.5)]">
                {getInitials(user?.name, user?.email)}
              </span>
            ) : (
              <img
                src="/pwa-192x192.png"
                alt="AVL Telecom"
                className="w-28 h-28 sm:w-36 sm:h-36 object-contain drop-shadow-[0_8px_28px_rgba(245,208,148,0.45)]"
              />
            )}

            {/* Reflexo de vidro sutil no topo do círculo */}
            <div
              aria-hidden="true"
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background:
                  'linear-gradient(150deg, rgba(255,244,224,0.22) 0%, rgba(255,255,255,0.04) 35%, transparent 56%)',
              }}
            />
          </div>
        </motion.div>

        {/* Marca sutil acima do cumprimento */}
        <motion.p
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.14 }}
          className="text-[11px] sm:text-xs font-semibold tracking-[0.34em] uppercase text-amber-100/70 mb-2.5"
        >
          {resolvedEyebrow}
        </motion.p>

        {/* Cumprimento + Nome do operador grande e em negrito */}
        <motion.h1
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.55, delay: 0.22 }}
          className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white drop-shadow-[0_4px_26px_rgba(245,208,148,0.35)] max-w-3xl leading-tight"
        >
          {hasUserIdentity ? (
            <>
              <span className="font-semibold text-amber-100/90">Bem-vindo de volta, </span>
              <span className="font-extrabold text-white">{displayName}</span>
            </>
          ) : (
            <span className="font-extrabold text-white">{displayName}</span>
          )}
        </motion.h1>

        {roleLabel && (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.08] backdrop-blur-md border border-amber-100/20 text-xs sm:text-sm font-semibold text-amber-50/95 shadow-lg"
          >
            {user?.role === 'creator' ? (
              <Crown className="w-3.5 h-3.5 text-amber-300" />
            ) : user?.role === 'admin' ? (
              <ShieldCheck className="w-3.5 h-3.5 text-amber-200" />
            ) : (
              <Shield className="w-3.5 h-3.5 text-emerald-300" />
            )}
            <span>{roleLabel}</span>
            {user?.jobTitle && (
              <>
                <span className="text-white/35">•</span>
                <span className="text-white/75">{user.jobTitle}</span>
              </>
            )}
          </motion.div>
        )}

        {/* Feixe luminoso dourado-pérola de progresso estilo PS5 */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0.7 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.5, delay: 0.34 }}
          className="mt-7 w-48 h-[2px] rounded-full bg-white/15 overflow-hidden relative"
        >
          <motion.div
            animate={{ x: ['-100%', '220%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: [0.4, 0, 0.2, 1] }}
            className="absolute inset-y-0 left-0 w-1/2 rounded-full"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(255,244,224,0.9) 35%, rgba(245,201,132,0.95) 65%, transparent)',
            }}
          />
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-3 text-xs text-stone-300/75 font-normal tracking-wide"
        >
          {statusText}
        </motion.p>

        {dismissible && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.55 }}
            transition={{ duration: 0.6, delay: 0.65 }}
            className="mt-6 text-[10px] uppercase tracking-[0.22em] text-stone-300/70"
          >
            Clique ou pressione qualquer tecla para continuar
          </motion.span>
        )}
      </div>
    </motion.div>
  );
};

export type NotificationSoundId =
  | 'tri-chime'
  | 'glass-ping'
  | 'whatsapp-pop'
  | 'soft-bell'
  | 'digital-ping'
  | 'subtle-tap'
  | 'none';

export type OutageSirenSoundId =
  | 'noc-classic'
  | 'police-wail'
  | 'radar-sonar'
  | 'industrial-klaxon'
  | 'chime-urgent'
  | 'nuclear-pulse'
  | 'none';

export interface SoundPresetOption<T extends string> {
  id: T;
  label: string;
  description: string;
}

export const NOTIFICATION_SOUND_OPTIONS: SoundPresetOption<NotificationSoundId>[] = [
  { id: 'tri-chime', label: 'Clássico AVL', description: '3 tons ascendentes nítidos' },
  { id: 'glass-ping', label: 'Cristal Apple', description: 'Brilho puro estilo macOS' },
  { id: 'whatsapp-pop', label: 'Pop Mensagem', description: 'Duplo pop ágil de chat' },
  { id: 'soft-bell', label: 'Sino Suave', description: 'Acorde quente e confortável' },
  { id: 'digital-ping', label: 'Radar Digital', description: 'Bip técnico de suporte' },
  { id: 'subtle-tap', label: 'Toque Discreto', description: 'Clique mínimo e silencioso' },
  { id: 'none', label: 'Sem som', description: 'Apenas notificação visual' },
];

export const OUTAGE_SIREN_OPTIONS: SoundPresetOption<OutageSirenSoundId>[] = [
  { id: 'noc-classic', label: 'Sirene NOC', description: 'Varredura intensa padrão AVL' },
  { id: 'police-wail', label: 'Emergência Hi-Lo', description: 'Alternância rápida dois tons' },
  { id: 'radar-sonar', label: 'Alarme Radar', description: 'Pulsos rápidos de datacenter' },
  { id: 'industrial-klaxon', label: 'Klaxon Grave', description: 'Buzina grave sem agudo forte' },
  { id: 'chime-urgent', label: 'Alerta Corporativo', description: 'Urgente e musical sem assustar' },
  { id: 'nuclear-pulse', label: 'Pulso Crítico', description: 'Subida rápida de alta atenção' },
  { id: 'none', label: 'Silenciosa', description: 'Sem áudio (apenas alerta visual)' },
];

export interface SirenPlaybackHandle {
  stop: () => void;
  durationMs: number;
}

let sharedAudioCtx: AudioContext | null = null;

export function getSharedAudioContext(): AudioContext | null {
  try {
    if (typeof window === 'undefined') return null;
    if (!sharedAudioCtx) {
      const AudioCtor =
        window.AudioContext ||
        (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtor) {
        sharedAudioCtx = new AudioCtor();
      }
    }
    if (sharedAudioCtx?.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => undefined);
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

function clampVolume(volumePercent: number): number {
  if (!Number.isFinite(volumePercent)) return 0.75;
  return Math.max(0, Math.min(1, volumePercent / 100));
}

function scheduleTone(
  ctx: AudioContext,
  destination: AudioNode,
  opts: {
    type: OscillatorType;
    freq: number;
    endFreq?: number;
    startAt: number;
    duration: number;
    peakGain: number;
    attack?: number;
  }
): OscillatorNode {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = opts.type;
  osc.frequency.setValueAtTime(opts.freq, opts.startAt);
  if (opts.endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(40, opts.endFreq),
      opts.startAt + opts.duration
    );
  }

  const attack = Math.min(opts.attack ?? 0.012, opts.duration * 0.4);
  gain.gain.setValueAtTime(0.0001, opts.startAt);
  gain.gain.linearRampToValueAtTime(Math.max(0.001, opts.peakGain), opts.startAt + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, opts.startAt + opts.duration);

  osc.connect(gain);
  gain.connect(destination);
  osc.start(opts.startAt);
  osc.stop(opts.startAt + opts.duration + 0.01);
  return osc;
}

/**
 * Reproduz o som de notificação escolhido pelo operador (chat / avisos).
 */
export function playNotificationPreset(
  soundId: NotificationSoundId = 'tri-chime',
  volumePercent = 75
): void {
  if (soundId === 'none') return;
  const vol = clampVolume(volumePercent);
  if (vol <= 0.005) return;

  const ctx = getSharedAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime + 0.01;
    const master = ctx.createGain();
    master.gain.setValueAtTime(vol, now);
    master.connect(ctx.destination);

    switch (soundId) {
      case 'glass-ping': {
        // Cristal Apple: harmônico limpo D6 + A6
        scheduleTone(ctx, master, {
          type: 'sine',
          freq: 1174.66,
          startAt: now,
          duration: 0.34,
          peakGain: 0.34,
          attack: 0.008,
        });
        scheduleTone(ctx, master, {
          type: 'sine',
          freq: 1760,
          startAt: now + 0.045,
          duration: 0.38,
          peakGain: 0.2,
          attack: 0.008,
        });
        break;
      }
      case 'whatsapp-pop': {
        // Duplo pop rápido estilo mensageiro
        scheduleTone(ctx, master, {
          type: 'sine',
          freq: 520,
          endFreq: 780,
          startAt: now,
          duration: 0.095,
          peakGain: 0.38,
          attack: 0.006,
        });
        scheduleTone(ctx, master, {
          type: 'sine',
          freq: 760,
          endFreq: 1080,
          startAt: now + 0.11,
          duration: 0.13,
          peakGain: 0.36,
          attack: 0.006,
        });
        break;
      }
      case 'soft-bell': {
        // Acorde quente C5 -> E5 -> G5
        const notes = [523.25, 659.25, 783.99];
        notes.forEach((freq, idx) => {
          scheduleTone(ctx, master, {
            type: 'triangle',
            freq,
            startAt: now + idx * 0.085,
            duration: 0.36,
            peakGain: 0.26,
            attack: 0.015,
          });
        });
        break;
      }
      case 'digital-ping': {
        // Duplo bip técnico nítido
        scheduleTone(ctx, master, {
          type: 'triangle',
          freq: 1046.5,
          startAt: now,
          duration: 0.09,
          peakGain: 0.32,
          attack: 0.005,
        });
        scheduleTone(ctx, master, {
          type: 'triangle',
          freq: 1318.5,
          startAt: now + 0.115,
          duration: 0.15,
          peakGain: 0.34,
          attack: 0.005,
        });
        break;
      }
      case 'subtle-tap': {
        // Clique orgânico ultradiscreto
        scheduleTone(ctx, master, {
          type: 'sine',
          freq: 660,
          endFreq: 420,
          startAt: now,
          duration: 0.065,
          peakGain: 0.28,
          attack: 0.004,
        });
        break;
      }
      case 'tri-chime':
      default: {
        // Clássico AVL em 3 tons ascendentes
        const freqs = [800, 1000, 1200];
        freqs.forEach((freq, idx) => {
          scheduleTone(ctx, master, {
            type: 'sine',
            freq,
            startAt: now + idx * 0.14,
            duration: 0.15,
            peakGain: 0.32,
            attack: 0.01,
          });
        });
        break;
      }
    }
  } catch (err) {
    console.warn('[soundEngine] Erro ao reproduzir som de notificação:', err);
  }
}

/**
 * Reproduz a sirene de rompimento em massa escolhida pelo operador.
 * Retorna handle com função stop() para interrupção imediata.
 */
export function playOutageSirenPreset(
  soundId: OutageSirenSoundId = 'noc-classic',
  options?: { cycles?: number; volumePercent?: number }
): SirenPlaybackHandle {
  const noopHandle: SirenPlaybackHandle = { stop: () => undefined, durationMs: 0 };
  if (soundId === 'none') return noopHandle;

  const vol = clampVolume(options?.volumePercent ?? 90);
  if (vol <= 0.005) return noopHandle;

  const ctx = getSharedAudioContext();
  if (!ctx) return noopHandle;

  const cycles = Math.min(6, Math.max(1, options?.cycles ?? 3));
  const activeOscs: OscillatorNode[] = [];
  let stopped = false;

  try {
    const now = ctx.currentTime + 0.01;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-16, now);
    compressor.knee.setValueAtTime(6, now);
    compressor.ratio.setValueAtTime(10, now);
    compressor.attack.setValueAtTime(0.003, now);
    compressor.release.setValueAtTime(0.14, now);

    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    compressor.connect(masterGain);

    let totalSec = 0;

    if (soundId === 'noc-classic') {
      const cycleSec = 1.25;
      totalSec = cycles * cycleSec;

      masterGain.gain.setValueAtTime(0.001, now);
      masterGain.gain.linearRampToValueAtTime(0.92 * vol, now + 0.06);
      masterGain.gain.setValueAtTime(0.92 * vol, Math.max(now + 0.08, now + totalSec - 0.12));
      masterGain.gain.exponentialRampToValueAtTime(0.001, now + totalSec);

      const oscPrincipal = ctx.createOscillator();
      const oscHarmonica = ctx.createOscillator();
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.42, now);

      oscPrincipal.type = 'sawtooth';
      oscHarmonica.type = 'square';

      for (let c = 0; c < cycles; c++) {
        const t0 = now + c * cycleSec;
        const tMid = t0 + cycleSec * 0.52;
        const tEnd = t0 + cycleSec;

        oscPrincipal.frequency.setValueAtTime(620, t0);
        oscPrincipal.frequency.linearRampToValueAtTime(1380, tMid);
        oscPrincipal.frequency.linearRampToValueAtTime(620, tEnd);

        oscHarmonica.frequency.setValueAtTime(930, t0);
        oscHarmonica.frequency.linearRampToValueAtTime(690, tMid);
        oscHarmonica.frequency.linearRampToValueAtTime(930, tEnd);
      }

      oscPrincipal.connect(compressor);
      oscHarmonica.connect(subGain);
      subGain.connect(compressor);
      oscPrincipal.start(now);
      oscHarmonica.start(now);
      oscPrincipal.stop(now + totalSec + 0.02);
      oscHarmonica.stop(now + totalSec + 0.02);
      activeOscs.push(oscPrincipal, oscHarmonica);
    } else if (soundId === 'police-wail') {
      // Emergência Hi-Lo europeia (dois tons limpos alternados)
      const cycleSec = 0.96;
      totalSec = cycles * cycleSec;
      masterGain.gain.setValueAtTime(0.85 * vol, now);

      for (let c = 0; c < cycles; c++) {
        const base = now + c * cycleSec;
        activeOscs.push(
          scheduleTone(ctx, compressor, {
            type: 'triangle',
            freq: 960,
            startAt: base,
            duration: 0.44,
            peakGain: 0.72,
            attack: 0.02,
          }),
          scheduleTone(ctx, compressor, {
            type: 'sine',
            freq: 480,
            startAt: base,
            duration: 0.44,
            peakGain: 0.25,
            attack: 0.02,
          }),
          scheduleTone(ctx, compressor, {
            type: 'triangle',
            freq: 740,
            startAt: base + 0.48,
            duration: 0.44,
            peakGain: 0.72,
            attack: 0.02,
          }),
          scheduleTone(ctx, compressor, {
            type: 'sine',
            freq: 370,
            startAt: base + 0.48,
            duration: 0.44,
            peakGain: 0.25,
            attack: 0.02,
          })
        );
      }
    } else if (soundId === 'radar-sonar') {
      // Pulsos rápidos de datacenter/NOC
      const cycleSec = 0.92;
      totalSec = cycles * cycleSec;
      masterGain.gain.setValueAtTime(0.86 * vol, now);

      for (let c = 0; c < cycles; c++) {
        const base = now + c * cycleSec;
        [0, 0.16, 0.32].forEach((offset, idx) => {
          activeOscs.push(
            scheduleTone(ctx, compressor, {
              type: 'square',
              freq: idx === 2 ? 1280 : 1040,
              startAt: base + offset,
              duration: 0.12,
              peakGain: 0.42,
              attack: 0.008,
            })
          );
        });
      }
    } else if (soundId === 'industrial-klaxon') {
      // Buzina grave dupla para ambiente fechado
      const cycleSec = 1.1;
      totalSec = cycles * cycleSec;
      masterGain.gain.setValueAtTime(0.9 * vol, now);

      for (let c = 0; c < cycles; c++) {
        const base = now + c * cycleSec;
        [0, 0.48].forEach((offset) => {
          activeOscs.push(
            scheduleTone(ctx, compressor, {
              type: 'sawtooth',
              freq: 310,
              endFreq: 280,
              startAt: base + offset,
              duration: 0.34,
              peakGain: 0.46,
              attack: 0.02,
            }),
            scheduleTone(ctx, compressor, {
              type: 'triangle',
              freq: 465,
              endFreq: 420,
              startAt: base + offset,
              duration: 0.34,
              peakGain: 0.36,
              attack: 0.02,
            })
          );
        });
      }
    } else if (soundId === 'chime-urgent') {
      // Alerta corporativo urgente porém musical (não estridente)
      const cycleSec = 1.05;
      totalSec = cycles * cycleSec;
      masterGain.gain.setValueAtTime(0.84 * vol, now);

      const pattern = [
        { offset: 0, freq: 880 },
        { offset: 0.18, freq: 698.46 },
        { offset: 0.36, freq: 880 },
        { offset: 0.56, freq: 1046.5 },
      ];
      for (let c = 0; c < cycles; c++) {
        const base = now + c * cycleSec;
        pattern.forEach((step) => {
          activeOscs.push(
            scheduleTone(ctx, compressor, {
              type: 'triangle',
              freq: step.freq,
              startAt: base + step.offset,
              duration: 0.17,
              peakGain: 0.58,
              attack: 0.01,
            })
          );
        });
      }
    } else if (soundId === 'nuclear-pulse') {
      // Subida rápida crítica
      const cycleSec = 0.85;
      totalSec = cycles * cycleSec;
      masterGain.gain.setValueAtTime(0.88 * vol, now);

      for (let c = 0; c < cycles; c++) {
        const base = now + c * cycleSec;
        activeOscs.push(
          scheduleTone(ctx, compressor, {
            type: 'sawtooth',
            freq: 420,
            endFreq: 1480,
            startAt: base,
            duration: 0.62,
            peakGain: 0.52,
            attack: 0.025,
          }),
          scheduleTone(ctx, compressor, {
            type: 'sine',
            freq: 210,
            endFreq: 740,
            startAt: base,
            duration: 0.62,
            peakGain: 0.35,
            attack: 0.025,
          })
        );
      }
    }

    const stop = () => {
      if (stopped) return;
      stopped = true;
      try {
        masterGain.gain.cancelScheduledValues(ctx.currentTime);
        masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      } catch {
        // noop
      }
      activeOscs.forEach((osc) => {
        try {
          osc.stop();
          osc.disconnect();
        } catch {
          // oscilador já encerrado
        }
      });
      activeOscs.length = 0;
    };

    return {
      stop,
      durationMs: Math.round(totalSec * 1000) + 80,
    };
  } catch (err) {
    console.warn('[soundEngine] Erro ao reproduzir sirene NOC:', err);
    return noopHandle;
  }
}

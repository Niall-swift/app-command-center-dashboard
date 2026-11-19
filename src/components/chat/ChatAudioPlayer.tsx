import React, { useEffect, useId, useRef, useState } from 'react';
import { Download, Pause, Play, Volume2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatAudioPlayerProps {
  url: string;
  fromMe?: boolean;
  durationHint?: number;
}

const AUDIO_PLAY_EVENT = 'avl-chat-audio-play';
const SPEEDS = [1, 1.5, 2] as const;

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const total = Math.floor(sec);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Player de áudio estilo WhatsApp com seek real, controle de velocidade e pausa coordenada. */
export function ChatAudioPlayer({
  url,
  fromMe = false,
  durationHint,
}: ChatAudioPlayerProps) {
  const playerId = useId();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number>(durationHint || 0);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [loadError, setLoadError] = useState(false);

  const playbackRate = SPEEDS[speedIndex];

  useEffect(() => {
    const onOtherPlay = (event: Event) => {
      const custom = event as CustomEvent<{ id: string }>;
      if (custom.detail?.id !== playerId && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    };
    window.addEventListener(AUDIO_PLAY_EVENT, onOtherPlay);
    return () => window.removeEventListener(AUDIO_PLAY_EVENT, onOtherPlay);
  }, [playerId]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const togglePlay = async () => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
      return;
    }
    window.dispatchEvent(new CustomEvent(AUDIO_PLAY_EVENT, { detail: { id: playerId } }));
    try {
      await el.play();
      setIsPlaying(true);
      setLoadError(false);
    } catch {
      setLoadError(true);
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextTime = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = nextTime;
    }
    setCurrentTime(nextTime);
  };

  const cycleSpeed = () => {
    setSpeedIndex((prev) => (prev + 1) % SPEEDS.length);
  };

  const effectiveDuration = duration > 0 ? duration : durationHint || 0;
  const progressPct =
    effectiveDuration > 0 ? Math.min(100, (currentTime / effectiveDuration) * 100) : 0;

  return (
    <div
      className={`flex items-center gap-2.5 min-w-[235px] sm:min-w-[265px] p-2.5 rounded-xl ${
        fromMe ? 'bg-black/15' : 'bg-secondary/70 border border-border/60'
      }`}
    >
      <audio
        ref={audioRef}
        src={url}
        preload="none"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDuration(d);
        }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onError={() => setLoadError(true)}
      />

      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'}
        className={`h-10 w-10 rounded-full shrink-0 shadow-sm transition-transform active:scale-95 ${
          fromMe
            ? 'bg-white text-primary hover:bg-white/90'
            : 'bg-primary text-primary-foreground hover:bg-primary/90'
        }`}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </Button>

      <div className="flex-1 min-w-0 space-y-1">
        {loadError ? (
          <div className="flex items-center gap-1.5 text-[11px] opacity-90">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Áudio indisponível no player</span>
          </div>
        ) : (
          <div className="relative flex items-center h-4">
            <div
              className={`w-full h-1.5 rounded-full overflow-hidden ${
                fromMe ? 'bg-white/25' : 'bg-muted-foreground/25'
              }`}
            >
              <div
                className={`h-full rounded-full transition-[width] duration-100 ${
                  fromMe ? 'bg-white' : 'bg-primary'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={effectiveDuration || 1}
              step={0.1}
              value={Math.min(currentTime, effectiveDuration || 1)}
              onChange={handleSeek}
              aria-label="Posição do áudio"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
          <span className={fromMe ? 'text-primary-foreground/85' : 'text-muted-foreground'}>
            {isPlaying || currentTime > 0
              ? `${formatSeconds(currentTime)} / ${formatSeconds(effectiveDuration)}`
              : effectiveDuration > 0
              ? formatSeconds(effectiveDuration)
              : 'Áudio'}
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={cycleSpeed}
              title="Alterar velocidade de reprodução"
              className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold transition-colors ${
                fromMe
                  ? 'bg-white/20 hover:bg-white/30 text-white'
                  : 'bg-background hover:bg-muted text-foreground border border-border/60'
              }`}
            >
              {playbackRate}x
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              download
              title="Baixar áudio"
              className={`p-1 rounded-full transition-colors ${
                fromMe
                  ? 'hover:bg-white/20 text-white/90'
                  : 'hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <Download className="w-3 h-3" />
            </a>
            <Volume2
              className={`w-3 h-3 ${isPlaying ? 'opacity-100 animate-pulse' : 'opacity-40'}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

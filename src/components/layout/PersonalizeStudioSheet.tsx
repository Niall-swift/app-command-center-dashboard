import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
  Bell,
  Check,
  Contrast,
  Home,
  Image as ImageIcon,
  Lock,
  Monitor,
  Moon,
  Palette,
  Play,
  RotateCcw,
  Siren,
  Sparkles,
  Square,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ACCENT_PRESETS,
  WORKSPACE_MODES,
  type AccentPresetId,
  type AutoLockMinutes,
  type DensityMode,
  type FontScaleMode,
  type NotificationPositionMode,
  type NotificationStyleMode,
  type RadiusMode,
  type SplashBgPreset,
  useUiPreferences,
} from '@/contexts/UiPreferencesContext';
import {
  NOTIFICATION_SOUND_OPTIONS,
  OUTAGE_SIREN_OPTIONS,
  playNotificationPreset,
  playOutageSirenPreset,
  type NotificationSoundId,
  type OutageSirenSoundId,
} from '@/utils/soundEngine';
import { useAuth } from '@/contexts/AuthContext';
import { SCREEN_PERMISSIONS } from '@/config/permissions';
import {
  Ps5UserSplashScreen,
  SPLASH_BG_IMAGE_URL,
} from '@/components/auth/Ps5UserSplashScreen';

interface PersonalizeStudioSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const QUICK_PROFILES = [
  {
    id: 'apple-minimal',
    label: 'Apple Minimal',
    subtitle: 'Limpo e equilibrado',
    theme: 'light' as const,
    patch: {
      accent: 'blue' as AccentPresetId,
      darkSurface: 'default' as const,
      density: 'comfortable' as DensityMode,
      fontScale: 'md' as FontScaleMode,
      radius: 'round' as RadiusMode,
      canvasPattern: 'clean' as const,
      showHeaderSubtitle: false,
    },
  },
  {
    id: 'linear-dark',
    label: 'Linear Dark',
    subtitle: 'Escuro sutil e moderno',
    theme: 'dark' as const,
    patch: {
      accent: 'violet' as AccentPresetId,
      darkSurface: 'default' as const,
      density: 'comfortable' as DensityMode,
      fontScale: 'md' as FontScaleMode,
      radius: 'soft' as RadiusMode,
      canvasPattern: 'clean' as const,
      showHeaderSubtitle: false,
    },
  },
  {
    id: 'oled-noc',
    label: 'OLED Foco',
    subtitle: 'Preto puro + compacto',
    theme: 'dark' as const,
    patch: {
      accent: 'emerald' as AccentPresetId,
      darkSurface: 'oled' as const,
      density: 'compact' as DensityMode,
      fontScale: 'sm' as FontScaleMode,
      radius: 'soft' as RadiusMode,
      canvasPattern: 'clean' as const,
      showHeaderSubtitle: false,
    },
  },
  {
    id: 'easy-read',
    label: 'Leitura Fácil',
    subtitle: 'Textos e botões maiores',
    theme: 'light' as const,
    patch: {
      accent: 'blue' as AccentPresetId,
      darkSurface: 'default' as const,
      density: 'spacious' as DensityMode,
      fontScale: 'lg' as FontScaleMode,
      radius: 'round' as RadiusMode,
      canvasPattern: 'clean' as const,
      showHeaderSubtitle: true,
    },
  },
];

const AUTO_LOCK_OPTIONS: Array<{ value: AutoLockMinutes; label: string }> = [
  { value: 2, label: '2m' },
  { value: 5, label: '5m' },
  { value: 10, label: '10m' },
  { value: 15, label: '15m' },
  { value: 30, label: '30m' },
  { value: 0, label: 'Off' },
];

const NOTIFICATION_STYLE_OPTIONS: Array<{
  id: NotificationStyleMode;
  label: string;
  subtitle: string;
}> = [
  { id: 'modern', label: 'Moderno', subtitle: 'Cores ricas padrão' },
  { id: 'glass', label: 'Glass Apple', subtitle: 'Vidro translúcido blur' },
  { id: 'solid', label: 'Alto Contraste', subtitle: 'Faixa lateral NOC' },
  { id: 'minimal', label: 'Minimalista', subtitle: 'Compacto e discreto' },
  { id: 'pill', label: 'Pílula', subtitle: 'Flutuante arredondado' },
];

const NOTIFICATION_POSITION_OPTIONS: Array<{
  id: NotificationPositionMode;
  label: string;
}> = [
  { id: 'top-right', label: 'Topo Dir.' },
  { id: 'top-center', label: 'Topo Centro' },
  { id: 'bottom-right', label: 'Base Dir.' },
  { id: 'bottom-center', label: 'Base Centro' },
];

export const PersonalizeStudioSheet: React.FC<PersonalizeStudioSheetProps> = ({
  open,
  onOpenChange,
}) => {
  const { theme, setTheme } = useTheme();
  const { user, panelProfile, canAccessRoute } = useAuth();
  const { preferences, updatePreferences, resetPreferences } = useUiPreferences();
  const [customUrlDraft, setCustomUrlDraft] = useState(preferences.splashCustomBgUrl);
  const [showEntryPreview, setShowEntryPreview] = useState(false);
  const [playingSirenPreview, setPlayingSirenPreview] = useState<OutageSirenSoundId | null>(null);
  const sirenPreviewStopRef = useRef<(() => void) | null>(null);
  const sirenPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopSirenPreview = useCallback(() => {
    if (sirenPreviewTimerRef.current) {
      clearTimeout(sirenPreviewTimerRef.current);
      sirenPreviewTimerRef.current = null;
    }
    if (sirenPreviewStopRef.current) {
      sirenPreviewStopRef.current();
      sirenPreviewStopRef.current = null;
    }
    setPlayingSirenPreview(null);
  }, []);

  const previewSirenSound = useCallback(
    (soundId: OutageSirenSoundId, cycles = 1) => {
      stopSirenPreview();
      if (soundId === 'none' || preferences.sirenVolume <= 0) return;
      const handle = playOutageSirenPreset(soundId, {
        cycles,
        volumePercent: preferences.sirenVolume,
      });
      if (handle.durationMs <= 0) return;
      sirenPreviewStopRef.current = handle.stop;
      setPlayingSirenPreview(soundId);
      sirenPreviewTimerRef.current = setTimeout(() => {
        sirenPreviewStopRef.current = null;
        sirenPreviewTimerRef.current = null;
        setPlayingSirenPreview(null);
      }, handle.durationMs);
    },
    [preferences.sirenVolume, stopSirenPreview]
  );

  useEffect(() => {
    if (!open) {
      stopSirenPreview();
    }
    return () => {
      stopSirenPreview();
    };
  }, [open, stopSirenPreview]);

  const handleTestNotificationSample = (
    overrideStyle?: NotificationStyleMode,
    overrideSound?: NotificationSoundId
  ) => {
    const soundId = overrideSound ?? preferences.notificationSound;
    playNotificationPreset(soundId, preferences.notificationVolume);
    const activeStyle =
      NOTIFICATION_STYLE_OPTIONS.find(
        (s) => s.id === (overrideStyle ?? preferences.notificationStyle)
      )?.label || 'Moderno';
    toast.info('Prévia de Notificação AVL', {
      description: `Estilo "${activeStyle}" aplicado em tempo real.`,
      duration: 3500,
    });
  };

  useEffect(() => {
    setCustomUrlDraft(preferences.splashCustomBgUrl);
  }, [preferences.splashCustomBgUrl]);

  const allowedScreens = useMemo(
    () => SCREEN_PERMISSIONS.filter((s) => canAccessRoute(s.path)),
    [canAccessRoute]
  );

  const activeThemeMode =
    theme === 'dark' && preferences.darkSurface === 'oled'
      ? 'oled'
      : theme === 'dark'
      ? 'dark'
      : theme === 'light'
      ? 'light'
      : 'system';

  const handleSelectThemeMode = (mode: 'light' | 'dark' | 'oled' | 'system') => {
    if (mode === 'oled') {
      setTheme('dark');
      updatePreferences({ darkSurface: 'oled' });
    } else if (mode === 'dark') {
      setTheme('dark');
      updatePreferences({ darkSurface: 'default' });
    } else if (mode === 'light') {
      setTheme('light');
      updatePreferences({ darkSurface: 'default' });
    } else {
      setTheme('system');
      updatePreferences({ darkSurface: 'default' });
    }
  };

  const handleSaveCustomSplashUrl = () => {
    const trimmed = customUrlDraft.trim();
    if (!trimmed || !/^https?:\/\//i.test(trimmed)) {
      toast.warning('Cole uma URL válida começando com https://');
      return;
    }
    updatePreferences({ splashBgPreset: 'custom', splashCustomBgUrl: trimmed });
    toast.success('Imagem de fundo da tela de entrada atualizada!');
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[420px] p-0 flex flex-col bg-card/95 backdrop-blur-2xl border-l border-border/70"
        >
          <SheetHeader className="px-5 pt-5 pb-4 border-b border-border/60 text-left">
            <div className="flex items-center justify-between gap-2 pr-7">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-primary/12 text-primary flex items-center justify-center shrink-0">
                  <Palette className="w-4 h-4" />
                </span>
                <div>
                  <SheetTitle className="text-base font-bold tracking-tight">
                    Personalizar Interface
                  </SheetTitle>
                  <SheetDescription className="text-[11px] mt-0.5">
                    Tudo é aplicado ao vivo e salvo no seu login.
                  </SheetDescription>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  resetPreferences();
                  setTheme('system');
                  setCustomUrlDraft('');
                  toast.success('Visual padrão minimalista restaurado!');
                }}
                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                title="Restaurar padrão"
              >
                <RotateCcw className="w-3 h-3" />
                Padrão
              </Button>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            {/* 1. Estilos prontos em 1 clique */}
            <section className="space-y-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                Estilos Prontos (1 clique)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_PROFILES.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setTheme(preset.theme);
                      updatePreferences(preset.patch);
                    }}
                    className="p-2.5 rounded-xl border border-border/70 bg-background/60 hover:border-primary/50 hover:bg-primary/[0.04] text-left transition-all"
                  >
                    <p className="text-xs font-bold text-foreground">{preset.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{preset.subtitle}</p>
                  </button>
                ))}
              </div>
            </section>

            {/* 2. Tema & Superfície */}
            <section className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tema &amp; Superfície
              </p>
              <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-secondary/60 border border-border/60">
                {(
                  [
                    { id: 'light', label: 'Claro', icon: Sun },
                    { id: 'dark', label: 'Escuro', icon: Moon },
                    { id: 'oled', label: 'OLED', icon: Contrast },
                    { id: 'system', label: 'Auto', icon: Monitor },
                  ] as const
                ).map((item) => {
                  const Icon = item.icon;
                  const active = activeThemeMode === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectThemeMode(item.id)}
                      className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg text-[11px] font-semibold transition-all ${
                        active
                          ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {/* Cor de Destaque */}
              <div className="space-y-2 pt-1">
                <span className="text-xs font-medium text-foreground">Cor de destaque</span>
                <div className="grid grid-cols-6 gap-2">
                  {(Object.values(ACCENT_PRESETS) as Array<(typeof ACCENT_PRESETS)[AccentPresetId]>).map(
                    (preset) => {
                      const active = preferences.accent === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => updatePreferences({ accent: preset.id })}
                          title={preset.label}
                          className={`group flex flex-col items-center gap-1 p-1.5 rounded-xl border transition-all ${
                            active
                              ? 'border-primary bg-primary/10'
                              : 'border-transparent hover:bg-secondary/70'
                          }`}
                        >
                          <span
                            className="w-7 h-7 rounded-full flex items-center justify-center shadow-sm ring-1 ring-black/10 dark:ring-white/15"
                            style={{ backgroundColor: preset.swatch }}
                          >
                            {active && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                          </span>
                          <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground truncate max-w-full">
                            {preset.label}
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Fundo do painel */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <div>
                  <p className="text-xs font-medium text-foreground">Fundo da tela</p>
                  <p className="text-[11px] text-muted-foreground">
                    Liso minimalista ou com pontos sutis
                  </p>
                </div>
                <div className="inline-flex p-0.5 rounded-lg bg-secondary/70 border border-border/60">
                  {(
                    [
                      { id: 'clean', label: 'Liso' },
                      { id: 'dots', label: 'Grade' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updatePreferences({ canvasPattern: opt.id })}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                        preferences.canvasPattern === opt.id
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* 3. Conforto, Densidade & Bordas */}
            <section className="space-y-3.5 pt-2 border-t border-border/60">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Conforto &amp; Legibilidade
              </p>

              {/* Densidade */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-foreground">Espaçamento</span>
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-secondary/60 border border-border/60">
                  {(
                    [
                      { id: 'compact', label: 'Compacto' },
                      { id: 'comfortable', label: 'Confortável' },
                      { id: 'spacious', label: 'Espaçoso' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updatePreferences({ density: opt.id })}
                      className={`py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                        preferences.density === opt.id
                          ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tamanho do texto */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-foreground">Tamanho da fonte</p>
                  <p className="text-[11px] text-muted-foreground">Escala global do sistema</p>
                </div>
                <div className="inline-flex p-0.5 rounded-lg bg-secondary/70 border border-border/60">
                  {(
                    [
                      { id: 'sm', label: 'A-' },
                      { id: 'md', label: 'A' },
                      { id: 'lg', label: 'A+' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updatePreferences({ fontScale: opt.id })}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                        preferences.fontScale === opt.id
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Arredondamento */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-foreground">Cantos dos cards</p>
                  <p className="text-[11px] text-muted-foreground">Estilo das bordas e botões</p>
                </div>
                <div className="inline-flex p-0.5 rounded-lg bg-secondary/70 border border-border/60">
                  {(
                    [
                      { id: 'sharp', label: 'Reto' },
                      { id: 'soft', label: 'Suave' },
                      { id: 'round', label: 'Redondo' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updatePreferences({ radius: opt.id })}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                        preferences.radius === opt.id
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* 4. Notificações, Sons & Sirene de Rompimento */}
            <section className="space-y-4 pt-2 border-t border-border/60">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-primary" />
                  Notificações, Sons &amp; Sirene
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleTestNotificationSample()}
                  className="h-6 px-2 text-[11px] text-primary hover:bg-primary/10 gap-1"
                >
                  <Play className="w-3 h-3" />
                  Testar aviso
                </Button>
              </div>

              {/* Estilo visual da notificação */}
              <div className="space-y-2">
                <span className="text-xs font-medium text-foreground">Estilo da notificação</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {NOTIFICATION_STYLE_OPTIONS.map((opt) => {
                    const active = preferences.notificationStyle === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          updatePreferences({ notificationStyle: opt.id });
                          setTimeout(() => {
                            toast.info(`Estilo ${opt.label}`, {
                              description: opt.subtitle,
                              duration: 2400,
                            });
                          }, 60);
                        }}
                        className={`p-2 rounded-xl border text-left transition-all ${
                          active
                            ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                            : 'border-border/70 bg-background/60 hover:border-primary/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] font-bold text-foreground">
                            {opt.label}
                          </span>
                          {active && <Check className="w-3 h-3 text-primary shrink-0" />}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {opt.subtitle}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Posição da notificação */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-foreground">Posição na tela</span>
                <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-secondary/60 border border-border/60">
                  {NOTIFICATION_POSITION_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updatePreferences({ notificationPosition: opt.id })}
                      className={`py-1.5 px-1 rounded-lg text-[10px] font-semibold transition-all ${
                        preferences.notificationPosition === opt.id
                          ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Som da notificação + volume */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-foreground">
                    Som de notificação (Chat e avisos)
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                    {preferences.notificationSound === 'none'
                      ? 'Mudo'
                      : `${preferences.notificationVolume}%`}
                  </span>
                </div>

                {preferences.notificationSound !== 'none' && (
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-secondary/50 border border-border/50">
                    {preferences.notificationVolume === 0 ? (
                      <VolumeX className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5 text-primary shrink-0" />
                    )}
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={preferences.notificationVolume}
                      onChange={(e) =>
                        updatePreferences({ notificationVolume: Number(e.target.value) })
                      }
                      onMouseUp={() =>
                        playNotificationPreset(
                          preferences.notificationSound,
                          preferences.notificationVolume
                        )
                      }
                      onTouchEnd={() =>
                        playNotificationPreset(
                          preferences.notificationSound,
                          preferences.notificationVolume
                        )
                      }
                      aria-label="Volume do som de notificação"
                      className="w-full h-1.5 accent-primary cursor-pointer"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-1.5">
                  {NOTIFICATION_SOUND_OPTIONS.map((opt) => {
                    const active = preferences.notificationSound === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          updatePreferences({ notificationSound: opt.id });
                          playNotificationPreset(opt.id, preferences.notificationVolume);
                        }}
                        className={`p-2 rounded-xl border text-left transition-all ${
                          active
                            ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                            : 'border-border/70 bg-background/60 hover:border-primary/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] font-bold text-foreground truncate">
                            {opt.label}
                          </span>
                          {opt.id === 'none' ? (
                            <VolumeX className="w-3 h-3 text-muted-foreground shrink-0" />
                          ) : active ? (
                            <Check className="w-3 h-3 text-primary shrink-0" />
                          ) : (
                            <Play className="w-2.5 h-2.5 text-muted-foreground/70 shrink-0" />
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {opt.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Som da Sirene de Rompimento */}
              <div className="space-y-2 pt-3 border-t border-border/50">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Siren className="w-3.5 h-3.5 text-rose-500" />
                    Sirene de Rompimento (NOC)
                  </span>
                  {playingSirenPreview ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={stopSirenPreview}
                      className="h-6 px-2 text-[10px] gap-1"
                    >
                      <Square className="w-2.5 h-2.5 fill-current" />
                      Parar
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={
                        preferences.outageSirenSound === 'none' || preferences.sirenVolume === 0
                      }
                      onClick={() => previewSirenSound(preferences.outageSirenSound, 2)}
                      className="h-6 px-2 text-[10px] text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 gap-1"
                    >
                      <Play className="w-2.5 h-2.5" />
                      Testar sirene
                    </Button>
                  )}
                </div>

                {preferences.outageSirenSound !== 'none' && (
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-rose-500/5 border border-rose-500/20">
                    {preferences.sirenVolume === 0 ? (
                      <VolumeX className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    )}
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={preferences.sirenVolume}
                      onChange={(e) => updatePreferences({ sirenVolume: Number(e.target.value) })}
                      aria-label="Volume da sirene de rompimento"
                      className="w-full h-1.5 accent-rose-500 cursor-pointer"
                    />
                    <span className="text-[10px] font-mono text-muted-foreground tabular-nums w-8 text-right">
                      {preferences.sirenVolume}%
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-1.5">
                  {OUTAGE_SIREN_OPTIONS.map((opt) => {
                    const active = preferences.outageSirenSound === opt.id;
                    const isPlayingThis = playingSirenPreview === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          updatePreferences({ outageSirenSound: opt.id });
                          if (isPlayingThis) {
                            stopSirenPreview();
                          } else if (opt.id === 'none') {
                            stopSirenPreview();
                          } else {
                            previewSirenSound(opt.id, 1);
                          }
                        }}
                        className={`p-2 rounded-xl border text-left transition-all ${
                          active
                            ? 'border-rose-500/70 bg-rose-500/10 ring-1 ring-rose-500/30'
                            : 'border-border/70 bg-background/60 hover:border-rose-500/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] font-bold text-foreground truncate">
                            {opt.label}
                          </span>
                          {opt.id === 'none' ? (
                            <VolumeX className="w-3 h-3 text-muted-foreground shrink-0" />
                          ) : isPlayingThis ? (
                            <Square className="w-2.5 h-2.5 text-rose-500 fill-current shrink-0 animate-pulse" />
                          ) : active ? (
                            <Check className="w-3 h-3 text-rose-500 shrink-0" />
                          ) : (
                            <Play className="w-2.5 h-2.5 text-muted-foreground/70 shrink-0" />
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {opt.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* 4. Tela Inicial & Simplicidade */}
            <section className="space-y-3.5 pt-2 border-t border-border/60">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5 text-primary" />
                Fluxo de Trabalho
              </p>

              <div className="space-y-1.5">
                <span className="text-xs font-medium text-foreground">
                  Tela inicial ao abrir o sistema
                </span>
                <Select
                  value={preferences.defaultHomeRoute}
                  onValueChange={(val) => updatePreferences({ defaultHomeRoute: val })}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl bg-background">
                    <SelectValue placeholder="Escolha a tela inicial" />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedScreens.map((screen) => (
                      <SelectItem key={screen.path} value={screen.path} className="text-xs">
                        {screen.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-medium text-foreground">Modo de trabalho da Sidebar</span>
                <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-secondary/60 border border-border/60">
                  {WORKSPACE_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => updatePreferences({ workspaceMode: mode.id })}
                      title={mode.description}
                      className={`py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                        preferences.workspaceMode === mode.id
                          ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {mode.shortLabel}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <p className="text-xs font-medium text-foreground">Topo silencioso (Status unificado)</p>
                    <p className="text-[11px] text-muted-foreground">
                      Junta Rede + WhatsApp em 1 indicador discreto
                    </p>
                  </div>
                  <Switch
                    checked={preferences.headerCompactStatus}
                    onCheckedChange={(checked) =>
                      updatePreferences({ headerCompactStatus: checked })
                    }
                  />
                </label>

                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <p className="text-xs font-medium text-foreground">Subtítulo no topo</p>
                    <p className="text-[11px] text-muted-foreground">
                      Ocultar deixa o cabeçalho mais limpo
                    </p>
                  </div>
                  <Switch
                    checked={preferences.showHeaderSubtitle}
                    onCheckedChange={(checked) =>
                      updatePreferences({ showHeaderSubtitle: checked })
                    }
                  />
                </label>

                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <p className="text-xs font-medium text-foreground">Botão flutuante Nova O.S.</p>
                    <p className="text-[11px] text-muted-foreground">
                      Atalho verde no canto inferior direito
                    </p>
                  </div>
                  <Switch
                    checked={preferences.showQuickOsFab}
                    onCheckedChange={(checked) => updatePreferences({ showQuickOsFab: checked })}
                  />
                </label>

                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <p className="text-xs font-medium text-foreground">Reduzir animações</p>
                    <p className="text-[11px] text-muted-foreground">
                      Transições instantâneas para máxima leveza
                    </p>
                  </div>
                  <Switch
                    checked={preferences.reducedMotion}
                    onCheckedChange={(checked) => updatePreferences({ reducedMotion: checked })}
                  />
                </label>
              </div>
            </section>

            {/* 5. Tela de Entrada & Bloqueio PIN */}
            <section className="space-y-3.5 pt-2 border-t border-border/60 pb-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-primary" />
                  Tela de Entrada &amp; PIN
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowEntryPreview(true)}
                  className="h-6 px-2 text-[11px] text-primary hover:bg-primary/10 gap-1"
                >
                  <ImageIcon className="w-3 h-3" />
                  Visualizar
                </Button>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">
                    Bloqueio automático sem mexer
                  </span>
                  {!panelProfile?.hasPin && (
                    <span className="text-[10px] text-amber-500 font-medium">Requer PIN ativo</span>
                  )}
                </div>
                <div className="grid grid-cols-6 gap-1 p-1 rounded-xl bg-secondary/60 border border-border/60">
                  {AUTO_LOCK_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updatePreferences({ autoLockMinutes: opt.value })}
                      className={`py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                        preferences.autoLockMinutes === opt.value
                          ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-medium text-foreground">Fundo da tela de entrada</span>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      {
                        id: 'picsum',
                        label: 'Foto Blur Padrão',
                        style: {
                          backgroundImage: `linear-gradient(rgba(8,10,16,0.45), rgba(8,10,16,0.65)), url('${SPLASH_BG_IMAGE_URL}')`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        },
                      },
                      {
                        id: 'obsidian',
                        label: 'Escuro Puro',
                        style: {
                          background: 'radial-gradient(circle at 50% 35%, #181a20 0%, #07080a 100%)',
                        },
                      },
                      {
                        id: 'accent',
                        label: 'Aura da Cor',
                        style: {
                          background: `radial-gradient(circle at 50% 30%, ${ACCENT_PRESETS[preferences.accent].swatch}44 0%, #090b10 78%)`,
                        },
                      },
                      {
                        id: 'custom',
                        label: 'URL Própria',
                        style: preferences.splashCustomBgUrl
                          ? {
                              backgroundImage: `linear-gradient(rgba(8,10,16,0.45), rgba(8,10,16,0.65)), url('${preferences.splashCustomBgUrl}')`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                            }
                          : {
                              background: 'linear-gradient(135deg, #1f2937 0%, #0f172a 100%)',
                            },
                      },
                    ] as Array<{
                      id: SplashBgPreset;
                      label: string;
                      style: React.CSSProperties;
                    }>
                  ).map((bg) => {
                    const active = preferences.splashBgPreset === bg.id;
                    return (
                      <button
                        key={bg.id}
                        type="button"
                        onClick={() => updatePreferences({ splashBgPreset: bg.id })}
                        className={`relative h-14 rounded-xl overflow-hidden border text-left p-2 flex items-end transition-all ${
                          active
                            ? 'border-primary ring-2 ring-primary/30'
                            : 'border-border/70 hover:border-primary/40'
                        }`}
                        style={bg.style}
                      >
                        <span className="text-[11px] font-semibold text-white drop-shadow">
                          {bg.label}
                        </span>
                        {active && (
                          <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                            <Check className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {preferences.splashBgPreset === 'custom' && (
                  <div className="flex gap-1.5 pt-1">
                    <Input
                      value={customUrlDraft}
                      onChange={(e) => setCustomUrlDraft(e.target.value)}
                      placeholder="https://... (URL da imagem de fundo)"
                      className="h-8 text-xs bg-background"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveCustomSplashUrl}
                      className="h-8 px-3 text-xs shrink-0"
                    >
                      Aplicar
                    </Button>
                  </div>
                )}
              </div>
            </section>
          </div>
        </SheetContent>
      </Sheet>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {showEntryPreview && (
              <Ps5UserSplashScreen
                user={{
                  name: panelProfile?.name || user?.displayName || user?.email,
                  email: panelProfile?.email || user?.email,
                  photoUrl: panelProfile?.photoUrl || user?.photoURL || '',
                  role: panelProfile?.role,
                  jobTitle: panelProfile?.jobTitle,
                }}
                requirePin
                previewMode
                onVerifyPin={async () => ({ success: true, valid: true, hasPin: true })}
                onPinVerified={() => {
                  toast.success('Prévia desbloqueada!');
                  setShowEntryPreview(false);
                }}
                onDismiss={() => setShowEntryPreview(false)}
              />
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
};

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useTheme } from 'next-themes';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import type { NotificationSoundId, OutageSirenSoundId } from '@/utils/soundEngine';

export type AccentPresetId = 'blue' | 'emerald' | 'violet' | 'amber' | 'rose' | 'graphite';
export type DarkSurfaceMode = 'default' | 'oled';
export type DensityMode = 'compact' | 'comfortable' | 'spacious';
export type FontScaleMode = 'sm' | 'md' | 'lg';
export type RadiusMode = 'sharp' | 'soft' | 'round';
export type CanvasPatternMode = 'clean' | 'dots';
export type SplashBgPreset = 'picsum' | 'obsidian' | 'accent' | 'custom';
export type AutoLockMinutes = 0 | 2 | 5 | 10 | 15 | 30;
export type WorkspaceMode = 'all' | 'atendimento' | 'noc' | 'financeiro';
export type NotificationStyleMode = 'modern' | 'glass' | 'solid' | 'minimal' | 'pill';
export type NotificationPositionMode = 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center';

export interface WorkspaceModeConfig {
  id: WorkspaceMode;
  label: string;
  shortLabel: string;
  description: string;
  /** null = exibe todos os grupos do sistema */
  routes: string[] | null;
}

export const WORKSPACE_MODES: WorkspaceModeConfig[] = [
  {
    id: 'all',
    label: 'Completo',
    shortLabel: 'Todos',
    description: 'Todos os módulos da AVL',
    routes: null,
  },
  {
    id: 'atendimento',
    label: 'Atendimento',
    shortLabel: 'Chat',
    description: 'Chat, Ficha 360°, ISPFY Web, Nova O.S. e Bots',
    routes: [
      '/',
      '/chat',
      '/ispfy/consulta',
      '/ispfy/web',
      '/ispfy/nova-os',
      '/ispfy/tickets',
      '/ispfy/carencia',
      '/whatsapp/bulk',
      '/bots',
      '/requests',
    ],
  },
  {
    id: 'noc',
    label: 'NOC & Rede',
    shortLabel: 'NOC',
    description: 'Bairros/Quedas, CTO, Mapa, ISPFY Web e O.S.',
    routes: [
      '/',
      '/ispfy/regiao',
      '/ispfy/inteligencia',
      '/network-map',
      '/ispfy/nova-os',
      '/ispfy/tickets',
      '/technical-support',
      '/ispfy/consulta',
      '/ispfy/web',
      '/chat',
    ],
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    shortLabel: 'Fin.',
    description: 'Caixa, ISPFY Web, Vencimentos, Carência e DICI',
    routes: [
      '/',
      '/ispfy/financeiro',
      '/ispfy/consulta',
      '/ispfy/web',
      '/ispfy/vencimentos',
      '/ispfy/carencia',
      '/ispfy/auditoria',
      '/ispfy/dici',
      '/ispfy/exportar-ativos',
      '/whatsapp/bulk',
    ],
  },
];

export interface UiPreferences {
  accent: AccentPresetId;
  darkSurface: DarkSurfaceMode;
  density: DensityMode;
  fontScale: FontScaleMode;
  radius: RadiusMode;
  canvasPattern: CanvasPatternMode;
  showHeaderSubtitle: boolean;
  showQuickOsFab: boolean;
  headerCompactStatus: boolean;
  reducedMotion: boolean;
  defaultHomeRoute: string;
  workspaceMode: WorkspaceMode;
  favoriteRoutes: string[];
  autoLockMinutes: AutoLockMinutes;
  splashBgPreset: SplashBgPreset;
  splashCustomBgUrl: string;
  notificationSound: NotificationSoundId;
  notificationVolume: number;
  notificationStyle: NotificationStyleMode;
  notificationPosition: NotificationPositionMode;
  outageSirenSound: OutageSirenSoundId;
  sirenVolume: number;
}

export interface AccentPresetConfig {
  id: AccentPresetId;
  label: string;
  swatch: string;
  lightPrimary: string;
  lightForeground: string;
  darkPrimary: string;
  darkForeground: string;
}

export const ACCENT_PRESETS: Record<AccentPresetId, AccentPresetConfig> = {
  blue: {
    id: 'blue',
    label: 'Azul',
    swatch: '#3B82F6',
    lightPrimary: '221 83% 53%',
    lightForeground: '210 40% 98%',
    darkPrimary: '217 91% 60%',
    darkForeground: '0 0% 100%',
  },
  emerald: {
    id: 'emerald',
    label: 'Esmeralda',
    swatch: '#10B981',
    lightPrimary: '160 84% 36%',
    lightForeground: '0 0% 100%',
    darkPrimary: '158 76% 46%',
    darkForeground: '160 80% 6%',
  },
  violet: {
    id: 'violet',
    label: 'Violeta',
    swatch: '#8B5CF6',
    lightPrimary: '258 84% 58%',
    lightForeground: '0 0% 100%',
    darkPrimary: '255 92% 70%',
    darkForeground: '0 0% 100%',
  },
  amber: {
    id: 'amber',
    label: 'Âmbar',
    swatch: '#F59E0B',
    lightPrimary: '32 95% 44%',
    lightForeground: '0 0% 100%',
    darkPrimary: '38 92% 55%',
    darkForeground: '24 45% 8%',
  },
  rose: {
    id: 'rose',
    label: 'Rosa',
    swatch: '#F43F5E',
    lightPrimary: '346 77% 50%',
    lightForeground: '0 0% 100%',
    darkPrimary: '349 89% 64%',
    darkForeground: '0 0% 100%',
  },
  graphite: {
    id: 'graphite',
    label: 'Grafite',
    swatch: '#64748B',
    lightPrimary: '222 24% 20%',
    lightForeground: '0 0% 100%',
    darkPrimary: '210 20% 88%',
    darkForeground: '222 30% 10%',
  },
};

export const RADIUS_VALUES: Record<RadiusMode, string> = {
  sharp: '0.4rem',
  soft: '0.75rem',
  round: '1.1rem',
};

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  accent: 'blue',
  darkSurface: 'default',
  density: 'comfortable',
  fontScale: 'md',
  radius: 'soft',
  canvasPattern: 'clean',
  showHeaderSubtitle: false,
  showQuickOsFab: true,
  headerCompactStatus: true,
  reducedMotion: false,
  defaultHomeRoute: '/',
  workspaceMode: 'all',
  favoriteRoutes: [],
  autoLockMinutes: 10,
  splashBgPreset: 'picsum',
  splashCustomBgUrl: '',
  notificationSound: 'tri-chime',
  notificationVolume: 75,
  notificationStyle: 'modern',
  notificationPosition: 'top-right',
  outageSirenSound: 'noc-classic',
  sirenVolume: 90,
};

const STORAGE_PREFIX = 'avl_ui_preferences_v1_';
const VALID_ACCENTS = new Set<AccentPresetId>(Object.keys(ACCENT_PRESETS) as AccentPresetId[]);
const VALID_SURFACES = new Set<DarkSurfaceMode>(['default', 'oled']);
const VALID_DENSITIES = new Set<DensityMode>(['compact', 'comfortable', 'spacious']);
const VALID_SCALES = new Set<FontScaleMode>(['sm', 'md', 'lg']);
const VALID_RADII = new Set<RadiusMode>(['sharp', 'soft', 'round']);
const VALID_PATTERNS = new Set<CanvasPatternMode>(['clean', 'dots']);
const VALID_SPLASH_BGS = new Set<SplashBgPreset>(['picsum', 'obsidian', 'accent', 'custom']);
const VALID_LOCKS = new Set<AutoLockMinutes>([0, 2, 5, 10, 15, 30]);
const VALID_MODES = new Set<WorkspaceMode>(['all', 'atendimento', 'noc', 'financeiro']);
const VALID_NOTIF_SOUNDS = new Set<NotificationSoundId>([
  'tri-chime',
  'glass-ping',
  'whatsapp-pop',
  'soft-bell',
  'digital-ping',
  'subtle-tap',
  'none',
]);
const VALID_NOTIF_STYLES = new Set<NotificationStyleMode>([
  'modern',
  'glass',
  'solid',
  'minimal',
  'pill',
]);
const VALID_NOTIF_POSITIONS = new Set<NotificationPositionMode>([
  'top-right',
  'top-center',
  'bottom-right',
  'bottom-center',
]);
const VALID_SIREN_SOUNDS = new Set<OutageSirenSoundId>([
  'noc-classic',
  'police-wail',
  'radar-sonar',
  'industrial-klaxon',
  'chime-urgent',
  'nuclear-pulse',
  'none',
]);

function clampPercent(val: unknown, fallback: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.max(0, Math.min(100, Math.round(val)));
}

function sanitizePreferences(raw: unknown): UiPreferences {
  if (!raw || typeof raw !== 'object') return DEFAULT_UI_PREFERENCES;
  const obj = raw as Partial<UiPreferences>;

  const rawCustomUrl = typeof obj.splashCustomBgUrl === 'string' ? obj.splashCustomBgUrl.trim() : '';
  const safeCustomUrl = /^https?:\/\//i.test(rawCustomUrl) ? rawCustomUrl.slice(0, 1024) : '';
  const rawHome = typeof obj.defaultHomeRoute === 'string' ? obj.defaultHomeRoute.trim() : '/';
  const safeHome = rawHome.startsWith('/') ? rawHome : '/';
  const safeFavorites = Array.isArray(obj.favoriteRoutes)
    ? Array.from(
        new Set(
          obj.favoriteRoutes
            .filter((item): item is string => typeof item === 'string' && item.startsWith('/'))
            .map((item) => item.trim())
        )
      ).slice(0, 12)
    : DEFAULT_UI_PREFERENCES.favoriteRoutes;

  return {
    accent:
      typeof obj.accent === 'string' && VALID_ACCENTS.has(obj.accent as AccentPresetId)
        ? (obj.accent as AccentPresetId)
        : DEFAULT_UI_PREFERENCES.accent,
    darkSurface:
      typeof obj.darkSurface === 'string' && VALID_SURFACES.has(obj.darkSurface as DarkSurfaceMode)
        ? (obj.darkSurface as DarkSurfaceMode)
        : DEFAULT_UI_PREFERENCES.darkSurface,
    density:
      typeof obj.density === 'string' && VALID_DENSITIES.has(obj.density as DensityMode)
        ? (obj.density as DensityMode)
        : DEFAULT_UI_PREFERENCES.density,
    fontScale:
      typeof obj.fontScale === 'string' && VALID_SCALES.has(obj.fontScale as FontScaleMode)
        ? (obj.fontScale as FontScaleMode)
        : DEFAULT_UI_PREFERENCES.fontScale,
    radius:
      typeof obj.radius === 'string' && VALID_RADII.has(obj.radius as RadiusMode)
        ? (obj.radius as RadiusMode)
        : DEFAULT_UI_PREFERENCES.radius,
    canvasPattern:
      typeof obj.canvasPattern === 'string' &&
      VALID_PATTERNS.has(obj.canvasPattern as CanvasPatternMode)
        ? (obj.canvasPattern as CanvasPatternMode)
        : DEFAULT_UI_PREFERENCES.canvasPattern,
    showHeaderSubtitle:
      typeof obj.showHeaderSubtitle === 'boolean'
        ? obj.showHeaderSubtitle
        : DEFAULT_UI_PREFERENCES.showHeaderSubtitle,
    showQuickOsFab:
      typeof obj.showQuickOsFab === 'boolean'
        ? obj.showQuickOsFab
        : DEFAULT_UI_PREFERENCES.showQuickOsFab,
    headerCompactStatus:
      typeof obj.headerCompactStatus === 'boolean'
        ? obj.headerCompactStatus
        : DEFAULT_UI_PREFERENCES.headerCompactStatus,
    reducedMotion:
      typeof obj.reducedMotion === 'boolean'
        ? obj.reducedMotion
        : DEFAULT_UI_PREFERENCES.reducedMotion,
    defaultHomeRoute: safeHome,
    workspaceMode:
      typeof obj.workspaceMode === 'string' && VALID_MODES.has(obj.workspaceMode as WorkspaceMode)
        ? (obj.workspaceMode as WorkspaceMode)
        : DEFAULT_UI_PREFERENCES.workspaceMode,
    favoriteRoutes: safeFavorites,
    autoLockMinutes:
      typeof obj.autoLockMinutes === 'number' &&
      VALID_LOCKS.has(obj.autoLockMinutes as AutoLockMinutes)
        ? (obj.autoLockMinutes as AutoLockMinutes)
        : DEFAULT_UI_PREFERENCES.autoLockMinutes,
    splashBgPreset:
      typeof obj.splashBgPreset === 'string' &&
      VALID_SPLASH_BGS.has(obj.splashBgPreset as SplashBgPreset)
        ? (obj.splashBgPreset as SplashBgPreset)
        : DEFAULT_UI_PREFERENCES.splashBgPreset,
    splashCustomBgUrl: safeCustomUrl,
    notificationSound:
      typeof obj.notificationSound === 'string' &&
      VALID_NOTIF_SOUNDS.has(obj.notificationSound as NotificationSoundId)
        ? (obj.notificationSound as NotificationSoundId)
        : DEFAULT_UI_PREFERENCES.notificationSound,
    notificationVolume: clampPercent(
      obj.notificationVolume,
      DEFAULT_UI_PREFERENCES.notificationVolume
    ),
    notificationStyle:
      typeof obj.notificationStyle === 'string' &&
      VALID_NOTIF_STYLES.has(obj.notificationStyle as NotificationStyleMode)
        ? (obj.notificationStyle as NotificationStyleMode)
        : DEFAULT_UI_PREFERENCES.notificationStyle,
    notificationPosition:
      typeof obj.notificationPosition === 'string' &&
      VALID_NOTIF_POSITIONS.has(obj.notificationPosition as NotificationPositionMode)
        ? (obj.notificationPosition as NotificationPositionMode)
        : DEFAULT_UI_PREFERENCES.notificationPosition,
    outageSirenSound:
      typeof obj.outageSirenSound === 'string' &&
      VALID_SIREN_SOUNDS.has(obj.outageSirenSound as OutageSirenSoundId)
        ? (obj.outageSirenSound as OutageSirenSoundId)
        : DEFAULT_UI_PREFERENCES.outageSirenSound,
    sirenVolume: clampPercent(obj.sirenVolume, DEFAULT_UI_PREFERENCES.sirenVolume),
  };
}

function readLocalPreferences(uid: string): UiPreferences {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${uid}`);
    if (!raw) return DEFAULT_UI_PREFERENCES;
    return sanitizePreferences(JSON.parse(raw));
  } catch {
    return DEFAULT_UI_PREFERENCES;
  }
}

function writeLocalPreferences(uid: string, prefs: UiPreferences): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${uid}`, JSON.stringify(prefs));
  } catch {
    // noop
  }
}

interface UiPreferencesContextValue {
  preferences: UiPreferences;
  updatePreferences: (patch: Partial<UiPreferences>) => void;
  toggleFavoriteRoute: (route: string) => void;
  resetPreferences: () => void;
}

const UiPreferencesContext = createContext<UiPreferencesContextValue | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export function useUiPreferences(): UiPreferencesContextValue {
  const ctx = useContext(UiPreferencesContext);
  if (!ctx) {
    throw new Error('useUiPreferences deve ser usado dentro de UiPreferencesProvider');
  }
  return ctx;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useOptionalUiPreferences(): UiPreferencesContextValue | undefined {
  return useContext(UiPreferencesContext);
}

export const UiPreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, panelProfile, pinUnlocked, lockScreen } = useAuth();
  const { resolvedTheme } = useTheme();
  const uid = user?.uid || 'guest';

  const [preferences, setPreferences] = useState<UiPreferences>(() => readLocalPreferences(uid));
  const prefsRef = useRef(preferences);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    prefsRef.current = preferences;
  }, [preferences]);

  // Carrega do localStorage imediatamente e sincroniza na nuvem (Firestore) por usuário
  useEffect(() => {
    const local = readLocalPreferences(uid);
    setPreferences(local);

    if (!user?.uid) return;

    const docRef = doc(db, 'bot_config', `ui_preferences_${user.uid}`);
    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (!snap.exists()) return;
        const remote = sanitizePreferences(snap.data());
        setPreferences(remote);
        writeLocalPreferences(uid, remote);
      },
      () => undefined
    );

    return () => {
      unsub();
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [uid, user?.uid]);

  // Aplica tokens de tema, cor principal, superfície OLED, densidade, fonte e animações no <html>
  useEffect(() => {
    const root = document.documentElement;
    const isDark = resolvedTheme === 'dark';
    const accentCfg = ACCENT_PRESETS[preferences.accent] || ACCENT_PRESETS.blue;
    const primaryHsl = isDark ? accentCfg.darkPrimary : accentCfg.lightPrimary;
    const primaryFgHsl = isDark ? accentCfg.darkForeground : accentCfg.lightForeground;

    root.style.setProperty('--primary', primaryHsl);
    root.style.setProperty('--primary-foreground', primaryFgHsl);
    root.style.setProperty('--ring', primaryHsl);
    root.style.setProperty('--sidebar-primary', primaryHsl);
    root.style.setProperty('--sidebar-primary-foreground', primaryFgHsl);
    root.style.setProperty('--sidebar-ring', primaryHsl);
    root.style.setProperty('--radius', RADIUS_VALUES[preferences.radius] || RADIUS_VALUES.soft);

    root.dataset.surface = preferences.darkSurface;
    root.dataset.density = preferences.density;
    root.dataset.fontScale = preferences.fontScale;
    root.dataset.canvasPattern = preferences.canvasPattern;
    root.dataset.reducedMotion = preferences.reducedMotion ? 'true' : 'false';
    root.dataset.notificationStyle = preferences.notificationStyle;
  }, [preferences, resolvedTheme]);

  // Bloqueio automático configurável por inatividade (usa o tempo escolhido pelo usuário no Estúdio)
  const shouldAutoLock = Boolean(
    user &&
      panelProfile?.active &&
      panelProfile?.hasPin &&
      pinUnlocked &&
      preferences.autoLockMinutes > 0
  );

  useEffect(() => {
    if (!shouldAutoLock) return;

    const inactivityMs = preferences.autoLockMinutes * 60 * 1000;
    let lastActivityAt = Date.now();
    let timerId: number | null = null;

    const markActivity = () => {
      lastActivityAt = Date.now();
    };

    const scheduleCheck = () => {
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
      const elapsed = Date.now() - lastActivityAt;
      if (elapsed >= inactivityMs) {
        lockScreen();
        return;
      }
      timerId = window.setTimeout(() => {
        if (Date.now() - lastActivityAt >= inactivityMs) {
          lockScreen();
        } else {
          scheduleCheck();
        }
      }, Math.max(1000, inactivityMs - elapsed));
    };

    const handleVisibilityOrFocus = () => {
      if (!document.hidden && Date.now() - lastActivityAt >= inactivityMs) {
        lockScreen();
      }
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      'pointerdown',
      'pointermove',
      'keydown',
      'wheel',
      'touchstart',
    ];

    activityEvents.forEach((evt) => {
      window.addEventListener(evt, markActivity, { passive: true });
    });
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    scheduleCheck();

    return () => {
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, markActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [shouldAutoLock, preferences.autoLockMinutes, lockScreen]);

  const persistRemote = useCallback(
    (next: UiPreferences) => {
      writeLocalPreferences(uid, next);
      if (!user?.uid) return;

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        setDoc(
          doc(db, 'bot_config', `ui_preferences_${user.uid}`),
          {
            ...next,
            updatedAt: Date.now(),
          },
          { merge: true }
        ).catch(() => undefined);
      }, 300);
    },
    [uid, user?.uid]
  );

  const updatePreferences = useCallback(
    (patch: Partial<UiPreferences>) => {
      const next = sanitizePreferences({ ...prefsRef.current, ...patch });
      setPreferences(next);
      persistRemote(next);
    },
    [persistRemote]
  );

  const toggleFavoriteRoute = useCallback(
    (route: string) => {
      const clean = route.trim();
      if (!clean.startsWith('/')) return;
      const current = prefsRef.current.favoriteRoutes || [];
      const exists = current.includes(clean);
      const nextFavorites = exists
        ? current.filter((item) => item !== clean)
        : [...current, clean].slice(0, 12);
      const next = sanitizePreferences({
        ...prefsRef.current,
        favoriteRoutes: nextFavorites,
      });
      setPreferences(next);
      persistRemote(next);
    },
    [persistRemote]
  );

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_UI_PREFERENCES);
    persistRemote(DEFAULT_UI_PREFERENCES);
  }, [persistRemote]);

  const value = useMemo<UiPreferencesContextValue>(
    () => ({
      preferences,
      updatePreferences,
      toggleFavoriteRoute,
      resetPreferences,
    }),
    [preferences, updatePreferences, toggleFavoriteRoute, resetPreferences]
  );

  return <UiPreferencesContext.Provider value={value}>{children}</UiPreferencesContext.Provider>;
};

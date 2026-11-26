import type { PanelUserRole } from '@/config/permissions';

export const USER_SPLASH_CACHE_KEY = 'avl_last_user_splash_v1';

export interface CachedSplashUser {
  uid: string;
  name: string;
  email: string;
  role: PanelUserRole;
  photoUrl?: string;
  jobTitle?: string;
  hasPin?: boolean;
}

export function readCachedSplashUser(): CachedSplashUser | null {
  try {
    const raw = localStorage.getItem(USER_SPLASH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedSplashUser>;
    if (!parsed || typeof parsed !== 'object' || (!parsed.name && !parsed.email)) {
      return null;
    }
    return {
      uid: String(parsed.uid || ''),
      name: String(parsed.name || parsed.email || 'Operador'),
      email: String(parsed.email || ''),
      role:
        parsed.role === 'creator' || parsed.role === 'admin' ? parsed.role : 'operador',
      photoUrl: typeof parsed.photoUrl === 'string' ? parsed.photoUrl : '',
      jobTitle: typeof parsed.jobTitle === 'string' ? parsed.jobTitle : '',
      hasPin: Boolean(parsed.hasPin),
    };
  } catch {
    return null;
  }
}

export function writeCachedSplashUser(data: CachedSplashUser): void {
  try {
    localStorage.setItem(USER_SPLASH_CACHE_KEY, JSON.stringify(data));
  } catch {
    // noop (quota/private mode)
  }
}

export function clearCachedSplashUser(): void {
  try {
    localStorage.removeItem(USER_SPLASH_CACHE_KEY);
  } catch {
    // noop
  }
}

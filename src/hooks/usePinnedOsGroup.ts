import { useCallback, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';

export interface PinnedOsGroupConfig {
  pinnedGroupPhone: string;
  pinnedGroupName: string;
  autoSendToGroup: boolean;
  updatedBy?: string;
  updatedAt?: number;
}

const STORAGE_KEY = 'avl_os_pinned_group_v1';
const FIRESTORE_DOC = ['bot_config', 'os_dispatch_config'] as const;

const DEFAULT_CONFIG: PinnedOsGroupConfig = {
  pinnedGroupPhone: '',
  pinnedGroupName: '',
  autoSendToGroup: true,
};

function sanitizeConfig(raw: unknown): PinnedOsGroupConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT_CONFIG;
  const obj = raw as Partial<PinnedOsGroupConfig>;
  return {
    pinnedGroupPhone:
      typeof obj.pinnedGroupPhone === 'string' ? obj.pinnedGroupPhone.trim() : '',
    pinnedGroupName:
      typeof obj.pinnedGroupName === 'string' ? obj.pinnedGroupName.trim() : '',
    autoSendToGroup:
      typeof obj.autoSendToGroup === 'boolean'
        ? obj.autoSendToGroup
        : DEFAULT_CONFIG.autoSendToGroup,
    updatedBy: typeof obj.updatedBy === 'string' ? obj.updatedBy : undefined,
    updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : undefined,
  };
}

function readLocalConfig(): PinnedOsGroupConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return sanitizeConfig(JSON.parse(raw));
  } catch {
    return DEFAULT_CONFIG;
  }
}

function writeLocalConfig(cfg: PinnedOsGroupConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // noop
  }
}

/**
 * Gerencia o grupo WhatsApp fixo padrão para disparo de O.S. (sincronizado entre
 * a página Nova O.S., Modal Rápido de O.S., abas e operadores via Firestore + localStorage).
 */
export function usePinnedOsGroup() {
  const { user, panelProfile } = useAuth();
  const [config, setConfig] = useState<PinnedOsGroupConfig>(() => readLocalConfig());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    const ref = doc(db, FIRESTORE_DOC[0], FIRESTORE_DOC[1]);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return;
        const remote = sanitizeConfig(snap.data());
        setConfig(remote);
        writeLocalConfig(remote);
      },
      () => undefined
    );
    return () => unsub();
  }, [user?.uid]);

  const persist = useCallback(
    async (next: PinnedOsGroupConfig): Promise<boolean> => {
      const payload: PinnedOsGroupConfig = {
        ...next,
        updatedBy: panelProfile?.name || user?.displayName || user?.email || undefined,
        updatedAt: Date.now(),
      };
      setConfig(payload);
      writeLocalConfig(payload);

      if (!user?.uid) return true;
      setSaving(true);
      try {
        await setDoc(doc(db, FIRESTORE_DOC[0], FIRESTORE_DOC[1]), payload, { merge: true });
        return true;
      } catch (err) {
        console.warn('[usePinnedOsGroup] Erro ao sincronizar grupo fixo no Firestore:', err);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [panelProfile?.name, user?.displayName, user?.email, user?.uid]
  );

  const pinGroup = useCallback(
    async (phone: string, name: string): Promise<boolean> => {
      return persist({
        ...config,
        pinnedGroupPhone: phone.trim(),
        pinnedGroupName: name.trim(),
      });
    },
    [config, persist]
  );

  const clearPinnedGroup = useCallback(async (): Promise<boolean> => {
    return persist({
      ...config,
      pinnedGroupPhone: '',
      pinnedGroupName: '',
    });
  }, [config, persist]);

  const setAutoSendToGroup = useCallback(
    async (autoSend: boolean): Promise<boolean> => {
      return persist({
        ...config,
        autoSendToGroup: autoSend,
      });
    },
    [config, persist]
  );

  return {
    pinnedGroupPhone: config.pinnedGroupPhone,
    pinnedGroupName: config.pinnedGroupName,
    autoSendToGroup: config.autoSendToGroup,
    savingPinnedGroup: saving,
    pinGroup,
    clearPinnedGroup,
    setAutoSendToGroup,
  };
}

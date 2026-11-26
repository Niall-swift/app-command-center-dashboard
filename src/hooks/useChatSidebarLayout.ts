import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';

export type ChatSidebarWidgetId =
  | 'josue_ai'
  | 'tags_csat'
  | 'smartolt'
  | 'ispfy_client'
  | 'ispfy_contracts'
  | 'ispfy_finance'
  | 'attendant'
  | 'quick_replies';

export interface ChatSidebarWidgetMeta {
  id: ChatSidebarWidgetId;
  label: string;
  description: string;
  accentClass: string;
}

export const CHAT_SIDEBAR_WIDGETS: Record<ChatSidebarWidgetId, ChatSidebarWidgetMeta> = {
  josue_ai: {
    id: 'josue_ai',
    label: 'Josué IA',
    description: 'Alternar atendimento automático vs humano',
    accentClass: 'text-indigo-500 bg-indigo-500/15',
  },
  tags_csat: {
    id: 'tags_csat',
    label: 'Classificação & CSAT',
    description: 'Etiquetas da conversa e pesquisa de satisfação',
    accentClass: 'text-amber-500 bg-amber-500/15',
  },
  smartolt: {
    id: 'smartolt',
    label: 'Fibra / ONT (SmartOLT)',
    description: 'Status da ONU, sinal óptico dBm e ações OLT',
    accentClass: 'text-emerald-500 bg-emerald-500/15',
  },
  ispfy_client: {
    id: 'ispfy_client',
    label: 'Assinante ISPFY',
    description: 'Cadastro, CPF, endereço, ficha e vínculo',
    accentClass: 'text-sky-500 bg-sky-500/15',
  },
  ispfy_contracts: {
    id: 'ispfy_contracts',
    label: 'Contratos & Conexão',
    description: 'Planos PPPoE, IP, consumo 30D, Turbo e desbloqueio',
    accentClass: 'text-blue-500 bg-blue-500/15',
  },
  ispfy_finance: {
    id: 'ispfy_finance',
    label: 'Financeiro & PIX',
    description: 'Faturas pendentes, botão PIX, copia e cola e PDF',
    accentClass: 'text-rose-500 bg-rose-500/15',
  },
  attendant: {
    id: 'attendant',
    label: 'Cartão do Atendente',
    description: 'Apresentação com foto do operador',
    accentClass: 'text-violet-500 bg-violet-500/15',
  },
  quick_replies: {
    id: 'quick_replies',
    label: 'Frases Rápidas',
    description: 'Lista de frases prontas para inserir no chat',
    accentClass: 'text-cyan-500 bg-cyan-500/15',
  },
};

export const DEFAULT_CHAT_SIDEBAR_ORDER: ChatSidebarWidgetId[] = [
  'josue_ai',
  'tags_csat',
  'smartolt',
  'ispfy_client',
  'ispfy_contracts',
  'ispfy_finance',
  'attendant',
  'quick_replies',
];

const VALID_WIDGET_IDS = new Set<ChatSidebarWidgetId>(DEFAULT_CHAT_SIDEBAR_ORDER);

interface StoredLayoutState {
  order: ChatSidebarWidgetId[];
  hiddenIds: ChatSidebarWidgetId[];
}

function sanitizeOrder(rawOrder: unknown): ChatSidebarWidgetId[] {
  const result: ChatSidebarWidgetId[] = [];
  const seen = new Set<ChatSidebarWidgetId>();
  if (Array.isArray(rawOrder)) {
    for (const item of rawOrder) {
      if (typeof item === 'string' && VALID_WIDGET_IDS.has(item as ChatSidebarWidgetId)) {
        const id = item as ChatSidebarWidgetId;
        if (!seen.has(id)) {
          seen.add(id);
          result.push(id);
        }
      }
    }
  }
  for (const fallbackId of DEFAULT_CHAT_SIDEBAR_ORDER) {
    if (!seen.has(fallbackId)) {
      result.push(fallbackId);
    }
  }
  return result;
}

function sanitizeHidden(rawHidden: unknown): ChatSidebarWidgetId[] {
  if (!Array.isArray(rawHidden)) return [];
  const seen = new Set<ChatSidebarWidgetId>();
  const result: ChatSidebarWidgetId[] = [];
  for (const item of rawHidden) {
    if (typeof item === 'string' && VALID_WIDGET_IDS.has(item as ChatSidebarWidgetId)) {
      const id = item as ChatSidebarWidgetId;
      if (!seen.has(id)) {
        seen.add(id);
        result.push(id);
      }
    }
  }
  // Garante que pelo menos 1 bloco fique visível
  if (result.length >= DEFAULT_CHAT_SIDEBAR_ORDER.length) {
    return result.slice(0, DEFAULT_CHAT_SIDEBAR_ORDER.length - 1);
  }
  return result;
}

function getStorageKey(uid: string): string {
  return `avl_chat_sidebar_layout_v1_${uid}`;
}

function readLocalLayout(uid: string): StoredLayoutState {
  try {
    const raw = localStorage.getItem(getStorageKey(uid));
    if (!raw) {
      return { order: DEFAULT_CHAT_SIDEBAR_ORDER, hiddenIds: [] };
    }
    const parsed = JSON.parse(raw) as Partial<StoredLayoutState>;
    return {
      order: sanitizeOrder(parsed.order),
      hiddenIds: sanitizeHidden(parsed.hiddenIds),
    };
  } catch {
    return { order: DEFAULT_CHAT_SIDEBAR_ORDER, hiddenIds: [] };
  }
}

function writeLocalLayout(uid: string, state: StoredLayoutState): void {
  try {
    localStorage.setItem(getStorageKey(uid), JSON.stringify(state));
  } catch {
    // ignora quota
  }
}

export function useChatSidebarLayout() {
  const { user } = useAuth();
  const uid = user?.uid || 'default';

  const [order, setOrderState] = useState<ChatSidebarWidgetId[]>(
    () => readLocalLayout(uid).order
  );
  const [hiddenIds, setHiddenIdsState] = useState<ChatSidebarWidgetId[]>(
    () => readLocalLayout(uid).hiddenIds
  );

  const orderRef = useRef(order);
  const hiddenRef = useRef(hiddenIds);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  useEffect(() => {
    hiddenRef.current = hiddenIds;
  }, [hiddenIds]);

  // Recarrega do localStorage + sincroniza no Firestore quando muda o usuário logado
  useEffect(() => {
    const local = readLocalLayout(uid);
    setOrderState(local.order);
    setHiddenIdsState(local.hiddenIds);

    if (!user?.uid) return;

    const layoutDocRef = doc(db, 'bot_config', `chat_sidebar_layout_${user.uid}`);
    const unsub = onSnapshot(
      layoutDocRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        const nextOrder = sanitizeOrder(data?.order);
        const nextHidden = sanitizeHidden(data?.hiddenIds);
        setOrderState(nextOrder);
        setHiddenIdsState(nextHidden);
        writeLocalLayout(uid, { order: nextOrder, hiddenIds: nextHidden });
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

  const schedulePersist = useCallback(
    (nextOrder: ChatSidebarWidgetId[], nextHidden: ChatSidebarWidgetId[]) => {
      writeLocalLayout(uid, { order: nextOrder, hiddenIds: nextHidden });
      if (!user?.uid) return;

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const layoutDocRef = doc(db, 'bot_config', `chat_sidebar_layout_${user.uid}`);
        setDoc(
          layoutDocRef,
          {
            order: nextOrder,
            hiddenIds: nextHidden,
            updatedAt: Date.now(),
          },
          { merge: true }
        ).catch(() => undefined);
      }, 350);
    },
    [uid, user?.uid]
  );

  const setOrder = useCallback(
    (nextOrder: ChatSidebarWidgetId[]) => {
      const sanitized = sanitizeOrder(nextOrder);
      setOrderState(sanitized);
      schedulePersist(sanitized, hiddenRef.current);
    },
    [schedulePersist]
  );

  const moveWidget = useCallback(
    (id: ChatSidebarWidgetId, direction: 'up' | 'down') => {
      const current = [...orderRef.current];
      const idx = current.indexOf(id);
      if (idx === -1) return;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= current.length) return;
      [current[idx], current[targetIdx]] = [current[targetIdx], current[idx]];
      setOrder(current);
    },
    [setOrder]
  );

  const toggleWidgetVisibility = useCallback(
    (id: ChatSidebarWidgetId) => {
      const current = hiddenRef.current;
      const isHidden = current.includes(id);
      let nextHidden: ChatSidebarWidgetId[];
      if (isHidden) {
        nextHidden = current.filter((item) => item !== id);
      } else {
        if (current.length >= DEFAULT_CHAT_SIDEBAR_ORDER.length - 1) {
          return;
        }
        nextHidden = [...current, id];
      }
      setHiddenIdsState(nextHidden);
      schedulePersist(orderRef.current, nextHidden);
    },
    [schedulePersist]
  );

  const resetLayout = useCallback(() => {
    setOrderState(DEFAULT_CHAT_SIDEBAR_ORDER);
    setHiddenIdsState([]);
    schedulePersist(DEFAULT_CHAT_SIDEBAR_ORDER, []);
  }, [schedulePersist]);

  return {
    order,
    hiddenIds,
    setOrder,
    moveWidget,
    toggleWidgetVisibility,
    resetLayout,
  };
}

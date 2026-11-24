import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ISPFYClienteData } from '@/types/ispfy';

export interface ActiveChatSelection {
  chatId: string;
  chatName?: string;
  chatPhone?: string;
}

interface ActiveChatClientContextValue {
  activeChat: ActiveChatSelection | null;
  activeIspfyClient: ISPFYClienteData | null;
  resolvingIspfy: boolean;
  setActiveChat: (selection: ActiveChatSelection | null) => void;
  reportActiveChatIspfyClient: (
    chatId: string,
    client: ISPFYClienteData | null,
    resolving?: boolean
  ) => void;
  getCachedIspfyClient: (chatId: string) => ISPFYClienteData | null;
  clearActiveChat: () => void;
}

const ActiveChatClientContext = createContext<ActiveChatClientContextValue | null>(null);

export const ActiveChatClientProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [activeChat, setActiveChatState] = useState<ActiveChatSelection | null>(null);
  const [activeIspfyClient, setActiveIspfyClient] = useState<ISPFYClienteData | null>(null);
  const [resolvingIspfy, setResolvingIspfy] = useState(false);

  const activeChatIdRef = useRef<string | null>(null);
  const ispfyCacheByChatRef = useRef<Map<string, ISPFYClienteData>>(new Map());

  const setActiveChat = useCallback((selection: ActiveChatSelection | null) => {
    const nextChatId = selection?.chatId ?? null;
    const changed = activeChatIdRef.current !== nextChatId;
    activeChatIdRef.current = nextChatId;
    setActiveChatState(selection);

    if (!nextChatId) {
      setActiveIspfyClient(null);
      setResolvingIspfy(false);
      return;
    }

    if (changed) {
      const cached = ispfyCacheByChatRef.current.get(nextChatId) ?? null;
      setActiveIspfyClient(cached);
      setResolvingIspfy(!cached);
    }
  }, []);

  const reportActiveChatIspfyClient = useCallback(
    (chatId: string, client: ISPFYClienteData | null, resolving = false) => {
      if (!chatId) return;
      if (client?.id) {
        ispfyCacheByChatRef.current.set(chatId, client);
      } else if (!resolving) {
        ispfyCacheByChatRef.current.delete(chatId);
      }

      if (activeChatIdRef.current !== chatId) return;
      if (client?.id || !resolving) {
        setActiveIspfyClient(client);
      }
      setResolvingIspfy(resolving);
    },
    []
  );

  const getCachedIspfyClient = useCallback((chatId: string) => {
    return ispfyCacheByChatRef.current.get(chatId) ?? null;
  }, []);

  const clearActiveChat = useCallback(() => {
    activeChatIdRef.current = null;
    setActiveChatState(null);
    setActiveIspfyClient(null);
    setResolvingIspfy(false);
  }, []);

  const value = useMemo<ActiveChatClientContextValue>(
    () => ({
      activeChat,
      activeIspfyClient,
      resolvingIspfy,
      setActiveChat,
      reportActiveChatIspfyClient,
      getCachedIspfyClient,
      clearActiveChat,
    }),
    [
      activeChat,
      activeIspfyClient,
      resolvingIspfy,
      setActiveChat,
      reportActiveChatIspfyClient,
      getCachedIspfyClient,
      clearActiveChat,
    ]
  );

  return (
    <ActiveChatClientContext.Provider value={value}>
      {children}
    </ActiveChatClientContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export function useActiveChatClient(): ActiveChatClientContextValue {
  const ctx = useContext(ActiveChatClientContext);
  if (!ctx) {
    throw new Error('useActiveChatClient deve ser usado dentro de ActiveChatClientProvider');
  }
  return ctx;
}

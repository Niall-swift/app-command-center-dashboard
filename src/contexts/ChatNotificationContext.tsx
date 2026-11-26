import React, { createContext, useContext, useEffect, useMemo, useState, useRef } from "react";
import { collection, onSnapshot, query, where, limit } from "firebase/firestore";
import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/use-notifications";
import { useToast } from "@/hooks/use-toast";

interface ChatNotificationContextType {
  unreadMessages: Record<string, number>;
  totalUnreadCount: number;
}

const ChatNotificationContext = createContext<ChatNotificationContextType | undefined>(undefined);

function areUnreadMapsEqual(
  prev: Record<string, number>,
  next: Record<string, number>
): boolean {
  const prevKeys = Object.keys(prev);
  const nextKeys = Object.keys(next);
  if (prevKeys.length !== nextKeys.length) return false;
  for (let i = 0; i < prevKeys.length; i++) {
    const key = prevKeys[i];
    if (prev[key] !== next[key]) return false;
  }
  return true;
}

export const useChatNotifications = () => {
  const context = useContext(ChatNotificationContext);
  if (!context) {
    throw new Error("useChatNotifications must be used within ChatNotificationProvider");
  }
  return context;
};

interface ChatNotificationProviderProps {
  children: React.ReactNode;
}

export const ChatNotificationProvider: React.FC<ChatNotificationProviderProps> = ({ children }) => {
  const { user, canAccessRoute } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState<Record<string, number>>({});
  const { isEnabled, playNotificationSound, showChatNotification } = useNotifications();
  const { toast } = useToast();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Evita rajada de toasts/sons no primeiro snapshot ao abrir o painel
  const initialSnapshotDoneRef = useRef<boolean>(false);
  // Usar ref para o processedMessages evita re-render loops e re-assinaturas
  const processedMessagesRef = useRef<Set<string>>(new Set());

  // Ref para dependências do hook de notificação
  const notifRefs = useRef({ isEnabled, playNotificationSound, showChatNotification, toast });
  useEffect(() => {
    notifRefs.current = { isEnabled, playNotificationSound, showChatNotification, toast };
  }, [isEnabled, playNotificationSound, showChatNotification, toast]);

  const canListenChat = Boolean(user) && canAccessRoute("/chat");

  useEffect(() => {
    if (!canListenChat) {
      initialSnapshotDoneRef.current = false;
      processedMessagesRef.current.clear();
      setUnreadMessages((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }

    initialSnapshotDoneRef.current = false;
    try {
      // Escuta apenas chats que realmente têm mensagens não lidas (-95% de leituras no Firestore)
      const chatRef = collection(db, "chat");
      const q = query(chatRef, where("unreadCount", ">", 0), limit(50));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          // 1. Atualizar a contagem total de mensagens não lidas somente se houve mudança real
          const newUnreadMap: Record<string, number> = {};

          snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data();
            const unreadCount = data.unreadCount || 0;
            if (unreadCount > 0) {
              newUnreadMap[docSnap.id] = unreadCount;
            }
          });

          setUnreadMessages((prev) =>
            areUnreadMapsEqual(prev, newUnreadMap) ? prev : newUnreadMap
          );

          // 2. Primeiro snapshot: apenas registra IDs atuais sem disparar rajada de alertas
          if (!initialSnapshotDoneRef.current) {
            initialSnapshotDoneRef.current = true;
            snapshot.docs.forEach((docSnap) => {
              const clientData = docSnap.data();
              const lastMsgTime = clientData.lastMessageTime?.toMillis?.() || 0;
              processedMessagesRef.current.add(`${docSnap.id}_${lastMsgTime}`);
            });
            return;
          }

          // 3. Disparar notificações apenas para mensagens novas em tempo real
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added" || change.type === "modified") {
              const clientData = change.doc.data();
              const clientId = change.doc.id;
              const unreadCount = clientData.unreadCount || 0;

              if (unreadCount > 0) {
                const clientName = clientData.name || "Cliente";
                const lastMsg = clientData.lastMessage || "Nova mensagem";
                const lastMsgTime = clientData.lastMessageTime?.toMillis?.() || 0;

                // Identificador único para a mensagem (para não notificar duas vezes a mesma)
                const messageIdentifier = `${clientId}_${lastMsgTime}`;

                if (!processedMessagesRef.current.has(messageIdentifier)) {
                  if (processedMessagesRef.current.size > 500) {
                    processedMessagesRef.current.clear();
                  }
                  processedMessagesRef.current.add(messageIdentifier);

                  const {
                    isEnabled: soundEnabled,
                    playNotificationSound: playSound,
                    showChatNotification: showDesktopNotif,
                    toast: showToast,
                  } = notifRefs.current;

                  if (soundEnabled) {
                    playSound();
                  }

                  showDesktopNotif(clientName, lastMsg);

                  showToast({
                    title: `Nova mensagem de ${clientName}`,
                    description:
                      lastMsg.length > 100 ? lastMsg.substring(0, 100) + "..." : lastMsg,
                    duration: 4000,
                  });
                }
              }
            }
          });
        },
        (error) => {
          console.error("Erro ao ouvir clientes para notificações:", error);
        }
      );

      unsubscribeRef.current = unsubscribe;

      return () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
      };
    } catch (error) {
      console.error("Erro ao configurar listener global de notificações:", error);
    }
  }, [canListenChat]);

  const totalUnreadCount = useMemo(
    () => Object.values(unreadMessages).reduce((sum, count) => sum + count, 0),
    [unreadMessages]
  );

  const value = useMemo<ChatNotificationContextType>(
    () => ({
      unreadMessages,
      totalUnreadCount,
    }),
    [unreadMessages, totalUnreadCount]
  );

  return (
    <ChatNotificationContext.Provider value={value}>
      {children}
    </ChatNotificationContext.Provider>
  );
};

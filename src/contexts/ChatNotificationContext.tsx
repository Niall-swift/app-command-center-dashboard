import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/config/firebase";
import { useNotifications } from "@/hooks/use-notifications";
import { useToast } from "@/hooks/use-toast";

interface ChatNotificationContextType {
  unreadMessages: Record<string, number>;
  totalUnreadCount: number;
}

const ChatNotificationContext = createContext<ChatNotificationContextType | undefined>(undefined);

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
  const [unreadMessages, setUnreadMessages] = useState<Record<string, number>>({});
  const { isEnabled, playNotificationSound, showChatNotification } = useNotifications();
  const { toast } = useToast();
  const unsubscribeRef = useRef<(() => void) | null>(null);
  
  // Usar ref para o processedMessages evita re-render loops e re-assinaturas
  const processedMessagesRef = useRef<Set<string>>(new Set());

  // Ref para dependências do hook de notificação
  const notifRefs = useRef({ isEnabled, playNotificationSound, showChatNotification, toast });
  useEffect(() => {
    notifRefs.current = { isEnabled, playNotificationSound, showChatNotification, toast };
  }, [isEnabled, playNotificationSound, showChatNotification, toast]);

  useEffect(() => {
    console.log("Iniciando listener global otimizado de notificações de chat...");

    try {
      // Listener para todos os clientes
      const chatRef = collection(db, "chat");
      const q = query(chatRef, orderBy("lastMessageTime", "desc"), limit(200));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          // 1. Atualizar a contagem total de mensagens não lidas
          const newUnreadMap: Record<string, number> = {};
          
          snapshot.docs.forEach((doc) => {
            const data = doc.data();
            const unreadCount = data.unreadCount || 0;
            if (unreadCount > 0) {
               newUnreadMap[doc.id] = unreadCount;
            }
          });
          
          setUnreadMessages(newUnreadMap);

          // 2. Disparar notificações apenas para modificações ou adições recentes
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
                     processedMessagesRef.current.add(messageIdentifier);
                     
                     console.log(`Nova mensagem global detectada de ${clientName}:`, lastMsg);
                     
                     const { isEnabled, playNotificationSound, showChatNotification, toast } = notifRefs.current;

                     if (isEnabled) {
                         playNotificationSound();
                     }

                     showChatNotification(clientName, lastMsg);

                     toast({
                       title: `Nova mensagem de ${clientName}`,
                       description: lastMsg.length > 100 ? lastMsg.substring(0, 100) + "..." : lastMsg,
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
  }, []);

  // Calcular total de mensagens não lidas
  const totalUnreadCount = Object.values(unreadMessages).reduce((sum, count) => sum + count, 0);

  const value: ChatNotificationContextType = {
    unreadMessages,
    totalUnreadCount,
  };

  return (
    <ChatNotificationContext.Provider value={value}>
      {children}
    </ChatNotificationContext.Provider>
  );
};
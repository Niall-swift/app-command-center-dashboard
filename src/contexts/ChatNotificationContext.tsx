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
  const [processedMessages, setProcessedMessages] = useState<Set<string>>(new Set());
  const { isEnabled, playNotificationSound, showChatNotification } = useNotifications();
  const { toast } = useToast();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    console.log("Iniciando listener global de notificações de chat...");

    try {
      // Listener para todos os clientes
      const chatRef = collection(db, "chat");
      const q = query(chatRef, orderBy("lastMessageTime", "desc"));

      const unsubscribe = onSnapshot(
        q,
        (clientsSnapshot) => {
          console.log("Clientes atualizados para notificações globais:", clientsSnapshot.docs.length);

          clientsSnapshot.docs.forEach((clientDoc) => {
            const clientId = clientDoc.id;
            const clientData = clientDoc.data();
            const clientName = clientData.name || "Cliente";

            // Listener para mensagens de cada cliente
            const messagesRef = collection(db, "chat", clientId, "mensagens");
            const messagesQuery = query(messagesRef, orderBy("timestamp", "desc"), limit(1));

            const unsubscribeMessages = onSnapshot(
              messagesQuery,
              (messagesSnapshot) => {
                if (!messagesSnapshot.empty) {
                  const latestMessage = messagesSnapshot.docs[0];
                  const messageData = latestMessage.data();
                  const messageId = latestMessage.id;

                  // Verificar se é uma nova mensagem do cliente (não admin)
                  if (!messageData.isAdmin && !processedMessages.has(messageId)) {
                    console.log(`Nova mensagem global detectada de ${clientName}:`, messageData.content);

                    // Adicionar à lista de mensagens processadas
                    setProcessedMessages(prev => new Set([...prev, messageId]));

                    // Atualizar contador de mensagens não lidas
                    setUnreadMessages(prev => ({
                      ...prev,
                      [clientId]: (prev[clientId] || 0) + 1
                    }));

                    // Tocar som de notificação se ativado
                    if (isEnabled) {
                      playNotificationSound();
                    }

                    // Mostrar notificação do navegador
                    showChatNotification(clientName, messageData.content);

                    // Mostrar toast de notificação
                    toast({
                      title: `Nova mensagem de ${clientName}`,
                      description: messageData.content.length > 100
                        ? messageData.content.substring(0, 100) + "..."
                        : messageData.content,
                      duration: 4000,
                    });
                  }
                }
              },
              (error) => {
                console.error(`Erro ao ouvir mensagens de ${clientId}:`, error);
              }
            );

            // Armazenar função de unsubscribe para este cliente
            // Nota: Em produção, seria melhor gerenciar múltiplos unsubscribes
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
  }, [isEnabled, playNotificationSound, showChatNotification, toast, processedMessages]);

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
import { useState, useEffect, useRef, useCallback } from "react";
import { useOptionalUiPreferences } from "@/contexts/UiPreferencesContext";
import {
  getSharedAudioContext,
  playNotificationPreset,
  type NotificationSoundId,
} from "@/utils/soundEngine";

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
}

export const useNotifications = () => {
  const uiPrefs = useOptionalUiPreferences();
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [isPageVisible, setIsPageVisible] = useState(true);

  const soundIdRef = useRef<NotificationSoundId>(
    uiPrefs?.preferences.notificationSound ?? "tri-chime"
  );
  const volumeRef = useRef<number>(uiPrefs?.preferences.notificationVolume ?? 75);

  useEffect(() => {
    if (!uiPrefs) return;
    soundIdRef.current = uiPrefs.preferences.notificationSound;
    volumeRef.current = uiPrefs.preferences.notificationVolume;
  }, [
    uiPrefs,
    uiPrefs?.preferences.notificationSound,
    uiPrefs?.preferences.notificationVolume,
  ]);

  // Verificar se o navegador suporta notificações
  useEffect(() => {
    setIsSupported("Notification" in window);
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Detectar quando a página está visível ou oculta
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(!document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Garantir inicialização do AudioContext compartilhado
  useEffect(() => {
    getSharedAudioContext();
  }, []);

  // Solicitar permissão para notificações
  const requestPermission = async (): Promise<boolean> => {
    if (!isSupported) {
      console.warn("Notificações não são suportadas neste navegador");
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === "granted";
    } catch (error) {
      console.error("Erro ao solicitar permissão de notificação:", error);
      return false;
    }
  };

  // Tocar som de notificação configurado pelo operador em Personalizar
  const playNotificationSound = useCallback(
    (overrideSound?: NotificationSoundId) => {
      if (!isEnabled && !overrideSound) return;
      const targetSound = overrideSound ?? soundIdRef.current;
      playNotificationPreset(targetSound, volumeRef.current);
    },
    [isEnabled]
  );

  // Mostrar notificação do navegador
  const showNotification = (options: NotificationOptions) => {
    if (!isEnabled || !isSupported) {
      console.log("Notificações desabilitadas ou não suportadas");
      return;
    }

    // Se a permissão não foi concedida, tentar solicitar
    if (permission !== "granted") {
      console.log("Solicitando permissão para notificações...");
      requestPermission().then((granted) => {
        if (granted) {
          console.log("Permissão concedida, mostrando notificação...");
          showNotification(options);
        } else {
          console.log("Permissão negada para notificações");
        }
      });
      return;
    }

    try {
      // Mostrar notificação do navegador
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || "/favicon.ico",
        badge: options.badge || "/favicon.ico",
        tag: options.tag || "chat-notification",
        requireInteraction: options.requireInteraction || false,
        silent: soundIdRef.current === "none" || volumeRef.current === 0,
      });

      // Auto-fechar após 5 segundos
      setTimeout(() => {
        notification.close();
      }, 5000);

      // Adicionar evento de clique
      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      console.log("Notificação do navegador exibida:", options.title);
    } catch (error) {
      console.error("Erro ao mostrar notificação:", error);
    }
  };

  // Notificação específica para chat
  const showChatNotification = (clientName: string, message: string) => {
    // Sempre mostrar notificação, independente da visibilidade da página
    showNotification({
      title: `Nova mensagem de ${clientName}`,
      body: message.length > 100 ? message.substring(0, 100) + "..." : message,
      tag: "chat-message",
      requireInteraction: false,
    });
  };

  // Testar notificação
  const testNotification = () => {
    showNotification({
      title: "Teste de Notificação",
      body: "Esta é uma notificação de teste do sistema de chat",
      tag: "test-notification",
    });
  };

  // Alternar notificações
  const toggleNotifications = () => {
    setIsEnabled(!isEnabled);
  };

  return {
    isSupported,
    permission,
    isEnabled,
    isPageVisible,
    requestPermission,
    playNotificationSound,
    showNotification,
    showChatNotification,
    testNotification,
    toggleNotifications,
  };
};

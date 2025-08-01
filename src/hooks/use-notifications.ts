import { useState, useEffect, useRef } from "react";

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
}

export const useNotifications = () => {
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const audioContextRef = useRef<AudioContext | null>(null);

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

  // Inicializar AudioContext
  useEffect(() => {
    if (typeof window !== "undefined") {
      audioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    }
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

  // Tocar som de notificação profissional
  const playNotificationSound = () => {
    if (!isEnabled) return;

    try {
      // Garantir que o AudioContext esteja ativo
      if (audioContextRef.current) {
        if (audioContextRef.current.state === "suspended") {
          audioContextRef.current.resume();
        }

        const audioContext = audioContextRef.current;
        const now = audioContext.currentTime;

        // Som de notificação mais profissional (3 tons)
        const frequencies = [800, 1000, 1200];
        const duration = 0.15;

        frequencies.forEach((freq, index) => {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();

          osc.connect(gain);
          gain.connect(audioContext.destination);

          osc.frequency.setValueAtTime(freq, now + index * duration);

          gain.gain.setValueAtTime(0, now + index * duration);
          gain.gain.linearRampToValueAtTime(
            0.25, // Volume um pouco mais alto
            now + index * duration + 0.01
          );
          gain.gain.exponentialRampToValueAtTime(
            0.01,
            now + index * duration + duration
          );

          osc.start(now + index * duration);
          osc.stop(now + index * duration + duration);
        });

        console.log("Som de notificação reproduzido com sucesso");
      } else {
        console.warn("AudioContext não está disponível");
      }
    } catch (error) {
      console.error("Erro ao reproduzir som de notificação:", error);
    }
  };

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
        silent: false, // Permitir som do sistema
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

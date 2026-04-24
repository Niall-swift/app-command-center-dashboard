import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Send,
  Search,
  MessageCircle,
  Volume2,
  Bell,
  BellOff,
  Settings,
  Bug,
  Mic,
  Camera,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PredefinedMessages from "@/components/PredefinedMessages";
import PageTransition from "@/components/PageTransition";
import NotificationSettings from "@/components/NotificationSettings";
import DebugPanel from "@/components/DebugPanel";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/use-notifications";
import { useChatNotifications } from "@/contexts/ChatNotificationContext";
import type { Message, Client } from "@/types/dashboard";
import { db } from "@/config/firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  addDoc,
  getDocs,
  doc,
  setDoc,
  collectionGroup,
  where,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/config/firebase";

export default function Chat() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientMessages, setClientMessages] = useState<
    Record<string, Message[]>
  >({});
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showNotificationSettings, setShowNotificationSettings] =
    useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showRecordingUI, setShowRecordingUI] = useState(false);
  const [canRecord, setCanRecord] = useState(true);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [currentPlayingAudio, setCurrentPlayingAudio] = useState<string | null>(null);
  const { toast } = useToast();
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { unreadMessages } = useChatNotifications();
  const {
    isSupported,
    permission,
    isEnabled,
    isPageVisible,
    requestPermission,
    playNotificationSound,
    showChatNotification,
    testNotification,
    toggleNotifications,
  } = useNotifications();

  // Função para criar dados de exemplo se a collection estiver vazia
  const createSampleData = useCallback(async () => {
    try {
      console.log("Criando dados de exemplo...");
      const sampleClients = [
        {
          id: "cliente1",
          name: "usuario de teste",
          avatar: "UT",
          lastMessage: "Olá, preciso de ajuda com minha conta",
          lastMessageTime: new Date(),
          unreadCount: 2,
          isOnline: true,
          email: "joao@email.com",
          phone: "(11) 99999-9999",
        },
      ];

      for (const client of sampleClients) {
        // Criar documento do cliente
        await setDoc(doc(db, "chat", client.id), {
          name: client.name,
          avatar: client.avatar,
          lastMessage: client.lastMessage,
          lastMessageTime: client.lastMessageTime,
          unreadCount: client.unreadCount,
          isOnline: client.isOnline,
          email: client.email,
          phone: client.phone,
        });

        // Criar algumas mensagens de exemplo para cada cliente
        const sampleMessages = [
          {
            id: "msg1",
            user: client.name,
            content: client.lastMessage,
            timestamp: client.lastMessageTime,
            avatar: client.avatar,
          },
          {
            id: "msg2",
            user: "Admin",
            content: "Olá! Como posso ajudá-lo hoje?",
            timestamp: new Date(client.lastMessageTime.getTime() - 60000),
            isAdmin: true,
          },
          {
            id: "msg3",
            user: "Admin",
            content: "📎 Imagem enviada",
            timestamp: new Date(client.lastMessageTime.getTime() - 120000),
            isAdmin: true,
            mediaType: 'image',
            mediaUrl: 'https://picsum.photos/300/200?random=1',
            mediaName: 'imagem_exemplo.jpg',
          },
          {
            id: "msg4",
            user: "Admin",
            content: "🎵 Áudio enviado",
            timestamp: new Date(client.lastMessageTime.getTime() - 180000),
            isAdmin: true,
            mediaType: 'audio',
            mediaUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
            mediaName: 'audio_exemplo.wav',
          },
        ];

        for (const message of sampleMessages) {
          await addDoc(collection(db, "chat", client.id, "mensagens"), {
            user: message.user,
            content: message.content,
            timestamp: message.timestamp,
            avatar: message.avatar,
            isAdmin: message.isAdmin || false,
            mediaType: message.mediaType,
            mediaUrl: message.mediaUrl,
            mediaName: message.mediaName,
          });
        }
      }

      console.log("Dados de exemplo criados com sucesso!");
      toast({
        title: "Dados de exemplo criados",
        description: "Collection 'chat' foi populada com dados de teste",
      });
    } catch (error) {
      console.error("Erro ao criar dados de exemplo:", error);
      toast({
        title: "Erro ao criar dados",
        description:
          error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Buscar clientes da collection 'chat'
  useEffect(() => {
    console.log("Iniciando busca da collection 'chat'");
    setLoading(true);
    setError(null);

    try {
      // @ts-ignore - Verificando projeto conectado
      console.log("🚀 DEBUG: Conectado ao Projeto Firebase:", db._nodeClientConfig?.projectId || "avl-telecom");
      
      const chatRef = collection(db, "chat");
      console.log("🔍 DEBUG: Escutando coleção 'chat' em:", chatRef.path);

      // Primeiro, vamos verificar se há documentos na collection
      getDocs(chatRef).then((snapshot) => {
        console.log(
          "📊 Verificação inicial - documentos encontrados:",
          snapshot.docs.length
        );

        if (snapshot.docs.length === 0) {
          console.log("Collection vazia. Aguardando mensagens reais...");
          // createSampleData(); // Silenciado para não confundir o usuário
        }
      });

      // Criar uma query simples para teste (sem ordenação que pode filtrar documentos)
      const q = query(chatRef, limit(50));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          console.log("Snapshot recebido:", snapshot);
          console.log("Número de documentos:", snapshot.docs.length);

          const clientsData = snapshot.docs.map((doc) => {
            const data = doc.data();
            console.log("Dados do documento:", doc.id, data);

            return {
              id: doc.id,
              name: data.name || "Cliente sem nome",
              avatar: data.avatar || data.name?.charAt(0) || "C",
              lastMessage: data.lastMessage || "Nenhuma mensagem",
              lastMessageTime: data.lastMessageTime?.toDate() || new Date(),
              unreadCount: data.unreadCount || 0,
              isOnline: data.isOnline || false,
              email: data.email,
              phone: data.phone,
              cpf: data.cpf,
              cep: data.cep,
              source: data.source || 'app',
            };
          });

          console.log("Clients processados:", clientsData);
          setClients(clientsData);
          setLoading(false);

          // Selecionar o primeiro cliente se não houver nenhum selecionado
          if (clientsData.length > 0 && !selectedClient) {
            setSelectedClient(clientsData[0]);
          }
        },
        (error) => {
          console.error("Erro ao buscar dados:", error);
          setError(error.message);
          setLoading(false);
          toast({
            title: "Erro ao carregar clientes",
            description: error.message,
            variant: "destructive",
          });
        }
      );

      return unsubscribe;
    } catch (error) {
      console.error("Erro ao configurar listener:", error);
      setError(error instanceof Error ? error.message : "Erro desconhecido");
      setLoading(false);
    }
  }, [selectedClient, toast, createSampleData]);

  // Buscar mensagens do cliente selecionado
  useEffect(() => {
    // Limpar listener anterior se existir
    if (unsubscribeRef.current) {
      console.log("Limpando listener anterior...");
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    if (!selectedClient) {
      console.log("Nenhum cliente selecionado, pulando busca de mensagens");
      return;
    }

    console.log(`Buscando mensagens do cliente: ${selectedClient.id}`);

    try {
      const mensagensRef = collection(
        db,
        "chat",
        selectedClient.id,
        "mensagens"
      );
      const q = query(mensagensRef, orderBy("timestamp", "asc"));

      console.log("Query criada para mensagens:", q);

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          console.log(
            `Mensagens recebidas para ${selectedClient.id}:`,
            snapshot.docs.length
          );

          const messages = snapshot.docs.map((doc) => {
            const data = doc.data();
            console.log("Dados da mensagem:", doc.id, data);
            return {
              id: doc.id,
              user: data.user,
              content: data.content,
              timestamp: data.timestamp?.toDate() || new Date(),
              avatar: data.avatar,
              isAdmin: data.isAdmin || false,
              mediaType: data.mediaType,
              mediaUrl: data.mediaUrl,
              mediaName: data.mediaName,
              source: data.source,
            };
          });

          console.log("Mensagens processadas:", messages);

          // Verificar se há novas mensagens (não do admin) - notificações agora são globais
          const currentMessages = clientMessages[selectedClient.id] || [];
          const newMessages = messages.filter(
            (msg) =>
              !msg.isAdmin &&
              !currentMessages.some((existing) => existing.id === msg.id)
          );

          console.log("Novas mensagens detectadas:", newMessages.length);

          // Mostrar notificações para novas mensagens
          if (newMessages.length > 0 && !isPageVisible) {
            newMessages.forEach((msg) => {
              // Notificação nativa do sistema
              showNativeNotification(
                `Nova mensagem de ${msg.user}`,
                msg.content.length > 50 ? msg.content.substring(0, 50) + "..." : msg.content,
                "/favicon.ico"
              );

              // Notificação da aplicação (toast)
              toast({
                title: `Nova mensagem de ${msg.user}`,
                description: msg.content,
                duration: 5000,
              });
            });
          }

          setClientMessages((prev) => {
            const updated = {
              ...prev,
              [selectedClient.id]: messages,
            };
            console.log("Estado de mensagens atualizado:", updated);
            return updated;
          });

          console.log("Mensagens processadas:", messages);
        },
        (error) => {
          console.error("Erro ao buscar mensagens:", error);
          toast({
            title: "Erro ao carregar mensagens",
            description: error.message,
            variant: "destructive",
          });
        }
      );

      // Armazenar a função de unsubscribe
      unsubscribeRef.current = unsubscribe;

      return () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
      };
    } catch (error) {
      console.error("Erro ao configurar listener de mensagens:", error);
    }
  }, [selectedClient, toast, isEnabled, isPageVisible]);

  // Configurar notificação quando o estado mudar
  useEffect(() => {
    // Solicitar permissão de notificação quando o componente carregar
    if (isSupported && permission === "default") {
      requestPermission();
    }
  }, [isSupported, permission, requestPermission]);

  // Função para mostrar notificação nativa do sistema
  const showNativeNotification = (title: string, body: string, icon?: string) => {
    if (!isSupported || permission !== "granted") {
      console.log("Notificações nativas não suportadas ou não permitidas");
      return;
    }

    try {
      const notification = new Notification(title, {
        body,
        icon: icon || "/favicon.ico",
        badge: "/favicon.ico",
        tag: "chat-message", // Agrupa notificações similares
        requireInteraction: false, // Fecha automaticamente
        silent: false,
      });

      // Auto-fechar após 5 segundos
      setTimeout(() => {
        notification.close();
      }, 5000);

      // Focar na janela quando clicar na notificação
      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return notification;
    } catch (error) {
      console.error("Erro ao criar notificação nativa:", error);
    }
  };


  // Função para testar o som de notificação
  const testNotificationSound = () => {
    console.log("Testando som de notificação...");
    console.log("Status das notificações:", {
      isEnabled,
      isSupported,
      permission,
      isPageVisible,
    });
    testNotification();

    // Testar também notificação nativa
    showNativeNotification(
      "Teste de Notificação",
      "Esta é uma notificação de teste do sistema",
      "/favicon.ico"
    );
  };

  const handleClientSelect = async (client: Client) => {
    setSelectedClient(client);
    console.log("Cliente selecionado:", client.name);

    // Zerar contador de mensagens não lidas quando o cliente é selecionado
    if (client.unreadCount > 0) {
      try {
        await setDoc(
          doc(db, "chat", client.id),
          {
            unreadCount: 0,
          },
          { merge: true }
        );
        console.log(`Contador de mensagens não lidas zerado para ${client.name}`);
      } catch (error) {
        console.error("Erro ao zerar contador de mensagens não lidas:", error);
      }
    }
  };

  const handleSendMessage = async () => {
    if (newMessage.trim() && selectedClient) {
      try {
        const message = {
          user: "Admin",
          content: newMessage,
          timestamp: new Date(),
          isAdmin: true,
        };

        // Adicionar mensagem à subcollection do cliente
        await addDoc(
          collection(db, "chat", selectedClient.id, "mensagens"),
          message
        );

        // Atualizar última mensagem do cliente
        await setDoc(
          doc(db, "chat", selectedClient.id),
          {
            lastMessage: newMessage,
            lastMessageTime: new Date(),
          },
          { merge: true }
        );

        setNewMessage("");
      } catch (error) {
        console.error("Erro ao enviar mensagem:", error);
        toast({
          title: "Erro ao enviar mensagem",
          description:
            error instanceof Error ? error.message : "Erro desconhecido",
          variant: "destructive",
        });
      }
    }
  };

  const handlePredefinedMessage = (message: string) => {
    setNewMessage(message);
  };

  const uploadFile = async (file: File, type: 'audio' | 'image'): Promise<string> => {
    const fileRef = ref(storage, `chat/${selectedClient?.id}/${Date.now()}_${file.name}`);
    await uploadBytes(fileRef, file);
    return await getDownloadURL(fileRef);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      sendMediaMessage('image', file);
      setShowMediaModal(false);
    }
  };

  const startRecording = async () => {
    // Prevenir cliques múltiplos
    if (!canRecord) {
      console.log("Aguarde, operação em andamento...");
      return;
    }

    setCanRecord(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      setMediaRecorder(recorder);
      setRecordedChunks([]);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setRecordedChunks((prev) => [...prev, event.data]);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      setShowRecordingUI(true);
      setRecordingTime(0);

      // Timer para contar o tempo
      const interval = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 59) { // Máximo 60 segundos
            clearInterval(interval);
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

      setTimeout(() => setCanRecord(true), 500);
    } catch (error) {
      console.error("Erro ao iniciar gravação:", error);
      setCanRecord(true);
      toast({
        title: "Erro ao gravar áudio",
        description: "Não foi possível acessar o microfone",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
      setShowRecordingUI(false);
      setRecordingTime(0);
    }
    setCanRecord(true);
  };

  const sendMediaMessage = async (mediaType: 'image' | 'audio', file: File) => {
    if (!selectedClient) return;

    try {
      const mediaUrl = await uploadFile(file, mediaType);
      const message = {
        user: "Admin",
        content: mediaType === 'audio' ? "🎵 Áudio enviado" : "📎 Imagem enviada",
        timestamp: new Date(),
        isAdmin: true,
        mediaType,
        mediaUrl,
        mediaName: file.name,
      };

      await addDoc(
        collection(db, "chat", selectedClient.id, "mensagens"),
        message
      );

      await setDoc(
        doc(db, "chat", selectedClient.id),
        {
          lastMessage: message.content,
          lastMessageTime: new Date(),
        },
        { merge: true }
      );

      setSelectedFile(null);
    } catch (error) {
      console.error("Erro ao enviar mídia:", error);
      toast({
        title: "Erro ao enviar mídia",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  // Função para expandir imagem
  const expandImage = (imageUrl: string) => {
    setSelectedImageUrl(imageUrl);
    setShowImageModal(true);
  };

  // Função para reproduzir áudio
  const playAudio = async (audioUrl: string) => {
    try {
      // Se já está tocando outro áudio, parar primeiro
      if (currentPlayingAudio && currentPlayingAudio !== audioUrl) {
        await stopAudio();
      }

      const audio = new Audio(audioUrl);
      audio.play();
      setCurrentPlayingAudio(audioUrl);
      setIsPlayingAudio(true);

      audio.onended = () => {
        setIsPlayingAudio(false);
        setCurrentPlayingAudio(null);
      };
    } catch (error) {
      console.error("Erro ao reproduzir áudio:", error);
      setIsPlayingAudio(false);
      setCurrentPlayingAudio(null);
    }
  };

  // Função para parar áudio
  const stopAudio = async () => {
    try {
      // Para todos os elementos de áudio
      const audioElements = document.querySelectorAll('audio');
      audioElements.forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
      });

      setIsPlayingAudio(false);
      setCurrentPlayingAudio(null);
    } catch (error) {
      console.error("Erro ao parar áudio:", error);
    }
  };

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentMessages = selectedClient
    ? clientMessages[selectedClient.id] || []
    : [];

  // Auto-scroll para o final das mensagens quando novas mensagens chegam
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentMessages]);

  // Processar áudio gravado
  useEffect(() => {
    if (recordedChunks.length > 0 && !isRecording) {
      const blob = new Blob(recordedChunks, { type: 'audio/webm' });
      const file = new File([blob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
      sendMediaMessage('audio', file);
      setRecordedChunks([]);
    }
  }, [recordedChunks, isRecording, selectedClient]);

  // Debug: Log das mensagens atuais
  console.log("Debug - selectedClient:", selectedClient?.id);
  console.log("Debug - clientMessages:", clientMessages);
  console.log("Debug - currentMessages:", currentMessages);
  console.log("Debug - currentMessages.length:", currentMessages.length);

  const messageVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.3, ease: "easeOut" },
    },
    exit: {
      opacity: 0,
      y: -10,
      scale: 0.95,
      transition: { duration: 0.2 },
    },
  };

  const clientVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.3 },
    },
    hover: {
      backgroundColor: "rgba(59, 130, 246, 0.05)",
      scale: 1.02,
      transition: { duration: 0.2 },
    },
  };

  return (
    <PageTransition>
      <div className="h-full flex gap-6">
        {/* Lista de Clientes */}
        <motion.div
          className="w-80 flex flex-col"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="bg-white shadow-sm flex-1">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      repeatDelay: 3,
                    }}
                  >
                    <MessageCircle className="w-5 h-5" />
                  </motion.div>
                  Clientes
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={testNotificationSound}
                    className="text-xs"
                    title="Testar som de notificação"
                  >
                    Testar Som
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleNotifications}
                    className={`p-2 ${
                      isEnabled ? "text-green-600" : "text-gray-400"
                    }`}
                    title={
                      isEnabled
                        ? "Desativar notificações"
                        : "Ativar notificações"
                    }
                  >
                    {isEnabled ? (
                      <Bell className="w-4 h-4" />
                    ) : (
                      <BellOff className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setShowNotificationSettings(!showNotificationSettings)
                    }
                    className="p-2"
                    title="Configurações de notificação"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDebugPanel(!showDebugPanel)}
                    className="p-2"
                    title="Painel de debug"
                  >
                    <Bug className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      console.log("Forçando atualização das mensagens...");
                      // Forçar re-render das mensagens
                      setClientMessages((prev) => ({ ...prev }));
                    }}
                    className="p-2"
                    title="Atualizar mensagens"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      🔄
                    </motion.div>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      console.log("Verificando dados no Firebase...");
                      if (selectedClient) {
                        const mensagensRef = collection(
                          db,
                          "chat",
                          selectedClient.id,
                          "mensagens"
                        );
                        getDocs(mensagensRef).then((snapshot) => {
                          console.log(
                            "Dados encontrados no Firebase:",
                            snapshot.docs.length
                          );
                          snapshot.docs.forEach((doc) => {
                            console.log("Documento:", doc.id, doc.data());
                          });
                        });
                      }
                    }}
                    className="p-2"
                    title="Verificar dados no Firebase"
                  >
                    🔍
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      console.log("Forçando carregamento de mensagens...");
                      if (selectedClient) {
                        // Forçar recriação do listener
                        if (unsubscribeRef.current) {
                          unsubscribeRef.current();
                          unsubscribeRef.current = null;
                        }
                        // Forçar re-render
                        setClientMessages((prev) => ({ ...prev }));
                      }
                    }}
                    className="p-2"
                    title="Forçar carregamento de mensagens"
                  >
                    📥
                  </Button>
                  {!isPageVisible && (
                    <motion.div
                      className="w-2 h-2 bg-orange-500 rounded-full"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      title="Página em segundo plano"
                    />
                  )}
                </div>
              </CardTitle>
              <motion.div
                className="relative"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Buscar clientes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </motion.div>
              <Button 
                variant="outline" 
                size="sm"
                className="w-full mt-2 bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 gap-2 text-[10px] h-7"
                onClick={async () => {
                  try {
                    const testId = "teste_" + Date.now();
                    console.log("🚀 Iniciando teste de escrita manual...");
                    const { doc, setDoc } = await import("firebase/firestore");
                    await setDoc(doc(db, "chat", testId), {
                      name: "🔧 TESTE DE CONEXÃO",
                      lastMessage: "Se você vê isso, o painel está CONECTADO!",
                      lastMessageTime: new Date(),
                      source: 'app'
                    });
                    alert("✅ Sucesso! O painel gravou no Firebase. Verifique se apareceu um novo item 'TESTE DE CONEXÃO' na lista.");
                  } catch (e: any) {
                    alert("❌ Erro de conexão: " + e.message);
                  }
                }}
              >
                <Settings className="w-3 h-3" />
                Testar Conexão Firebase
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-96 overflow-y-auto">
                {loading && (
                  <div className="p-4 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-sm text-gray-500 mt-2">
                      Carregando clientes...
                    </p>
                  </div>
                )}

                {error && (
                  <div className="p-4 text-center">
                    <p className="text-sm text-red-500">Erro: {error}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.reload()}
                      className="mt-2"
                    >
                      Tentar novamente
                    </Button>
                  </div>
                )}

                {!loading && !error && (
                  <AnimatePresence>
                    {filteredClients.map((client, index) => (
                      <motion.div
                        key={client.id}
                        variants={clientVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        whileHover="hover"
                        transition={{ delay: index * 0.1 }}
                        onClick={() => handleClientSelect(client)}
                        className={`p-4 border-b cursor-pointer transition-colors ${
                          selectedClient?.id === client.id
                            ? "bg-blue-50 border-l-4 border-l-blue-600"
                            : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar className="w-10 h-10">
                              <AvatarFallback className="bg-blue-100 text-blue-600">
                                {client.avatar}
                              </AvatarFallback>
                            </Avatar>
                            {client.isOnline && (
                              <motion.div
                                className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium text-sm truncate flex items-center gap-2">
                                {client.name}
                                {client.source === 'whatsapp' && (
                                  <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] h-4 px-1">
                                    WhatsApp
                                  </Badge>
                                )}
                              </h4>
                              {client.unreadCount > 0 && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{
                                    type: "spring",
                                    stiffness: 500,
                                  }}
                                >
                                  <Badge
                                    variant="destructive"
                                    className="text-xs px-1.5 py-0.5"
                                  >
                                    {client.unreadCount}
                                  </Badge>
                                </motion.div>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 truncate">
                              {client.lastMessage}
                            </p>
                            <p className="text-xs text-gray-400">
                              {client.lastMessageTime.toLocaleTimeString(
                                "pt-BR",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Chat Area */}
        <motion.div
          className="flex-1 flex flex-col"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card className="bg-white shadow-sm flex-1">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <AnimatePresence mode="wait">
                  {selectedClient ? (
                    <motion.div
                      key={selectedClient.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.3 }}
                      className="flex items-center gap-3"
                    >
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-blue-100 text-blue-600">
                          {selectedClient.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <span>{selectedClient.name}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <motion.div
                            className={`w-2 h-2 rounded-full ${
                              selectedClient.isOnline
                                ? "bg-green-500"
                                : "bg-gray-400"
                            }`}
                            animate={
                              selectedClient.isOnline
                                ? { scale: [1, 1.2, 1] }
                                : {}
                            }
                            transition={{ duration: 2, repeat: Infinity }}
                          />
                          <span className="text-xs text-gray-500">
                            {selectedClient.isOnline ? "Online" : "Offline"}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      Selecione um cliente
                    </motion.span>
                  )}
                </AnimatePresence>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 max-h-[700px] flex flex-col">
              <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[500px]">
                {selectedClient ? (
                  <>
                    {/* Debug: Mostrar informações das mensagens */}
                    <div className="text-xs text-gray-500 mb-2">
                      Debug: {currentMessages.length} mensagens para{" "}
                      {selectedClient.name}
                    </div>
                    <AnimatePresence>
                      {currentMessages.map((message, index) => (
                        <motion.div
                          key={message.id}
                          variants={messageVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          transition={{ delay: index * 0.1 }}
                          className={`flex gap-3 ${
                            message.isAdmin ? "justify-end" : "justify-start"
                          }`}
                        >
                          {!message.isAdmin && (
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className="bg-blue-100 text-blue-600">
                                {message.avatar || message.user.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <motion.div
                            className={`max-w-md ${
                              message.isAdmin ? "order-first" : ""
                            }`}
                            whileHover={{ scale: 1.02 }}
                            transition={{ duration: 0.2 }}
                          >
                            <motion.div
                              className={`p-3 rounded-lg ${
                                message.isAdmin
                                  ? "bg-blue-600 text-white"
                                  : "bg-gray-100 text-gray-900"
                              }`}
                              initial={{ scale: 0.9, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ duration: 0.3 }}
                            >
                              {message.mediaType === 'audio' && message.mediaUrl ? (
                                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                                  <button
                                    onClick={() => currentPlayingAudio === message.mediaUrl ? stopAudio() : playAudio(message.mediaUrl!)}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                      currentPlayingAudio === message.mediaUrl ? 'bg-blue-600' : 'bg-gray-600'
                                    } text-white`}
                                  >
                                    {currentPlayingAudio === message.mediaUrl ? '⏸️' : '▶️'}
                                  </button>
                                  <div className="flex-1">
                                    <p className="text-sm font-medium">
                                      {currentPlayingAudio === message.mediaUrl ? "🎵 Tocando áudio..." : "🎵 Mensagem de voz"}
                                    </p>
                                    {currentPlayingAudio === message.mediaUrl && (
                                      <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                                        <div className="bg-blue-600 h-1 rounded-full w-1/3"></div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : message.mediaType === 'image' && message.mediaUrl ? (
                                <img
                                  src={message.mediaUrl}
                                  alt={message.mediaName || "Imagem"}
                                  className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => expandImage(message.mediaUrl!)}
                                />
                              ) : (
                                <p className="text-sm">{message.content}</p>
                              )}
                            </motion.div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-500">
                                {message.user}
                              </span>
                               <span className="text-xs text-gray-400">
                                 {message.timestamp.toLocaleTimeString("pt-BR", {
                                   hour: "2-digit",
                                   minute: "2-digit",
                                 })}
                               </span>
                               {message.source === 'whatsapp' && (
                                 <span className="text-[10px] text-green-600 font-bold ml-1 flex items-center gap-0.5">
                                   WA
                                 </span>
                               )}
                             </div>
                          </motion.div>
                          {message.isAdmin && (
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className="bg-blue-600 text-white">
                                A
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {/* Elemento para auto-scroll */}
                    <div ref={messagesEndRef} />
                  </>
                ) : (
                  <motion.div
                    className="flex items-center justify-center h-full"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                  >
                    <div className="text-center">
                      <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                      <p className="text-gray-500">
                        Selecione um cliente para iniciar a conversa
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>

              {selectedClient && (
                <motion.div
                  className="border-t p-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                >
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowMediaModal(true)}
                      title="Anexar mídia"
                    >
                      <Camera className="w-4 h-4" />
                    </Button>
                    <Input
                      placeholder="Digite sua mensagem..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) =>
                        e.key === "Enter" && handleSendMessage()
                      }
                      className="flex-1"
                    />
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button
                        onClick={handleSendMessage}
                        className="bg-blue-600 hover:bg-blue-700"
                        disabled={!newMessage.trim()}
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </motion.div>
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Mensagens Predefinidas */}
        {selectedClient && (
          <PredefinedMessages
            client={selectedClient}
            onSelectMessage={handlePredefinedMessage}
          />
        )}

        {/* Configurações de Notificação */}
        {showNotificationSettings && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowNotificationSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <NotificationSettings
                isEnabled={isEnabled}
                isSupported={isSupported}
                permission={permission}
                isPageVisible={isPageVisible}
                onToggleNotifications={toggleNotifications}
                onRequestPermission={requestPermission}
                onTestNotification={testNotification}
              />
            </motion.div>
          </motion.div>
        )}

        {/* Painel de Debug */}
        {showDebugPanel && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDebugPanel(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <DebugPanel
                isEnabled={isEnabled}
                isSupported={isSupported}
                permission={permission}
                isPageVisible={isPageVisible}
                selectedClient={selectedClient}
                clientMessages={clientMessages}
                onTestSound={testNotificationSound}
                onTestNotification={testNotification}
              />
            </motion.div>
          </motion.div>
        )}

        {/* Modal para seleção de mídia */}
        {showMediaModal && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowMediaModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 mx-4 w-80"
            >
              <p className="text-lg font-bold text-gray-800 mb-4 text-center">
                Anexar Mídia
              </p>
              <div className="space-y-4">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                  id="photo-input-modal"
                />
                <Button
                  onClick={() => document.getElementById('photo-input-modal')?.click()}
                  className="w-full items-center gap-3 h-12"
                  variant="outline"
                >
                  <Camera className="w-5 h-5" />
                  Selecionar Foto
                </Button>
                <Button
                  onClick={() => {
                    setShowMediaModal(false);
                    startRecording();
                  }}
                  className="w-full items-center gap-3 h-12 bg-red-500 hover:bg-red-600"
                  disabled={!canRecord}
                >
                  <Mic className="w-5 h-5" />
                  Gravar Áudio
                </Button>
              </div>
              <Button
                onClick={() => setShowMediaModal(false)}
                className="w-full mt-4"
                variant="ghost"
              >
                Cancelar
              </Button>
            </motion.div>
          </motion.div>
        )}

        {/* Modal para expandir imagem */}
        {showImageModal && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowImageModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative"
            >
              <Button
                onClick={() => setShowImageModal(false)}
                className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 hover:bg-opacity-70 text-white"
                size="sm"
              >
                ✕
              </Button>
              {selectedImageUrl && (
                <img
                  src={selectedImageUrl}
                  alt="Imagem expandida"
                  className="max-w-full max-h-[80vh] object-contain rounded-lg"
                />
              )}
            </motion.div>
          </motion.div>
        )}

        {/* Interface de gravação estilo WhatsApp */}
        {showRecordingUI && (
          <motion.div
            className="fixed bottom-20 left-4 right-4 bg-gray-800 rounded-2xl p-4 flex-row items-center justify-between shadow-lg border border-red-500 z-50"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
          >
            <div className="flex items-center flex-1">
              <div className="w-12 h-12 bg-red-500 rounded-full items-center justify-center mr-3 animate-pulse">
                <Mic className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-white font-medium">Gravando áudio...</p>
                <p className="text-red-400 text-sm font-mono">
                  {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                </p>
              </div>
            </div>
            <div className="flex">
              <Button
                onClick={() => {
                  setShowRecordingUI(false);
                  setIsRecording(false);
                  setRecordingTime(0);
                  if (mediaRecorder) {
                    mediaRecorder.stop();
                  }
                }}
                className="w-10 h-10 bg-gray-600 hover:bg-gray-700 rounded-full mr-2"
                size="sm"
              >
                ✕
              </Button>
              <Button
                onClick={stopRecording}
                className="w-12 h-12 bg-red-500 hover:bg-red-600 rounded-full border-2 border-red-300"
                size="sm"
              >
                ■
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
}

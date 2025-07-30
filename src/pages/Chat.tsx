import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Search, MessageCircle, Volume2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PredefinedMessages from "@/components/PredefinedMessages";
import PageTransition from "@/components/PageTransition";
import { useToast } from "@/hooks/use-toast";
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
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const { toast } = useToast();

  // Função para criar dados de exemplo se a collection estiver vazia
  const createSampleData = async () => {
    try {
      console.log("Criando dados de exemplo...");
      const sampleClients = [
        {
          id: "cliente1",
          name: "João Silva",
          avatar: "JS",
          lastMessage: "Olá, preciso de ajuda com minha conta",
          lastMessageTime: new Date(),
          unreadCount: 2,
          isOnline: true,
          email: "joao@email.com",
          phone: "(11) 99999-9999",
        },
        {
          id: "cliente2",
          name: "Maria Santos",
          avatar: "MS",
          lastMessage: "Quando será lançada a nova funcionalidade?",
          lastMessageTime: new Date(Date.now() - 3600000),
          unreadCount: 0,
          isOnline: false,
          email: "maria@email.com",
          phone: "(11) 88888-8888",
        },
        {
          id: "cliente3",
          name: "Pedro Costa",
          avatar: "PC",
          lastMessage: "Preciso alterar meus dados",
          lastMessageTime: new Date(Date.now() - 7200000),
          unreadCount: 1,
          isOnline: true,
          email: "pedro@email.com",
          phone: "(11) 77777-7777",
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
        ];

        for (const message of sampleMessages) {
          await addDoc(collection(db, "chat", client.id, "mensagens"), {
            user: message.user,
            content: message.content,
            timestamp: message.timestamp,
            avatar: message.avatar,
            isAdmin: message.isAdmin || false,
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
  };

  // Buscar clientes da collection 'chat'
  useEffect(() => {
    console.log("Iniciando busca da collection 'chat'");
    setLoading(true);
    setError(null);

    try {
      const chatRef = collection(db, "chat");
      console.log("Referência da collection criada:", chatRef);

      // Primeiro, vamos verificar se há documentos na collection
      getDocs(chatRef).then((snapshot) => {
        console.log(
          "Verificação inicial - documentos encontrados:",
          snapshot.docs.length
        );

        if (snapshot.docs.length === 0) {
          console.log("Collection vazia, criando dados de exemplo...");
          createSampleData();
        }
      });

      // Criar uma query para ordenar e limitar os resultados
      const q = query(chatRef, orderBy("lastMessageTime", "desc"), limit(50));

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
  }, [selectedClient, toast]);

  // Buscar mensagens do cliente selecionado
  useEffect(() => {
    if (!selectedClient) return;

    console.log(`Buscando mensagens do cliente: ${selectedClient.id}`);

    try {
      const mensagensRef = collection(
        db,
        "chat",
        selectedClient.id,
        "mensagens"
      );
      const q = query(mensagensRef, orderBy("timestamp", "asc"));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          console.log(
            `Mensagens recebidas para ${selectedClient.id}:`,
            snapshot.docs.length
          );

          const messages = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              user: data.user,
              content: data.content,
              timestamp: data.timestamp?.toDate() || new Date(),
              avatar: data.avatar,
              isAdmin: data.isAdmin || false,
            };
          });

          // Verificar se há novas mensagens (não do admin)
          const currentMessages = clientMessages[selectedClient.id] || [];
          const newMessages = messages.filter(
            (msg) =>
              !msg.isAdmin &&
              !currentMessages.some((existing) => existing.id === msg.id)
          );

          // Se há novas mensagens, tocar som de notificação
          if (newMessages.length > 0 && notificationEnabled) {
            console.log(
              `Nova(s) mensagem(ns) recebida(s): ${newMessages.length}`
            );
            playNotificationSound();
          }

          setClientMessages((prev) => ({
            ...prev,
            [selectedClient.id]: messages,
          }));

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

      return unsubscribe;
    } catch (error) {
      console.error("Erro ao configurar listener de mensagens:", error);
    }
  }, [selectedClient, toast, notificationEnabled, clientMessages]);

  // Configurar notificação quando o estado mudar
  useEffect(() => {
    // notificationSound.setEnabled(notificationEnabled); // Removed as per edit hint
  }, [notificationEnabled]);

  const playNotificationSound = () => {
    if (notificationEnabled) {
      try {
        console.log("Tocando som de notificação...");
        // notificationSound.playNotification(); // Removed as per edit hint
        toast({
          title: "Nova mensagem!",
          description: "Você recebeu uma nova mensagem",
          duration: 3000,
        });
      } catch (error) {
        console.error("Erro ao reproduzir som de notificação:", error);
      }
    }
  };

  // Função para testar o som de notificação
  const testNotificationSound = () => {
    console.log("Testando som de notificação...");
    // notificationSound.playNotification(); // Removed as per edit hint
    toast({
      title: "Teste de Som",
      description: "Som de notificação testado com sucesso",
      duration: 2000,
    });
  };

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
    console.log("Cliente selecionado:", client.name);
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

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentMessages = selectedClient
    ? clientMessages[selectedClient.id] || []
    : [];

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

  const toggleNotifications = () => {
    setNotificationEnabled(!notificationEnabled);
    toast({
      title: notificationEnabled
        ? "Notificações desativadas"
        : "Notificações ativadas",
      description: notificationEnabled
        ? "Você não receberá sons de notificação"
        : "Você receberá sons para novas mensagens",
    });
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
                  >
                    Testar Som
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleNotifications}
                    className={`p-2 ${
                      notificationEnabled ? "text-green-600" : "text-gray-400"
                    }`}
                  >
                    <Volume2 className="w-4 h-4" />
                  </Button>
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
                              <h4 className="font-medium text-sm truncate">
                                {client.name}
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
                            <p className="text-sm">{message.content}</p>
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
      </div>
    </PageTransition>
  );
}

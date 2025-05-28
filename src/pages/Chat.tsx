import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Search, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PredefinedMessages from '@/components/PredefinedMessages';
import PageTransition from '@/components/PageTransition';
import type { Message, Client } from '@/types/dashboard';

export default function Chat() {
  const [clients] = useState<Client[]>([
    {
      id: '1',
      name: 'João Silva',
      avatar: 'JS',
      lastMessage: 'Olá, preciso de ajuda com minha conta',
      lastMessageTime: new Date(Date.now() - 300000),
      unreadCount: 2,
      isOnline: true
    },
    {
      id: '2',
      name: 'Maria Santos',
      avatar: 'MS',
      lastMessage: 'Quando será lançada a nova funcionalidade?',
      lastMessageTime: new Date(Date.now() - 120000),
      unreadCount: 1,
      isOnline: false
    },
    {
      id: '3',
      name: 'Pedro Costa',
      avatar: 'PC',
      lastMessage: 'Obrigado pela ajuda!',
      lastMessageTime: new Date(Date.now() - 600000),
      unreadCount: 0,
      isOnline: true
    },
    {
      id: '4',
      name: 'Ana Lima',
      avatar: 'AL',
      lastMessage: 'Está funcionando perfeitamente agora',
      lastMessageTime: new Date(Date.now() - 900000),
      unreadCount: 0,
      isOnline: false
    }
  ]);

  const [selectedClient, setSelectedClient] = useState<Client | null>(clients[0]);
  
  // Mensagens específicas por cliente
  const [clientMessages, setClientMessages] = useState<Record<string, Message[]>>({
    '1': [
      {
        id: '1',
        user: 'João Silva',
        content: 'Olá, preciso de ajuda com minha conta',
        timestamp: new Date(Date.now() - 300000),
        avatar: 'JS'
      },
      {
        id: '2',
        user: 'Admin',
        content: 'Olá João! Como posso ajudá-lo hoje?',
        timestamp: new Date(Date.now() - 240000),
        isAdmin: true
      }
    ],
    '2': [
      {
        id: '1',
        user: 'Maria Santos',
        content: 'Quando será lançada a nova funcionalidade?',
        timestamp: new Date(Date.now() - 120000),
        avatar: 'MS'
      }
    ],
    '3': [
      {
        id: '1',
        user: 'Pedro Costa',
        content: 'Preciso alterar meus dados',
        timestamp: new Date(Date.now() - 700000),
        avatar: 'PC'
      },
      {
        id: '2',
        user: 'Admin',
        content: 'Claro Pedro! Vou ajudá-lo com isso.',
        timestamp: new Date(Date.now() - 650000),
        isAdmin: true
      },
      {
        id: '3',
        user: 'Pedro Costa',
        content: 'Obrigado pela ajuda!',
        timestamp: new Date(Date.now() - 600000),
        avatar: 'PC'
      }
    ],
    '4': [
      {
        id: '1',
        user: 'Ana Lima',
        content: 'Está funcionando perfeitamente agora',
        timestamp: new Date(Date.now() - 900000),
        avatar: 'AL'
      }
    ]
  });

  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
    console.log('Cliente selecionado:', client.name);
  };

  const handleSendMessage = () => {
    if (newMessage.trim() && selectedClient) {
      const message: Message = {
        id: Date.now().toString(),
        user: 'Admin',
        content: newMessage,
        timestamp: new Date(),
        isAdmin: true
      };
      
      setClientMessages(prev => ({
        ...prev,
        [selectedClient.id]: [...(prev[selectedClient.id] || []), message]
      }));
      setNewMessage('');
    }
  };

  const handlePredefinedMessage = (message: string) => {
    setNewMessage(message);
  };

  const filteredClients = clients.filter(client => 
    client.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentMessages = selectedClient ? (clientMessages[selectedClient.id] || []) : [];

  const messageVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { duration: 0.3, ease: "easeOut" }
    },
    exit: { 
      opacity: 0, 
      y: -10, 
      scale: 0.95,
      transition: { duration: 0.2 }
    }
  };

  const clientVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { duration: 0.3 }
    },
    hover: { 
      backgroundColor: "rgba(59, 130, 246, 0.05)",
      scale: 1.02,
      transition: { duration: 0.2 }
    }
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
              <CardTitle className="flex items-center gap-2">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                >
                  <MessageCircle className="w-5 h-5" />
                </motion.div>
                Clientes
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
                        selectedClient?.id === client.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
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
                            <h4 className="font-medium text-sm truncate">{client.name}</h4>
                            {client.unreadCount > 0 && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 500 }}
                              >
                                <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
                                  {client.unreadCount}
                                </Badge>
                              </motion.div>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{client.lastMessage}</p>
                          <p className="text-xs text-gray-400">
                            {client.lastMessageTime.toLocaleTimeString('pt-BR', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
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
                            className={`w-2 h-2 rounded-full ${selectedClient.isOnline ? 'bg-green-500' : 'bg-gray-400'}`}
                            animate={selectedClient.isOnline ? { scale: [1, 1.2, 1] } : {}}
                            transition={{ duration: 2, repeat: Infinity }}
                          />
                          <span className="text-xs text-gray-500">
                            {selectedClient.isOnline ? 'Online' : 'Offline'}
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
            <CardContent className="p-0 flex-1 flex flex-col">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
                        className={`flex gap-3 ${message.isAdmin ? 'justify-end' : 'justify-start'}`}
                      >
                        {!message.isAdmin && (
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="bg-blue-100 text-blue-600">
                              {message.avatar || message.user.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <motion.div 
                          className={`max-w-md ${message.isAdmin ? 'order-first' : ''}`}
                          whileHover={{ scale: 1.02 }}
                          transition={{ duration: 0.2 }}
                        >
                          <motion.div 
                            className={`p-3 rounded-lg ${
                              message.isAdmin 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-gray-100 text-gray-900'
                            }`}
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.3 }}
                          >
                            <p className="text-sm">{message.content}</p>
                          </motion.div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500">{message.user}</span>
                            <span className="text-xs text-gray-400">
                              {message.timestamp.toLocaleTimeString('pt-BR', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                          </div>
                        </motion.div>
                        {message.isAdmin && (
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="bg-blue-600 text-white">A</AvatarFallback>
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
                      <p className="text-gray-500">Selecione um cliente para iniciar a conversa</p>
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
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      className="flex-1"
                    />
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button onClick={handleSendMessage} className="bg-blue-600 hover:bg-blue-700">
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

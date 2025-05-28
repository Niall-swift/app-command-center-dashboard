
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Search, MessageCircle } from 'lucide-react';
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
  const [messages, setMessages] = useState<Message[]>([
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
  ]);

  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
    // Aqui você pode carregar as mensagens específicas do cliente
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
      setMessages([...messages, message]);
      setNewMessage('');
    }
  };

  const filteredClients = clients.filter(client => 
    client.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMessages = messages.filter(msg => 
    msg.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.user.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex gap-6">
      {/* Lista de Clientes */}
      <div className="w-80 flex flex-col">
        <Card className="bg-white shadow-sm flex-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Clientes
            </CardTitle>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Buscar clientes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-y-auto">
              {filteredClients.map((client) => (
                <div
                  key={client.id}
                  onClick={() => handleClientSelect(client)}
                  className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
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
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm truncate">{client.name}</h4>
                        {client.unreadCount > 0 && (
                          <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
                            {client.unreadCount}
                          </Badge>
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
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        <Card className="bg-white shadow-sm flex-1">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {selectedClient ? (
                <div className="flex items-center gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-blue-100 text-blue-600">
                      {selectedClient.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <span>{selectedClient.name}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={`w-2 h-2 rounded-full ${selectedClient.isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                      <span className="text-xs text-gray-500">
                        {selectedClient.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                'Selecione um cliente'
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {selectedClient ? (
                filteredMessages.map((message) => (
                  <div key={message.id} className={`flex gap-3 ${message.isAdmin ? 'justify-end' : 'justify-start'}`}>
                    {!message.isAdmin && (
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-blue-100 text-blue-600">
                          {message.avatar || message.user.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className={`max-w-md ${message.isAdmin ? 'order-first' : ''}`}>
                      <div className={`p-3 rounded-lg ${
                        message.isAdmin 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-100 text-gray-900'
                      }`}>
                        <p className="text-sm">{message.content}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">{message.user}</span>
                        <span className="text-xs text-gray-400">
                          {message.timestamp.toLocaleTimeString('pt-BR', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      </div>
                    </div>
                    {message.isAdmin && (
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-blue-600 text-white">A</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">Selecione um cliente para iniciar a conversa</p>
                </div>
              )}
            </div>
            
            {selectedClient && (
              <div className="border-t p-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Digite sua mensagem..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="flex-1"
                  />
                  <Button onClick={handleSendMessage} className="bg-blue-600 hover:bg-blue-700">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

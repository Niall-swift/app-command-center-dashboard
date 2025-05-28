
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Search } from 'lucide-react';
import type { Message } from '@/types/dashboard';

export default function Chat() {
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
    },
    {
      id: '3',
      user: 'Maria Santos',
      content: 'Quando será lançada a nova funcionalidade?',
      timestamp: new Date(Date.now() - 120000),
      avatar: 'MS'
    }
  ]);

  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const handleSendMessage = () => {
    if (newMessage.trim()) {
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

  const filteredMessages = messages.filter(msg => 
    msg.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.user.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col space-y-6">
      <Card className="bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Chat Central
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Buscar mensagens..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-96 overflow-y-auto p-6 space-y-4">
            {filteredMessages.map((message) => (
              <div key={message.id} className={`flex gap-3 ${message.isAdmin ? 'justify-end' : 'justify-start'}`}>
                {!message.isAdmin && (
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-blue-600">
                      {message.avatar || message.user.charAt(0)}
                    </span>
                  </div>
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
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-white">A</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          
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
        </CardContent>
      </Card>
    </div>
  );
}


import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Pause, Trash2 } from 'lucide-react';
import type { Bot } from '@/types/dashboard';

export default function Bots() {
  const [bots, setBots] = useState<Bot[]>([
    {
      id: '1',
      name: 'Bot de Atendimento',
      description: 'Bot para atendimento automático de clientes',
      status: 'active',
      createdAt: new Date(Date.now() - 86400000),
      commands: ['/start', '/help', '/suporte']
    },
    {
      id: '2',
      name: 'Bot de Vendas',
      description: 'Bot especializado em vendas e conversões',
      status: 'inactive',
      createdAt: new Date(Date.now() - 172800000),
      commands: ['/produtos', '/comprar', '/desconto']
    }
  ]);

  const [newBotName, setNewBotName] = useState('');
  const [newBotDescription, setNewBotDescription] = useState('');

  const handleCreateBot = () => {
    if (newBotName.trim() && newBotDescription.trim()) {
      const newBot: Bot = {
        id: Date.now().toString(),
        name: newBotName,
        description: newBotDescription,
        status: 'inactive',
        createdAt: new Date(),
        commands: []
      };
      setBots([...bots, newBot]);
      setNewBotName('');
      setNewBotDescription('');
    }
  };

  const toggleBotStatus = (id: string) => {
    setBots(bots.map(bot => 
      bot.id === id 
        ? { ...bot, status: bot.status === 'active' ? 'inactive' : 'active' as 'active' | 'inactive' }
        : bot
    ));
  };

  const deleteBot = (id: string) => {
    setBots(bots.filter(bot => bot.id !== id));
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Criar Novo Bot
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              placeholder="Nome do bot"
              value={newBotName}
              onChange={(e) => setNewBotName(e.target.value)}
            />
            <Input
              placeholder="Descrição do bot"
              value={newBotDescription}
              onChange={(e) => setNewBotDescription(e.target.value)}
            />
          </div>
          <Button onClick={handleCreateBot} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Criar Bot
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bots.map((bot) => (
          <Card key={bot.id} className="bg-white shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{bot.name}</CardTitle>
                <Badge variant={bot.status === 'active' ? 'default' : 'secondary'}>
                  {bot.status === 'active' ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              <p className="text-sm text-gray-600">{bot.description}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Comandos:</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {bot.commands.length > 0 ? (
                      bot.commands.map((command, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {command}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400">Nenhum comando</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleBotStatus(bot.id)}
                    className="flex-1"
                  >
                    {bot.status === 'active' ? (
                      <>
                        <Pause className="w-3 h-3 mr-1" />
                        Pausar
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 mr-1" />
                        Ativar
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteBot(bot.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <p className="text-xs text-gray-400">
                  Criado em {bot.createdAt.toLocaleDateString('pt-BR')}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

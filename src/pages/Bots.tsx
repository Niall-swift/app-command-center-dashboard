
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Bot, Trash2, Edit } from 'lucide-react';
import type { Bot } from '@/types/dashboard';

export default function Bots() {
  const [bots, setBots] = useState<Bot[]>([
    {
      id: '1',
      name: 'Bot de Atendimento',
      description: 'Bot para atendimento básico ao cliente',
      status: 'active',
      createdAt: new Date(Date.now() - 86400000),
      commands: ['/ajuda', '/suporte', '/contato']
    },
    {
      id: '2',
      name: 'Bot de FAQ',
      description: 'Responde perguntas frequentes automaticamente',
      status: 'active',
      createdAt: new Date(Date.now() - 172800000),
      commands: ['/faq', '/duvidas', '/info']
    }
  ]);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    commands: ''
  });

  const handleCreateBot = () => {
    if (formData.name && formData.description) {
      const newBot: Bot = {
        id: Date.now().toString(),
        name: formData.name,
        description: formData.description,
        status: 'active',
        createdAt: new Date(),
        commands: formData.commands.split(',').map(cmd => cmd.trim()).filter(cmd => cmd)
      };
      setBots([...bots, newBot]);
      setFormData({ name: '', description: '', commands: '' });
      setShowForm(false);
    }
  };

  const toggleBotStatus = (botId: string) => {
    setBots(bots.map(bot => 
      bot.id === botId 
        ? { ...bot, status: bot.status === 'active' ? 'inactive' : 'active' }
        : bot
    ));
  };

  const deleteBot = (botId: string) => {
    setBots(bots.filter(bot => bot.id !== botId));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gerenciar Bots</h2>
          <p className="text-gray-600">Crie e configure bots para seu aplicativo</p>
        </div>
        <Button 
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Bot
        </Button>
      </div>

      {showForm && (
        <Card className="bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Criar Novo Bot</CardTitle>
            <CardDescription>Configure as informações básicas do seu bot</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="bot-name">Nome do Bot</Label>
              <Input
                id="bot-name"
                placeholder="Ex: Bot de Vendas"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            
            <div>
              <Label htmlFor="bot-description">Descrição</Label>
              <Textarea
                id="bot-description"
                placeholder="Descreva a função do bot..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            
            <div>
              <Label htmlFor="bot-commands">Comandos (separados por vírgula)</Label>
              <Input
                id="bot-commands"
                placeholder="/vendas, /promocoes, /produtos"
                value={formData.commands}
                onChange={(e) => setFormData({ ...formData, commands: e.target.value })}
              />
            </div>
            
            <div className="flex gap-2">
              <Button onClick={handleCreateBot} className="bg-blue-600 hover:bg-blue-700">
                Criar Bot
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6">
        {bots.map((bot) => (
          <Card key={bot.id} className="bg-white shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Bot className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold text-gray-900">
                      {bot.name}
                    </CardTitle>
                    <CardDescription>{bot.description}</CardDescription>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Badge className={bot.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                    {bot.status === 'active' ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Comandos disponíveis:</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {bot.commands.map((command, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {command}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="text-sm text-gray-500">
                    Criado em {bot.createdAt.toLocaleDateString('pt-BR')}
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={bot.status === 'active'}
                        onCheckedChange={() => toggleBotStatus(bot.id)}
                      />
                      <Label className="text-sm">
                        {bot.status === 'active' ? 'Ativo' : 'Inativo'}
                      </Label>
                    </div>
                    
                    <Button variant="outline" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                    
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => deleteBot(bot.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

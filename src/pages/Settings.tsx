import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings2, Plus, Trash2, MessageSquare, Users, UserPlus, Bot, Power } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PageTransition from '@/components/PageTransition';
import { db } from '@/config/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Switch } from '@/components/ui/switch';
import { Label as LabelUI } from '@/components/ui/label';

interface CustomMessage {
  id: string;
  title: string;
  content: string;
}

interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: 'tecnico' | 'atendente';
  status: 'ativo' | 'inativo';
  createdAt: string;
}

export default function Settings() {
  const [customMessages, setCustomMessages] = useState<CustomMessage[]>([
    {
      id: '1',
      title: 'Boas vindas',
      content: 'Olá {nome}! Seja bem-vindo ao nosso atendimento. Como posso ajudá-lo hoje?'
    },
    {
      id: '2',
      title: 'Verificação',
      content: '{nome}, vou verificar essa informação para você. Por favor, aguarde um momento.'
    }
  ]);

  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([
    {
      id: '1',
      name: 'João Silva',
      email: 'joao@empresa.com',
      role: 'tecnico',
      status: 'ativo',
      createdAt: '2024-01-15'
    },
    {
      id: '2',
      name: 'Maria Santos',
      email: 'maria@empresa.com',
      role: 'atendente',
      status: 'ativo',
      createdAt: '2024-01-10'
    }
  ]);

  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Estados para adicionar usuário
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'tecnico' | 'atendente'>('atendente');
  const [isAddingUser, setIsAddingUser] = useState(false);

  // Estado do Robô WhatsApp
  const [botActive, setBotActive] = useState<boolean | null>(null);

  React.useEffect(() => {
    const unsub = onSnapshot(doc(db, "bot_config", "global"), (snap) => {
      if (snap.exists()) {
        setBotActive(snap.data().active);
      } else {
        setBotActive(false);
      }
    });
    return () => unsub();
  }, []);

  const handleToggleBot = async (checked: boolean) => {
    try {
      await setDoc(doc(db, "bot_config", "global"), {
        active: checked,
        last_update: new Date()
      }, { merge: true });
    } catch (error) {
      console.error("Erro ao atualizar status do robô:", error);
    }
  };

  const handleAddMessage = () => {
    if (newTitle.trim() && newContent.trim()) {
      const newMessage: CustomMessage = {
        id: Date.now().toString(),
        title: newTitle,
        content: newContent
      };
      setCustomMessages([...customMessages, newMessage]);
      setNewTitle('');
      setNewContent('');
      setIsAdding(false);
    }
  };

  const handleDeleteMessage = (id: string) => {
    setCustomMessages(customMessages.filter(msg => msg.id !== id));
  };

  const handleAddUser = () => {
    if (newUserName.trim() && newUserEmail.trim()) {
      const newUser: TeamUser = {
        id: Date.now().toString(),
        name: newUserName,
        email: newUserEmail,
        role: newUserRole,
        status: 'ativo',
        createdAt: new Date().toISOString().split('T')[0]
      };
      setTeamUsers([...teamUsers, newUser]);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserRole('atendente');
      setIsAddingUser(false);
    }
  };

  const handleDeleteUser = (id: string) => {
    setTeamUsers(teamUsers.filter(user => user.id !== id));
  };

  const toggleUserStatus = (id: string) => {
    setTeamUsers(teamUsers.map(user => 
      user.id === id 
        ? { ...user, status: user.status === 'ativo' ? 'inativo' : 'ativo' as 'ativo' | 'inativo' }
        : user
    ));
  };

  const getRoleBadgeColor = (role: string) => {
    return role === 'tecnico' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
  };

  const getStatusBadgeColor = (status: string) => {
    return status === 'ativo' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
  };

  const messageVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: {
        duration: 0.3,
        ease: "easeOut"
      }
    },
    exit: { 
      opacity: 0, 
      y: -20, 
      scale: 0.95,
      transition: {
        duration: 0.2
      }
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Settings2 className="w-8 h-8 text-blue-600" />
            Configurações
          </h1>
          <p className="text-gray-600 mt-2">Gerencie suas configurações e equipe</p>
        </motion.div>

        {/* Seção de Configuração do Robô */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Card className={`border-2 transition-all duration-300 ${botActive ? 'border-green-500/50 shadow-lg shadow-green-500/5' : 'border-gray-200 shadow-sm'}`}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${botActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Assistente Virtual (Bot WhatsApp)</h3>
                    <p className="text-sm font-normal text-muted-foreground">Controle a ativação do atendimento automático</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-secondary/20 p-2 rounded-full px-4 border">
                  <span className={`text-xs font-bold uppercase ${botActive ? 'text-green-600' : 'text-gray-500'}`}>
                    {botActive === null ? 'Carregando...' : botActive ? 'Ligado' : 'Desligado'}
                  </span>
                  <Switch 
                    checked={botActive || false} 
                    onCheckedChange={handleToggleBot}
                    disabled={botActive === null}
                  />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-secondary/10 border border-secondary/20 flex items-start gap-4">
                  <div className="p-2 rounded-full bg-blue-100 text-blue-600">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Saudação Ativa</p>
                    <p className="text-xs text-muted-foreground italic">"Olá [Nome]! Como posso te ajudar hoje?"</p>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-secondary/10 border border-secondary/20 flex items-start gap-4">
                  <div className="p-2 rounded-full bg-purple-100 text-purple-600">
                    <Power className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Comandos de Emergência</p>
                    <p className="text-xs text-muted-foreground">Use #robo:desligar no WhatsApp para desativar remotamente.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Seção de Gerenciamento de Usuários */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card className="bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Gerenciamento de Usuários da Equipe
                </div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    onClick={() => setIsAddingUser(!isAddingUser)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Adicionar Usuário
                  </Button>
                </motion.div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <AnimatePresence>
                {isAddingUser && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                  >
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nome Completo
                          </label>
                          <Input
                            value={newUserName}
                            onChange={(e) => setNewUserName(e.target.value)}
                            placeholder="Ex: João Silva"
                            className="w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            E-mail
                          </label>
                          <Input
                            type="email"
                            value={newUserEmail}
                            onChange={(e) => setNewUserEmail(e.target.value)}
                            placeholder="joao@empresa.com"
                            className="w-full"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Função
                        </label>
                        <Select value={newUserRole} onValueChange={(value: 'tecnico' | 'atendente') => setNewUserRole(value)}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecione a função" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="atendente">Atendente</SelectItem>
                            <SelectItem value="tecnico">Técnico</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2">
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                          <Button onClick={handleAddUser} size="sm">
                            Salvar Usuário
                          </Button>
                        </motion.div>
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                          <Button 
                            onClick={() => setIsAddingUser(false)} 
                            variant="outline" 
                            size="sm"
                          >
                            Cancelar
                          </Button>
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-3"
              >
                <AnimatePresence>
                  {teamUsers.map((user) => (
                    <motion.div
                      key={user.id}
                      variants={messageVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      layout
                      className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-medium text-gray-900">{user.name}</h4>
                            <Badge className={getRoleBadgeColor(user.role)}>
                              {user.role === 'tecnico' ? 'Técnico' : 'Atendente'}
                            </Badge>
                            <Badge className={getStatusBadgeColor(user.status)}>
                              {user.status === 'ativo' ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <p><strong>E-mail:</strong> {user.email}</p>
                            <p><strong>Cadastrado em:</strong> {new Date(user.createdAt).toLocaleDateString('pt-BR')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                            <Button
                              onClick={() => toggleUserStatus(user.id)}
                              variant="outline"
                              size="sm"
                              className={user.status === 'ativo' ? 'text-orange-600 hover:text-orange-700' : 'text-green-600 hover:text-green-700'}
                            >
                              {user.status === 'ativo' ? 'Desativar' : 'Ativar'}
                            </Button>
                          </motion.div>
                          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                            <Button
                              onClick={() => handleDeleteUser(user.id)}
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </motion.div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>

              {teamUsers.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8 text-gray-500"
                >
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>Nenhum usuário cadastrado</p>
                  <p className="text-sm">Clique em "Adicionar Usuário" para começar</p>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Seção de Mensagens Rápidas */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Mensagens Rápidas Personalizadas
                </div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    onClick={() => setIsAdding(!isAdding)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Mensagem
                  </Button>
                </motion.div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <AnimatePresence>
                {isAdding && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                  >
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Título da Mensagem
                        </label>
                        <Input
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          placeholder="Ex: Saudação personalizada"
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Conteúdo da Mensagem
                        </label>
                        <Textarea
                          value={newContent}
                          onChange={(e) => setNewContent(e.target.value)}
                          placeholder="Use {nome} para inserir o nome do cliente automaticamente"
                          rows={3}
                          className="w-full"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Dica: Use {"{nome}"} para inserir automaticamente o nome do cliente
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                          <Button onClick={handleAddMessage} size="sm">
                            Salvar
                          </Button>
                        </motion.div>
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                          <Button 
                            onClick={() => setIsAdding(false)} 
                            variant="outline" 
                            size="sm"
                          >
                            Cancelar
                          </Button>
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-3"
              >
                <AnimatePresence>
                  {customMessages.map((message) => (
                    <motion.div
                      key={message.id}
                      variants={messageVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      layout
                      className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium text-gray-900">{message.title}</h4>
                            <Badge variant="secondary" className="text-xs">
                              Personalizada
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded border">
                            {message.content}
                          </p>
                        </div>
                        <motion.div
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <Button
                            onClick={() => handleDeleteMessage(message.id)}
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 ml-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </motion.div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>

              {customMessages.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8 text-gray-500"
                >
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>Nenhuma mensagem personalizada cadastrada</p>
                  <p className="text-sm">Clique em "Nova Mensagem" para começar</p>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </PageTransition>
  );
}

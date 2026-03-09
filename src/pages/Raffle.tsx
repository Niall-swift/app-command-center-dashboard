
import React, { useState, useEffect} from 'react';
import PageTransition from '@/components/PageTransition';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Gift, Trophy, Sparkles, Send, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ClientList from '@/components/raffle/ClientList';
import RaffleAnimation from '@/components/raffle/RaffleAnimation';
import WinnerCard from '@/components/raffle/WinnerCard';
import type { Client } from '@/types/dashboard';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useToast } from '@/hooks/use-toast';
import { whapiService } from '@/services/whapi/whapiService';
import { fillTemplate, getTemplateForGroup } from '@/services/whapi/messageTemplates';
import type { WhapiBulkRecipient, WhapiSendProgress, WhapiSendLog } from '@/types/whapi';

// Mock data for clients with additional fields

const prizes = [
  "cafeteira eletrica ",
  "liquidificador ",
  "batedeira ",
  "chaleira eletrica ",
  "air fryer ",
  "microondas ",
  "smart tv 32 ",
  "soundbar ",
  "caixa de som bluetooth ",
  "kit de ferramentas ",
  "prancha de cabelo ",
  "kit de maquiagem ",
  "ventilador ",
  "batedeira ",
  "micro-ondas ",
  "pix de R$200,00 ",
  "PIZZA",
  "COMBO PIZZA",
  "COMBO KERU+",
  "fone de ouvido bluetooth",
  "sanduicheira",
  "Manicure e pedicure - studio elaine moraes"
];

export default function Raffle() {
  const { toast } = useToast();
  const [selectedClients, setSelectedClients] = useState<Client[]>([]);
  const [isRaffling, setIsRaffling] = useState(false);
  const [winner, setWinner] = useState<Client | null>(null);
  const [selectedPrize, setSelectedPrize] = useState(prizes[0]);
  const [showWinnerCard, setShowWinnerCard] = useState(false);
  const [usersPremix, setUsersPremix] = useState<Client[]>([]);
  const [winnerProfilePic, setWinnerProfilePic] = useState<string | null>(null);
  const [isFetchingProfilePic, setIsFetchingProfilePic] = useState(false);

  // Estados para envio WhatsApp
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<WhapiSendProgress | null>(null);
  const [logs, setLogs] = useState<WhapiSendLog[]>([]);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewMessage, setPreviewMessage] = useState<string>('');


   useEffect(() => {
     const fetchClients = async () => {
       try {
         const querySnapshot = await getDocs(collection(db, 'usuariosDoPreMix'));
         const users = querySnapshot.docs.map(doc => {
           const data = doc.data();
           return {
             id: doc.id,
             name: data.name || data.nome,
             phone: data.whatsapp || '',
             cep: data.cep || '',
             cpf: data.cpf || '',
             instagram: data.instagram || '',
             avatar: data.imageUrl || '',
             address: data.address || '',
             city: data.city || '',
             state: data.state || '',
             lastMessage: '',
             lastMessageTime: new Date(),
             unreadCount: 0,
             isOnline: false,
           } as Client;
         });
         setUsersPremix(users);
       } catch (error) {
         console.error('Erro ao buscar usuários do Firebase:', error);
         // Fallback para dados mock
         const mockUsers: Client[] = [
           {
             id: '1',
             name: 'João Silva',
             phone: '5511999999999',
             cep: '01234567',
             cpf: '12345678901',
             instagram: 'joao_silva',
             avatar: '',
             address: 'Rua das Flores, 123',
             city: 'São Paulo',
             state: 'SP',
             lastMessage: '',
             lastMessageTime: new Date(),
             unreadCount: 0,
             isOnline: false,
           },
           {
             id: '2',
             name: 'Maria Santos',
             phone: '5511988888888',
             cep: '01234567',
             cpf: '12345678902',
             instagram: 'maria_santos',
             avatar: '',
             address: 'Av. Paulista, 456',
             city: 'São Paulo',
             state: 'SP',
             lastMessage: '',
             lastMessageTime: new Date(),
             unreadCount: 0,
             isOnline: false,
           },
           {
             id: '3',
             name: 'Pedro Oliveira',
             phone: '5511977777777',
             cep: '01234567',
             cpf: '12345678903',
             instagram: 'pedro_oliveira',
             avatar: '',
             address: 'Rua do Comércio, 789',
             city: 'Rio de Janeiro',
             state: 'RJ',
             lastMessage: '',
             lastMessageTime: new Date(),
             unreadCount: 0,
             isOnline: false,
           },
         ];
         setUsersPremix(mockUsers);
       }
     };
     fetchClients();
   }, []);

  const handleClientToggle = (client: Client) => {
    setSelectedClients(prev => {
      const isSelected = prev.some(c => c.id === client.id);
      if (isSelected) {
        return prev.filter(c => c.id !== client.id);
      } else {
        return [...prev, client];
      }
    });
  };

  const handleSelectAll = () => {
    setSelectedClients(usersPremix);
  };

  const handleDeselectAll = () => {
    setSelectedClients([]);
  };

  const handleDeleteClient = (client: Client) => {
    // Remove da lista principal
    setUsersPremix(prev => prev.filter(c => c.id !== client.id));
    // Remove da seleção se estiver selecionado
    setSelectedClients(prev => prev.filter(c => c.id !== client.id));
  };

  const handleRaffle = () => {
    if (selectedClients.length === 0) return;
    
    setIsRaffling(true);
    setWinner(null);
    setShowWinnerCard(false);
    setWinnerProfilePic(null);
    
    // Simular sorteio com delay
    setTimeout(async () => {
      const randomIndex = Math.floor(Math.random() * selectedClients.length);
      const winnerClient = selectedClients[randomIndex];
      setWinner(winnerClient);
      setIsRaffling(false);

      // Buscar foto de perfil do WhatsApp do vencedor
      if (winnerClient.phone) {
        setIsFetchingProfilePic(true);
        try {
          const profilePic = await whapiService.getContactProfilePicture(winnerClient.phone);
          setWinnerProfilePic(profilePic);
        } catch (err) {
          console.warn('Não foi possível buscar a foto de perfil:', err);
        } finally {
          setIsFetchingProfilePic(false);
        }
      }
      
      // Mostrar card após animação
      setTimeout(() => {
        setShowWinnerCard(true);
      }, 1000);
    }, 3000);
  };

  const resetRaffle = () => {
    setWinner(null);
    setShowWinnerCard(false);
    setSelectedClients([]);
    setWinnerProfilePic(null);
    setIsFetchingProfilePic(false);
  };

  // Função para abrir preview de mensagem
  const handlePreviewWhatsApp = () => {
    if (selectedClients.length === 0) {
      toast({
        title: 'Nenhum cliente selecionado',
        description: 'Selecione pelo menos um participante para enviar mensagens.',
        variant: 'destructive',
      });
      return;
    }

    // Gerar preview com o primeiro cliente
    const firstClient = selectedClients[0];
    const template = getTemplateForGroup('premix_welcome');
    const messageBody = fillTemplate(template, {
      nome: firstClient.name,
    });
    
    setPreviewMessage(messageBody);
    setShowPreviewDialog(true);
  };

  // Função para confirmar e enviar mensagens
  const confirmSendWhatsApp = async () => {
    setShowPreviewDialog(false);
    setSending(true);
    setProgress({ total: selectedClients.length, sent: 0, failed: 0 });
    setLogs([]);

    try {
      // Converter Client[] para WhapiBulkRecipient[]
      const recipients: WhapiBulkRecipient[] = selectedClients
        .filter(client => client.phone) // Apenas clientes com telefone
        .map(client => ({
          clienteId: client.id,
          nome: client.name,
          telefone: client.phone,
          fatura: {
            id: '',
            valor: 0,
            dataVencimento: '',
            diasAtraso: 0,
            linkBoleto: '',
          },
        }));

      if (recipients.length === 0) {
        toast({
          title: 'Nenhum telefone válido',
          description: 'Nenhum dos clientes selecionados possui telefone cadastrado.',
          variant: 'destructive',
        });
        setSending(false);
        setProgress(null);
        return;
      }

      const groupLogs = await whapiService.sendBulkMessages(
        recipients,
        'premix_welcome',
        (prog) => setProgress(prog),
        (log) => setLogs((prev) => [...prev, log])
      );

      toast({
        title: 'Envio concluído',
        description: `${groupLogs.filter((l) => l.status === 'success').length} mensagens enviadas com sucesso`,
      });
    } catch (error) {
      toast({
        title: 'Erro no envio',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
      setProgress(null);
    }
  };

  console.log('Raffle rendering', usersPremix.length);
  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Gift className="w-8 h-8 text-purple-600" />
            </motion.div>
            <h1 className="text-3xl font-bold text-gray-900">Sorteio de Prêmios</h1>
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Sparkles className="w-8 h-8 text-yellow-500" />
            </motion.div>
          </div>
          <p className="text-gray-600">Selecione os participantes e realize o sorteio!</p>
        </motion.div>

        {/* Prize Selection */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-700">
                <Trophy className="w-5 h-5" />
                Prêmio do Sorteio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <select
                value={selectedPrize}
                onChange={(e) => setSelectedPrize(e.target.value)}
                className="w-full p-3 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {prizes.map((prize) => (
                  <option key={prize} value={prize}>{prize}</option>
                ))}
              </select>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Client List */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <ClientList
              clients={usersPremix}
              selectedClients={selectedClients}
              onClientToggle={handleClientToggle}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
              onDeleteClient={handleDeleteClient}
            />
          </motion.div>

          {/* Raffle Area */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="space-y-6"
          >
            {/* Raffle Button */}
            <Card className="bg-white shadow-lg">
              <CardContent className="p-6 text-center">
                <div className="mb-4">
                  <p className="text-gray-600 mb-2">
                    {selectedClients.length} participantes selecionados
                  </p>
                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={handleRaffle}
                      disabled={selectedClients.length === 0 || isRaffling}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-3 text-lg font-semibold shadow-lg transform transition-all duration-200 hover:scale-105"
                      size="lg"
                    >
                      {isRaffling ? 'Sorteando...' : 'Realizar Sorteio'}
                    </Button>
                    
                    <Button
                      onClick={handlePreviewWhatsApp}
                      disabled={selectedClients.length === 0 || sending}
                      variant="outline"
                      className="border-green-500 text-green-600 hover:bg-green-50"
                      size="lg"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {sending ? 'Enviando...' : 'Enviar Mensagens de Boas-Vindas'}
                    </Button>
                  </div>
                </div>
                
                {winner && (
                  <Button
                    onClick={resetRaffle}
                    variant="outline"
                    className="mt-3"
                  >
                    Novo Sorteio
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Raffle Animation */}
            {(isRaffling || winner) && (
              <RaffleAnimation
                isRaffling={isRaffling}
                winner={winner}
                selectedClients={selectedClients}
              />
            )}
          </motion.div>
        </div>

        {/* Progresso de Envio */}
        {progress && (
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 animate-spin text-primary" />
                Enviando mensagens...
              </CardTitle>
              <CardDescription>
                <strong>IMPORTANTE:</strong> Não feche esta aba enquanto o envio estiver em andamento.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2 font-medium">
                  <span>Progresso</span>
                  <span>
                    {progress.sent} / {progress.total}
                  </span>
                </div>
                <Progress value={(progress.sent / progress.total) * 100} className="h-2" />
              </div>
              {progress.current && (
                <p className="text-sm text-foreground/80">
                  Atividade atual: <span className="font-semibold">{progress.current}</span>
                </p>
              )}
              <div className="flex gap-4 text-sm font-medium">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  {progress.sent - progress.failed} enviadas
                </span>
                <span className="flex items-center gap-1 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  {progress.failed} falhas
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Logs */}
        {logs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Logs de Envio</CardTitle>
              <CardDescription>Últimas {logs.length} mensagens</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {logs.slice(-20).reverse().map((log, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-md border ${
                      log.status === 'success' ? 'bg-green-50/50 border-green-100' : 'bg-red-50/50 border-red-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {log.status === 'success' ? (
                        <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                      )}
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{log.clienteNome}</span>
                        <span className="text-xs text-muted-foreground">{log.telefone}</span>
                      </div>
                    </div>
                    {log.error && (
                      <span className="text-xs text-red-600 font-medium">{log.error}</span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Winner Card */}
        {showWinnerCard && winner && (
          <WinnerCard
            winner={winner}
            prize={selectedPrize}
            winnerProfilePic={winnerProfilePic}
            isFetchingProfilePic={isFetchingProfilePic}
            onClose={() => setShowWinnerCard(false)}
          />
        )}
      </div>

      {/* Dialog de Preview */}
      <Dialog open={showPreviewDialog} onOpenChange={(open) => !open && setShowPreviewDialog(false)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirmar Envio ({selectedClients.length} participantes)</DialogTitle>
            <DialogDescription>
              Mensagens de Boas-Vindas ao Pre-Mix
            </DialogDescription>
          </DialogHeader>

          <div className="bg-muted p-4 rounded-md">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Modelo da Mensagem (Exemplo):</h4>
            <pre className="whitespace-pre-wrap text-sm font-sans text-foreground/90 leading-relaxed max-h-64 overflow-y-auto">
              {previewMessage}
            </pre>
          </div>

          <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
            <h4 className="text-sm font-medium mb-2">Lista de Destinatários:</h4>
            <div className="space-y-1">
              {selectedClients.map((client, idx) => (
                <div key={`${client.id}-${idx}`} className="flex items-center justify-between text-sm p-2 hover:bg-muted rounded">
                  <div className="flex flex-col">
                    <span className="font-medium">{client.name}</span>
                    <span className="text-xs text-muted-foreground">{client.phone || 'Sem telefone'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>Cancelar</Button>
            <Button onClick={confirmSendWhatsApp} className="gap-2">
              <Send className="h-4 w-4" />
              Confirmar e Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}


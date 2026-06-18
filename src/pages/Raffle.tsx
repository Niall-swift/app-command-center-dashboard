import React, { useState, useEffect} from 'react';
import PageTransition from '@/components/PageTransition';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gift, Trophy, Sparkles, Send, CheckCircle, AlertCircle, Clock, Plus, Trash2, Calendar, DollarSign, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import ClientList from '@/components/raffle/ClientList';
import RaffleAnimation from '@/components/raffle/RaffleAnimation';
import WinnerCard from '@/components/raffle/WinnerCard';
import type { Client } from '@/types/dashboard';
import { collection, getDocs, deleteDoc, doc, onSnapshot, query, orderBy, setDoc, updateDoc, addDoc, serverTimestamp, where } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useToast } from '@/hooks/use-toast';
import { whapiService } from '@/services/whapi/whapiService';
import { fillTemplate, getTemplateForGroup } from '@/services/whapi/messageTemplates';
import type { WhapiBulkRecipient, WhapiSendProgress, WhapiSendLog } from '@/types/whapi';
import { preMixService, Raffle as RaffleType, Winner } from '@/services/preMixService';

const prizes = [
  "Mensalidade Grátis",
  "Roteador Gigabit",
  "Brinde Exclusivo AVL"
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

  // Gestão de Sorteios Dinâmicos
  const [dynamicRaffles, setDynamicRaffles] = useState<RaffleType[]>([]);
  const [newRaffle, setNewRaffle] = useState({ title: '', status: 'SORTEIO ATIVO', value: 'Grátis para Membros', date: '', icon: 'gift' });
  const [isAddingRaffle, setIsAddingRaffle] = useState(false);

  // Controle de Acesso Seguro (Senha 150820)
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('raffle_secured_auth') === 'true';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isShaking, setIsShaking] = useState(false);

  // Controle de Ganhadores Repetidos
  const [pastWinners, setPastWinners] = useState<Winner[]>([]);
  const [excludePastWinners, setExcludePastWinners] = useState(true);

  // Estados para envio WhatsApp
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<WhapiSendProgress | null>(null);
  const [logs, setLogs] = useState<WhapiSendLog[]>([]);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewMessage, setPreviewMessage] = useState<string>('');

  // Estados da Roleta da Sorte
  const [rouletteActive, setRouletteActive] = useState(false);
  const [rouletteItems, setRouletteItems] = useState<any[]>([]);
  const [rouletteWins, setRouletteWins] = useState<any[]>([]);
  const [newRouletteItem, setNewRouletteItem] = useState({
    name: '',
    quantity: 10,
    probability: 10,
    color: '#4338FF',
    icon: 'gift-outline'
  });

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'usuariosDoPreMix'));
        const users = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || data.nome,
            phone: data.whatsapp || data.telefone || data.celular || data.telefone_celular || '',
            cep: data.cep || '',
            cpf: data.cpf || '',
            instagram: data.instagram || '',
            avatar: data.imageUrl || '',
            address: data.address || '',
            bairro: data.bairro || data.neighborhood || '',
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
      }
    };

    const fetchWinners = async () => {
      try {
        const winnersData = await preMixService.getWinners();
        setPastWinners(winnersData);
      } catch (error) {
        console.error('Erro ao buscar vencedores do Firestore:', error);
      }
    };

    fetchClients();
    fetchWinners();

     // Listener para sorteios dinâmicos
    const q = query(collection(db, 'sorteiosPreMix'), orderBy('createdAt', 'desc'));
    const unsubscribeRaffles = onSnapshot(q, (snapshot) => {
      const raffles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RaffleType));
      setDynamicRaffles(raffles);
      
      // Seleciona o primeiro sorteio ativo por padrão se nada foi selecionado ainda
      const activeRaffle = raffles.find(r => r.status === "SORTEIO ATIVO");
      if (activeRaffle) {
        setSelectedPrize(prev => prev || activeRaffle.title);
      }
    });

    // Listeners da Roleta da Sorte
    const unsubscribeRouletteConfig = onSnapshot(doc(db, 'configs', 'pre_mix_roulette'), (docSnap) => {
      if (docSnap.exists()) {
        setRouletteActive(docSnap.data().active || false);
      } else {
        setRouletteActive(false);
      }
    });

    const qItems = query(collection(db, 'pre_mix_roulette_items'), orderBy('name', 'asc'));
    const unsubscribeRouletteItems = onSnapshot(qItems, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRouletteItems(items);
    });

    const qWins = query(collection(db, 'pre_mix_roulette_wins'), orderBy('createdAt', 'desc'));
    const unsubscribeRouletteWins = onSnapshot(qWins, (snapshot) => {
      const wins = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt
        };
      });
      setRouletteWins(wins);
    });

    return () => {
      unsubscribeRaffles();
      unsubscribeRouletteConfig();
      unsubscribeRouletteItems();
      unsubscribeRouletteWins();
    };
  }, []);

  const handleAddRaffle = async () => {
    if (!newRaffle.title || !newRaffle.date) {
      toast({ title: "Erro", description: "Título e Data são obrigatórios.", variant: "destructive" });
      return;
    }
    setIsAddingRaffle(true);
    try {
      await preMixService.addRaffle({
        title: newRaffle.title,
        status: newRaffle.status,
        value: newRaffle.value,
        date: newRaffle.date,
        icon: newRaffle.icon
      });
      toast({ title: "Sucesso", description: "Sorteio adicionado com sucesso!" });
      setNewRaffle({ title: '', status: 'SORTEIO ATIVO', value: 'Grátis para Membros', date: '', icon: 'gift' });
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível adicionar o sorteio.", variant: "destructive" });
    } finally {
      setIsAddingRaffle(false);
    }
  };

  const handleDeleteRaffle = async (id: string) => {
    try {
      await preMixService.deleteRaffle(id);
      toast({ title: "Sucesso", description: "Sorteio removido." });
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao remover sorteio.", variant: "destructive" });
    }
  };

  // Funções controladoras da Roleta da Sorte (Admin)
  const handleToggleRoulette = async (activeState: boolean) => {
    try {
      await setDoc(doc(db, 'configs', 'pre_mix_roulette'), { active: activeState }, { merge: true });
      toast({ 
        title: activeState ? "Roleta Ativada" : "Roleta Desativada", 
        description: activeState ? "Os clientes verão a roleta no aplicativo móvel." : "O aplicativo voltou a exibir o formulário padrão." 
      });
    } catch (err) {
      toast({ title: "Erro", description: "Não foi possível atualizar o estado da roleta.", variant: "destructive" });
    }
  };

  const handleAddRouletteItem = async () => {
    if (!newRouletteItem.name || newRouletteItem.probability <= 0) {
      toast({ title: "Erro", description: "Nome e peso de probabilidade são obrigatórios.", variant: "destructive" });
      return;
    }
    try {
      await addDoc(collection(db, 'pre_mix_roulette_items'), {
        name: newRouletteItem.name,
        quantity: Number(newRouletteItem.quantity),
        probability: Number(newRouletteItem.probability),
        color: newRouletteItem.color,
        icon: newRouletteItem.icon,
        createdAt: serverTimestamp()
      });
      toast({ title: "Sucesso", description: "Item adicionado à roleta com sucesso!" });
      setNewRouletteItem({ name: '', quantity: 10, probability: 10, color: '#4338FF', icon: 'gift-outline' });
    } catch (err) {
      toast({ title: "Erro", description: "Erro ao adicionar item à roleta.", variant: "destructive" });
    }
  };

  const handleDeleteRouletteItem = async (itemId: string) => {
    try {
      await deleteDoc(doc(db, 'pre_mix_roulette_items', itemId));
      toast({ title: "Sucesso", description: "Item removido da roleta." });
    } catch (err) {
      toast({ title: "Erro", description: "Erro ao deletar item.", variant: "destructive" });
    }
  };

  const handleUpdateStock = async (itemId: string, newStock: number) => {
    try {
      await updateDoc(doc(db, 'pre_mix_roulette_items', itemId), { quantity: Number(newStock) });
      toast({ title: "Estoque Atualizado", description: "Estoque alterado com sucesso." });
    } catch (err) {
      toast({ title: "Erro", description: "Erro ao atualizar estoque.", variant: "destructive" });
    }
  };

  const handleDeleteRouletteWin = async (cpfRaw: string) => {
    if (!window.confirm("Tem certeza que deseja remover este ganhador e permitir que ele gire a roleta novamente no aplicativo?")) {
      return;
    }
    try {
      // 1. Deletar log de vitória da roleta
      await deleteDoc(doc(db, 'pre_mix_roulette_wins', cpfRaw));
      
      // 2. Localizar usuário no usuáriosDoPreMix e resetar o status do giro
      const qUser = query(collection(db, 'usuariosDoPreMix'), where('cpfRaw', '==', cpfRaw));
      const querySnapshot = await getDocs(qUser);
      if (!querySnapshot.empty) {
        const userDocRef = querySnapshot.docs[0].ref;
        await updateDoc(userDocRef, {
          hasSpun: false,
          wonPrizeId: null,
          wonPrizeName: null,
          wonPrizeRescueCode: null,
          spunAt: null
        });
      }
      
      toast({ title: "Ganhador Resetado", description: "O prêmio foi removido e o giro do cliente foi reativado com sucesso." });
    } catch (err) {
      console.error("Erro ao deletar vitória da roleta:", err);
      toast({ title: "Erro", description: "Não foi possível resetar o ganhador da roleta.", variant: "destructive" });
    }
  };

  const handleRescueRouletteWin = async (cpfRaw: string) => {
    if (!window.confirm("Deseja marcar este prêmio como RESGATADO? Isso permitirá que o cliente jogue novamente nas próximas roletas.")) {
      return;
    }
    try {
      // 1. Marcar como resgatado no histórico de vitórias
      await updateDoc(doc(db, 'pre_mix_roulette_wins', cpfRaw), {
        redeemed: true,
        redeemedAt: serverTimestamp()
      });
      
      // 2. Localizar usuário no usuáriosDoPreMix e resetar o status do giro
      const qUser = query(collection(db, 'usuariosDoPreMix'), where('cpfRaw', '==', cpfRaw));
      const querySnapshot = await getDocs(qUser);
      if (!querySnapshot.empty) {
        const userDocRef = querySnapshot.docs[0].ref;
        await updateDoc(userDocRef, {
          hasSpun: false,
          wonPrizeId: null,
          wonPrizeName: null,
          wonPrizeRescueCode: null,
          spunAt: null
        });
      }
      
      toast({ title: "Prêmio Resgatado", description: "O prêmio foi marcado como resgatado e o cliente pode participar novamente!" });
    } catch (err) {
      console.error("Erro ao resgatar prêmio da roleta:", err);
      toast({ title: "Erro", description: "Não foi possível resgatar o prêmio.", variant: "destructive" });
    }
  };

  const hasWonRecently = (clientCpf: string, clientName: string) => {
    const cleanCpf = clientCpf?.replace(/\D/g, '');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return pastWinners.some(winner => {
      const isSameCpf = cleanCpf && winner.cpf && cleanCpf === winner.cpf.replace(/\D/g, '');
      const isSameName = !cleanCpf && winner.name?.toLowerCase().trim() === clientName?.toLowerCase().trim();
      
      if (isSameCpf || isSameName) {
        const wonDate = winner.createdAt?.toDate ? winner.createdAt.toDate() : new Date(winner.createdAt);
        return wonDate >= thirtyDaysAgo;
      }
      return false;
    });
  };

  const eligibleClients = usersPremix.filter(client => {
    if (excludePastWinners) {
      return !hasWonRecently(client.cpf, client.name);
    }
    return true;
  });

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
    setSelectedClients(eligibleClients);
  };

  const handleDeselectAll = () => {
    setSelectedClients([]);
  };

  const handleDeleteClient = async (client: Client) => {
    try {
      await deleteDoc(doc(db, 'usuariosDoPreMix', client.id));
      setUsersPremix(prev => prev.filter(c => c.id !== client.id));
      setSelectedClients(prev => prev.filter(c => c.id !== client.id));
      toast({ title: 'Sucesso', description: 'Participante excluído com sucesso.' });
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível excluir o participante.', variant: 'destructive' });
    }
  };

  const handleRaffle = () => {
    if (selectedClients.length === 0) return;
    setIsRaffling(true);
    setWinner(null);
    setShowWinnerCard(false);
    setWinnerProfilePic(null);
    
    setTimeout(async () => {
      const randomIndex = Math.floor(Math.random() * selectedClients.length);
      const winnerClient = selectedClients[randomIndex];
      setWinner(winnerClient);
      setIsRaffling(false);

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

      try {
        const rescueCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const winnerPrize = selectedPrize || prizes[0] || 'Prêmio Pre-Mix';
        await preMixService.saveWinner({
          cpf: winnerClient.cpf,
          name: winnerClient.name,
          phone: winnerClient.phone || '',
          prize: winnerPrize,
          rescueCode: rescueCode
        });
        toast({ title: 'Vencedor Registrado!', description: `Código de resgate: ${rescueCode}` });
        
        // Adiciona à lista local para filtrar imediatamente
        setPastWinners(prev => [
          {
            id: '',
            cpf: winnerClient.cpf,
            name: winnerClient.name,
            phone: winnerClient.phone || '',
            prize: winnerPrize,
            rescueCode: rescueCode,
            redeemed: false,
            createdAt: new Date()
          },
          ...prev
        ]);
        
        // Remove do grupo selecionado
        setSelectedClients(prev => prev.filter(c => c.id !== winnerClient.id));
      } catch (error) {
        toast({ title: 'Erro ao Registrar', variant: 'destructive' });
      }
      
      setTimeout(() => setShowWinnerCard(true), 1000);
    }, 3000);
  };

  const resetRaffle = () => {
    setWinner(null);
    setShowWinnerCard(false);
    setSelectedClients([]);
    setWinnerProfilePic(null);
  };

  const handlePreviewWhatsApp = () => {
    if (selectedClients.length === 0) {
      toast({ title: 'Nenhum cliente selecionado', variant: 'destructive' });
      return;
    }
    const firstClient = selectedClients[0];
    const template = getTemplateForGroup('premix_welcome');
    setPreviewMessage(fillTemplate(template, { nome: firstClient.name }));
    setShowPreviewDialog(true);
  };

  const confirmSendWhatsApp = async () => {
    setShowPreviewDialog(false);
    setSending(true);
    setProgress({ total: selectedClients.length, sent: 0, failed: 0 });
    setLogs([]);

    try {
      const recipients: WhapiBulkRecipient[] = selectedClients
        .filter(client => client.phone)
        .map(client => ({
          clienteId: client.id,
          nome: client.name,
          telefone: client.phone,
          fatura: { id: '', valor: 0, dataVencimento: '', diasAtraso: 0, linkBoleto: '' },
        }));

      if (recipients.length === 0) {
        toast({ title: 'Nenhum telefone válido', variant: 'destructive' });
        setSending(false);
        return;
      }

      await whapiService.sendBulkMessages(
        recipients,
        'premix_welcome',
        (prog) => setProgress(prog),
        (log) => setLogs((prev) => [...prev, log])
      );
      toast({ title: 'Envio concluído' });
    } catch (error) {
      toast({ title: 'Erro no envio', variant: 'destructive' });
    } finally {
      setSending(false);
      setProgress(null);
    }
  };

  const handleVerifyPassword = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Ofuscação simples usando Base64. A senha correta é "150820"
    if (btoa(passwordInput) === "MTUwODIw") {
      sessionStorage.setItem('raffle_secured_auth', 'true');
      setIsAuthenticated(true);
      setPasswordError('');
      toast({
        title: 'Acesso Autorizado',
        description: 'Bem-vindo ao Command Center de Sorteios Pre-Mix.',
      });
    } else {
      setIsShaking(true);
      setPasswordError('Senha incorreta! Acesso negado.');
      setPasswordInput('');
      setTimeout(() => setIsShaking(false), 500);
      toast({
        title: 'Erro de Acesso',
        description: 'Senha de 6 dígitos inválida.',
        variant: 'destructive',
      });
    }
  };

  if (!isAuthenticated) {
    return (
      <PageTransition>
        <div className="min-h-[70vh] flex items-center justify-center p-4">
          <motion.div
            animate={isShaking ? { x: [-10, 10, -10, 10, 0] } : {}}
            transition={{ duration: 0.4 }}
            className="w-full max-w-md bg-gradient-to-b from-[#080A09] to-[#010201] border-2 border-emerald-500/30 rounded-3xl p-8 text-center shadow-2xl relative"
          >
            {/* Glowing lock badge */}
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
              <Lock className="w-8 h-8 text-emerald-500 animate-pulse" />
            </div>

            <h2 className="text-2xl font-black text-white tracking-wider mb-2">
              ACESSO RESTRITO
            </h2>
            <p className="text-sm text-gray-400 mb-8 max-w-xs mx-auto">
              Digite a senha de 6 dígitos para acessar a Central de Sorteios Pre-Mix.
            </p>

            <form onSubmit={handleVerifyPassword} className="space-y-6">
              <div className="relative">
                <input
                  type="password"
                  maxLength={6}
                  value={passwordInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setPasswordInput(val);
                    if (val.length === 6) {
                      setTimeout(() => {
                        if (btoa(val) === "MTUwODIw") {
                          sessionStorage.setItem('raffle_secured_auth', 'true');
                          setIsAuthenticated(true);
                          setPasswordError('');
                          toast({
                            title: 'Acesso Autorizado',
                            description: 'Bem-vindo ao Command Center de Sorteios Pre-Mix.',
                          });
                        } else {
                          setIsShaking(true);
                          setPasswordError('Senha incorreta! Acesso negado.');
                          setPasswordInput('');
                          setTimeout(() => setIsShaking(false), 500);
                          toast({
                            title: 'Erro de Acesso',
                            description: 'Senha de 6 dígitos inválida.',
                            variant: 'destructive',
                          });
                        }
                      }, 200);
                    }
                  }}
                  placeholder="••••••"
                  className="w-full bg-black/60 border-2 border-emerald-500/20 focus:border-emerald-500 text-center text-3xl tracking-[0.5em] font-bold py-4 rounded-2xl text-white placeholder-gray-700 focus:outline-none transition-all focus:shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                  autoFocus
                />
              </div>

              {passwordError && (
                <motion.p 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs font-bold text-red-500 uppercase tracking-wider"
                >
                  {passwordError}
                </motion.p>
              )}

              <Button
                type="submit"
                disabled={passwordInput.length !== 6}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 rounded-xl transition-all shadow-[0_4px_15px_rgba(16,185,129,0.2)] disabled:opacity-50"
              >
                AUTENTICAR ACESSO
              </Button>
            </form>
          </motion.div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <Tabs defaultValue="raffle" className="w-full">
        <div className="flex justify-between items-center mb-6">
          <TabsList className="bg-purple-100 p-1">
            <TabsTrigger value="raffle" className="data-[state=active]:bg-white">Realizar Sorteio</TabsTrigger>
            <TabsTrigger value="manage" className="data-[state=active]:bg-white">Gerenciar Prêmios</TabsTrigger>
            <TabsTrigger value="roulette" className="data-[state=active]:bg-white">Roleta da Sorte</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-3">
             <Trophy className="w-6 h-6 text-yellow-500" />
             <h1 className="text-2xl font-bold text-gray-900">Pre-Mix Central</h1>
          </div>
        </div>

        <TabsContent value="raffle" className="space-y-6">
          {/* Raffle Header */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-4">
            <p className="text-gray-600">Selecione os participantes e realize o sorteio!</p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
               {/* Prize Selection */}
              <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-purple-700 uppercase">
                    <Gift className="w-4 h-4" /> Selecione o Prêmio Atual
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <select
                    value={selectedPrize}
                    onChange={(e) => setSelectedPrize(e.target.value)}
                    className="w-full p-3 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
                  >
                    <optgroup label="Sorteios Agendados">
                      {dynamicRaffles.filter(r => r.status === "SORTEIO ATIVO").map(r => (
                        <option key={r.id} value={r.title}>{r.title}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Prêmios Padrão">
                      {prizes.map((p, index) => <option key={index} value={p}>{p}</option>)}
                    </optgroup>
                  </select>
                </CardContent>
              </Card>

              <div className="flex items-center space-x-2 bg-white p-3 rounded-lg border border-purple-100 mb-3 shadow-sm">
                <input 
                  type="checkbox" 
                  id="exclude-past-winners"
                  checked={excludePastWinners} 
                  onChange={(e) => {
                    setExcludePastWinners(e.target.checked);
                    if (e.target.checked) {
                      setSelectedClients(prev => prev.filter(c => !hasWonRecently(c.cpf, c.name)));
                    }
                  }} 
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
                />
                <label htmlFor="exclude-past-winners" className="text-sm font-semibold text-gray-700 cursor-pointer select-none">
                  🚫 Excluir ganhadores dos últimos 30 dias
                </label>
              </div>

              <ClientList
                clients={eligibleClients}
                selectedClients={selectedClients}
                onClientToggle={handleClientToggle}
                onSelectAll={handleSelectAll}
                onDeselectAll={handleDeselectAll}
                onDeleteClient={handleDeleteClient}
              />
            </div>

            <div className="space-y-6">
              <Card className="bg-white shadow-lg border-purple-100">
                <CardContent className="p-8 text-center">
                  <div className="mb-6">
                    <p className="text-4xl font-black text-purple-600 mb-2">{selectedClients.length}</p>
                    <p className="text-sm text-gray-500 uppercase tracking-widest font-bold">Participantes Selecionados</p>
                  </div>
                  <div className="flex flex-col gap-3">
                    <Button
                      onClick={handleRaffle}
                      disabled={selectedClients.length === 0 || isRaffling}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 h-16 text-xl font-bold shadow-xl"
                    >
                      {isRaffling ? <Clock className="animate-spin mr-2" /> : <Trophy className="mr-2" />}
                      {isRaffling ? 'SORTEANDO...' : 'INICIAR SORTEIO'}
                    </Button>
                    <Button
                      onClick={handlePreviewWhatsApp}
                      disabled={selectedClients.length === 0 || sending}
                      variant="outline"
                      className="border-green-500 text-green-600 hover:bg-green-50 h-12"
                    >
                      <Send className="mr-2 h-4 w-4" /> Enviar Boas-Vindas (WhatsApp)
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {(isRaffling || winner) && (
                <RaffleAnimation isRaffling={isRaffling} winner={winner} selectedClients={selectedClients} />
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="manage" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Form de Adicionar */}
            <Card className="md:col-span-1 h-fit">
              <CardHeader>
                <CardTitle className="text-lg">Adicionar Novo Sorteio</CardTitle>
                <CardDescription>Estes prêmios aparecerão no app dos clientes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Título do Prêmio</Label>
                  <Input placeholder="Ex: iPhone 15 Pro Max" value={newRaffle.title} onChange={(e) => setNewRaffle({...newRaffle, title: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <select className="w-full p-2 border rounded-md" value={newRaffle.status} onChange={(e) => setNewRaffle({...newRaffle, status: e.target.value})}>
                    <option value="SORTEIO ATIVO">Ativo (Verde)</option>
                    <option value="EM BREVE">Em Breve (Cinza)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Valor / Requisito</Label>
                  <Input placeholder="Ex: Grátis para Membros" value={newRaffle.value} onChange={(e) => setNewRaffle({...newRaffle, value: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Data do Sorteio</Label>
                  <Input placeholder="Ex: TODO SÁBADO ou 25/12" value={newRaffle.date} onChange={(e) => setNewRaffle({...newRaffle, date: e.target.value})} />
                </div>
                <Button className="w-full bg-purple-600 hover:bg-purple-700" onClick={handleAddRaffle} disabled={isAddingRaffle}>
                  {isAddingRaffle ? <Clock className="animate-spin w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Cadastrar Sorteio
                </Button>
              </CardContent>
            </Card>

            {/* Lista de Sorteios */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Prêmios Cadastrados</CardTitle>
                <CardDescription>Gerencie o que é exibido no aplicativo.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dynamicRaffles.length === 0 && <p className="text-center text-gray-400 py-10 italic">Nenhum sorteio cadastrado ainda.</p>}
                  {dynamicRaffles.map((raffle) => (
                    <div key={raffle.id} className="flex items-center justify-between p-4 border rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-lg ${raffle.status === 'SORTEIO ATIVO' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          <Gift className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900">{raffle.title}</h4>
                          <div className="flex gap-3 text-xs text-gray-500 mt-1">
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {raffle.date}</span>
                            <span className="flex items-center gap-1 font-semibold text-purple-600"><DollarSign className="w-3 h-3" /> {raffle.value}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={raffle.status === 'SORTEIO ATIVO' ? 'default' : 'secondary'} className={raffle.status === 'SORTEIO ATIVO' ? 'bg-green-500 hover:bg-green-600' : ''}>
                          {raffle.status}
                        </Badge>
                        <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteRaffle(raffle.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="roulette" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Configuração Master e Formulário */}
            <div className="space-y-6 md:col-span-1">
              
              {/* Card Master Switch */}
              <Card className="border-purple-200">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-purple-700">
                    <Sparkles className="w-5 h-5 animate-pulse" /> Status da Roleta
                  </CardTitle>
                  <CardDescription>
                    Ative ou desative o modo Roleta no aplicativo móvel em tempo real.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center py-6 gap-4">
                  <div className="text-center">
                    <Badge className={rouletteActive ? "bg-green-500 hover:bg-green-600 text-lg px-4 py-2" : "bg-gray-400 text-lg px-4 py-2"}>
                      {rouletteActive ? "🟢 ATIVA NO APLICATIVO" : "🔴 DESATIVADA"}
                    </Badge>
                    <p className="text-xs text-gray-500 mt-3">
                      {rouletteActive 
                        ? "Os clientes cadastrados verão a Roleta da Sorte em vez da tela de confirmação clássica." 
                        : "Os clientes verão a tela padrão do Pré-Mix (cadastro/confirmação)."}
                    </p>
                  </div>
                  <Button 
                    className={`w-full font-bold h-12 rounded-xl mt-2 transition-all ${
                      rouletteActive 
                        ? "bg-red-600 hover:bg-red-700 text-white" 
                        : "bg-green-600 hover:bg-green-700 text-white"
                    }`}
                    onClick={() => handleToggleRoulette(!rouletteActive)}
                  >
                    {rouletteActive ? "Desativar Roleta da Sorte" : "Ativar Roleta da Sorte"}
                  </Button>
                </CardContent>
              </Card>

              {/* Formulário de Adicionar Item */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Cadastrar Item da Roleta</CardTitle>
                  <CardDescription>Defina os prêmios que estarão nas fatias da roleta.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome do Prêmio</Label>
                    <Input 
                      placeholder="Ex: Pix R$ 50,00" 
                      value={newRouletteItem.name} 
                      onChange={(e) => setNewRouletteItem({...newRouletteItem, name: e.target.value})} 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Estoque Inicial</Label>
                      <Input 
                        type="number" 
                        placeholder="Ex: 5 (-1 p/ ilimitado)" 
                        value={newRouletteItem.quantity} 
                        onChange={(e) => setNewRouletteItem({...newRouletteItem, quantity: Number(e.target.value)})} 
                      />
                      <p className="text-[10px] text-gray-400">Use -1 para 'Tente Novamente'</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Probabilidade (Peso)</Label>
                      <Input 
                        type="number" 
                        placeholder="Ex: 10" 
                        value={newRouletteItem.probability} 
                        onChange={(e) => setNewRouletteItem({...newRouletteItem, probability: Number(e.target.value)})} 
                      />
                      <p className="text-[10px] text-gray-400">Peso maior = mais sorteado</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Cor da Fatia (Hex)</Label>
                      <Input 
                        placeholder="Ex: #4338FF" 
                        value={newRouletteItem.color} 
                        onChange={(e) => setNewRouletteItem({...newRouletteItem, color: e.target.value})} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Ícone (Ionicon)</Label>
                      <Input 
                        placeholder="Ex: gift-outline" 
                        value={newRouletteItem.icon} 
                        onChange={(e) => setNewRouletteItem({...newRouletteItem, icon: e.target.value})} 
                      />
                    </div>
                  </div>
                  <Button className="w-full bg-purple-600 hover:bg-purple-700" onClick={handleAddRouletteItem}>
                    <Plus className="w-4 h-4 mr-2" /> Cadastrar na Roleta
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Listagem de Itens e Estoque */}
            <div className="space-y-6 md:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Itens Ativos na Roleta ({rouletteItems.length})</CardTitle>
                  <CardDescription>Estes são os prêmios em estoque que compõem o círculo da roleta.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {rouletteItems.length === 0 && (
                      <p className="text-center text-gray-400 py-10 italic">Nenhum item cadastrado. A roleta precisa de pelo menos 2 itens para rodar.</p>
                    )}
                    {rouletteItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-4 border rounded-xl hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold" 
                            style={{ backgroundColor: item.color || "#4338FF" }}
                          >
                            <Gift className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-900">{item.name}</h4>
                            <div className="flex gap-4 text-xs text-gray-500 mt-1">
                              <span>Probabilidade: <strong className="text-purple-600 font-black">{item.probability}</strong></span>
                              <span>Cor: <span className="font-mono">{item.color}</span></span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-gray-500">Estoque:</Label>
                            <input
                              type="number"
                              defaultValue={item.quantity}
                              onBlur={(e) => handleUpdateStock(item.id, Number(e.target.value))}
                              className="w-16 p-1 border rounded text-center text-sm font-semibold bg-white"
                            />
                          </div>

                          <Badge variant={item.quantity === 0 ? "destructive" : item.quantity === -1 ? "secondary" : "default"}>
                            {item.quantity === -1 ? "Infinito" : item.quantity === 0 ? "Esgotado" : `${item.quantity} restando`}
                          </Badge>

                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-red-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDeleteRouletteItem(item.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Registro de Ganhadores da Roleta */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Ganhadores da Roleta (Tempo Real)</CardTitle>
                  <CardDescription>Lista dos clientes que rodaram a roleta e ganharam prêmios.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[300px] overflow-y-auto space-y-3">
                    {rouletteWins.length === 0 && (
                      <p className="text-center text-gray-400 py-10 italic">Nenhum cliente ganhou na roleta ainda.</p>
                    )}
                    {rouletteWins.map((win) => (
                      <div key={win.id} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50/50">
                        <div>
                          <h4 className="font-bold text-gray-900">{win.userName}</h4>
                          <p className="text-xs text-gray-500">CPF: {win.userCpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</p>
                          <p className="text-[10px] text-gray-400 mt-1">
                            {win.createdAt ? new Date(win.createdAt).toLocaleString("pt-BR") : "Data não registrada"}
                          </p>
                          <div className="mt-1 flex gap-2">
                            <Badge variant={win.redeemed ? "default" : "outline"} className={win.redeemed ? "bg-green-500 hover:bg-green-600 text-white" : "text-amber-600 border-amber-500"}>
                              {win.redeemed ? "Resgatado" : "Pendente"}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right mr-1">
                            <Badge className="bg-emerald-500 text-white font-bold">{win.prizeName}</Badge>
                            <p className="text-xs font-mono font-bold text-purple-700 mt-1">Cód: {win.rescueCode}</p>
                          </div>
                          <div className="flex gap-1 items-center">
                            {!win.redeemed && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-green-500 text-green-600 hover:bg-green-50 h-8 font-bold text-xs"
                                onClick={() => handleRescueRouletteWin(win.id)}
                              >
                                Resgatar
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-400 hover:text-red-600 hover:bg-red-50 h-8 w-8"
                              onClick={() => handleDeleteRouletteWin(win.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

          </div>
        </TabsContent>
      </Tabs>

      {/* WhatsApp Elements & Dialogs (Preserved from existing code) */}
      {progress && (
        <Card className="mt-6 border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 animate-spin text-primary" /> Enviando mensagens...
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <Progress value={(progress.sent / progress.total) * 100} className="h-1.5 mb-2" />
            <div className="flex justify-between text-[10px] font-bold uppercase text-gray-500">
               <span>Sucesso: {progress.sent - progress.failed}</span>
               <span>Falhas: {progress.failed}</span>
               <span>Total: {progress.total}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Winner Card Modal */}
      {showWinnerCard && winner && (
        <WinnerCard winner={winner} prize={selectedPrize} winnerProfilePic={winnerProfilePic} isFetchingProfilePic={isFetchingProfilePic} onClose={() => setShowWinnerCard(false)} />
      )}

      {/* WhatsApp Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Confirmar Envio ({selectedClients.length} participantes)</DialogTitle></DialogHeader>
          <div className="bg-muted p-4 rounded-md"><pre className="whitespace-pre-wrap text-sm">{previewMessage}</pre></div>
          <DialogFooter><Button variant="outline" onClick={() => setShowPreviewDialog(false)}>Cancelar</Button><Button onClick={confirmSendWhatsApp}>Confirmar e Enviar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}

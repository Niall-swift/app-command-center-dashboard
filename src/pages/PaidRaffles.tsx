import React, { useState, useEffect } from 'react';
import PageTransition from '@/components/PageTransition';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { 
  collection, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  setDoc, 
  updateDoc, 
  addDoc, 
  deleteDoc,
  serverTimestamp, 
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { 
  Ticket, 
  Plus, 
  DollarSign, 
  Calendar, 
  Users, 
  Settings, 
  Copy, 
  Check, 
  Play, 
  Trophy, 
  Clock, 
  Eye, 
  AlertCircle,
  TrendingUp,
  Search,
  CheckCircle2,
  HelpCircle,
  Edit,
  Trash2,
  Pause
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PaidRaffle {
  id: string;
  title: string;
  description: string;
  prizeName: string;
  prizeDescription: string;
  prizeImageUrl?: string;
  ticketPrice: number;
  status: 'active' | 'drawn' | 'cancelled';
  drawDate: string;
  minTickets?: number;
  totalTicketsSold: number;
  winnerTicketNumber?: number;
  winnerClientInfo?: {
    name: string;
    phone: string;
    cpf: string;
  };
  drawnAt?: any;
  createdAt: any;
}

interface Payment {
  id: string;
  raffleId: string;
  raffleTitle: string;
  clientName: string;
  clientCpf: string;
  clientPhone: string;
  clientEmail: string;
  ticketQuantity: number;
  totalValue: number;
  paymentStatus: 'PENDING' | 'CONFIRMED' | 'EXPIRED' | 'REFUNDED';
  createdAt: any;
}

interface TicketDoc {
  id: string;
  raffleId: string;
  paymentId: string;
  clientName: string;
  clientPhone: string;
  clientCpf: string;
  ticketNumber: number;
  createdAt: any;
}

export default function PaidRaffles() {
  const { toast } = useToast();
  
  // States
  const [raffles, setRaffles] = useState<PaidRaffle[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tickets, setTickets] = useState<TicketDoc[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedRaffle, setSelectedRaffle] = useState<PaidRaffle | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  // Drawing States
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingProgressNumber, setDrawingProgressNumber] = useState(100000);
  const [winningTicket, setWinningTicket] = useState<TicketDoc | null>(null);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  
  // New Raffle Form State
  const [newRaffle, setNewRaffle] = useState({
    title: '',
    description: '',
    prizeName: '',
    prizeDescription: '',
    prizeImageUrl: '',
    ticketPrice: '',
    minTickets: '',
    drawDate: ''
  });

  // Edit Raffle State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingRaffle, setEditingRaffle] = useState<any>(null);

  // Asaas Config State
  const [asaasConfig, setAsaasConfig] = useState({
    apiKey: '',
    environment: 'sandbox',
    webhookToken: ''
  });
  
  const [copied, setCopied] = useState(false);
  const [searchPayment, setSearchPayment] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const projectId = db.app.options.projectId || "seu-projeto";
  const webhookUrl = `https://us-central1-${projectId}.cloudfunctions.net/asaasWebhook`;

  // Fetching Data
  useEffect(() => {
    // 1. Subscribe to paid_raffles
    const qRaffles = query(collection(db, 'paid_raffles'), orderBy('createdAt', 'desc'));
    const unsubRaffles = onSnapshot(qRaffles, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaidRaffle));
      setRaffles(items);
      setLoading(false);
    });

    // 2. Subscribe to paid_raffle_payments
    const qPayments = query(collection(db, 'paid_raffle_payments'), orderBy('createdAt', 'desc'));
    const unsubPayments = onSnapshot(qPayments, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
      setPayments(items);
    });

    // 3. Fetch Asaas Config
    const configRef = doc(db, 'settings', 'asaas_config');
    const unsubConfig = onSnapshot(configRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setAsaasConfig({
          apiKey: data.apiKey || '',
          environment: data.environment || 'sandbox',
          webhookToken: data.webhookToken || ''
        });
      }
    });

    return () => {
      unsubRaffles();
      unsubPayments();
      unsubConfig();
    };
  }, []);

  // Fetch tickets when a raffle is selected
  useEffect(() => {
    if (!selectedRaffle) {
      setTickets([]);
      return;
    }

    const qTickets = query(
      collection(db, 'paid_raffle_tickets'),
      where('raffleId', '==', selectedRaffle.id)
    );

    const unsubTickets = onSnapshot(qTickets, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TicketDoc));
      // Sort in memory to avoid requiring a composite index in Firestore
      items.sort((a, b) => a.ticketNumber - b.ticketNumber);
      setTickets(items);
    });

    return () => unsubTickets();
  }, [selectedRaffle]);

  // Create Raffle Handler
  const handleCreateRaffle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRaffle.title || !newRaffle.prizeName || !newRaffle.ticketPrice || !newRaffle.drawDate) {
      toast({
        title: "Erro de Validação",
        description: "Preencha todos os campos obrigatórios (*).",
        variant: "destructive"
      });
      return;
    }

    try {
      await addDoc(collection(db, 'paid_raffles'), {
        title: newRaffle.title,
        description: newRaffle.description,
        prizeName: newRaffle.prizeName,
        prizeDescription: newRaffle.prizeDescription,
        prizeImageUrl: newRaffle.prizeImageUrl || '',
        ticketPrice: parseFloat(newRaffle.ticketPrice),
        minTickets: parseInt(newRaffle.minTickets) || 0,
        status: 'active',
        drawDate: newRaffle.drawDate,
        totalTicketsSold: 0,
        createdAt: serverTimestamp()
      });

      toast({
        title: "Sorteio Criado!",
        description: "O sorteio pago foi cadastrado e já está ativo para vendas."
      });

      setIsCreateOpen(false);
      setNewRaffle({
        title: '',
        description: '',
        prizeName: '',
        prizeDescription: '',
        prizeImageUrl: '',
        ticketPrice: '',
        drawDate: ''
      });
    } catch (error: any) {
      toast({
        title: "Erro ao Criar",
        description: error.message || "Erro inesperado.",
        variant: "destructive"
      });
    }
  };

  // Edit Raffle Handler
  const handleEditRaffleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRaffle || !editingRaffle.title || !editingRaffle.prizeName || !editingRaffle.ticketPrice || !editingRaffle.drawDate) {
      toast({
        title: "Erro de Validação",
        description: "Preencha todos os campos obrigatórios (*).",
        variant: "destructive"
      });
      return;
    }

    try {
      await updateDoc(doc(db, 'paid_raffles', editingRaffle.id), {
        title: editingRaffle.title,
        description: editingRaffle.description,
        prizeName: editingRaffle.prizeName,
        prizeDescription: editingRaffle.prizeDescription,
        prizeImageUrl: editingRaffle.prizeImageUrl || '',
        ticketPrice: parseFloat(editingRaffle.ticketPrice.toString()),
        minTickets: parseInt(editingRaffle.minTickets?.toString() || "0"),
        drawDate: editingRaffle.drawDate,
      });

      toast({
        title: "Sorteio Atualizado!",
        description: "As informações do sorteio foram alteradas com sucesso."
      });

      setIsEditOpen(false);
      setEditingRaffle(null);
    } catch (error: any) {
      toast({
        title: "Erro ao Atualizar",
        description: error.message || "Erro inesperado.",
        variant: "destructive"
      });
    }
  };

  // Toggle Status Handler
  const handleToggleStatus = async (raffle: PaidRaffle) => {
    const newStatus = raffle.status === 'active' ? 'cancelled' : 'active';
    try {
      await updateDoc(doc(db, 'paid_raffles', raffle.id), {
        status: newStatus
      });
      toast({
        title: "Status Atualizado",
        description: `O sorteio agora está ${newStatus === 'active' ? 'Ativo' : 'Pausado/Inativo'}.`
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Delete Raffle Handler
  const handleDeleteRaffle = async (raffle: PaidRaffle) => {
    if (window.confirm(`Tem certeza que deseja excluir o sorteio "${raffle.title}"? Isso NÃO apagará o histórico de vendas, mas a campanha sumirá.`)) {
      try {
        await deleteDoc(doc(db, 'paid_raffles', raffle.id));
        toast({
          title: "Sorteio Excluído",
          description: "O sorteio foi removido com sucesso."
        });
      } catch (error: any) {
        toast({
          title: "Erro ao Excluir",
          description: error.message,
          variant: "destructive"
        });
      }
    }
  };

  // Save Asaas Config Handler
  const handleSaveAsaasConfig = async () => {
    try {
      await setDoc(doc(db, 'settings', 'asaas_config'), asaasConfig, { merge: true });
      toast({
        title: "Configurações Salvas!",
        description: "As chaves de integração do Asaas foram atualizadas."
      });
    } catch (error: any) {
      toast({
        title: "Erro ao Salvar",
        description: error.message || "Erro inesperado.",
        variant: "destructive"
      });
    }
  };

  // Trigger Raffle Draw Animation
  const handleDrawWinner = async () => {
    if (!selectedRaffle || tickets.length === 0) {
      toast({
        title: "Não é possível sortear",
        description: "Não existem bilhetes pagos para realizar o sorteio.",
        variant: "destructive"
      });
      return;
    }

    setIsDrawing(true);
    setWinningTicket(null);

    // Pick winning ticket
    const randomIndex = Math.floor(Math.random() * tickets.length);
    const winner = tickets[randomIndex];

    // Scrolling animation duration: 3.0 seconds
    let count = 0;
    const interval = setInterval(() => {
      const randomScrollNum = Math.floor(Math.random() * 900000) + 100000;
      setDrawingProgressNumber(randomScrollNum);
      count += 80;
      if (count >= 3000) {
        clearInterval(interval);
        
        // Complete animation with winner number
        setDrawingProgressNumber(winner.ticketNumber);
        setWinningTicket(winner);
        setIsDrawing(false);
        setShowWinnerModal(true);

        // Update raffle in Firestore
        updateDoc(doc(db, 'paid_raffles', selectedRaffle.id), {
          status: 'drawn',
          winnerTicketNumber: winner.ticketNumber,
          winnerClientInfo: {
            name: winner.clientName,
            phone: winner.clientPhone,
            cpf: winner.clientCpf
          },
          drawnAt: serverTimestamp()
        }).then(() => {
          // Update selected raffle state locally
          setSelectedRaffle(prev => prev ? {
            ...prev,
            status: 'drawn',
            winnerTicketNumber: winner.ticketNumber,
            winnerClientInfo: {
              name: winner.clientName,
              phone: winner.clientPhone,
              cpf: winner.clientCpf
            }
          } : null);
        });
      }
    }, 80);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copiado!",
      description: "URL do Webhook copiada para a área de transferência."
    });
  };

  // Filtering Payments
  const filteredPayments = payments.filter(pay => {
    const matchesSearch = 
      pay.clientName.toLowerCase().includes(searchPayment.toLowerCase()) ||
      pay.clientCpf.includes(searchPayment) ||
      pay.raffleTitle.toLowerCase().includes(searchPayment.toLowerCase());

    const matchesStatus = 
      statusFilter === 'ALL' || pay.paymentStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate Statistics
  const totalRevenue = payments
    .filter(p => p.paymentStatus === 'CONFIRMED')
    .reduce((sum, p) => sum + p.totalValue, 0);

  const totalTickets = payments
    .filter(p => p.paymentStatus === 'CONFIRMED')
    .reduce((sum, p) => sum + p.ticketQuantity, 0);

  return (
    <PageTransition>
      <div className="space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">
              Sorteios Pagos (Pre-Mix)
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Configure sorteios cobrados, rastreie faturamento Pix pelo Asaas e realize sorteios animados.
            </p>
          </div>
          <Button 
            onClick={() => setIsCreateOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg hover:shadow-indigo-500/20 transition-all duration-300 gap-2"
          >
            <Plus className="w-4 h-4" /> Novo Sorteio Pago
          </Button>
        </div>

        {/* Dashboard Statistics Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border border-border/40 bg-card/60 backdrop-blur-md rounded-2xl">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Faturamento Confirmado</p>
                <h3 className="text-2xl font-bold mt-1 text-emerald-500">
                  R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
              </div>
              <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                <DollarSign className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border/40 bg-card/60 backdrop-blur-md rounded-2xl">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bilhetes Vendidos</p>
                <h3 className="text-2xl font-bold mt-1 text-indigo-500">{totalTickets}</h3>
              </div>
              <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500">
                <Ticket className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border/40 bg-card/60 backdrop-blur-md rounded-2xl">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Campanhas Ativas</p>
                <h3 className="text-2xl font-bold mt-1 text-blue-500">
                  {raffles.filter(r => r.status === 'active').length}
                </h3>
              </div>
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                <TrendingUp className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border/40 bg-card/60 backdrop-blur-md rounded-2xl">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sorteios Realizados</p>
                <h3 className="text-2xl font-bold mt-1 text-amber-500">
                  {raffles.filter(r => r.status === 'drawn').length}
                </h3>
              </div>
              <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500">
                <Trophy className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs System */}
        <Tabs defaultValue="campaigns" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md bg-slate-100 dark:bg-slate-900 rounded-xl p-1 mb-6">
            <TabsTrigger value="campaigns" className="rounded-lg gap-2">
              <TrendingUp className="w-4 h-4" /> Campanhas
            </TabsTrigger>
            <TabsTrigger value="sales" className="rounded-lg gap-2">
              <DollarSign className="w-4 h-4" /> Vendas
            </TabsTrigger>
            <TabsTrigger value="asaas" className="rounded-lg gap-2">
              <Settings className="w-4 h-4" /> Asaas
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: CAMPANHAS */}
          <TabsContent value="campaigns" className="space-y-4 outline-none">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
              </div>
            ) : raffles.length === 0 ? (
              <div className="text-center py-16 bg-card border border-border/40 rounded-2xl">
                <Ticket className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
                <h4 className="text-lg font-semibold">Nenhuma campanha cadastrada</h4>
                <p className="text-muted-foreground text-sm mt-1 max-w-md mx-auto">
                  Crie seu primeiro sorteio pago clicando no botão "Novo Sorteio Pago" acima.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {raffles.map((raffle) => (
                  <Card key={raffle.id} className="overflow-hidden border border-border/40 bg-card rounded-2xl flex flex-col hover:shadow-lg transition-shadow duration-300">
                    
                    {/* Visual header */}
                    <div className="h-40 relative bg-gradient-to-br from-slate-900 to-indigo-950 flex items-center justify-center p-6 text-center text-white overflow-hidden">
                      {raffle.prizeImageUrl ? (
                        <img 
                          src={raffle.prizeImageUrl} 
                          alt={raffle.prizeName} 
                          className="absolute inset-0 w-full h-full object-cover opacity-45"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/60 via-indigo-900/50 to-slate-950/70" />
                      )}
                      
                      <div className="relative z-10 space-y-1">
                        <Badge className={`absolute top-0 right-0 -mt-8 mr-2 uppercase text-[10px] tracking-widest ${
                          raffle.status === 'active' ? 'bg-emerald-500 hover:bg-emerald-600 text-white' :
                          raffle.status === 'drawn' ? 'bg-blue-500 hover:bg-blue-600 text-white' :
                          'bg-red-500 hover:bg-red-600 text-white'
                        }`}>
                          {raffle.status === 'active' ? 'Ativo' : raffle.status === 'drawn' ? 'Sorteado' : 'Cancelado'}
                        </Badge>
                        <h4 className="text-xs uppercase font-semibold text-blue-400 tracking-wider">Prêmio</h4>
                        <h3 className="text-lg font-black truncate max-w-[260px]">{raffle.prizeName}</h3>
                        <p className="text-[10px] text-slate-300 line-clamp-1">{raffle.prizeDescription}</p>
                      </div>
                    </div>

                    <CardContent className="p-6 flex-1 flex flex-col justify-between">
                      <div className="space-y-4">
                        <div>
                          <h3 className="font-bold text-lg text-foreground truncate">{raffle.title}</h3>
                          <p className="text-muted-foreground text-xs line-clamp-2 mt-1">{raffle.description}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl">
                          <div>
                            <span className="text-[10px] text-muted-foreground uppercase font-medium">Preço Bilhete</span>
                            <p className="font-black text-blue-500 text-sm">
                              R$ {raffle.ticketPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground uppercase font-medium">Bilhetes Pagos</span>
                            <p className="font-bold text-foreground text-sm">{raffle.totalTicketsSold}</p>
                          </div>
                        </div>

                        <div className="space-y-2 text-xs">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Data do Sorteio: <b className="text-foreground">{raffle.drawDate}</b></span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Copy className="w-3.5 h-3.5 text-indigo-500" />
                            <span>ID da Campanha: <code className="text-foreground bg-slate-100 dark:bg-slate-900 px-1 rounded text-[10px]">{raffle.id}</code></span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-border/40 mt-5 flex flex-wrap gap-2">
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setSelectedRaffle(raffle);
                            setIsDetailOpen(true);
                          }}
                          className="flex-1 rounded-xl gap-1 text-xs"
                        >
                          <Eye className="w-3.5 h-3.5" /> Detalhes
                        </Button>
                        <Button 
                          onClick={() => {
                            const url = `${window.location.origin}/sorteio-compra/${raffle.id}`;
                            navigator.clipboard.writeText(url);
                            toast({
                              title: "Link Copiado!",
                              description: "Envie este link para os clientes comprarem bilhetes."
                            });
                          }}
                          className="bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 dark:text-indigo-400 p-2.5 rounded-xl border-none"
                          size="icon"
                          title="Copiar Link de Venda"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button 
                          onClick={() => {
                            setEditingRaffle(raffle);
                            setIsEditOpen(true);
                          }}
                          className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 dark:text-blue-400 p-2.5 rounded-xl border-none"
                          size="icon"
                          title="Editar Sorteio"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          onClick={() => handleToggleStatus(raffle)}
                          className={`${raffle.status === 'active' ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400' : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400'} p-2.5 rounded-xl border-none`}
                          size="icon"
                          title={raffle.status === 'active' ? "Pausar Sorteio" : "Ativar Sorteio"}
                        >
                          {raffle.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </Button>
                        <Button 
                          onClick={() => handleDeleteRaffle(raffle)}
                          className="bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400 p-2.5 rounded-xl border-none"
                          size="icon"
                          title="Excluir Sorteio"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* TAB 2: VENDAS / TRANSAÇÕES */}
          <TabsContent value="sales" className="outline-none">
            <Card className="border border-border/40 bg-card rounded-2xl">
              <CardHeader className="p-6">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-indigo-500" /> Registro de Vendas
                </CardTitle>
                <CardDescription>
                  Acompanhe todas as faturas e compras confirmadas de bilhetes.
                </CardDescription>

                <div className="flex flex-col sm:flex-row gap-3 mt-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      placeholder="Pesquisar por cliente, CPF ou sorteio..." 
                      value={searchPayment}
                      onChange={(e) => setSearchPayment(e.target.value)}
                      className="pl-9 rounded-xl border-border/50 bg-background"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-background border border-border/50 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="ALL">Todos Status</option>
                      <option value="CONFIRMED">Confirmado</option>
                      <option value="PENDING">Pendente (Pix)</option>
                      <option value="EXPIRED">Expirado</option>
                    </select>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0 border-t border-border/40">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs text-muted-foreground uppercase font-semibold">
                      <tr>
                        <th className="px-6 py-4">Data/Hora</th>
                        <th className="px-6 py-4">Cliente / CPF</th>
                        <th className="px-6 py-4">Sorteio</th>
                        <th className="px-6 py-4 text-center">Qtd. Bilhetes</th>
                        <th className="px-6 py-4 text-right">Valor Pago</th>
                        <th className="px-6 py-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {filteredPayments.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-12 text-muted-foreground text-xs">
                            Nenhuma transação encontrada correspondente aos critérios de busca.
                          </td>
                        </tr>
                      ) : (
                        filteredPayments.map((pay) => {
                          const date = pay.createdAt?.toDate ? pay.createdAt.toDate() : (pay.createdAt ? new Date(pay.createdAt) : null);
                          return (
                            <tr key={pay.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                              <td className="px-6 py-4 font-medium text-xs whitespace-nowrap text-muted-foreground">
                                {date ? date.toLocaleString('pt-BR') : "Processando..."}
                              </td>
                              <td className="px-6 py-4">
                                <div className="font-semibold text-foreground">{pay.clientName}</div>
                                <div className="text-[10px] text-muted-foreground">CPF: {pay.clientCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</div>
                              </td>
                              <td className="px-6 py-4 font-medium text-foreground max-w-[200px] truncate">
                                {pay.raffleTitle}
                              </td>
                              <td className="px-6 py-4 text-center font-bold text-foreground">
                                {pay.ticketQuantity}
                              </td>
                              <td className="px-6 py-4 text-right font-black text-foreground">
                                R$ {pay.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-6 py-4 text-center">
                                <Badge className={`uppercase text-[9px] font-bold tracking-wider px-2 py-0.5 ${
                                  pay.paymentStatus === 'CONFIRMED' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none' :
                                  pay.paymentStatus === 'PENDING' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-none' :
                                  'bg-red-500/10 text-red-600 dark:text-red-400 border-none'
                                }`}>
                                  {pay.paymentStatus === 'CONFIRMED' ? 'Confirmado' : pay.paymentStatus === 'PENDING' ? 'Pendente' : 'Expirado'}
                                </Badge>
                                
                                {pay.paymentStatus === 'PENDING' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="ml-2 h-7 text-[10px] bg-emerald-500/10 text-emerald-600 border-none hover:bg-emerald-500/20"
                                    onClick={async () => {
                                      if (window.confirm('Forçar a aprovação deste pagamento para testes? (Isso vai gerar os bilhetes)')) {
                                        try {
                                          toast({ title: 'Simulando Webhook...', description: 'Aguarde a geração dos bilhetes.' });
                                          await fetch(webhookUrl, {
                                            method: 'POST',
                                            headers: {
                                              'Content-Type': 'application/json',
                                              'asaas-access-token': asaasConfig.webhookToken || ''
                                            },
                                            body: JSON.stringify({
                                              event: 'PAYMENT_CONFIRMED',
                                              payment: { id: 'simulated_payment', externalReference: pay.id }
                                            })
                                          });
                                          toast({ title: 'Sucesso', description: 'O pagamento foi confirmado e os bilhetes foram gerados!' });
                                        } catch (e: any) {
                                          toast({ title: 'Erro', description: e.message, variant: 'destructive' });
                                        }
                                      }
                                    }}
                                  >
                                    <Check className="w-3 h-3 mr-1" /> Simular Pagamento
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: ASAAS CONFIG */}
          <TabsContent value="asaas" className="outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="lg:col-span-2 space-y-6">
                <Card className="border border-border/40 bg-card rounded-2xl shadow-sm">
                  <CardHeader className="p-6">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <Settings className="w-5 h-5 text-indigo-500" /> Credenciais da API do Asaas
                    </CardTitle>
                    <CardDescription>
                      Configure suas credenciais da conta Asaas para cobrança dinâmica de Pix.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="environment">Ambiente de Operação</Label>
                        <select
                          id="environment"
                          value={asaasConfig.environment}
                          onChange={(e) => setAsaasConfig(prev => ({ ...prev, environment: e.target.value }))}
                          className="w-full bg-background border border-border/50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring h-10"
                        >
                          <option value="sandbox">Sandbox (Testes)</option>
                          <option value="production">Produção (Real)</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="webhookToken">Token de Acesso Webhook</Label>
                        <Input
                          id="webhookToken"
                          type="text"
                          placeholder="Defina um token de segurança para o Webhook"
                          value={asaasConfig.webhookToken}
                          onChange={(e) => setAsaasConfig(prev => ({ ...prev, webhookToken: e.target.value }))}
                          className="rounded-xl border-border/50"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="apiKey">Chave de API do Asaas (Access Token)</Label>
                      <Input
                        id="apiKey"
                        type="password"
                        placeholder="Cole a chave de API ($asaas_...)"
                        value={asaasConfig.apiKey}
                        onChange={(e) => setAsaasConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                        className="rounded-xl border-border/50"
                      />
                    </div>

                    <Button 
                      onClick={handleSaveAsaasConfig}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg hover:shadow-indigo-500/20 px-6 mt-4"
                    >
                      Salvar Configurações
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border border-border/40 bg-card rounded-2xl shadow-sm">
                  <CardHeader className="p-6">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <Users className="w-5 h-5 text-indigo-500" /> Configuração do Webhook no Asaas
                    </CardTitle>
                    <CardDescription>
                      Como cadastrar a notificação instantânea para receber as confirmações de faturamento.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4 text-sm">
                    <p className="text-muted-foreground">
                      Para que os bilhetes sejam emitidos automaticamente assim que o cliente pagar o Pix, você deve cadastrar um Webhook no painel do Asaas em:
                      <br />
                      <b className="text-foreground">Configurações da Conta &gt; Integrações &gt; Webhooks &gt; Webhook de Cobranças</b>.
                    </p>

                    <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-border/50 space-y-3">
                      <div className="flex justify-between items-center gap-2">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Endereço (URL) para Envio</Label>
                        <Button 
                          onClick={copyToClipboard}
                          variant="ghost" 
                          size="sm"
                          className="h-8 rounded-lg gap-1 text-xs"
                        >
                          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          Copiar URL
                        </Button>
                      </div>
                      <code className="block text-xs text-foreground font-mono bg-white dark:bg-black/40 p-2.5 rounded-lg select-all border border-border/20 whitespace-normal break-all">
                        {webhookUrl}
                      </code>
                    </div>

                    <div className="space-y-2 text-muted-foreground">
                      <h4 className="font-bold text-foreground">Passo a Passo:</h4>
                      <ol className="list-decimal pl-5 space-y-1.5 text-xs">
                        <li>Copie a URL acima;</li>
                        <li>Cole no campo <b>"URL para envio"</b> no webhook do Asaas;</li>
                        <li>No campo <b>"Token"</b> do Asaas, coloque o mesmo <b>"Token de Acesso Webhook"</b> configurado acima;</li>
                        <li>Selecione a versão da API: <b>v3</b>;</li>
                        <li>Marque os eventos: <b>"Pagamento recebido"</b> e <b>"Pagamento confirmado"</b>;</li>
                        <li>Ative a chave e clique em <b>"Salvar"</b>.</li>
                      </ol>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Informative Sidecard */}
              <div className="space-y-6">
                <Card className="border border-border/40 bg-gradient-to-br from-blue-900/10 via-indigo-900/5 to-slate-950 rounded-2xl">
                  <CardHeader className="p-6">
                    <CardTitle className="text-base font-bold text-indigo-400">Guia de Vendas</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 pt-0 space-y-4 text-xs text-muted-foreground leading-relaxed">
                    <p>
                      Cada sorteio pago criado gera um link de vendas público independente que pode ser compartilhado diretamente no Instagram, WhatsApp ou Telegram.
                    </p>
                    <div className="flex gap-3 items-start bg-blue-500/10 p-3 rounded-xl text-blue-500">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-blue-600 dark:text-blue-400">Ambiente de Sandbox</h4>
                        <p className="mt-0.5">Use o ambiente de Sandbox com credenciais fictícias de teste do Asaas para validar todo o fluxo de ponta a ponta sem transações reais.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

            </div>
          </TabsContent>
        </Tabs>

        {/* MODAL: CRIAR NOVO SORTEIO PAGO */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-w-md bg-card border-border/40 rounded-2xl">
            <form onSubmit={handleCreateRaffle}>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">Novo Sorteio Pago</DialogTitle>
                <DialogDescription>
                  Cadastre um novo sorteio que requer pagamento para participar.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="title">Título da Campanha *</Label>
                  <Input 
                    id="title" 
                    placeholder="Ex: Super Pix Premiado!"
                    required
                    value={newRaffle.title}
                    onChange={(e) => setNewRaffle(prev => ({ ...prev, title: e.target.value }))}
                    className="rounded-xl border-border/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description">Descrição</Label>
                  <Input 
                    id="description" 
                    placeholder="Breve resumo da campanha..."
                    value={newRaffle.description}
                    onChange={(e) => setNewRaffle(prev => ({ ...prev, description: e.target.value }))}
                    className="rounded-xl border-border/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="ticketPrice">Preço do Bilhete (R$) *</Label>
                    <Input 
                      id="ticketPrice" 
                      type="number"
                      step="0.01"
                      placeholder="5.00"
                      required
                      value={newRaffle.ticketPrice}
                      onChange={(e) => setNewRaffle(prev => ({ ...prev, ticketPrice: e.target.value }))}
                      className="rounded-xl border-border/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="drawDate">Data do Sorteio *</Label>
                    <Input 
                      id="drawDate" 
                      placeholder="Ex: Todo Sábado às 19h"
                      required
                      value={newRaffle.drawDate}
                      onChange={(e) => setNewRaffle(prev => ({ ...prev, drawDate: e.target.value }))}
                      className="rounded-xl border-border/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="minTickets">Meta de Bilhetes (Mínimo)</Label>
                    <Input 
                      id="minTickets" 
                      type="number"
                      placeholder="Ex: 50"
                      value={newRaffle.minTickets}
                      onChange={(e) => setNewRaffle(prev => ({ ...prev, minTickets: e.target.value }))}
                      className="rounded-xl border-border/50"
                    />
                  </div>
                </div>

                <div className="border-t border-border/40 pt-4 space-y-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Informações do Prêmio</h4>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="prizeName">Nome do Prêmio *</Label>
                    <Input 
                      id="prizeName" 
                      placeholder="Ex: iPhone 15 Pro Max"
                      required
                      value={newRaffle.prizeName}
                      onChange={(e) => setNewRaffle(prev => ({ ...prev, prizeName: e.target.value }))}
                      className="rounded-xl border-border/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="prizeDescription">Descrição do Prêmio</Label>
                    <Input 
                      id="prizeDescription" 
                      placeholder="Ex: 256GB Titanium Natural, Novo e Lacrado..."
                      value={newRaffle.prizeDescription}
                      onChange={(e) => setNewRaffle(prev => ({ ...prev, prizeDescription: e.target.value }))}
                      className="rounded-xl border-border/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="prizeImageUrl">URL da Imagem do Prêmio (Opcional)</Label>
                    <Input 
                      id="prizeImageUrl" 
                      placeholder="https://exemplo.com/imagem.jpg"
                      value={newRaffle.prizeImageUrl}
                      onChange={(e) => setNewRaffle(prev => ({ ...prev, prizeImageUrl: e.target.value }))}
                      className="rounded-xl border-border/50"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-xl"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg hover:shadow-indigo-500/20"
                >
                  Criar Sorteio
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* MODAL: EDITAR SORTEIO */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-2xl bg-card border-border/40 rounded-2xl max-h-[85vh] overflow-y-auto">
            <form onSubmit={handleEditRaffleSubmit} className="space-y-6">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <Edit className="w-5 h-5 text-indigo-500" />
                  Editar Sorteio Pago
                </DialogTitle>
                <DialogDescription>
                  Altere as informações da campanha de sorteio.
                </DialogDescription>
              </DialogHeader>

              {editingRaffle && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-title">Título da Campanha *</Label>
                    <Input 
                      id="edit-title" 
                      required
                      value={editingRaffle.title}
                      onChange={(e) => setEditingRaffle((prev: any) => ({ ...prev, title: e.target.value }))}
                      className="rounded-xl border-border/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-description">Descrição (Regras, Detalhes)</Label>
                    <textarea 
                      id="edit-description"
                      rows={3}
                      value={editingRaffle.description}
                      onChange={(e) => setEditingRaffle((prev: any) => ({ ...prev, description: e.target.value }))}
                      className="w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-ticketPrice">Preço (R$) *</Label>
                      <Input 
                        id="edit-ticketPrice" 
                        type="number"
                        step="0.01"
                        required
                        value={editingRaffle.ticketPrice}
                        onChange={(e) => setEditingRaffle((prev: any) => ({ ...prev, ticketPrice: e.target.value }))}
                        className="rounded-xl border-border/50"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-minTickets">Mínimo de Bilhetes</Label>
                      <Input 
                        id="edit-minTickets" 
                        type="number"
                        placeholder="Ex: 50"
                        value={editingRaffle.minTickets}
                        onChange={(e) => setEditingRaffle((prev: any) => ({ ...prev, minTickets: e.target.value }))}
                        className="rounded-xl border-border/50"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-drawDate">Data Prevista do Sorteio *</Label>
                    <Input 
                      id="edit-drawDate" 
                      type="date"
                      required
                      value={editingRaffle.drawDate}
                      onChange={(e) => setEditingRaffle((prev: any) => ({ ...prev, drawDate: e.target.value }))}
                      className="rounded-xl border-border/50"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase">Detalhes do Prêmio</h4>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-prizeName">Nome do Prêmio *</Label>
                    <Input 
                      id="edit-prizeName" 
                      required
                      value={editingRaffle.prizeName}
                      onChange={(e) => setEditingRaffle((prev: any) => ({ ...prev, prizeName: e.target.value }))}
                      className="rounded-xl border-border/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-prizeDescription">Descrição do Prêmio</Label>
                    <Input 
                      id="edit-prizeDescription" 
                      value={editingRaffle.prizeDescription}
                      onChange={(e) => setEditingRaffle((prev: any) => ({ ...prev, prizeDescription: e.target.value }))}
                      className="rounded-xl border-border/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-prizeImageUrl">URL da Imagem do Prêmio (Opcional)</Label>
                    <Input 
                      id="edit-prizeImageUrl" 
                      value={editingRaffle.prizeImageUrl}
                      onChange={(e) => setEditingRaffle((prev: any) => ({ ...prev, prizeImageUrl: e.target.value }))}
                      className="rounded-xl border-border/50"
                    />
                  </div>
                </div>
              </div>
              )}

              <DialogFooter className="gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsEditOpen(false)}
                  className="rounded-xl"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg hover:shadow-blue-500/20"
                >
                  Salvar Alterações
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* MODAL: DETALHES DO SORTEIO E REALIZAÇÃO DO SORTEIO */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-2xl bg-card border-border/40 rounded-2xl max-h-[85vh] overflow-y-auto">
            {selectedRaffle && (
              <div className="space-y-6">
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500">
                      <Ticket className="w-5 h-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-lg font-bold">{selectedRaffle.title}</DialogTitle>
                      <DialogDescription>
                        Administre e consulte a situação da campanha de sorteio.
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                {/* Sorteio Status Card */}
                {selectedRaffle.status === 'drawn' && selectedRaffle.winnerClientInfo ? (
                  <div className="bg-emerald-500/10 p-5 rounded-2xl border border-emerald-500/30 flex items-center gap-4 text-emerald-600 dark:text-emerald-400">
                    <Trophy className="w-12 h-12 shrink-0 animate-bounce" />
                    <div>
                      <h4 className="text-base font-black">Sorteio Finalizado!</h4>
                      <p className="text-sm font-medium mt-1">
                        Ganhador: <b>{selectedRaffle.winnerClientInfo.name}</b>
                      </p>
                      <p className="text-xs mt-0.5 opacity-80">
                        Bilhete Sorteado: <b>#{selectedRaffle.winnerTicketNumber}</b> | CPF: {selectedRaffle.winnerClientInfo.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
                      </p>
                    </div>
                  </div>
                ) : selectedRaffle.status === 'active' ? (
                  <div className="bg-indigo-500/5 p-5 rounded-2xl border border-indigo-500/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-indigo-500" /> Sorteio Ativo
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {tickets.length} bilhetes elegíveis para concorrer no sorteio.
                      </p>
                    </div>
                    
                    <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                      {(selectedRaffle.minTickets && tickets.length < selectedRaffle.minTickets) ? (
                        <div className="bg-amber-500/10 text-amber-500 text-xs font-semibold px-3 py-2 rounded-xl flex items-center justify-center border border-amber-500/20 whitespace-nowrap">
                          Faltam {selectedRaffle.minTickets - tickets.length} bilhetes para a meta
                        </div>
                      ) : null}
                      <Button 
                        onClick={handleDrawWinner}
                        disabled={isDrawing || tickets.length === 0 || (selectedRaffle.minTickets && tickets.length < selectedRaffle.minTickets)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg hover:shadow-indigo-500/20 gap-2 shrink-0 h-11"
                      >
                        <Play className="w-4 h-4 fill-white" /> Realizar Sorteio Pago
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-500/10 p-4 rounded-2xl border border-red-500/20 text-red-500 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span className="text-sm font-medium">Esta campanha foi cancelada.</span>
                  </div>
                )}

                {/* Draw Animation Roulette overlay */}
                <AnimatePresence>
                  {isDrawing && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="bg-slate-950/90 text-white p-8 rounded-2xl flex flex-col items-center justify-center text-center space-y-4 border border-indigo-500/30"
                    >
                      <div className="relative">
                        <div className="w-24 h-24 rounded-full border-4 border-dashed border-indigo-500 animate-spin absolute -inset-2 opacity-50" />
                        <div className="w-20 h-20 rounded-full bg-slate-900 border-2 border-indigo-500 flex items-center justify-center font-black text-xl text-indigo-400">
                          {drawingProgressNumber}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-black text-lg">Sorteando Ganhador...</h4>
                        <p className="text-xs text-indigo-300 animate-pulse mt-1">
                          Embaralhando bilhetes elegíveis do Asaas...
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Campanha Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl space-y-3">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados Financeiros</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Preço do bilhete:</span>
                        <span className="font-bold">R$ {selectedRaffle.ticketPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Bilhetes vendidos:</span>
                        <span className="font-bold">{selectedRaffle.totalTicketsSold}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-border/40 pt-2 font-black">
                        <span className="text-foreground">Total Arrecadado:</span>
                        <span className="text-emerald-500">
                          R$ {(selectedRaffle.totalTicketsSold * selectedRaffle.ticketPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl space-y-3">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados do Prêmio</h4>
                    <div className="space-y-1">
                      <h5 className="font-bold text-foreground text-sm">{selectedRaffle.prizeName}</h5>
                      <p className="text-muted-foreground text-xs">{selectedRaffle.prizeDescription || "Sem descrição cadastrada."}</p>
                    </div>
                  </div>
                </div>

                {/* List of generated tickets */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Lista de Bilhetes Gerados ({tickets.length})
                    </h4>
                    <Badge variant="outline" className="text-[10px] rounded-lg">Faturamento Asaas</Badge>
                  </div>

                  <div className="border border-border/40 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] text-muted-foreground uppercase font-semibold sticky top-0">
                        <tr>
                          <th className="px-4 py-3">Número</th>
                          <th className="px-4 py-3">Nome do Comprador</th>
                          <th className="px-4 py-3">Celular</th>
                          <th className="px-4 py-3">CPF</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {tickets.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="text-center py-8 text-muted-foreground">
                              Nenhum bilhete vendido para este sorteio pago ainda.
                            </td>
                          </tr>
                        ) : (
                          tickets.map((t) => (
                            <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                              <td className="px-4 py-2.5 font-black text-blue-500">
                                #{t.ticketNumber}
                              </td>
                              <td className="px-4 py-2.5 font-semibold text-foreground">
                                {t.clientName}
                              </td>
                              <td className="px-4 py-2.5 text-muted-foreground">
                                {t.clientPhone}
                              </td>
                              <td className="px-4 py-2.5 text-muted-foreground">
                                {t.clientCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-border/40">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsDetailOpen(false)}
                    className="rounded-xl px-5"
                  >
                    Fechar Detalhes
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* MODAL: WINNER CARD ANNOUNCEMENT */}
        <Dialog open={showWinnerModal} onOpenChange={setShowWinnerModal}>
          <DialogContent className="max-w-md bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 border-indigo-500/40 text-white rounded-2xl overflow-hidden shadow-2xl p-0">
            {winningTicket && selectedRaffle && (
              <div className="relative p-8 text-center space-y-6 flex flex-col items-center">
                
                {/* Visual sparkles header */}
                <div className="absolute top-0 inset-x-0 h-40 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-yellow-500/20 via-transparent to-transparent pointer-events-none" />

                <div className="w-16 h-16 rounded-full bg-yellow-500/10 border-2 border-yellow-500 flex items-center justify-center text-yellow-500 animate-pulse relative">
                  <Trophy className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black font-black uppercase text-[10px] tracking-widest rounded-full">
                    Ganhador Sorteado
                  </Badge>
                  <h3 className="text-2xl font-black mt-2">Temos um vencedor!</h3>
                  <p className="text-indigo-200 text-xs mt-1">
                    Campanha: {selectedRaffle.title}
                  </p>
                </div>

                {/* Main Winner Card */}
                <div className="w-full bg-slate-900/80 p-5 rounded-2xl border border-indigo-500/20 space-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase text-indigo-400 font-semibold tracking-wider">Número da Sorte</span>
                    <h2 className="text-3xl font-black text-yellow-400">#{winningTicket.ticketNumber}</h2>
                  </div>

                  <div className="h-px bg-indigo-500/10" />

                  <div className="text-left space-y-2.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-indigo-300">Nome:</span>
                      <span className="font-bold text-white">{winningTicket.clientName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-indigo-300">WhatsApp:</span>
                      <span className="font-bold text-white">{winningTicket.clientPhone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-indigo-300">CPF:</span>
                      <span className="font-bold text-white">
                        {winningTicket.clientCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-indigo-300">Prêmio:</span>
                      <span className="font-black text-yellow-400">{selectedRaffle.prizeName}</span>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-indigo-300">
                  O ganhador receberá uma notificação em seu celular. O status foi atualizado no banco.
                </p>

                <Button 
                  onClick={() => setShowWinnerModal(false)}
                  className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold rounded-xl w-full h-11 transition-all duration-300"
                >
                  Fechar e Voltar
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

      </div>
    </PageTransition>
  );
}

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db, functions } from '@/config/firebase';
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from '@/hooks/use-toast';
import { 
  Ticket, 
  Copy, 
  Check, 
  Smartphone, 
  User, 
  FileText, 
  Mail, 
  Plus, 
  Minus, 
  QrCode, 
  Loader2, 
  CheckCircle2, 
  Sparkles,
  Search,
  Calendar,
  AlertCircle,
  HelpCircle
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
  totalTicketsSold: number;
}

interface SearchTicket {
  ticketNumber: number;
  clientName: string;
}

export default function PublicPaidRaffle() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  // Core Page States
  const [raffle, setRaffle] = useState<PaidRaffle | null>(null);
  const [loadingPage, setLoadingPage] = useState(true);
  const [activeTab, setActiveTab] = useState<'buy' | 'tickets'>('buy');

  // Purchase Form States
  const [clientName, setClientName] = useState('');
  const [clientCpf, setClientCpf] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [creatingPayment, setCreatingPayment] = useState(false);

  // Pix Checkout States
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [pixCode, setPixCode] = useState('');
  const [pixQrCode, setPixQrCode] = useState('');
  const [totalValue, setTotalValue] = useState(0);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(900); // 15 minutes timer
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [myTickets, setMyTickets] = useState<number[]>([]);

  // Search Tickets States
  const [searchCpfOrPhone, setSearchCpfOrPhone] = useState('');
  const [searchResult, setSearchResult] = useState<SearchTicket[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [searchedName, setSearchedName] = useState('');

  // 1. Fetch raffle details
  useEffect(() => {
    if (!id) return;

    const unsub = onSnapshot(doc(db, 'paid_raffles', id), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setRaffle({ id: snapshot.id, ...data } as PaidRaffle);
      } else {
        setRaffle(null);
      }
      setLoadingPage(false);
    }, (error) => {
      console.error("Error fetching raffle:", error);
      setLoadingPage(false);
    });

    return () => unsub();
  }, [id]);

  // 2. Format CPF & Phone Inputs
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);
    
    // Formatting: 999.999.999-99
    if (value.length > 9) {
      value = value.replace(/^(\d{3})(\d{3})(\d{3})(\d{1,2})$/, "$1.$2.$3-$4");
    } else if (value.length > 6) {
      value = value.replace(/^(\d{3})(\d{3})(\d{1,3})$/, "$1.$2.$3");
    } else if (value.length > 3) {
      value = value.replace(/^(\d{3})(\d{1,3})$/, "$1.$2");
    }
    
    setClientCpf(value);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);
    
    // Formatting: (99) 99999-9999
    if (value.length > 10) {
      value = value.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
    } else if (value.length > 6) {
      value = value.replace(/^(\d{2})(\d{4})(\d{0,4})$/, "($1) $2-$3");
    } else if (value.length > 2) {
      value = value.replace(/^(\d{2})(\d{0,5})$/, "($1) $2");
    } else if (value.length > 0) {
      value = `(${value}`;
    }
    
    setClientPhone(value);
  };

  // 3. Countdown timer for Pix
  useEffect(() => {
    if (!paymentId || paymentConfirmed || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [paymentId, paymentConfirmed, timeLeft]);

  // 4. Live subscription to payment document
  useEffect(() => {
    if (!paymentId) return;

    const unsub = onSnapshot(doc(db, 'paid_raffle_payments', paymentId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.paymentStatus === 'CONFIRMED') {
          setPaymentConfirmed(true);
          setMyTickets(data.tickets || []);
          toast({
            title: "Pagamento Confirmado! 🎉",
            description: "Seus bilhetes foram gerados e enviados para o seu WhatsApp.",
            variant: "default"
          });
        }
      }
    });

    return () => unsub();
  }, [paymentId]);

  // 5. Submit purchase form
  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanCpf = clientCpf.replace(/\D/g, "");
    const cleanPhone = clientPhone.replace(/\D/g, "");

    if (cleanCpf.length !== 11) {
      toast({
        title: "CPF Inválido",
        description: "Digite um CPF válido com 11 dígitos.",
        variant: "destructive"
      });
      return;
    }

    if (cleanPhone.length < 10) {
      toast({
        title: "Telefone Inválido",
        description: "Digite um número de WhatsApp completo com DDD.",
        variant: "destructive"
      });
      return;
    }

    setCreatingPayment(true);

    try {
      const createPaidRafflePayment = httpsCallable(functions, 'createPaidRafflePayment');
      const response = await createPaidRafflePayment({
        raffleId: id,
        clientName,
        clientCpf: cleanCpf,
        clientPhone: cleanPhone,
        clientEmail,
        ticketQuantity: quantity
      });

      const data = response.data as any;
      if (data.success) {
        setPaymentId(data.paymentId);
        setPixCode(data.pixCode);
        setPixQrCode(data.pixQrCodeBase64);
        setTotalValue(data.totalValue);
        setTimeLeft(900); // Reset to 15 min
      }
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Falha na Compra",
        description: err.message || "Não foi possível gerar a cobrança Pix.",
        variant: "destructive"
      });
    } finally {
      setCreatingPayment(false);
    }
  };

  // 6. Copy Pix code
  const copyPix = () => {
    navigator.clipboard.writeText(pixCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copiado!",
      description: "Código Pix copiado com sucesso para a área de transferência."
    });
  };

  // 7. Search client tickets
  const handleSearchTickets = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTerm = searchCpfOrPhone.replace(/\D/g, "");
    if (!cleanTerm) return;

    setSearching(true);
    setSearchDone(false);
    setSearchResult([]);

    try {
      const ticketsRef = collection(db, 'paid_raffle_tickets');
      
      // We search by CPF first, then by phone
      let q = query(ticketsRef, where('raffleId', '==', id), where('clientCpf', '==', cleanTerm));
      let snap = await getDocs(q);

      if (snap.empty) {
        q = query(ticketsRef, where('raffleId', '==', id), where('clientPhone', '==', cleanTerm));
        snap = await getDocs(q);
      }

      if (!snap.empty) {
        const items = snap.docs.map(doc => doc.data() as SearchTicket);
        setSearchResult(items);
        setSearchedName(items[0].clientName);
      } else {
        setSearchResult([]);
      }
      setSearchDone(true);
    } catch (err: any) {
      toast({
        title: "Erro na Consulta",
        description: err.message || "Erro inesperado.",
        variant: "destructive"
      });
    } finally {
      setSearching(false);
    }
  };

  const formatMinutes = (sec: number) => {
    const min = Math.floor(sec / 60);
    const remainingSec = sec % 60;
    return `${min}:${remainingSec.toString().padStart(2, '0')}`;
  };

  // Loading Screen
  if (loadingPage) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
        <p className="mt-4 text-slate-400 text-sm">Carregando detalhes do sorteio...</p>
      </div>
    );
  }

  // Not Found Screen
  if (!raffle) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
        <h3 className="text-xl font-bold">Sorteio não encontrado ou encerrado</h3>
        <p className="text-slate-400 text-sm mt-1 max-w-sm">
          Este link pode ter expirado ou o sorteio pago foi desativado pela administração.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-950 via-slate-900 to-indigo-950 text-white font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* Visual Ambient Blur effects */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Brand Header */}
      <header className="relative z-10 max-w-4xl mx-auto px-6 py-6 flex items-center justify-between border-b border-white/5 bg-slate-950/20 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
            P
          </div>
          <span className="font-extrabold text-sm uppercase tracking-widest text-slate-100">Pre-Mix Sorteios</span>
        </div>

        <div className="flex bg-slate-900/80 p-0.5 rounded-lg border border-white/5">
          <button
            onClick={() => setActiveTab('buy')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-200 ${
              activeTab === 'buy' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Adquirir Bilhetes
          </button>
          <button
            onClick={() => {
              setActiveTab('tickets');
              setSearchResult([]);
              setSearchDone(false);
              setSearchCpfOrPhone('');
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-200 ${
              activeTab === 'tickets' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Meus Bilhetes
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 max-w-md mx-auto px-6 py-10">
        
        {activeTab === 'buy' ? (
          <AnimatePresence mode="wait">
            
            {/* SUCCESS SCREEN */}
            {paymentConfirmed ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center space-y-6 bg-slate-900/60 backdrop-blur-md p-8 rounded-3xl border border-emerald-500/20 shadow-2xl relative overflow-hidden"
              >
                {/* CSS Confetti Effect Container */}
                <div className="absolute inset-0 pointer-events-none opacity-30">
                  <div className="absolute w-2 h-2 bg-yellow-500 rounded-full left-1/4 top-1/4 animate-ping" />
                  <div className="absolute w-2.5 h-2.5 bg-blue-400 rounded-full right-1/4 top-1/3 animate-ping" />
                  <div className="absolute w-2 h-2 bg-emerald-400 rounded-full left-1/3 bottom-1/4 animate-ping" />
                </div>

                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center text-emerald-500 mx-auto animate-bounce">
                  <CheckCircle2 className="w-9 h-9" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-white">Pagamento Confirmado!</h2>
                  <p className="text-emerald-400/90 text-sm font-semibold">Seus números da sorte já foram gerados!</p>
                </div>

                <div className="bg-slate-950/80 p-5 rounded-2xl border border-white/5 space-y-4 text-left">
                  <div>
                    <span className="text-[10px] text-indigo-400 uppercase tracking-wider font-semibold">Campanha</span>
                    <h4 className="font-bold text-foreground text-sm truncate">{raffle.title}</h4>
                  </div>
                  <div>
                    <span className="text-[10px] text-indigo-400 uppercase tracking-wider font-semibold">Prêmio</span>
                    <h4 className="font-extrabold text-yellow-400 text-base">{raffle.prizeName}</h4>
                  </div>
                  <div>
                    <span className="text-[10px] text-indigo-400 uppercase tracking-wider font-semibold">Meus Números ({myTickets.length})</span>
                    <div className="grid grid-cols-3 gap-2 mt-2 max-h-32 overflow-y-auto pr-1">
                      {myTickets.map((num) => (
                        <div key={num} className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs text-center py-1.5 rounded-lg font-black tracking-wide">
                          #{num}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400">
                  Enviamos o comprovante com os números para o seu WhatsApp cadastrado. Boa sorte! 🍀
                </p>

                <Button
                  onClick={() => {
                    setPaymentConfirmed(false);
                    setPaymentId(null);
                    setPixCode('');
                    setQuantity(1);
                    setClientName('');
                    setClientCpf('');
                    setClientPhone('');
                    setClientEmail('');
                  }}
                  className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold h-12 rounded-xl shadow-lg shadow-indigo-500/20"
                >
                  Adquirir Mais Bilhetes
                </Button>
              </motion.div>
            ) : paymentId ? (
              
              /* PIX CHECKOUT SCREEN */
              <motion.div
                key="checkout"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6 bg-slate-900/60 backdrop-blur-md p-6 rounded-3xl border border-white/5 shadow-2xl"
              >
                <div className="text-center space-y-1">
                  <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-none text-[10px] uppercase font-bold tracking-widest">
                    Checkout Pix
                  </Badge>
                  <h3 className="text-xl font-black">Aguardando Pagamento</h3>
                  <p className="text-slate-400 text-xs">Pague o Pix para receber seus bilhetes instantaneamente.</p>
                </div>

                {/* QR Code and payload */}
                <div className="bg-slate-950 p-6 rounded-2xl border border-white/5 flex flex-col items-center space-y-4">
                  {pixQrCode ? (
                    <div className="bg-white p-3 rounded-2xl">
                      <img 
                        src={`data:image/png;base64,${pixQrCode}`} 
                        alt="QR Code Pix Asaas" 
                        className="w-48 h-48"
                      />
                    </div>
                  ) : (
                    <div className="w-48 h-48 bg-slate-900 rounded-2xl flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    </div>
                  )}

                  <div className="text-center">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Valor Total</span>
                    <h2 className="text-2xl font-black text-emerald-400 mt-0.5">
                      R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </h2>
                  </div>
                </div>

                {/* Expiration Timer */}
                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 bg-white/5 py-2.5 rounded-xl border border-white/5">
                  <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                  <span>
                    O Pix expira em: <b className="text-white font-mono">{formatMinutes(timeLeft)}</b>
                  </span>
                </div>

                {/* Pix copy paste */}
                <div className="space-y-2">
                  <Label className="text-xs text-slate-400">Código Pix Copia e Cola</Label>
                  <div className="flex gap-2">
                    <Input 
                      readOnly 
                      value={pixCode}
                      className="bg-slate-950 border-white/5 text-xs font-mono select-all h-10 rounded-xl"
                    />
                    <Button
                      onClick={copyPix}
                      className="bg-indigo-600 hover:bg-indigo-700 h-10 rounded-xl px-4 gap-1.5"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied ? "Copiado" : "Copiar"}
                    </Button>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setPaymentId(null);
                      setPixCode('');
                    }}
                    className="w-full text-slate-400 hover:text-white rounded-xl text-xs"
                  >
                    Voltar e alterar dados
                  </Button>
                </div>
              </motion.div>

            ) : (

              /* PURCHASE FORM SCREEN */
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Hero Prize Card */}
                <Card className="overflow-hidden border border-white/5 bg-slate-900/60 backdrop-blur-md rounded-3xl relative">
                  
                  {raffle.prizeImageUrl ? (
                    <div className="h-44 relative overflow-hidden">
                      <img 
                        src={raffle.prizeImageUrl} 
                        alt={raffle.prizeName} 
                        className="w-full h-full object-cover opacity-60"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" />
                    </div>
                  ) : (
                    <div className="h-40 bg-gradient-to-br from-indigo-900/50 via-slate-900 to-slate-950 flex items-center justify-center p-6 text-center">
                      <div className="space-y-1">
                        <Badge className="bg-indigo-500 text-white text-[9px] uppercase tracking-widest font-black rounded-full">
                          Sorteio Ativo
                        </Badge>
                        <h4 className="text-xs uppercase font-semibold text-indigo-400 mt-2">Prêmio</h4>
                        <h3 className="text-lg font-black truncate max-w-[260px]">{raffle.prizeName}</h3>
                        <p className="text-[10px] text-slate-400 line-clamp-1">{raffle.prizeDescription}</p>
                      </div>
                    </div>
                  )}

                  <CardContent className="p-6 space-y-4">
                    <div>
                      <h2 className="text-xl font-extrabold text-white">{raffle.title}</h2>
                      <p className="text-slate-400 text-xs mt-1 leading-relaxed">{raffle.description}</p>
                    </div>

                    <div className="flex justify-between items-center bg-white/5 p-3 rounded-2xl border border-white/5 text-sm">
                      <span className="text-slate-400 font-medium">Preço do Bilhete:</span>
                      <span className="font-black text-indigo-400 text-base">
                        R$ {raffle.ticketPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Sorteio previsto para: <b className="text-slate-200">{raffle.drawDate}</b></span>
                    </div>
                  </CardContent>
                </Card>

                {/* Customer Information Form */}
                <Card className="border border-white/5 bg-slate-900/60 backdrop-blur-md rounded-3xl p-6 shadow-xl">
                  <form onSubmit={handlePurchase} className="space-y-4">
                    <h3 className="font-extrabold text-base border-b border-white/5 pb-2 text-slate-200">
                      Preencha os dados de participação
                    </h3>

                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-slate-400">Nome Completo</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input 
                          id="name" 
                          placeholder="Digite seu nome"
                          required
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                          className="pl-9 bg-slate-950 border-white/5 rounded-xl h-10 text-sm focus:border-indigo-500/50"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="cpf" className="text-slate-400">CPF</Label>
                        <div className="relative">
                          <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <Input 
                            id="cpf" 
                            placeholder="000.000.000-00"
                            required
                            value={clientCpf}
                            onChange={handleCpfChange}
                            className="pl-9 bg-slate-950 border-white/5 rounded-xl h-10 text-sm"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="phone" className="text-slate-400">WhatsApp</Label>
                        <div className="relative">
                          <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <Input 
                            id="phone" 
                            placeholder="(00) 00000-0000"
                            required
                            value={clientPhone}
                            onChange={handlePhoneChange}
                            className="pl-9 bg-slate-950 border-white/5 rounded-xl h-10 text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-slate-400">E-mail (Opcional)</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input 
                          id="email" 
                          type="email"
                          placeholder="seu@email.com"
                          value={clientEmail}
                          onChange={(e) => setClientEmail(e.target.value)}
                          className="pl-9 bg-slate-950 border-white/5 rounded-xl h-10 text-sm"
                        />
                      </div>
                    </div>

                    {/* Quantity Selector */}
                    <div className="border-t border-white/5 pt-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <Label className="text-slate-300 font-bold">Quantidade de Bilhetes</Label>
                        <div className="flex items-center gap-3 bg-slate-950 p-1 rounded-xl border border-white/5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={quantity <= 1}
                            onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                            className="w-8 h-8 rounded-lg text-slate-400 hover:text-white"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </Button>
                          <span className="font-extrabold text-sm w-6 text-center">{quantity}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setQuantity(prev => prev + 1)}
                            className="w-8 h-8 rounded-lg text-slate-400 hover:text-white"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Packages hints */}
                      <div className="flex gap-2 justify-center">
                        <button
                          type="button"
                          onClick={() => setQuantity(3)}
                          className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg border transition-all ${
                            quantity === 3 
                              ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' 
                              : 'bg-white/5 text-slate-400 border-transparent hover:bg-white/10'
                          }`}
                        >
                          Pack x3
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuantity(5)}
                          className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg border transition-all ${
                            quantity === 5 
                              ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' 
                              : 'bg-white/5 text-slate-400 border-transparent hover:bg-white/10'
                          }`}
                        >
                          Pack x5
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuantity(10)}
                          className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg border transition-all ${
                            quantity === 10 
                              ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' 
                              : 'bg-white/5 text-slate-400 border-transparent hover:bg-white/10'
                          }`}
                        >
                          Pack x10
                        </button>
                      </div>

                      {/* Total Value */}
                      <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5 mt-4">
                        <span className="text-xs text-slate-400 font-medium">Subtotal de Compra</span>
                        <span className="text-xl font-black text-emerald-400">
                          R$ {(raffle.ticketPrice * quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={creatingPayment}
                      className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-extrabold h-12 rounded-xl shadow-lg shadow-indigo-500/30 gap-2 mt-4"
                    >
                      {creatingPayment ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Gerando Pix no Asaas...
                        </>
                      ) : (
                        <>
                          <QrCode className="w-5 h-5" /> Adquirir Bilhetes (Gerar Pix)
                        </>
                      )}
                    </Button>
                  </form>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        ) : (
          
          /* TAB 2: MEUS BILHETES PANEL */
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 bg-slate-900/60 backdrop-blur-md p-6 rounded-3xl border border-white/5 shadow-2xl"
          >
            <div className="text-center space-y-1">
              <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-none text-[10px] uppercase font-bold tracking-widest">
                Pesquisa de Números
              </Badge>
              <h3 className="text-xl font-black">Consultar Bilhetes</h3>
              <p className="text-slate-400 text-xs">Insira seu CPF ou WhatsApp para listar seus bilhetes adquiridos.</p>
            </div>

            <form onSubmit={handleSearchTickets} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="searchField" className="text-slate-400">CPF ou Telefone (com DDD)</Label>
                <div className="flex gap-2">
                  <Input 
                    id="searchField"
                    placeholder="Digite apenas números..."
                    required
                    value={searchCpfOrPhone}
                    onChange={(e) => setSearchCpfOrPhone(e.target.value)}
                    className="bg-slate-950 border-white/5 rounded-xl h-11 text-sm focus:border-indigo-500/50"
                  />
                  <Button
                    type="submit"
                    disabled={searching}
                    className="bg-indigo-600 hover:bg-indigo-700 rounded-xl h-11 px-5"
                  >
                    {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </form>

            <AnimatePresence>
              {searchDone && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="pt-4 border-t border-white/5 space-y-4"
                >
                  {searchResult.length === 0 ? (
                    <div className="text-center py-6 bg-slate-950/60 rounded-2xl border border-white/5">
                      <AlertCircle className="w-8 h-8 text-amber-500/60 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">
                        Nenhum bilhete confirmado encontrado para estes dados neste sorteio.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-indigo-500/5 p-4 rounded-xl border border-indigo-500/10">
                        <span className="text-[10px] text-indigo-400 uppercase tracking-wider font-semibold">Cliente</span>
                        <h4 className="font-black text-sm text-slate-200 mt-0.5">{searchedName}</h4>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs text-slate-400">Seus Bilhetes Ativos ({searchResult.length})</Label>
                        <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                          {searchResult.map((t) => (
                            <div 
                              key={t.ticketNumber} 
                              className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs text-center py-2 rounded-lg font-black tracking-wide"
                            >
                              #{t.ticketNumber}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

      </main>

      {/* Public Footer */}
      <footer className="max-w-md mx-auto text-center py-10 text-[10px] text-slate-500 relative z-10 leading-relaxed px-6">
        <p>Pre-Mix Sorteios Pagos é uma funcionalidade interna desenvolvida pela AVL Telecom.</p>
        <p className="mt-1">Pagamentos processados de forma segura e imediata pela API do Asaas.</p>
      </footer>

    </div>
  );
}

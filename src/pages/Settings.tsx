import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings2, Plus, Trash2, MessageSquare, UserPlus, Bot, Power } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PageTransition from '@/components/PageTransition';
import { db } from '@/config/firebase';
import { doc, onSnapshot, setDoc, collection, query, orderBy, limit, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from '@/components/ui/switch';
import { Label as LabelUI } from '@/components/ui/label';
import { ispfyService } from '@/services/ispfy/ispfyService';
import { ISPFYClienteData, ISPFYContratoData, ISPFYFaturaData } from '@/types/ispfy';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from 'sonner';
import { formatDate } from '@/utils/date';
import { Loader2, Building2, User, RefreshCcw, ArrowRightLeft, AlertTriangle, CheckCircle2, ShieldCheck, Users, FileText, Youtube, Pin, Send, Maximize2, Minimize2, Radio } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Filial {
  id: string;
  razao: string;
  nome_fantasia: string;
}

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

function LiveChatMonitor({
  youtubeVideoId,
  onPinMessage,
}: {
  youtubeVideoId: string;
  onPinMessage: (text: string) => void;
}) {
  const [messages, setMessages] = useState<any[]>([]);
  const [adminText, setAdminText] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const q = query(collection(db, "live_premix_chat"), orderBy("createdAt", "asc"), limit(100));
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter((m: any) => !m.deleted);
      setMessages(msgs);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 200);
    });
    return () => unsub();
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminText.trim()) return;
    const text = adminText.trim();
    setAdminText('');
    try {
      await addDoc(collection(db, "live_premix_chat"), {
        text,
        userId: 'admin_dashboard',
        userName: 'Apresentador (Host)',
        role: 'host',
        type: 'msg',
        createdAt: serverTimestamp(),
      });
      toast.success('Mensagem enviada no chat da live!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar mensagem');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await setDoc(doc(db, "live_premix_chat", id), { deleted: true }, { merge: true });
      toast.success('Mensagem apagada!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao apagar mensagem');
    }
  };

  const handleSendReaction = async (emoji: string) => {
    try {
      await addDoc(collection(db, "live_premix_reactions"), {
        emoji,
        userId: 'admin_dashboard',
        createdAt: serverTimestamp(),
      });
      toast.success(`Reação ${emoji} enviada!`);
    } catch (e) {
      console.error(e);
    }
  };

  const cleanVideoId = youtubeVideoId?.match(/(?:v=|\/live\/|\/v\/|youtu\.be\/|^)([a-zA-Z0-9_-]{11})/)?.[1] || youtubeVideoId;

  // MODO TELA CHEIA (STUDIO)
  if (isFullscreen) {
    return createPortal(
      <div className="fixed inset-0 z-[99999] bg-gray-950 text-white flex flex-col p-4 md:p-6 space-y-4 overflow-hidden w-screen h-screen">
        {/* Cabeçalho da Tela Cheia */}
        <div className="flex-none flex items-center justify-between bg-gray-900 p-4 rounded-xl border border-gray-800 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center">
              <Radio className="w-5 h-5 text-red-500 animate-pulse" />
            </div>
            <div>
              <h2 className="font-black text-base tracking-wide flex items-center gap-2">
                STUDIO LIVE PRE-MIX · MONITOR & MODERAÇÃO
              </h2>
              <p className="text-xs text-gray-400">Acompanhe as mensagens, responda e modere em tempo real</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-500/30 bg-emerald-500/10 font-black px-3 py-1">
              {messages.length} mensagens
            </Badge>
            <Button
              onClick={() => setIsFullscreen(false)}
              variant="outline"
              size="sm"
              className="bg-gray-800 hover:bg-gray-700 text-white border-gray-700 flex items-center gap-1.5 font-bold"
            >
              <Minimize2 className="w-4 h-4" />
              Sair do Modo Tela Cheia
            </Button>
          </div>
        </div>

        {/* Conteúdo Grid: Player Preview (Esquerda) + Chat Stream Gigante (Direita) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 flex-1 min-h-0 overflow-hidden">
          {/* Esquerda: Player Preview */}
          <div className="lg:col-span-5 flex flex-col gap-4 overflow-y-auto lg:overflow-visible">
            <div className="bg-black rounded-2xl overflow-hidden border border-gray-800 shadow-xl aspect-video flex items-center justify-center flex-none">
              {cleanVideoId ? (
                <iframe
                  className="w-full h-full border-0"
                  src={`https://www.youtube.com/embed/${cleanVideoId}?autoplay=1&mute=1`}
                  title="Live Preview"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="text-center p-6 text-gray-500">
                  <Youtube className="w-12 h-12 mx-auto mb-2 opacity-30 text-red-500" />
                  <p className="text-xs font-semibold">Sem vídeo no momento</p>
                </div>
              )}
            </div>

            {/* Painel de Reações Rápidas */}
            <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 space-y-2 flex-none">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Lançar Reações no App:</span>
              <div className="flex items-center justify-around">
                {['❤️', '🔥', '👏', '🎉', '🚀', '😍'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleSendReaction(emoji)}
                    className="p-2 hover:bg-gray-800 rounded-xl text-xl transition-transform active:scale-95"
                    title={`Enviar ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Direita: Feed do Chat Gigante */}
          <div className="lg:col-span-7 flex flex-col bg-gray-900/90 rounded-2xl border border-gray-800 shadow-xl overflow-hidden min-h-0 h-full">
            <div className="flex-none p-3 bg-gray-900 border-b border-gray-800 flex items-center justify-between text-xs font-bold text-gray-300">
              <span>STREAM DE MENSAGENS EM TEMPO REAL</span>
              <span>Host / Moderador Ativo</span>
            </div>

            <div className="flex-1 min-h-0 p-4 overflow-y-auto space-y-2">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-500 text-xs">
                  Nenhuma mensagem no chat no momento.
                </div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-gray-950/80 border border-gray-800/80 hover:border-gray-700 transition-colors group">
                    <div className="text-sm leading-relaxed flex-1">
                      <span className={`font-bold mr-2 ${m.role === 'host' ? 'text-red-400 font-black' : 'text-emerald-400'}`}>
                        {m.userName || 'Convidado'}
                        {m.role === 'host' && (
                          <span className="ml-1 px-1.5 py-0.5 text-[9px] bg-red-600 text-white rounded font-black tracking-wider">
                            HOST
                          </span>
                        )}
                        :
                      </span>
                      <span className="text-gray-200">{m.text}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => onPinMessage(m.text)}
                        title="Fixar mensagem no topo do chat"
                        className="p-1.5 hover:bg-gray-800 text-amber-400 rounded-lg transition-colors"
                      >
                        <Pin className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(m.id)}
                        title="Apagar mensagem"
                        className="p-1.5 hover:bg-gray-800 text-red-400 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="flex-none p-3 bg-gray-900 border-t border-gray-800 flex items-center gap-2">
              <Input
                value={adminText}
                onChange={(e) => setAdminText(e.target.value)}
                placeholder="Enviar resposta no chat como HOST/Apresentador..."
                className="flex-1 bg-gray-950 text-white border-gray-800 text-sm focus-visible:ring-emerald-500"
              />
              <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-bold flex items-center gap-2">
                <Send className="w-4 h-4" />
                Enviar
              </Button>
            </form>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // MODO NORMAL (DENTRO DA CARD)
  return (
    <div className="pt-4 border-t border-gray-100 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-emerald-600" />
          Monitor & Moderação do Chat Ao Vivo
        </span>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50 font-bold">
            {messages.length} mensagens
          </Badge>
          <Button
            type="button"
            onClick={() => setIsFullscreen(true)}
            variant="outline"
            size="sm"
            className="text-xs font-bold gap-1 text-gray-700 hover:text-emerald-700"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Expandir Studio (Tela Cheia)
          </Button>
        </div>
      </div>

      {/* Caixa do Chat com Rolagem */}
      <div className="bg-gray-950 text-white rounded-xl p-4 h-72 overflow-y-auto space-y-2 border border-gray-800">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500 text-xs">
            Nenhuma mensagem no chat no momento.
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="flex items-start justify-between gap-2 group hover:bg-gray-900/80 p-2 rounded-lg transition-colors border border-transparent hover:border-gray-800">
              <div className="text-xs leading-relaxed flex-1">
                <span className={`font-bold mr-1.5 ${m.role === 'host' ? 'text-red-400 font-extrabold' : 'text-emerald-400'}`}>
                  {m.userName || 'Convidado'}
                  {m.role === 'host' && (
                    <span className="ml-1 px-1.5 py-0.5 text-[9px] bg-red-600 text-white rounded font-black tracking-wider">
                      HOST
                    </span>
                  )}
                  :
                </span>
                <span className="text-gray-200">{m.text}</span>
              </div>
              <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => onPinMessage(m.text)}
                  title="Fixar mensagem no topo do chat"
                  className="p-1.5 hover:bg-gray-800 text-amber-400 rounded transition-colors"
                >
                  <Pin className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(m.id)}
                  title="Apagar mensagem"
                  className="p-1.5 hover:bg-gray-800 text-red-400 rounded transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input para Enviar Mensagem como HOST */}
      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
        <Input
          value={adminText}
          onChange={(e) => setAdminText(e.target.value)}
          placeholder="Digite para responder no chat como HOST/Apresentador..."
          className="flex-1 text-xs"
        />
        <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 font-bold">
          <Send className="w-3.5 h-3.5" />
          Enviar
        </Button>
      </form>
    </div>
  );
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


  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Estados da Live Pre-Mix expandidos
  const [liveConfig, setLiveConfig] = useState({
    isLive: false,
    youtubeVideoId: '',
    title: 'Live Pre-mix',
    startsAt: '',
    coverImage: '',
    pinnedMessage: '',
    offerActive: false,
    offerTitle: '',
    offerSubtitle: '',
    offerCta: '',
    offerUrl: '',
  });

  React.useEffect(() => {
    const unsubLive = onSnapshot(doc(db, "configs", "live_premix"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        let startsAtStr = '';
        if (data.startsAt?.toDate) {
          const d = data.startsAt.toDate();
          startsAtStr = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        } else if (data.startsAt) {
          const d = new Date(data.startsAt);
          if (!isNaN(d.getTime())) {
            startsAtStr = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
          }
        }
        setLiveConfig({
          isLive: data.isLive || false,
          youtubeVideoId: data.youtubeVideoId || '',
          title: data.title || 'Live Pre-mix',
          startsAt: startsAtStr,
          coverImage: data.coverImage || '',
          pinnedMessage: data.pinnedMessage || '',
          offerActive: data.offer?.active || false,
          offerTitle: data.offer?.title || '',
          offerSubtitle: data.offer?.subtitle || '',
          offerCta: data.offer?.cta || '',
          offerUrl: data.offer?.url || '',
        });
      }
    });
    return () => unsubLive();
  }, []);

  const handleToggleLive = async (checked: boolean) => {
    try {
      await setDoc(doc(db, "configs", "live_premix"), { isLive: checked }, { merge: true });
      toast.success(checked ? 'Live ativada!' : 'Live desativada!');
    } catch (e) {
      toast.error('Erro ao atualizar status da live');
    }
  };

  const handleSaveLiveConfig = async () => {
    try {
      const payload: any = { 
        youtubeVideoId: liveConfig.youtubeVideoId || '',
        title: liveConfig.title || 'Live Pre-mix',
        coverImage: liveConfig.coverImage || '',
        pinnedMessage: liveConfig.pinnedMessage || '',
        startsAt: liveConfig.startsAt ? new Date(liveConfig.startsAt) : null,
        offer: {
          active: liveConfig.offerActive,
          title: liveConfig.offerTitle || '',
          subtitle: liveConfig.offerSubtitle || '',
          cta: liveConfig.offerCta || 'Aproveitar',
          url: liveConfig.offerUrl || '',
        },
      };
      await setDoc(doc(db, "configs", "live_premix"), payload, { merge: true });
      toast.success('Configurações da Live salvas com sucesso!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar Live: verifique o console');
    }
  };  // Estado de Manutenção
  const [maintenanceGlobal, setMaintenanceGlobal] = useState<boolean>(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState<string>('Estamos em manutenção. Voltaremos em breve!');
  const [disabledScreens, setDisabledScreens] = useState<string[]>([]);
  const [loadingMaintenance, setLoadingMaintenance] = useState(true);

  const availableScreens = [
    { id: 'Jogos', name: 'Jogos e Sorteios' },
    { id: 'SpeedTest', name: 'Teste de Velocidade' },
    { id: 'RewardsStore', name: 'Loja de Recompensas' },
    { id: 'AVLPlay', name: 'AVL Play (Streaming)' },
    { id: 'Boletos', name: '2ª Via de Boletos' },
    { id: 'SupportTickets', name: 'Chamados (Suporte)' }
  ];

  // Estado do Robô WhatsApp
  const [botActive, setBotActive] = useState<boolean | null>(null);

  // Estados para Clientes por Filial
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [clientes, setClientes] = useState<ISPFYClienteData[]>([]);
  const [loadingISPFY, setLoadingISPFY] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [detectedFilialField, setDetectedFilialField] = useState<string | null>(null);
  const [clientStatus, setClientStatus] = useState<'S' | 'N'>('S');

  // Estados para Troca em Massa
  const [sourceFilialId, setSourceFilialId] = useState<string>('');
  const [targetFilialId, setTargetFilialId] = useState<string>('');
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapProgress, setSwapProgress] = useState({ current: 0, total: 0, success: 0, errors: 0 });

  // Estados para Auditoria Financeira
  const [contratos, setContratos] = useState<ISPFYContratoData[]>([]);
  const [faturasPagas, setFaturasPagas] = useState<ISPFYFaturaData[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditFilter, setAuditFilter] = useState<'todos' | 'incorretos'>('todos');

  const fetchISPFYData = async () => {
    setLoadingISPFY(true);
    setLoadingProgress(0);
    try {
      const filiaisData = await ispfyService.getFiliais();
      setFiliais(filiaisData);

      const allClientes = await ispfyService.fetchAllClientesByStatus(clientStatus, (total) => {
        setLoadingProgress(total);
      });
      setClientes(allClientes);

      // Detectar o campo de filial de forma robusta
      if (allClientes.length > 0 && filiaisData.length > 0) {
        const filialIds = new Set(filiaisData.map(f => String(f.id)));
        const keys = Object.keys(allClientes[0]);
        
        // Contar quantos matches cada campo tem
        const fieldMatches: Record<string, number> = {};
        keys.forEach(key => {
          if (key === 'id' || key === 'numero') return;
          const matches = allClientes.filter(c => c[key] && filialIds.has(String(c[key]))).length;
          if (matches > 0) fieldMatches[key] = matches;
        });

        const priorityFields = ['filial_id', 'id_filial'];
        let bestField = priorityFields.find(f => (fieldMatches[f] || 0) > 0);

        if (!bestField) {
          bestField = Object.entries(fieldMatches).reduce((a: any, b: any) => b[1] > a[1] ? b : a, ['', 0])[0];
        }
        
        if (bestField) {
          setDetectedFilialField(bestField);
        } else {
          setDetectedFilialField('filial_id');
        }
      }
      
      toast.success('Dados do ISPFY sincronizados com sucesso!');
    } catch (error) {
      console.error('Erro ao buscar dados do ISPFY:', error);
      toast.error('Erro ao sincronizar dados do ISPFY.');
    } finally {
      setLoadingISPFY(false);
    }
  };

  const handleBulkSwap = async () => {
    if (!sourceFilialId || !targetFilialId) {
      toast.error('Selecione as filiais de origem e destino.');
      return;
    }

    if (sourceFilialId === targetFilialId) {
      toast.error('As filiais de origem e destino devem ser diferentes.');
      return;
    }

    const filialField = detectedFilialField || 'filial_id';
    const clientesParaTrocar = clientes.filter(c => String(c[filialField]) === String(sourceFilialId));

    if (clientesParaTrocar.length === 0) {
      toast.error('Nenhum cliente encontrado na filial de origem.');
      return;
    }

    if (!confirm(`Tem certeza que deseja mover ${clientesParaTrocar.length} clientes para a nova filial? Esta ação não pode ser desfeita facilmente.`)) {
      return;
    }

    setIsSwapping(true);
    setSwapProgress({ current: 0, total: clientesParaTrocar.length, success: 0, errors: 0 });

    for (let i = 0; i < clientesParaTrocar.length; i++) {
      const cliente = clientesParaTrocar[i];
      const updateData = {
        ...cliente,
        filial_id: targetFilialId
      };
      
      const result = await ispfyService.updateCliente(cliente.id, updateData);
      
      setSwapProgress(prev => ({
        ...prev,
        current: i + 1,
        success: result.success ? prev.success + 1 : prev.success,
        errors: !result.success ? prev.errors + 1 : prev.errors
      }));

      await new Promise(resolve => setTimeout(resolve, 80));
    }

    toast.success('Operação concluída!');
    setIsSwapping(false);
    fetchISPFYData();
  };

  const fetchAuditData = async () => {
    setLoadingAudit(true);
    try {
      toast.info('Iniciando auditoria... Isso pode levar alguns minutos.');
      
      const allContratos = await ispfyService.fetchAllContratos((total) => {
        setLoadingProgress(total);
      });
      setContratos(allContratos);

      const recentFaturas = await ispfyService.fetchRecentFaturasPagas(180, (total) => {
        setLoadingProgress(total);
      });
      setFaturasPagas(recentFaturas);

      toast.success('Dados para auditoria carregados!');
    } catch (error) {
      console.error('Erro na auditoria:', error);
      toast.error('Erro ao carregar dados de auditoria.');
    } finally {
      setLoadingAudit(false);
    }
  };

  const getAuditResults = () => {
    // Filtrar apenas clientes ativos para a auditoria
    const activeClientes = clientes.filter(c => c.ativo === 'S');
    return activeClientes.map(cliente => {
      const contrato = contratos.find(c => String(c.id_cliente) === String(cliente.id));
      const faturasDoCliente = faturasPagas.filter(f => String(f.id_cliente) === String(cliente.id));
      const ultimaFatura = faturasDoCliente.sort((a, b) => {
        const dateA = new Date(a.data_vencimento || 0).getTime();
        const dateB = new Date(b.data_vencimento || 0).getTime();
        return dateB - dateA;
      })[0];

      const pagoAte = (contrato?.pago_ate_data || contrato?.pago_ate) as string | undefined;
      const vencimentoUltimaFull = ultimaFatura?.data_vencimento as string | undefined;
      
      // Normalizar para YYYY-MM-DD para evitar problemas com horas ou espaços
      const pagoAteNorm = pagoAte?.substring(0, 10);
      const vencimentoUltimaNorm = vencimentoUltimaFull?.substring(0, 10);
      
      const isCorrect = pagoAteNorm && vencimentoUltimaNorm && pagoAteNorm === vencimentoUltimaNorm;

      return {
        cliente,
        pagoAte: pagoAteNorm,
        vencimentoUltima: vencimentoUltimaNorm,
        isCorrect,
        contratoId: contrato?.id
      };
    }).filter(res => {
      if (auditFilter === 'incorretos') return !res.isCorrect;
      return true;
    });
  };

  const handleExportAuditPDF = () => {
    const results = getAuditResults();
    if (results.length === 0) {
      toast.error('Nenhum dado de auditoria para exportar.');
      return;
    }

    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text('AVL TELCOM - Auditoria Financeira', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 30);
    doc.text(`Filtro: ${auditFilter === 'todos' ? 'Todos os clientes ativos' : 'Somente divergências'}`, 14, 35);

    const tableHeaders = [['ID', 'Cliente', 'Pago Ate (Contrato)', 'Ultima Paga (Vencimento)', 'Status']];
    const tableRows = results.map(res => [
      res.cliente.id,
      res.cliente.razao || res.cliente.nome,
      res.pagoAte ? formatDate(res.pagoAte) : 'Sem data',
      res.vencimentoUltima ? formatDate(res.vencimentoUltima) : 'Nenhuma fatura paga',
      res.isCorrect ? 'Correto' : 'Incorreto'
    ]);

    autoTable(doc, {
      head: tableHeaders,
      body: tableRows,
      startY: 45,
      theme: 'grid',
      headStyles: { fillColor: [124, 58, 237], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 20 },
        2: { cellWidth: 35 },
        3: { cellWidth: 35 },
        4: { cellWidth: 25 }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 4) {
          const status = data.cell.raw;
          if (status === 'Incorreto') {
            data.cell.styles.textColor = [220, 38, 38]; // Red
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [22, 163, 74]; // Green
          }
        }
      }
    });

    doc.save(`auditoria_financeira_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('Relatório PDF exportado com sucesso!');
  };

  React.useEffect(() => {
    const unsubMaintenance = onSnapshot(doc(db, "settings", "maintenance"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setMaintenanceGlobal(data.global || false);
        setMaintenanceMessage(data.message || 'Estamos em manutenção. Voltaremos em breve!');
        setDisabledScreens(data.disabledScreens || []);
      }
      setLoadingMaintenance(false);
    });
    return () => unsubMaintenance();
  }, []);

  const handleToggleMaintenanceGlobal = async (checked: boolean) => {
    try {
      await setDoc(doc(db, "settings", "maintenance"), {
        global: checked
      }, { merge: true });
      toast.success(checked ? 'Modo de manutenção ATIVADO' : 'Modo de manutenção DESATIVADO');
    } catch (error) {
      toast.error("Erro ao atualizar modo de manutenção");
    }
  };

  const handleSaveMaintenanceMessage = async () => {
    try {
      await setDoc(doc(db, "settings", "maintenance"), {
        message: maintenanceMessage
      }, { merge: true });
      toast.success("Mensagem de manutenção atualizada");
    } catch (error) {
      toast.error("Erro ao atualizar mensagem");
    }
  };

  const handleToggleDisabledScreen = async (screenId: string, isChecked: boolean) => {
    try {
      const newScreens = isChecked 
        ? [...disabledScreens, screenId] 
        : disabledScreens.filter(s => s !== screenId);
      
      await setDoc(doc(db, "settings", "maintenance"), {
        disabledScreens: newScreens
      }, { merge: true });
      toast.success("Telas atualizadas");
    } catch (error) {
      toast.error("Erro ao atualizar telas");
    }
  };

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


  const [teamUsers, setTeamUsers] = useState<any[]>([]);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserAvatar, setNewUserAvatar] = useState('');
  const [newUserRole, setNewUserRole] = useState<'tecnico' | 'atendente'>('atendente');
  const [isAddingUser, setIsAddingUser] = useState(false);

  // Carregar usuários do Firestore
  React.useEffect(() => {
    const q = query(collection(db, "attendants"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTeamUsers(data);
    });
    return () => unsubscribe();
  }, []);

  const handleAddUser = async () => {
    if (newUserName.trim() && newUserEmail.trim()) {
      try {
        await addDoc(collection(db, "attendants"), {
          name: newUserName,
          email: newUserEmail,
          avatar: newUserAvatar || `https://avatar.iran.liara.run/username?username=${newUserName}`,
          role: newUserRole,
          status: 'ativo',
          createdAt: new Date().toISOString()
        });
        setNewUserName('');
        setNewUserEmail('');
        setNewUserAvatar('');
        setIsAddingUser(false);
        toast.success('Usuário cadastrado com sucesso!');
      } catch (e) {
        toast.error('Erro ao cadastrar usuário');
      }
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (confirm('Deseja realmente remover este usuário?')) {
      try {
        await deleteDoc(doc(db, "attendants", id));
        toast.success('Usuário removido');
      } catch (e) {
        toast.error('Erro ao remover');
      }
    }
  };

  const toggleUserStatus = async (id: string, currentStatus: string) => {
    try {
      await setDoc(doc(db, "attendants", id), {
        status: currentStatus === 'ativo' ? 'inativo' : 'ativo'
      }, { merge: true });
    } catch (e) {
      toast.error('Erro ao atualizar status');
    }
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
        <div className="flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Settings2 className="w-8 h-8 text-blue-600" />
              Configurações
            </h1>
            <p className="text-gray-600 mt-2">Gerencie suas configurações e equipe</p>
          </motion.div>

            <Button 
            onClick={fetchISPFYData} 
            disabled={loadingISPFY}
            variant="outline"
            className="gap-2"
          >
            {loadingISPFY ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
            Sincronizar ISPFY
          </Button>
        </div>

        {/* Controle da Live Pre-Mix */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="bg-white shadow-sm border-2 border-red-100">
            <CardHeader className="bg-red-50/50">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Youtube className="w-5 h-5 text-red-600" />
                  Controle da Live Pré-Mix
                </div>
                <div className="flex items-center gap-3">
                  <LabelUI htmlFor="live-toggle" className="text-sm font-medium text-gray-700">
                    {liveConfig.isLive ? 'Live no Ar (Ao Vivo)' : 'Live Desativada'}
                  </LabelUI>
                  <Switch 
                    id="live-toggle" 
                    checked={liveConfig.isLive}
                    onCheckedChange={handleToggleLive}
                    className="data-[state=checked]:bg-red-600"
                  />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Informações Básicas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID do Vídeo do YouTube
                  </label>
                  <Input 
                    value={liveConfig.youtubeVideoId}
                    onChange={(e) => setLiveConfig({ ...liveConfig, youtubeVideoId: e.target.value })}
                    placeholder="Ex: jfKfPfyJRdk"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Cole o link ou apenas o código após "v=" no link do YouTube.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Título da Transmissão
                  </label>
                  <Input 
                    value={liveConfig.title}
                    onChange={(e) => setLiveConfig({ ...liveConfig, title: e.target.value })}
                    placeholder="Ex: Sorteio Semanal Pre-mix"
                  />
                </div>
              </div>

              {/* Pré-Live & Contagem Regressiva */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data e Horário de Início (Contagem Regressiva)
                  </label>
                  <Input 
                    type="datetime-local"
                    value={liveConfig.startsAt}
                    onChange={(e) => setLiveConfig({ ...liveConfig, startsAt: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL da Imagem da Capa (Pré-live)
                  </label>
                  <Input 
                    value={liveConfig.coverImage}
                    onChange={(e) => setLiveConfig({ ...liveConfig, coverImage: e.target.value })}
                    placeholder="https://exemplo.com/capa.jpg"
                  />
                </div>
              </div>

              {/* Mensagem Fixada no Chat */}
              <div className="pt-2 border-t border-gray-100">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  📌 Mensagem Fixada no Chat
                </label>
                <Input 
                  value={liveConfig.pinnedMessage}
                  onChange={(e) => setLiveConfig({ ...liveConfig, pinnedMessage: e.target.value })}
                  placeholder="Ex: Sejam bem-vindos! O sorteio começará em instantes."
                />
              </div>

              {/* Banner de Oferta Especial */}
              <div className="pt-2 border-t border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-800">
                    🎁 Banner de Oferta Especial na Live
                  </span>
                  <div className="flex items-center gap-2">
                    <LabelUI htmlFor="offer-toggle" className="text-xs text-gray-600">
                      {liveConfig.offerActive ? 'Ativado' : 'Desativado'}
                    </LabelUI>
                    <Switch 
                      id="offer-toggle"
                      checked={liveConfig.offerActive}
                      onCheckedChange={(val) => setLiveConfig({ ...liveConfig, offerActive: val })}
                    />
                  </div>
                </div>

                {liveConfig.offerActive && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Título da Oferta
                      </label>
                      <Input 
                        value={liveConfig.offerTitle}
                        onChange={(e) => setLiveConfig({ ...liveConfig, offerTitle: e.target.value })}
                        placeholder="Ex: Upgrade para 1 Giga por R$ 99"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Subtítulo
                      </label>
                      <Input 
                        value={liveConfig.offerSubtitle}
                        onChange={(e) => setLiveConfig({ ...liveConfig, offerSubtitle: e.target.value })}
                        placeholder="Ex: Exclusivo para quem está assistindo"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Texto do Botão
                      </label>
                      <Input 
                        value={liveConfig.offerCta}
                        onChange={(e) => setLiveConfig({ ...liveConfig, offerCta: e.target.value })}
                        placeholder="Ex: Quero Aproveitar"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Link de Destino (WhatsApp / Site)
                      </label>
                      <Input 
                        value={liveConfig.offerUrl}
                        onChange={(e) => setLiveConfig({ ...liveConfig, offerUrl: e.target.value })}
                        placeholder="https://wa.me/55..."
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Monitor & Moderação de Chat Ao Vivo */}
              <LiveChatMonitor 
                youtubeVideoId={liveConfig.youtubeVideoId}
                onPinMessage={(msgText) => {
                  setLiveConfig(prev => ({ ...prev, pinnedMessage: msgText }));
                  toast.success('Mensagem selecionada para fixar! Clique em Salvar para aplicar.');
                }}
              />

              <Button onClick={handleSaveLiveConfig} className="bg-red-600 hover:bg-red-700 text-white w-full md:w-auto">
                Salvar Configurações da Live
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Status dos Clientes:</span>
          </div>
          <Select value={clientStatus} onValueChange={(v: 'S' | 'N') => setClientStatus(v)}>
            <SelectTrigger className="w-48 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="S">Ativos</SelectItem>
              <SelectItem value="N">Inativos</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">
            {clientStatus === 'S' ? 'Gerencie clientes com contrato ativo' : 'Gerencie clientes com contrato inativo/cancelado'}
          </p>
        </div>

        {/* Seção de Clientes por Filial */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="bg-white shadow-sm overflow-hidden border-2 border-blue-100">
            <CardHeader className="bg-blue-50/50">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  Agrupamento de Clientes ({clientStatus === 'S' ? 'Ativos' : 'Inativos'}) por Filial
                </div>
                {loadingISPFY && (
                  <Badge variant="secondary" className="animate-pulse">
                    Carregando {loadingProgress} clientes...
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {filiais.length > 0 ? (
                <Accordion type="single" collapsible className="w-full">
                  {filiais.map((filial) => {
                    const filialField = detectedFilialField || 'filial_id';
                    const clientesDaFilial = clientes.filter(c => String(c[filialField]) === String(filial.id));
                    return (
                      <AccordionItem key={filial.id} value={filial.id} className="border-b last:border-0">
                        <AccordionTrigger className="px-6 py-4 hover:bg-gray-50 flex items-center justify-between">
                          <div className="flex items-center gap-3 text-left">
                            <span className="font-bold text-gray-900">
                              {filial.nome_fantasia || filial.razao} 
                            </span>
                            <Badge variant="outline" className="bg-blue-50">
                              {clientesDaFilial.length} clientes
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="bg-gray-50/50 px-6 py-4">
                          {clientesDaFilial.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {clientesDaFilial.map((cliente) => (
                                <div key={cliente.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                    <User className="w-4 h-4 text-blue-600" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{cliente.razao || cliente.nome}</p>
                                    <p className="text-xs text-gray-500">ID: {cliente.id}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-center py-4 text-gray-500 text-sm italic">Nenhum cliente vinculado a esta filial.</p>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>Clique em "Sincronizar ISPFY" para carregar os grupos por filial</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Seção de Troca em Massa */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card className="bg-white shadow-sm border-2 border-orange-100 overflow-hidden">
            <CardHeader className="bg-orange-50/50">
              <CardTitle className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-orange-600" />
                Troca em Massa de Filial ({clientStatus === 'S' ? 'Clientes Ativos' : 'Clientes Inativos'})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Filial de Origem</label>
                  <Select value={sourceFilialId} onValueChange={setSourceFilialId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a origem" />
                    </SelectTrigger>
                    <SelectContent>
                      {filiais.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.nome_fantasia || f.razao}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-center pb-2">
                  <div className="bg-orange-100 p-2 rounded-full">
                    <ArrowRightLeft className="w-5 h-5 text-orange-600" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Filial de Destino</label>
                  <Select value={targetFilialId} onValueChange={setTargetFilialId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {filiais.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.nome_fantasia || f.razao}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isSwapping ? (
                <div className="mt-8 space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">Processando...</span>
                    <span className="text-blue-600 font-bold">{swapProgress.current} / {swapProgress.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                    <motion.div 
                      className="bg-blue-600 h-2.5"
                      initial={{ width: 0 }}
                      animate={{ width: `${(swapProgress.current / swapProgress.total) * 100}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 p-3 rounded-lg border border-green-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span className="text-xs font-medium text-green-800">Sucesso</span>
                      </div>
                      <span className="text-lg font-bold text-green-700">{swapProgress.success}</span>
                    </div>
                    <div className="bg-red-50 p-3 rounded-lg border border-red-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <span className="text-xs font-medium text-red-800">Erros</span>
                      </div>
                      <span className="text-lg font-bold text-red-700">{swapProgress.errors}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-8">
                  <Button 
                    onClick={handleBulkSwap}
                    disabled={!sourceFilialId || !targetFilialId || loadingISPFY}
                    className="w-full bg-orange-600 hover:bg-orange-700 h-12 text-lg font-bold"
                  >
                    Iniciar Troca em Massa
                  </Button>
                  <p className="text-xs text-center text-gray-500 mt-2 flex items-center justify-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Esta operação irá atualizar individualmente cada cliente via API.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Seção de Auditoria Financeira */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="bg-white shadow-sm border-2 border-purple-100 overflow-hidden">
            <CardHeader className="bg-purple-50/50">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-purple-600" />
                  Auditoria Financeira: Pago Até vs Última Fatura
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={auditFilter} onValueChange={(v: 'todos' | 'incorretos') => setAuditFilter(v)}>
                    <SelectTrigger className="w-40 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="incorretos">Somente Incorretos</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={handleExportAuditPDF}
                    disabled={loadingAudit || contratos.length === 0}
                    size="sm"
                    variant="outline"
                    className="border-purple-200 text-purple-700 hover:bg-purple-50 h-8 font-medium"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Exportar PDF
                  </Button>
                  <Button 
                    onClick={fetchAuditData} 
                    disabled={loadingAudit || loadingISPFY}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700 h-8 font-medium"
                  >
                    {loadingAudit ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
                    Rodar Auditoria
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {contratos.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-700 uppercase text-xs font-bold border-b">
                      <tr>
                        <th className="px-6 py-3">Cliente</th>
                        <th className="px-6 py-3">Pago Até (Contrato)</th>
                        <th className="px-6 py-3">Última Paga (Vencimento)</th>
                        <th className="px-6 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {getAuditResults().map((res) => (
                        <tr key={res.cliente.id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900 text-sm">{res.cliente.razao || res.cliente.nome}</div>
                            <div className="text-[10px] text-gray-500">ID: {res.cliente.id}</div>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs">
                            {res.pagoAte ? formatDate(res.pagoAte) : 'Sem data'}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs">
                            {res.vencimentoUltima ? formatDate(res.vencimentoUltima) : 'Nenhuma fatura paga'}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {res.isCorrect ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">Correto</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px]">Incorreto</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 text-center text-gray-500">
                  <ShieldCheck className="w-16 h-16 mx-auto mb-4 opacity-10" />
                  <p className="text-lg font-medium">Nenhum dado de auditoria carregado.</p>
                  <p className="text-sm">Clique em "Rodar Auditoria" para comparar os contratos com as faturas.</p>
                </div>
              )}
            </CardContent>
          </Card>
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

        {/* Seção do Modo de Manutenção */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Card className={`border-2 transition-all duration-300 ${maintenanceGlobal ? 'border-red-500/50 shadow-lg shadow-red-500/5' : 'border-gray-200 shadow-sm'}`}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${maintenanceGlobal ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Modo de Manutenção</h3>
                    <p className="text-sm font-normal text-muted-foreground">Bloqueia o acesso ao app AVL durante atualizações</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-secondary/20 p-2 rounded-full px-4 border">
                  <span className={`text-xs font-bold uppercase ${maintenanceGlobal ? 'text-red-600' : 'text-gray-500'}`}>
                    {loadingMaintenance ? 'Carregando...' : maintenanceGlobal ? 'Ativado (Bloqueado)' : 'Desativado'}
                  </span>
                  <Switch 
                    checked={maintenanceGlobal} 
                    onCheckedChange={handleToggleMaintenanceGlobal}
                    disabled={loadingMaintenance}
                  />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <label className="text-sm font-bold text-gray-700 mb-2 block">Mensagem para os usuários</label>
                  <div className="flex gap-2">
                    <Input 
                      value={maintenanceMessage}
                      onChange={(e) => setMaintenanceMessage(e.target.value)}
                      placeholder="Ex: Estamos em manutenção..."
                      className="flex-1"
                    />
                    <Button onClick={handleSaveMaintenanceMessage} variant="secondary">
                      Salvar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Essa mensagem aparecerá na tela de bloqueio do app.</p>
                </div>

                <div>
                  <label className="text-sm font-bold text-gray-700 mb-3 block">Desativar Telas Específicas (Bloqueio Parcial)</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {availableScreens.map(screen => (
                      <div key={screen.id} className="flex items-center justify-between p-3 rounded-xl border bg-gray-50">
                        <span className="text-sm font-medium text-gray-700">{screen.name}</span>
                        <Switch 
                          checked={disabledScreens.includes(screen.id)}
                          onCheckedChange={(checked) => handleToggleDisabledScreen(screen.id, checked)}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Mesmo com a manutenção global desligada, você pode desativar telas específicas. Elas não poderão ser acessadas no app.</p>
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
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            URL da Foto (Avatar)
                          </label>
                          <Input
                            value={newUserAvatar}
                            onChange={(e) => setNewUserAvatar(e.target.value)}
                            placeholder="https://link-da-foto.jpg"
                            className="w-full"
                          />
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
                      </div>
                      <div className="flex gap-2">
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                          <Button onClick={handleAddUser} size="sm" className="bg-blue-600 hover:bg-blue-700">
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
                        <div className="flex items-center gap-4 flex-1">
                          <Avatar className="w-12 h-12 border">
                            <AvatarImage src={user.avatar} />
                            <AvatarFallback className="bg-slate-100 text-slate-500 font-bold">
                              {user.name[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <h4 className="font-bold text-gray-900">{user.name}</h4>
                              <Badge className={getRoleBadgeColor(user.role)}>
                                {user.role === 'tecnico' ? 'Técnico' : 'Atendente'}
                              </Badge>
                              <Badge className={getStatusBadgeColor(user.status)}>
                                {user.status === 'ativo' ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </div>
                            <div className="text-xs text-gray-600 space-y-0.5">
                              <p><strong>E-mail:</strong> {user.email}</p>
                              <p><strong>Cadastrado em:</strong> {new Date(user.createdAt).toLocaleDateString('pt-BR')}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                            <Button
                              onClick={() => toggleUserStatus(user.id, user.status)}
                              variant="outline"
                              size="sm"
                              className={user.status === 'ativo' ? 'text-orange-600 hover:text-orange-700 border-orange-200' : 'text-green-600 hover:text-green-700 border-green-200'}
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

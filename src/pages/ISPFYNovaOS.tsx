import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Loader2, User, Phone, MapPin, Ticket, CheckCircle2,
  AlertCircle, Send, X, Navigation, Copy, ExternalLink,
  ClipboardList, ChevronRight, Radio, Wifi, WifiOff,
  Zap, Wrench, HelpCircle, Cable, Monitor, RotateCcw, MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import PageTransition from '@/components/PageTransition';
import { ispfyService } from '@/services/ispfy/ispfyService';
import type { ISPFYClienteData } from '@/types/ispfy';

// ─── Tipos de problema predefinidos ──────────────────────────────────────────
const PROBLEMS = [
  { id: 'sem_sinal', label: 'Sem Sinal / Internet', icon: WifiOff, color: 'red' },
  { id: 'lentidao', label: 'Lentidão / Queda de Velocidade', icon: Zap, color: 'orange' },
  { id: 'intermitencia', label: 'Conexão Intermitente', icon: Radio, color: 'yellow' },
  { id: 'sem_wifi', label: 'Wi-Fi com Problema', icon: Wifi, color: 'blue' },
  { id: 'roteador', label: 'Problema no Roteador', icon: Monitor, color: 'purple' },
  { id: 'cabo', label: 'Cabo Danificado / Solto', icon: Cable, color: 'pink' },
  { id: 'tecnica', label: 'Visita Técnica Agendada', icon: Wrench, color: 'green' },
  { id: 'reinstalacao', label: 'Reinstalação / Mudança', icon: RotateCcw, color: 'teal' },
  { id: 'outro', label: 'Outro Problema', icon: HelpCircle, color: 'gray' },
];

const colorMap: Record<string, { chip: string; chipSelected: string }> = {
  red:    { chip: 'border-red-500/20 text-red-400 bg-red-500/5',    chipSelected: 'border-red-500 text-red-300 bg-red-500/20 shadow-red-500/20' },
  orange: { chip: 'border-orange-500/20 text-orange-400 bg-orange-500/5', chipSelected: 'border-orange-500 text-orange-300 bg-orange-500/20 shadow-orange-500/20' },
  yellow: { chip: 'border-yellow-500/20 text-yellow-400 bg-yellow-500/5', chipSelected: 'border-yellow-500 text-yellow-300 bg-yellow-500/20 shadow-yellow-500/20' },
  blue:   { chip: 'border-blue-500/20 text-blue-400 bg-blue-500/5',   chipSelected: 'border-blue-500 text-blue-300 bg-blue-500/20 shadow-blue-500/20' },
  purple: { chip: 'border-purple-500/20 text-purple-400 bg-purple-500/5', chipSelected: 'border-purple-500 text-purple-300 bg-purple-500/20 shadow-purple-500/20' },
  pink:   { chip: 'border-pink-500/20 text-pink-400 bg-pink-500/5',   chipSelected: 'border-pink-500 text-pink-300 bg-pink-500/20 shadow-pink-500/20' },
  green:  { chip: 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5', chipSelected: 'border-emerald-500 text-emerald-300 bg-emerald-500/20 shadow-emerald-500/20' },
  teal:   { chip: 'border-teal-500/20 text-teal-400 bg-teal-500/5',   chipSelected: 'border-teal-500 text-teal-300 bg-teal-500/20 shadow-teal-500/20' },
  gray:   { chip: 'border-white/10 text-white/50 bg-white/5',         chipSelected: 'border-white/40 text-white bg-white/15 shadow-white/10' },
};

const PRIORITY_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  B: { label: 'Baixa',   color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/30' },
  N: { label: 'Normal',  color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/30' },
  A: { label: 'Alta',    color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' },
  C: { label: 'Crítica', color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const clientName = (c: ISPFYClienteData) =>
  c.nome_razao || c.nome || c.razao || 'Sem nome';

const clientPhone = (c: ISPFYClienteData) =>
  c.fone_whatsapp || c.fone_celular || c.telefone_celular || c.fone_residencial || '';

const buildAddress = (c: ISPFYClienteData): string => {
  const parts: string[] = [];
  const rua = c.endereco_cobranca_rua || c.endereco;
  const num = c.endereco_cobranca_numero;
  const bairro = c.endereco_cobranca_bairro || c.bairro;
  const cidade = c.cidade;
  const cep = c.endereco_cobranca_cep || c.cep;

  if (rua) parts.push(num ? `${rua}, ${num}` : rua);
  if (bairro) parts.push(bairro);
  if (cidade) parts.push(cidade);
  if (cep) parts.push(cep);
  return parts.join(' – ');
};

const mapsUrl = (c: ISPFYClienteData): string => {
  const lat = c.endereco_cobranca_latitude || c.latitude;
  const lng = c.endereco_cobranca_longitude || c.longitude;
  if (lat && lng) return `https://www.google.com/maps?q=${lat},${lng}`;
  const addr = buildAddress(c);
  if (addr) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
  return '';
};

const mapsEmbedUrl = (c: ISPFYClienteData): string => {
  const lat = c.endereco_cobranca_latitude || c.latitude;
  const lng = c.endereco_cobranca_longitude || c.longitude;
  if (lat && lng)
    return `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
  const addr = buildAddress(c);
  if (addr)
    return `https://maps.google.com/maps?q=${encodeURIComponent(addr)}&z=16&output=embed`;
  return '';
};

// ─── Componente Principal ─────────────────────────────────────────────────────
const ISPFYNovaOS: React.FC = () => {
  // Busca de clientes
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ISPFYClienteData[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ISPFYClienteData | null>(null);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Formulário da OS
  const [subjects, setSubjects] = useState<{ id: string; assunto: string }[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [subjectLabel, setSubjectLabel] = useState('');
  const [selectedProblems, setSelectedProblems] = useState<string[]>([]);
  const [priority, setPriority] = useState('N');
  const [observation, setObservation] = useState('');
  const [referencePoint, setReferencePoint] = useState('');

  // Estado da criação
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [createdTicketId, setCreatedTicketId] = useState('');

  // Carregar assuntos ao montar
  useEffect(() => {
    setLoadingSubjects(true);
    ispfyService
      .getTicketSubjects()
      .then(setSubjects)
      .catch(() => toast.error('Erro ao carregar assuntos'))
      .finally(() => setLoadingSubjects(false));
  }, []);

  // ─── Busca debounce ─────────────────────────────────────────────────────────
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchRef.current) clearTimeout(searchRef.current);
    if (!value.trim()) { setSearchResults([]); return; }
    searchRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await ispfyService.getClienteByNome(value);
        setSearchResults(results.slice(0, 50));
      } catch { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 400);
  }, []);

  const handleSelectClient = (c: ISPFYClienteData) => {
    setSelectedClient(c);
    setSearchResults([]);
    setSearchQuery(clientName(c));
    // Preencher ponto de referência com complemento se existir
    if (c.endereco_cobranca_complemento) {
      setReferencePoint(c.endereco_cobranca_complemento);
    }
  };

  const toggleProblem = (id: string) => {
    setSelectedProblems(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const buildDescription = (): string => {
    const problemLabels = selectedProblems.map(pid =>
      PROBLEMS.find(p => p.id === pid)?.label || pid
    );
    let desc = '';
    if (problemLabels.length > 0) {
      desc += `Problemas reportados: ${problemLabels.join(', ')}`;
    }
    if (referencePoint.trim()) {
      desc += `\nPonto de referência: ${referencePoint.trim()}`;
    }
    if (observation.trim()) {
      desc += `\nObservação: ${observation.trim()}`;
    }
    const address = buildAddress(selectedClient!);
    if (address) {
      desc += `\nEndereço: ${address}`;
    }
    return desc || 'Sem descrição';
  };

  const handleCreate = async () => {
    if (!selectedClient?.id) {
      toast.warning('Selecione um cliente.');
      return;
    }
    if (!selectedSubject) {
      toast.warning('Selecione o assunto da O.S.');
      return;
    }
    if (selectedProblems.length === 0 && !observation.trim()) {
      toast.warning('Selecione pelo menos um problema ou escreva uma observação.');
      return;
    }

    setCreating(true);
    try {
      const result = await ispfyService.createTicket({
        id_cliente: selectedClient.id,
        id_assunto: selectedSubject,
        prioridade: priority,
        mensagem: buildDescription(),
      });
      if (result.success) {
        setCreatedTicketId(result.id ?? '');
        setCreated(true);
        toast.success(`O.S. #${result.id ?? ''} criada com sucesso!`);
      } else {
        toast.error('Erro ao abrir O.S.', { description: result.message });
      }
    } catch {
      toast.error('Erro de comunicação com o servidor.');
    } finally {
      setCreating(false);
    }
  };

  const handleWhatsApp = () => {
    const rawPhone = clientPhone(selectedClient!);
    const digits = rawPhone.replace(/\D/g, '');
    if (!digits) { toast.warning('Cliente sem WhatsApp.'); return; }
    const phone = digits.startsWith('55') ? digits : `55${digits}`;
    const problemLabels = selectedProblems.map(pid =>
      PROBLEMS.find(p => p.id === pid)?.label || pid
    );
    const text = 
      `🛠 *O.S. #${createdTicketId} – Ordem de Serviço*\n` +
      `Olá, *${clientName(selectedClient!)}*!\n` +
      `Seu chamado foi registrado com sucesso.\n\n` +
      (problemLabels.length ? `📋 *Problemas:* ${problemLabels.join(', ')}\n` : '') +
      `📌 *Assunto:* ${subjectLabel}\n` +
      `⚡ *Prioridade:* ${PRIORITY_LABELS[priority]?.label}\n` +
      (referencePoint ? `📍 *Ref:* ${referencePoint}\n` : '') +
      (observation ? `📝 *Obs:* ${observation}\n` : '') +
      `\nNossa equipe entrará em contato em breve. Obrigado! 🙏`;
    
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCopyInfo = () => {
    const problemLabels = selectedProblems.map(pid =>
      PROBLEMS.find(p => p.id === pid)?.label || pid
    );
    const text = 
      `🛠 *O.S. #${createdTicketId} – Ordem de Serviço*\n` +
      `Cliente: *${clientName(selectedClient!)}*\n` +
      `Contato: ${clientPhone(selectedClient!)}\n` +
      (problemLabels.length ? `📋 *Problemas:* ${problemLabels.join(', ')}\n` : '') +
      `📌 *Assunto:* ${subjectLabel}\n` +
      `⚡ *Prioridade:* ${PRIORITY_LABELS[priority]?.label}\n` +
      (addr ? `📍 *Endereço:* ${addr}\n` : '') +
      (referencePoint ? `📍 *Ref:* ${referencePoint}\n` : '') +
      (observation ? `📝 *Obs:* ${observation}\n` : '');
      
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Informações copiadas para a área de transferência!');
    }).catch(() => {
      toast.error('Falha ao copiar informações.');
    });
  };

  const handleReset = () => {
    setSelectedClient(null);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedSubject('');
    setSubjectLabel('');
    setSelectedProblems([]);
    setPriority('N');
    setObservation('');
    setReferencePoint('');
    setCreated(false);
    setCreatedTicketId('');
  };

  const copyAddress = () => {
    if (!selectedClient) return;
    const addr = buildAddress(selectedClient);
    navigator.clipboard.writeText(addr).then(() => toast.success('Endereço copiado!'));
  };

  const addr = selectedClient ? buildAddress(selectedClient) : '';
  const mapUrl = selectedClient ? mapsEmbedUrl(selectedClient) : '';
  const mapsLink = selectedClient ? mapsUrl(selectedClient) : '';
  const hasWhatsApp = !!(
    selectedClient?.fone_whatsapp ||
    selectedClient?.fone_celular ||
    selectedClient?.telefone_celular
  );

  return (
    <PageTransition>
      <div
        className="min-h-screen p-4 md:p-6 lg:p-8"
        style={{ background: 'linear-gradient(135deg, #0a0c14 0%, #0f1220 50%, #0a0c14 100%)' }}
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center gap-4"
        >
          <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-xl shadow-emerald-500/30">
            <ClipboardList className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Abrir Ordem de Serviço</h1>
            <p className="text-white/40 text-sm mt-0.5">
              Busque o cliente, selecione o problema e registre a O.S.
            </p>
          </div>
        </motion.div>

        {/* ─── Sucesso ─── */}
        <AnimatePresence mode="wait">
          {created ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-lg mx-auto"
            >
              <div
                className="rounded-3xl border border-white/10 p-8 flex flex-col items-center gap-6 text-center"
                style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)' }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.1 }}
                  className="p-6 rounded-full bg-emerald-500/10 ring-4 ring-emerald-500/20"
                >
                  <CheckCircle2 className="w-14 h-14 text-emerald-400" />
                </motion.div>

                <div>
                  <p className="text-3xl font-bold text-white">O.S. #{createdTicketId}</p>
                  <p className="text-white/50 mt-1">
                    Criada para <span className="text-white/80 font-semibold">{clientName(selectedClient!)}</span>
                  </p>
                </div>

                {/* Resumo */}
                <div className="w-full rounded-2xl border border-white/10 divide-y divide-white/5 text-left overflow-hidden">
                  <div className="flex justify-between items-center px-4 py-3">
                    <span className="text-white/40 text-sm">Assunto</span>
                    <span className="text-white text-sm font-medium text-right max-w-[200px] truncate">{subjectLabel}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3">
                    <span className="text-white/40 text-sm">Prioridade</span>
                    <span className={`text-sm font-semibold ${PRIORITY_LABELS[priority]?.color}`}>
                      {PRIORITY_LABELS[priority]?.label}
                    </span>
                  </div>
                  {selectedProblems.length > 0 && (
                    <div className="px-4 py-3">
                      <span className="text-white/40 text-sm block mb-2">Problemas</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedProblems.map(pid => {
                          const p = PROBLEMS.find(pr => pr.id === pid);
                          return p ? (
                            <Badge key={pid} className="bg-white/10 text-white/70 border-white/10 text-xs">
                              {p.label}
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                  {addr && (
                    <div className="flex justify-between items-start px-4 py-3 gap-3">
                      <span className="text-white/40 text-sm shrink-0">Endereço</span>
                      <span className="text-white/70 text-xs text-right">{addr}</span>
                    </div>
                  )}
                  {clientPhone(selectedClient!) && (
                    <div className="flex justify-between items-center px-4 py-3">
                      <span className="text-white/40 text-sm">Contato</span>
                      <span className="text-white/70 text-sm">{clientPhone(selectedClient!)}</span>
                    </div>
                  )}
                </div>

                {/* Ações */}
                <div className="w-full flex flex-col gap-3">
                  {hasWhatsApp && (
                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={handleWhatsApp}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-white"
                      style={{
                        background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                        boxShadow: '0 4px 20px rgba(37,211,102,0.35)',
                      }}
                    >
                      <MessageSquare className="w-4 h-4" />
                      Notificar pelo WhatsApp
                      <Send className="w-4 h-4" />
                    </motion.button>
                  )}
                  <Button
                    variant="outline"
                    onClick={handleCopyInfo}
                    className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white"
                  >
                    <Copy className="w-4 h-4" />
                    Copiar Informações da O.S.
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleReset}
                    className="w-full text-white/40 hover:text-white hover:bg-white/5 border border-white/5"
                  >
                    Abrir Nova O.S.
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 xl:grid-cols-5 gap-6">
              {/* ─── Coluna esquerda: formulário ─── */}
              <div className="xl:col-span-3 flex flex-col gap-5">

                {/* Busca de cliente */}
                <Section title="1. Selecionar Cliente" icon={<User className="w-4 h-4" />}>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                    <Input
                      value={searchQuery}
                      onChange={e => handleSearchChange(e.target.value)}
                      placeholder="Digite o nome do cliente..."
                      className="pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-emerald-500 focus-visible:border-emerald-500/40 h-11"
                    />
                    {searchLoading && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400 animate-spin" />
                    )}
                    {selectedClient && !searchLoading && (
                      <button
                        onClick={() => { setSelectedClient(null); setSearchQuery(''); setSearchResults([]); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Resultados */}
                  <AnimatePresence>
                    {searchResults.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="mt-2 rounded-xl border border-white/10 overflow-hidden divide-y divide-white/5 max-h-[300px] overflow-y-auto custom-scrollbar"
                        style={{ background: 'rgba(10,12,20,0.95)', backdropFilter: 'blur(16px)' }}
                      >
                        {searchResults.map(c => (
                          <button
                            key={c.id}
                            onClick={() => handleSelectClient(c)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-emerald-500/5 transition-colors text-left group"
                          >
                            <div className="w-8 h-8 rounded-lg bg-white/5 group-hover:bg-emerald-500/10 flex items-center justify-center transition-colors shrink-0">
                              <User className="w-3.5 h-3.5 text-white/40 group-hover:text-emerald-400 transition-colors" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">{clientName(c)}</p>
                              <div className="flex items-center gap-3 mt-0.5">
                                {clientPhone(c) && (
                                  <span className="text-xs text-white/35 flex items-center gap-1">
                                    <Phone className="w-2.5 h-2.5" />{clientPhone(c)}
                                  </span>
                                )}
                                {(c.cidade || c.endereco_cobranca_bairro) && (
                                  <span className="text-xs text-white/35 flex items-center gap-1">
                                    <MapPin className="w-2.5 h-2.5" />{c.endereco_cobranca_bairro || c.cidade}
                                  </span>
                                )}
                              </div>
                            </div>
                            {c.ativo === 'S' && (
                              <Badge className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">Ativo</Badge>
                            )}
                            <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-emerald-400 transition-colors shrink-0" />
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Cliente selecionado — card resumo */}
                  <AnimatePresence>
                    {selectedClient && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 rounded-2xl border border-emerald-500/25 p-4 space-y-3"
                        style={{ background: 'rgba(16,185,129,0.04)' }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <User className="w-5 h-5 text-emerald-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold">{clientName(selectedClient)}</p>
                            <p className="text-white/40 text-xs mt-0.5">ID #{selectedClient.id}</p>
                          </div>
                          {selectedClient.ativo === 'S' ? (
                            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-xs shrink-0">Ativo</Badge>
                          ) : (
                            <Badge className="bg-red-500/10 text-red-400 border border-red-500/25 text-xs shrink-0">Inativo</Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {/* Contato */}
                          {clientPhone(selectedClient) && (
                            <InfoRow
                              icon={<Phone className="w-3.5 h-3.5 text-emerald-400" />}
                              label="Contato"
                              value={clientPhone(selectedClient)}
                            />
                          )}
                          {selectedClient.email && (
                            <InfoRow
                              icon={<MessageSquare className="w-3.5 h-3.5 text-blue-400" />}
                              label="E-mail"
                              value={selectedClient.email}
                            />
                          )}
                        </div>

                        {/* Endereço */}
                        {addr && (
                          <div className="rounded-xl bg-white/5 border border-white/5 p-3 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-white/40 text-xs flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> Endereço
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={copyAddress}
                                  className="text-white/20 hover:text-white/60 transition-colors"
                                  title="Copiar endereço"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                {mapsLink && (
                                  <a
                                    href={mapsLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-white/20 hover:text-emerald-400 transition-colors"
                                    title="Abrir no Google Maps"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                            </div>
                            <p className="text-white/80 text-sm leading-relaxed">{addr}</p>
                          </div>
                        )}

                        {/* Ponto de referência */}
                        <div className="space-y-1">
                          <Label className="text-xs text-white/40 flex items-center gap-1">
                            <Navigation className="w-3 h-3" /> Ponto de Referência
                          </Label>
                          <Input
                            value={referencePoint}
                            onChange={e => setReferencePoint(e.target.value)}
                            placeholder="Ex: Próximo à padaria, casa azul..."
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-emerald-500 focus-visible:border-emerald-500/40 text-sm h-9"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Section>

                {/* Lista de problemas */}
                <Section title="2. Tipo de Problema" icon={<AlertCircle className="w-4 h-4" />}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PROBLEMS.map(problem => {
                      const selected = selectedProblems.includes(problem.id);
                      const colors = colorMap[problem.color];
                      const Icon = problem.icon;
                      return (
                        <motion.button
                          key={problem.id}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => toggleProblem(problem.id)}
                          className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all duration-200 ${
                            selected
                              ? `${colors.chipSelected} shadow-lg shadow-current/10 scale-[1.02]`
                              : colors.chip + ' hover:brightness-125'
                          }`}
                        >
                          {selected && (
                            <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-current/20 flex items-center justify-center">
                              <CheckCircle2 className="w-3 h-3" />
                            </span>
                          )}
                          <Icon className="w-5 h-5" />
                          <span className="text-center leading-tight">{problem.label}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </Section>

                {/* Assunto e Prioridade */}
                <Section title="3. Assunto e Prioridade" icon={<Ticket className="w-4 h-4" />}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Assunto */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-white/50">
                        Assunto <span className="text-red-400">*</span>
                      </Label>
                      {loadingSubjects ? (
                        <div className="flex items-center gap-2 text-white/30 text-sm h-10 px-3 rounded-lg bg-white/5 border border-white/10">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando...
                        </div>
                      ) : (
                        <Select
                          value={selectedSubject}
                          onValueChange={v => {
                            setSelectedSubject(v);
                            setSubjectLabel(subjects.find(s => s.id === v)?.assunto ?? v);
                          }}
                        >
                          <SelectTrigger className="bg-white/5 border-white/10 text-white focus:ring-emerald-500 focus:border-emerald-500/40 data-[placeholder]:text-white/30 h-10">
                            <SelectValue placeholder="Selecionar assunto..." />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0f1220] border-white/10 text-white max-h-48">
                            {subjects.map(s => (
                              <SelectItem
                                key={s.id}
                                value={s.id}
                                className="focus:bg-emerald-500/10 focus:text-emerald-300"
                              >
                                {s.assunto}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {/* Prioridade */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-white/50">Prioridade</Label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {Object.entries(PRIORITY_LABELS).map(([key, { label, color, bg }]) => (
                          <button
                            key={key}
                            onClick={() => setPriority(key)}
                            className={`h-10 rounded-lg text-xs font-semibold border transition-all ${
                              priority === key
                                ? `${bg} ${color} scale-[1.04] shadow-md`
                                : 'bg-white/5 border-white/5 text-white/35 hover:bg-white/10'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Observação */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-white/50">Observação adicional</Label>
                    <Textarea
                      value={observation}
                      onChange={e => setObservation(e.target.value)}
                      placeholder="Descreva detalhes adicionais do problema..."
                      rows={3}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-emerald-500 focus-visible:border-emerald-500/40 resize-none text-sm"
                    />
                  </div>
                </Section>

                {/* Botão criar */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCreate}
                  disabled={creating || !selectedClient || !selectedSubject}
                  className="w-full h-12 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, #059669 0%, #16a34a 100%)',
                    boxShadow: creating ? 'none' : '0 4px 24px rgba(5,150,105,0.4)',
                  }}
                >
                  {creating ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Abrindo O.S....</>
                  ) : (
                    <><Ticket className="w-5 h-5" /> Abrir Ordem de Serviço</>
                  )}
                </motion.button>
              </div>

              {/* ─── Coluna direita: mapa + info ─── */}
              <div className="xl:col-span-2 flex flex-col gap-5">
                {/* Mapa */}
                <div
                  className="rounded-3xl border border-white/10 overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.02)' }}
                >
                  <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                    <span className="text-white/60 text-sm font-medium flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-emerald-400" /> Localização
                    </span>
                    {mapsLink && (
                      <a
                        href={mapsLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:text-emerald-300 text-xs flex items-center gap-1 transition-colors"
                      >
                        <Navigation className="w-3 h-3" /> Abrir Maps
                      </a>
                    )}
                  </div>

                  {mapUrl ? (
                    <div className="relative" style={{ paddingBottom: '75%' }}>
                      <iframe
                        key={mapUrl}
                        src={mapUrl}
                        className="absolute inset-0 w-full h-full border-0"
                        allowFullScreen
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        title="Localização do cliente"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-white/15">
                      <MapPin className="w-12 h-12 mb-3" />
                      <p className="text-sm">Selecione um cliente para ver o mapa</p>
                    </div>
                  )}
                </div>

                {/* Resumo do cliente */}
                <AnimatePresence>
                  {selectedClient && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-3xl border border-white/10 divide-y divide-white/5 overflow-hidden"
                      style={{ background: 'rgba(255,255,255,0.02)' }}
                    >
                      <div className="px-4 py-3">
                        <span className="text-white/50 text-xs font-medium uppercase tracking-widest">
                          Dados do Cliente
                        </span>
                      </div>

                      {[
                        { label: 'Nome', value: clientName(selectedClient) },
                        { label: 'ID', value: `#${selectedClient.id}` },
                        ...(clientPhone(selectedClient) ? [{ label: 'Telefone', value: clientPhone(selectedClient) }] : []),
                        ...(selectedClient.fone_whatsapp ? [{ label: 'WhatsApp', value: selectedClient.fone_whatsapp }] : []),
                        ...(selectedClient.email ? [{ label: 'E-mail', value: selectedClient.email }] : []),
                        ...(addr ? [{ label: 'Endereço', value: addr }] : []),
                        ...(referencePoint ? [{ label: 'Ponto Ref.', value: referencePoint }] : []),
                        ...(selectedClient.cidade ? [{ label: 'Cidade', value: selectedClient.cidade }] : []),
                      ].map(row => (
                        <div key={row.label} className="flex items-start gap-3 px-4 py-2.5">
                          <span className="text-white/35 text-xs w-20 shrink-0 pt-0.5">{row.label}</span>
                          <span className="text-white/80 text-sm flex-1 break-words">{row.value}</span>
                        </div>
                      ))}

                      {/* Problemas selecionados */}
                      {selectedProblems.length > 0 && (
                        <div className="px-4 py-3">
                          <span className="text-white/35 text-xs block mb-2">Problemas</span>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedProblems.map(pid => {
                              const p = PROBLEMS.find(pr => pr.id === pid);
                              const col = p ? colorMap[p.color] : colorMap.gray;
                              return p ? (
                                <span key={pid} className={`text-xs px-2 py-0.5 rounded-lg border ${col.chipSelected}`}>
                                  {p.label}
                                </span>
                              ) : null;
                            })}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
};

// ─── Subcomponentes auxiliares ────────────────────────────────────────────────
const Section: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, children }) => (
  <div
    className="rounded-3xl border border-white/10 overflow-hidden"
    style={{ background: 'rgba(255,255,255,0.02)' }}
  >
    <div className="px-5 py-3.5 border-b border-white/5 flex items-center gap-2">
      <span className="text-emerald-400">{icon}</span>
      <span className="text-white/80 text-sm font-semibold">{title}</span>
    </div>
    <div className="p-5 space-y-4">{children}</div>
  </div>
);

const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({
  icon, label, value,
}) => (
  <div className="flex items-start gap-2 rounded-lg bg-white/5 px-3 py-2">
    <span className="mt-0.5 shrink-0">{icon}</span>
    <div>
      <p className="text-white/35 text-[10px] uppercase tracking-wide">{label}</p>
      <p className="text-white/80 text-sm break-all">{value}</p>
    </div>
  </div>
);

export default ISPFYNovaOS;

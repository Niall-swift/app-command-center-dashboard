import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ispfyService } from '@/services/ispfy/ispfyService';
import type { ISPFYClienteData } from '@/types/ispfy';
import { toast } from 'sonner';
import {
  Search,
  Loader2,
  CheckCircle2,
  User,
  Phone,
  MapPin,
  Ticket,
  ChevronRight,
  ChevronLeft,
  Send,
  X,
  AlertCircle,
  PlusCircle,
} from 'lucide-react';

// ─── WhatsApp SVG Icon ────────────────────────────────────────────────────────
const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

// ─── Priority labels ──────────────────────────────────────────────────────────
const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  B: { label: 'Baixa', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  N: { label: 'Normal', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  A: { label: 'Alta', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  C: { label: 'Crítica', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface QuickOSModalProps {
  /** Se fornecido, pula direto para o passo 2 (dados da O.S.) */
  preselectedClient?: ISPFYClienteData;
  /** Trigger personalizado — se omitido, usa o botão padrão */
  trigger?: React.ReactNode;
  /** Callback chamado após criação bem-sucedida */
  onSuccess?: (ticketId: string) => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────
export const QuickOSModal: React.FC<QuickOSModalProps> = ({
  preselectedClient,
  trigger,
  onSuccess,
}) => {
  const [open, setOpen] = useState(false);

  // Etapa 1 = buscar cliente | 2 = dados da OS | 3 = sucesso
  const [step, setStep] = useState<1 | 2 | 3>(preselectedClient ? 2 : 1);

  // ── Etapa 1: busca ─────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ISPFYClienteData[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ISPFYClienteData | null>(
    preselectedClient ?? null
  );
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Etapa 2: dados da OS ────────────────────────────────────────────────────
  const [subjects, setSubjects] = useState<{ id: string; assunto: string }[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [subjectLabel, setSubjectLabel] = useState('');
  const [priority, setPriority] = useState('N');
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);

  // ── Etapa 3: sucesso ────────────────────────────────────────────────────────
  const [createdTicketId, setCreatedTicketId] = useState('');

  // ─── Reset quando abre/fecha ─────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      if (preselectedClient) {
        setSelectedClient(preselectedClient);
        setStep(2);
      } else {
        setStep(1);
        setSelectedClient(null);
        setSearchQuery('');
        setSearchResults([]);
      }
      setSelectedSubject('');
      setSubjectLabel('');
      setPriority('N');
      setMessage('');
      setCreatedTicketId('');
    }
  }, [open, preselectedClient]);

  // ─── Carregar assuntos ao entrar no passo 2 ──────────────────────────────
  useEffect(() => {
    if (step === 2 && subjects.length === 0) {
      setLoadingSubjects(true);
      ispfyService
        .getTicketSubjects()
        .then(setSubjects)
        .catch(() => toast.error('Erro ao carregar assuntos'))
        .finally(() => setLoadingSubjects(false));
    }
  }, [step]);

  // ─── Debounce de busca ────────────────────────────────────────────────────
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchRef.current) clearTimeout(searchRef.current);
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }
    searchRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await ispfyService.getClienteByNome(value);
        setSearchResults(results.slice(0, 8));
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
  }, []);

  // ─── Selecionar cliente ───────────────────────────────────────────────────
  const handleSelectClient = (c: ISPFYClienteData) => {
    setSelectedClient(c);
    setStep(2);
  };

  // ─── Criar O.S. ──────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!selectedClient?.id || !selectedSubject || !message.trim()) {
      toast.warning('Preencha todos os campos obrigatórios.');
      return;
    }
    setCreating(true);
    try {
      const result = await ispfyService.createTicket({
        id_cliente: selectedClient.id,
        id_assunto: selectedSubject,
        prioridade: priority,
        mensagem: message,
      });
      if (result.success) {
        const tid = result.id ?? '';
        setCreatedTicketId(tid);
        setStep(3);
        onSuccess?.(tid);
      } else {
        toast.error('Erro ao abrir O.S.', { description: result.message });
      }
    } catch {
      toast.error('Erro de comunicação com o servidor.');
    } finally {
      setCreating(false);
    }
  };

  // ─── Enviar WhatsApp ──────────────────────────────────────────────────────
  const handleWhatsApp = () => {
    const rawPhone =
      selectedClient?.fone_whatsapp ||
      selectedClient?.fone_celular ||
      selectedClient?.telefone_celular ||
      '';

    const digitsOnly = rawPhone.replace(/\D/g, '');
    if (!digitsOnly) {
      toast.warning('Este cliente não possui número de WhatsApp cadastrado.');
      return;
    }

    // Garante prefixo 55 (Brasil)
    const internationalPhone = digitsOnly.startsWith('55')
      ? digitsOnly
      : `55${digitsOnly}`;

    const clientName =
      selectedClient?.nome_razao ||
      selectedClient?.nome ||
      selectedClient?.razao ||
      'Cliente';

    const priorityLabel = PRIORITY_LABELS[priority]?.label || priority;

    const text = encodeURIComponent(
      `🛠 *Ordem de Serviço Aberta*\n` +
      `Olá, *${clientName}*!\n` +
      `Seu chamado foi registrado com sucesso.\n\n` +
      `📋 *O.S. Nº:* ${createdTicketId || 'N/A'}\n` +
      `📌 *Assunto:* ${subjectLabel}\n` +
      `⚡ *Prioridade:* ${priorityLabel}\n` +
      `📝 *Descrição:* ${message}\n\n` +
      `Nossa equipe entrará em contato em breve. Obrigado! 🙏`
    );

    window.open(`https://wa.me/${internationalPhone}?text=${text}`, '_blank');
  };

  // ─── Helpers de exibição ─────────────────────────────────────────────────
  const clientDisplayName = (c: ISPFYClienteData) =>
    c.nome_razao || c.nome || c.razao || 'Sem nome';

  const clientPhone = (c: ISPFYClienteData) =>
    c.fone_whatsapp || c.fone_celular || c.fone_residencial || '';

  const clientCity = (c: ISPFYClienteData) =>
    c.endereco_cobranca_bairro || c.cidade || '';

  const hasWhatsApp = !!(
    selectedClient?.fone_whatsapp ||
    selectedClient?.fone_celular ||
    selectedClient?.telefone_celular
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            size="sm"
            className="bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-700 hover:to-green-600 text-white shadow-lg shadow-green-500/20 border-0 gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            Nova O.S.
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg p-0 overflow-hidden border-0 bg-[#0f1117] shadow-2xl shadow-black/50">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-green-500/30">
              <Ticket className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-white text-lg font-bold">
                {step === 1 && 'Nova Ordem de Serviço'}
                {step === 2 && 'Dados da O.S.'}
                {step === 3 && 'O.S. Criada com Sucesso!'}
              </DialogTitle>
              {/* Step indicator */}
              <div className="flex items-center gap-1.5 mt-1">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      s === step
                        ? 'w-6 bg-emerald-400'
                        : s < step
                        ? 'w-3 bg-emerald-600'
                        : 'w-3 bg-white/10'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="px-6 py-5 min-h-[320px]">
          <AnimatePresence mode="wait">
            {/* ─── STEP 1: Buscar Cliente ─── */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* Search input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <Input
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Buscar cliente por nome..."
                    className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-emerald-500 focus-visible:border-emerald-500/50"
                  />
                  {searchLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400 animate-spin" />
                  )}
                </div>

                {/* Results */}
                <div className="space-y-1 max-h-[260px] overflow-y-auto pr-1 custom-scroll">
                  {searchResults.length > 0 ? (
                    searchResults.map((c) => (
                      <motion.button
                        key={c.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => handleSelectClient(c)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-emerald-500/30 transition-all text-left group"
                      >
                        <div className="p-2 rounded-lg bg-white/5 group-hover:bg-emerald-500/10 transition-colors">
                          <User className="w-4 h-4 text-white/50 group-hover:text-emerald-400 transition-colors" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {clientDisplayName(c)}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {clientPhone(c) && (
                              <span className="text-xs text-white/40 flex items-center gap-1">
                                <Phone className="w-2.5 h-2.5" />
                                {clientPhone(c)}
                              </span>
                            )}
                            {clientCity(c) && (
                              <span className="text-xs text-white/40 flex items-center gap-1">
                                <MapPin className="w-2.5 h-2.5" />
                                {clientCity(c)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {c.ativo === 'S' && (
                            <Badge className="h-5 text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 border">
                              Ativo
                            </Badge>
                          )}
                          <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-emerald-400 transition-colors" />
                        </div>
                      </motion.button>
                    ))
                  ) : searchQuery.length > 1 && !searchLoading ? (
                    <div className="flex flex-col items-center justify-center py-10 text-white/30">
                      <AlertCircle className="w-8 h-8 mb-2" />
                      <p className="text-sm">Nenhum cliente encontrado</p>
                    </div>
                  ) : !searchQuery ? (
                    <div className="flex flex-col items-center justify-center py-10 text-white/20">
                      <Search className="w-8 h-8 mb-2" />
                      <p className="text-sm">Digite o nome do cliente para buscar</p>
                    </div>
                  ) : null}
                </div>
              </motion.div>
            )}

            {/* ─── STEP 2: Dados da OS ─── */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* Cliente selecionado — card resumo */}
                {selectedClient && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                      <User className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {clientDisplayName(selectedClient)}
                      </p>
                      <p className="text-xs text-white/40 truncate">
                        {clientPhone(selectedClient) || 'Sem telefone'} · ID {selectedClient.id}
                      </p>
                    </div>
                    {!preselectedClient && (
                      <button
                        onClick={() => setStep(1)}
                        className="p-1 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}

                {/* Assunto */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-white/60">
                    Assunto <span className="text-red-400">*</span>
                  </Label>
                  {loadingSubjects ? (
                    <div className="flex items-center gap-2 text-white/30 text-sm p-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Carregando assuntos...
                    </div>
                  ) : (
                    <Select
                      value={selectedSubject}
                      onValueChange={(v) => {
                        setSelectedSubject(v);
                        const found = subjects.find((s) => s.id === v);
                        setSubjectLabel(found?.assunto ?? v);
                      }}
                    >
                      <SelectTrigger className="bg-white/5 border-white/10 text-white focus:ring-emerald-500 focus:border-emerald-500/50 data-[placeholder]:text-white/30">
                        <SelectValue placeholder="Selecione o assunto..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1d27] border-white/10 text-white">
                        {subjects.map((s) => (
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
                  <Label className="text-xs font-medium text-white/60">Prioridade</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {Object.entries(PRIORITY_LABELS).map(([key, { label, color }]) => (
                      <button
                        key={key}
                        onClick={() => setPriority(key)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all ${
                          priority === key
                            ? `${color} scale-[1.02] shadow-md`
                            : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mensagem */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-white/60">
                    Descrição do problema <span className="text-red-400">*</span>
                  </Label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Descreva o problema do cliente..."
                    rows={3}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-emerald-500 focus-visible:border-emerald-500/50 resize-none"
                  />
                </div>
              </motion.div>
            )}

            {/* ─── STEP 3: Sucesso ─── */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center justify-center py-6 space-y-5"
              >
                {/* Checkmark animado */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.1 }}
                  className="p-5 rounded-full bg-emerald-500/10 ring-4 ring-emerald-500/20"
                >
                  <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                </motion.div>

                <div className="text-center space-y-1">
                  <p className="text-white font-bold text-lg">
                    O.S. #{createdTicketId} aberta!
                  </p>
                  <p className="text-white/40 text-sm">
                    A ordem de serviço foi criada para{' '}
                    <span className="text-white/70 font-medium">
                      {selectedClient ? clientDisplayName(selectedClient) : 'o cliente'}
                    </span>
                    .
                  </p>
                </div>

                {/* Resumo da OS */}
                <div className="w-full p-4 rounded-xl bg-white/5 border border-white/10 space-y-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-white/40">Assunto</span>
                    <span className="text-white text-right font-medium truncate max-w-[200px]">
                      {subjectLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/40">Prioridade</span>
                    <Badge
                      className={`text-[10px] border ${PRIORITY_LABELS[priority]?.color}`}
                    >
                      {PRIORITY_LABELS[priority]?.label}
                    </Badge>
                  </div>
                  {clientPhone(selectedClient!) && (
                    <div className="flex items-center justify-between">
                      <span className="text-white/40">WhatsApp</span>
                      <span className="text-white/70 text-xs">
                        {clientPhone(selectedClient!)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Botão WhatsApp */}
                {hasWhatsApp ? (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleWhatsApp}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-white transition-all"
                    style={{
                      background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                      boxShadow: '0 4px 20px rgba(37,211,102,0.3)',
                    }}
                  >
                    <WhatsAppIcon />
                    Enviar pelo WhatsApp
                    <Send className="w-4 h-4 ml-1" />
                  </motion.button>
                ) : (
                  <div className="flex items-center gap-2 text-yellow-400/70 text-xs bg-yellow-500/5 border border-yellow-500/10 rounded-lg px-3 py-2 w-full">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Cliente sem WhatsApp cadastrado no ISPFY</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center justify-between gap-3 border-t border-white/5 pt-4">
          {step === 1 && (
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              className="text-white/40 hover:text-white hover:bg-white/5"
            >
              Cancelar
            </Button>
          )}
          {step === 2 && (
            <>
              {!preselectedClient ? (
                <Button
                  variant="ghost"
                  onClick={() => setStep(1)}
                  className="text-white/40 hover:text-white hover:bg-white/5 gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Voltar
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  className="text-white/40 hover:text-white hover:bg-white/5"
                >
                  Cancelar
                </Button>
              )}
              <Button
                onClick={handleCreate}
                disabled={creating || !selectedSubject || !message.trim()}
                className="bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-700 hover:to-green-600 text-white border-0 shadow-lg shadow-green-500/20 disabled:opacity-40 gap-2"
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Ticket className="w-4 h-4" />
                )}
                {creating ? 'Criando...' : 'Criar O.S.'}
              </Button>
            </>
          )}
          {step === 3 && (
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              className="ml-auto text-white/40 hover:text-white hover:bg-white/5"
            >
              Fechar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuickOSModal;

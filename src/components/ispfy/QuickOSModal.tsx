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
import { whapiService, DEFAULT_AVL_WHATSAPP_GROUPS } from '@/services/whapi/whapiService';
import type { WhapiGroup } from '@/types/whapi';
import { toast } from 'sonner';
import { useDailyOS } from '@/hooks/useDailyOS';
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
  Copy,
  Wifi,
  Calendar,
} from 'lucide-react';

// ─── WhatsApp SVG Icon ────────────────────────────────────────────────────────
const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

// ─── Priority labels ──────────────────────────────────────────────────────────
const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  B: { label: 'Baixa', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  N: { label: 'Normal', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  A: { label: 'Alta', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' },
  C: { label: 'Crítica', color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' },
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
  const [allClients, setAllClients] = useState<ISPFYClienteData[]>([]);
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
  const [clientPlan, setClientPlan] = useState('');
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [creating, setCreating] = useState(false);

  // ── Etapa 3: sucesso & Envio WhatsApp ───────────────────────────────────────
  const [createdTicketId, setCreatedTicketId] = useState('');
  const [createdDailyFormatted, setCreatedDailyFormatted] = useState<string | null>(null);

  // ─── Contagem Diária de O.S. (Reinicia a cada dia às 00:00) ────────────────
  const {
    count: dailyCount,
    formattedNextDailyNumber,
    registerOS,
  } = useDailyOS();

  const [whatsappGroups, setWhatsappGroups] = useState<WhapiGroup[]>(DEFAULT_AVL_WHATSAPP_GROUPS);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedGroupPhone, setSelectedGroupPhone] = useState('120363426874994471-group');
  const [sendToGroupOnCreate, setSendToGroupOnCreate] = useState(true);
  const [sendingToGroup, setSendingToGroup] = useState(false);
  const [sentGroupSuccess, setSentGroupSuccess] = useState<string | null>(null);

  // Carregar grupos atualizados do WhatsApp ao montar
  useEffect(() => {
    whapiService
      .getGroups()
      .then((groups) => {
        if (groups && groups.length > 0) {
          setWhatsappGroups(groups);
          if (!selectedGroupPhone) {
            const defaultGroup = groups.find(g => 
              g.phone === '120363426874994471-group' ||
              g.name.toUpperCase().includes('OPERAÇÃO') ||
              g.name.toUpperCase().includes('EQUIPE')
            ) || groups[0];
            setSelectedGroupPhone(defaultGroup.phone);
          }
        }
      })
      .catch(console.error);
  }, []);

  // ─── Reset quando abre/fecha ─────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      if (preselectedClient) {
        setSelectedClient(preselectedClient);
        setStep(2);
        if (preselectedClient.id) {
          ispfyService.getClientPlanDetails(preselectedClient.id).then((details) => {
            setClientPlan(details.planName);
          }).catch(console.error);
        }
      } else {
        setStep(1);
        setSelectedClient(null);
        setSearchQuery('');
        setSearchResults([]);
        setClientPlan('');
      }
      setSelectedSubject('');
      setSubjectLabel('');
      setPriority('N');
      setMessage('');
      setWifiSsid('');
      setWifiPassword('');
      setCreatedTicketId('');
      setSentGroupSuccess(null);
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

  // ─── Carregar todos os clientes ativos ────────────────────────────────────
  const fetchAllClients = useCallback(async () => {
    setSearchLoading(true);
    try {
      const results = await ispfyService.getClientesAtivos();
      setAllClients(results);
      setSearchResults(results);
    } catch {
      setAllClients([]);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && step === 1 && allClients.length === 0) {
      fetchAllClients();
    }
  }, [open, step, allClients.length, fetchAllClients]);

  // ─── Busca Híbrida ────────────────────────────────────────────────────
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchRef.current) clearTimeout(searchRef.current);
    
    if (!value.trim()) {
      setSearchResults(allClients);
      return;
    }
    
    const lowerVal = value.toLowerCase();
    
    searchRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        let results: ISPFYClienteData[] = [];
        const digits = value.replace(/\D/g, '');
        
        // 1. Busca Local em Memória
        const localMatches = allClients.filter(c => 
          (c.nome_razao || c.nome || c.razao || '').toLowerCase().includes(lowerVal) || 
          (c.id && c.id.toString().includes(lowerVal)) ||
          (c.fone_whatsapp || c.fone_celular || c.fone_residencial || '').includes(lowerVal)
        );
        
        if (localMatches.length > 0) {
          results = localMatches;
        }

        // 2. Fallback Documento/Telefone API
        if (results.length === 0 && /^\d+$/.test(value.replace(/[-.() ]/g, ''))) {
          if (digits.length >= 10 && digits.length <= 11) {
            const client = await ispfyService.getClienteByPhone(digits);
            if (client) results = [client];
          } else if (digits.length === 11 || digits.length === 14) {
            const client = await ispfyService.getClienteByCnpjCpf(digits);
            if (client) results = [client];
          }
        }

        // 3. Fallback Nome API
        if (results.length === 0) {
          const apiResults = await ispfyService.getClienteByNome(value);
          if (apiResults.length > 0) {
            results = apiResults;
          }
        }
        
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }, [allClients]);

  // Buscar clientes ao abrir
  useEffect(() => {
    if (open && step === 1 && !searchQuery) {
      handleSearchChange('');
    }
  }, [open, step, searchQuery, handleSearchChange]);

  // ─── Selecionar cliente ───────────────────────────────────────────────────
  const handleSelectClient = (c: ISPFYClienteData) => {
    setSelectedClient(c);
    setStep(2);
    if (c.id) {
      ispfyService.getClientPlanDetails(c.id).then((details) => {
        setClientPlan(details.planName);
      }).catch(console.error);
    }
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
        mensagem: (() => {
          let ticketMsg = message;
          if (wifiSsid.trim() || wifiPassword.trim()) {
            const wifiParts: string[] = [];
            if (wifiSsid.trim()) wifiParts.push(`Wi-Fi: ${wifiSsid.trim()}`);
            if (wifiPassword.trim()) wifiParts.push(`Senha: ${wifiPassword.trim()}`);
            ticketMsg = `${ticketMsg}\n${wifiParts.join(' | ')}`;
          }
          return ticketMsg;
        })(),
      });
      if (result.success) {
        const tid = result.id ?? '';
        setCreatedTicketId(tid);

        const targetGroup = (whatsappGroups.length > 0 ? whatsappGroups : DEFAULT_AVL_WHATSAPP_GROUPS).find(g => g.phone === selectedGroupPhone);
        const groupName = targetGroup?.name || 'Grupo selecionado';

        const { formattedDailyNumber } = await registerOS({
          ticketId: tid,
          clientId: selectedClient.id,
          clientName: clientDisplayName(selectedClient),
          phone: clientPhone(selectedClient),
          plan: clientPlan,
          subject: subjectLabel,
          priority,
          address: clientCity(selectedClient),
          observation: message,
          wifiSsid: wifiSsid.trim() || undefined,
          wifiPassword: wifiPassword.trim() || undefined,
          whatsappSent: !!(sendToGroupOnCreate && selectedGroupPhone),
          whatsappGroup: groupName,
          fullMessage: buildGroupOSText(tid, formattedNextDailyNumber),
        });

        setCreatedDailyFormatted(formattedDailyNumber);
        setStep(3);
        onSuccess?.(tid);
        toast.success(`O.S. #${formattedDailyNumber} criada hoje! (ISPFY #${tid})`);

        // Envio automático para o grupo WhatsApp
        if (sendToGroupOnCreate && selectedGroupPhone) {
          const text = buildGroupOSText(tid, formattedDailyNumber);
          whapiService.sendGroupMessage(selectedGroupPhone, text).then((res) => {
            if (res.sent) {
              setSentGroupSuccess(groupName);
              toast.success(`O.S. #${formattedDailyNumber} enviada para o grupo "${groupName}"!`);
            } else {
              toast.error(`O.S. criada, mas falhou envio ao WhatsApp: ${res.error}`);
            }
          }).catch(console.error);
        }
      } else {
        toast.error('Erro ao abrir O.S.', { description: result.message });
      }
    } catch {
      toast.error('Erro de comunicação com o servidor.');
    } finally {
      setCreating(false);
    }
  };

  // ─── Enviar para Grupo WhatsApp ──────────────────────────────────────────
  const buildGroupOSText = (ticketIdOverride?: string, dailyOverride?: string): string => {
    const tid = ticketIdOverride || createdTicketId || 'PENDENTE';
    const dailyNum = dailyOverride || createdDailyFormatted || formattedNextDailyNumber;
    const priorityLabel = PRIORITY_LABELS[priority]?.label || priority;
    const clientN = clientDisplayName(selectedClient!);
    const clientP = clientPhone(selectedClient!);
    const addr = clientCity(selectedClient!);

    return (
      `🛠 *O.S. #${dailyNum} – Ordem de Serviço* (ISPFY #${tid})\n` +
      `👤 *Cliente:* ${clientN}\n` +
      `📞 *Contato:* ${clientP}\n` +
      (clientPlan ? `📶 *Plano:* ${clientPlan}\n` : '') +
      (wifiSsid.trim() ? `📶 *Rede Wi-Fi:* ${wifiSsid.trim()}\n` : '') +
      (wifiPassword.trim() ? `🔒 *Senha Wi-Fi:* ${wifiPassword.trim()}\n` : '') +
      `📌 *Assunto:* ${subjectLabel}\n` +
      `⚡ *Prioridade:* ${priorityLabel}\n` +
      (addr ? `📍 *Endereço/Região:* ${addr}\n` : '') +
      (message ? `📝 *Descrição:* ${message}\n` : '')
    );
  };

  const handleCopyInfo = () => {
    const text = buildGroupOSText();
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Informações da O.S. copiadas!');
    }).catch(() => {
      toast.error('Falha ao copiar.');
    });
  };

  const handleSendToGroup = async () => {
    if (!selectedGroupPhone) {
      toast.warning('Selecione um grupo do WhatsApp.');
      return;
    }
    const targetGroup = whatsappGroups.find(g => g.phone === selectedGroupPhone);
    const groupName = targetGroup?.name || 'Grupo selecionado';

    setSendingToGroup(true);
    try {
      const text = buildGroupOSText();
      const res = await whapiService.sendGroupMessage(selectedGroupPhone, text);
      if (res.sent) {
        setSentGroupSuccess(groupName);
        toast.success(`O.S. enviada com sucesso para o grupo ${groupName}!`);
      } else {
        toast.error(`Falha ao enviar para o grupo: ${res.error || 'Erro desconhecido'}`);
      }
    } catch {
      toast.error('Erro ao enviar mensagem.');
    } finally {
      setSendingToGroup(false);
    }
  };

  // ─── Enviar WhatsApp para Cliente ──────────────────────────────────────────
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
    c.fone_whatsapp || c.fone_celular || c.telefone_celular || c.telefone || c.fone || c.fone_residencial || 'Não informado';

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

      <DialogContent className="sm:max-w-lg p-0 overflow-hidden border border-border bg-card shadow-2xl text-card-foreground">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-green-500/30">
              <Ticket className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-foreground text-lg font-bold">
                  {step === 1 && 'Nova Ordem de Serviço'}
                  {step === 2 && 'Dados da O.S.'}
                  {step === 3 && 'O.S. Criada com Sucesso!'}
                </DialogTitle>
                <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-semibold">
                  Hoje: #{dailyCount}
                </Badge>
              </div>
              {/* Step indicator */}
              <div className="flex items-center gap-1.5 mt-1">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      s === step
                        ? 'w-6 bg-emerald-500'
                        : s < step
                        ? 'w-3 bg-emerald-600'
                        : 'w-3 bg-secondary'
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
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Buscar cliente por nome..."
                    className="pl-10 bg-background border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-emerald-500"
                  />
                  {searchLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 animate-spin" />
                  )}
                </div>

                {/* Results */}
                <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1 custom-scroll">
                  {searchResults.length > 0 ? (
                    searchResults.map((c) => (
                      <motion.button
                        key={c.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => handleSelectClient(c)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-secondary/40 hover:bg-secondary border border-border hover:border-emerald-500/40 transition-all text-left group"
                      >
                        <div className="p-2 rounded-lg bg-secondary group-hover:bg-emerald-500/20 transition-colors">
                          <User className="w-4 h-4 text-muted-foreground group-hover:text-emerald-500 transition-colors" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors truncate">
                            {clientDisplayName(c)}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            {clientPhone(c) && (
                              <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                                <Phone className="w-3 h-3 text-emerald-500" />
                                {clientPhone(c)}
                              </span>
                            )}
                            {clientCity(c) && (
                              <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-sky-500" />
                                {clientCity(c)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {c.ativo === 'S' && (
                            <Badge className="h-5 text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 border">
                              Ativo
                            </Badge>
                          )}
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-emerald-500 transition-colors" />
                        </div>
                      </motion.button>
                    ))
                  ) : searchQuery.length > 1 && !searchLoading ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                      <AlertCircle className="w-8 h-8 mb-2 opacity-60" />
                      <p className="text-sm font-medium">Nenhum cliente encontrado para "{searchQuery}"</p>
                    </div>
                  ) : !searchQuery ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                      <Search className="w-8 h-8 mb-2 opacity-60" />
                      <p className="text-sm font-medium">Digite o nome do cliente para buscar</p>
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
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                    <div className="p-2 rounded-lg bg-emerald-500/20">
                      <User className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {clientDisplayName(selectedClient)}
                      </p>
                      <p className="text-xs text-muted-foreground font-medium truncate mt-0.5">
                        {clientPhone(selectedClient) || 'Sem telefone'} · ID {selectedClient.id}
                      </p>
                    </div>
                    {!preselectedClient && (
                      <button
                        onClick={() => setStep(1)}
                        className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}

                {/* Plano de Internet */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/40 border border-border text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                    <Wifi className="w-3.5 h-3.5 text-emerald-500" /> Plano do Cliente:
                  </span>
                  <input
                    value={clientPlan}
                    onChange={e => setClientPlan(e.target.value)}
                    placeholder="Clique para informar plano..."
                    className="bg-transparent border-b border-border text-emerald-600 dark:text-emerald-400 font-semibold text-xs px-1 text-right focus:outline-none focus:border-emerald-500 max-w-[220px]"
                  />
                </div>

                {/* Wi-Fi SSID e Senha */}
                <div className="p-3 rounded-xl bg-secondary/40 border border-border space-y-2 text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                    <Wifi className="w-3.5 h-3.5 text-emerald-500" /> Rede Wi-Fi (Instalação / Troca)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Nome da Rede (SSID)</Label>
                      <Input
                        value={wifiSsid}
                        onChange={e => setWifiSsid(e.target.value)}
                        placeholder="Ex: AVL_FIBRA_CLIENTE"
                        className="bg-background border-input text-foreground h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Senha do Wi-Fi</Label>
                      <Input
                        value={wifiPassword}
                        onChange={e => setWifiPassword(e.target.value)}
                        placeholder="Ex: @senha1234"
                        className="bg-background border-input text-foreground h-8 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Assunto */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Assunto <span className="text-red-500">*</span>
                  </Label>
                  {loadingSubjects ? (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm p-2">
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
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
                      <SelectTrigger className="bg-background border-input text-foreground focus:ring-emerald-500">
                        <SelectValue placeholder="Selecione o assunto..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border text-popover-foreground">
                        {subjects.map((s) => (
                          <SelectItem
                            key={s.id}
                            value={s.id}
                            className="focus:bg-emerald-500/20 focus:text-emerald-700 dark:focus:text-emerald-300"
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
                  <Label className="text-xs font-semibold text-foreground">Prioridade</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {Object.entries(PRIORITY_LABELS).map(([key, { label, color }]) => (
                      <button
                        key={key}
                        onClick={() => setPriority(key)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all ${
                          priority === key
                            ? `${color} scale-[1.02] shadow-sm`
                            : 'bg-secondary/50 border-border text-muted-foreground hover:bg-secondary hover:text-foreground'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mensagem */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Descrição do problema <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Descreva o problema do cliente..."
                    rows={3}
                    className="bg-background border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-emerald-500 resize-none text-xs"
                  />
                </div>

                {/* Destino WhatsApp Grupo */}
                <div className="space-y-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <WhatsAppIcon /> Grupo WhatsApp de Destino
                    </Label>
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/30">
                      {whatsappGroups.length} grupos
                    </Badge>
                  </div>

                  <Select
                    value={selectedGroupPhone}
                    onValueChange={setSelectedGroupPhone}
                  >
                    <SelectTrigger className="bg-background border-input text-foreground h-9 text-xs focus:ring-emerald-500">
                      <SelectValue placeholder="Selecione o grupo..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-56 bg-popover border-border text-popover-foreground z-50">
                      {whatsappGroups.map((g) => (
                        <SelectItem
                          key={g.phone}
                          value={g.phone}
                          className="text-xs focus:bg-emerald-500/20 focus:text-emerald-700 dark:focus:text-emerald-300 cursor-pointer"
                        >
                          👥 {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <label className="flex items-center gap-2 cursor-pointer pt-0.5 select-none">
                    <input
                      type="checkbox"
                      checked={sendToGroupOnCreate}
                      onChange={(e) => setSendToGroupOnCreate(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-border bg-background text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="text-[11px] text-foreground">
                      Enviar automaticamente para o grupo ao registrar
                    </span>
                  </label>
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
                  className="p-5 rounded-full bg-emerald-500/15 ring-4 ring-emerald-500/20"
                >
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </motion.div>

                <div className="text-center space-y-1">
                  <p className="text-foreground font-bold text-lg">
                    O.S. #{createdDailyFormatted || formattedNextDailyNumber} do Dia Aberta!
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                    Protocolo ISPFY: #{createdTicketId}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    A ordem de serviço foi criada para{' '}
                    <span className="text-foreground font-semibold">
                      {selectedClient ? clientDisplayName(selectedClient) : 'o cliente'}
                    </span>
                    .
                  </p>
                </div>

                {/* Resumo da OS */}
                <div className="w-full p-4 rounded-xl bg-secondary/40 border border-border space-y-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-muted-foreground font-medium">Assunto</span>
                    <span className="text-foreground text-right font-semibold truncate max-w-[200px]">
                      {subjectLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-medium">Prioridade</span>
                    <Badge
                      className={`text-[10px] border ${PRIORITY_LABELS[priority]?.color}`}
                    >
                      {PRIORITY_LABELS[priority]?.label}
                    </Badge>
                  </div>
                  {(wifiSsid.trim() || wifiPassword.trim()) && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-medium">Wi-Fi</span>
                      <span className="text-emerald-600 dark:text-emerald-400 text-xs font-mono font-medium">
                        {wifiSsid.trim() ? `Rede: ${wifiSsid.trim()}` : ''} {wifiPassword.trim() ? `| Senha: ${wifiPassword.trim()}` : ''}
                      </span>
                    </div>
                  )}
                  {clientPhone(selectedClient!) && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-medium">WhatsApp</span>
                      <span className="text-foreground text-xs font-semibold">
                        {clientPhone(selectedClient!)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Envio Direto para Grupos do WhatsApp */}
                <div className="w-full p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-left space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <WhatsAppIcon />
                      Enviar para Grupo WhatsApp
                    </span>
                    {whatsappGroups.length > 0 && (
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/30 font-medium">
                        {whatsappGroups.length} grupos
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-foreground text-xs font-medium">
                      Grupo de Destino:
                    </Label>
                    {loadingGroups ? (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary border border-border text-xs text-muted-foreground">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                        Carregando grupos...
                      </div>
                    ) : (
                      <Select
                        value={selectedGroupPhone}
                        onValueChange={setSelectedGroupPhone}
                      >
                        <SelectTrigger className="w-full bg-background border-input text-foreground h-10 text-xs focus:ring-emerald-500">
                          <SelectValue placeholder="Selecione o grupo..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-60 bg-popover border-border text-popover-foreground">
                          {whatsappGroups.map((g) => (
                            <SelectItem
                              key={g.phone}
                              value={g.phone}
                              className="text-xs focus:bg-emerald-500/20 focus:text-emerald-700 dark:focus:text-emerald-300 cursor-pointer"
                            >
                              👥 {g.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <Button
                    onClick={handleSendToGroup}
                    disabled={sendingToGroup || !selectedGroupPhone || loadingGroups}
                    className="w-full h-11 rounded-lg font-semibold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] text-xs"
                    style={{
                      background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                      boxShadow: '0 4px 16px rgba(37,211,102,0.3)',
                    }}
                  >
                    {sendingToGroup ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Enviando O.S. para o grupo...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        Enviar O.S. para o Grupo Selecionado
                      </>
                    )}
                  </Button>

                  {sentGroupSuccess && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                      <span>Enviada para <strong>{sentGroupSuccess}</strong>!</span>
                    </div>
                  )}
                </div>

                {/* Copiar e Envio Individual ao Cliente */}
                <div className="w-full space-y-2">
                  <Button
                    variant="outline"
                    onClick={handleCopyInfo}
                    className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-secondary hover:bg-secondary/80 border-border text-foreground text-xs font-semibold"
                  >
                    <Copy className="w-3.5 h-3.5 text-emerald-500" />
                    Copiar Informações da O.S.
                  </Button>

                  {hasWhatsApp && (
                    <Button
                      variant="ghost"
                      onClick={handleWhatsApp}
                      className="w-full flex items-center justify-center gap-2 h-10 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-500/10 text-xs"
                    >
                      <WhatsAppIcon />
                      Notificar Cliente via WhatsApp Direto
                    </Button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center justify-between gap-3 border-t border-border pt-4">
          {step === 1 && (
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground hover:bg-secondary"
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
                  className="text-muted-foreground hover:text-foreground hover:bg-secondary gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Voltar
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  className="text-muted-foreground hover:text-foreground hover:bg-secondary"
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
              className="ml-auto text-muted-foreground hover:text-foreground hover:bg-secondary"
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

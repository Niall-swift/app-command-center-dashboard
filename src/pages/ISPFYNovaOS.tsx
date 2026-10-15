import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Loader2, User, Phone, MapPin, Ticket, CheckCircle2,
  AlertCircle, Send, X, Navigation, Copy, ExternalLink,
  ClipboardList, ChevronRight, Radio, Wifi, WifiOff,
  Zap, Wrench, HelpCircle, Cable, Monitor, RotateCcw, MessageSquare,
  Settings, Edit3, Sliders, Check, RefreshCw, Eye, Sparkles, Layers,
  Lock, Key, Globe, CheckCheck,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import PageTransition from '@/components/PageTransition';
import { ispfyService } from '@/services/ispfy/ispfyService';
import type { ISPFYClienteData, ISPFYLoginData, ISPFYContratoData, ISPFYPlanoData } from '@/types/ispfy';
import { whapiService, DEFAULT_AVL_WHATSAPP_GROUPS } from '@/services/whapi/whapiService';
import type { WhapiGroup } from '@/types/whapi';
import { useDailyOS } from '@/hooks/useDailyOS';
import { DailyOSModal } from '@/components/ispfy/DailyOSModal';
import { Calendar } from 'lucide-react';

// ─── WhatsApp SVG Icon ────────────────────────────────────────────────────────
const WhatsAppIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={`${className} fill-current`} xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

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

// ─── Modelo Padrão da O.S. & Variáveis Dinâmicas ──────────────────────────────
export const DEFAULT_OS_TEMPLATE = 
`🛠 *O.S. #{numero_diario} – Ordem de Serviço* (ISPFY #{numero_os})
👤 *Cliente:* {cliente}
📞 *Contato:* {telefone}
📶 *Plano:* {plano}
{logins}
{problemas}
📌 *Assunto:* {assunto}
⚡ *Prioridade:* {prioridade}
{endereco}
{referencia}
{observacao}
{mapa}`;

const STORAGE_KEY_TEMPLATE = 'avl_os_template_structure_v2';

const TEMPLATE_VARIABLES = [
  { tag: '{numero_diario}', label: 'Nº O.S. do Dia', desc: 'Ex: #01, #02 (Reinicia todo dia às 00:00)' },
  { tag: '{numero_os}', label: 'ID ISPFY', desc: 'Ex: #12345 (ID oficial no sistema)' },
  { tag: '{data_hoje}', label: 'Data Atual', desc: 'Ex: 15/10/2026' },
  { tag: '{cliente}', label: 'Cliente', desc: 'Nome completo' },
  { tag: '{telefone}', label: 'Telefone', desc: 'Contato / Celular' },
  { tag: '{plano}', label: 'Plano', desc: 'Plano de Internet' },
  { tag: '{logins}', label: 'PPPoE (Login/Senha)', desc: 'Credenciais completas' },
  { tag: '{pppoe}', label: 'Usuário PPPoE', desc: 'Apenas login' },
  { tag: '{senha}', label: 'Senha PPPoE', desc: 'Apenas senha' },
  { tag: '{problemas}', label: 'Problemas', desc: 'Lista de problemas selecionados' },
  { tag: '{assunto}', label: 'Assunto', desc: 'Assunto do chamado' },
  { tag: '{prioridade}', label: 'Prioridade', desc: 'Baixa, Normal, Alta, Crítica' },
  { tag: '{endereco}', label: 'Endereço', desc: 'Endereço completo' },
  { tag: '{referencia}', label: 'Ponto Ref.', desc: 'Ponto de referência' },
  { tag: '{observacao}', label: 'Observação', desc: 'Observação adicional' },
  { tag: '{mapa}', label: 'Link do Mapa', desc: 'Link direto do Google Maps' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const clientName = (c: ISPFYClienteData) =>
  c.nome_razao || c.nome || c.razao || 'Sem nome';

const clientPhone = (c: ISPFYClienteData) =>
  c.fone_whatsapp || c.fone_celular || c.telefone_celular || c.telefone || c.fone || c.fone_residencial || 'Não informado';

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
  if (lat && lng && lat !== '0' && lat !== '0.0000000' && lng !== '0' && lng !== '0.0000000') {
    return `https://maps.google.com/?q=${lat},${lng}`;
  }
  const addr = buildAddress(c);
  if (addr) return `https://maps.google.com/?q=${encodeURIComponent(addr)}`;
  return '';
};

const mapsEmbedUrl = (c: ISPFYClienteData): string => {
  const lat = c.endereco_cobranca_latitude || c.latitude;
  const lng = c.endereco_cobranca_longitude || c.longitude;
  if (lat && lng && lat !== '0' && lat !== '0.0000000' && lng !== '0' && lng !== '0.0000000') {
    return `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
  }
  const addr = buildAddress(c);
  if (addr) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(addr)}&z=16&output=embed`;
  }
  return '';
};

// ─── Componente Principal ─────────────────────────────────────────────────────
const ISPFYNovaOS: React.FC = () => {
  // Busca de clientes
  const [searchQuery, setSearchQuery] = useState('');
  const [allClients, setAllClients] = useState<ISPFYClienteData[]>([]);
  const [searchResults, setSearchResults] = useState<ISPFYClienteData[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ISPFYClienteData | null>(null);
  const [clientLogins, setClientLogins] = useState<ISPFYLoginData[]>([]);
  const [clientContracts, setClientContracts] = useState<ISPFYContratoData[]>([]);
  const [clientPlan, setClientPlan] = useState('');
  const [allPlanos, setAllPlanos] = useState<ISPFYPlanoData[]>([]);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [isEditingPlan, setIsEditingPlan] = useState(false);
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
  const [createdDailyFormatted, setCreatedDailyFormatted] = useState<string | null>(null);
  const [isDailyOrdersModalOpen, setIsDailyOrdersModalOpen] = useState(false);

  // ─── Contagem e Rastreamento Diário de O.S. (Reinicia a cada dia) ───────────
  const {
    count: dailyCount,
    formattedNextDailyNumber,
    orders: dailyOrders,
    formattedDate,
    registerOS,
  } = useDailyOS();

  // Estado dos Grupos WhatsApp
  const [whatsappGroups, setWhatsappGroups] = useState<WhapiGroup[]>(DEFAULT_AVL_WHATSAPP_GROUPS);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedGroupPhone, setSelectedGroupPhone] = useState('120363426874994471-group');
  const [sendToGroupOnCreate, setSendToGroupOnCreate] = useState(true);
  const [sendingToGroup, setSendingToGroup] = useState(false);
  const [sentGroupSuccess, setSentGroupSuccess] = useState<string | null>(null);

  // Customização da Estrutura / Template da O.S.
  const [osTemplate, setOsTemplate] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_TEMPLATE) || DEFAULT_OS_TEMPLATE;
  });
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [tempTemplateText, setTempTemplateText] = useState(osTemplate);
  const templateInputRef = useRef<HTMLTextAreaElement | null>(null);

  // Edição Manual Direta do Texto da O.S.
  const [customOSText, setCustomOSText] = useState<string | null>(null);
  const [isEditingLiveMessage, setIsEditingLiveMessage] = useState(false);

  // Endereço e Links de Localização do cliente selecionado
  const addr = selectedClient ? buildAddress(selectedClient) : '';
  const mapUrl = selectedClient ? mapsEmbedUrl(selectedClient) : '';
  const mapsLink = selectedClient ? mapsUrl(selectedClient) : '';

  // Carregar grupos do WhatsApp ao montar o componente
  useEffect(() => {
    setLoadingGroups(true);
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
      .catch((err) => {
        console.error('Erro ao buscar grupos do WhatsApp:', err);
      })
      .finally(() => {
        setLoadingGroups(false);
      });
  }, []);

  // Carregar assuntos ao montar
  useEffect(() => {
    setLoadingSubjects(true);
    ispfyService
      .getTicketSubjects()
      .then(setSubjects)
      .catch(() => toast.error('Erro ao carregar assuntos'))
      .finally(() => setLoadingSubjects(false));

    // Carregar planos da empresa ao montar
    ispfyService
      .getPlanosAtivos()
      .then((planos) => {
        if (planos && planos.length > 0) {
          setAllPlanos(planos);
        }
      })
      .catch((err) => console.error('Erro ao carregar planos:', err));
  }, []);

  const fetchInitialClients = async () => {
    setSearchLoading(true);
    try {
      const response = await ispfyService.getClientesAtivos();
      setAllClients(response);
      setSearchResults(response);
    } catch {
      setAllClients([]);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialClients();
  }, []);

  // ─── Busca híbrida (Memória + Servidor) ─────────────────────────────────────────────────────────
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

        // 2. Se não achou localmente e é um número (CPF/Telefone), busca direto na API
        if (results.length === 0 && /^\d+$/.test(value.replace(/[-.() ]/g, ''))) {
          if (digits.length >= 10 && digits.length <= 11) {
            const client = await ispfyService.getClienteByPhone(digits);
            if (client) results = [client];
          } else if (digits.length === 11 || digits.length === 14) {
            const client = await ispfyService.getClienteByCnpjCpf(digits);
            if (client) results = [client];
          }
        }

        // 3. Fallback no servidor
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

  // ─── Seleção de Cliente e Detecção do Plano ─────────────────────────────────────────────────────
  const handleSelectClient = async (c: ISPFYClienteData) => {
    setSelectedClient(c);
    setSearchResults([]);
    setSearchQuery(clientName(c));
    if (c.endereco_cobranca_complemento) {
      setReferencePoint(c.endereco_cobranca_complemento);
    }
    setCustomOSText(null); // Reseta edição manual para gerar nova mensagem do cliente

    if (c.id) {
      setLoadingPlan(true);

      // 1. Contatos
      try {
        const contatos = await ispfyService.getClienteContatos(c.id);
        if (contatos && contatos.length > 0) {
          c.fone_celular = contatos.find((ct: any) => ct.tipo_contato === 'c')?.contato || contatos[0].contato;
          c.fone_whatsapp = contatos.find((ct: any) => ct.pode_enviar_mensagem === 's')?.contato;
        }
      } catch (err) {
        console.error('Erro ao buscar contatos:', err);
      }

      // 2. Busca e resolução inteligente do plano, contratos e logins
      try {
        const details = await ispfyService.getClientPlanDetails(c.id);
        setClientContracts(details.contratos);
        setClientLogins(details.logins);
        setClientPlan(details.planName);
        if (details.allPlanos && details.allPlanos.length > 0) {
          setAllPlanos(details.allPlanos);
        }
      } catch (err) {
        console.error('Erro ao resolver plano e detalhes do cliente:', err);
        setClientContracts([]);
        setClientLogins([]);
        setClientPlan('');
      } finally {
        setLoadingPlan(false);
      }
    } else {
      setClientLogins([]);
      setClientContracts([]);
      setClientPlan('');
      setLoadingPlan(false);
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
    if (clientPlan.trim()) {
      desc += `\nPlano: ${clientPlan.trim()}`;
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

  // ─── Gerador da Estrutura da O.S. a partir do Template ───────────────────────
  const generateOSText = useCallback((ticketIdOverride?: string, dailyNumberOverride?: string): string => {
    if (!selectedClient) {
      return 'Selecione um cliente para gerar o formato da O.S.';
    }

    const tid = ticketIdOverride || createdTicketId || 'PENDENTE';
    const dailyFormatted = dailyNumberOverride || createdDailyFormatted || formattedNextDailyNumber;
    const name = clientName(selectedClient);
    const phone = clientPhone(selectedClient);
    const plan = clientPlan.trim() || 'Não informado';

    let loginsText = '';
    let pppoeUser = '';
    let pppoePass = '';
    if (clientLogins && clientLogins.length > 0) {
      pppoeUser = clientLogins[0]?.usuario || clientLogins[0]?.login || '';
      pppoePass = clientLogins[0]?.senha || '';
      loginsText = clientLogins
        .map(l => `🔑 *PPPoE:* ${l.usuario || l.login || 'Não informado'}\n🔒 *Senha:* ${l.senha || 'Não informada'}`)
        .join('\n');
    }

    const problemLabels = selectedProblems.map(pid =>
      PROBLEMS.find(p => p.id === pid)?.label || pid
    );
    const problemsText = problemLabels.length > 0 ? `📋 *Problemas:* ${problemLabels.join(', ')}` : '';
    const priorityLabel = PRIORITY_LABELS[priority]?.label || 'Normal';
    const addressText = addr ? `📍 *Endereço:* ${addr}` : '';
    const refText = referencePoint.trim() ? `📍 *Ref:* ${referencePoint.trim()}` : '';
    const obsText = observation.trim() ? `📝 *Obs:* ${observation.trim()}` : '';
    const mapText = mapsLink ? `🗺️ *Mapa:* ${mapsLink}` : '';

    let text = osTemplate;

    // Compatibilidade inteligente: se o template antigo não possui a tag {numero_diario},
    // adapta {numero_os} para exibir o número do dia e o ID do ISPFY
    if (!text.includes('{numero_diario}')) {
      text = text.replace(/{numero_os}/g, `${dailyFormatted} (ISPFY #${tid})`);
    } else {
      text = text
        .replace(/{numero_diario}/g, dailyFormatted)
        .replace(/{numero_os}/g, tid);
    }

    text = text
      .replace(/{data_hoje}/g, formattedDate)
      .replace(/{cliente}/g, name)
      .replace(/{telefone}/g, phone)
      .replace(/{plano}/g, plan)
      .replace(/{logins}/g, loginsText)
      .replace(/{pppoe}/g, pppoeUser)
      .replace(/{senha}/g, pppoePass)
      .replace(/{problemas}/g, problemsText)
      .replace(/{assunto}/g, subjectLabel || 'Não informado')
      .replace(/{prioridade}/g, priorityLabel)
      .replace(/{endereco}/g, addressText)
      .replace(/{referencia}/g, refText)
      .replace(/{observacao}/g, obsText)
      .replace(/{mapa}/g, mapText);

    // Limpa linhas em branco duplas que ficaram devido a tags vazias
    return text
      .split('\n')
      .map(line => line.trimEnd())
      .filter((line, i, arr) => !(line.trim() === '' && arr[i - 1]?.trim() === ''))
      .join('\n')
      .trim();
  }, [
    selectedClient,
    createdTicketId,
    createdDailyFormatted,
    formattedNextDailyNumber,
    formattedDate,
    clientPlan,
    clientLogins,
    selectedProblems,
    priority,
    subjectLabel,
    referencePoint,
    observation,
    osTemplate,
    addr,
    mapsLink,
  ]);

  // Mensagem efetiva (se o usuário editou manualmente no box, usa o custom; senão gera do template)
  const effectiveMessage = customOSText !== null ? customOSText : generateOSText();

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
        const newTicketId = result.id ?? '';
        setCreatedTicketId(newTicketId);

        // ─── Registro e Incremento na Contagem Diária ───────────────────────────
        const targetGroup = (whatsappGroups.length > 0 ? whatsappGroups : DEFAULT_AVL_WHATSAPP_GROUPS).find(g => g.phone === selectedGroupPhone);
        const groupName = targetGroup?.name || 'Grupo de Operação';

        const { formattedDailyNumber } = await registerOS({
          ticketId: newTicketId,
          clientId: selectedClient.id,
          clientName: clientName(selectedClient),
          phone: clientPhone(selectedClient),
          plan: clientPlan,
          subject: subjectLabel || 'Não informado',
          priority,
          address: addr,
          referencePoint,
          observation,
          whatsappSent: !!(sendToGroupOnCreate && selectedGroupPhone),
          whatsappGroup: groupName,
          fullMessage: '', // preenchido logo abaixo
        });

        setCreatedDailyFormatted(formattedDailyNumber);
        setCreated(true);
        toast.success(`O.S. #${formattedDailyNumber} registrada hoje! (ISPFY #${newTicketId})`);

        // Mensagem final enviada
        const finalMessage = customOSText !== null 
          ? customOSText
              .replace(/NOVA O.S.|PENDENTE/g, `#${newTicketId}`)
              .replace(/{numero_diario}/g, formattedDailyNumber)
          : generateOSText(newTicketId, formattedDailyNumber);

        // Envio automático para o grupo do WhatsApp selecionado
        if (sendToGroupOnCreate && selectedGroupPhone) {
          whapiService.sendGroupMessage(selectedGroupPhone, finalMessage).then((res) => {
            if (res.sent) {
              setSentGroupSuccess(groupName);
              toast.success(`O.S. #${formattedDailyNumber} enviada para o grupo "${groupName}"!`);
            } else {
              toast.error(`O.S. criada, mas falhou envio ao WhatsApp: ${res.error}`);
            }
          }).catch((err) => {
            console.error('Erro ao enviar para grupo WhatsApp:', err);
          });
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

  const handleCopyInfo = () => {
    if (!selectedClient) {
      toast.warning('Selecione um cliente antes de copiar a O.S.');
      return;
    }
    navigator.clipboard.writeText(effectiveMessage).then(() => {
      toast.success('Informações da O.S. copiadas para a área de transferência!');
    }).catch(() => {
      toast.error('Falha ao copiar informações.');
    });
  };

  const handleSendToGroup = async () => {
    if (!selectedGroupPhone) {
      toast.warning('Selecione um grupo do WhatsApp de destino.');
      return;
    }
    const targetGroup = whatsappGroups.find(g => g.phone === selectedGroupPhone);
    const groupName = targetGroup?.name || 'Grupo selecionado';

    setSendingToGroup(true);
    try {
      const res = await whapiService.sendGroupMessage(selectedGroupPhone, effectiveMessage);
      if (res.sent) {
        setSentGroupSuccess(groupName);
        toast.success(`O.S. enviada com sucesso para o grupo ${groupName}!`);
      } else {
        toast.error(`Falha ao enviar para o grupo: ${res.error || 'Erro desconhecido'}`);
      }
    } catch (error: any) {
      toast.error('Erro ao enviar mensagem para o WhatsApp.');
    } finally {
      setSendingToGroup(false);
    }
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
    setCreatedDailyFormatted(null);
    setClientLogins([]);
    setClientContracts([]);
    setClientPlan('');
    setSentGroupSuccess(null);
    setCustomOSText(null);
    setIsEditingLiveMessage(false);
  };

  const copyAddress = () => {
    if (!selectedClient) return;
    const addr = buildAddress(selectedClient);
    navigator.clipboard.writeText(addr).then(() => toast.success('Endereço copiado!'));
  };

  // ─── Salvar e Restaurar Modelo de Estrutura da O.S. ────────────────────────
  const openTemplateModal = () => {
    setTempTemplateText(osTemplate);
    setIsTemplateModalOpen(true);
  };

  const handleSaveTemplate = () => {
    setOsTemplate(tempTemplateText);
    localStorage.setItem(STORAGE_KEY_TEMPLATE, tempTemplateText);
    setIsTemplateModalOpen(false);
    toast.success('Estrutura e modelo da O.S. salvos com sucesso!');
  };

  const handleRestoreDefaultTemplate = () => {
    setTempTemplateText(DEFAULT_OS_TEMPLATE);
    toast.info('Estrutura restaurada para o padrão AVL Telecom.');
  };

  const insertTagIntoTemplate = (tag: string) => {
    const el = templateInputRef.current;
    if (!el) {
      setTempTemplateText(prev => prev + '\n' + tag);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const current = tempTemplateText;
    const next = current.substring(0, start) + tag + current.substring(end);
    setTempTemplateText(next);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  };

  return (
    <PageTransition>
      <div
        className="min-h-screen p-4 md:p-6 lg:p-8 space-y-6 text-white"
        style={{ background: 'linear-gradient(135deg, #07090e 0%, #0d111a 50%, #07090e 100%)' }}
      >
        {/* Header Premium */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-3xl border border-white/10"
          style={{ background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(16px)' }}
        >
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-xl shadow-emerald-500/25 ring-1 ring-emerald-400/40">
              <ClipboardList className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight text-white">Central de Abertura de O.S.</h1>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30 text-[10px] font-semibold uppercase tracking-wider">
                  ISPFY + Z-API
                </Badge>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[11px] gap-1 px-2.5 py-0.5">
                  <Calendar className="w-3 h-3 text-emerald-400" />
                  Hoje: #{dailyCount} O.S. emitidas
                </Badge>
                <Badge variant="outline" className="bg-white/5 text-white/70 border-white/10 text-[11px] px-2 py-0.5">
                  Próxima do dia: #{formattedNextDailyNumber}
                </Badge>
              </div>
              <p className="text-white/50 text-xs sm:text-sm mt-0.5">
                Emissão inteligente com contagem diária segmentada (reinicia automaticamente à meia-noite).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <Button
              variant="outline"
              onClick={() => setIsDailyOrdersModalOpen(true)}
              className="bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-300 text-xs h-10 gap-2 rounded-xl transition-all shadow-lg shadow-emerald-500/10"
            >
              <ClipboardList className="w-4 h-4 text-emerald-400" />
              <span>Ver O.S. de Hoje</span>
              <Badge className="bg-emerald-500/30 text-emerald-200 border-none text-[10px] px-1.5 py-0 h-5">
                {dailyCount}
              </Badge>
            </Button>
            <Button
              variant="outline"
              onClick={openTemplateModal}
              className="bg-white/5 hover:bg-emerald-500/10 border-white/10 hover:border-emerald-500/30 text-white/80 hover:text-emerald-300 text-xs h-10 gap-2 rounded-xl transition-all"
            >
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              Editar Estrutura
            </Button>
            <Button
              variant="ghost"
              onClick={handleReset}
              className="text-white/40 hover:text-white hover:bg-white/5 border border-white/5 text-xs h-10 gap-1.5 rounded-xl"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Limpar
            </Button>
          </div>
        </motion.div>

        {/* ─── Tela de Sucesso ─── */}
        <AnimatePresence mode="wait">
          {created ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-xl mx-auto"
            >
              <div
                className="rounded-3xl border border-emerald-500/20 p-8 flex flex-col items-center gap-6 text-center shadow-2xl shadow-emerald-500/10"
                style={{ background: 'rgba(16,185,129,0.03)', backdropFilter: 'blur(16px)' }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.1 }}
                  className="p-6 rounded-full bg-emerald-500/15 ring-8 ring-emerald-500/20 text-emerald-400"
                >
                  <CheckCircle2 className="w-16 h-16" />
                </motion.div>

                <div>
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs mb-2">
                    Ordem de Serviço Diária #{createdDailyFormatted || formattedNextDailyNumber} Registrada
                  </Badge>
                  <p className="text-3xl font-extrabold text-white tracking-tight">
                    O.S. #{createdDailyFormatted || formattedNextDailyNumber} do Dia
                  </p>
                  <p className="text-emerald-400 text-xs font-semibold mt-1">
                    Protocolo ISPFY: #{createdTicketId} • Total hoje: {dailyCount} O.S.
                  </p>
                  <p className="text-white/60 mt-1.5 text-sm">
                    Cadastrada com sucesso para <span className="text-emerald-300 font-semibold">{clientName(selectedClient!)}</span>
                  </p>
                </div>

                {/* Resumo da O.S. criada */}
                <div className="w-full rounded-2xl border border-white/10 divide-y divide-white/5 text-left text-xs overflow-hidden bg-black/40">
                  <div className="flex justify-between items-center px-4 py-3">
                    <span className="text-white/40">Plano de Internet</span>
                    <span className="text-emerald-400 font-semibold">{clientPlan || 'Não especificado'}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3">
                    <span className="text-white/40">Assunto</span>
                    <span className="text-white font-medium">{subjectLabel}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3">
                    <span className="text-white/40">Prioridade</span>
                    <span className={`font-semibold ${PRIORITY_LABELS[priority]?.color}`}>
                      {PRIORITY_LABELS[priority]?.label}
                    </span>
                  </div>
                  {clientPhone(selectedClient!) && (
                    <div className="flex justify-between items-center px-4 py-3">
                      <span className="text-white/40">Contato do Cliente</span>
                      <span className="text-white/80">{clientPhone(selectedClient!)}</span>
                    </div>
                  )}
                  {addr && (
                    <div className="flex justify-between items-start px-4 py-3 gap-3">
                      <span className="text-white/40 shrink-0">Endereço</span>
                      <span className="text-white/70 text-right">{addr}</span>
                    </div>
                  )}
                </div>

                {/* Ações de Envio e Cópia */}
                <div className="w-full flex flex-col gap-3">
                  <div className="w-full p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-left space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <WhatsAppIcon className="w-4 h-4 text-emerald-400" />
                        Disparar para Grupo WhatsApp
                      </span>
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/20 text-emerald-300 border-emerald-400/30">
                        {whatsappGroups.length} grupos
                      </Badge>
                    </div>

                    <Select
                      value={selectedGroupPhone}
                      onValueChange={setSelectedGroupPhone}
                    >
                      <SelectTrigger className="w-full bg-slate-900/90 border-white/15 text-white h-11 text-xs focus:ring-emerald-500">
                        <SelectValue placeholder="Selecione o grupo..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 bg-slate-900 border-slate-800 text-white z-50">
                        {whatsappGroups.map((g) => (
                          <SelectItem
                            key={g.phone}
                            value={g.phone}
                            className="text-xs focus:bg-emerald-500/20 focus:text-emerald-300 cursor-pointer"
                          >
                            👥 {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      onClick={handleSendToGroup}
                      disabled={sendingToGroup || !selectedGroupPhone || loadingGroups}
                      className="w-full h-11 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99]"
                      style={{
                        background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                        boxShadow: '0 4px 20px rgba(37,211,102,0.35)',
                      }}
                    >
                      {sendingToGroup ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                      ) : (
                        <><Send className="w-4 h-4" /> Enviar para o Grupo Selecionado</>
                      )}
                    </Button>

                    {sentGroupSuccess && (
                      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs">
                        <CheckCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                        <span>Enviada com sucesso para: <strong>{sentGroupSuccess}</strong></span>
                      </div>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    onClick={handleCopyInfo}
                    className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white text-xs"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copiar Texto Formatado da O.S.
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={handleReset}
                    className="w-full text-white/40 hover:text-white hover:bg-white/5 border border-white/5 h-10 text-xs"
                  >
                    Abrir Outra O.S.
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : (
            /* ─── Formulário Principal (Grid 2 Colunas) ─── */
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              {/* ─── Coluna Esquerda: Passos de Entrada (7 Colunas) ─── */}
              <div className="lg:col-span-7 flex flex-col gap-5">
                
                {/* 1. Seleção de Cliente e Plano */}
                <Section
                  title="1. Cliente & Plano de Internet"
                  icon={<User className="w-4 h-4 text-emerald-400" />}
                >
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                    <Input
                      value={searchQuery}
                      onChange={e => handleSearchChange(e.target.value)}
                      placeholder="Buscar por nome, telefone ou CPF..."
                      className="pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-emerald-500 focus-visible:border-emerald-500/40 h-11 text-sm rounded-xl"
                    />
                    {searchLoading && (
                      <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400 animate-spin" />
                    )}
                    {selectedClient && !searchLoading && (
                      <button
                        onClick={() => { setSelectedClient(null); setSearchQuery(''); setSearchResults([]); setClientPlan(''); setClientContracts([]); }}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Resultados da busca */}
                  <AnimatePresence>
                    {searchResults.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="rounded-2xl border border-white/10 overflow-hidden divide-y divide-white/5 max-h-[280px] overflow-y-auto custom-scrollbar"
                        style={{ background: 'rgba(10,12,20,0.98)', backdropFilter: 'blur(20px)' }}
                      >
                        {searchResults.map(c => (
                          <button
                            key={c.id}
                            onClick={() => handleSelectClient(c)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-emerald-500/10 transition-colors text-left group"
                          >
                            <div className="w-8 h-8 rounded-xl bg-white/5 group-hover:bg-emerald-500/20 flex items-center justify-center transition-colors shrink-0">
                              <User className="w-3.5 h-3.5 text-white/40 group-hover:text-emerald-400 transition-colors" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">{clientName(c)}</p>
                              <div className="flex items-center gap-3 mt-0.5">
                                {clientPhone(c) && (
                                  <span className="text-xs text-white/40 flex items-center gap-1">
                                    <Phone className="w-2.5 h-2.5" />{clientPhone(c)}
                                  </span>
                                )}
                                {(c.cidade || c.endereco_cobranca_bairro) && (
                                  <span className="text-xs text-white/40 flex items-center gap-1">
                                    <MapPin className="w-2.5 h-2.5" />{c.endereco_cobranca_bairro || c.cidade}
                                  </span>
                                )}
                              </div>
                            </div>
                            {c.ativo === 'S' && (
                              <Badge className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">Ativo</Badge>
                            )}
                            <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-emerald-400 transition-colors shrink-0" />
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Card do Cliente Selecionado */}
                  <AnimatePresence>
                    {selectedClient && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-2xl border border-emerald-500/30 p-4 space-y-4"
                        style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(6,78,59,0.04) 100%)' }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0 text-emerald-400 font-bold text-base shadow-lg shadow-emerald-500/20">
                              {clientName(selectedClient).charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-white font-bold text-base truncate">{clientName(selectedClient)}</p>
                              <p className="text-white/40 text-xs">ID ISPFY: #{selectedClient.id}</p>
                            </div>
                          </div>
                          {selectedClient.ativo === 'S' ? (
                            <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs shrink-0">Ativo</Badge>
                          ) : (
                            <Badge className="bg-red-500/20 text-red-300 border border-red-500/30 text-xs shrink-0">Inativo</Badge>
                          )}
                        </div>

                        {/* 📶 Card de Plano de Internet (Destaque) */}
                        <div className="p-3.5 rounded-xl bg-black/40 border border-emerald-500/20 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                              <Wifi className="w-3.5 h-3.5" /> Plano de Internet
                              {loadingPlan && <Loader2 className="w-3 h-3 animate-spin text-emerald-400 ml-1" />}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setIsEditingPlan(!isEditingPlan)}
                                className="text-[11px] text-white/50 hover:text-emerald-300 flex items-center gap-1 transition-colors"
                              >
                                <Edit3 className="w-3 h-3" />
                                {isEditingPlan ? 'Concluir' : 'Digitar manual'}
                              </button>
                            </div>
                          </div>

                          {loadingPlan ? (
                            <div className="flex items-center gap-2 text-xs text-white/50 py-1">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                              <span>Identificando plano de internet no ISPFY...</span>
                            </div>
                          ) : isEditingPlan ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={clientPlan}
                                onChange={e => setClientPlan(e.target.value)}
                                placeholder="Digite o nome do plano (ex: FIBRA 700 MEGA)..."
                                className="bg-slate-900 border-emerald-500/40 text-white text-xs h-9"
                              />
                              <Button
                                size="sm"
                                onClick={() => setIsEditingPlan(false)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 px-3 text-xs"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
                                  {clientPlan ? (
                                    <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs py-1 px-2.5">
                                      <Zap className="w-3 h-3 mr-1 text-emerald-400" /> {clientPlan}
                                    </Badge>
                                  ) : (
                                    <span className="text-white/40 italic text-xs">Nenhum plano identificado</span>
                                  )}
                                </span>
                                {clientContracts.length > 1 && (
                                  <Badge variant="outline" className="text-[10px] bg-white/5 text-white/60 border-white/10">
                                    {clientContracts.length} contratos
                                  </Badge>
                                )}
                              </div>

                              {allPlanos.length > 0 && (
                                <div className="flex items-center gap-2">
                                  <Select
                                    value={clientPlan}
                                    onValueChange={setClientPlan}
                                  >
                                    <SelectTrigger className="w-full sm:w-[240px] h-7 text-[11px] bg-white/5 border-white/10 text-white/70 hover:text-white hover:border-emerald-500/30">
                                      <SelectValue placeholder="Trocar / Selecionar Plano..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs max-h-64">
                                      {allPlanos.map(p => (
                                        <SelectItem key={p.id} value={p.nome || p.descricao || `Plano #${p.id}`}>
                                          {p.nome || p.descricao} {p.valor_mensal && p.valor_mensal !== '0.00' ? `— R$ ${p.valor_mensal}` : ''}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Credenciais PPPoE se existirem */}
                        {clientLogins.length > 0 && (
                          <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1.5 text-xs">
                            <span className="text-white/40 text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1">
                              <Key className="w-3 h-3 text-amber-400" /> Acesso PPPoE do Cliente
                            </span>
                            <div className="flex flex-wrap gap-3 items-center pt-0.5">
                              <div className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-lg border border-white/5">
                                <span className="text-white/40">Login:</span>
                                <span className="text-white font-mono font-medium">{clientLogins[0]?.usuario || clientLogins[0]?.login || '–'}</span>
                              </div>
                              <div className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-lg border border-white/5">
                                <span className="text-white/40">Senha:</span>
                                <span className="text-white font-mono font-medium">{clientLogins[0]?.senha || '–'}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Detalhes de Contato e Endereço */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {clientPhone(selectedClient) && (
                            <InfoRow
                              icon={<Phone className="w-3.5 h-3.5 text-emerald-400" />}
                              label="Telefone / WhatsApp"
                              value={clientPhone(selectedClient)}
                            />
                          )}
                          {addr && (
                            <InfoRow
                              icon={<MapPin className="w-3.5 h-3.5 text-blue-400" />}
                              label="Endereço"
                              value={addr}
                            />
                          )}
                        </div>

                        {/* Ponto de Referência */}
                        <div className="space-y-1">
                          <Label className="text-xs text-white/50 flex items-center gap-1">
                            <Navigation className="w-3 h-3 text-emerald-400" /> Ponto de Referência para a Equipe
                          </Label>
                          <Input
                            value={referencePoint}
                            onChange={e => setReferencePoint(e.target.value)}
                            placeholder="Ex: Próximo à padaria, em frente ao poste com transformador..."
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-emerald-500 focus-visible:border-emerald-500/40 text-xs h-9 rounded-xl"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Section>

                {/* 2. Tipo de Problema */}
                <Section
                  title="2. Tipo de Problema"
                  icon={<AlertCircle className="w-4 h-4 text-emerald-400" />}
                  badge={selectedProblems.length > 0 ? `${selectedProblems.length} selecionado(s)` : undefined}
                >
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PROBLEMS.map(problem => {
                      const selected = selectedProblems.includes(problem.id);
                      const colors = colorMap[problem.color];
                      const Icon = problem.icon;
                      return (
                        <motion.button
                          key={problem.id}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => toggleProblem(problem.id)}
                          className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl border text-xs font-medium transition-all duration-200 ${
                            selected
                              ? `${colors.chipSelected} shadow-lg shadow-current/15 scale-[1.02]`
                              : colors.chip + ' hover:brightness-125'
                          }`}
                        >
                          {selected && (
                            <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-current/20 flex items-center justify-center">
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

                {/* 3. Assunto e Prioridade */}
                <Section
                  title="3. Assunto & Prioridade"
                  icon={<Ticket className="w-4 h-4 text-emerald-400" />}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Assunto */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-white/60">
                        Assunto do Chamado <span className="text-red-400">*</span>
                      </Label>
                      {loadingSubjects ? (
                        <div className="flex items-center gap-2 text-white/30 text-xs h-10 px-3 rounded-xl bg-white/5 border border-white/10">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando assuntos...
                        </div>
                      ) : (
                        <Select
                          value={selectedSubject}
                          onValueChange={v => {
                            setSelectedSubject(v);
                            setSubjectLabel(subjects.find(s => s.id === v)?.assunto ?? v);
                          }}
                        >
                          <SelectTrigger className="bg-white/5 border-white/10 text-white focus:ring-emerald-500 focus:border-emerald-500/40 text-xs h-10 rounded-xl">
                            <SelectValue placeholder="Selecione o assunto..." />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0f1220] border-white/10 text-white max-h-52 z-50">
                            {subjects.map(s => (
                              <SelectItem
                                key={s.id}
                                value={s.id}
                                className="focus:bg-emerald-500/20 focus:text-emerald-300 text-xs cursor-pointer"
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
                      <Label className="text-xs text-white/60">Nível de Prioridade</Label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {Object.entries(PRIORITY_LABELS).map(([key, { label, color, bg }]) => (
                          <button
                            key={key}
                            onClick={() => setPriority(key)}
                            className={`h-10 rounded-xl text-xs font-semibold border transition-all ${
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

                  {/* Observação adicional */}
                  <div className="space-y-1.5 pt-1">
                    <Label className="text-xs text-white/60">Observações adicionais para o técnico</Label>
                    <Textarea
                      value={observation}
                      onChange={e => setObservation(e.target.value)}
                      placeholder="Descreva observações específicas, instruções ou avisos..."
                      rows={3}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-emerald-500 focus-visible:border-emerald-500/40 resize-none text-xs rounded-xl"
                    />
                  </div>
                </Section>

                {/* 4. Destino no WhatsApp (Grupos da Equipe) */}
                <Section
                  title="4. Destino no WhatsApp (Equipe de Operações)"
                  icon={<WhatsAppIcon className="w-4 h-4 text-emerald-400" />}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-white/70">
                        Grupo WhatsApp que receberá a O.S.:
                      </Label>
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/20 text-emerald-300 border-emerald-400/30">
                        {whatsappGroups.length} grupos conectados
                      </Badge>
                    </div>

                    <Select
                      value={selectedGroupPhone}
                      onValueChange={setSelectedGroupPhone}
                    >
                      <SelectTrigger className="w-full bg-slate-900 border-white/15 text-white h-11 text-xs focus:ring-emerald-500 rounded-xl">
                        <SelectValue placeholder="Selecione o grupo..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 bg-slate-900 border-slate-800 text-white z-50">
                        {whatsappGroups.map((g) => (
                          <SelectItem
                            key={g.phone}
                            value={g.phone}
                            className="text-xs focus:bg-emerald-500/20 focus:text-emerald-300 cursor-pointer"
                          >
                            👥 {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <label className="flex items-center gap-2.5 cursor-pointer pt-1 select-none">
                      <input
                        type="checkbox"
                        checked={sendToGroupOnCreate}
                        onChange={(e) => setSendToGroupOnCreate(e.target.checked)}
                        className="w-4 h-4 rounded border-white/20 bg-black/40 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="text-xs text-white/80">
                        Disparar mensagem no grupo selecionado automaticamente ao abrir a O.S.
                      </span>
                    </label>
                  </div>
                </Section>
              </div>

              {/* ─── Coluna Direita: Live Console & WhatsApp Preview (5 Colunas) ─── */}
              <div className="lg:col-span-5 flex flex-col gap-5">
                
                {/* Card de Pré-visualização da O.S. (Estilo WhatsApp) */}
                <div
                  className="rounded-3xl border border-white/10 overflow-hidden sticky top-6 space-y-4 p-5"
                  style={{ background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(16px)' }}
                >
                  {/* Top Bar da Pré-visualização */}
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <WhatsAppIcon className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-white uppercase tracking-wider">Pré-visualização</p>
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[9px] px-1.5 py-0 font-mono">
                            Próxima do dia: #{formattedNextDailyNumber}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-emerald-400 font-medium">WhatsApp O.S. • {formattedDate}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsEditingLiveMessage(!isEditingLiveMessage)}
                        className="h-8 px-2.5 text-xs text-white/70 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg gap-1 border border-white/10"
                      >
                        <Edit3 className="w-3 h-3 text-emerald-400" />
                        {isEditingLiveMessage ? 'Visualizar' : 'Editar Texto'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={openTemplateModal}
                        title="Personalizar Estrutura Padrão"
                        className="h-8 w-8 p-0 text-white/50 hover:text-white hover:bg-white/10 rounded-lg border border-white/10"
                      >
                        <Sliders className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Bubble de Mensagem */}
                  <div
                    className="p-4 rounded-2xl border border-emerald-500/20 text-xs font-mono relative leading-relaxed text-emerald-100 shadow-inner"
                    style={{ background: 'linear-gradient(180deg, rgba(6,78,59,0.25) 0%, rgba(2,44,34,0.3) 100%)' }}
                  >
                    {isEditingLiveMessage ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-amber-300">
                          <span>✏️ Modo de edição manual ativo:</span>
                          {customOSText !== null && (
                            <button
                              onClick={() => { setCustomOSText(null); setIsEditingLiveMessage(false); }}
                              className="text-white/40 hover:text-white underline text-[10px]"
                            >
                              Restaurar gerado
                            </button>
                          )}
                        </div>
                        <Textarea
                          value={customOSText !== null ? customOSText : generateOSText()}
                          onChange={e => setCustomOSText(e.target.value)}
                          rows={14}
                          className="bg-black/60 border-emerald-500/40 text-emerald-100 text-xs font-mono leading-relaxed rounded-xl resize-none"
                        />
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap select-text max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
                        {effectiveMessage}
                      </div>
                    )}

                    <div className="mt-3 pt-2.5 border-t border-emerald-500/20 flex items-center justify-between text-[10px] text-white/40">
                      <span>{effectiveMessage.length} caracteres</span>
                      {customOSText !== null && (
                        <span className="text-amber-400 font-semibold">● Texto editado manualmente</span>
                      )}
                    </div>
                  </div>

                  {/* Ações Rápidas (Copiar e Abrir) */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      variant="outline"
                      onClick={handleCopyInfo}
                      disabled={!selectedClient}
                      className="bg-white/5 hover:bg-white/10 border-white/10 text-white text-xs h-10 gap-1.5 rounded-xl"
                    >
                      <Copy className="w-3.5 h-3.5 text-emerald-400" />
                      Copiar O.S.
                    </Button>
                    <Button
                      variant="outline"
                      onClick={openTemplateModal}
                      className="bg-white/5 hover:bg-white/10 border-white/10 text-white text-xs h-10 gap-1.5 rounded-xl"
                    >
                      <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                      Modelo Base
                    </Button>
                  </div>

                  {/* Mapa Geográfico */}
                  <div className="rounded-2xl border border-white/10 overflow-hidden bg-black/40">
                    <div className="px-3.5 py-2 border-b border-white/5 flex items-center justify-between text-xs">
                      <span className="text-white/60 font-medium flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Localização do Cliente
                      </span>
                      {mapsLink && (
                        <a
                          href={mapsLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-400 hover:text-emerald-300 text-[11px] flex items-center gap-1 transition-colors"
                        >
                          <Navigation className="w-3 h-3" /> Abrir Maps
                        </a>
                      )}
                    </div>

                    {mapUrl ? (
                      <div className="relative" style={{ paddingBottom: '60%' }}>
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
                      <div className="flex flex-col items-center justify-center py-10 text-white/20">
                        <MapPin className="w-8 h-8 mb-1.5 opacity-40" />
                        <p className="text-xs">Selecione o cliente para visualizar o mapa</p>
                      </div>
                    )}
                  </div>

                  {/* Botão de Envio Principal */}
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCreate}
                    disabled={creating || !selectedClient || !selectedSubject}
                    className="w-full h-13 py-3.5 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-xl shadow-emerald-600/30"
                    style={{
                      background: 'linear-gradient(135deg, #059669 0%, #16a34a 100%)',
                    }}
                  >
                    {creating ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Registrando e Despachando O.S....</>
                    ) : (
                      <><Send className="w-5 h-5" /> Abrir O.S. e Enviar para Grupo</>
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Modal de Configuração da Estrutura / Template da O.S. ─── */}
        <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
          <DialogContent className="max-w-2xl bg-[#0b0e17] border-white/15 text-white p-6 rounded-3xl shadow-2xl">
            <DialogHeader className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Sliders className="w-5 h-5" />
                </div>
                <DialogTitle className="text-xl font-bold text-white">
                  Personalizar Estrutura da O.S.
                </DialogTitle>
              </div>
              <DialogDescription className="text-white/60 text-xs">
                Edite a forma e o layout como a Ordem de Serviço será gerada e enviada para o WhatsApp. Clique nas variáveis abaixo para inseri-las no modelo.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Tags clicáveis para inserção rápida */}
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50 font-medium">
                  Variáveis dinâmicas disponíveis (clique para inserir):
                </Label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto custom-scrollbar p-1">
                  {TEMPLATE_VARIABLES.map(v => (
                    <button
                      key={v.tag}
                      type="button"
                      onClick={() => insertTagIntoTemplate(v.tag)}
                      title={v.desc}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono transition-all flex items-center gap-1"
                    >
                      <span>+</span>
                      <strong className="font-semibold">{v.label}:</strong>
                      <span className="opacity-75">{v.tag}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea do Modelo */}
              <div className="space-y-1.5">
                <Label className="text-xs text-white/70 font-medium">
                  Estrutura do Texto:
                </Label>
                <Textarea
                  ref={templateInputRef}
                  value={tempTemplateText}
                  onChange={e => setTempTemplateText(e.target.value)}
                  rows={10}
                  className="bg-black/60 border-white/15 text-white font-mono text-xs leading-relaxed focus-visible:ring-emerald-500 focus-visible:border-emerald-500/50 rounded-xl"
                  placeholder="Defina o modelo da O.S...."
                />
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2 border-t border-white/10">
              <Button
                type="button"
                variant="outline"
                onClick={handleRestoreDefaultTemplate}
                className="bg-white/5 border-white/10 text-white/70 hover:text-white text-xs h-10 rounded-xl"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                Restaurar Padrão AVL
              </Button>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="text-white/50 hover:text-white text-xs h-10 rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveTemplate}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-10 px-5 rounded-xl font-semibold gap-1.5 shadow-lg shadow-emerald-600/30"
                >
                  <Check className="w-4 h-4" />
                  Salvar Modelo
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de O.S. Segmentadas de Hoje (Contagem Diária) */}
        <DailyOSModal
          open={isDailyOrdersModalOpen}
          onOpenChange={setIsDailyOrdersModalOpen}
          orders={dailyOrders}
          formattedDate={formattedDate}
          totalCount={dailyCount}
        />
      </div>
    </PageTransition>
  );
};

// ─── Subcomponentes auxiliares ────────────────────────────────────────────────
const Section: React.FC<{
  title: string;
  icon: React.ReactNode;
  badge?: string;
  children: React.ReactNode;
}> = ({ title, icon, badge, children }) => (
  <div
    className="rounded-3xl border border-white/10 overflow-hidden"
    style={{ background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(12px)' }}
  >
    <div className="px-5 py-3.5 border-b border-white/5 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-emerald-400">{icon}</span>
        <span className="text-white/90 text-sm font-semibold tracking-wide">{title}</span>
      </div>
      {badge && (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20 text-[10px]">
          {badge}
        </Badge>
      )}
    </div>
    <div className="p-5 space-y-4">{children}</div>
  </div>
);

const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({
  icon, label, value,
}) => (
  <div className="flex items-start gap-2.5 rounded-xl bg-white/5 border border-white/5 px-3 py-2">
    <span className="mt-0.5 shrink-0">{icon}</span>
    <div className="min-w-0 flex-1">
      <p className="text-white/40 text-[10px] uppercase tracking-wide font-medium">{label}</p>
      <p className="text-white/90 text-xs font-medium break-all">{value}</p>
    </div>
  </div>
);

export default ISPFYNovaOS;

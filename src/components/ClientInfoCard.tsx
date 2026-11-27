import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Reorder } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ClientOntStatusCard } from '@/components/chat/ClientOntStatusCard';
import { SortableSidebarCard } from '@/components/chat/SortableSidebarCard';
import {
  useChatSidebarLayout,
  type ChatSidebarWidgetId,
} from '@/hooks/useChatSidebarLayout';
import type { SmartOltOnu } from '@/types/smartOlt';
import {
  User,
  MapPin,
  CreditCard,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Tag as TagIcon,
  Search,
  Bot,
  Sparkles,
  Wifi,
  WifiOff,
  Rocket,
  BarChart3,
  ClipboardList,
  Star,
  FileDown,
  Zap,
  Link2,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Check,
  X,
} from 'lucide-react';
import { ispfyService } from '@/services/ispfy/ispfyService';
import { whapiService } from '@/services/whapi/whapiService';
import type {
  ISPFYBandwidthSummary30d,
  ISPFYClienteData,
  ISPFYContratoData,
  ISPFYFaturaData,
  ISPFYLivePointStatus,
  ISPFYLoginData,
} from '@/types/ispfy';
import { db } from '@/config/firebase';
import {
  doc,
  updateDoc,
  setDoc,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { partitionCurrentAndFutureInvoices } from '@/utils/invoiceHelpers';

interface ClientInfoCardProps {
  clientId: string;
  clientPhone?: string;
  clientName?: string;
  onSendMessage?: (message: string) => void;
  onOntResolved?: (onu: SmartOltOnu | null) => void;
  onIspfyClientResolved?: (
    chatId: string,
    client: ISPFYClienteData | null,
    resolving: boolean
  ) => void;
  attendantSlot?: React.ReactNode;
  quickRepliesSlot?: React.ReactNode;
  onCloseMobile?: () => void;
}

const GENERIC_POINT_LABELS = new Set([
  'casa',
  'residencia',
  'residência',
  'comercio',
  'comércio',
  'principal',
  'loja',
  'trabalho',
  'escritorio',
  'escritório',
  'apartamento',
  'apto',
  'ponto 1',
  'ponto principal',
  'ponto',
  'fibra',
  'internet',
]);

function isUsefulOntQuery(value?: string | null): boolean {
  const trimmed = String(value || '').trim();
  if (trimmed.length < 3) return false;
  if (GENERIC_POINT_LABELS.has(trimmed.toLowerCase())) return false;
  return true;
}

const GENERIC_CHAT_NAMES = new Set([
  'cliente',
  'cliente whatsapp',
  'cliente sem nome',
  'sem nome',
  'whatsapp',
]);

function isMeaningfulClientName(name?: string): boolean {
  const trimmed = String(name || '').trim();
  if (trimmed.length < 4) return false;
  if (GENERIC_CHAT_NAMES.has(trimmed.toLowerCase())) return false;
  if (/^[\d\s()+-]+$/.test(trimmed)) return false;
  return true;
}

function buildCachePhoneVariants(rawPhone: string): string[] {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  if (digits.length < 8) return [];
  const local = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;
  const ddd = local.length >= 10 ? local.slice(0, 2) : '';
  const rest = ddd ? local.slice(2) : local;
  const list = [digits, local, local.length >= 10 ? `55${local}` : ''];
  if (ddd && rest.length === 9 && rest.startsWith('9')) {
    list.push(`${ddd}${rest.slice(1)}`, `55${ddd}${rest.slice(1)}`);
  } else if (ddd && rest.length === 8) {
    list.push(`${ddd}9${rest}`, `55${ddd}9${rest}`);
  }
  return Array.from(new Set(list.filter(Boolean)));
}

function getClientDisplayName(c: ISPFYClienteData): string {
  return String(c.nome_razao || c.razao || c.nome || 'Assinante ISPFY').trim();
}

function getClientDoc(c: ISPFYClienteData): string {
  return String(c.cpf_cnpj || c.cnpj_cpf || '').trim();
}

function getClientAddressLine(c: ISPFYClienteData): { line1: string; line2: string } {
  const rua = String(c.endereco_cobranca_rua || c.endereco || '').trim();
  const numero = String(c.endereco_cobranca_numero || c.numero || '').trim();
  const bairro = String(c.endereco_cobranca_bairro || c.bairro || '').trim();
  const cidade = String(c.cidade || '').trim();
  const uf = String(c.uf || '').trim();

  const line1 = [rua, numero].filter(Boolean).join(', ');
  const cidadeUf = [cidade, uf].filter(Boolean).join('-');
  const line2 = [bairro, cidadeUf].filter(Boolean).join(' • ');
  return { line1, line2 };
}

const AVAILABLE_TAGS = [
  { id: 'suporte', label: 'Suporte', color: 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30' },
  { id: 'financeiro', label: 'Financeiro', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' },
  { id: 'vendas', label: 'Vendas', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
  { id: 'urgente', label: 'Urgente', color: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30' },
  { id: 'resolvido', label: 'Resolvido', color: 'bg-muted text-muted-foreground border-border' },
];

interface CachedClient360Entry {
  fetchedAt: number;
  ispfyData: ISPFYClienteData;
  contracts: ISPFYContratoData[];
  logins: ISPFYLoginData[];
  livePoints: ISPFYLivePointStatus[];
  invoices: ISPFYFaturaData[];
}

const CLIENT_360_CACHE_TTL_MS = 2 * 60 * 1000;
const client360Cache = new Map<string, CachedClient360Entry>();

function saveClient360Cache(chatId: string, entry: CachedClient360Entry) {
  client360Cache.set(chatId, entry);
  if (client360Cache.size > 40) {
    const oldestKey = client360Cache.keys().next().value;
    if (oldestKey) client360Cache.delete(oldestKey);
  }
}

function ClientInfoCardInner({
  clientId,
  clientPhone,
  clientName,
  onSendMessage,
  onOntResolved,
  onIspfyClientResolved,
  attendantSlot,
  quickRepliesSlot,
  onCloseMobile,
}: ClientInfoCardProps) {
  const navigate = useNavigate();
  const { canAccessRoute } = useAuth();
  const {
    order: sidebarOrder,
    hiddenIds: hiddenWidgetIds,
    setOrder: setSidebarOrder,
    moveWidget,
    toggleWidgetVisibility,
    resetLayout,
  } = useChatSidebarLayout();
  const [isEditingLayout, setIsEditingLayout] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ispfyData, setIspfyData] = useState<ISPFYClienteData | null>(null);
  const [contracts, setContracts] = useState<ISPFYContratoData[]>([]);
  const [logins, setLogins] = useState<ISPFYLoginData[]>([]);
  const [invoices, setInvoices] = useState<ISPFYFaturaData[]>([]);
  const [livePoints, setLivePoints] = useState<ISPFYLivePointStatus[]>([]);
  const [usageByPoint, setUsageByPoint] = useState<Record<string, ISPFYBandwidthSummary30d | null>>({});
  const [loadingUsageId, setLoadingUsageId] = useState<string | null>(null);
  const [sendingCsat, setSendingCsat] = useState(false);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [savedIspfyId, setSavedIspfyId] = useState<string | null>(null);
  const [savedOnuId, setSavedOnuId] = useState<string | null>(null);
  const [chatMetaReadyFor, setChatMetaReadyFor] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const loadedForChatRef = useRef<{ chatId: string; ispfyId: string; tick: number } | null>(null);

  // Busca manual inline para vincular/trocar cliente ISPFY
  const [showManualSearch, setShowManualSearch] = useState(false);
  const [manualQuery, setManualQuery] = useState('');
  const [manualSearching, setManualSearching] = useState(false);
  const [manualResults, setManualResults] = useState<ISPFYClienteData[]>([]);

  const destinationPhone = clientPhone || clientId;

  useEffect(() => {
    if (!clientId) return;
    loadedForChatRef.current = null;
    setSavedIspfyId(null);
    setSavedOnuId(null);
    setChatMetaReadyFor(null);
    setShowManualSearch(false);
    setManualResults([]);
    setManualQuery('');

    const unsub = onSnapshot(
      doc(db, 'chat', clientId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setActiveTags(Array.isArray(data.tags) ? data.tags : []);
          setAiEnabled(Boolean(data.aiEnabled));
          const linked = data.ispfy_id || data.ixc_id || null;
          setSavedIspfyId(linked ? String(linked) : null);
          setSavedOnuId(data.smartolt_onu_id ? String(data.smartolt_onu_id) : null);
        } else {
          setActiveTags([]);
          setAiEnabled(false);
          setSavedIspfyId(null);
          setSavedOnuId(null);
        }
        setChatMetaReadyFor(clientId);
      },
      () => {
        setChatMetaReadyFor(clientId);
      }
    );
    return () => unsub();
  }, [clientId]);

  const ontPppoeLogins = useMemo(() => {
    const list: string[] = [];
    for (const l of logins) {
      const user = String(l.usuario || l.login || '').trim();
      if (isUsefulOntQuery(user)) list.push(user);
    }
    for (const c of contracts) {
      const user = String(c.login || '').trim();
      if (isUsefulOntQuery(user)) list.push(user);
    }
    return Array.from(new Set(list));
  }, [logins, contracts]);

  const ontFullNames = useMemo(() => {
    const list: string[] = [];
    if (ispfyData) {
      const displayName = getClientDisplayName(ispfyData);
      if (isMeaningfulClientName(displayName) && displayName.includes(' ')) {
        list.push(displayName);
      }
    }
    if (isMeaningfulClientName(clientName) && String(clientName).trim().includes(' ')) {
      list.push(String(clientName).trim());
    }
    return Array.from(new Set(list));
  }, [ispfyData, clientName]);

  const loadFullClientDetails = useCallback(
    async (client: ISPFYClienteData, shouldPersistLink: boolean) => {
      const clientIdStr = String(client.id || '');
      const [clientContracts, clientLogins, clientInvoices, pointsStatus] = await Promise.all([
        clientIdStr ? ispfyService.getContratosByCliente(clientIdStr).catch(() => []) : Promise.resolve([]),
        clientIdStr ? ispfyService.getLoginsByCliente(clientIdStr).catch(() => []) : Promise.resolve([]),
        clientIdStr ? ispfyService.getFaturasByCliente(clientIdStr).catch(() => []) : Promise.resolve([]),
        clientIdStr ? ispfyService.getClientLivePointStatuses(clientIdStr).catch(() => []) : Promise.resolve([]),
      ]);

      const sortedOpenInvoices = partitionCurrentAndFutureInvoices(clientInvoices).allOpen.map(
        (item) => item.invoice
      );

      if (shouldPersistLink && clientId && clientIdStr) {
        const displayName = getClientDisplayName(client);
        setDoc(
          doc(db, 'chat', clientId),
          {
            ispfy_id: clientIdStr,
            ixc_id: clientIdStr,
            ...(isMeaningfulClientName(displayName) ? { ispfy_name: displayName } : {}),
          },
          { merge: true }
        ).catch(() => undefined);
      }

      return {
        clientContracts,
        clientLogins,
        openInvoices: sortedOpenInvoices,
        pointsStatus,
      };
    },
    [clientId]
  );

  const toggleAI = async () => {
    if (!clientId) return;
    try {
      const newStatus = !aiEnabled;
      await updateDoc(doc(db, 'chat', clientId), { aiEnabled: newStatus });
      await addDoc(collection(db, 'chat', clientId, 'mensagens'), {
        user: 'Sistema',
        content: `🔄 Atendimento alterado para modo ${newStatus ? 'IA (Josué)' : 'HUMANO'}`,
        timestamp: new Date(),
        isAdmin: true,
        isPrivate: true,
        source: 'system',
      });
      toast.success(
        newStatus ? '🤖 IA Ativada para este cliente' : '👤 IA Desativada — Atendimento Humano'
      );
    } catch {
      toast.error('Erro ao alterar status da IA');
    }
  };

  useEffect(() => {
    if (!clientId || chatMetaReadyFor !== clientId) return;

    // Evita re-buscar quando acabamos de salvar automaticamente o ispfy_id no Firestore
    if (
      savedIspfyId &&
      loadedForChatRef.current &&
      loadedForChatRef.current.chatId === clientId &&
      loadedForChatRef.current.ispfyId === savedIspfyId &&
      loadedForChatRef.current.tick === refreshTick
    ) {
      return;
    }

    // Hidratação instantânea (0ms) via cache em memória de 2 min ao alternar entre conversas
    if (refreshTick === 0) {
      const cached = client360Cache.get(clientId);
      if (
        cached &&
        Date.now() - cached.fetchedAt < CLIENT_360_CACHE_TTL_MS &&
        (!savedIspfyId || String(cached.ispfyData.id || '') === savedIspfyId)
      ) {
        loadedForChatRef.current = {
          chatId: clientId,
          ispfyId: String(cached.ispfyData.id || ''),
          tick: refreshTick,
        };
        setUsageByPoint({});
        setIspfyData(cached.ispfyData);
        setContracts(cached.contracts);
        setLogins(cached.logins);
        setLivePoints(cached.livePoints);
        setInvoices(cached.invoices);
        setLoading(false);
        onIspfyClientResolved?.(clientId, cached.ispfyData, false);
        return;
      }
    }

    let cancelled = false;
    const fetchIspfyData = async () => {
      setLoading(true);
      onIspfyClientResolved?.(clientId, null, true);
      setUsageByPoint({});
      setIspfyData(null);
      setContracts([]);
      setLogins([]);
      setInvoices([]);
      setLivePoints([]);

      try {
        let client: ISPFYClienteData | null = null;
        let linkedFromSavedId = false;

        // 1. Prioridade máxima: ID já vinculado no documento do chat (1 chamada instantânea)
        if (savedIspfyId) {
          client = await ispfyService.getClienteById(savedIspfyId).catch(() => null);
          if (client) linkedFromSavedId = true;
        }

        // 2. Busca por telefone (cache em memória + /cliente/contato + /cliente)
        if (!client && destinationPhone) {
          client = await ispfyService.getClienteByPhone(destinationPhone).catch(() => null);
        }

        // 3. Fallback: cache sincronizado no Firestore (ispfy_clients_cache)
        if (!client && destinationPhone) {
          const variants = buildCachePhoneVariants(destinationPhone).slice(0, 3);
          for (const variant of variants) {
            try {
              const snap = await getDocs(
                query(
                  collection(db, 'ispfy_clients_cache'),
                  where('phones', 'array-contains', variant),
                  limit(1)
                )
              );
              if (!snap.empty) {
                const cached = snap.docs[0].data();
                if (cached?.id) {
                  client = await ispfyService.getClienteById(String(cached.id)).catch(() => null);
                  if (client) break;
                }
              }
            } catch {
              // segue para próximo fallback
            }
          }
        }

        // 4. Fallback por nome (apenas se nome real e correspondência única ou exata)
        if (!client && isMeaningfulClientName(clientName)) {
          const results = await ispfyService.getClienteByNome(clientName!.trim()).catch(() => []);
          const normalizedTarget = clientName!.trim().toLowerCase();
          const exact = results.find(
            (r) => getClientDisplayName(r).toLowerCase() === normalizedTarget
          );
          if (exact) {
            client = exact;
          } else if (results.length === 1) {
            client = results[0];
          }
        }

        if (cancelled) return;

        if (client) {
          const details = await loadFullClientDetails(client, !linkedFromSavedId);
          if (cancelled) return;
          loadedForChatRef.current = {
            chatId: clientId,
            ispfyId: String(client.id || ''),
            tick: refreshTick,
          };
          setIspfyData(client);
          onIspfyClientResolved?.(clientId, client, false);
          setContracts(details.clientContracts);
          setLogins(details.clientLogins);
          setLivePoints(details.pointsStatus);
          setInvoices(details.openInvoices);
          saveClient360Cache(clientId, {
            fetchedAt: Date.now(),
            ispfyData: client,
            contracts: details.clientContracts,
            logins: details.clientLogins,
            livePoints: details.pointsStatus,
            invoices: details.openInvoices,
          });
        } else {
          onIspfyClientResolved?.(clientId, null, false);
        }
      } catch (error) {
        console.error('Erro ao carregar dados do ISPFY:', error);
        if (!cancelled) onIspfyClientResolved?.(clientId, null, false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchIspfyData();
    return () => {
      cancelled = true;
    };
  }, [
    clientId,
    chatMetaReadyFor,
    savedIspfyId,
    destinationPhone,
    clientName,
    refreshTick,
    loadFullClientDetails,
    onIspfyClientResolved,
  ]);

  const handleManualSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = manualQuery.trim();
    if (!term) return;

    setManualSearching(true);
    setManualResults([]);
    try {
      const digitsOnly = term.replace(/\D/g, '');
      const found: ISPFYClienteData[] = [];
      const seenIds = new Set<string>();
      const pushUnique = (c: ISPFYClienteData | null | undefined) => {
        if (!c?.id) return;
        const sid = String(c.id);
        if (!seenIds.has(sid)) {
          seenIds.add(sid);
          found.push(c);
        }
      };

      if (digitsOnly.length === 11 || digitsOnly.length === 14) {
        pushUnique(await ispfyService.getClienteByCnpjCpf(digitsOnly).catch(() => null));
      }
      if (digitsOnly.length >= 8 && digitsOnly.length <= 13 && found.length === 0) {
        pushUnique(await ispfyService.getClienteByPhone(digitsOnly).catch(() => null));
      }
      if (digitsOnly.length >= 1 && digitsOnly.length <= 7 && /^\d+$/.test(term)) {
        pushUnique(await ispfyService.getClienteById(digitsOnly).catch(() => null));
      }

      const byName = await ispfyService.getClienteByNome(term).catch(() => []);
      byName.slice(0, 8).forEach((c) => pushUnique(c));

      setManualResults(found.slice(0, 8));
      if (found.length === 0) {
        toast.error('Nenhum cliente encontrado no ISPFY com esse termo.');
      }
    } catch {
      toast.error('Erro ao consultar o ISPFY.');
    } finally {
      setManualSearching(false);
    }
  };

  const handleSelectManualClient = async (client: ISPFYClienteData) => {
    setLoading(true);
    setShowManualSearch(false);
    setManualResults([]);
    setManualQuery('');
    try {
      const details = await loadFullClientDetails(client, true);
      loadedForChatRef.current = {
        chatId: clientId,
        ispfyId: String(client.id || ''),
        tick: refreshTick,
      };
      setIspfyData(client);
      onIspfyClientResolved?.(clientId, client, false);
      setContracts(details.clientContracts);
      setLogins(details.clientLogins);
      setLivePoints(details.pointsStatus);
      setInvoices(details.openInvoices);
      saveClient360Cache(clientId, {
        fetchedAt: Date.now(),
        ispfyData: client,
        contracts: details.clientContracts,
        logins: details.clientLogins,
        livePoints: details.pointsStatus,
        invoices: details.openInvoices,
      });
      toast.success(`Vinculado a ${getClientDisplayName(client)}!`);
    } catch {
      toast.error('Erro ao carregar contratos do cliente.');
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = async (tagId: string) => {
    try {
      const chatRef = doc(db, 'chat', clientId);
      if (activeTags.includes(tagId)) {
        await updateDoc(chatRef, { tags: arrayRemove(tagId) });
      } else {
        await updateDoc(chatRef, { tags: arrayUnion(tagId) });
      }
    } catch {
      toast.error('Erro ao atualizar tags');
    }
  };

  const handleSendPix = async (
    fatura: ISPFYFaturaData,
    useNativeButton: boolean
  ) => {
    const faturaId = String(fatura.id || '');
    const valor = String(fatura.valor || '0,00');
    const vencimento = String(fatura.data_vencimento || '');

    try {
      toast.loading(useNativeButton ? 'Enviando Botão PIX (Z-API)...' : 'Gerando PIX...', {
        id: 'pix-task',
      });
      const cpf = ispfyData?.cpf_cnpj || ispfyData?.cnpj_cpf;
      const pixData = await ispfyService.getPixQrCode(faturaId, cpf, fatura);
      const pixCode = String(
        pixData?.pix_copia_cola || pixData?.qrcode_text || pixData?.qr_code || ''
      ).trim();

      if (!pixCode) {
        // Se a fatura no banco não gerou PIX, oferece/envia linha digitável ou link do boleto
        const linha = String(pixData?.linha_digitavel || fatura.linha_digitavel || '').trim();
        const link =
          pixData?.link_boleto || ispfyService.extractHttpLinkFromInvoiceRecord(fatura);
        if ((linha || link) && onSendMessage) {
          const fallbackParts = [
            `📄 *2ª Via da Fatura*`,
            `💰 *Valor:* R$ ${valor}`,
            `📅 *Vencimento:* ${vencimento}`,
            linha ? `\n🔢 *Código de Barras (Linha Digitável):*\n${linha}` : '',
            link ? `\n🔗 *Link do Boleto:*\n${link}` : '',
          ].filter(Boolean);
          onSendMessage(fallbackParts.join('\n'));
          if (linha) navigator.clipboard?.writeText(linha).catch(() => undefined);
          toast.info(
            'Esta fatura não possui PIX no banco — linha digitável/link enviados no chat!',
            { id: 'pix-task' }
          );
          return;
        }

        toast.error(
          'Esta fatura ainda não tem código PIX gerado no ISPFY. Tente enviar o boleto em PDF.',
          { id: 'pix-task' }
        );
        return;
      }

      navigator.clipboard?.writeText(pixCode).catch(() => undefined);

      if (useNativeButton && destinationPhone) {
        const res = await whapiService.sendButtonPix({
          to: destinationPhone,
          pixCode,
          message: `💰 *Fatura AVL Telecom*\nValor: *R$ ${valor}* • Vencimento: *${vencimento}*\n\nToque no botão abaixo para copiar o PIX:`,
          merchantName: 'AVL Telecom',
        });
        if (res.sent) {
          // Registra no histórico do chat sem reenviar pela Cloud Function (evita duplicidade)
          const historyText =
            `💠 *PIX Enviado (Botão Copiar)*\n` +
            `💰 Valor: R$ ${valor} • Venc.: ${vencimento}\n\n${pixCode}`;
          await addDoc(collection(db, 'chat', clientId, 'mensagens'), {
            user: 'Admin',
            content: historyText,
            timestamp: new Date(),
            isAdmin: true,
            skipWhatsappSync: true,
            source: 'app',
            zapiMessageId: res.id || null,
            deliveryStatus: 'SENT',
          }).catch(() => undefined);
          await setDoc(
            doc(db, 'chat', clientId),
            {
              lastMessage: `💠 PIX enviado (R$ ${valor})`,
              lastMessageTime: new Date(),
            },
            { merge: true }
          ).catch(() => undefined);

          toast.success('PIX enviado com botão de cópia no WhatsApp e copiado!', {
            id: 'pix-task',
          });
          return;
        }
      }

      if (onSendMessage) {
        const message =
          `✅ *Código PIX Gerado*\n\n` +
          `💰 *Valor:* R$ ${valor}\n` +
          `📅 *Vencimento:* ${vencimento}\n\n` +
          `👇 *Copia e Cola:*\n\n${pixCode}\n\n` +
          `_Para pagar, abra o app do seu banco e escolha a opção "PIX Copia e Cola"._`;
        onSendMessage(message);
        toast.success('PIX enviado no WhatsApp e copiado com sucesso!', { id: 'pix-task' });
      }
    } catch (err) {
      console.error('Erro ao enviar PIX:', err);
      toast.error('Erro ao gerar/enviar PIX. Verifique a conexão com ISPFY/Z-API.', {
        id: 'pix-task',
      });
    }
  };

  const handleSendBoletoPdf = async (f: ISPFYFaturaData) => {
    try {
      toast.loading('Obtendo PDF/Link do boleto...', { id: 'link-task' });
      const cpf = ispfyData?.cpf_cnpj || ispfyData?.cnpj_cpf;
      let paymentLink = ispfyService.extractHttpLinkFromInvoiceRecord(f);
      if (!paymentLink && f.id) {
        const res = await ispfyService.getBoletoPdf(f.id, cpf).catch(() => null);
        if (res?.url && /^https?:\/\//i.test(res.url)) {
          paymentLink = res.url;
        }
      }
      if (!paymentLink) {
        toast.error('Link/PDF não disponível nesta fatura.', { id: 'link-task' });
        return;
      }

      navigator.clipboard?.writeText(paymentLink).catch(() => undefined);

      if (paymentLink.toLowerCase().includes('.pdf') && destinationPhone) {
        const docRes = await whapiService.sendDocument({
          to: destinationPhone,
          document: paymentLink,
          fileName: `Fatura_AVL_${f.id || 'boleto'}.pdf`,
          caption: `📄 Boleto AVL Telecom — R$ ${f.valor} (Venc. ${f.data_vencimento})`,
          extension: 'pdf',
        });
        if (docRes.sent) {
          await addDoc(collection(db, 'chat', clientId, 'mensagens'), {
            user: 'Admin',
            content: `📄 Boleto AVL Telecom — R$ ${f.valor} (Venc. ${f.data_vencimento})`,
            timestamp: new Date(),
            isAdmin: true,
            skipWhatsappSync: true,
            source: 'app',
            mediaType: 'document',
            mediaUrl: paymentLink,
            mediaName: `Fatura_AVL_${f.id || 'boleto'}.pdf`,
            zapiMessageId: docRes.id || null,
            deliveryStatus: 'SENT',
          }).catch(() => undefined);
          await setDoc(
            doc(db, 'chat', clientId),
            {
              lastMessage: `📄 Fatura_AVL_${f.id || 'boleto'}.pdf`,
              lastMessageTime: new Date(),
            },
            { merge: true }
          ).catch(() => undefined);
          toast.success('PDF do boleto enviado como documento no WhatsApp!', { id: 'link-task' });
          return;
        }
      }

      if (onSendMessage) {
        const message = `🔗 *Link de Pagamento*\n\n💰 *Valor:* R$ ${f.valor}\n📅 *Vencimento:* ${f.data_vencimento}\n\nPara pagar, acesse o link abaixo:\n${paymentLink}`;
        onSendMessage(message);
        toast.success('Link enviado e copiado!', { id: 'link-task' });
      }
    } catch {
      toast.error('Erro ao enviar boleto.', { id: 'link-task' });
    }
  };

  const handleActivateQuickTurbo = async (idPonto: string) => {
    try {
      toast.loading('Consultando planos de Turbo...', { id: 'turbo-task' });
      const plans = await ispfyService.getTestablePlans(idPonto, false, false);
      if (!plans || plans.length === 0) {
        toast.error('Nenhum plano superior disponível para Turbo neste ponto.', { id: 'turbo-task' });
        return;
      }
      const sorted = [...plans].sort(
        (a, b) => Number(b.velocidade_download || 0) - Number(a.velocidade_download || 0)
      );
      const topPlan = sorted[0];
      const finalDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const res = await ispfyService.activatePlanTest(idPonto, String(topPlan.id), finalDate);
      if (res.success) {
        toast.success(`Turbo (${topPlan.nome || topPlan.plano || 'Upgrade'}) ativado por 7 dias!`, {
          id: 'turbo-task',
        });
        if (onSendMessage) {
          onSendMessage(
            `🚀 *Presente AVL Telecom!* Acabamos de ativar um *Turbo de Velocidade* na sua internet válido até *${finalDate
              .split('-')
              .reverse()
              .join('/')}*! Aproveite! ⚡`
          );
        }
      } else {
        toast.error(res.message, { id: 'turbo-task' });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao ativar Turbo.', { id: 'turbo-task' });
    }
  };

  const handleLoadPointUsage = async (idPonto: string) => {
    setLoadingUsageId(idPonto);
    try {
      const summary = await ispfyService.getBandwidthSummary30Days(idPonto);
      setUsageByPoint((prev) => ({ ...prev, [idPonto]: summary }));
      if (!summary) {
        toast.info('Sem dados de consumo nos últimos 30 dias para este ponto.');
      }
    } catch {
      toast.error('Não foi possível consultar consumo do ponto.');
    } finally {
      setLoadingUsageId(null);
    }
  };

  const handleSendCsat = async () => {
    if (!destinationPhone) return;
    setSendingCsat(true);
    try {
      const res = await whapiService.sendCsatSurvey({
        to: destinationPhone,
        clientName: ispfyData?.razao || ispfyData?.nome || clientName || 'Cliente',
        chatId: clientId,
      });
      if (res.sent) {
        toast.success('Pesquisa de satisfação (botões Z-API) enviada!');
      } else {
        toast.error(res.error || 'Falha ao enviar pesquisa.');
      }
    } finally {
      setSendingCsat(false);
    }
  };

  const [showFutureInvoices, setShowFutureInvoices] = useState(false);

  useEffect(() => {
    setShowFutureInvoices(false);
  }, [clientId]);

  const { current: currentInvoices, future: futureInvoices } = useMemo(
    () => partitionCurrentAndFutureInvoices(invoices),
    [invoices]
  );

  const visibleInvoices = showFutureInvoices
    ? [...currentInvoices, ...futureInvoices]
    : currentInvoices;

  const hiddenSet = useMemo(() => new Set(hiddenWidgetIds), [hiddenWidgetIds]);

  const widgetNodes: Record<ChatSidebarWidgetId, React.ReactNode> = {
    josue_ai: (
      <Card
        className={`bg-card shadow-sm border overflow-hidden transition-all duration-200 ${
          aiEnabled ? 'border-indigo-500/40 ring-1 ring-indigo-500/20' : 'border-border'
        }`}
      >
        <div
          className={`h-1 w-full ${aiEnabled ? 'bg-indigo-600 animate-pulse' : 'bg-transparent'}`}
        />
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`p-2 rounded-xl transition-all shrink-0 ${
                  aiEnabled
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <Bot className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-foreground uppercase tracking-tight flex items-center gap-1">
                  Josué IA
                  {aiEnabled && <Sparkles className="w-2.5 h-2.5 text-indigo-400" />}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {aiEnabled ? 'Respondendo automático' : 'Modo humano ativo'}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant={aiEnabled ? 'default' : 'outline'}
              className="h-7 px-2.5 rounded-lg text-[10px] font-bold"
              onClick={toggleAI}
            >
              {aiEnabled ? 'DESATIVAR' : 'ATIVAR IA'}
            </Button>
          </div>
        </CardContent>
      </Card>
    ),

    tags_csat: (
      <Card className="bg-card shadow-sm border-border overflow-hidden">
        <CardHeader className="p-3 border-b border-border/60 bg-muted/30 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-[11px] font-bold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider">
            <TagIcon className="w-3.5 h-3.5" />
            Classificação &amp; CSAT
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px] text-amber-600 dark:text-amber-300 hover:bg-amber-500/10 gap-1"
            disabled={sendingCsat}
            onClick={handleSendCsat}
            title="Enviar pesquisa de satisfação com botões interativos Z-API"
          >
            {sendingCsat ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Star className="w-3 h-3" />
            )}
            Avaliar
          </Button>
        </CardHeader>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-1.5">
            {AVAILABLE_TAGS.map((tag) => {
              const isActive = activeTags.includes(tag.id);
              return (
                <Badge
                  key={tag.id}
                  variant="outline"
                  className={`cursor-pointer transition-all border px-2 py-0.5 text-[10px] rounded-full ${
                    isActive
                      ? tag.color
                      : 'bg-muted/40 text-muted-foreground border-border/60 hover:border-border'
                  }`}
                  onClick={() => toggleTag(tag.id)}
                >
                  {tag.label}
                  {isActive && <CheckCircle2 className="w-2.5 h-2.5 ml-1" />}
                </Badge>
              );
            })}
          </div>
        </CardContent>
      </Card>
    ),

    smartolt: (
      <ClientOntStatusCard
        clientId={clientId}
        savedOnuId={savedOnuId}
        pppoeLogins={ontPppoeLogins}
        fullNames={ontFullNames}
        onSendMessage={onSendMessage}
        onOntResolved={onOntResolved}
      />
    ),

    ispfy_client: (
      <Card className="bg-card shadow-sm border-border overflow-hidden">
        <CardHeader className="p-3 border-b border-border/60 bg-muted/30 flex flex-row items-center justify-between space-y-0 gap-1">
          <CardTitle className="text-[11px] font-bold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider truncate">
            <User className="w-3.5 h-3.5 shrink-0" />
            Assinante ISPFY
          </CardTitle>
          <div className="flex items-center gap-0.5 shrink-0">
            {ispfyData?.id && (
              <>
                {canAccessRoute('/ispfy/consulta') && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1.5 text-[10px] text-primary hover:bg-primary/10 gap-1"
                    onClick={() => navigate(`/ispfy/cliente/${ispfyData.id}`)}
                    title="Abrir Ficha Completa"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Ficha
                  </Button>
                )}
                {canAccessRoute('/ispfy/nova-os') && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 gap-1"
                    onClick={() =>
                      navigate(`/ispfy/nova-os?clienteId=${ispfyData.id}`, {
                        state: { preselectedClient: ispfyData },
                      })
                    }
                    title="Abrir Nova O.S. para este cliente"
                  >
                    <ClipboardList className="w-3 h-3" />
                    O.S.
                  </Button>
                )}
              </>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => setShowManualSearch((prev) => !prev)}
              title={
                ispfyData ? 'Trocar cliente vinculado no ISPFY' : 'Buscar e vincular cliente ISPFY'
              }
            >
              {showManualSearch ? <X className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => {
                client360Cache.delete(clientId);
                setRefreshTick((t) => t + 1);
              }}
              title="Recarregar dados do ISPFY"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3 space-y-3">
          {showManualSearch && (
            <div className="p-2.5 rounded-xl bg-secondary/50 border border-border/80 space-y-2">
              <form onSubmit={handleManualSearchSubmit} className="flex gap-1.5">
                <Input
                  value={manualQuery}
                  onChange={(e) => setManualQuery(e.target.value)}
                  placeholder="CPF, nome, telefone ou ID..."
                  className="h-7 text-xs bg-background"
                  autoFocus
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={manualSearching || !manualQuery.trim()}
                  className="h-7 px-2.5 text-[10px] shrink-0"
                >
                  {manualSearching ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Search className="w-3 h-3" />
                  )}
                </Button>
              </form>
              {manualResults.length > 0 && (
                <div className="space-y-1 max-h-44 overflow-y-auto">
                  {manualResults.map((cand) => (
                    <button
                      key={cand.id}
                      type="button"
                      onClick={() => handleSelectManualClient(cand)}
                      className="w-full text-left p-2 rounded-lg bg-card hover:bg-primary/10 border border-border/60 hover:border-primary/40 transition-colors"
                    >
                      <p className="text-[11px] font-bold text-foreground truncate">
                        {getClientDisplayName(cand)}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">
                        ID #{cand.id}
                        {getClientDoc(cand) ? ` • ${getClientDoc(cand)}` : ''}
                        {cand.endereco_cobranca_bairro || cand.bairro
                          ? ` • ${cand.endereco_cobranca_bairro || cand.bairro}`
                          : ''}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="py-5 flex flex-col items-center justify-center">
              <Loader2 className="w-6 h-6 text-primary animate-spin mb-1.5" />
              <p className="text-[11px] text-muted-foreground font-medium">
                Buscando dados no ISPFY...
              </p>
            </div>
          ) : ispfyData ? (
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <User className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">
                    {getClientDisplayName(ispfyData)}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    ID: {ispfyData.id}
                    {getClientDoc(ispfyData) ? ` • ${getClientDoc(ispfyData)}` : ''}
                  </p>
                </div>
              </div>

              {(() => {
                const addr = getClientAddressLine(ispfyData);
                if (!addr.line1 && !addr.line2) return null;
                return (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {addr.line1}
                      {addr.line1 && addr.line2 ? <br /> : null}
                      {addr.line2}
                    </p>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="py-2 text-center space-y-2.5">
              <AlertCircle className="w-6 h-6 text-amber-500/70 mx-auto" />
              <p className="text-xs text-muted-foreground px-2">
                Número <span className="font-mono font-semibold">{destinationPhone}</span> não
                encontrado automaticamente no ISPFY.
              </p>
              {!showManualSearch && (
                <div className="px-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-[11px] h-8 gap-1.5"
                    onClick={() => setShowManualSearch(true)}
                  >
                    <Search className="w-3.5 h-3.5" />
                    Buscar e Vincular Assinante
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    ),

    ispfy_contracts: (
      <Card className="bg-card shadow-sm border-border overflow-hidden">
        <CardHeader className="p-3 border-b border-border/60 bg-muted/30 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-[11px] font-bold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider">
            <FileText className="w-3.5 h-3.5" />
            Contratos &amp; Conexão
          </CardTitle>
          {contracts.length > 0 && (
            <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
              {contracts.length}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="p-3 space-y-2">
          {loading ? (
            <div className="py-3 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              Carregando contratos...
            </div>
          ) : !ispfyData ? (
            <p className="text-[11px] text-muted-foreground italic">
              Vincule o assinante no card ISPFY para ver contratos e PPPoE.
            </p>
          ) : (
            <>
              {contracts.length > 0 ? (
                contracts.map((c) => {
                  const matchingPoint = livePoints.find(
                    (p) => String(p.idContrato) === String(c.id)
                  );
                  const matchingLogin =
                    logins.find((l) => String(l.id_contrato || '') === String(c.id)) || logins[0];
                  const statusStr = String(c.status_contrato || c.status || '').toLowerCase();
                  const isAtivo =
                    statusStr === 'ativo' ||
                    statusStr === 'a' ||
                    (String(c.ativo || c.contrato_ativo || '').toLowerCase() === 's' &&
                      !statusStr.includes('bloq') &&
                      !statusStr.includes('canc'));
                  const isBlocked =
                    statusStr.includes('bloq') ||
                    Boolean(matchingPoint?.isBlocked) ||
                    (!isAtivo && !statusStr.includes('canc'));
                  const planTitle =
                    c.descricao ||
                    c.contrato ||
                    matchingPoint?.planoNome ||
                    `Contrato #${c.id}`;
                  const pppoeLogin =
                    matchingLogin?.usuario ||
                    matchingLogin?.login ||
                    c.login ||
                    matchingPoint?.nomePonto ||
                    'N/A';

                  return (
                    <div
                      key={c.id}
                      className="p-2 bg-primary/5 rounded-lg border border-primary/15 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-foreground truncate flex-1">
                          {planTitle}
                        </span>
                        <Badge
                          variant={isBlocked ? 'destructive' : 'secondary'}
                          className="text-[9px] h-4 px-1.5"
                        >
                          {isBlocked ? 'Bloqueado' : isAtivo ? 'Ativo' : statusStr || 'Inativo'}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">
                        Login: {pppoeLogin}
                      </p>

                      {isBlocked && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full h-6 text-[9px] border-amber-500/40 text-amber-600 dark:text-amber-300 hover:bg-amber-500/10 font-bold gap-1.5"
                          onClick={async () => {
                            toast.loading('Realizando desbloqueio...', { id: 'unlock-task' });
                            const res = await ispfyService.unlockContract(c.id!);
                            if (res.success) {
                              toast.success(res.message, { id: 'unlock-task' });
                              if (onSendMessage) {
                                onSendMessage(
                                  '✅ *Aviso:* Sua conexão foi liberada em confiança! Por favor, reinicie seu equipamento em alguns minutos.'
                                );
                              }
                            } else {
                              toast.error(res.message, { id: 'unlock-task' });
                            }
                          }}
                        >
                          <Clock className="w-3 h-3" />
                          DESBLOQUEIO EM CONFIANÇA
                        </Button>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-[10px] text-muted-foreground italic">
                  Nenhum contrato encontrado.
                </p>
              )}

              {livePoints.length > 0 && (
                <div className="pt-1 space-y-1.5">
                  {livePoints.map((pt) => {
                    const usage = usageByPoint[pt.idPonto];
                    return (
                      <div
                        key={pt.idPonto}
                        className="p-2 rounded-lg border border-border bg-muted/30 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold min-w-0">
                            {pt.conexaoStatus === 'online' ? (
                              <Wifi className="w-3 h-3 text-emerald-500 shrink-0" />
                            ) : (
                              <WifiOff className="w-3 h-3 text-rose-500 shrink-0" />
                            )}
                            <span
                              className={
                                pt.conexaoStatus === 'online'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }
                            >
                              {pt.conexaoStatus.toUpperCase()}
                            </span>
                            {pt.ipWan && (
                              <span className="text-muted-foreground font-mono truncate">
                                {pt.ipWan}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-1.5 text-[9px] text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 font-bold gap-0.5"
                              disabled={loadingUsageId === pt.idPonto}
                              onClick={() => handleLoadPointUsage(pt.idPonto)}
                              title="Consultar consumo real 30 dias no ISPFY"
                            >
                              {loadingUsageId === pt.idPonto ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <BarChart3 className="w-3 h-3" />
                              )}
                              30D
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-1.5 text-[9px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/20 font-bold gap-0.5"
                              onClick={() => handleActivateQuickTurbo(pt.idPonto)}
                              title="Aplicar Turbo de Velocidade por 7 dias no ISPFY"
                            >
                              <Rocket className="w-3 h-3" />
                              TURBO
                            </Button>
                          </div>
                        </div>

                        {usage && (
                          <div className="text-[10px] text-muted-foreground bg-background/80 px-2 py-1 rounded border border-border/60 flex items-center justify-between">
                            <span>
                              ↓ <strong>{usage.downloadGb.toFixed(1)} GB</strong> • ↑{' '}
                              <strong>{usage.uploadGb.toFixed(1)} GB</strong>
                            </span>
                            <span className="font-mono text-[9px]">30 dias</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    ),

    ispfy_finance: (
      <Card className="bg-card shadow-sm border-border overflow-hidden">
        <CardHeader className="p-3 border-b border-border/60 bg-muted/30 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-[11px] font-bold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider">
            <CreditCard className="w-3.5 h-3.5" />
            Financeiro &amp; PIX
          </CardTitle>
          {currentInvoices.length > 0 && (
            <Badge
              variant={
                currentInvoices.some((item) => item.periodTag === 'overdue')
                  ? 'destructive'
                  : 'secondary'
              }
              className="text-[9px] h-4 px-1.5"
            >
              {currentInvoices.length}{' '}
              {currentInvoices.length === 1 ? 'atual' : 'atuais'}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="p-3 space-y-2">
          {loading ? (
            <div className="py-3 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              Verificando faturas...
            </div>
          ) : !ispfyData ? (
            <p className="text-[11px] text-muted-foreground italic">
              Vincule o assinante no card ISPFY para gerar PIX e boletos.
            </p>
          ) : visibleInvoices.length > 0 ? (
            <>
              {visibleInvoices.map(({ invoice: f, formattedDate, monthYearLabel, periodTag }) => {
                const isOverdue = periodTag === 'overdue';
                const isCurrentMonth = periodTag === 'current_month';
                const boxClass = isOverdue
                  ? 'bg-rose-500/8 border-rose-500/30'
                  : isCurrentMonth
                  ? 'bg-primary/5 border-primary/25'
                  : 'bg-secondary/40 border-border/70';
                const dateTextClass = isOverdue
                  ? 'text-rose-600 dark:text-rose-300'
                  : isCurrentMonth
                  ? 'text-primary'
                  : 'text-foreground';
                const periodLabel = isOverdue
                  ? 'Vencida'
                  : isCurrentMonth
                  ? 'Mês atual'
                  : periodTag === 'next_month'
                  ? 'Próx. mês'
                  : monthYearLabel;
                const badgeClass = isOverdue
                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                  : isCurrentMonth
                  ? 'bg-primary/15 text-primary border-primary/30'
                  : 'bg-muted text-muted-foreground border-border/70';

                return (
                  <div
                    key={f.id}
                    className={`p-2 rounded-lg border space-y-2 ${boxClass}`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Clock className={`w-3 h-3 shrink-0 ${isOverdue ? 'text-rose-500' : isCurrentMonth ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className={`text-[10px] font-semibold truncate ${dateTextClass}`}>
                          {formattedDate}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border shrink-0 ${badgeClass}`}
                        >
                          {periodLabel}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold shrink-0 tabular-nums ${dateTextClass}`}>
                        R$ {f.valor}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1 text-[9px] bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 font-bold gap-0.5"
                        onClick={() => handleSendPix(f, true)}
                        title="Enviar Botão Copiar PIX via Z-API"
                      >
                        <Zap className="w-3 h-3" />
                        BT PIX
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1 text-[9px] bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 font-bold gap-0.5"
                        onClick={() => handleSendPix(f, false)}
                        title="Enviar PIX Copia e Cola em texto"
                      >
                        <CreditCard className="w-3 h-3" />
                        TEXTO
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1 text-[9px] bg-blue-500/15 hover:bg-blue-500/25 text-blue-700 dark:text-blue-300 font-bold gap-0.5"
                        onClick={() => handleSendBoletoPdf(f)}
                        title="Enviar PDF ou link do boleto"
                      >
                        <FileDown className="w-3 h-3" />
                        PDF
                      </Button>
                    </div>
                  </div>
                );
              })}

              {futureInvoices.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowFutureInvoices((prev) => !prev)}
                  className="w-full py-1.5 px-2 rounded-lg text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/60 border border-dashed border-border/70 transition-colors"
                >
                  {showFutureInvoices
                    ? 'Ocultar parcelas futuras'
                    : `Ver +${futureInvoices.length} parcela${futureInvoices.length === 1 ? '' : 's'} futura${futureInvoices.length === 1 ? '' : 's'}`}
                </button>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 p-2 bg-emerald-500/10 rounded-lg text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              <CheckCircle2 className="w-3 h-3" />
              <span className="text-[10px] font-bold">Financeiro em dia</span>
            </div>
          )}
        </CardContent>
      </Card>
    ),

    attendant: attendantSlot ?? null,
    quick_replies: quickRepliesSlot ?? null,
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Barra superior do Painel 360° com botão Organizar (arrastar e soltar) */}
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
          {isEditingLayout ? 'Arraste para organizar' : 'Painel 360°'}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {isEditingLayout ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  resetLayout();
                  toast.success('Ordem padrão do painel restaurada!');
                }}
                className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                title="Restaurar ordem padrão dos blocos"
              >
                <RotateCcw className="w-3 h-3" />
                Padrão
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setIsEditingLayout(false)}
                className="h-6 px-2.5 text-[10px] gap-1 font-bold"
              >
                <Check className="w-3 h-3" />
                Concluir
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setIsEditingLayout(true)}
              className="h-6 px-2 text-[10px] gap-1 border-border/80 text-muted-foreground hover:text-foreground"
              title="Reorganizar ou ocultar blocos arrastando e soltando"
            >
              <SlidersHorizontal className="w-3 h-3" />
              Organizar
            </Button>
          )}
          {onCloseMobile && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="xl:hidden h-6 w-6 rounded-md"
              onClick={onCloseMobile}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {isEditingLayout && (
        <p className="text-[11px] text-muted-foreground bg-primary/5 border border-primary/20 rounded-xl px-3 py-2 leading-snug">
          Arraste os blocos para definir sua ordem preferida ou toque no ícone do olho para ocultar o que não usa. Sua organização é salva automaticamente.
        </p>
      )}

      <Reorder.Group
        axis="y"
        values={sidebarOrder}
        onReorder={setSidebarOrder}
        className="flex flex-col gap-3 m-0 p-0"
      >
        {sidebarOrder.map((widgetId, idx) => (
          <SortableSidebarCard
            key={widgetId}
            id={widgetId}
            index={idx}
            totalCount={sidebarOrder.length}
            isEditing={isEditingLayout}
            isHidden={hiddenSet.has(widgetId)}
            onMove={moveWidget}
            onToggleHidden={toggleWidgetVisibility}
          >
            {widgetNodes[widgetId]}
          </SortableSidebarCard>
        ))}
      </Reorder.Group>
    </div>
  );
}

const ClientInfoCard = React.memo(ClientInfoCardInner);
export default ClientInfoCard;

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Search,
  Bell,
  Bug,
  Phone,
  X,
  MessageSquare,
  Bot,
  Zap,
  Loader2,
  ArrowLeft,
  PanelRight,
  PanelRightClose,
  Plus,
  Download,
  ExternalLink,
  UploadCloud,
  ChevronUp,
  ChevronDown,
  ArrowDown,
  MailWarning,
  ClipboardList,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PredefinedMessages from '@/components/PredefinedMessages';
import AttendantCard from '@/components/AttendantCard';
import ClientInfoCard from '@/components/ClientInfoCard';
import PageTransition from '@/components/PageTransition';
import NotificationSettings from '@/components/NotificationSettings';
import DebugPanel from '@/components/DebugPanel';
import { ChatConversationItem } from '@/components/chat/ChatConversationItem';
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble';
import { ChatComposer, type ChatComposerHandle } from '@/components/chat/ChatComposer';
import { getOntStatusMeta } from '@/utils/smartOltUi';
import type { StagedMediaFile } from '@/components/chat/ChatMediaStagingBar';
import { useToast } from '@/hooks/use-toast';
import { useNotifications } from '@/hooks/use-notifications';
import type { Message, Client, ChatMediaPayload, ReplyToSnapshot } from '@/types/dashboard';
import type { SmartOltOnu } from '@/types/smartOlt';
import { db, storage } from '@/config/firebase';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  addDoc,
  getDoc,
  getDocs,
  doc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { isSameDay } from 'date-fns';
import { aiService } from '@/services/ai/aiService';
import { whapiService } from '@/services/whapi/whapiService';
import { ispfyService } from '@/services/ispfy/ispfyService';
import { useActiveChatClient } from '@/contexts/ActiveChatClientContext';
import { useAuth } from '@/contexts/AuthContext';
import { obterNomeClienteISPFY } from '@/utils/ispfyFormatters';
import { compressImage } from '@/utils/compressImage';

const MAX_IMAGE_AUDIO_BYTES = 16 * 1024 * 1024; // 16MB
const MAX_VIDEO_DOC_BYTES = 64 * 1024 * 1024; // 64MB

function detectMediaTypeFromFile(
  file: File
): 'image' | 'video' | 'audio' | 'document' {
  const mime = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  if (mime.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp)$/i.test(name)) {
    return 'image';
  }
  if (mime.startsWith('video/') || /\.(mp4|mov|mkv|webm|avi|3gp)$/i.test(name)) {
    return 'video';
  }
  if (mime.startsWith('audio/') || /\.(mp3|ogg|opus|wav|m4a|aac)$/i.test(name)) {
    return 'audio';
  }
  return 'document';
}

function formatLastMessageLabel(text: string, media?: ChatMediaPayload, isPrivate?: boolean): string {
  const cleanText = text.trim();
  if (isPrivate) return `📝 Nota: ${cleanText || media?.name || 'Anexo'}`;
  if (cleanText) return cleanText;
  if (!media) return '';
  if (media.type === 'image') return '📎 Foto';
  if (media.type === 'video') return '🎥 Vídeo';
  if (media.type === 'audio') return '🎵 Áudio';
  return `📄 ${media.name || 'Documento'}`;
}

function isAvatarImageUrl(avatar?: string): boolean {
  return Boolean(avatar && /^https?:\/\//i.test(avatar.trim()));
}

export default function Chat() {
  const navigate = useNavigate();
  const { canAccessRoute } = useAuth();
  const {
    activeIspfyClient,
    resolvingIspfy,
    setActiveChat,
    reportActiveChatIspfyClient,
    getCachedIspfyClient,
    clearActiveChat,
  } = useActiveChatClient();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientLimit, setClientLimit] = useState(40);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedOnt, setSelectedOnt] = useState<SmartOltOnu | null>(null);
  const handleOntResolved = useCallback((onu: SmartOltOnu | null) => {
    setSelectedOnt(onu);
  }, []);
  useEffect(() => {
    setSelectedOnt(null);
  }, [selectedClient?.id]);
  const [loading, setLoading] = useState(true);
  const [clientMessages, setClientMessages] = useState<Record<string, Message[]>>({});
  const [messageLimit, setMessageLimit] = useState(30);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  // Staging & upload de mídia (Foto, Vídeo, Áudio, Documento)
  const [stagedMedia, setStagedMedia] = useState<StagedMediaFile | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Nova conversa WhatsApp
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState('');
  const [newChatName, setNewChatName] = useState('');

  // Estados de atendimento / UI
  const [replyingTo, setReplyingTo] = useState<ReplyToSnapshot | null>(null);
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [chatFilter, setChatFilter] = useState<
    'all' | 'unread' | 'ai' | 'urgente' | 'suporte' | 'financeiro'
  >('all');
  const [suggestingAi, setSuggestingAi] = useState(false);
  const [showClientInfo, setShowClientInfo] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1280 : true
  );

  // Sincroniza o cliente selecionado no Chat com o contexto global (FAB de O.S., Sidebar e botão O.S.)
  useEffect(() => {
    if (!selectedClient) {
      setActiveChat(null);
      return;
    }
    setActiveChat({
      chatId: selectedClient.id,
      chatName: selectedClient.name,
      chatPhone: selectedClient.phone,
    });
  }, [selectedClient, setActiveChat]);

  useEffect(() => {
    return () => {
      clearActiveChat();
    };
  }, [clearActiveChat]);

  // Fallback de resolução do cliente ISPFY quando a ficha lateral (ClientInfoCard) está oculta
  useEffect(() => {
    if (!selectedClient || showClientInfo) return;
    const chatId = selectedClient.id;
    const cached = getCachedIspfyClient(chatId);
    if (cached) {
      reportActiveChatIspfyClient(chatId, cached, false);
      return;
    }

    let cancelled = false;
    reportActiveChatIspfyClient(chatId, null, true);

    const resolveInBackground = async () => {
      try {
        let client = null;
        const snap = await getDoc(doc(db, 'chat', chatId)).catch(() => null);
        const savedId = snap?.exists()
          ? String(snap.data()?.ispfy_id || snap.data()?.ixc_id || '').trim()
          : '';
        if (savedId) {
          client = await ispfyService.getClienteById(savedId).catch(() => null);
        }
        if (!client) {
          const phone = selectedClient.phone || chatId;
          if (phone) {
            client = await ispfyService.getClienteByPhone(phone).catch(() => null);
          }
        }
        if (!cancelled) {
          reportActiveChatIspfyClient(chatId, client, false);
        }
      } catch {
        if (!cancelled) {
          reportActiveChatIspfyClient(chatId, null, false);
        }
      }
    };

    void resolveInBackground();
    return () => {
      cancelled = true;
    };
  }, [selectedClient, showClientInfo, getCachedIspfyClient, reportActiveChatIspfyClient]);

  const handleOpenSelectedClientOS = useCallback(async () => {
    if (!selectedClient) return;
    if (activeIspfyClient?.id) {
      navigate(`/ispfy/nova-os?clienteId=${activeIspfyClient.id}`, {
        state: { preselectedClient: activeIspfyClient },
      });
      return;
    }

    const chatId = selectedClient.id;
    const cached = getCachedIspfyClient(chatId);
    if (cached?.id) {
      navigate(`/ispfy/nova-os?clienteId=${cached.id}`, {
        state: { preselectedClient: cached },
      });
      return;
    }

    // Se o usuário clicou em O.S. antes da ficha lateral terminar de carregar, resolve rapidamente
    try {
      let resolved = null;
      const snap = await getDoc(doc(db, 'chat', chatId)).catch(() => null);
      const savedId = snap?.exists()
        ? String(snap.data()?.ispfy_id || snap.data()?.ixc_id || '').trim()
        : '';
      if (savedId) {
        resolved = await ispfyService.getClienteById(savedId).catch(() => null);
      }
      if (!resolved) {
        const phone = selectedClient.phone || chatId;
        if (phone) {
          resolved = await ispfyService.getClienteByPhone(phone).catch(() => null);
        }
      }
      if (resolved?.id) {
        reportActiveChatIspfyClient(chatId, resolved, false);
        navigate(`/ispfy/nova-os?clienteId=${resolved.id}`, {
          state: { preselectedClient: resolved },
        });
        return;
      }
    } catch {
      // fallback para busca pré-preenchida
    }

    const fallbackQuery = (selectedClient.phone || selectedClient.name || '').trim();
    navigate(
      fallbackQuery
        ? `/ispfy/nova-os?busca=${encodeURIComponent(fallbackQuery)}`
        : '/ispfy/nova-os'
    );
  }, [selectedClient, activeIspfyClient, getCachedIspfyClient, reportActiveChatIspfyClient, navigate]);
  const [globalAiEnabled, setGlobalAiEnabled] = useState(() => {
    return localStorage.getItem('globalAiEnabled') === 'true';
  });

  const { toast } = useToast();
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<ChatComposerHandle>(null);
  const hasAutoSelectedRef = useRef(false);
  const fetchedAvatarsRef = useRef<Set<string>>(new Set());
  const previousClientsRef = useRef<Client[]>([]);
  const processedMessageIdsRef = useRef<Set<string>>(new Set());
  const lastMarkedReadRef = useRef<Record<string, string>>({});
  const manualUnreadRef = useRef<Set<string>>(new Set());
  const lastScrolledClientRef = useRef<string | null>(null);

  // Refs sincronizadas para manter callbacks 100% estáveis (evita re-renderizar bolhas e ClientInfoCard)
  const selectedClientRef = useRef<Client | null>(selectedClient);
  selectedClientRef.current = selectedClient;
  const stagedMediaRef = useRef<StagedMediaFile | null>(stagedMedia);
  stagedMediaRef.current = stagedMedia;
  const replyingToRef = useRef<ReplyToSnapshot | null>(replyingTo);
  replyingToRef.current = replyingTo;
  const clientMessagesRef = useRef<Record<string, Message[]>>(clientMessages);
  clientMessagesRef.current = clientMessages;

  const {
    isSupported,
    permission,
    isEnabled,
    isPageVisible,
    requestPermission,
    toggleNotifications,
    testNotification,
  } = useNotifications();

  useEffect(() => {
    localStorage.setItem('globalAiEnabled', globalAiEnabled.toString());
  }, [globalAiEnabled]);

  // Limpa URL de preview ao desmontar ou trocar arquivo
  useEffect(() => {
    return () => {
      if (stagedMedia?.previewUrl) {
        URL.revokeObjectURL(stagedMedia.previewUrl);
      }
    };
  }, [stagedMedia]);

  // 1. Listener da lista de conversas (paginado para economia de leituras no Firestore)
  useEffect(() => {
    setLoading(true);
    const chatRef = collection(db, 'chat');
    const q = query(chatRef, orderBy('lastMessageTime', 'desc'), limit(clientLimit));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const clientsData: Client[] = snapshot.docs
          .filter((docSnap) => docSnap.id.length <= 15)
          .map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              name: String(data.name || 'Cliente sem nome'),
              avatar: String(data.avatar || data.name?.charAt(0) || 'C'),
              lastMessage: String(data.lastMessage || 'Nenhuma mensagem'),
              lastMessageTime: data.lastMessageTime?.toDate?.() || new Date(),
              unreadCount: Number(data.unreadCount || 0),
              isOnline: Boolean(data.isOnline),
              phone: data.phone ? String(data.phone) : docSnap.id,
              source: data.source || 'whatsapp',
              tags: Array.isArray(data.tags) ? data.tags : [],
              aiEnabled: Boolean(data.aiEnabled),
              protocol: data.protocol || undefined,
            };
          })
          .sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());

        setClients(clientsData);
        setLoading(false);

        if (clientsData.length > 0 && !hasAutoSelectedRef.current) {
          hasAutoSelectedRef.current = true;
          if (typeof window === 'undefined' || window.innerWidth >= 1024) {
            setSelectedClient(clientsData[0]);
          }
        }
      },
      () => {
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [clientLimit]);

  // Sincroniza metadados do selectedClient (aiEnabled, unreadCount, avatar, protocol, tags)
  useEffect(() => {
    if (!selectedClient || clients.length === 0) return;
    const updated = clients.find((c) => c.id === selectedClient.id);
    if (
      updated &&
      (updated.aiEnabled !== selectedClient.aiEnabled ||
        updated.unreadCount !== selectedClient.unreadCount ||
        updated.avatar !== selectedClient.avatar ||
        updated.protocol !== selectedClient.protocol ||
        updated.name !== selectedClient.name)
    ) {
      setSelectedClient(updated);
    }
  }, [clients, selectedClient]);

  // Sincroniza foto de perfil do WhatsApp (Z-API) uma vez por sessão quando ausente
  useEffect(() => {
    if (!selectedClient) return;
    if (isAvatarImageUrl(selectedClient.avatar)) return;
    if (fetchedAvatarsRef.current.has(selectedClient.id)) return;
    fetchedAvatarsRef.current.add(selectedClient.id);

    const targetPhone = selectedClient.phone || selectedClient.id;
    whapiService
      .getContactProfilePicture(targetPhone)
      .then((picUrl) => {
        if (picUrl && /^https?:\/\//i.test(picUrl)) {
          setDoc(doc(db, 'chat', selectedClient.id), { avatar: picUrl }, { merge: true }).catch(
            () => undefined
          );
        }
      })
      .catch(() => undefined);
  }, [selectedClient]);

  // 2. Listener de mensagens da conversa ativa
  const selectedClientId = selectedClient?.id ?? null;

  useEffect(() => {
    if (unsubscribeRef.current) unsubscribeRef.current();
    if (!selectedClientId) return;

    const mensagensRef = collection(db, 'chat', selectedClientId, 'mensagens');
    const q = query(mensagensRef, orderBy('timestamp', 'desc'), limit(messageLimit));

    unsubscribeRef.current = onSnapshot(q, (snapshot) => {
      const messages: Message[] = [...snapshot.docs].reverse().map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          user: String(data.user || 'Cliente'),
          content: String(data.content || ''),
          text: String(data.content || ''),
          timestamp: data.timestamp?.toDate?.() || new Date(),
          isAdmin: Boolean(data.isAdmin),
          fromMe: Boolean(data.isAdmin),
          mediaType: data.mediaType || undefined,
          mediaUrl: data.mediaUrl || undefined,
          mediaName: data.mediaName || undefined,
          mediaMimeType: data.mediaMimeType || undefined,
          mediaSize: typeof data.mediaSize === 'number' ? data.mediaSize : undefined,
          mediaDuration:
            typeof data.mediaDuration === 'number' ? data.mediaDuration : undefined,
          source: data.source || undefined,
          isPrivate: Boolean(data.isPrivate),
          zapiMessageId: data.zapiMessageId || null,
          deliveryStatus: data.deliveryStatus || undefined,
          deliveryError: data.deliveryError || null,
          reaction: data.reaction || null,
          edited: Boolean(data.edited),
          editedAt: data.editedAt?.toDate?.() || null,
          deletedForEveryone: Boolean(data.deletedForEveryone),
          replyTo: data.replyTo || null,
        };
      });

      setClientMessages((prev) => ({
        ...prev,
        [selectedClientId]: messages,
      }));
    });

    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, [selectedClientId, messageLimit]);

  // 3. Processamento da IA Global em background
  useEffect(() => {
    const triggerAiForClient = async (client: Client) => {
      try {
        const mensagensRef = collection(db, 'chat', client.id, 'mensagens');
        const q = query(mensagensRef, orderBy('timestamp', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        const messages: Message[] = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              user: String(data.user || 'Cliente'),
              content: String(data.content || ''),
              timestamp: data.timestamp?.toDate?.() || new Date(),
              isAdmin: Boolean(data.isAdmin),
              source: data.source,
            };
          })
          .reverse();

        const response = await aiService.generateResponse(messages, client.name);
        if (!response?.trim()) return;

        await addDoc(collection(db, 'chat', client.id, 'mensagens'), {
          user: 'Josué (IA)',
          content: response,
          timestamp: new Date(),
          isAdmin: true,
          source: 'app',
          isPrivate: false,
          deliveryStatus: 'SENDING',
        });
        await setDoc(
          doc(db, 'chat', client.id),
          {
            lastMessage: response,
            lastMessageTime: new Date(),
            unreadCount: 0,
          },
          { merge: true }
        );
      } catch (e) {
        console.error('Erro na IA background:', e);
      }
    };

    clients.forEach((client) => {
      const prevClient = previousClientsRef.current.find((c) => c.id === client.id);
      if (
        prevClient &&
        client.lastMessageTime > prevClient.lastMessageTime &&
        client.unreadCount > 0
      ) {
        const messageIdentifier = `${client.id}_${client.lastMessageTime.getTime()}`;
        if (!processedMessageIdsRef.current.has(messageIdentifier)) {
          processedMessageIdsRef.current.add(messageIdentifier);
          if (globalAiEnabled || client.aiEnabled) {
            triggerAiForClient(client);
          }
        }
      }
    });

    previousClientsRef.current = clients;
  }, [clients, globalAiEnabled]);

  // Upload de arquivo para o Firebase Storage com progresso real
  const uploadFileToStorage = useCallback(
    async (
      clientId: string,
      file: File,
      onProgress?: (pct: number) => void
    ): Promise<string> => {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
      const storageRef = ref(storage, `chat/${clientId}/${Date.now()}_${safeName}`);
      const task = uploadBytesResumable(storageRef, file, {
        contentType: file.type || 'application/octet-stream',
        cacheControl: 'public, max-age=604800',
      });

      return new Promise<string>((resolve, reject) => {
        task.on(
          'state_changed',
          (snap) => {
            if (snap.totalBytes > 0 && onProgress) {
              onProgress((snap.bytesTransferred / snap.totalBytes) * 100);
            }
          },
          (err) => reject(err),
          async () => {
            try {
              const url = await getDownloadURL(task.snapshot.ref);
              resolve(url);
            } catch (urlErr) {
              reject(urlErr);
            }
          }
        );
      });
    },
    []
  );

  // Envio unificado de Texto + Foto + Vídeo + Áudio + Documento (estável via refs)
  const sendMessageCore = useCallback(
    async (
      text: string,
      options?: { isPrivate?: boolean; mediaOverride?: ChatMediaPayload; targetClientId?: string }
    ): Promise<boolean> => {
      const targetId = options?.targetClientId || selectedClientRef.current?.id;
      if (!targetId) return false;

      const captionText = text.trim();
      const isPrivate = Boolean(options?.isPrivate);

      let finalMedia = options?.mediaOverride;
      const currentStaged = stagedMediaRef.current;
      if (!finalMedia && currentStaged) {
        setUploadingMedia(true);
        setUploadProgress(5);
        try {
          const url = await uploadFileToStorage(targetId, currentStaged.file, (pct) =>
            setUploadProgress(pct)
          );
          finalMedia = {
            type: currentStaged.type,
            url,
            name: currentStaged.file.name,
            mimeType: currentStaged.file.type || undefined,
            size: currentStaged.file.size,
          };
          setStagedMedia(null);
        } catch {
          toast({
            title: 'Erro no upload do arquivo',
            description: 'Não foi possível subir o anexo para envio no WhatsApp.',
            variant: 'destructive',
          });
          setUploadingMedia(false);
          setUploadProgress(0);
          return false;
        } finally {
          setUploadingMedia(false);
          setUploadProgress(0);
        }
      }

      if (!captionText && !finalMedia) return false;

      const lastLabel = formatLastMessageLabel(captionText, finalMedia, isPrivate);
      const contentToSave =
        captionText ||
        (finalMedia?.type === 'image'
          ? '📎 Foto'
          : finalMedia?.type === 'video'
            ? '🎥 Vídeo'
            : finalMedia?.type === 'audio'
              ? '🎵 Áudio'
              : finalMedia?.type === 'document'
                ? `📄 ${finalMedia.name || 'Documento'}`
                : '');

      try {
        const messageDoc: Record<string, unknown> = {
          user: 'Admin',
          content: contentToSave,
          timestamp: new Date(),
          isAdmin: true,
          source: 'app',
          isPrivate,
          ...(isPrivate ? {} : { deliveryStatus: 'SENDING' }),
        };

        if (finalMedia) {
          messageDoc.mediaType = finalMedia.type;
          messageDoc.mediaUrl = finalMedia.url;
          if (finalMedia.name) messageDoc.mediaName = finalMedia.name;
          if (finalMedia.mimeType) messageDoc.mediaMimeType = finalMedia.mimeType;
          if (finalMedia.size) messageDoc.mediaSize = finalMedia.size;
          if (finalMedia.duration) messageDoc.mediaDuration = finalMedia.duration;
        }

        const currentReply = replyingToRef.current;
        if (currentReply && !isPrivate) {
          messageDoc.replyTo = currentReply;
        }

        await addDoc(collection(db, 'chat', targetId, 'mensagens'), messageDoc);
        await setDoc(
          doc(db, 'chat', targetId),
          {
            lastMessage: lastLabel,
            lastMessageTime: new Date(),
            unreadCount: 0,
          },
          { merge: true }
        );

        setReplyingTo(null);
        return true;
      } catch {
        toast({ title: 'Erro ao enviar mensagem', variant: 'destructive' });
        return false;
      }
    },
    [uploadFileToStorage, toast]
  );

  // Wrapper compatível com ClientInfoCard e AttendantCard (100% estável)
  const handleSendMessage = useCallback(
    async (textOverride?: string, mediaOverride?: ChatMediaPayload) => {
      await sendMessageCore(textOverride ?? '', { isPrivate: false, mediaOverride });
    },
    [sendMessageCore]
  );

  const handleUploadRecordedAudio = useCallback(
    async (targetClientId: string, file: File, durationSec: number, mimeType: string) => {
      setUploadingMedia(true);
      setUploadProgress(10);
      try {
        const url = await uploadFileToStorage(targetClientId, file, (pct) =>
          setUploadProgress(pct)
        );
        await sendMessageCore('', {
          targetClientId,
          isPrivate: false,
          mediaOverride: {
            type: 'audio',
            url,
            name: file.name,
            mimeType,
            size: file.size,
            duration: durationSec,
          },
        });
      } catch {
        toast({
          title: 'Erro ao enviar áudio',
          description: 'Não foi possível subir o áudio gravado.',
          variant: 'destructive',
        });
      } finally {
        setUploadingMedia(false);
        setUploadProgress(0);
      }
    },
    [uploadFileToStorage, sendMessageCore, toast]
  );

  // Preparar arquivo selecionado/arrastado/colado (com compressão automática de fotos)
  const stageFileForSend = useCallback(
    async (file: File, forcedType?: 'image' | 'video' | 'audio' | 'document') => {
      if (!selectedClientRef.current) {
        toast({
          title: 'Selecione uma conversa primeiro',
          variant: 'destructive',
        });
        return;
      }

      const type = forcedType || detectMediaTypeFromFile(file);
      const maxSize =
        type === 'image' || type === 'audio'
          ? MAX_IMAGE_AUDIO_BYTES
          : MAX_VIDEO_DOC_BYTES;

      if (file.size > maxSize) {
        const limitMb = Math.round(maxSize / (1024 * 1024));
        toast({
          title: 'Arquivo excede o limite do WhatsApp',
          description: `Tamanho máximo para ${type === 'video' ? 'vídeos' : type === 'document' ? 'documentos' : 'este formato'
            }: ${limitMb} MB.`,
          variant: 'destructive',
        });
        return;
      }

      let readyFile = file;
      if (
        type === 'image' &&
        file.size > 160 * 1024 &&
        file.type !== 'image/gif'
      ) {
        try {
          const compressed = await compressImage(file, {
            maxWidth: 1280,
            maxHeight: 1280,
            quality: 0.78,
            mimeType: 'image/jpeg',
          });
          if (compressed.compressedSize < file.size) {
            readyFile = compressed.file;
          }
        } catch {
          // Mantém arquivo original caso o navegador não consiga decodificar no Canvas
        }
      }

      const previewUrl = URL.createObjectURL(readyFile);
      setStagedMedia({ file: readyFile, type, previewUrl });
      setTimeout(() => composerRef.current?.focus(), 60);
    },
    [toast]
  );

  // Drag & Drop de arquivos na área de conversa
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (selectedClient && !isDraggingFile) {
      setIsDraggingFile(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDraggingFile(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingFile(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void stageFileForSend(file);
  };

  const handleMicError = useCallback(() => {
    toast({
      title: 'Permissão de microfone negada',
      description: 'Autorize o microfone no navegador para gravar áudios.',
      variant: 'destructive',
    });
  }, [toast]);

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  const handleRemoveStagedMedia = useCallback(() => {
    setStagedMedia(null);
  }, []);

  const handleSelectPredefinedMessage = useCallback((msg: string) => {
    composerRef.current?.setDraft(msg);
  }, []);

  const handleClientSelect = useCallback((client: Client) => {
    manualUnreadRef.current.delete(client.id);
    setSelectedClient(client);
    setMessageLimit(30);
    setStagedMedia(null);
    setReplyingTo(null);
    setShowMessageSearch(false);
    setMessageSearchQuery('');
    setShowScrollBottom(false);
    if (client.unreadCount > 0) {
      setDoc(doc(db, 'chat', client.id), { unreadCount: 0 }, { merge: true }).catch(
        () => undefined
      );
    }
  }, []);

  const handleMarkChatUnread = async () => {
    if (!selectedClient) return;
    const chatId = selectedClient.id;
    const phone = selectedClient.phone || chatId;
    manualUnreadRef.current.add(chatId);
    delete lastMarkedReadRef.current[chatId];
    await setDoc(doc(db, 'chat', chatId), { unreadCount: 1 }, { merge: true }).catch(
      () => undefined
    );
    whapiService.markChatAsUnread(phone).catch(() => undefined);
    toast({
      title: 'Marcada como não lida',
      description: 'Conversa sinalizada como não lida no painel e no WhatsApp.',
    });
  };

  const handleRetryMessage = useCallback(
    async (msg: Message) => {
      if (!selectedClientRef.current) return;
      await sendMessageCore(msg.content, {
        isPrivate: Boolean(msg.isPrivate),
        mediaOverride:
          msg.mediaUrl && msg.mediaType
            ? {
              type: msg.mediaType,
              url: msg.mediaUrl,
              name: msg.mediaName,
              mimeType: msg.mediaMimeType,
              size: msg.mediaSize,
              duration: msg.mediaDuration,
            }
            : undefined,
      });
    },
    [sendMessageCore]
  );

  const handleReactMessage = useCallback(
    async (msg: Message, emoji: string) => {
      const current = selectedClientRef.current;
      if (!current || !msg.zapiMessageId) return;
      const phone = current.phone || current.id;
      const res = await whapiService.sendReaction(phone, msg.zapiMessageId, emoji);
      if (res.sent) {
        updateDoc(doc(db, 'chat', current.id, 'mensagens', msg.id), {
          reaction: emoji,
        }).catch(() => undefined);
      } else {
        toast({
          title: 'Não foi possível reagir',
          description: res.error || 'Tente novamente em instantes.',
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  const handleEditMessage = useCallback(
    async (msg: Message, newText: string): Promise<boolean> => {
      const current = selectedClientRef.current;
      if (!current) return false;
      const trimmed = newText.trim();
      if (!trimmed) return false;

      if (!msg.isPrivate) {
        if (!msg.zapiMessageId) {
          toast({
            title: 'Edição indisponível',
            description: 'Esta mensagem não possui ID da Z-API para edição no WhatsApp.',
            variant: 'destructive',
          });
          return false;
        }
        const phone = current.phone || current.id;
        const res = await whapiService.editMessage(phone, msg.zapiMessageId, trimmed);
        if (!res.sent) {
          toast({
            title: 'Não foi possível editar no WhatsApp',
            description:
              res.error || 'O WhatsApp permite editar apenas até 15 minutos após o envio.',
            variant: 'destructive',
          });
          return false;
        }
      }

      try {
        await updateDoc(doc(db, 'chat', current.id, 'mensagens', msg.id), {
          content: trimmed,
          edited: true,
          editedAt: new Date(),
        });

        const msgs = clientMessagesRef.current[current.id] || [];
        if (msgs.length > 0 && msgs[msgs.length - 1].id === msg.id) {
          await setDoc(
            doc(db, 'chat', current.id),
            { lastMessage: msg.isPrivate ? `📝 Nota: ${trimmed}` : trimmed },
            { merge: true }
          ).catch(() => undefined);
        }

        toast({
          title: msg.isPrivate ? 'Nota editada' : 'Mensagem editada no WhatsApp',
        });
        return true;
      } catch {
        toast({ title: 'Erro ao salvar edição', variant: 'destructive' });
        return false;
      }
    },
    [toast]
  );

  const handleDeleteForEveryone = useCallback(
    async (msg: Message): Promise<boolean> => {
      const current = selectedClientRef.current;
      if (!current) return false;

      if (!msg.isPrivate) {
        if (!msg.zapiMessageId) {
          toast({
            title: 'Exclusão indisponível no WhatsApp',
            description: 'Esta mensagem não possui ID da Z-API para apagar para todos.',
            variant: 'destructive',
          });
          return false;
        }
        const phone = current.phone || current.id;
        const res = await whapiService.deleteMessage(phone, msg.zapiMessageId, {
          owner: true,
          deleteForMe: false,
        });
        if (!res.sent) {
          toast({
            title: 'Não foi possível apagar para todos',
            description: res.error || 'Verifique a conexão Z-API ou o prazo do WhatsApp.',
            variant: 'destructive',
          });
          return false;
        }
      }

      try {
        await updateDoc(doc(db, 'chat', current.id, 'mensagens', msg.id), {
          deletedForEveryone: true,
          content: '🚫 Você apagou esta mensagem',
          mediaUrl: null,
          mediaType: null,
          mediaName: null,
          deletedAt: new Date(),
        });

        const msgs = clientMessagesRef.current[current.id] || [];
        if (msgs.length > 0 && msgs[msgs.length - 1].id === msg.id) {
          await setDoc(
            doc(db, 'chat', current.id),
            { lastMessage: '🚫 Mensagem apagada' },
            { merge: true }
          ).catch(() => undefined);
        }

        toast({
          title: msg.isPrivate ? 'Nota apagada' : 'Mensagem apagada para todos no WhatsApp',
        });
        return true;
      } catch {
        toast({ title: 'Erro ao atualizar exclusão', variant: 'destructive' });
        return false;
      }
    },
    [toast]
  );

  const handleReplyMessage = useCallback((msg: Message) => {
    const snippet =
      msg.content?.trim() ||
      (msg.mediaType === 'image'
        ? '📎 Foto'
        : msg.mediaType === 'video'
          ? '🎥 Vídeo'
          : msg.mediaType === 'audio'
            ? '🎵 Áudio'
            : msg.mediaType === 'document'
              ? `📄 ${msg.mediaName || 'Documento'}`
              : '');
    setReplyingTo({
      id: msg.id,
      zapiMessageId: msg.zapiMessageId || null,
      user: msg.fromMe ? 'Você' : selectedClientRef.current?.name || msg.user,
      content: snippet.slice(0, 140),
      mediaType: msg.mediaType,
    });
    composerRef.current?.exitPrivateMode();
    setTimeout(() => composerRef.current?.focus(), 40);
  }, []);

  const scrollToMessage = useCallback((messageId: string) => {
    const el = messagesScrollRef.current?.querySelector<HTMLElement>(
      `[data-msg-id="${messageId}"]`
    );
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMsgId(messageId);
    window.setTimeout(() => {
      setHighlightedMsgId((prev) => (prev === messageId ? null : prev));
    }, 1800);
  }, []);

  const handleMessagesScroll = useCallback(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    const shouldShow = el.scrollHeight - el.scrollTop - el.clientHeight > 220;
    setShowScrollBottom((prev) => (prev === shouldShow ? prev : shouldShow));
  }, []);

  const handleStartNewConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = newChatPhone.replace(/\D/g, '');
    if (digits.length < 10) {
      toast({
        title: 'Número inválido',
        description: 'Informe DDD + número (ex.: 21999999999).',
        variant: 'destructive',
      });
      return;
    }
    const cleanPhone = digits.startsWith('55') ? digits : `55${digits}`;
    const localDigits = cleanPhone.startsWith('55') && cleanPhone.length >= 12 ? cleanPhone.slice(2) : cleanPhone;
    const phoneKeyVariants = new Set<string>([cleanPhone, localDigits]);
    if (localDigits.length === 11 && localDigits[2] === '9') {
      const noNine = `${localDigits.slice(0, 2)}${localDigits.slice(3)}`;
      phoneKeyVariants.add(noNine);
      phoneKeyVariants.add(`55${noNine}`);
    } else if (localDigits.length === 10) {
      const withNine = `${localDigits.slice(0, 2)}9${localDigits.slice(2)}`;
      phoneKeyVariants.add(withNine);
      phoneKeyVariants.add(`55${withNine}`);
    }

    // Reutiliza conversa existente se já houver um chat com variação de 9º dígito ou DDI
    const existingClient = clients.find((c) => {
      const idDigits = c.id.replace(/\D/g, '');
      const phDigits = String(c.phone || '').replace(/\D/g, '');
      return phoneKeyVariants.has(idDigits) || phoneKeyVariants.has(phDigits);
    });
    if (existingClient) {
      handleClientSelect(existingClient);
      setShowNewChatModal(false);
      setNewChatPhone('');
      setNewChatName('');
      return;
    }

    const displayName = newChatName.trim() || cleanPhone;

    try {
      await setDoc(
        doc(db, 'chat', cleanPhone),
        {
          name: displayName,
          phone: cleanPhone,
          source: 'whatsapp',
          lastMessage: 'Nova conversa iniciada',
          lastMessageTime: new Date(),
          unreadCount: 0,
        },
        { merge: true }
      );
      const newClient: Client = {
        id: cleanPhone,
        name: displayName,
        avatar: displayName.charAt(0).toUpperCase(),
        lastMessage: 'Nova conversa iniciada',
        lastMessageTime: new Date(),
        unreadCount: 0,
        isOnline: false,
        phone: cleanPhone,
        source: 'whatsapp',
      };
      setSelectedClient(newClient);
      setShowNewChatModal(false);
      setNewChatPhone('');
      setNewChatName('');
    } catch {
      toast({ title: 'Erro ao iniciar conversa', variant: 'destructive' });
    }
  };

  const handleGenerateProtocol = async () => {
    if (!selectedClient) return;
    const now = new Date();
    const newProtocol = `${now.getFullYear()}${(now.getMonth() + 1)
      .toString()
      .padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}${Math.floor(
        1000 + Math.random() * 9000
      )}`;

    try {
      await setDoc(
        doc(db, 'chat', selectedClient.id),
        { protocol: newProtocol },
        { merge: true }
      );
      const msg = `🎫 *Protocolo de Atendimento:* ${newProtocol}\nGuarde este número para sua segurança.`;
      await handleSendMessage(msg);
      toast({ title: 'Protocolo Gerado', description: newProtocol });
    } catch {
      toast({ title: 'Erro ao gerar protocolo', variant: 'destructive' });
    }
  };

  const handleSuggestAiReply = useCallback(async (): Promise<string | null> => {
    const current = selectedClientRef.current;
    if (!current) return null;
    setSuggestingAi(true);
    try {
      const msgs = clientMessagesRef.current[current.id] || [];
      const suggestion = await aiService.generateResponse(msgs.slice(-10), current.name);
      if (suggestion?.trim()) {
        toast({
          title: 'Sugestão IA pronta',
          description: 'Revise o texto e aperte Enter para enviar.',
        });
        return suggestion.trim();
      }
      return null;
    } catch {
      toast({
        title: 'Não foi possível gerar sugestão agora',
        variant: 'destructive',
      });
      return null;
    } finally {
      setSuggestingAi(false);
    }
  }, [toast]);

  const expandImage = useCallback((url: string) => {
    setSelectedImageUrl(url);
    setShowImageModal(true);
  }, []);

  const unreadChatsCount = useMemo(
    () => clients.reduce((acc, c) => (c.unreadCount > 0 ? acc + 1 : acc), 0),
    [clients]
  );

  const filteredClients = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return clients.filter((c) => {
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.protocol || '').toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (chatFilter === 'unread') return c.unreadCount > 0;
      if (chatFilter === 'ai') return Boolean(c.aiEnabled);
      if (
        chatFilter === 'urgente' ||
        chatFilter === 'suporte' ||
        chatFilter === 'financeiro'
      ) {
        return Boolean(c.tags?.includes(chatFilter));
      }
      return true;
    });
  }, [clients, searchTerm, chatFilter]);

  const currentMessages = useMemo(
    () => (selectedClient ? clientMessages[selectedClient.id] || [] : []),
    [selectedClient, clientMessages]
  );

  // Sincronização automática de visualização (✓✓ azul no WhatsApp do cliente + limpa não lida no celular)
  useEffect(() => {
    if (!selectedClient || !isPageVisible) return;
    const chatId = selectedClient.id;
    if (manualUnreadRef.current.has(chatId)) return;

    const latestIncoming = [...currentMessages]
      .reverse()
      .find((m) => !m.fromMe && !m.isPrivate);
    const hasUnread = (selectedClient.unreadCount || 0) > 0;
    const latestKey = latestIncoming?.zapiMessageId || latestIncoming?.id || '';

    // Só marca como lida no WhatsApp se havia não-lidas OU se chegou nova mensagem do cliente na conversa aberta
    if (!hasUnread && !latestKey) return;
    const dedupToken = latestKey || `unread_${selectedClient.lastMessageTime.getTime()}`;
    if (!hasUnread && lastMarkedReadRef.current[chatId] === dedupToken) return;
    if (lastMarkedReadRef.current[chatId] === dedupToken && !hasUnread) return;

    const alreadyMarkedThisMsg = lastMarkedReadRef.current[chatId] === dedupToken;
    if (!hasUnread && alreadyMarkedThisMsg) return;

    // Só envia recibo de leitura se a conversa tinha unreadCount > 0 ou se a última mensagem da conversa é do cliente
    const lastOverall = currentMessages[currentMessages.length - 1];
    const lastIsFromClient = Boolean(lastOverall && !lastOverall.fromMe && !lastOverall.isPrivate);
    if (!hasUnread && !lastIsFromClient) return;

    lastMarkedReadRef.current[chatId] = dedupToken;

    if (hasUnread) {
      setDoc(doc(db, 'chat', chatId), { unreadCount: 0 }, { merge: true }).catch(
        () => undefined
      );
    }

    const phone = selectedClient.phone || chatId;
    whapiService
      .markChatAsRead(phone, latestIncoming?.zapiMessageId || undefined)
      .catch(() => undefined);
  }, [selectedClient, currentMessages, isPageVisible]);

  const searchMatches = React.useMemo(() => {
    const q = messageSearchQuery.trim().toLowerCase();
    if (!showMessageSearch || !q) return [] as Message[];
    return currentMessages.filter(
      (m) =>
        !m.deletedForEveryone &&
        (m.content.toLowerCase().includes(q) ||
          (m.mediaName || '').toLowerCase().includes(q))
    );
  }, [currentMessages, showMessageSearch, messageSearchQuery]);

  const jumpToSearchMatch = (nextIdx: number) => {
    if (searchMatches.length === 0) return;
    const wrapped = (nextIdx + searchMatches.length) % searchMatches.length;
    setActiveSearchIndex(wrapped);
    scrollToMessage(searchMatches[wrapped].id);
  };

  // Scroll instantâneo ao trocar de conversa e suave apenas ao receber nova mensagem na conversa aberta
  useEffect(() => {
    if (!selectedClientId) return;
    const isSameChat = lastScrolledClientRef.current === selectedClientId;
    lastScrolledClientRef.current = selectedClientId;
    messagesEndRef.current?.scrollIntoView({ behavior: isSameChat ? 'smooth' : 'auto' });
  }, [currentMessages.length, selectedClientId]);

  const handleCloseClientInfo = useCallback(() => {
    setShowClientInfo(false);
  }, []);

  const attendantSlot = useMemo(
    () => <AttendantCard onSendMessage={handleSendMessage} />,
    [handleSendMessage]
  );

  const quickRepliesSlot = useMemo(
    () =>
      selectedClient ? (
        <PredefinedMessages
          client={selectedClient}
          onSelectMessage={handleSelectPredefinedMessage}
        />
      ) : null,
    [selectedClient, handleSelectPredefinedMessage]
  );

  return (
    <PageTransition>
      <div className="flex h-[calc(100vh-148px)] md:h-[calc(100vh-112px)] overflow-hidden gap-3 relative">
        {/* Coluna Esquerda — Lista de Conversas WhatsApp */}
        <div
          className={`w-full lg:w-80 shrink-0 ${selectedClient ? 'hidden lg:flex' : 'flex'
            } flex-col bg-card rounded-2xl shadow-sm border border-border/80 overflow-hidden`}
        >
          <div className="p-4 border-b border-border/60 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                WhatsApp
                <Badge
                  variant="secondary"
                  className="bg-primary/10 text-primary border-none px-1.5 h-5 text-[10px] font-semibold"
                >
                  {unreadChatsCount} novas
                </Badge>
              </h2>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  title="Iniciar nova conversa WhatsApp"
                  className="h-8 w-8 rounded-full text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                  onClick={() => setShowNewChatModal(true)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title={`IA Global: ${globalAiEnabled ? 'ON' : 'OFF'}`}
                  className={`h-8 w-8 rounded-full transition-colors ${globalAiEnabled
                      ? 'text-primary bg-primary/10 hover:bg-primary/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }`}
                  onClick={() => setGlobalAiEnabled(!globalAiEnabled)}
                >
                  <Bot className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Notificações sonoras"
                  className="h-8 w-8 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
                  onClick={() => setShowNotificationSettings(true)}
                >
                  <Bell className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Diagnóstico"
                  className="h-8 w-8 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
                  onClick={() => setShowDebugPanel(!showDebugPanel)}
                >
                  <Bug className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar nome, fone ou protocolo..."
                className="pl-9 h-9 bg-secondary/60 border-border rounded-xl text-sm focus-visible:ring-1 focus-visible:ring-primary transition-all text-foreground"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-1 flex-wrap">
              {(
                [
                  { id: 'all', label: 'Todos' },
                  { id: 'unread', label: 'Não lidos' },
                  { id: 'ai', label: 'IA' },
                  { id: 'urgente', label: 'Urgente' },
                  { id: 'suporte', label: 'Suporte' },
                  { id: 'financeiro', label: 'Financeiro' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setChatFilter(f.id)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors border ${chatFilter === f.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary/50 text-muted-foreground border-border/60 hover:text-foreground'
                    }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {loading && clients.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Carregando conversas...
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Nenhuma conversa encontrada.
              </div>
            ) : (
              filteredClients.map((client) => (
                <ChatConversationItem
                  key={client.id}
                  client={client}
                  isSelected={selectedClient?.id === client.id}
                  onSelect={handleClientSelect}
                />
              ))
            )}
            {!loading && clients.length >= clientLimit - 5 && (
              <div className="pt-2 pb-1 flex justify-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setClientLimit((prev) => prev + 40)}
                  className="h-7 text-[11px] text-muted-foreground hover:text-foreground rounded-full"
                >
                  Carregar mais conversas (+40)
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Coluna Central — Conversa WhatsApp com Drag & Drop */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`${selectedClient ? 'flex' : 'hidden lg:flex'
            } flex-1 min-w-0 flex-col bg-card rounded-2xl shadow-sm border border-border/80 overflow-hidden relative`}
        >
          {/* Overlay de Drag & Drop de arquivos */}
          <AnimatePresence>
            {isDraggingFile && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-30 bg-primary/15 backdrop-blur-sm border-2 border-dashed border-primary rounded-2xl flex flex-col items-center justify-center p-6 text-center pointer-events-none"
              >
                <div className="w-16 h-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-xl mb-3">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <p className="text-base font-bold text-foreground">
                  Solte aqui para enviar no WhatsApp
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Fotos, Vídeos (MP4), Áudios (MP3/OGG) ou Documentos (PDF, DOCX, XLSX)
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {selectedClient ? (
            <>
              {/* Cabeçalho do Chat */}
              <div className="px-4 py-3.5 border-b border-border/60 flex items-center justify-between gap-2 bg-card/90 backdrop-blur-md z-10">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedClient(null)}
                    className="lg:hidden h-8 w-8 rounded-lg shrink-0 text-muted-foreground hover:text-foreground"
                    title="Voltar para lista de conversas"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <Avatar className="h-10 w-10 border-2 border-border shadow-sm shrink-0">
                    {isAvatarImageUrl(selectedClient.avatar) && (
                      <AvatarImage src={selectedClient.avatar} alt={selectedClient.name} />
                    )}
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-bold">
                      {selectedClient.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h3 className="font-bold text-foreground text-sm truncate">
                      {selectedClient.name}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-medium ${selectedClient.isOnline
                            ? 'text-emerald-500'
                            : 'text-muted-foreground'
                          }`}
                      >
                        {selectedClient.isOnline ? 'Online' : 'WhatsApp'}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60">•</span>
                      <span className="text-[10px] text-muted-foreground font-mono truncate">
                        {selectedClient.phone || selectedClient.id}
                      </span>
                      {selectedClient.protocol && (
                        <>
                          <span className="text-[10px] text-muted-foreground/60">•</span>
                          <span className="text-[10px] text-indigo-500 font-bold bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 font-mono">
                            #{selectedClient.protocol}
                          </span>
                        </>
                      )}
                      {selectedOnt && (() => {
                        const ontMeta = getOntStatusMeta(selectedOnt.status);
                        const rx =
                          selectedOnt.rx_power_numeric ?? selectedOnt.olt_rx_power_numeric ?? null;
                        return (
                          <button
                            type="button"
                            onClick={() => setShowClientInfo(true)}
                            title={`SmartOLT: ${selectedOnt.olt_name || 'OLT'} • PON ${selectedOnt.board}/${selectedOnt.pon_port} • SN ${selectedOnt.sn}`}
                            className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border transition-opacity hover:opacity-85 ${ontMeta.badgeClass}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${ontMeta.dotClass}`} />
                            <span>ONT {ontMeta.shortLabel}</span>
                            {rx !== null && (
                              <span className="font-mono opacity-90">{rx.toFixed(1)} dBm</span>
                            )}
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {canAccessRoute('/ispfy/nova-os') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenSelectedClientOS}
                      className="h-8 text-[10px] font-bold border-emerald-500/35 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 gap-1.5 mr-0.5"
                      title={
                        activeIspfyClient
                          ? `Abrir Nova O.S. para ${obterNomeClienteISPFY(activeIspfyClient)}`
                          : resolvingIspfy
                            ? 'Localizando cliente no ISPFY para abrir O.S...'
                            : 'Abrir Nova O.S. para este contato'
                      }
                    >
                      {resolvingIspfy && !activeIspfyClient ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <ClipboardList className="w-3 h-3" />
                      )}
                      O.S.
                    </Button>
                  )}
                  {!selectedClient.protocol && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateProtocol}
                      className="h-8 text-[10px] font-bold border-indigo-500/30 text-indigo-500 hover:bg-indigo-500/10 gap-1.5 mr-1 hidden sm:inline-flex"
                    >
                      <Zap className="w-3 h-3" />
                      PROTOCOLO
                    </Button>
                  )}
                  <Button
                    variant={showMessageSearch ? 'secondary' : 'ghost'}
                    size="icon"
                    onClick={() => {
                      setShowMessageSearch((prev) => !prev);
                      setMessageSearchQuery('');
                      setActiveSearchIndex(0);
                    }}
                    className={`h-9 w-9 rounded-xl transition-colors ${showMessageSearch
                        ? 'text-primary bg-primary/10'
                        : 'text-muted-foreground hover:text-foreground'
                      }`}
                    title="Buscar mensagens nesta conversa"
                  >
                    <Search className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleMarkChatUnread}
                    className="h-9 w-9 rounded-xl text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-colors hidden sm:inline-flex"
                    title="Marcar conversa como não lida (Painel + Celular)"
                  >
                    <MailWarning className="w-4 h-4" />
                  </Button>
                  <a
                    href={`https://wa.me/${(selectedClient.phone || selectedClient.id).replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir no WhatsApp Web"
                    className="hidden sm:inline-flex h-9 w-9 rounded-xl items-center justify-center text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                  <Button
                    variant={showClientInfo ? 'secondary' : 'ghost'}
                    size="icon"
                    onClick={() => setShowClientInfo((prev) => !prev)}
                    className={`h-9 w-9 rounded-xl transition-colors ${showClientInfo
                        ? 'text-primary bg-primary/10 hover:bg-primary/15'
                        : 'text-muted-foreground hover:text-foreground'
                      }`}
                    title={
                      showClientInfo
                        ? 'Ocultar ficha 360° do cliente'
                        : 'Mostrar ficha 360° do cliente'
                    }
                  >
                    {showClientInfo ? (
                      <PanelRightClose className="w-4 h-4" />
                    ) : (
                      <PanelRight className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Barra de busca interna na conversa */}
              <AnimatePresence>
                {showMessageSearch && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.14 }}
                    className="overflow-hidden border-b border-border/60 bg-secondary/40 px-4 py-2 flex items-center gap-2 z-10"
                  >
                    <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <input
                      type="text"
                      value={messageSearchQuery}
                      onChange={(e) => {
                        setMessageSearchQuery(e.target.value);
                        setActiveSearchIndex(0);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && searchMatches.length > 0) {
                          e.preventDefault();
                          jumpToSearchMatch(activeSearchIndex);
                        } else if (e.key === 'Escape') {
                          setShowMessageSearch(false);
                          setMessageSearchQuery('');
                        }
                      }}
                      placeholder="Pesquisar nesta conversa..."
                      autoFocus
                      className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                    {messageSearchQuery.trim() && (
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                        {searchMatches.length === 0
                          ? '0 resultados'
                          : `${activeSearchIndex + 1}/${searchMatches.length}`}
                      </span>
                    )}
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={searchMatches.length === 0}
                        onClick={() => jumpToSearchMatch(activeSearchIndex - 1)}
                        className="h-6 w-6 rounded-md"
                        title="Anterior"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={searchMatches.length === 0}
                        onClick={() => jumpToSearchMatch(activeSearchIndex + 1)}
                        className="h-6 w-6 rounded-md"
                        title="Próximo"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setShowMessageSearch(false);
                          setMessageSearchQuery('');
                        }}
                        className="h-6 w-6 rounded-md"
                        title="Fechar busca"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Área de Mensagens */}
              <div className="flex-1 relative min-h-0 flex flex-col">
                <div
                  ref={messagesScrollRef}
                  onScroll={handleMessagesScroll}
                  className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 avl-chat-pattern custom-scrollbar"
                >
                  {currentMessages.length >= messageLimit && (
                    <div className="flex justify-center pb-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setMessageLimit((prev) => prev + 40)}
                        className="h-7 rounded-full text-[11px] gap-1.5 bg-card/90 shadow-sm"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                        Carregar mensagens anteriores
                      </Button>
                    </div>
                  )}

                  {currentMessages.map((message, index) => {
                    const prevMsg = index > 0 ? currentMessages[index - 1] : null;
                    const showDayDivider =
                      !prevMsg || !isSameDay(prevMsg.timestamp, message.timestamp);
                    const isGroupedWithPrev =
                      Boolean(prevMsg) &&
                      !showDayDivider &&
                      !message.isPrivate &&
                      !prevMsg!.isPrivate &&
                      Boolean(prevMsg!.fromMe) === Boolean(message.fromMe) &&
                      message.timestamp.getTime() - prevMsg!.timestamp.getTime() <
                      3 * 60 * 1000;

                    return (
                      <ChatMessageBubble
                        key={message.id || index}
                        message={message}
                        showDayDivider={showDayDivider}
                        isGroupedWithPrev={isGroupedWithPrev}
                        isHighlighted={highlightedMsgId === message.id}
                        highlightQuery={showMessageSearch ? messageSearchQuery : undefined}
                        onExpandImage={expandImage}
                        onRetryMessage={handleRetryMessage}
                        onReactMessage={handleReactMessage}
                        onReplyMessage={handleReplyMessage}
                        onEditMessage={handleEditMessage}
                        onDeleteForEveryone={handleDeleteForEveryone}
                        onScrollToMessage={scrollToMessage}
                      />
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Botão Flutuante "Ir para o fim" */}
                <AnimatePresence>
                  {showScrollBottom && (
                    <motion.button
                      type="button"
                      initial={{ opacity: 0, scale: 0.85, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.85, y: 8 }}
                      onClick={() =>
                        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
                      }
                      title="Ir para as mensagens mais recentes"
                      className="absolute bottom-3 right-4 z-20 h-9 w-9 rounded-full bg-card/95 hover:bg-card text-foreground border border-border shadow-lg flex items-center justify-center transition-colors"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              {/* Barra de Composição Isolada (zero re-render nas bolhas e lista ao digitar) */}
              <ChatComposer
                ref={composerRef}
                clientId={selectedClient.id}
                clientName={selectedClient.name}
                replyingTo={replyingTo}
                onCancelReply={handleCancelReply}
                stagedMedia={stagedMedia}
                onRemoveStagedMedia={handleRemoveStagedMedia}
                uploadingMedia={uploadingMedia}
                uploadProgress={uploadProgress}
                suggestingAi={suggestingAi}
                onSend={sendMessageCore}
                onUploadRecordedAudio={handleUploadRecordedAudio}
                onStageFile={stageFileForSend}
                onSuggestAiReply={handleSuggestAiReply}
                onMicError={handleMicError}
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 avl-chat-pattern">
              <div className="p-8 bg-card rounded-3xl shadow-xl border border-border max-w-sm text-card-foreground">
                <MessageSquare className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-bold text-foreground">
                  Atendimento WhatsApp 100%
                </h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Selecione um cliente ao lado ou clique no botão <strong>+</strong> para iniciar uma nova conversa com texto, fotos, vídeos, áudios e documentos.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Coluna Direita — Painel 360° reorganizável por arrastar e soltar */}
        {selectedClient && showClientInfo && (
          <>
            <div
              className="xl:hidden fixed inset-0 bg-black/40 backdrop-blur-[2px] z-30"
              onClick={() => setShowClientInfo(false)}
            />
            <div className="fixed inset-y-4 right-4 z-40 w-[min(340px,calc(100vw-2rem))] bg-card/95 backdrop-blur-xl p-3 rounded-2xl border border-border shadow-2xl xl:static xl:z-auto xl:w-80 xl:shrink-0 xl:bg-transparent xl:backdrop-blur-none xl:p-0 xl:border-0 xl:shadow-none flex flex-col gap-3 overflow-y-auto custom-scrollbar pb-2">
              <ClientInfoCard
                clientId={selectedClient.id}
                clientPhone={selectedClient.phone}
                clientName={selectedClient.name}
                onSendMessage={handleSendMessage}
                onOntResolved={handleOntResolved}
                onIspfyClientResolved={reportActiveChatIspfyClient}
                onCloseMobile={handleCloseClientInfo}
                attendantSlot={attendantSlot}
                quickRepliesSlot={quickRepliesSlot}
              />
            </div>
          </>
        )}
      </div>

      {/* Modais */}
      <AnimatePresence>
        {showNewChatModal && (
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowNewChatModal(false)}
          >
            <motion.form
              onSubmit={handleStartNewConversation}
              initial={{ scale: 0.94, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card text-card-foreground border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-foreground">
                  Nova Conversa WhatsApp
                </h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  onClick={() => setShowNewChatModal(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Número com DDD *
                  </label>
                  <Input
                    placeholder="Ex.: 21999998888"
                    value={newChatPhone}
                    onChange={(e) => setNewChatPhone(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Nome do contato (opcional)
                  </label>
                  <Input
                    placeholder="Ex.: Maria Silva"
                    value={newChatName}
                    onChange={(e) => setNewChatName(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowNewChatModal(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="gap-1.5">
                  <MessageSquare className="w-4 h-4" />
                  Abrir Conversa
                </Button>
              </div>
            </motion.form>
          </motion.div>
        )}

        {showNotificationSettings && (
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowNotificationSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 12 }}
              onClick={(e) => e.stopPropagation()}
            >
              <NotificationSettings
                isEnabled={isEnabled}
                isSupported={isSupported}
                permission={permission}
                isPageVisible={isPageVisible}
                onToggleNotifications={toggleNotifications}
                onRequestPermission={requestPermission}
                onTestNotification={testNotification}
              />
            </motion.div>
          </motion.div>
        )}

        {showDebugPanel && (
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDebugPanel(false)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-4xl w-full"
            >
              <DebugPanel
                isEnabled={isEnabled}
                isSupported={isSupported}
                permission={permission}
                isPageVisible={isPageVisible}
                selectedClient={selectedClient}
                clientMessages={clientMessages}
                onTestSound={() => testNotification()}
                onTestNotification={testNotification}
              />
            </motion.div>
          </motion.div>
        )}

        {showImageModal && selectedImageUrl && (
          <motion.div
            className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[100] p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowImageModal(false)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="relative max-w-5xl w-full h-full flex flex-col items-center justify-center gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
                <a
                  href={selectedImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-10 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold inline-flex items-center gap-1.5 backdrop-blur-md"
                >
                  <ExternalLink className="w-4 h-4" />
                  Abrir
                </a>
                <a
                  href={selectedImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="h-10 px-3 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  Baixar
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/15 h-10 w-10 rounded-xl"
                  onClick={() => setShowImageModal(false)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <img
                src={selectedImageUrl}
                alt="Imagem expandida"
                className="max-w-full max-h-[86vh] object-contain rounded-xl shadow-2xl"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}

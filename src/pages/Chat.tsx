import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Send,
  Search,
  Bell,
  Bug,
  Mic,
  Camera,
  Paperclip,
  Phone,
  X,
  MessageSquare,
  Bot,
  Lock,
  Unlock,
  Zap,
  Sparkles,
  Loader2,
  ArrowLeft,
  PanelRight,
  PanelRightClose,
  Film,
  FileText,
  Music,
  Smile,
  Trash2,
  Plus,
  Download,
  ExternalLink,
  UploadCloud,
  ChevronUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PredefinedMessages from '@/components/PredefinedMessages';
import AttendantCard from '@/components/AttendantCard';
import ClientInfoCard from '@/components/ClientInfoCard';
import PageTransition from '@/components/PageTransition';
import NotificationSettings from '@/components/NotificationSettings';
import DebugPanel from '@/components/DebugPanel';
import { ChatMessageContent } from '@/components/chat/ChatMessageContent';
import {
  ChatMediaStagingBar,
  type StagedMediaFile,
} from '@/components/chat/ChatMediaStagingBar';
import { useToast } from '@/hooks/use-toast';
import { useNotifications } from '@/hooks/use-notifications';
import type { Message, Client, ChatMediaPayload } from '@/types/dashboard';
import { db, storage } from '@/config/firebase';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  addDoc,
  getDocs,
  doc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { aiService } from '@/services/ai/aiService';
import { whapiService } from '@/services/whapi/whapiService';
import { compressImage } from '@/utils/compressImage';

const SLASH_MACROS = [
  {
    cmd: '/pix',
    label: 'Solicitar CPF p/ PIX',
    text: 'Olá! Para agilizar o envio da sua 2ª via PIX, poderia me confirmar seu CPF ou CNPJ, por favor? 💠',
  },
  {
    cmd: '/reiniciar',
    label: 'Teste de reinício ONT/Roteador',
    text: 'Por gentileza, desligue o roteador e a caixinha da fibra da tomada por 30 segundos e ligue novamente. Me avise se a luz PON/Internet ficou verde fixa! 📶',
  },
  {
    cmd: '/rompimento',
    label: 'Aviso de rompimento/manutenção',
    text: 'Identificamos uma instabilidade técnica na sua região. Nossa equipe de campo já está atuando no local para restabelecer o sinal o mais rápido possível! 🙏',
  },
  {
    cmd: '/desbloqueio',
    label: 'Confirmar desbloqueio em confiança',
    text: '✅ Liberação em confiança realizada com sucesso! Reinicie o equipamento em alguns instantes para retomar a navegação.',
  },
  {
    cmd: '/agendamento',
    label: 'Confirmar visita técnica',
    text: '🚗 Sua visita técnica está programada! Por favor, mantenha um responsável no local para receber nossa equipe.',
  },
  {
    cmd: '/avaliacao',
    label: 'Pedir avaliação do atendimento',
    text: 'Fico feliz em ajudar! Se precisar de qualquer outra coisa, estamos sempre à disposição aqui na AVL Telecom. 💙',
  },
] as const;

const QUICK_EMOJIS = [
  '😊',
  '👋',
  '🙏',
  '✅',
  '💙',
  '👍',
  '💠',
  '📄',
  '📶',
  '⚡',
  '🔧',
  '🚗',
  '📍',
  '🎉',
  '⚠️',
  '🕐',
] as const;

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

function getBestAudioRecorderMime(): { mimeType: string; ext: string } {
  if (typeof MediaRecorder === 'undefined') {
    return { mimeType: 'audio/webm', ext: 'webm' };
  }
  const candidates = [
    { mimeType: 'audio/ogg;codecs=opus', ext: 'ogg' },
    { mimeType: 'audio/mp4', ext: 'm4a' },
    { mimeType: 'audio/webm;codecs=opus', ext: 'webm' },
    { mimeType: 'audio/webm', ext: 'webm' },
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c.mimeType)) {
      return c;
    }
  }
  return { mimeType: '', ext: 'webm' };
}

function formatDaySeparator(date: Date): string {
  if (isToday(date)) return 'Hoje';
  if (isYesterday(date)) return 'Ontem';
  return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
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
  const [clients, setClients] = useState<Client[]>([]);
  const [clientLimit, setClientLimit] = useState(40);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientMessages, setClientMessages] = useState<Record<string, Message[]>>({});
  const [messageLimit, setMessageLimit] = useState(30);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  // Staging & upload de mídia (Foto, Vídeo, Áudio, Documento)
  const [stagedMedia, setStagedMedia] = useState<StagedMediaFile | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Gravação de áudio com proteção contra envio cancelado + medidor de volume
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevels, setAudioLevels] = useState<number[]>([20, 35, 25, 40, 30, 20, 35, 25]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingDurationRef = useRef<number>(0);
  const cancelRecordingRef = useRef<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRafRef = useRef<number | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);

  // Nova conversa WhatsApp
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState('');
  const [newChatName, setNewChatName] = useState('');

  // Estados de atendimento / UI
  const [isPrivateMode, setIsPrivateMode] = useState(false);
  const [chatFilter, setChatFilter] = useState<
    'all' | 'unread' | 'ai' | 'urgente' | 'suporte' | 'financeiro'
  >('all');
  const [suggestingAi, setSuggestingAi] = useState(false);
  const [showClientInfo, setShowClientInfo] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1280 : true
  );
  const [globalAiEnabled, setGlobalAiEnabled] = useState(() => {
    return localStorage.getItem('globalAiEnabled') === 'true';
  });

  const { toast } = useToast();
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasAutoSelectedRef = useRef(false);
  const fetchedAvatarsRef = useRef<Set<string>>(new Set());
  const previousClientsRef = useRef<Client[]>([]);
  const processedMessageIdsRef = useRef<Set<string>>(new Set());

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

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

  // Envio unificado de Texto + Foto + Vídeo + Áudio + Documento (sincroniza 100% com WhatsApp)
  const handleSendMessage = useCallback(
    async (textOverride?: string, mediaOverride?: ChatMediaPayload) => {
      if (!selectedClient) return;

      const captionText = (textOverride !== undefined ? textOverride : newMessage).trim();

      // Se houver mídia preparada no staging e nenhuma mediaOverride explícita, faz upload primeiro
      let finalMedia = mediaOverride;
      if (!finalMedia && stagedMedia) {
        setUploadingMedia(true);
        setUploadProgress(5);
        try {
          const url = await uploadFileToStorage(
            selectedClient.id,
            stagedMedia.file,
            (pct) => setUploadProgress(pct)
          );
          finalMedia = {
            type: stagedMedia.type,
            url,
            name: stagedMedia.file.name,
            mimeType: stagedMedia.file.type || undefined,
            size: stagedMedia.file.size,
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
          return;
        } finally {
          setUploadingMedia(false);
          setUploadProgress(0);
        }
      }

      if (!captionText && !finalMedia) return;

      const lastLabel = formatLastMessageLabel(captionText, finalMedia, isPrivateMode);
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
          isPrivate: isPrivateMode,
          ...(isPrivateMode ? {} : { deliveryStatus: 'SENDING' }),
        };

        if (finalMedia) {
          messageDoc.mediaType = finalMedia.type;
          messageDoc.mediaUrl = finalMedia.url;
          if (finalMedia.name) messageDoc.mediaName = finalMedia.name;
          if (finalMedia.mimeType) messageDoc.mediaMimeType = finalMedia.mimeType;
          if (finalMedia.size) messageDoc.mediaSize = finalMedia.size;
          if (finalMedia.duration) messageDoc.mediaDuration = finalMedia.duration;
        }

        await addDoc(collection(db, 'chat', selectedClient.id, 'mensagens'), messageDoc);
        await setDoc(
          doc(db, 'chat', selectedClient.id),
          {
            lastMessage: lastLabel,
            lastMessageTime: new Date(),
            unreadCount: 0,
          },
          { merge: true }
        );

        if (textOverride === undefined) {
          setNewMessage('');
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
          }
        }
        setShowEmojiPicker(false);
        if (isPrivateMode) setIsPrivateMode(false);
      } catch {
        toast({ title: 'Erro ao enviar mensagem', variant: 'destructive' });
      }
    },
    [selectedClient, newMessage, stagedMedia, isPrivateMode, uploadFileToStorage, toast]
  );

  // Preparar arquivo selecionado/arrastado/colado (com compressão automática de fotos p/ economia de Storage)
  const stageFileForSend = useCallback(
    async (file: File, forcedType?: 'image' | 'video' | 'audio' | 'document') => {
      if (!selectedClient) {
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
          description: `Tamanho máximo para ${
            type === 'video' ? 'vídeos' : type === 'document' ? 'documentos' : 'este formato'
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
      setShowAttachMenu(false);
      setTimeout(() => textareaRef.current?.focus(), 60);
    },
    [selectedClient, toast]
  );

  const handleFileInputChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    forcedType?: 'image' | 'video' | 'audio' | 'document'
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) stageFileForSend(file, forcedType);
  };

  // Suporte a Ctrl+V de imagens/arquivos direto na caixa de texto
  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          event.preventDefault();
          stageFileForSend(file);
          return;
        }
      }
    }
  };

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
    if (file) stageFileForSend(file);
  };

  // Gravação de Áudio WhatsApp com waveform em tempo real e cancelamento seguro
  const cleanupRecordingResources = () => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (analyserRafRef.current) {
      cancelAnimationFrame(analyserRafRef.current);
      analyserRafRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach((t) => t.stop());
      recordingStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
  };

  useEffect(() => {
    return () => {
      cancelRecordingRef.current = true;
      cleanupRecordingResources();
    };
  }, []);

  const startRecording = async () => {
    if (!selectedClient) return;
    setShowAttachMenu(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      cancelRecordingRef.current = false;
      recordingDurationRef.current = 0;

      const { mimeType, ext } = getBestAudioRecorderMime();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      // Visualizador de nível do microfone
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          audioCtxRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 32;
          source.connect(analyser);
          const dataArr = new Uint8Array(analyser.frequencyBinCount);

          const updateBars = () => {
            analyser.getByteFrequencyData(dataArr);
            const bars = Array.from({ length: 10 }, (_, idx) => {
              const raw = dataArr[idx % dataArr.length] || 0;
              return Math.max(18, Math.min(100, Math.round((raw / 255) * 100)));
            });
            setAudioLevels(bars);
            analyserRafRef.current = requestAnimationFrame(updateBars);
          };
          analyserRafRef.current = requestAnimationFrame(updateBars);
        }
      } catch {
        // Sem medidor visual se o navegador bloquear AudioContext
      }

      const targetClientId = selectedClient.id;
      recorder.onstop = async () => {
        const wasCancelled = cancelRecordingRef.current;
        const durationSec = Math.max(1, recordingDurationRef.current);
        cleanupRecordingResources();

        if (wasCancelled || chunks.length === 0) {
          return;
        }

        const resolvedMime = mimeType || recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type: resolvedMime });
        const fileName = `audio_${Date.now()}.${ext}`;
        const file = new File([blob], fileName, { type: resolvedMime });

        setUploadingMedia(true);
        setUploadProgress(10);
        try {
          const url = await uploadFileToStorage(targetClientId, file, (pct) =>
            setUploadProgress(pct)
          );
          await handleSendMessage('', {
            type: 'audio',
            url,
            name: fileName,
            mimeType: resolvedMime,
            size: file.size,
            duration: durationSec,
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
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = window.setInterval(() => {
        recordingDurationRef.current += 1;
        setRecordingTime(recordingDurationRef.current);
      }, 1000);
    } catch {
      cleanupRecordingResources();
      toast({
        title: 'Permissão de microfone negada',
        description: 'Autorize o microfone no navegador para gravar áudios.',
        variant: 'destructive',
      });
    }
  };

  const cancelRecording = () => {
    cancelRecordingRef.current = true;
    setIsRecording(false);
    setRecordingTime(0);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      cleanupRecordingResources();
    }
  };

  const finishAndSendRecording = () => {
    cancelRecordingRef.current = false;
    setIsRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
    setMessageLimit(30);
    setStagedMedia(null);
    setShowAttachMenu(false);
    setShowEmojiPicker(false);
    if (client.unreadCount > 0) {
      setDoc(doc(db, 'chat', client.id), { unreadCount: 0 }, { merge: true }).catch(
        () => undefined
      );
    }
  };

  const handleRetryMessage = async (msg: Message) => {
    if (!selectedClient) return;
    await handleSendMessage(
      msg.content,
      msg.mediaUrl && msg.mediaType
        ? {
            type: msg.mediaType,
            url: msg.mediaUrl,
            name: msg.mediaName,
            mimeType: msg.mediaMimeType,
            size: msg.mediaSize,
            duration: msg.mediaDuration,
          }
        : undefined
    );
  };

  const handleReactMessage = async (msg: Message, emoji: string) => {
    if (!selectedClient || !msg.zapiMessageId) return;
    const phone = selectedClient.phone || selectedClient.id;
    const res = await whapiService.sendReaction(phone, msg.zapiMessageId, emoji);
    if (res.sent) {
      updateDoc(doc(db, 'chat', selectedClient.id, 'mensagens', msg.id), {
        reaction: emoji,
      }).catch(() => undefined);
    } else {
      toast({
        title: 'Não foi possível reagir',
        description: res.error || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    }
  };

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

  const handleSuggestAiReply = async () => {
    if (!selectedClient) return;
    setSuggestingAi(true);
    try {
      const msgs = clientMessages[selectedClient.id] || [];
      const suggestion = await aiService.generateResponse(
        msgs.slice(-10),
        selectedClient.name
      );
      if (suggestion?.trim()) {
        setNewMessage(suggestion.trim());
        toast({
          title: 'Sugestão IA pronta',
          description: 'Revise o texto e aperte Enter para enviar.',
        });
      }
    } catch {
      toast({
        title: 'Não foi possível gerar sugestão agora',
        variant: 'destructive',
      });
    } finally {
      setSuggestingAi(false);
    }
  };

  const expandImage = (url: string) => {
    setSelectedImageUrl(url);
    setShowImageModal(true);
  };

  const filteredClients = clients.filter((c) => {
    const q = searchTerm.trim().toLowerCase();
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

  const activeSlashMacros = newMessage.startsWith('/')
    ? SLASH_MACROS.filter((m) =>
        m.cmd.toLowerCase().startsWith(newMessage.trim().toLowerCase())
      )
    : [];

  const currentMessages = selectedClient ? clientMessages[selectedClient.id] || [] : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages.length, selectedClientId]);

  const canSend = Boolean(newMessage.trim() || stagedMedia) && !uploadingMedia;

  return (
    <PageTransition>
      {/* Inputs de arquivo ocultos para todos os formatos do WhatsApp */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => handleFileInputChange(e, 'image')}
        className="hidden"
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/*"
        onChange={(e) => handleFileInputChange(e, 'video')}
        className="hidden"
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        onChange={(e) => handleFileInputChange(e, 'audio')}
        className="hidden"
      />
      <input
        ref={docInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.xml,.json"
        onChange={(e) => handleFileInputChange(e, 'document')}
        className="hidden"
      />

      <div className="flex h-[calc(100vh-148px)] md:h-[calc(100vh-112px)] overflow-hidden gap-3 relative">
        {/* Coluna Esquerda — Lista de Conversas WhatsApp */}
        <motion.div
          initial={{ x: -12, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.16 }}
          className={`w-full lg:w-80 shrink-0 ${
            selectedClient ? 'hidden lg:flex' : 'flex'
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
                  {clients.filter((c) => c.unreadCount > 0).length} novas
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
                  className={`h-8 w-8 rounded-full transition-colors ${
                    globalAiEnabled
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
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors border ${
                    chatFilter === f.id
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
                <div
                  key={client.id}
                  onClick={() => handleClientSelect(client)}
                  className={`p-3 rounded-xl cursor-pointer transition-all relative ${
                    selectedClient?.id === client.id
                      ? 'bg-primary/15 border border-primary/30 shadow-sm'
                      : 'hover:bg-secondary/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <Avatar className="h-11 w-11 border-2 border-border shadow-sm">
                        {isAvatarImageUrl(client.avatar) && (
                          <AvatarImage src={client.avatar} alt={client.name} />
                        )}
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                          {client.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {client.isOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-card rounded-full" />
                      )}
                      {client.aiEnabled && (
                        <div
                          className="absolute -top-1 -right-1 bg-indigo-600 text-white p-0.5 rounded-full border border-card shadow-sm"
                          title="IA Ativa"
                        >
                          <Bot className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5 gap-1">
                        <h4 className="font-bold text-sm text-foreground truncate flex items-center gap-1.5">
                          {client.name}
                          {client.source === 'whatsapp' && (
                            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-none text-[9px] h-3.5 px-1 font-bold">
                              WA
                            </Badge>
                          )}
                        </h4>
                        <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                          {format(client.lastMessageTime, 'HH:mm')}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate leading-relaxed">
                        {client.lastMessage}
                      </p>
                      {client.tags && client.tags.length > 0 && (
                        <div className="flex gap-1 mt-1.5">
                          {client.tags.map((tagId) => (
                            <div
                              key={tagId}
                              className={`w-1.5 h-1.5 rounded-full ${
                                tagId === 'suporte'
                                  ? 'bg-blue-400'
                                  : tagId === 'financeiro'
                                  ? 'bg-amber-400'
                                  : tagId === 'vendas'
                                  ? 'bg-emerald-400'
                                  : tagId === 'urgente'
                                  ? 'bg-rose-500'
                                  : 'bg-muted-foreground'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {client.unreadCount > 0 && (
                      <Badge className="bg-primary text-primary-foreground border-none h-5 min-w-[20px] justify-center px-1 text-[10px]">
                        {client.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
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
        </motion.div>

        {/* Coluna Central — Conversa WhatsApp com Drag & Drop */}
        <motion.div
          layout
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`${
            selectedClient ? 'flex' : 'hidden lg:flex'
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
                        className={`text-[10px] font-medium ${
                          selectedClient.isOnline
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
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
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
                    className={`h-9 w-9 rounded-xl transition-colors ${
                      showClientInfo
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

              {/* Área de Mensagens */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 avl-chat-pattern space-y-3.5 custom-scrollbar">
                {currentMessages.length >= messageLimit && (
                  <div className="flex justify-center pb-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setMessageLimit((prev) => prev + 50)}
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

                  return (
                    <React.Fragment key={message.id || index}>
                      {showDayDivider && (
                        <div className="flex justify-center my-2">
                          <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-card/90 border border-border/70 text-muted-foreground shadow-sm">
                            {formatDaySeparator(message.timestamp)}
                          </span>
                        </div>
                      )}

                      <div
                        className={`flex ${
                          message.fromMe ? 'justify-end' : 'justify-start'
                        } ${message.isPrivate ? 'my-2' : ''} ${
                          message.reaction ? 'mb-4' : ''
                        }`}
                      >
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.14 }}
                          className={`max-w-[84%] sm:max-w-[74%] rounded-2xl p-3.5 shadow-sm relative ${
                            message.isPrivate
                              ? 'bg-amber-500/15 border-2 border-amber-500/30 text-amber-600 dark:text-amber-200 rounded-xl mx-auto w-full max-w-[90%] shadow-md'
                              : message.fromMe
                              ? 'bg-primary text-primary-foreground rounded-tr-none shadow-md shadow-primary/20'
                              : 'bg-card text-card-foreground border border-border/80 rounded-tl-none'
                          }`}
                        >
                          <ChatMessageContent
                            message={message}
                            onExpandImage={expandImage}
                            onRetryMessage={handleRetryMessage}
                            onReactMessage={handleReactMessage}
                          />
                        </motion.div>
                      </div>
                    </React.Fragment>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Barra de Composição (Texto + Anexos + Áudio + Emojis + IA) */}
              <div className="p-3 sm:p-4 bg-card border-t border-border/60 relative">
                {/* Atalhos / (Slash Macros) */}
                {activeSlashMacros.length > 0 && (
                  <div className="absolute bottom-full left-4 right-4 mb-2 bg-popover border border-border rounded-xl shadow-xl p-1.5 z-20 max-h-52 overflow-y-auto">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground px-2 py-1">
                      Respostas Rápidas (clique para inserir)
                    </p>
                    {activeSlashMacros.map((macro) => (
                      <button
                        key={macro.cmd}
                        type="button"
                        onClick={() => setNewMessage(macro.text)}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-secondary text-xs flex items-center justify-between gap-2 transition-colors"
                      >
                        <span className="font-mono font-bold text-primary">
                          {macro.cmd}
                        </span>
                        <span className="text-muted-foreground truncate flex-1">
                          {macro.label}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Menu Rápido de Anexos WhatsApp (Foto, Vídeo, Documento, Áudio) */}
                <AnimatePresence>
                  {showAttachMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.14 }}
                      className="absolute bottom-full left-4 mb-2 bg-popover border border-border rounded-2xl shadow-2xl p-2 z-30 w-56 space-y-1"
                    >
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-secondary text-xs font-semibold text-foreground transition-colors"
                      >
                        <span className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-500 flex items-center justify-center">
                          <Camera className="w-4 h-4" />
                        </span>
                        <span>Foto / Imagem</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => videoInputRef.current?.click()}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-secondary text-xs font-semibold text-foreground transition-colors"
                      >
                        <span className="w-8 h-8 rounded-lg bg-violet-500/15 text-violet-500 flex items-center justify-center">
                          <Film className="w-4 h-4" />
                        </span>
                        <span>Vídeo (MP4 / MOV)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => docInputRef.current?.click()}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-secondary text-xs font-semibold text-foreground transition-colors"
                      >
                        <span className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center">
                          <FileText className="w-4 h-4" />
                        </span>
                        <span>Documento (PDF, DOC, XLS)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => audioInputRef.current?.click()}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-secondary text-xs font-semibold text-foreground transition-colors"
                      >
                        <span className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                          <Music className="w-4 h-4" />
                        </span>
                        <span>Arquivo de Áudio</span>
                      </button>
                      <div className="h-px bg-border/70 my-1" />
                      <button
                        type="button"
                        onClick={startRecording}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-rose-500/10 text-xs font-semibold text-rose-500 transition-colors"
                      >
                        <span className="w-8 h-8 rounded-lg bg-rose-500/15 text-rose-500 flex items-center justify-center">
                          <Mic className="w-4 h-4" />
                        </span>
                        <span>Gravar Áudio agora</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Popover de Emojis rápidos */}
                <AnimatePresence>
                  {showEmojiPicker && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.14 }}
                      className="absolute bottom-full left-16 mb-2 bg-popover border border-border rounded-2xl shadow-xl p-2 z-30 grid grid-cols-8 gap-1"
                    >
                      {QUICK_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            setNewMessage((prev) => prev + emoji);
                            textareaRef.current?.focus();
                          }}
                          className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center text-base transition-transform hover:scale-110"
                        >
                          {emoji}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Barra de Pré-visualização de Mídia Staged */}
                {stagedMedia && (
                  <ChatMediaStagingBar
                    staged={stagedMedia}
                    uploading={uploadingMedia}
                    uploadProgress={uploadProgress}
                    onRemove={() => setStagedMedia(null)}
                  />
                )}

                {/* Modo Gravação de Áudio Inline (estilo WhatsApp) */}
                {isRecording ? (
                  <div className="flex items-center justify-between gap-3 bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-2xl">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center animate-pulse shrink-0">
                        <Mic className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-rose-500">
                            Gravando áudio...
                          </span>
                          <span className="text-xs font-mono font-bold text-foreground">
                            {Math.floor(recordingTime / 60)}:
                            {(recordingTime % 60).toString().padStart(2, '0')}
                          </span>
                        </div>
                        <div className="flex items-end gap-1 h-4 mt-1">
                          {audioLevels.map((lvl, idx) => (
                            <span
                              key={idx}
                              className="w-1 rounded-full bg-rose-500 transition-[height] duration-75"
                              style={{ height: `${Math.max(20, lvl)}%` }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={cancelRecording}
                        title="Descartar gravação"
                        className="h-10 w-10 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        onClick={finishAndSendRecording}
                        className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 shadow-md"
                      >
                        <Send className="w-4 h-4" />
                        Enviar Áudio
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-end gap-1.5 sm:gap-2 bg-secondary/40 p-2 rounded-2xl border border-border focus-within:border-primary/50 focus-within:bg-secondary/60 transition-all shadow-inner">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={`h-10 w-10 rounded-xl shrink-0 transition-colors ${
                        isPrivateMode
                          ? 'text-amber-500 bg-amber-500/15 hover:bg-amber-500/20'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => setIsPrivateMode(!isPrivateMode)}
                      title={
                        isPrivateMode
                          ? 'Modo Nota Interna Ativo (não vai para o WhatsApp)'
                          : 'Alternar para Nota Interna da equipe'
                      }
                    >
                      {isPrivateMode ? (
                        <Lock className="w-4 h-4" />
                      ) : (
                        <Unlock className="w-4 h-4" />
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={uploadingMedia}
                      className={`h-10 w-10 rounded-xl shrink-0 transition-colors ${
                        showAttachMenu
                          ? 'text-primary bg-primary/10'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => {
                        setShowAttachMenu((prev) => !prev);
                        setShowEmojiPicker(false);
                      }}
                      title="Anexar foto, vídeo, documento ou áudio"
                    >
                      <Paperclip className="w-4 h-4" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={`hidden sm:inline-flex h-10 w-10 rounded-xl shrink-0 transition-colors ${
                        showEmojiPicker
                          ? 'text-primary bg-primary/10'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => {
                        setShowEmojiPicker((prev) => !prev);
                        setShowAttachMenu(false);
                      }}
                      title="Inserir emoji"
                    >
                      <Smile className="w-4 h-4" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={suggestingAi || uploadingMedia}
                      className="h-10 w-10 rounded-xl shrink-0 text-indigo-500 hover:bg-indigo-500/10"
                      onClick={handleSuggestAiReply}
                      title="Copiloto IA: sugerir resposta com base na conversa"
                    >
                      {suggestingAi ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                    </Button>

                    <textarea
                      ref={textareaRef}
                      placeholder={
                        isPrivateMode
                          ? 'Escreva uma nota interna (não vai para o cliente)...'
                          : stagedMedia
                          ? 'Adicione uma legenda opcional...'
                          : 'Mensagem, /atalhos ou cole uma foto (Ctrl+V)...'
                      }
                      className={`flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-sm py-2.5 resize-none max-h-32 transition-colors text-foreground placeholder:text-muted-foreground ${
                        isPrivateMode
                          ? 'placeholder:text-amber-500/70 text-amber-600 dark:text-amber-300'
                          : ''
                      }`}
                      rows={1}
                      value={newMessage}
                      onPaste={handlePaste}
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (canSend) handleSendMessage();
                        }
                      }}
                    />

                    {canSend ? (
                      <Button
                        type="button"
                        className={`h-10 w-10 rounded-xl shrink-0 shadow-md transition-all active:scale-95 ${
                          isPrivateMode
                            ? 'bg-amber-500 hover:bg-amber-600'
                            : 'bg-primary hover:bg-primary/90'
                        } text-primary-foreground`}
                        onClick={() => handleSendMessage()}
                        disabled={uploadingMedia}
                        title="Enviar"
                      >
                        {uploadingMedia ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        disabled={uploadingMedia}
                        className="h-10 w-10 rounded-xl shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all active:scale-95"
                        onClick={startRecording}
                        title="Gravar mensagem de voz (WhatsApp)"
                      >
                        {uploadingMedia ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Mic className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </div>
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
        </motion.div>

        {/* Coluna Direita — Ficha 360° responsiva */}
        {selectedClient && showClientInfo && (
          <>
            <div
              className="xl:hidden fixed inset-0 bg-black/40 backdrop-blur-[2px] z-30"
              onClick={() => setShowClientInfo(false)}
            />
            <motion.div
              initial={{ x: 16, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.16 }}
              className="fixed inset-y-4 right-4 z-40 w-[min(340px,calc(100vw-2rem))] bg-card/95 backdrop-blur-xl p-3 rounded-2xl border border-border shadow-2xl xl:static xl:z-auto xl:w-80 xl:shrink-0 xl:bg-transparent xl:backdrop-blur-none xl:p-0 xl:border-0 xl:shadow-none flex flex-col gap-3 overflow-y-auto pb-2"
            >
              <div className="xl:hidden flex items-center justify-between pb-1 border-b border-border/60">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Ficha 360° do Cliente
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg"
                  onClick={() => setShowClientInfo(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <ClientInfoCard
                clientId={selectedClient.id}
                clientPhone={selectedClient.phone}
                clientName={selectedClient.name}
                onSendMessage={handleSendMessage}
              />
              <AttendantCard
                onSendMessage={(msg, media) => handleSendMessage(msg, media)}
              />
              <PredefinedMessages
                client={selectedClient}
                onSelectMessage={(msg) => setNewMessage(msg)}
              />
            </motion.div>
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

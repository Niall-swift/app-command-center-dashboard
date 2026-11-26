import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  FileText,
  Film,
  Loader2,
  Lock,
  Mic,
  Music,
  Paperclip,
  Plus,
  Reply,
  Send,
  Settings2,
  Slash,
  Smile,
  Sparkles,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ChatMediaStagingBar,
  type StagedMediaFile,
} from '@/components/chat/ChatMediaStagingBar';
import { SlashMacrosManagerDialog } from '@/components/chat/SlashMacrosManagerDialog';
import {
  applySlashMacroVariables,
  normalizeSlashCommand,
  useSlashMacros,
  type SlashMacro,
} from '@/services/chatSlashMacrosService';
import type { ChatMediaPayload, ReplyToSnapshot } from '@/types/dashboard';

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

export interface ChatComposerHandle {
  setDraft: (text: string) => void;
  focus: () => void;
  exitPrivateMode: () => void;
}

interface ChatComposerProps {
  clientId: string;
  clientName?: string;
  replyingTo: ReplyToSnapshot | null;
  onCancelReply: () => void;
  stagedMedia: StagedMediaFile | null;
  onRemoveStagedMedia: () => void;
  uploadingMedia: boolean;
  uploadProgress: number;
  suggestingAi: boolean;
  onSend: (
    text: string,
    options: { isPrivate: boolean; mediaOverride?: ChatMediaPayload }
  ) => Promise<boolean>;
  onUploadRecordedAudio: (
    targetClientId: string,
    file: File,
    durationSec: number,
    mimeType: string
  ) => Promise<void>;
  onStageFile: (file: File, forcedType?: 'image' | 'video' | 'audio' | 'document') => void;
  onSuggestAiReply: () => Promise<string | null>;
  onMicError: () => void;
}

const ChatComposerBase = forwardRef<ChatComposerHandle, ChatComposerProps>(
  (
    {
      clientId,
      clientName,
      replyingTo,
      onCancelReply,
      stagedMedia,
      onRemoveStagedMedia,
      uploadingMedia,
      uploadProgress,
      suggestingAi,
      onSend,
      onUploadRecordedAudio,
      onStageFile,
      onSuggestAiReply,
      onMicError,
    },
    ref
  ) => {
    const [draft, setDraft] = useState('');
    const [isPrivateMode, setIsPrivateMode] = useState(false);
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showMacrosManager, setShowMacrosManager] = useState(false);
    const [initialMacroCmd, setInitialMacroCmd] = useState<string | undefined>(undefined);
    const [slashMenuDismissed, setSlashMenuDismissed] = useState(false);
    const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);

    const {
      macros: slashMacros,
      saving: savingMacros,
      upsertMacro,
      deleteMacro,
      restoreDefaultMacros,
    } = useSlashMacros();

    // Gravação de áudio isolada no compositor (atualização throttled em ~15fps p/ CPU mínima)
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioLevels, setAudioLevels] = useState<number[]>([20, 35, 25, 40, 30, 20, 35, 25]);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);
    const docInputRef = useRef<HTMLInputElement>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordingTimerRef = useRef<number | null>(null);
    const recordingDurationRef = useRef<number>(0);
    const cancelRecordingRef = useRef<boolean>(false);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const analyserRafRef = useRef<number | null>(null);
    const recordingStreamRef = useRef<MediaStream | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        setDraft: (text: string) => {
          setDraft(text);
          requestAnimationFrame(() => {
            const el = textareaRef.current;
            if (!el) return;
            el.style.height = 'auto';
            el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
            el.focus();
          });
        },
        focus: () => {
          textareaRef.current?.focus();
        },
        exitPrivateMode: () => {
          setIsPrivateMode(false);
        },
      }),
      []
    );

    // Fecha popovers ao trocar de conversa
    useEffect(() => {
      setShowAttachMenu(false);
      setShowEmojiPicker(false);
    }, [clientId]);

    const cleanupRecordingResources = useCallback(() => {
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
    }, []);

    useEffect(() => {
      return () => {
        cancelRecordingRef.current = true;
        cleanupRecordingResources();
      };
    }, [cleanupRecordingResources]);

    const startRecording = async () => {
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

            let lastPaintMs = 0;
            const updateBars = (nowMs: number) => {
              if (nowMs - lastPaintMs >= 65) {
                lastPaintMs = nowMs;
                analyser.getByteFrequencyData(dataArr);
                const bars = Array.from({ length: 10 }, (_, idx) => {
                  const raw = dataArr[idx % dataArr.length] || 0;
                  return Math.max(18, Math.min(100, Math.round((raw / 255) * 100)));
                });
                setAudioLevels(bars);
              }
              analyserRafRef.current = requestAnimationFrame(updateBars);
            };
            analyserRafRef.current = requestAnimationFrame(updateBars);
          }
        } catch {
          // Sem medidor visual se AudioContext falhar
        }

        const targetClientId = clientId;
        recorder.onstop = async () => {
          const wasCancelled = cancelRecordingRef.current;
          const durationSec = Math.max(1, recordingDurationRef.current);
          cleanupRecordingResources();

          if (wasCancelled || chunks.length === 0) return;

          const resolvedMime = mimeType || recorder.mimeType || 'audio/webm';
          const blob = new Blob(chunks, { type: resolvedMime });
          const fileName = `audio_${Date.now()}.${ext}`;
          const file = new File([blob], fileName, { type: resolvedMime });
          await onUploadRecordedAudio(targetClientId, file, durationSec, resolvedMime);
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
        onMicError();
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

    const handleFileInputChange = (
      e: React.ChangeEvent<HTMLInputElement>,
      forcedType: 'image' | 'video' | 'audio' | 'document'
    ) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      setShowAttachMenu(false);
      if (file) onStageFile(file, forcedType);
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            onStageFile(file);
            return;
          }
        }
      }
    };

    const isSlashQueryActive =
      !slashMenuDismissed &&
      draft.startsWith('/') &&
      !draft.includes('\n') &&
      !draft.trimEnd().includes(' ');

    const activeSlashMacros = useMemo(() => {
      if (!isSlashQueryActive) return [] as SlashMacro[];
      const lower = draft.trim().toLowerCase();
      if (lower === '/') return slashMacros;
      const needle = lower.slice(1);
      const startsWithCmd: SlashMacro[] = [];
      const matchesRest: SlashMacro[] = [];
      for (const macro of slashMacros) {
        if (macro.cmd.toLowerCase().startsWith(lower)) {
          startsWithCmd.push(macro);
        } else if (
          macro.label.toLowerCase().includes(needle) ||
          macro.text.toLowerCase().includes(needle)
        ) {
          matchesRest.push(macro);
        }
      }
      return [...startsWithCmd, ...matchesRest];
    }, [draft, isSlashQueryActive, slashMacros]);

    useEffect(() => {
      setSlashSelectedIndex(0);
    }, [draft]);

    const applySelectedMacro = useCallback(
      (macro: SlashMacro) => {
        const resolvedText = applySlashMacroVariables(macro.text, clientName);
        setDraft(resolvedText);
        setSlashMenuDismissed(false);
        requestAnimationFrame(() => {
          const el = textareaRef.current;
          if (!el) return;
          el.style.height = 'auto';
          el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
          el.focus();
        });
      },
      [clientName]
    );

    const openMacrosManager = useCallback((prefillCmd?: string) => {
      setInitialMacroCmd(prefillCmd);
      setShowAttachMenu(false);
      setShowEmojiPicker(false);
      setShowMacrosManager(true);
    }, []);

    const canSend = Boolean(draft.trim() || stagedMedia) && !uploadingMedia;

    const handleSubmit = async () => {
      if (!canSend) return;
      const textToSend = draft;
      const privateFlag = isPrivateMode;
      const ok = await onSend(textToSend, { isPrivate: privateFlag });
      if (ok) {
        setDraft('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
        setShowEmojiPicker(false);
        if (privateFlag) setIsPrivateMode(false);
      }
    };

    const handleAiClick = async () => {
      const suggestion = await onSuggestAiReply();
      if (suggestion) {
        setDraft(suggestion);
        requestAnimationFrame(() => {
          const el = textareaRef.current;
          if (!el) return;
          el.style.height = 'auto';
          el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
          el.focus();
        });
      }
    };

    return (
      <div className="p-3 sm:p-4 bg-card border-t border-border/60 relative">
        {/* Inputs de arquivo ocultos */}
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

        {/* Atalhos / (Slash Macros dinâmicos + cadastro rápido) */}
        {isSlashQueryActive && (
          <div className="absolute bottom-full left-4 right-4 mb-2 bg-popover border border-border rounded-xl shadow-xl p-1.5 z-20 max-h-64 flex flex-col">
            <div className="flex items-center justify-between gap-2 px-2 py-1 border-b border-border/60 mb-1">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">
                Mensagens Rápidas (↑↓ / Enter)
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => openMacrosManager(draft.trim().length > 1 ? draft.trim() : '/')}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Nova
                </button>
                <button
                  type="button"
                  onClick={() => openMacrosManager(undefined)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground text-[10px] font-semibold transition-colors"
                >
                  <Settings2 className="w-3 h-3" />
                  Gerenciar
                </button>
              </div>
            </div>

            {activeSlashMacros.length > 0 ? (
              <div className="overflow-y-auto space-y-0.5">
                {activeSlashMacros.map((macro, idx) => (
                  <button
                    key={macro.id}
                    type="button"
                    onMouseEnter={() => setSlashSelectedIndex(idx)}
                    onClick={() => applySelectedMacro(macro)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 transition-colors ${
                      idx === slashSelectedIndex
                        ? 'bg-primary/15 text-foreground'
                        : 'hover:bg-secondary'
                    }`}
                  >
                    <span className="font-mono font-bold text-primary shrink-0">{macro.cmd}</span>
                    <span className="text-muted-foreground truncate flex-1">{macro.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-2.5 py-3 text-center space-y-2">
                <p className="text-xs text-muted-foreground">
                  Nenhum atalho encontrado para{' '}
                  <span className="font-mono font-bold text-foreground">{draft.trim()}</span>.
                </p>
                {normalizeSlashCommand(draft.trim()) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openMacrosManager(draft.trim())}
                    className="h-7 text-[11px] gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Cadastrar {normalizeSlashCommand(draft.trim())} agora
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Menu Rápido de Anexos WhatsApp */}
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
                    setDraft((prev) => prev + emoji);
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

        {/* Barra de Resposta / Citação ativa */}
        <AnimatePresence>
          {replyingTo && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.14 }}
              className="mb-2 px-3 py-2 rounded-xl bg-secondary/75 border border-border border-l-4 border-l-primary flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-primary flex items-center gap-1.5">
                  <Reply className="w-3 h-3 shrink-0" />
                  Respondendo a {replyingTo.user}
                </p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {replyingTo.content}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onCancelReply}
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground shrink-0"
                title="Cancelar resposta (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Barra de Pré-visualização de Mídia Staged */}
        {stagedMedia && (
          <ChatMediaStagingBar
            staged={stagedMedia}
            uploading={uploadingMedia}
            uploadProgress={uploadProgress}
            onRemove={onRemoveStagedMedia}
          />
        )}

        {/* Modo Gravação de Áudio Inline */}
        {isRecording ? (
          <div className="flex items-center justify-between gap-3 bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-2xl">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center animate-pulse shrink-0">
                <Mic className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-rose-500">Gravando áudio...</span>
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
              onClick={() => setIsPrivateMode((prev) => !prev)}
              title={
                isPrivateMode
                  ? 'Modo Nota Interna Ativo (não vai para o WhatsApp)'
                  : 'Alternar para Nota Interna da equipe'
              }
            >
              {isPrivateMode ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
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
              className="h-10 w-10 rounded-xl shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              onClick={() => openMacrosManager(undefined)}
              title="Mensagens rápidas (/) — cadastrar, editar ou inserir"
            >
              <Slash className="w-4 h-4" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={suggestingAi || uploadingMedia}
              className="h-10 w-10 rounded-xl shrink-0 text-indigo-500 hover:bg-indigo-500/10"
              onClick={() => void handleAiClick()}
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
                isPrivateMode ? 'placeholder:text-amber-500/70 text-amber-600 dark:text-amber-300' : ''
              }`}
              rows={1}
              value={draft}
              onPaste={handlePaste}
              onChange={(e) => {
                setDraft(e.target.value);
                setSlashMenuDismissed(false);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
              }}
              onKeyDown={(e) => {
                if (isSlashQueryActive && activeSlashMacros.length > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSlashSelectedIndex((prev) => (prev + 1) % activeSlashMacros.length);
                    return;
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSlashSelectedIndex(
                      (prev) => (prev - 1 + activeSlashMacros.length) % activeSlashMacros.length
                    );
                    return;
                  }
                  if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
                    e.preventDefault();
                    const picked = activeSlashMacros[slashSelectedIndex] || activeSlashMacros[0];
                    if (picked) applySelectedMacro(picked);
                    return;
                  }
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSubmit();
                } else if (e.key === 'Escape') {
                  if (isSlashQueryActive) {
                    setSlashMenuDismissed(true);
                  } else {
                    onCancelReply();
                  }
                  setShowAttachMenu(false);
                  setShowEmojiPicker(false);
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
                onClick={() => void handleSubmit()}
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
                onClick={() => void startRecording()}
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

        <SlashMacrosManagerDialog
          open={showMacrosManager}
          onOpenChange={setShowMacrosManager}
          macros={slashMacros}
          saving={savingMacros}
          initialCmd={initialMacroCmd}
          onSaveMacro={upsertMacro}
          onDeleteMacro={deleteMacro}
          onRestoreDefaults={restoreDefaultMacros}
          onInsertMacro={applySelectedMacro}
        />
      </div>
    );
  }
);

ChatComposerBase.displayName = 'ChatComposer';

export const ChatComposer = React.memo(ChatComposerBase);

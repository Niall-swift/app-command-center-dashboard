import React, { useState } from 'react';
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCheck,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileArchive,
  FileSpreadsheet,
  FileText,
  Film,
  ImageOff,
  Loader2,
  Lock,
  Pencil,
  Reply,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import type { Message } from '@/types/dashboard';
import { ChatAudioPlayer } from './ChatAudioPlayer';

const PLACEHOLDER_TEXTS = new Set([
  '📎 foto',
  '📎 imagem',
  '🎵 áudio',
  '🎥 vídeo',
  '📄 documento',
  '📎 mídia',
]);

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🙏', '✅'] as const;
const WHATSAPP_EDIT_WINDOW_MS = 15 * 60 * 1000;

function isPlaceholderCaption(text?: string): boolean {
  if (!text) return true;
  const trimmed = text.trim();
  if (!trimmed) return true;
  return PLACEHOLDER_TEXTS.has(trimmed.toLowerCase());
}

function formatBytes(bytes?: number): string {
  if (!bytes || !Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extractFileName(message: Message): string {
  if (message.mediaName && message.mediaName.trim()) {
    return message.mediaName.trim();
  }
  if (message.content && message.content.startsWith('📄 ')) {
    const cleaned = message.content.replace(/^📄\s*/, '').trim();
    if (cleaned && cleaned.toLowerCase() !== 'documento') return cleaned;
  }
  if (message.mediaUrl) {
    try {
      const noQuery = message.mediaUrl.split('?')[0];
      const decoded = decodeURIComponent(noQuery);
      const last = decoded.split('/').pop() || '';
      const stripped = last.replace(/^\d{10,14}_/, '');
      if (stripped && stripped.includes('.')) return stripped;
    } catch {
      // ignore URI error
    }
  }
  return 'Documento';
}

function getFileExtension(name: string, mime?: string): string {
  const dot = name.lastIndexOf('.');
  if (dot > 0 && dot < name.length - 1) {
    return name.slice(dot + 1).toUpperCase().slice(0, 6);
  }
  const m = String(mime || '').toLowerCase();
  if (m.includes('pdf')) return 'PDF';
  if (m.includes('word')) return 'DOCX';
  if (m.includes('sheet') || m.includes('excel')) return 'XLSX';
  if (m.includes('zip')) return 'ZIP';
  if (m.includes('text/plain')) return 'TXT';
  return 'ARQ';
}

function highlightSegment(
  segment: string,
  highlightQuery: string | undefined,
  keyPrefix: string
): React.ReactNode {
  const q = String(highlightQuery || '').trim();
  if (!q) return segment;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const split = segment.split(regex);
  if (split.length <= 1) return segment;

  return split.map((part, idx) =>
    part.toLowerCase() === q.toLowerCase() ? (
      <mark
        key={`${keyPrefix}-h-${idx}`}
        className="bg-amber-300 text-slate-950 rounded px-0.5 font-semibold"
      >
        {part}
      </mark>
    ) : (
      <span key={`${keyPrefix}-p-${idx}`}>{part}</span>
    )
  );
}

function renderInlineWhatsAppText(
  text: string,
  fromMe: boolean,
  highlightQuery?: string
): React.ReactNode[] {
  const tokenRegex =
    /(https?:\/\/[^\s]+|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|`[^`\n]+`)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const currentKey = keyIdx++;
      parts.push(
        <span key={`t-${currentKey}`}>
          {highlightSegment(text.slice(lastIndex, match.index), highlightQuery, `seg-${currentKey}`)}
        </span>
      );
    }
    const token = match[0];
    if (token.startsWith('http://') || token.startsWith('https://')) {
      parts.push(
        <a
          key={`u-${keyIdx++}`}
          href={token}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline break-all font-medium ${
            fromMe
              ? 'text-sky-100 hover:text-white'
              : 'text-primary hover:text-primary/80'
          }`}
        >
          {token}
        </a>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <strong key={`b-${keyIdx++}`} className="font-bold">
          {highlightSegment(token.slice(1, -1), highlightQuery, `b-${keyIdx}`)}
        </strong>
      );
    } else if (token.startsWith('_') && token.endsWith('_')) {
      parts.push(
        <em key={`i-${keyIdx++}`} className="italic">
          {highlightSegment(token.slice(1, -1), highlightQuery, `i-${keyIdx}`)}
        </em>
      );
    } else if (token.startsWith('~') && token.endsWith('~')) {
      parts.push(
        <span key={`s-${keyIdx++}`} className="line-through opacity-80">
          {highlightSegment(token.slice(1, -1), highlightQuery, `s-${keyIdx}`)}
        </span>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={`c-${keyIdx++}`}
          className={`px-1 py-0.5 rounded text-xs font-mono ${
            fromMe ? 'bg-black/20' : 'bg-muted text-foreground'
          }`}
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    const currentKey = keyIdx++;
    parts.push(
      <span key={`tail-${currentKey}`}>
        {highlightSegment(text.slice(lastIndex), highlightQuery, `tail-${currentKey}`)}
      </span>
    );
  }
  return parts;
}

interface ChatMessageContentProps {
  message: Message;
  highlightQuery?: string;
  onExpandImage: (url: string) => void;
  onRetryMessage?: (message: Message) => void;
  onReactMessage?: (message: Message, emoji: string) => void;
  onReplyMessage?: (message: Message) => void;
  onEditMessage?: (message: Message, newText: string) => Promise<boolean>;
  onDeleteForEveryone?: (message: Message) => Promise<boolean>;
  onScrollToMessage?: (messageId: string) => void;
}

/**
 * Renderizador completo de bolha estilo WhatsApp Desktop:
 * Texto formatado, Foto, Vídeo, Áudio, Documento, Citação/Resposta,
 * Edição inline (Z-API editMessageId), Apagar para todos (DELETE /messages) e Reações.
 */
export const ChatMessageContent = React.memo(function ChatMessageContent({
  message,
  highlightQuery,
  onExpandImage,
  onRetryMessage,
  onReactMessage,
  onReplyMessage,
  onEditMessage,
  onDeleteForEveryone,
  onScrollToMessage,
}: ChatMessageContentProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fromMe = Boolean(message.fromMe);
  const captionText = message.text || message.content || '';
  const showCaption = !isPlaceholderCaption(captionText);

  // Mensagem apagada para todos
  if (message.deletedForEveryone) {
    return (
      <div className="space-y-1">
        <div
          className={`flex items-center gap-1.5 text-xs italic ${
            fromMe ? 'text-primary-foreground/80' : 'text-muted-foreground'
          }`}
        >
          <Ban className="w-3.5 h-3.5 shrink-0 opacity-80" />
          <span>{fromMe ? 'Você apagou esta mensagem' : 'Esta mensagem foi apagada'}</span>
        </div>
        <div
          className={`flex items-center justify-end gap-1 text-[10px] font-mono ${
            fromMe ? 'text-primary-foreground/65' : 'text-muted-foreground/80'
          }`}
        >
          <span>{format(message.timestamp, 'HH:mm')}</span>
        </div>
      </div>
    );
  }

  const ageMs = Date.now() - message.timestamp.getTime();
  const canEdit =
    Boolean(onEditMessage) &&
    fromMe &&
    !message.mediaUrl &&
    (Boolean(message.isPrivate) ||
      (Boolean(message.zapiMessageId) && ageMs <= WHATSAPP_EDIT_WINDOW_MS));

  const canDeleteForEveryone =
    Boolean(onDeleteForEveryone) &&
    fromMe &&
    (Boolean(message.isPrivate) || Boolean(message.zapiMessageId));

  const handleCopyText = () => {
    const textToCopy = captionText.trim() || message.mediaUrl || '';
    if (!textToCopy) return;
    navigator.clipboard?.writeText(textToCopy).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const handleStartEdit = () => {
    setEditDraft(captionText);
    setConfirmingDelete(false);
    setIsEditing(true);
  };

  const handleSubmitEdit = async () => {
    const trimmed = editDraft.trim();
    if (!trimmed || trimmed === captionText.trim()) {
      setIsEditing(false);
      return;
    }
    if (!onEditMessage) return;
    setSavingEdit(true);
    const ok = await onEditMessage(message, trimmed);
    setSavingEdit(false);
    if (ok) {
      setIsEditing(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!onDeleteForEveryone) return;
    setDeleting(true);
    const ok = await onDeleteForEveryone(message);
    setDeleting(false);
    if (ok) {
      setConfirmingDelete(false);
    }
  };

  const docFileName = message.mediaType === 'document' ? extractFileName(message) : '';
  const docExt =
    message.mediaType === 'document'
      ? getFileExtension(docFileName, message.mediaMimeType)
      : '';
  const docCaptionVisible =
    showCaption &&
    captionText.trim() !== `📄 ${docFileName}` &&
    captionText.trim() !== docFileName;

  const DocIcon =
    docExt === 'XLS' || docExt === 'XLSX' || docExt === 'CSV'
      ? FileSpreadsheet
      : docExt === 'ZIP' || docExt === 'RAR' || docExt === '7Z'
      ? FileArchive
      : FileText;

  const docBadgeColor =
    docExt === 'PDF'
      ? 'bg-rose-500/15 text-rose-500 border-rose-500/30'
      : docExt === 'XLS' || docExt === 'XLSX' || docExt === 'CSV'
      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
      : docExt === 'DOC' || docExt === 'DOCX'
      ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';

  return (
    <div>
      {/* Barra flutuante unificada (Reações + Responder + Copiar + Editar + Apagar para todos) */}
      {!isEditing && !confirmingDelete && (
        <div
          className={`absolute bottom-full pb-1.5 z-50 ${
            fromMe ? 'right-0' : 'left-0'
          } opacity-0 pointer-events-none group-hover/bubble:opacity-100 group-hover/bubble:pointer-events-auto group-focus-within/bubble:opacity-100 group-focus-within/bubble:pointer-events-auto transition-opacity duration-150`}
        >
          <div className="flex items-center gap-0.5 px-1.5 py-1 rounded-full bg-popover/95 backdrop-blur-md border border-border shadow-xl whitespace-nowrap">
          {message.zapiMessageId && !message.isPrivate && onReactMessage && (
            <>
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReactMessage(message, emoji)}
                  className="w-6 h-6 rounded-full hover:bg-secondary flex items-center justify-center text-xs transition-transform hover:scale-125"
                  title={`Reagir com ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
              <span className="w-px h-4 bg-border/80 mx-0.5" />
            </>
          )}

          {onReplyMessage && !message.isPrivate && (
            <button
              type="button"
              onClick={() => onReplyMessage(message)}
              className="w-6 h-6 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
              title="Responder (citar no WhatsApp)"
            >
              <Reply className="w-3.5 h-3.5" />
            </button>
          )}

          {showCaption && (
            <button
              type="button"
              onClick={handleCopyText}
              className="w-6 h-6 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
              title="Copiar texto"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={handleStartEdit}
              className="w-6 h-6 rounded-full hover:bg-primary/15 text-muted-foreground hover:text-primary flex items-center justify-center transition-colors"
              title="Editar mensagem no WhatsApp (até 15 min)"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}

          {canDeleteForEveryone && (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="w-6 h-6 rounded-full hover:bg-rose-500/15 text-muted-foreground hover:text-rose-500 flex items-center justify-center transition-colors"
              title={
                message.isPrivate
                  ? 'Apagar nota interna'
                  : 'Apagar para todos no WhatsApp'
              }
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          </div>
        </div>
      )}

      {message.isPrivate && (
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-500 uppercase mb-2 border-b border-amber-500/20 pb-1">
          <Lock className="w-3 h-3" />
          Nota Interna (Apenas Equipe)
        </div>
      )}

      {/* Cartão de Mensagem Citada / Respondida (estilo WhatsApp) */}
      {message.replyTo && (
        <button
          type="button"
          onClick={() => onScrollToMessage?.(message.replyTo!.id)}
          className={`w-full text-left mb-2 px-2.5 py-1.5 rounded-lg border-l-[3px] transition-colors block ${
            fromMe
              ? 'bg-black/15 hover:bg-black/20 border-sky-300 text-primary-foreground/90'
              : 'bg-secondary/80 hover:bg-secondary border-primary text-foreground'
          }`}
        >
          <p
            className={`text-[10px] font-bold truncate ${
              fromMe ? 'text-sky-200' : 'text-primary'
            }`}
          >
            {message.replyTo.user}
          </p>
          <p className="text-[11px] opacity-85 truncate">
            {message.replyTo.content}
          </p>
        </button>
      )}

      {/* Confirmação inline de Apagar para Todos */}
      {confirmingDelete && (
        <div
          className={`mb-2 p-2.5 rounded-xl border text-xs space-y-2 ${
            fromMe
              ? 'bg-black/25 border-white/20 text-white'
              : 'bg-rose-500/10 border-rose-500/30 text-foreground'
          }`}
        >
          <p className="font-semibold flex items-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5 text-rose-300 shrink-0" />
            {message.isPrivate
              ? 'Apagar esta nota interna?'
              : 'Apagar esta mensagem para todos no WhatsApp?'}
          </p>
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              disabled={deleting}
              onClick={() => setConfirmingDelete(false)}
              className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-semibold"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={handleConfirmDelete}
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold inline-flex items-center gap-1"
            >
              {deleting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Trash2 className="w-3 h-3" />
              )}
              Apagar para todos
            </button>
          </div>
        </div>
      )}

      {/* Editor inline de Mensagem */}
      {isEditing ? (
        <div className="space-y-2 min-w-[230px]">
          <textarea
            value={editDraft}
            onChange={(e) => setEditDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmitEdit();
              } else if (e.key === 'Escape') {
                setIsEditing(false);
              }
            }}
            rows={Math.min(5, Math.max(2, editDraft.split('\n').length))}
            autoFocus
            className={`w-full rounded-xl p-2 text-sm resize-none border focus:outline-none ${
              fromMe
                ? 'bg-black/20 border-white/30 text-white placeholder:text-white/60'
                : 'bg-background border-border text-foreground'
            }`}
          />
          <div className="flex items-center justify-between gap-2 text-[10px]">
            <span className="opacity-75">Enter salva • Esc cancela</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={savingEdit}
                onClick={() => setIsEditing(false)}
                className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 font-semibold inline-flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Cancelar
              </button>
              <button
                type="button"
                disabled={savingEdit || !editDraft.trim()}
                onClick={handleSubmitEdit}
                className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-bold inline-flex items-center gap-1"
              >
                {savingEdit ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
                Salvar
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* 1. FOTO / IMAGEM */}
          {message.mediaType === 'image' && message.mediaUrl && (
            <div className="space-y-2">
              {imgFailed ? (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-black/10 text-xs">
                  <ImageOff className="w-4 h-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">Não foi possível carregar a imagem</p>
                    <a
                      href={message.mediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-[11px] opacity-90"
                    >
                      Abrir link original
                    </a>
                  </div>
                </div>
              ) : (
                <div className="relative group/img overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
                  <img
                    src={message.mediaUrl}
                    alt="Imagem enviada no chat"
                    loading="lazy"
                    decoding="async"
                    onError={() => setImgFailed(true)}
                    onClick={() => onExpandImage(message.mediaUrl!)}
                    className="max-w-full max-h-[340px] w-auto object-cover cursor-pointer transition-transform duration-200 group-hover/img:scale-[1.01]"
                  />
                  <a
                    href={message.mediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    onClick={(e) => e.stopPropagation()}
                    title="Baixar imagem"
                    className="opacity-0 group-hover/img:opacity-100 transition-opacity absolute top-2 right-2 h-8 w-8 rounded-full bg-black/65 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              )}
              {showCaption && (
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {renderInlineWhatsAppText(captionText, fromMe, highlightQuery)}
                </p>
              )}
            </div>
          )}

          {/* 2. VÍDEO */}
          {message.mediaType === 'video' && message.mediaUrl && (
            <div className="space-y-2">
              <div className="rounded-xl overflow-hidden bg-black/90 border border-black/15 dark:border-white/10">
                <video
                  src={message.mediaUrl}
                  controls
                  playsInline
                  preload="none"
                  className="max-w-full max-h-[360px] w-full rounded-t-xl"
                />
                <div className="px-2.5 py-1.5 bg-black/60 text-white/85 flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1.5 truncate">
                    <Film className="w-3 h-3 text-sky-300 shrink-0" />
                    <span className="truncate">{message.mediaName || 'Vídeo WhatsApp'}</span>
                  </span>
                  <a
                    href={message.mediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="inline-flex items-center gap-1 hover:text-white font-semibold shrink-0 ml-2"
                  >
                    <Download className="w-3 h-3" />
                    Baixar
                  </a>
                </div>
              </div>
              {showCaption && (
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {renderInlineWhatsAppText(captionText, fromMe, highlightQuery)}
                </p>
              )}
            </div>
          )}

          {/* 3. ÁUDIO / MENSAGEM DE VOZ */}
          {message.mediaType === 'audio' && message.mediaUrl && (
            <div className="space-y-2">
              <ChatAudioPlayer
                url={message.mediaUrl}
                fromMe={fromMe}
                durationHint={message.mediaDuration}
              />
              {showCaption && (
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {renderInlineWhatsAppText(captionText, fromMe, highlightQuery)}
                </p>
              )}
            </div>
          )}

          {/* 4. DOCUMENTO */}
          {message.mediaType === 'document' && message.mediaUrl && (
            <div className="space-y-2">
              <div
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors min-w-[235px] sm:min-w-[270px] ${
                  fromMe
                    ? 'bg-black/15 border-white/15'
                    : 'bg-secondary/60 border-border/80'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl border flex flex-col items-center justify-center shrink-0 ${
                    fromMe ? 'bg-white/15 border-white/25 text-white' : docBadgeColor
                  }`}
                >
                  <DocIcon className="w-4 h-4" />
                  <span className="text-[8px] font-black leading-none mt-0.5">{docExt}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate" title={docFileName}>
                    {docFileName}
                  </p>
                  <p
                    className={`text-[10px] mt-0.5 ${
                      fromMe ? 'text-primary-foreground/75' : 'text-muted-foreground'
                    }`}
                  >
                    Documento {docExt}
                    {message.mediaSize ? ` • ${formatBytes(message.mediaSize)}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={message.mediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir documento"
                    className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
                      fromMe
                        ? 'bg-white/15 hover:bg-white/25 text-white'
                        : 'bg-background hover:bg-muted text-foreground border border-border/60'
                    }`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href={message.mediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={docFileName}
                    title="Baixar documento"
                    className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
                      fromMe
                        ? 'bg-white/15 hover:bg-white/25 text-white'
                        : 'bg-background hover:bg-muted text-foreground border border-border/60'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
              {docCaptionVisible && (
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {renderInlineWhatsAppText(captionText, fromMe, highlightQuery)}
                </p>
              )}
            </div>
          )}

          {/* 5. TEXTO PURO */}
          {(!message.mediaType || !message.mediaUrl) && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {renderInlineWhatsAppText(captionText, fromMe, highlightQuery)}
            </p>
          )}
        </>
      )}

      {/* Aviso de falha na entrega WhatsApp + botão Reenviar */}
      {message.deliveryStatus === 'FAILED' && (
        <div
          className={`mt-2 p-2 rounded-lg text-[11px] flex items-center justify-between gap-2 ${
            fromMe
              ? 'bg-rose-950/60 border border-rose-300/30 text-rose-100'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-600'
          }`}
        >
          <span className="flex items-center gap-1.5 min-w-0">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-300" />
            <span
              className="truncate"
              title={message.deliveryError || 'Erro ao entregar no WhatsApp'}
            >
              {message.deliveryError || 'Falha no envio WhatsApp'}
            </span>
          </span>
          {onRetryMessage && (
            <button
              type="button"
              onClick={() => onRetryMessage(message)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/15 hover:bg-white/25 text-[10px] font-bold shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              Reenviar
            </button>
          )}
        </div>
      )}

      {/* Rodapé: Editada + Origem + Hora + Ticks WhatsApp */}
      <div
        className={`flex items-center gap-1 mt-1.5 justify-end ${
          fromMe ? 'text-primary-foreground/75' : 'text-muted-foreground'
        }`}
      >
        {message.edited && (
          <span className="text-[9px] italic opacity-85 mr-1">Editada</span>
        )}
        {message.source === 'whatsapp_device' && (
          <span
            className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-white/15 border border-white/20 mr-1"
            title="Espelhada do celular / WhatsApp Web"
          >
            📱 Celular
          </span>
        )}
        {message.source === 'josue_ai' && (
          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-white/15 mr-1">
            IA
          </span>
        )}
        <span className="text-[10px] font-mono">
          {format(message.timestamp, 'HH:mm')}
        </span>

        {fromMe && !message.isPrivate && (
          message.deliveryStatus === 'FAILED' ? (
            <span title={message.deliveryError || 'Falha ao entregar'}>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-300" />
            </span>
          ) : message.deliveryStatus === 'SENDING' ? (
            <span title="Enviando para o WhatsApp...">
              <Clock className="w-3 h-3 opacity-80 animate-pulse" />
            </span>
          ) : message.deliveryStatus === 'READ' || message.deliveryStatus === 'PLAYED' ? (
            <span
              className="inline-flex items-center"
              title={
                message.deliveryStatus === 'PLAYED'
                  ? 'Áudio reproduzido pelo cliente'
                  : 'Visualizada pelo cliente'
              }
            >
              <CheckCheck className="w-3.5 h-3.5 text-cyan-200 drop-shadow-[0_0_4px_rgba(34,211,238,0.65)]" />
            </span>
          ) : message.deliveryStatus === 'RECEIVED' ? (
            <span title="Entregue no WhatsApp do cliente">
              <CheckCheck className="w-3.5 h-3.5 opacity-90" />
            </span>
          ) : (
            <span title="Enviada ao servidor WhatsApp">
              <Check className="w-3 h-3 opacity-75" />
            </span>
          )
        )}

        {(message.source === 'whatsapp' || message.source === 'whatsapp_device') && (
          <span className="text-[8px] font-bold ml-0.5 opacity-80">WA</span>
        )}
      </div>

      {/* Badge de Reação */}
      {message.reaction && (
        <span
          className={`absolute -bottom-3 z-10 ${
            fromMe ? 'left-2' : 'right-2'
          } px-1.5 py-0.5 rounded-full bg-card border border-border shadow-sm text-xs leading-none`}
        >
          {message.reaction}
        </span>
      )}
    </div>
  );
});

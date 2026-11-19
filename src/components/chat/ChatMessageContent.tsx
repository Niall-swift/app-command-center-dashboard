import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCheck,
  Clock,
  Download,
  ExternalLink,
  FileArchive,
  FileSpreadsheet,
  FileText,
  Film,
  ImageOff,
  Lock,
  RotateCcw,
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

function isPlaceholderCaption(text?: string): boolean {
  if (!text) return true;
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (PLACEHOLDER_TEXTS.has(trimmed.toLowerCase())) return true;
  return false;
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

function renderInlineWhatsAppText(text: string, fromMe: boolean): React.ReactNode[] {
  const tokenRegex =
    /(https?:\/\/[^\s]+|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|`[^`\n]+`)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
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
          {token.slice(1, -1)}
        </strong>
      );
    } else if (token.startsWith('_') && token.endsWith('_')) {
      parts.push(
        <em key={`i-${keyIdx++}`} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith('~') && token.endsWith('~')) {
      parts.push(
        <span key={`s-${keyIdx++}`} className="line-through opacity-80">
          {token.slice(1, -1)}
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
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

interface ChatMessageContentProps {
  message: Message;
  onExpandImage: (url: string) => void;
  onRetryMessage?: (message: Message) => void;
  onReactMessage?: (message: Message, emoji: string) => void;
}

/** Renderizador completo de bolha de mensagem estilo WhatsApp (Texto, Foto, Vídeo, Áudio e Documento). */
export function ChatMessageContent({
  message,
  onExpandImage,
  onRetryMessage,
  onReactMessage,
}: ChatMessageContentProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const fromMe = Boolean(message.fromMe);
  const captionText = message.text || message.content || '';
  const showCaption = !isPlaceholderCaption(captionText);

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
    <div className="group/bubble relative">
      {/* Barra flutuante de reações WhatsApp */}
      {message.zapiMessageId && !message.isPrivate && onReactMessage && (
        <div
          className={`opacity-0 group-hover/bubble:opacity-100 focus-within:opacity-100 transition-opacity absolute -top-8 z-20 flex items-center gap-0.5 px-1.5 py-1 rounded-full bg-popover border border-border shadow-lg ${
            fromMe ? 'right-0' : 'left-0'
          }`}
        >
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
        </div>
      )}

      {message.isPrivate && (
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-500 uppercase mb-2 border-b border-amber-500/20 pb-1">
          <Lock className="w-3 h-3" />
          Nota Interna (Apenas Equipe)
        </div>
      )}

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
              {renderInlineWhatsAppText(captionText, fromMe)}
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
              {renderInlineWhatsAppText(captionText, fromMe)}
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
              {renderInlineWhatsAppText(captionText, fromMe)}
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
                fromMe
                  ? 'bg-white/15 border-white/25 text-white'
                  : docBadgeColor
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
              {renderInlineWhatsAppText(captionText, fromMe)}
            </p>
          )}
        </div>
      )}

      {/* 5. TEXTO PURO (ou fallback de mídia sem URL) */}
      {(!message.mediaType || !message.mediaUrl) && (
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {renderInlineWhatsAppText(captionText, fromMe)}
        </p>
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
            <span className="truncate" title={message.deliveryError || 'Erro ao entregar no WhatsApp'}>
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

      {/* Rodapé: Hora + Origem + Ticks WhatsApp */}
      <div
        className={`flex items-center gap-1 mt-1.5 justify-end ${
          fromMe ? 'text-primary-foreground/75' : 'text-muted-foreground'
        }`}
      >
        {message.source === 'whatsapp_device' && (
          <span className="text-[9px] font-semibold opacity-80 mr-1" title="Enviada pelo celular WhatsApp">
            Celular
          </span>
        )}
        {message.source === 'josue_ai' && (
          <span className="text-[9px] font-semibold opacity-80 mr-1">IA</span>
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
            <span title={message.deliveryStatus === 'PLAYED' ? 'Áudio reproduzido' : 'Visualizado pelo cliente'}>
              <CheckCheck className="w-3.5 h-3.5 text-sky-300" />
            </span>
          ) : message.deliveryStatus === 'RECEIVED' ? (
            <span title="Entregue no WhatsApp">
              <CheckCheck className="w-3.5 h-3.5 opacity-90" />
            </span>
          ) : (
            <span title="Enviado">
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
          className={`absolute -bottom-3.5 ${
            fromMe ? 'left-2' : 'right-2'
          } px-1.5 py-0.5 rounded-full bg-card border border-border shadow-sm text-xs leading-none`}
        >
          {message.reaction}
        </span>
      )}
    </div>
  );
}

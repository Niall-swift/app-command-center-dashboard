import React from 'react';
import { FileText, Film, Music, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface StagedMediaFile {
  file: File;
  type: 'image' | 'video' | 'audio' | 'document';
  previewUrl: string;
}

interface ChatMediaStagingBarProps {
  staged: StagedMediaFile;
  uploading: boolean;
  uploadProgress: number;
  onRemove: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Barra de pré-visualização de Foto, Vídeo, Áudio ou Documento antes do envio no WhatsApp. */
export function ChatMediaStagingBar({
  staged,
  uploading,
  uploadProgress,
  onRemove,
}: ChatMediaStagingBarProps) {
  const { file, type, previewUrl } = staged;
  const typeLabel =
    type === 'image'
      ? 'Foto'
      : type === 'video'
      ? 'Vídeo'
      : type === 'audio'
      ? 'Áudio'
      : 'Documento';

  return (
    <div className="mb-2.5 p-2.5 rounded-2xl bg-secondary/70 border border-border flex items-center gap-3 relative overflow-hidden">
      {/* Miniatura / Preview */}
      {type === 'image' ? (
        <img
          src={previewUrl}
          alt={file.name}
          className="w-16 h-16 rounded-xl object-cover border border-border shrink-0"
        />
      ) : type === 'video' ? (
        <div className="w-20 h-16 rounded-xl overflow-hidden bg-black border border-border shrink-0 relative">
          <video
            src={previewUrl}
            className="w-full h-full object-cover"
            muted
            playsInline
          />
          <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/70 text-[9px] text-white font-bold flex items-center gap-0.5">
            <Film className="w-2.5 h-2.5" />
          </span>
        </div>
      ) : type === 'audio' ? (
        <div className="w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
          <Music className="w-5 h-5" />
        </div>
      ) : (
        <div className="w-12 h-12 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5" />
        </div>
      )}

      {/* Metadados e Player de Áudio preview */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary">
            {typeLabel}
          </span>
          <span className="text-[11px] text-muted-foreground font-mono">
            {formatFileSize(file.size)}
          </span>
        </div>
        <p className="text-xs font-semibold text-foreground truncate mt-1">
          {file.name}
        </p>

        {type === 'audio' && !uploading && (
          <audio src={previewUrl} controls className="h-7 w-full max-w-xs mt-1.5" />
        )}

        {uploading ? (
          <div className="mt-1.5 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-primary font-semibold">
              <span className="inline-flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Enviando arquivo para o WhatsApp...
              </span>
              <span className="font-mono">{Math.round(uploadProgress)}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-background overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-150"
                style={{ width: `${Math.min(100, Math.max(4, uploadProgress))}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {type === 'audio'
              ? 'Clique em Enviar para disparar o áudio no WhatsApp.'
              : 'Adicione uma legenda abaixo (opcional) e aperte Enter para enviar.'}
          </p>
        )}
      </div>

      {!uploading && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive shrink-0"
          title="Remover anexo"
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}

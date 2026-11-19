/**
 * compressImage
 * Comprime uma imagem usando o Canvas API e retorna um novo File em WebP.
 * Sem dependências externas — funciona 100% no browser.
 */

export interface CompressImageOptions {
  /** Largura máxima em pixels. Padrão: 1280 */
  maxWidth?: number;
  /** Altura máxima em pixels. Padrão: 1280 */
  maxHeight?: number;
  /** Qualidade 0..1. Padrão: 0.82 */
  quality?: number;
  /** MIME de saída. Padrão: 'image/webp' (use 'image/jpeg' para máxima compatibilidade WhatsApp) */
  mimeType?: 'image/webp' | 'image/jpeg';
}

export interface CompressImageResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  /** Percentual de redução, ex: "67%" */
  reduction: string;
}

export async function compressImage(
  file: File,
  options: CompressImageOptions = {}
): Promise<CompressImageResult> {
  const {
    maxWidth = 1280,
    maxHeight = 1280,
    quality = 0.82,
    mimeType = 'image/webp',
  } = options;
  const outputExt = mimeType === 'image/jpeg' ? 'jpg' : 'webp';

  const originalSize = file.size;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Calcular dimensões mantendo aspect ratio
      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context não disponível'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Falha ao comprimir imagem'));
            return;
          }

          const baseName = file.name.replace(/\.[^/.]+$/, '');
          const compressedFile = new File([blob], `${baseName}.${outputExt}`, {
            type: mimeType,
            lastModified: Date.now(),
          });

          const compressedSize = compressedFile.size;
          const reduction = `${Math.round((1 - compressedSize / originalSize) * 100)}%`;

          resolve({ file: compressedFile, originalSize, compressedSize, reduction });
        },
        mimeType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Erro ao carregar imagem para compressão'));
    };

    img.src = url;
  });
}

/** Formata bytes para exibição legível  ex: 1.2 MB */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

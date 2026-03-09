/**
 * compressVideo
 * Comprime vídeos usando FFmpeg.wasm (WebAssembly) no browser.
 * Converte para H.264 + AAC com CRF 26 — boa qualidade, arquivo menor.
 *
 * REQUER: headers COOP/COEP para SharedArrayBuffer (configurados no vite.config.ts e firebase.json)
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoaded = false;

/**
 * Carrega o FFmpeg uma única vez (singleton) via CDN jsDelivr
 */
async function getFFmpeg(onLog?: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegLoaded) return ffmpegInstance;

  const ffmpeg = new FFmpeg();

  if (onLog) {
    ffmpeg.on('log', ({ message }) => onLog(message));
  }

  // Carrega binários via CDN (sem incluir no bundle para economizar MB)
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  ffmpegInstance = ffmpeg;
  ffmpegLoaded = true;
  return ffmpeg;
}

export interface CompressVideoOptions {
  /**
   * CRF (Constant Rate Factor): 0=sem perda, 51=qualidade mínima.
   * Valores típicos: 23 (alta), 26 (boa), 28 (menor arquivo).
   * Padrão: 26
   */
  crf?: number;
  /**
   * Preset de velocidade: ultrafast, superfast, veryfast, faster, fast, medium, slow, veryslow
   * Mais lento = arquivo menor com mesma qualidade.
   * Padrão: 'fast'
   */
  preset?: string;
}

export interface CompressVideoResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  reduction: string;
}

export async function compressVideo(
  file: File,
  onProgress?: (percent: number) => void,
  options: CompressVideoOptions = {}
): Promise<CompressVideoResult> {
  const { crf = 26, preset = 'fast' } = options;
  const originalSize = file.size;

  const ffmpeg = await getFFmpeg((msg) => {
    // Parsear progresso do log do FFmpeg  "time=00:01:23.45"
    const match = msg.match(/time=(\d+):(\d+):(\d+\.\d+)/);
    if (match && onProgress) {
      // Progresso aproximado: precisaria da duração total para ser exato
      // Vamos usar um progresso incremental simples
    }
  });

  // Monitorar progresso via evento 'progress'
  ffmpeg.on('progress', ({ progress }) => {
    if (onProgress) {
      onProgress(Math.round(Math.min(progress * 100, 99)));
    }
  });

  const inputName = 'input' + Date.now() + '.mp4';
  const outputName = 'output' + Date.now() + '.mp4';

  // Escrever arquivo de entrada no sistema de arquivos virtual do FFmpeg
  await ffmpeg.writeFile(inputName, await fetchFile(file));

  // Comprimir: H.264 + AAC, CRF 26, preset fast
  await ffmpeg.exec([
    '-i', inputName,
    '-c:v', 'libx264',
    '-crf', crf.toString(),
    '-preset', preset,
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',   // Otimiza para streaming (metadata no início)
    '-y',                        // Sobrescrever se existir
    outputName,
  ]);

  // Ler arquivo de saída
  const data = await ffmpeg.readFile(outputName);
  // Cast necessário: FFmpeg retorna Uint8Array<SharedArrayBuffer>, mas Blob espera ArrayBuffer
  const outputBlob = new Blob([data as Uint8Array<ArrayBuffer>], { type: 'video/mp4' });

  // Limpar arquivos temporários
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const compressedFile = new File([outputBlob], `${baseName}_compressed.mp4`, {
    type: 'video/mp4',
    lastModified: Date.now(),
  });

  if (onProgress) onProgress(100);

  const compressedSize = compressedFile.size;
  const reduction = `${Math.round((1 - compressedSize / originalSize) * 100)}%`;

  return { file: compressedFile, originalSize, compressedSize, reduction };
}

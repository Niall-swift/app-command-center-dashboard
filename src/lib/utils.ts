import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Abre conversa no WhatsApp Web/App normalizando o DDI +55 para números brasileiros.
 */
export function abrirConversaWhatsApp(telefone?: string | null, mensagemCodificada?: string): boolean {
  const digitos = String(telefone || '').replace(/\D/g, '');
  if (!digitos) return false;
  const numeroCompleto = digitos.startsWith('55') ? digitos : `55${digitos}`;
  const sufixoTexto = mensagemCodificada ? `?text=${mensagemCodificada}` : '';
  window.open(`https://wa.me/${numeroCompleto}${sufixoTexto}`, '_blank');
  return true;
}

/**
 * Formata um valor numérico em moeda brasileira (R$).
 */
export function formatarMoedaBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/**
 * Dispara o download de um arquivo CSV com BOM UTF-8 compatível com Excel.
 */
export function baixarArquivoCsv(nomeArquivo: string, conteudoCsv: string): void {
  const comBom = conteudoCsv.startsWith('\uFEFF') ? conteudoCsv : `\uFEFF${conteudoCsv}`;
  const blob = new Blob([comBom], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', nomeArquivo);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Mantém aliases retroativos para componentes que ainda usam o nome antigo
export const openWhatsAppChat = abrirConversaWhatsApp;
export const formatCurrencyBRL = formatarMoedaBRL;

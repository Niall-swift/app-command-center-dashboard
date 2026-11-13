import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Abre conversa no WhatsApp Web/App normalizando DDI +55 para números brasileiros.
 */
export function openWhatsAppChat(phone?: string | null): void {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return;
  const full = digits.startsWith('55') ? digits : `55${digits}`;
  window.open(`https://wa.me/${full}`, '_blank');
}

/**
 * Formata valor numérico em moeda BRL (R$).
 */
export function formatCurrencyBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

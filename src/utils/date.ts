/**
 * Utilitários para manipulação de datas ignorando timezone (UTC vs Local)
 * O objetivo é garantir que uma string "2023-10-05" seja sempre tratada como dia 05,
 * independente do fuso horário do navegador ou do servidor.
 */

import { differenceInCalendarDays } from 'date-fns';

/**
 * Converte string YYYY-MM-DD para Date (meia-noite local)
 * Evita o problema do new Date('YYYY-MM-DD') que assume UTC (e volta 1 dia no Brasil)
 */
export function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  
  // Se já vier com hora ou não for o formato esperado, tenta parse normal mas corrige timezone se necessário
  // Mas para o caso de boletos (YYYY-MM-DD), o split é o mais seguro
  if (dateStr.includes('T')) {
    return new Date(dateStr);
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Formata string YYYY-MM-DD para DD/MM/YYYY
 * Manualmente para performance e segurança de timezone
 */
export function formatDate(dateStr: string | Date): string {
  if (!dateStr) return '';
  
  // Se for objeto Date
  if (dateStr instanceof Date) {
    return dateStr.toLocaleDateString('pt-BR');
  }

  // Se for string ISO YYYY-MM-DD
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }

  // Fallback para outros formatos
  try {
    const d = new Date(dateStr);
    // Ajuste para timezone se for string YYYY-MM-DD tratada como UTC
    if (dateStr.length === 10) {
        // Se a entrada original era YYYY-MM-DD, use o parse manual
        const [y, m, d_part] = dateStr.split('-');
        return `${d_part}/${m}/${y}`;
    }
    return d.toLocaleDateString('pt-BR');
  } catch (e) {
    return dateStr;
  }
}

/**
 * Calcula dias de atraso (positivo) ou dias restantes (negativo)
 * Baseado apenas na data em dias inteiros
 */
export function calculateDaysDiff(dataVencimento: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const vencimento = parseDate(dataVencimento);
  vencimento.setHours(0, 0, 0, 0);

  // differenceInCalendarDays(dateLeft, dateRight) -> dateLeft - dateRight
  // Se hoje > vencimento, positivo (atraso)
  // Se hoje < vencimento, negativo (faltam dias)
  return differenceInCalendarDays(hoje, vencimento);
}

/**
 * Verifica se a data é hoje
 */
export function isToday(dateStr: string): boolean {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  
  const data = parseDate(dateStr);
  data.setHours(0, 0, 0, 0);
  
  return hoje.getTime() === data.getTime();
}

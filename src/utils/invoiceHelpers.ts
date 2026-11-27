import type { ISPFYFaturaData } from '@/types/ispfy';

export type InvoicePeriodTag = 'overdue' | 'current_month' | 'next_month' | 'future';

export interface ClassifiedInvoice {
  invoice: ISPFYFaturaData;
  dueDate: Date | null;
  dueMs: number;
  formattedDate: string;
  monthYearLabel: string;
  periodTag: InvoicePeriodTag;
}

const SHORT_MONTHS_PT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

export function parseInvoiceDueDate(raw?: string | null): Date | null {
  if (!raw) return null;
  const clean = String(raw).trim();
  if (!clean) return null;

  const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    const d = new Date(year, month, day, 23, 59, 59, 999);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const brMatch = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    const day = Number(brMatch[1]);
    const month = Number(brMatch[2]) - 1;
    const year = Number(brMatch[3]);
    const d = new Date(year, month, day, 23, 59, 59, 999);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const fallback = new Date(clean);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function formatInvoiceDueDateBr(raw?: string | null): string {
  const d = parseInvoiceDueDate(raw);
  if (!d) return String(raw || '—');
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function isOpenUnpaidInvoice(f: ISPFYFaturaData): boolean {
  const st = String(f.status || '').trim().toLowerCase();
  const paidDate = f.data_pagamento || f.pagamento_data;
  if (paidDate) return false;
  return st === 'aberto' || st === 'a' || st === 'vencido' || st === 'pendente';
}

/**
 * Classifica e ordena cronologicamente as faturas em aberto do cliente:
 * - `current`: todas as vencidas + faturas do mês atual + faturas do próximo mês
 * - `future`: parcelas de meses mais distantes (ex.: restante do carnê anual)
 */
export function partitionCurrentAndFutureInvoices(
  allInvoices: ISPFYFaturaData[],
  now = new Date()
): {
  current: ClassifiedInvoice[];
  future: ClassifiedInvoice[];
  allOpen: ClassifiedInvoice[];
} {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);
  const nextMonthYear = nextMonthDate.getFullYear();
  const nextMonthIndex = nextMonthDate.getMonth();

  const openList: ClassifiedInvoice[] = allInvoices
    .filter(isOpenUnpaidInvoice)
    .map((invoice) => {
      const dueDate = parseInvoiceDueDate(invoice.data_vencimento);
      const dueMs = dueDate ? dueDate.getTime() : Number.MAX_SAFE_INTEGER;
      const formattedDate = formatInvoiceDueDateBr(invoice.data_vencimento);
      const monthYearLabel = dueDate
        ? `${SHORT_MONTHS_PT[dueDate.getMonth()]}/${dueDate.getFullYear()}`
        : 'Sem data';

      let periodTag: InvoicePeriodTag = 'current_month';
      if (dueDate) {
        const y = dueDate.getFullYear();
        const m = dueDate.getMonth();
        if (dueDate.getTime() < todayStart.getTime()) {
          periodTag = 'overdue';
        } else if (y === currentYear && m === currentMonth) {
          periodTag = 'current_month';
        } else if (y === nextMonthYear && m === nextMonthIndex) {
          periodTag = 'next_month';
        } else {
          periodTag = 'future';
        }
      }

      return {
        invoice,
        dueDate,
        dueMs,
        formattedDate,
        monthYearLabel,
        periodTag,
      };
    })
    .sort((a, b) => a.dueMs - b.dueMs);

  const current = openList.filter((item) => item.periodTag !== 'future');
  const future = openList.filter((item) => item.periodTag === 'future');

  // Se o cliente não tiver nada vencido nem nos próximos 2 meses, mas tiver futuras, exibe a próxima parcela
  if (current.length === 0 && future.length > 0) {
    return {
      current: future.slice(0, 2),
      future: future.slice(2),
      allOpen: openList,
    };
  }

  return { current, future, allOpen: openList };
}

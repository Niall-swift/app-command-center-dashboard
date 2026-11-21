import type { SmartOltOnuStatus } from '@/types/smartOlt';

export interface OntStatusMeta {
  label: string;
  shortLabel: string;
  hint: string;
  badgeClass: string;
  dotClass: string;
  borderClass: string;
  bgClass: string;
}

export function getOntStatusMeta(status: SmartOltOnuStatus): OntStatusMeta {
  switch (status) {
    case 'online':
      return {
        label: 'ONT Online',
        shortLabel: 'Online',
        hint: 'Fibra sincronizada e ativa na OLT.',
        badgeClass:
          'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
        dotClass: 'bg-emerald-500',
        borderClass: 'border-emerald-500/25',
        bgClass: 'bg-emerald-500/5',
      };
    case 'los':
      return {
        label: 'LOS — Sem Sinal Óptico',
        shortLabel: 'LOS (Fibra)',
        hint: 'Perda de luz óptica: possível fibra rompida, dobrada ou conector desconectado.',
        badgeClass:
          'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/35',
        dotClass: 'bg-rose-500 animate-pulse',
        borderClass: 'border-rose-500/35',
        bgClass: 'bg-rose-500/10',
      };
    case 'power_fail':
      return {
        label: 'Power Fail — Sem Energia',
        shortLabel: 'Sem Energia',
        hint: 'ONT desligada da tomada ou falta de energia elétrica na residência.',
        badgeClass:
          'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35',
        dotClass: 'bg-amber-500 animate-pulse',
        borderClass: 'border-amber-500/35',
        bgClass: 'bg-amber-500/10',
      };
    case 'offline':
      return {
        label: 'ONT Offline',
        shortLabel: 'Offline',
        hint: 'Equipamento sem resposta na porta PON da OLT.',
        badgeClass:
          'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
        dotClass: 'bg-slate-400',
        borderClass: 'border-border',
        bgClass: 'bg-muted/40',
      };
    case 'login':
      return {
        label: 'Sincronizando (Log in)',
        shortLabel: 'Sincronizando',
        hint: 'ONT iniciando autenticação na OLT.',
        badgeClass:
          'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
        dotClass: 'bg-sky-500 animate-pulse',
        borderClass: 'border-sky-500/30',
        bgClass: 'bg-sky-500/5',
      };
    default:
      return {
        label: 'Status Desconhecido',
        shortLabel: 'Desconhecido',
        hint: 'Sem leitura recente na OLT.',
        badgeClass: 'bg-muted text-muted-foreground border-border',
        dotClass: 'bg-muted-foreground',
        borderClass: 'border-border',
        bgClass: 'bg-muted/30',
      };
  }
}

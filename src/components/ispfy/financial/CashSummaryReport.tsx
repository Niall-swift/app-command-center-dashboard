import React, { useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { SpotlightCard } from '@/components/ui/aceternity';
import type { ISPFYCashMovementData } from '@/types/ispfy';

interface CashSummaryReportProps {
  movements: ISPFYCashMovementData[];
  loading: boolean;
  selectedCaixaId: string;
  onRefresh: () => void;
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function formatMovementDate(raw?: string): string {
  if (!raw) return '—';
  const [datePart, timePart] = String(raw).trim().split(' ');
  const parts = datePart.split('-');
  if (parts.length !== 3) return raw;
  const brDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
  return timePart && timePart !== '00:00:00' ? `${brDate} ${timePart.slice(0, 5)}` : brDate;
}

export const CashSummaryReport: React.FC<CashSummaryReportProps> = ({
  movements,
  loading,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredMovements = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return movements;
    return movements.filter(
      (m) =>
        String(m.historico || '').toLowerCase().includes(q) ||
        String(m.documento || '').toLowerCase().includes(q) ||
        String(m.data || '').toLowerCase().includes(q) ||
        String(m.valor || '').includes(q)
    );
  }, [movements, searchTerm]);

  const totalVisible = useMemo(
    () =>
      filteredMovements.reduce(
        (sum, m) => sum + (parseFloat(String(m.valor || '0')) || 0),
        0
      ),
    [filteredMovements]
  );

  if (loading) {
    return (
      <SpotlightCard tone="emerald" className="p-5 space-y-4">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-[360px] w-full rounded-xl" />
      </SpotlightCard>
    );
  }

  return (
    <SpotlightCard tone="emerald" showTopBeam className="p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-foreground">
            Extrato de Recebimentos do Caixa (Últimos 30 dias)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {filteredMovements.length} lançamento(s) listado(s) • Subtotal visível:{' '}
            <strong className="text-emerald-600 dark:text-emerald-400">
              {BRL.format(totalVisible)}
            </strong>
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar fatura, operador, doc..."
            className="pl-9 h-9 text-xs rounded-xl"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto max-h-[460px] overflow-y-auto rounded-xl border border-border/70">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10 bg-muted/85 backdrop-blur-md border-b border-border/70 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3.5 py-2.5">Data / Hora</th>
              <th className="px-3.5 py-2.5">Histórico / Operador</th>
              <th className="px-3.5 py-2.5">Tipo</th>
              <th className="px-3.5 py-2.5 text-right">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {filteredMovements.length > 0 ? (
              filteredMovements.slice(0, 100).map((m) => (
                <tr key={m.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-3.5 py-3 text-muted-foreground font-mono whitespace-nowrap">
                    {formatMovementDate(m.data)}
                  </td>
                  <td className="px-3.5 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-foreground line-clamp-2">
                        {m.historico}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        Doc / Carteira: {m.documento || '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-3.5 py-3">
                    {m.tipo === 'E' ? (
                      <Badge className="bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 gap-1 text-[10px]">
                        <ArrowUpCircle className="w-3 h-3" /> Entrada
                      </Badge>
                    ) : (
                      <Badge className="bg-rose-500/12 text-rose-700 dark:text-rose-300 border border-rose-500/25 gap-1 text-[10px]">
                        <ArrowDownCircle className="w-3 h-3" /> Saída
                      </Badge>
                    )}
                  </td>
                  <td
                    className={`px-3.5 py-3 text-right font-black tabular-nums whitespace-nowrap ${
                      m.tipo === 'E'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {m.tipo === 'E' ? '+' : '-'}{' '}
                    {BRL.format(parseFloat(String(m.valor || '0')) || 0)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground italic">
                  Nenhum recebimento encontrado para o filtro selecionado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </SpotlightCard>
  );
};

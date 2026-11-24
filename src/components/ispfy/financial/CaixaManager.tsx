import React from 'react';
import { ExternalLink, Landmark, Layers, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SpotlightCard } from '@/components/ui/aceternity';
import { ispfyService } from '@/services/ispfy/ispfyService';
import type { ISPFYFinancialCaixaData } from '@/types/ispfy';

export type EnrichedCaixaAccount = ISPFYFinancialCaixaData & {
  recebidoHoje?: number;
  recebidoMes?: number;
  qtdPagamentos?: number;
  carteiraStatus?: string;
};

interface CaixaManagerProps {
  accounts: EnrichedCaixaAccount[];
  selectedId: string;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  loading: boolean;
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const CaixaManager: React.FC<CaixaManagerProps> = ({
  accounts,
  selectedId,
  onSelect,
  loading,
}) => {
  const total30dAll = accounts.reduce(
    (sum, acc) => sum + (parseFloat(String(acc.saldo || '0')) || 0),
    0
  );
  const totalTodayAll = accounts.reduce((sum, acc) => sum + (acc.recebidoHoje || 0), 0);
  const totalCountAll = accounts.reduce((sum, acc) => sum + (acc.qtdPagamentos || 0), 0);

  return (
    <SpotlightCard tone="blue" showTopBeam className="p-5 h-full space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" />
            Carteiras &amp; Caixas (ISPFY)
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Recebimentos reais consolidados dos últimos 30 dias
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs rounded-xl gap-1"
          onClick={() =>
            window.open(ispfyService.getIspfyWebPanelUrl(), '_blank', 'noopener,noreferrer')
          }
        >
          <ExternalLink className="w-3.5 h-3.5" />
          ISPFY
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2.5">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-18 w-full rounded-xl" />
          <Skeleton className="h-18 w-full rounded-xl" />
        </div>
      ) : (
        <div className="space-y-2.5">
          {/* Card Consolidado: Todas as Carteiras */}
          <button
            type="button"
            onClick={() => onSelect('ALL')}
            className={`w-full text-left p-3.5 rounded-xl border transition-all ${
              selectedId === 'ALL' || !selectedId
                ? 'border-primary/60 bg-primary/10 shadow-sm'
                : 'border-border/70 bg-background/60 dark:bg-white/[0.02] hover:border-primary/35'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    selectedId === 'ALL' || !selectedId
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">
                    Todas as Carteiras
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {totalCountAll} recebimento(s) • Hoje: {BRL.format(totalTodayAll)}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {BRL.format(total30dAll)}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  30 dias
                </p>
              </div>
            </div>
          </button>

          {/* Carteiras Reais do ISPFY */}
          {accounts.map((acc) => {
            const idStr = String(acc.id || '');
            const isSelected = selectedId === idStr;
            const label = acc.descricao || `Carteira #${idStr}`;
            const isBank = /efi|banco|inter|sicoob|sicredi|pix|asaas|gerencianet/i.test(label);
            const isActive = acc.ativo !== 'N' && acc.carteiraStatus !== '0';
            const total30d = parseFloat(String(acc.saldo || '0')) || 0;

            return (
              <button
                key={idStr}
                type="button"
                onClick={() => onSelect(idStr)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                  isSelected
                    ? 'border-primary/60 bg-primary/10 shadow-sm'
                    : 'border-border/70 bg-background/60 dark:bg-white/[0.02] hover:border-primary/35'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-muted-foreground'
                      }`}
                    >
                      {isBank ? <Landmark className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-foreground truncate">{label}</p>
                        {!isActive && (
                          <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                            Inativa
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        #{idStr} • {acc.qtdPagamentos || 0} baixa(s) • Hoje:{' '}
                        {BRL.format(acc.recebidoHoje || 0)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-foreground tabular-nums">
                      {BRL.format(total30d)}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      30 dias
                    </p>
                  </div>
                </div>
              </button>
            );
          })}

          {accounts.length === 0 && (
            <p className="text-center text-muted-foreground py-8 text-xs italic">
              Nenhuma carteira bancária retornada pelo ISPFY.
            </p>
          )}
        </div>
      )}
    </SpotlightCard>
  );
};

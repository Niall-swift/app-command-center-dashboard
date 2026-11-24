import React from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { SpotlightCard } from '@/components/ui/aceternity';

interface CashFlowChartProps {
  data: { date: string; inflow: number; outflow: number }[];
  loading: boolean;
}

export const CashFlowChart: React.FC<CashFlowChartProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <SpotlightCard tone="emerald" className="p-5 space-y-3">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-[320px] w-full rounded-xl" />
      </SpotlightCard>
    );
  }

  const hasOutflow = data.some((d) => d.outflow > 0);
  const totalInflow = data.reduce((acc, d) => acc + d.inflow, 0);

  return (
    <SpotlightCard tone="emerald" showTopBeam className="p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-foreground">
            {hasOutflow
              ? 'Fluxo de Caixa (Entradas vs Saídas)'
              : 'Recebimentos Diários no Caixa (Últimos 30 dias)'}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Total compensado no período:{' '}
            <strong className="text-emerald-600 dark:text-emerald-400">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                totalInflow
              )}
            </strong>
          </p>
        </div>
      </div>

      <div className="h-[320px] w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(value) =>
                `R$ ${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`
              }
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: number) => [
                `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                '',
              ]}
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid hsl(var(--border))',
                backgroundColor: 'hsl(var(--card))',
                color: 'hsl(var(--card-foreground))',
              }}
            />
            <Legend verticalAlign="top" align="right" height={32} />
            <Area
              type="monotone"
              dataKey="inflow"
              name="Entradas (Recebido)"
              stroke="#10B981"
              fillOpacity={1}
              fill="url(#colorInflow)"
              strokeWidth={2.5}
            />
            {hasOutflow && (
              <Area
                type="monotone"
                dataKey="outflow"
                name="Saídas"
                stroke="#EF4444"
                fillOpacity={1}
                fill="url(#colorOutflow)"
                strokeWidth={2.5}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </SpotlightCard>
  );
};

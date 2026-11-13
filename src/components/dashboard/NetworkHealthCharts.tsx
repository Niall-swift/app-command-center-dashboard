import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  ArrowRight,
  Lock,
  MapPin,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { ISPFYClientsByRegionResult } from '@/types/ispfy';

interface NetworkHealthChartsProps {
  regionData: ISPFYClientsByRegionResult | null;
  loading: boolean;
  onNavigateRegion: (status?: string, bairroKey?: string) => void;
}

type NeighborhoodSortMode = 'disconnected' | 'volume';

export const NetworkHealthCharts: React.FC<NetworkHealthChartsProps> = ({
  regionData,
  loading,
  onNavigateRegion,
}) => {
  const [includeInactiveInChart, setIncludeInactiveInChart] = useState(false);
  const [bairroSort, setBairroSort] =
    useState<NeighborhoodSortMode>('disconnected');

  const totals = regionData?.totals;

  const pieSlices = useMemo(() => {
    if (!totals) return [];
    const base = [
      {
        key: 'OK',
        name: 'Internet OK',
        value: totals.internetOk,
        color: '#10b981',
        badgeClass:
          'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
        desc: 'Contratos ativos conectados agora',
      },
      {
        key: 'DESCONECTADO',
        name: 'Sem Internet',
        value: totals.desconectados,
        color: '#f43f5e',
        badgeClass:
          'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
        desc: 'Ativos offline (sem bloqueio financeiro)',
      },
      {
        key: 'BLOQUEADO',
        name: 'Bloqueados',
        value: totals.bloqueados,
        color: '#f59e0b',
        badgeClass:
          'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
        desc: `${totals.bloqueadosOnline} em aviso / ${totals.bloqueadosOffline} offline`,
      },
    ];

    if (includeInactiveInChart && totals.inativos > 0) {
      base.push({
        key: 'INATIVO',
        name: 'Inativos',
        value: totals.inativos,
        color: '#64748b',
        badgeClass:
          'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
        desc: 'Contratos cancelados ou encerrados',
      });
    }

    return base;
  }, [totals, includeInactiveInChart]);

  const totalDenominator = useMemo(
    () => pieSlices.reduce((sum, s) => sum + s.value, 0),
    [pieSlices]
  );

  const onlinePct = useMemo(() => {
    if (!totals || totals.totalAtivos === 0) return 0;
    return Math.round((totals.internetOk / totals.totalAtivos) * 1000) / 10;
  }, [totals]);

  const topBairrosChart = useMemo(() => {
    if (!regionData?.bairros) return [];
    const sorted = [...regionData.bairros].sort((a, b) =>
      bairroSort === 'disconnected'
        ? b.desconectados - a.desconectados || b.totalPontos - a.totalPontos
        : b.totalPontos - a.totalPontos
    );
    return sorted.slice(0, 7).map((b) => ({
      ...b,
      shortName: b.label.length > 16 ? `${b.label.slice(0, 15)}…` : b.label,
    }));
  }, [regionData, bairroSort]);

  if (loading && !regionData) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-5 h-[360px] animate-pulse bg-card/60" />
        <Card className="lg:col-span-7 h-[360px] animate-pulse bg-card/60" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Gráfico 1: Rosca de Status de Conexão (Ativos OK, Sem Internet, Bloqueados) */}
      <Card className="lg:col-span-5 border-border shadow-sm bg-card">
        <CardHeader className="pb-2 border-b border-border/60">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Wifi className="w-4 h-4 text-emerald-500" />
                Status das Conexões dos Clientes
              </CardTitle>
              <CardDescription className="text-xs">
                Distribuição visual entre clientes OK, sem internet e bloqueados
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5">
              <Switch
                id="dash-inactive-chart"
                checked={includeInactiveInChart}
                onCheckedChange={setIncludeInactiveInChart}
              />
              <Label
                htmlFor="dash-inactive-chart"
                className="text-[11px] text-muted-foreground cursor-pointer"
              >
                Inativos
              </Label>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
            {/* Donut */}
            <div className="sm:col-span-5 h-[210px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieSlices}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={82}
                    paddingAngle={3}
                    strokeWidth={0}
                    onClick={(entry: any) => {
                      if (entry?.key) onNavigateRegion(entry.key);
                    }}
                    className="cursor-pointer"
                  >
                    {pieSlices.map((slice) => (
                      <Cell key={slice.key} fill={slice.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const item = payload[0].payload;
                      const pct =
                        totalDenominator > 0
                          ? ((item.value / totalDenominator) * 100).toFixed(1)
                          : '0.0';
                      return (
                        <div className="rounded-xl border border-border bg-popover px-3 py-2 shadow-lg text-xs">
                          <p className="font-bold text-foreground">{item.name}</p>
                          <p className="text-muted-foreground">
                            {item.value} pontos ({pct}%)
                          </p>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Centro da Rosca */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black text-foreground tabular-nums">
                  {onlinePct}%
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Online
                </span>
              </div>
            </div>

            {/* Legenda Interativa Clicável */}
            <div className="sm:col-span-7 space-y-2.5">
              {pieSlices.map((slice) => {
                const pct =
                  totalDenominator > 0
                    ? Math.round((slice.value / totalDenominator) * 1000) / 10
                    : 0;
                return (
                  <button
                    type="button"
                    key={slice.key}
                    onClick={() => onNavigateRegion(slice.key)}
                    className="w-full text-left p-2.5 rounded-xl border border-border/70 hover:border-primary/40 hover:bg-secondary/40 transition-all group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: slice.color }}
                        />
                        <span className="text-xs font-bold text-foreground truncate">
                          {slice.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge
                          variant="outline"
                          className={`text-[11px] font-extrabold tabular-nums ${slice.badgeClass}`}
                        >
                          {slice.value}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground tabular-nums w-10 text-right">
                          {pct}%
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 truncate">
                      {slice.desc}
                    </p>
                    <Progress
                      value={pct}
                      className="h-1 mt-1.5 bg-secondary"
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-500" />
              Total ativo:{' '}
              <strong className="text-foreground">
                {totals?.totalAtivos ?? 0}
              </strong>{' '}
              ({totals?.totalClientesUnicos ?? 0} assinantes)
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-primary font-semibold gap-1 px-2"
              onClick={() => onNavigateRegion('ALL')}
            >
              Ver por Bairro/Rua
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico 2: Saúde por Bairro (Internet OK vs Sem Internet vs Bloqueados) */}
      <Card className="lg:col-span-7 border-border shadow-sm bg-card">
        <CardHeader className="pb-2 border-b border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-500" />
                Conexão por Bairro (Concentração de Quedas)
              </CardTitle>
              <CardDescription className="text-xs">
                Identifique em qual bairro há clientes sem internet ou bloqueados — clique para abrir
              </CardDescription>
            </div>
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg self-start sm:self-auto">
              <Button
                variant={bairroSort === 'disconnected' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-[11px] px-2.5"
                onClick={() => setBairroSort('disconnected')}
              >
                <WifiOff className="w-3 h-3 mr-1" />
                Mais Quedas
              </Button>
              <Button
                variant={bairroSort === 'volume' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-[11px] px-2.5"
                onClick={() => setBairroSort('volume')}
              >
                <Users className="w-3 h-3 mr-1" />
                Mais Clientes
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-3">
          <div className="h-[230px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topBairrosChart}
                margin={{ top: 8, right: 12, left: -12, bottom: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="shortName"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted) / 0.35)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const b = payload[0].payload;
                    return (
                      <div className="rounded-xl border border-border bg-popover p-3 shadow-xl text-xs space-y-1.5">
                        <p className="font-bold text-foreground">
                          {b.label} ({b.totalPontos} pts)
                        </p>
                        <div className="space-y-0.5">
                          <p className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            Internet OK: {b.internetOk} ({b.onlineRate}%)
                          </p>
                          <p className="text-rose-600 dark:text-rose-400 font-semibold">
                            Sem Internet: {b.desconectados}
                          </p>
                          <p className="text-amber-600 dark:text-amber-400 font-semibold">
                            Bloqueados: {b.bloqueados}
                          </p>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="internetOk"
                  stackId="a"
                  name="Internet OK"
                  fill="#10b981"
                  radius={[0, 0, 0, 0]}
                  className="cursor-pointer"
                  onClick={(data: any) => {
                    const item = data?.payload ?? data;
                    if (item?.key) onNavigateRegion('ALL', item.key);
                  }}
                />
                <Bar
                  dataKey="bloqueados"
                  stackId="a"
                  name="Bloqueados"
                  fill="#f59e0b"
                  className="cursor-pointer"
                  onClick={(data: any) => {
                    const item = data?.payload ?? data;
                    if (item?.key) onNavigateRegion('BLOQUEADO', item.key);
                  }}
                />
                <Bar
                  dataKey="desconectados"
                  stackId="a"
                  name="Sem Internet"
                  fill="#f43f5e"
                  radius={[4, 4, 0, 0]}
                  className="cursor-pointer"
                  onClick={(data: any) => {
                    const item = data?.payload ?? data;
                    if (item?.key) onNavigateRegion('DESCONECTADO', item.key);
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Badges clicáveis dos bairros em destaque */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {topBairrosChart.slice(0, 5).map((b) => (
              <button
                type="button"
                key={b.key}
                onClick={() =>
                  onNavigateRegion(
                    b.desconectados > 0 ? 'DESCONECTADO' : 'ALL',
                    b.key
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 hover:bg-secondary px-2.5 py-1 text-[11px] font-semibold transition-colors"
              >
                <span className="truncate max-w-[120px]">{b.label}</span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  {b.internetOk}
                </span>
                {b.desconectados > 0 && (
                  <span className="text-rose-600 dark:text-rose-400 font-bold">
                    • {b.desconectados} off
                  </span>
                )}
                {b.bloqueados > 0 && (
                  <span className="text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                    • <Lock className="w-2.5 h-2.5" />
                    {b.bloqueados}
                  </span>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

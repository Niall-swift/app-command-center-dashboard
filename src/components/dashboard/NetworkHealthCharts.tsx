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

export interface PropsGraficosSaudeRede {
  dadosRegiao: ISPFYClientsByRegionResult | null;
  carregando: boolean;
  aoNavegarRegiao: (status?: string, chaveBairro?: string) => void;
}

type ModoOrdenacaoBairros = 'quedas' | 'volume';

/** Card 1: Gráfico de Rosca com distribuição de status da base de assinantes ISPFY. */
export const ClientStatusDonutCard: React.FC<PropsGraficosSaudeRede> = ({
  dadosRegiao,
  carregando,
  aoNavegarRegiao,
}) => {
  const [incluirInativosGrafico, setIncluirInativosGrafico] = useState(false);
  const totais = dadosRegiao?.totals;

  const fatiasGraficoRosca = useMemo(() => {
    if (!totais) return [];
    const fatiasBase = [
      {
        chave: 'OK',
        rotulo: 'Internet OK',
        valor: totais.internetOk,
        cor: '#10b981',
        classeBadge:
          'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
        descricao: 'Contratos ativos conectados agora',
      },
      {
        chave: 'DESCONECTADO',
        rotulo: 'Sem Internet',
        valor: totais.desconectados,
        cor: '#f43f5e',
        classeBadge:
          'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
        descricao: 'Ativos offline (sem bloqueio financeiro)',
      },
      {
        chave: 'BLOQUEADO',
        rotulo: 'Bloqueados',
        valor: totais.bloqueados,
        cor: '#f59e0b',
        classeBadge:
          'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
        descricao: `${totais.bloqueadosOnline} em aviso / ${totais.bloqueadosOffline} offline`,
      },
    ];

    if (incluirInativosGrafico && totais.inativos > 0) {
      fatiasBase.push({
        chave: 'INATIVO',
        rotulo: 'Inativos',
        valor: totais.inativos,
        cor: '#64748b',
        classeBadge:
          'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
        descricao: 'Contratos cancelados ou encerrados',
      });
    }

    return fatiasBase;
  }, [totais, incluirInativosGrafico]);

  const totalDenominador = useMemo(
    () => fatiasGraficoRosca.reduce((soma, fatia) => soma + fatia.valor, 0),
    [fatiasGraficoRosca]
  );

  const percentualOnline = useMemo(() => {
    if (!totais || totais.totalAtivos === 0) return 0;
    return Math.round((totais.internetOk / totais.totalAtivos) * 1000) / 10;
  }, [totais]);

  if (carregando && !dadosRegiao) {
    return <Card className="h-full min-h-[380px] animate-pulse bg-card/60" />;
  }

  return (
    <Card className="h-full border-border shadow-sm bg-card flex flex-col">
      <CardHeader className="px-5 py-4 border-b border-border/60">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
              <Wifi className="w-4 h-4 text-emerald-500 shrink-0" />
              Status da Base de Assinantes
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Proporção entre ativos OK, sem internet e bloqueados
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5 pt-0.5">
            <Switch
              id="dash-inactive-chart"
              checked={incluirInativosGrafico}
              onCheckedChange={setIncluirInativosGrafico}
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

      <CardContent className="p-5 flex-1 flex flex-col justify-between gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center my-auto">
          {/* Donut */}
          <div className="sm:col-span-5 h-[210px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={fatiasGraficoRosca}
                  dataKey="valor"
                  nameKey="rotulo"
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={82}
                  paddingAngle={3}
                  strokeWidth={0}
                  onClick={(entrada: { chave?: string }) => {
                    if (entrada?.chave) aoNavegarRegiao(entrada.chave);
                  }}
                  className="cursor-pointer"
                >
                  {fatiasGraficoRosca.map((fatia) => (
                    <Cell key={fatia.chave} fill={fatia.cor} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const item = payload[0].payload as { rotulo: string; valor: number };
                    const porcentagem =
                      totalDenominador > 0
                        ? ((item.valor / totalDenominador) * 100).toFixed(1)
                        : '0.0';
                    return (
                      <div className="rounded-xl border border-border bg-popover px-3 py-2 shadow-lg text-xs">
                        <p className="font-bold text-foreground">{item.rotulo}</p>
                        <p className="text-muted-foreground font-mono">
                          {item.valor.toLocaleString('pt-BR')} pontos ({porcentagem}%)
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
                {percentualOnline}%
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Online
              </span>
            </div>
          </div>

          {/* Legenda Interativa Clicável */}
          <div className="sm:col-span-7 space-y-2">
            {fatiasGraficoRosca.map((fatia) => {
              const porcentagem =
                totalDenominador > 0
                  ? Math.round((fatia.valor / totalDenominador) * 1000) / 10
                  : 0;
              return (
                <button
                  type="button"
                  key={fatia.chave}
                  onClick={() => aoNavegarRegiao(fatia.chave)}
                  className="w-full text-left p-2.5 rounded-xl border border-border/70 hover:border-primary/40 hover:bg-secondary/40 transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: fatia.cor }}
                      />
                      <span className="text-xs font-bold text-foreground truncate">
                        {fatia.rotulo}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-extrabold tabular-nums ${fatia.classeBadge}`}
                      >
                        {fatia.valor.toLocaleString('pt-BR')}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground tabular-nums w-9 text-right">
                        {porcentagem}%
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {fatia.descricao}
                  </p>
                  <Progress value={porcentagem} className="h-1 mt-1.5 bg-secondary" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-3 mt-auto border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-blue-500" />
            Ativos:{' '}
            <strong className="text-foreground tabular-nums">
              {(totais?.totalAtivos ?? 0).toLocaleString('pt-BR')}
            </strong>{' '}
            <span className="hidden sm:inline">
              ({(totais?.totalClientesUnicos ?? 0).toLocaleString('pt-BR')} assinantes)
            </span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-primary font-semibold gap-1 px-2"
            onClick={() => aoNavegarRegiao('ALL')}
          >
            Ver por Bairro
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

/** Card 2: Gráfico de Concentração de Quedas e Saúde por Bairro (ISPFY). */
export const NeighborhoodHealthBarCard: React.FC<PropsGraficosSaudeRede> = ({
  dadosRegiao,
  carregando,
  aoNavegarRegiao,
}) => {
  const [ordenacaoBairros, setOrdenacaoBairros] =
    useState<ModoOrdenacaoBairros>('quedas');

  const bairrosDestaqueGrafico = useMemo(() => {
    if (!dadosRegiao?.bairros) return [];
    const ordenados = [...dadosRegiao.bairros].sort((a, b) =>
      ordenacaoBairros === 'quedas'
        ? b.desconectados - a.desconectados || b.totalPontos - a.totalPontos
        : b.totalPontos - a.totalPontos
    );
    return ordenados.slice(0, 7).map((bairro) => ({
      ...bairro,
      nomeCurto:
        bairro.label.length > 15 ? `${bairro.label.slice(0, 14)}…` : bairro.label,
    }));
  }, [dadosRegiao, ordenacaoBairros]);

  if (carregando && !dadosRegiao) {
    return <Card className="h-full min-h-[380px] animate-pulse bg-card/60" />;
  }

  return (
    <Card className="h-full border-border shadow-sm bg-card flex flex-col">
      <CardHeader className="px-5 py-4 border-b border-border/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-500 shrink-0" />
              Concentração de Quedas por Bairro
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Identifique rapidamente se há rompimento localizado — clique na barra para abrir o bairro
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg self-start sm:self-auto shrink-0">
            <Button
              variant={ordenacaoBairros === 'quedas' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-[11px] px-2.5"
              onClick={() => setOrdenacaoBairros('quedas')}
            >
              <WifiOff className="w-3 h-3 mr-1" />
              Mais Quedas
            </Button>
            <Button
              variant={ordenacaoBairros === 'volume' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-[11px] px-2.5"
              onClick={() => setOrdenacaoBairros('volume')}
            >
              <Users className="w-3 h-3 mr-1" />
              Mais Clientes
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 flex-1 flex flex-col justify-between gap-3">
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={bairrosDestaqueGrafico}
              margin={{ top: 8, right: 10, left: -12, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="hsl(var(--border))"
              />
              <XAxis
                dataKey="nomeCurto"
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
                  const bairro = payload[0].payload;
                  return (
                    <div className="rounded-xl border border-border bg-popover p-3 shadow-xl text-xs space-y-1.5">
                      <p className="font-bold text-foreground">
                        {bairro.label} ({bairro.totalPontos} pts)
                      </p>
                      <div className="space-y-0.5 font-mono">
                        <p className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          Internet OK: {bairro.internetOk} ({bairro.onlineRate}%)
                        </p>
                        <p className="text-rose-600 dark:text-rose-400 font-semibold">
                          Sem Internet: {bairro.desconectados}
                        </p>
                        <p className="text-amber-600 dark:text-amber-400 font-semibold">
                          Bloqueados: {bairro.bloqueados}
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
                className="cursor-pointer"
                onClick={(dadosBarra: { payload?: { key?: string }; key?: string }) => {
                  const item = dadosBarra?.payload ?? dadosBarra;
                  if (item?.key) aoNavegarRegiao('ALL', item.key);
                }}
              />
              <Bar
                dataKey="bloqueados"
                stackId="a"
                name="Bloqueados"
                fill="#f59e0b"
                className="cursor-pointer"
                onClick={(dadosBarra: { payload?: { key?: string }; key?: string }) => {
                  const item = dadosBarra?.payload ?? dadosBarra;
                  if (item?.key) aoNavegarRegiao('BLOQUEADO', item.key);
                }}
              />
              <Bar
                dataKey="desconectados"
                stackId="a"
                name="Sem Internet"
                fill="#f43f5e"
                radius={[4, 4, 0, 0]}
                className="cursor-pointer"
                onClick={(dadosBarra: { payload?: { key?: string }; key?: string }) => {
                  const item = dadosBarra?.payload ?? dadosBarra;
                  if (item?.key) aoNavegarRegiao('DESCONECTADO', item.key);
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Badges clicáveis dos bairros + legenda */}
        <div className="space-y-2.5 pt-2 border-t border-border/50 mt-auto">
          <div className="flex flex-wrap items-center gap-1.5">
            {bairrosDestaqueGrafico.slice(0, 5).map((bairro) => (
              <button
                type="button"
                key={bairro.key}
                onClick={() =>
                  aoNavegarRegiao(
                    bairro.desconectados > 0 ? 'DESCONECTADO' : 'ALL',
                    bairro.key
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 hover:bg-secondary px-2.5 py-1 text-[11px] font-semibold transition-colors"
              >
                <span className="truncate max-w-[115px]">{bairro.label}</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                  {bairro.internetOk}
                </span>
                {bairro.desconectados > 0 && (
                  <span className="text-rose-600 dark:text-rose-400 font-bold font-mono">
                    • {bairro.desconectados} off
                  </span>
                )}
                {bairro.bloqueados > 0 && (
                  <span className="text-amber-600 dark:text-amber-400 inline-flex items-center gap-0.5 font-mono">
                    • <Lock className="w-2.5 h-2.5" />
                    {bairro.bloqueados}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                Internet OK
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                Bloqueados
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                Sem Internet
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] text-primary font-semibold gap-1 px-2"
              onClick={() => aoNavegarRegiao('DESCONECTADO')}
            >
              Mapa completo
              <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/** Wrapper combinado mantido para retrocompatibilidade. */
export const NetworkHealthCharts: React.FC<PropsGraficosSaudeRede> = (props) => (
  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
    <div className="lg:col-span-5">
      <ClientStatusDonutCard {...props} />
    </div>
    <div className="lg:col-span-7">
      <NeighborhoodHealthBarCard {...props} />
    </div>
  </div>
);

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  PowerOff,
  Radio,
  RefreshCw,
  Server,
  Signal,
  Thermometer,
  Zap,
} from 'lucide-react';
import { smartOltService } from '@/services/smartolt/smartOltService';
import type { SmartOltOpticalRadarResponse } from '@/types/smartOlt';

// Cache em memória de 3 min para navegação instantânea ao voltar ao Dashboard
const CACHE_TTL_MS = 3 * 60 * 1000;
let cachedRadarSnapshot: {
  data: SmartOltOpticalRadarResponse;
  fetchedAt: number;
} | null = null;

type OltChartMode = 'onus' | 'temperature';

interface StatusSlice {
  key: string;
  label: string;
  value: number;
  color: string;
  badgeClass: string;
  description: string;
}

interface OltChartRow {
  id: string;
  name: string;
  shortName: string;
  hardware: string;
  ip: string;
  uptime: string;
  tempLabel: string;
  tempValue: number | null;
  voltage: number | null;
  online: number;
  los: number;
  powerFail: number;
  offline: number;
  total: number;
  onlineRate: number;
}

function parseTempCelsius(raw?: string): number | null {
  if (!raw) return null;
  const match = String(raw).match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const num = Number(match[0].replace(',', '.'));
  return Number.isFinite(num) ? num : null;
}

function shortenOltName(name: string): string {
  const cleaned = name
    .replace(/^ZTE-Turbi[\s-]*/i, '')
    .replace(/^OLT[\s-]*/i, '')
    .trim();
  const base = cleaned || name;
  return base.length > 14 ? `${base.slice(0, 13)}…` : base;
}

function getTempColor(temp: number | null): string {
  if (temp === null) return '#64748b';
  if (temp >= 40) return '#f43f5e';
  if (temp >= 35) return '#f59e0b';
  return '#10b981';
}

/** Gráficos executivos da saúde óptica SmartOLT (ONUs, OLTs, sinal crítico e temperatura). */
export const SmartOltHealthCharts: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<SmartOltOpticalRadarResponse | null>(() => {
    if (cachedRadarSnapshot && Date.now() - cachedRadarSnapshot.fetchedAt < CACHE_TTL_MS) {
      return cachedRadarSnapshot.data;
    }
    return null;
  });
  const [loading, setLoading] = useState<boolean>(!data);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(() =>
    cachedRadarSnapshot ? new Date(cachedRadarSnapshot.fetchedAt) : null
  );
  const [chartMode, setChartMode] = useState<OltChartMode>('onus');

  const loadSmartOltData = useCallback(async (forceFresh = false) => {
    if (!forceFresh && cachedRadarSnapshot && Date.now() - cachedRadarSnapshot.fetchedAt < CACHE_TTL_MS) {
      setData(cachedRadarSnapshot.data);
      setLastUpdated(new Date(cachedRadarSnapshot.fetchedAt));
      setLoading(false);
      return;
    }

    if (forceFresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setErrorMsg(null);

    try {
      const res = await smartOltService.getOpticalRadar({
        threshold: -26,
        limit: 15,
        fresh: forceFresh,
      });
      const now = Date.now();
      cachedRadarSnapshot = { data: res, fetchedAt: now };
      setData(res);
      setLastUpdated(new Date(now));
    } catch (err) {
      console.error('Erro ao carregar saúde SmartOLT no Dashboard:', err);
      setErrorMsg('Não foi possível consultar o SmartOLT agora.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSmartOltData(false);
  }, [loadSmartOltData]);

  const summary = data?.summary;

  const statusSlices = useMemo<StatusSlice[]>(() => {
    if (!summary) return [];
    return [
      {
        key: 'online',
        label: 'ONTs Online',
        value: summary.online,
        color: '#10b981',
        badgeClass:
          'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
        description:
          summary.criticalSignal > 0
            ? `${summary.criticalSignal} com sinal ≤ -26 dBm (preventivo)`
            : 'Fibra sincronizada nas OLTs',
      },
      {
        key: 'los',
        label: 'LOS (Sem Sinal)',
        value: summary.los,
        color: '#f43f5e',
        badgeClass:
          'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
        description: 'Perda de luz óptica / possível fibra rompida',
      },
      {
        key: 'power_fail',
        label: 'Power Fail (Energia)',
        value: summary.powerFail,
        color: '#f59e0b',
        badgeClass:
          'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
        description: 'ONT desligada ou sem energia na residência',
      },
      {
        key: 'offline',
        label: 'Offline',
        value: summary.offline,
        color: '#64748b',
        badgeClass:
          'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
        description: 'Sem resposta na porta PON',
      },
    ];
  }, [summary]);

  const totalOnus = summary?.total ?? 0;
  const onlinePercent =
    totalOnus > 0 ? Math.round(((summary?.online ?? 0) / totalOnus) * 1000) / 10 : 0;

  const oltRows = useMemo<OltChartRow[]>(() => {
    if (!data?.olts) return [];
    return data.olts
      .map((olt) => {
        const c = olt.onu_counts || {
          total: 0,
          online: 0,
          los: 0,
          powerFail: 0,
          offline: 0,
        };
        const tempVal = parseTempCelsius(olt.temperature);
        return {
          id: olt.id,
          name: olt.name,
          shortName: shortenOltName(olt.name),
          hardware: olt.hardware_version || 'OLT',
          ip: olt.ip || '',
          uptime: olt.uptime || 'N/A',
          tempLabel: olt.temperature || 'N/D',
          tempValue: tempVal,
          voltage: olt.voltage ?? null,
          online: c.online,
          los: c.los,
          powerFail: c.powerFail,
          offline: c.offline,
          total: c.total,
          onlineRate: c.total > 0 ? Math.round((c.online / c.total) * 1000) / 10 : 0,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [data]);

  const tempChartRows = useMemo(
    () => oltRows.filter((o) => o.tempValue !== null),
    [oltRows]
  );

  const warmOltsCount = useMemo(
    () => oltRows.filter((o) => o.tempValue !== null && o.tempValue >= 40).length,
    [oltRows]
  );

  const openOpticalRadar = () => navigate('/ispfy/inteligencia?tab=optical');

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-64 rounded-lg" />
          <Skeleton className="h-8 w-36 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-5 h-[360px] animate-pulse bg-card/60" />
          <Card className="lg:col-span-7 h-[360px] animate-pulse bg-card/60" />
        </div>
      </div>
    );
  }

  return (
    <section id="sec-smartolt" className="space-y-4 scroll-mt-20">
      {/* Cabeçalho Padronizado Nível 02 */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-1 border-b border-border/60">
        <div className="flex items-start gap-3 min-w-0">
          <span className="inline-flex items-center justify-center h-7 px-2 rounded-lg bg-indigo-500/12 border border-indigo-500/25 text-[11px] font-black font-mono text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
            02
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-extrabold tracking-tight text-foreground flex items-center gap-2 flex-wrap">
              <Radio className="w-4 h-4 text-indigo-500 shrink-0" />
              Camada Óptica &amp; Saúde das OLTs (SmartOLT)
              {summary && (
                <Badge
                  variant="outline"
                  className="text-[10px] font-mono bg-primary/10 text-primary border-primary/25"
                >
                  {summary.total.toLocaleString('pt-BR')} ONTs • {oltRows.length} OLTs
                </Badge>
              )}
              {warmOltsCount > 0 && (
                <Badge
                  variant="destructive"
                  className="text-[10px] gap-1"
                  title="OLT com temperatura ambiente igual ou superior a 40°C"
                >
                  <Thermometer className="w-3 h-3" />
                  {warmOltsCount} OLT ≥ 40°C
                </Badge>
              )}
              {(summary?.unconfigured ?? 0) > 0 && (
                <Badge
                  variant="outline"
                  onClick={openOpticalRadar}
                  className="text-[10px] cursor-pointer bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30 hover:bg-sky-500/25"
                >
                  {summary?.unconfigured} p/ autorizar
                </Badge>
              )}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Causa raiz física em tempo real: fibra rompida (LOS), falta de energia (Power Fail), sinal RX crítico e temperatura das OLTs
              {lastUpdated ? ` • ${lastUpdated.toLocaleTimeString('pt-BR')}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadSmartOltData(true)}
            disabled={refreshing}
            className="h-8 text-xs gap-1.5 rounded-xl"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar OLT
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={openOpticalRadar}
            className="h-8 text-xs gap-1.5 rounded-xl font-semibold"
          >
            Radar Óptico
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {errorMsg && !data ? (
        <Card className="border-rose-500/30 bg-rose-500/5">
          <CardContent className="p-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-sm text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <Button size="sm" variant="outline" onClick={() => loadSmartOltData(true)}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Linha de Gráficos Recharts (12 colunas — alturas alinhadas pixel a pixel) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Gráfico 1: Donut de Status Óptico das ONTs */}
            <Card className="lg:col-span-5 h-full border-border shadow-sm bg-card flex flex-col">
              <CardHeader className="px-5 py-4 border-b border-border/60">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                      <Signal className="w-4 h-4 text-emerald-500 shrink-0" />
                      Saúde das ONTs na Fibra
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Separa fibra rompida (LOS) de falta de energia (Power Fail)
                    </CardDescription>
                  </div>
                  {(summary?.criticalSignal ?? 0) > 0 && (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30 shrink-0"
                    >
                      {summary?.criticalSignal} RX crítico
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-5 flex-1 flex flex-col justify-between gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center my-auto">
                  {/* Donut */}
                  <div className="sm:col-span-5 h-[215px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusSlices}
                          dataKey="value"
                          nameKey="label"
                          cx="50%"
                          cy="50%"
                          innerRadius={56}
                          outerRadius={82}
                          paddingAngle={3}
                          strokeWidth={0}
                          onClick={openOpticalRadar}
                          className="cursor-pointer"
                        >
                          {statusSlices.map((slice) => (
                            <Cell key={slice.key} fill={slice.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || !payload.length) return null;
                            const item = payload[0].payload as StatusSlice;
                            const pct =
                              totalOnus > 0
                                ? ((item.value / totalOnus) * 100).toFixed(1)
                                : '0.0';
                            return (
                              <div className="rounded-xl border border-border bg-popover px-3 py-2 shadow-lg text-xs">
                                <p className="font-bold text-foreground">{item.label}</p>
                                <p className="text-muted-foreground font-mono">
                                  {item.value.toLocaleString('pt-BR')} ONTs ({pct}%)
                                </p>
                              </div>
                            );
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>

                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-2xl font-black text-foreground tabular-nums">
                        {onlinePercent}%
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Fibra OK
                      </span>
                    </div>
                  </div>

                  {/* Legenda detalhada */}
                  <div className="sm:col-span-7 space-y-2">
                    {statusSlices.map((slice) => {
                      const pct =
                        totalOnus > 0
                          ? Math.round((slice.value / totalOnus) * 1000) / 10
                          : 0;
                      return (
                        <button
                          key={slice.key}
                          type="button"
                          onClick={openOpticalRadar}
                          className="w-full text-left p-2 rounded-xl border border-border/70 hover:border-primary/40 hover:bg-secondary/40 transition-all"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: slice.color }}
                              />
                              <span className="text-xs font-bold text-foreground truncate">
                                {slice.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-extrabold tabular-nums ${slice.badgeClass}`}
                              >
                                {slice.value.toLocaleString('pt-BR')}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground tabular-nums w-9 text-right">
                                {pct}%
                              </span>
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                            {slice.description}
                          </p>
                          <Progress value={pct} className="h-1 mt-1 bg-secondary" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Gráfico 2: Comparativo por OLT (ONUs empilhadas OU Temperatura °C) */}
            <Card className="lg:col-span-7 h-full border-border shadow-sm bg-card flex flex-col">
              <CardHeader className="px-5 py-4 border-b border-border/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                      {chartMode === 'onus' ? (
                        <Server className="w-4 h-4 text-indigo-500 shrink-0" />
                      ) : (
                        <Thermometer className="w-4 h-4 text-amber-500 shrink-0" />
                      )}
                      {chartMode === 'onus'
                        ? 'Distribuição de ONTs por OLT'
                        : 'Temperatura Ambiente das OLTs (°C)'}
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      {chartMode === 'onus'
                        ? 'Volume de clientes Online, Power Fail, LOS e Offline em cada OLT'
                        : 'Monitoramento térmico em tempo real (alerta vermelho a partir de 40°C)'}
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg self-start sm:self-auto shrink-0">
                    <Button
                      variant={chartMode === 'onus' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-7 text-[11px] px-2.5 gap-1"
                      onClick={() => setChartMode('onus')}
                    >
                      <Activity className="w-3 h-3" />
                      ONUs / OLT
                    </Button>
                    <Button
                      variant={chartMode === 'temperature' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-7 text-[11px] px-2.5 gap-1"
                      onClick={() => setChartMode('temperature')}
                    >
                      <Thermometer className="w-3 h-3" />
                      Temperatura
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-5 flex-1 flex flex-col justify-between gap-3">
                <div className="h-[245px] w-full">
                  {chartMode === 'onus' ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={oltRows}
                        margin={{ top: 8, right: 12, left: -8, bottom: 4 }}
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
                            const row = payload[0].payload as OltChartRow;
                            return (
                              <div className="rounded-xl border border-border bg-popover p-3 shadow-xl text-xs space-y-1.5">
                                <p className="font-bold text-foreground">
                                  {row.name} ({row.total.toLocaleString('pt-BR')} ONTs)
                                </p>
                                <p className="text-[10px] font-mono text-muted-foreground">
                                  {row.hardware} • Temp: {row.tempLabel}
                                  {row.voltage ? ` • ${row.voltage.toFixed(1)}V` : ''}
                                </p>
                                <div className="space-y-0.5 pt-1 border-t border-border/60 font-mono">
                                  <p className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                    Online: {row.online} ({row.onlineRate}%)
                                  </p>
                                  <p className="text-rose-600 dark:text-rose-400 font-semibold">
                                    LOS (Fibra): {row.los}
                                  </p>
                                  <p className="text-amber-600 dark:text-amber-400 font-semibold">
                                    Power Fail: {row.powerFail}
                                  </p>
                                  <p className="text-slate-500 font-semibold">
                                    Offline: {row.offline}
                                  </p>
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Bar
                          dataKey="online"
                          stackId="olt"
                          name="Online"
                          fill="#10b981"
                          onClick={openOpticalRadar}
                          className="cursor-pointer"
                        />
                        <Bar
                          dataKey="powerFail"
                          stackId="olt"
                          name="Power Fail"
                          fill="#f59e0b"
                          onClick={openOpticalRadar}
                          className="cursor-pointer"
                        />
                        <Bar
                          dataKey="los"
                          stackId="olt"
                          name="LOS"
                          fill="#f43f5e"
                          onClick={openOpticalRadar}
                          className="cursor-pointer"
                        />
                        <Bar
                          dataKey="offline"
                          stackId="olt"
                          name="Offline"
                          fill="#64748b"
                          radius={[4, 4, 0, 0]}
                          onClick={openOpticalRadar}
                          className="cursor-pointer"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : tempChartRows.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={tempChartRows}
                        margin={{ top: 12, right: 16, left: -12, bottom: 4 }}
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
                          domain={[0, 55]}
                          unit="°C"
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <ReferenceLine
                          y={40}
                          stroke="#f43f5e"
                          strokeDasharray="4 4"
                          label={{
                            value: 'Limite 40°C',
                            position: 'insideTopRight',
                            fill: '#f43f5e',
                            fontSize: 10,
                          }}
                        />
                        <Tooltip
                          cursor={{ fill: 'hsl(var(--muted) / 0.35)' }}
                          content={({ active, payload }) => {
                            if (!active || !payload || !payload.length) return null;
                            const row = payload[0].payload as OltChartRow;
                            return (
                              <div className="rounded-xl border border-border bg-popover p-3 shadow-xl text-xs space-y-1">
                                <p className="font-bold text-foreground">{row.name}</p>
                                <p className="font-mono font-bold text-foreground">
                                  Temperatura: {row.tempLabel}
                                </p>
                                <p className="text-[11px] text-muted-foreground font-mono">
                                  Tensão: {row.voltage ? `${row.voltage.toFixed(2)}V` : 'N/D'}
                                </p>
                                <p className="text-[11px] text-muted-foreground font-mono">
                                  Uptime: {row.uptime}
                                </p>
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="tempValue" name="Temperatura (°C)" radius={[6, 6, 0, 0]} maxBarSize={56}>
                          {tempChartRows.map((row) => (
                            <Cell key={row.id} fill={getTempColor(row.tempValue)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                      Sem leitura de temperatura disponível nas OLTs.
                    </div>
                  )}
                </div>

                {/* Legenda compacta */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground border-t border-border/50">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                      Online
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                      Power Fail
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                      LOS (Fibra)
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-slate-500" />
                      Offline
                    </span>
                  </div>
                  <span className="font-mono text-[10px]">
                    Clique em uma barra para abrir o Radar Óptico
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Faixa Ergonômica de Hardware das OLTs (Temperatura + Voltagem + Uptime + Barra Óptica) */}
          {oltRows.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {oltRows.map((olt) => {
                const isHot = olt.tempValue !== null && olt.tempValue >= 40;
                const isWarm = olt.tempValue !== null && olt.tempValue >= 35 && olt.tempValue < 40;
                const pctOn = olt.total > 0 ? (olt.online / olt.total) * 100 : 0;
                const pctPwr = olt.total > 0 ? (olt.powerFail / olt.total) * 100 : 0;
                const pctLos = olt.total > 0 ? (olt.los / olt.total) * 100 : 0;
                const pctOff = olt.total > 0 ? (olt.offline / olt.total) * 100 : 0;

                return (
                  <button
                    key={olt.id}
                    type="button"
                    onClick={openOpticalRadar}
                    className={`text-left p-3.5 rounded-xl border transition-all hover:shadow-md flex flex-col justify-between gap-2 ${
                      isHot
                        ? 'border-rose-500/40 bg-rose-500/5 hover:border-rose-500/70'
                        : isWarm
                        ? 'border-amber-500/35 bg-amber-500/5 hover:border-amber-500/60'
                        : 'border-border bg-card hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate" title={olt.name}>
                          {olt.name}
                        </p>
                        <p className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">
                          {olt.hardware} • {olt.ip || 'IP N/D'}
                        </p>
                      </div>
                      {olt.tempValue !== null ? (
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 inline-flex items-center gap-0.5 ${
                            isHot
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                              : isWarm
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          <Thermometer className="w-2.5 h-2.5" />
                          {olt.tempLabel}
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                          {olt.total} ONTs
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Zap className="w-3 h-3 text-sky-500" />
                        {olt.voltage ? `${olt.voltage.toFixed(1)}V` : 'Tensão N/D'}
                      </span>
                      <span className="truncate max-w-[115px]" title={olt.uptime}>
                        Up: {olt.uptime !== 'N/A' ? olt.uptime.split(',')[0] : 'N/A'}
                      </span>
                    </div>

                    {olt.total > 0 ? (
                      <div className="space-y-1.5 pt-1 border-t border-border/50">
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden flex">
                          <div className="bg-emerald-500 h-full" style={{ width: `${pctOn}%` }} />
                          <div className="bg-amber-500 h-full" style={{ width: `${pctPwr}%` }} />
                          <div className="bg-rose-500 h-full" style={{ width: `${pctLos}%` }} />
                          <div className="bg-slate-400 h-full" style={{ width: `${pctOff}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            {olt.online} ON ({olt.onlineRate}%)
                          </span>
                          <span className="text-rose-500 font-semibold">{olt.los} LOS</span>
                          <span className="text-amber-500 inline-flex items-center gap-0.5">
                            <PowerOff className="w-2.5 h-2.5" />
                            {olt.powerFail}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground pt-1 border-t border-border/50">
                        Sem ONTs provisionadas nesta OLT
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
};

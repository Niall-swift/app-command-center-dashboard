import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Calendar,
  ExternalLink,
  FileWarning,
  Lock,
  Phone,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import type {
  ISPFYOverdueAnalyticsResult,
  ISPFYOverdueDueDayGroup,
} from '@/types/ispfy';
import { formatCurrencyBRL, openWhatsAppChat } from '@/lib/utils';
import { formatDate } from '@/utils/date';

interface OverdueDueDaySectionProps {
  overdueData: ISPFYOverdueAnalyticsResult | null;
  loading: boolean;
  onRefresh: () => void;
}

type OverdueChartView = 'by_due_day' | 'by_exact_date' | 'table';

export const OverdueDueDaySection: React.FC<OverdueDueDaySectionProps> = ({
  overdueData,
  loading,
  onRefresh,
}) => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<OverdueChartView>('by_due_day');
  const [selectedDueDayModal, setSelectedDueDayModal] =
    useState<ISPFYOverdueDueDayGroup | null>(null);
  const [modalSearch, setModalSearch] = useState('');

  const modalClients = useMemo(() => {
    if (!overdueData || !selectedDueDayModal) return [];
    const base = overdueData.clientes.filter(
      (c) => c.diaVencimento === selectedDueDayModal.diaVencimento
    );
    const q = modalSearch.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        c.bairro.toLowerCase().includes(q) ||
        c.telefone.toLowerCase().includes(q)
    );
  }, [overdueData, selectedDueDayModal, modalSearch]);

  const handleOpenDueDayModal = (group: ISPFYOverdueDueDayGroup) => {
    setModalSearch('');
    setSelectedDueDayModal(group);
  };

  if (loading && !overdueData) {
    return (
      <Card className="border-border shadow-sm bg-card h-[410px] animate-pulse" />
    );
  }

  return (
    <>
      <Card className="border-border shadow-sm bg-card">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-500" />
                Clientes em Atraso por Vencimento
              </CardTitle>
              <CardDescription className="text-xs">
                Veja quantos clientes estão inadimplentes em cada dia de vencimento (ainda liberados vs. já bloqueados) — clique na barra para listar os clientes
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg">
                <Button
                  variant={viewMode === 'by_due_day' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-[11px] px-2.5"
                  onClick={() => setViewMode('by_due_day')}
                >
                  Por Dia (01–25)
                </Button>
                <Button
                  variant={viewMode === 'by_exact_date' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-[11px] px-2.5"
                  onClick={() => setViewMode('by_exact_date')}
                >
                  Por Data Exata
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-[11px] px-2.5"
                  onClick={() => setViewMode('table')}
                >
                  Resumo Lista
                </Button>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={onRefresh}
                disabled={loading}
                title="Atualizar inadimplência no ISPFY"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
                />
              </Button>
            </div>
          </div>

          {/* Métricas resumo de atrasos */}
          {overdueData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3">
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
                  Clientes em Atraso
                </span>
                <span className="text-lg font-black text-foreground tabular-nums">
                  {overdueData.totalClientesEmAtraso}
                </span>
                <span className="text-[11px] text-muted-foreground ml-1.5">
                  ({overdueData.taxaGeralInadimplencia}%)
                </span>
              </div>

              <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 block">
                  Atraso (Liberados)
                </span>
                <span className="text-lg font-black text-sky-600 dark:text-sky-400 tabular-nums">
                  {overdueData.totalClientesAtrasoLiberados}
                </span>
                <span className="text-[11px] text-muted-foreground ml-1.5">
                  c/ aviso ou carência
                </span>
              </div>

              <div className="rounded-xl border border-rose-500/25 bg-rose-500/5 px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 block">
                  Já Bloqueados
                </span>
                <span className="text-lg font-black text-rose-600 dark:text-rose-400 tabular-nums">
                  {overdueData.totalClientesAtrasoBloqueados}
                </span>
                <span className="text-[11px] text-muted-foreground ml-1.5">
                  bloqueio financeiro
                </span>
              </div>

              <div className="rounded-xl border border-border bg-secondary/40 px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Valor Vencido ({overdueData.totalFaturasEmAtraso} fat.)
                </span>
                <span className="text-base sm:text-lg font-black text-foreground tabular-nums">
                  {formatCurrencyBRL(overdueData.valorTotalAtraso)}
                </span>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="pt-4">
          {!overdueData ? (
            <p className="text-xs text-muted-foreground text-center py-10">
              Não foi possível carregar os dados de cobrança.
            </p>
          ) : viewMode === 'by_due_day' ? (
            <div className="space-y-3">
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={overdueData.porDiaVencimento}
                    margin={{ top: 22, right: 12, left: -12, bottom: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="label"
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
                        const d = payload[0].payload as ISPFYOverdueDueDayGroup;
                        return (
                          <div className="rounded-xl border border-border bg-popover p-3 shadow-xl text-xs space-y-1.5">
                            <p className="font-bold text-foreground">
                              Vencimento {d.label}
                            </p>
                            <p className="text-muted-foreground">
                              Base ativa neste vencimento:{' '}
                              <strong className="text-foreground">
                                {d.totalBaseAtiva} clientes
                              </strong>
                            </p>
                            <p className="text-amber-600 dark:text-amber-400 font-semibold">
                              Em atraso: {d.clientesEmAtraso} clientes (
                              {d.taxaInadimplencia}%)
                            </p>
                            <p className="text-sky-600 dark:text-sky-400">
                              • Ainda liberados: {d.clientesAtrasoLiberados}
                            </p>
                            <p className="text-rose-600 dark:text-rose-400">
                              • Já bloqueados: {d.clientesAtrasoBloqueados}
                            </p>
                            <p className="text-muted-foreground pt-1 border-t border-border/60">
                              {d.faturasEmAtraso} faturas •{' '}
                              <strong className="text-foreground">
                                {formatCurrencyBRL(d.valorTotalAtraso)}
                              </strong>
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Bar
                      dataKey="clientesAtrasoLiberados"
                      stackId="due"
                      name="Em atraso (Liberados)"
                      fill="#f59e0b"
                      className="cursor-pointer"
                      onClick={(barData: any) => {
                        const target = barData?.payload ?? barData;
                        if (target?.diaVencimento) handleOpenDueDayModal(target);
                      }}
                    />
                    <Bar
                      dataKey="clientesAtrasoBloqueados"
                      stackId="due"
                      name="Em atraso (Bloqueados)"
                      fill="#f43f5e"
                      radius={[4, 4, 0, 0]}
                      className="cursor-pointer"
                      onClick={(barData: any) => {
                        const target = barData?.payload ?? barData;
                        if (target?.diaVencimento) handleOpenDueDayModal(target);
                      }}
                    >
                      <LabelList
                        dataKey="clientesEmAtraso"
                        position="top"
                        fill="hsl(var(--foreground))"
                        fontSize={11}
                        fontWeight={700}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Botões rápidos por dia de vencimento */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {overdueData.porDiaVencimento.map((g) => (
                  <button
                    type="button"
                    key={g.diaVencimento}
                    onClick={() => handleOpenDueDayModal(g)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 hover:bg-secondary px-2.5 py-1 text-[11px] font-semibold transition-colors"
                  >
                    <span>{g.label}:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      {g.clientesEmAtraso}
                    </span>
                    <span className="text-muted-foreground">
                      /{g.totalBaseAtiva} ({g.taxaInadimplencia}%)
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : viewMode === 'by_exact_date' ? (
            <div className="h-[275px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={overdueData.porDataVencimento}
                  margin={{ top: 22, right: 12, left: -12, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
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
                      const d = payload[0].payload;
                      return (
                        <div className="rounded-xl border border-border bg-popover p-3 shadow-xl text-xs space-y-1">
                          <p className="font-bold text-foreground">
                            Vencimento {d.label}
                          </p>
                          <p className="text-amber-600 dark:text-amber-400 font-semibold">
                            Clientes em atraso: {d.clientesEmAtraso}
                          </p>
                          <p className="text-sky-600 dark:text-sky-400">
                            • Liberados: {d.clientesAtrasoLiberados}
                          </p>
                          <p className="text-rose-600 dark:text-rose-400">
                            • Bloqueados: {d.clientesAtrasoBloqueados}
                          </p>
                          <p className="text-muted-foreground">
                            Total vencido: {formatCurrencyBRL(d.valorTotalAtraso)}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="clientesAtrasoLiberados"
                    stackId="exact"
                    fill="#f59e0b"
                  />
                  <Bar
                    dataKey="clientesAtrasoBloqueados"
                    stackId="exact"
                    fill="#f43f5e"
                    radius={[4, 4, 0, 0]}
                  >
                    <LabelList
                      dataKey="clientesEmAtraso"
                      position="top"
                      fill="hsl(var(--foreground))"
                      fontSize={11}
                      fontWeight={700}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="divide-y divide-border/70 border border-border rounded-xl overflow-hidden">
              {overdueData.porDiaVencimento.map((g) => (
                <div
                  key={g.diaVencimento}
                  className="p-3 flex flex-wrap items-center justify-between gap-2 hover:bg-secondary/30 transition-colors text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-[140px]">
                    <Badge variant="secondary" className="font-bold">
                      {g.label}
                    </Badge>
                    <span className="text-muted-foreground">
                      Base: <strong className="text-foreground">{g.totalBaseAtiva}</strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10"
                    >
                      {g.clientesEmAtraso} em atraso ({g.taxaInadimplencia}%)
                    </Badge>
                    <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      {g.clientesAtrasoBloqueados} bloq
                    </span>
                    <span className="font-bold text-foreground min-w-[90px] text-right">
                      {formatCurrencyBRL(g.valorTotalAtraso)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => handleOpenDueDayModal(g)}
                      disabled={g.clientesEmAtraso === 0}
                    >
                      <Users className="w-3 h-3 mr-1" />
                      Ver lista
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal para listar clientes em atraso do dia de vencimento clicado */}
      <Dialog
        open={Boolean(selectedDueDayModal)}
        onOpenChange={(open) => !open && setSelectedDueDayModal(null)}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileWarning className="w-5 h-5 text-amber-500" />
              Clientes em Atraso — Vencimento {selectedDueDayModal?.label}
            </DialogTitle>
            <DialogDescription>
              {selectedDueDayModal?.clientesEmAtraso} clientes em atraso (
              {selectedDueDayModal?.faturasEmAtraso} faturas •{' '}
              {formatCurrencyBRL(selectedDueDayModal?.valorTotalAtraso || 0)})
            </DialogDescription>
          </DialogHeader>

          <div className="relative my-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            <Input
              placeholder="Buscar por nome, bairro ou telefone..."
              value={modalSearch}
              onChange={(e) => setModalSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border/70 border border-border rounded-xl">
            {modalClients.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                Nenhum cliente encontrado neste vencimento.
              </p>
            ) : (
              modalClients.map((cli) => (
                <div
                  key={`${cli.clienteId}-${cli.diaVencimento}`}
                  className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-secondary/30"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground">
                        {cli.nome}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          cli.isBlocked
                            ? 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                            : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {cli.isBlocked ? 'Bloqueado' : 'Atraso (Liberado)'}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {cli.bairro || 'Bairro N/I'}
                      {cli.rua ? ` • ${cli.rua}` : ''} • Mais antigo:{' '}
                      {formatDate(cli.vencimentoMaisAntigo)} (
                      {cli.diasMaxAtraso}d atraso)
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right mr-1">
                      <span className="font-bold text-foreground block">
                        {formatCurrencyBRL(cli.valorTotalAtraso)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {cli.faturasEmAtraso} fatura(s)
                      </span>
                    </div>
                    {cli.telefone && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-emerald-600"
                        onClick={() => openWhatsAppChat(cli.telefone)}
                        title="Cobrar / falar no WhatsApp"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 text-indigo-600"
                      onClick={() => {
                        setSelectedDueDayModal(null);
                        navigate(`/ispfy/cliente/${cli.clienteId}`);
                      }}
                      title="Abrir ficha do cliente no ISPFY"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

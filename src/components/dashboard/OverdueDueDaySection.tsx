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
import { abrirConversaWhatsApp, formatarMoedaBRL } from '@/lib/utils';
import { formatDate } from '@/utils/date';

interface PropsSecaoInadimplencia {
  dadosInadimplencia: ISPFYOverdueAnalyticsResult | null;
  carregando: boolean;
  aoAtualizar: () => void;
}

type ModoVisualizacaoAtrasos = 'por_dia' | 'por_data' | 'lista';

interface PayloadCliqueBarra {
  payload?: ISPFYOverdueDueDayGroup;
  diaVencimento?: string;
}

/** Gráficos e listagem de clientes inadimplentes agrupados por dia ou data de vencimento. */
export const OverdueDueDaySection: React.FC<PropsSecaoInadimplencia> = ({
  dadosInadimplencia,
  carregando,
  aoAtualizar,
}) => {
  const navegar = useNavigate();
  const [modoVisualizacao, setModoVisualizacao] =
    useState<ModoVisualizacaoAtrasos>('por_dia');
  const [grupoDiaSelecionadoModal, setGrupoDiaSelecionadoModal] =
    useState<ISPFYOverdueDueDayGroup | null>(null);
  const [buscaModal, setBuscaModal] = useState('');

  const clientesFiltradosModal = useMemo(() => {
    if (!dadosInadimplencia || !grupoDiaSelecionadoModal) return [];
    const base = dadosInadimplencia.clientes.filter(
      (cliente) =>
        cliente.diaVencimento === grupoDiaSelecionadoModal.diaVencimento
    );
    const termo = buscaModal.trim().toLowerCase();
    if (!termo) return base;
    return base.filter(
      (cliente) =>
        cliente.nome.toLowerCase().includes(termo) ||
        cliente.bairro.toLowerCase().includes(termo) ||
        cliente.telefone.toLowerCase().includes(termo)
    );
  }, [dadosInadimplencia, grupoDiaSelecionadoModal, buscaModal]);

  const aoAbrirModalDia = (grupo: ISPFYOverdueDueDayGroup) => {
    setBuscaModal('');
    setGrupoDiaSelecionadoModal(grupo);
  };

  const aoClicarBarraDia = (dadosBarra: PayloadCliqueBarra) => {
    const alvo = (dadosBarra?.payload ?? dadosBarra) as ISPFYOverdueDueDayGroup;
    if (alvo?.diaVencimento) {
      aoAbrirModalDia(alvo);
    }
  };

  if (carregando && !dadosInadimplencia) {
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
                  variant={modoVisualizacao === 'por_dia' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-[11px] px-2.5"
                  onClick={() => setModoVisualizacao('por_dia')}
                >
                  Por Dia (01–25)
                </Button>
                <Button
                  variant={
                    modoVisualizacao === 'por_data' ? 'default' : 'ghost'
                  }
                  size="sm"
                  className="h-7 text-[11px] px-2.5"
                  onClick={() => setModoVisualizacao('por_data')}
                >
                  Por Data Exata
                </Button>
                <Button
                  variant={modoVisualizacao === 'lista' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-[11px] px-2.5"
                  onClick={() => setModoVisualizacao('lista')}
                >
                  Resumo Lista
                </Button>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={aoAtualizar}
                disabled={carregando}
                title="Atualizar inadimplência no ISPFY"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`}
                />
              </Button>
            </div>
          </div>

          {/* Métricas resumo de atrasos */}
          {dadosInadimplencia && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3">
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
                  Clientes em Atraso
                </span>
                <span className="text-lg font-black text-foreground tabular-nums">
                  {dadosInadimplencia.totalClientesEmAtraso}
                </span>
                <span className="text-[11px] text-muted-foreground ml-1.5">
                  ({dadosInadimplencia.taxaGeralInadimplencia}%)
                </span>
              </div>

              <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 block">
                  Atraso (Liberados)
                </span>
                <span className="text-lg font-black text-sky-600 dark:text-sky-400 tabular-nums">
                  {dadosInadimplencia.totalClientesAtrasoLiberados}
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
                  {dadosInadimplencia.totalClientesAtrasoBloqueados}
                </span>
                <span className="text-[11px] text-muted-foreground ml-1.5">
                  bloqueio financeiro
                </span>
              </div>

              <div className="rounded-xl border border-border bg-secondary/40 px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Valor Vencido ({dadosInadimplencia.totalFaturasEmAtraso} fat.)
                </span>
                <span className="text-base sm:text-lg font-black text-foreground tabular-nums">
                  {formatarMoedaBRL(dadosInadimplencia.valorTotalAtraso)}
                </span>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="pt-4">
          {!dadosInadimplencia ? (
            <p className="text-xs text-muted-foreground text-center py-10">
              Não foi possível carregar os dados de cobrança.
            </p>
          ) : modoVisualizacao === 'por_dia' ? (
            <div className="space-y-3">
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dadosInadimplencia.porDiaVencimento}
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
                        const grupo = payload[0]
                          .payload as ISPFYOverdueDueDayGroup;
                        return (
                          <div className="rounded-xl border border-border bg-popover p-3 shadow-xl text-xs space-y-1.5">
                            <p className="font-bold text-foreground">
                              Vencimento {grupo.label}
                            </p>
                            <p className="text-muted-foreground">
                              Base ativa neste vencimento:{' '}
                              <strong className="text-foreground">
                                {grupo.totalBaseAtiva} clientes
                              </strong>
                            </p>
                            <p className="text-amber-600 dark:text-amber-400 font-semibold">
                              Em atraso: {grupo.clientesEmAtraso} clientes (
                              {grupo.taxaInadimplencia}%)
                            </p>
                            <p className="text-sky-600 dark:text-sky-400">
                              • Ainda liberados: {grupo.clientesAtrasoLiberados}
                            </p>
                            <p className="text-rose-600 dark:text-rose-400">
                              • Já bloqueados: {grupo.clientesAtrasoBloqueados}
                            </p>
                            <p className="text-muted-foreground pt-1 border-t border-border/60">
                              {grupo.faturasEmAtraso} faturas •{' '}
                              <strong className="text-foreground">
                                {formatarMoedaBRL(grupo.valorTotalAtraso)}
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
                      onClick={aoClicarBarraDia}
                    />
                    <Bar
                      dataKey="clientesAtrasoBloqueados"
                      stackId="due"
                      name="Em atraso (Bloqueados)"
                      fill="#f43f5e"
                      radius={[4, 4, 0, 0]}
                      className="cursor-pointer"
                      onClick={aoClicarBarraDia}
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
                {dadosInadimplencia.porDiaVencimento.map((grupo) => (
                  <button
                    type="button"
                    key={grupo.diaVencimento}
                    onClick={() => aoAbrirModalDia(grupo)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 hover:bg-secondary px-2.5 py-1 text-[11px] font-semibold transition-colors"
                  >
                    <span>{grupo.label}:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      {grupo.clientesEmAtraso}
                    </span>
                    <span className="text-muted-foreground">
                      /{grupo.totalBaseAtiva} ({grupo.taxaInadimplencia}%)
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : modoVisualizacao === 'por_data' ? (
            <div className="h-[275px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dadosInadimplencia.porDataVencimento}
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
                      const grupoData = payload[0].payload;
                      return (
                        <div className="rounded-xl border border-border bg-popover p-3 shadow-xl text-xs space-y-1">
                          <p className="font-bold text-foreground">
                            Vencimento {grupoData.label}
                          </p>
                          <p className="text-amber-600 dark:text-amber-400 font-semibold">
                            Clientes em atraso: {grupoData.clientesEmAtraso}
                          </p>
                          <p className="text-sky-600 dark:text-sky-400">
                            • Liberados: {grupoData.clientesAtrasoLiberados}
                          </p>
                          <p className="text-rose-600 dark:text-rose-400">
                            • Bloqueados: {grupoData.clientesAtrasoBloqueados}
                          </p>
                          <p className="text-muted-foreground">
                            Total vencido:{' '}
                            {formatarMoedaBRL(grupoData.valorTotalAtraso)}
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
              {dadosInadimplencia.porDiaVencimento.map((grupo) => (
                <div
                  key={grupo.diaVencimento}
                  className="p-3 flex flex-wrap items-center justify-between gap-2 hover:bg-secondary/30 transition-colors text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-[140px]">
                    <Badge variant="secondary" className="font-bold">
                      {grupo.label}
                    </Badge>
                    <span className="text-muted-foreground">
                      Base:{' '}
                      <strong className="text-foreground">
                        {grupo.totalBaseAtiva}
                      </strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10"
                    >
                      {grupo.clientesEmAtraso} em atraso (
                      {grupo.taxaInadimplencia}%)
                    </Badge>
                    <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      {grupo.clientesAtrasoBloqueados} bloq
                    </span>
                    <span className="font-bold text-foreground min-w-[90px] text-right">
                      {formatarMoedaBRL(grupo.valorTotalAtraso)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => aoAbrirModalDia(grupo)}
                      disabled={grupo.clientesEmAtraso === 0}
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
        open={Boolean(grupoDiaSelecionadoModal)}
        onOpenChange={(aberto) => !aberto && setGrupoDiaSelecionadoModal(null)}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileWarning className="w-5 h-5 text-amber-500" />
              Clientes em Atraso — Vencimento{' '}
              {grupoDiaSelecionadoModal?.label}
            </DialogTitle>
            <DialogDescription>
              {grupoDiaSelecionadoModal?.clientesEmAtraso} clientes em atraso (
              {grupoDiaSelecionadoModal?.faturasEmAtraso} faturas •{' '}
              {formatarMoedaBRL(
                grupoDiaSelecionadoModal?.valorTotalAtraso || 0
              )}
              )
            </DialogDescription>
          </DialogHeader>

          <div className="relative my-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            <Input
              placeholder="Buscar por nome, bairro ou telefone..."
              value={buscaModal}
              onChange={(evento) => setBuscaModal(evento.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border/70 border border-border rounded-xl">
            {clientesFiltradosModal.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                Nenhum cliente encontrado neste vencimento.
              </p>
            ) : (
              clientesFiltradosModal.map((cliente) => (
                <div
                  key={`${cliente.clienteId}-${cliente.diaVencimento}`}
                  className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-secondary/30"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground">
                        {cliente.nome}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          cliente.isBlocked
                            ? 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                            : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {cliente.isBlocked ? 'Bloqueado' : 'Atraso (Liberado)'}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {cliente.bairro || 'Bairro N/I'}
                      {cliente.rua ? ` • ${cliente.rua}` : ''} • Mais antigo:{' '}
                      {formatDate(cliente.vencimentoMaisAntigo)} (
                      {cliente.diasMaxAtraso}d atraso)
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right mr-1">
                      <span className="font-bold text-foreground block">
                        {formatarMoedaBRL(cliente.valorTotalAtraso)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {cliente.faturasEmAtraso} fatura(s)
                      </span>
                    </div>
                    {cliente.telefone && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-emerald-600"
                        onClick={() => abrirConversaWhatsApp(cliente.telefone)}
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
                        setGrupoDiaSelecionadoModal(null);
                        navegar(`/ispfy/cliente/${cliente.clienteId}`);
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

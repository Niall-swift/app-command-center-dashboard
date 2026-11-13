import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FilterX,
  Lock,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  Search,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import { ispfyService } from '@/services/ispfy/ispfyService';
import {
  aggregateRegionSummaries,
  classifyPointConnectionHealth,
  normalizeAsciiUpper,
} from '@/services/ispfy/regionAuditHelpers';
import type {
  ISPFYClientRegionRecord,
  ISPFYClientsByRegionResult,
  ISPFYConnectionHealthStatus,
  ISPFYRegionGroupSummary,
  ISPFYStreetGroupSummary,
} from '@/types/ispfy';
import { toast } from 'sonner';

type StatusFilter = 'ALL' | 'OK' | 'DESCONECTADO' | 'BLOQUEADO' | 'INATIVO';
type SummarySortMode = 'disconnected' | 'volume' | 'alpha';

const PAGE_SIZE = 50;

function matchesStatusFilter(
  health: ISPFYConnectionHealthStatus,
  filter: StatusFilter
): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'OK') return health === 'ok';
  if (filter === 'DESCONECTADO') return health === 'desconectado';
  if (filter === 'BLOQUEADO') {
    return health === 'bloqueado_online' || health === 'bloqueado_offline';
  }
  return health === 'inativo';
}

function sortRegionItems<T extends ISPFYRegionGroupSummary>(
  items: T[],
  mode: SummarySortMode
): T[] {
  const copy = [...items];
  if (mode === 'disconnected') {
    return copy.sort(
      (a, b) =>
        b.desconectados - a.desconectados ||
        b.totalPontos - a.totalPontos ||
        a.label.localeCompare(b.label, 'pt-BR')
    );
  }
  if (mode === 'alpha') {
    return copy.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }
  return copy.sort(
    (a, b) => b.totalPontos - a.totalPontos || a.label.localeCompare(b.label, 'pt-BR')
  );
}

function formatDocument(doc: string = ''): string {
  const clean = doc.replace(/\D/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return doc || '-';
}

function formatDateTime(value?: string): string {
  if (!value) return '-';
  const cleaned = value.replace('T', ' ').replace(/\.\d+Z?$/, '').replace(/Z$/, '');
  const [datePart, timePart] = cleaned.split(' ');
  const [y, m, d] = (datePart || '').split('-');
  if (y && m && d) {
    return timePart ? `${d}/${m}/${y} ${timePart.slice(0, 5)}` : `${d}/${m}/${y}`;
  }
  return value;
}

function formatMB(kbytes?: number): string {
  if (kbytes === undefined || isNaN(kbytes)) return '';
  if (kbytes >= 1024 * 1024) return `${(kbytes / (1024 * 1024)).toFixed(2)} GB`;
  if (kbytes >= 1024) return `${(kbytes / 1024).toFixed(1)} MB`;
  return `${kbytes} KB`;
}

export default function ISPFYClientesRegiao() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [progressMsg, setProgressMsg] = useState<string>(
    'Carregando clientes e conexões do ISPFY...'
  );
  const [data, setData] = useState<ISPFYClientsByRegionResult | null>(null);

  // Filtros
  const [selectedBairro, setSelectedBairro] = useState<string>('ALL');
  const [selectedStreetComposite, setSelectedStreetComposite] =
    useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [includeInactive, setIncludeInactive] = useState<boolean>(false);
  const [summarySort, setSummarySort] = useState<SummarySortMode>('disconnected');
  const [page, setPage] = useState<number>(1);
  const [checkingClientId, setCheckingClientId] = useState<string | null>(null);

  const loadData = async (forceRefresh = false) => {
    setLoading(true);
    setProgressMsg('Consultando base de clientes e status PPPoE no ISPFY...');
    try {
      const result = await ispfyService.getClientsByRegionAndStatus(
        (msg) => setProgressMsg(msg),
        forceRefresh
      );
      setData(result);
      toast.success(
        `${result.totals.totalAtivos} pontos ativos carregados (${result.bairros.length} bairros)!`
      );
    } catch (error: any) {
      console.error('Erro ao carregar clientes por bairro/rua:', error);
      toast.error(
        'Erro ao consultar dados no ISPFY: ' +
          (error?.message || 'Falha de comunicação')
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, []);

  // Ao mudar o bairro, limpa a seleção de rua se ela não pertence ao bairro escolhido
  const handleSelectBairro = (bairroKey: string) => {
    setSelectedBairro(bairroKey);
    if (
      bairroKey !== 'ALL' &&
      selectedStreetComposite !== 'ALL' &&
      !selectedStreetComposite.startsWith(`${bairroKey}::`)
    ) {
      setSelectedStreetComposite('ALL');
    }
    setPage(1);
  };

  const handleSelectStreet = (street: ISPFYStreetGroupSummary) => {
    if (selectedStreetComposite === street.key) {
      setSelectedStreetComposite('ALL');
    } else {
      setSelectedBairro(street.bairroKey);
      setSelectedStreetComposite(street.key);
    }
    setPage(1);
  };

  const handleClearFilters = () => {
    setSelectedBairro('ALL');
    setSelectedStreetComposite('ALL');
    setStatusFilter('ALL');
    setSearchTerm('');
    setPage(1);
  };

  const hasActiveFilters =
    selectedBairro !== 'ALL' ||
    selectedStreetComposite !== 'ALL' ||
    statusFilter !== 'ALL' ||
    searchTerm.trim() !== '';

  // Base respeitando o toggle "Incluir cancelados/inativos"
  const activeScopedRecords = useMemo(() => {
    if (!data) return [];
    return includeInactive
      ? data.records
      : data.records.filter((r) => r.isContractActive);
  }, [data, includeInactive]);

  // Busca textual isolada (para manter as contagens consistentes entre os painéis e os selects)
  const searchMatchedRecords = useMemo(() => {
    const q = normalizeAsciiUpper(searchTerm);
    const qDigits = searchTerm.replace(/\D/g, '');
    if (!q && !qDigits) return activeScopedRecords;

    return activeScopedRecords.filter((rec) => {
      const hay = normalizeAsciiUpper(
        `${rec.nome} ${rec.ruaLabel} ${rec.numero} ${rec.complemento} ${rec.bairroLabel} ${rec.cidade} ${rec.usuarioPppoe} ${rec.ipAlocado} ${rec.mac} ${rec.plano}`
      );
      if (q && hay.includes(q)) return true;
      if (qDigits.length > 0) {
        const cpfDigits = rec.cpfCnpj.replace(/\D/g, '');
        const telDigits = rec.telefone.replace(/\D/g, '');
        if (
          cpfDigits.includes(qDigits) ||
          telDigits.includes(qDigits) ||
          rec.clienteId.includes(qDigits) ||
          rec.pontoId.includes(qDigits)
        ) {
          return true;
        }
      }
      return false;
    });
  }, [activeScopedRecords, searchTerm]);

  // Agregação por Bairro/Rua sobre a base filtrada por busca + toggle ativo
  const baseAggregated = useMemo(
    () => aggregateRegionSummaries(searchMatchedRecords),
    [searchMatchedRecords]
  );

  // Recorte Bairro + Rua antes do filtro de Status (para calcular os contadores dos botões de Status)
  const locationScopedRecords = useMemo(() => {
    return searchMatchedRecords.filter((rec) => {
      if (selectedBairro !== 'ALL' && rec.bairroKey !== selectedBairro) {
        return false;
      }
      if (
        selectedStreetComposite !== 'ALL' &&
        `${rec.bairroKey}::${rec.ruaKey}` !== selectedStreetComposite
      ) {
        return false;
      }
      return true;
    });
  }, [searchMatchedRecords, selectedBairro, selectedStreetComposite]);

  const locationSummary = useMemo(
    () => aggregateRegionSummaries(locationScopedRecords),
    [locationScopedRecords]
  );

  // Registros finais na tabela (Bairro + Rua + Busca + Status)
  const filteredRecords = useMemo(() => {
    const list =
      statusFilter === 'ALL'
        ? locationScopedRecords
        : locationScopedRecords.filter((rec) =>
            matchesStatusFilter(rec.connectionHealth, statusFilter)
          );

    // Prioriza desconectados no topo para agilizar diagnóstico de campo
    const priority: Record<ISPFYConnectionHealthStatus, number> = {
      desconectado: 0,
      bloqueado_offline: 1,
      bloqueado_online: 2,
      ok: 3,
      inativo: 4,
    };

    return [...list].sort(
      (a, b) =>
        priority[a.connectionHealth] - priority[b.connectionHealth] ||
        a.bairroLabel.localeCompare(b.bairroLabel, 'pt-BR') ||
        a.ruaLabel.localeCompare(b.ruaLabel, 'pt-BR') ||
        a.nome.localeCompare(b.nome, 'pt-BR')
    );
  }, [locationScopedRecords, statusFilter]);

  const finalSummary = useMemo(
    () => aggregateRegionSummaries(filteredRecords),
    [filteredRecords]
  );

  // Listas para os dropdowns e cards laterais
  const bairrosForCards = useMemo(
    () => sortRegionItems(baseAggregated.bairros, summarySort),
    [baseAggregated.bairros, summarySort]
  );

  const streetsInScope = useMemo(() => {
    const list =
      selectedBairro === 'ALL'
        ? baseAggregated.ruas
        : baseAggregated.ruas.filter((r) => r.bairroKey === selectedBairro);
    return sortRegionItems(list, summarySort);
  }, [baseAggregated.ruas, selectedBairro, summarySort]);

  // Paginação da tabela
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedRecords = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredRecords.slice(start, start + PAGE_SIZE);
  }, [filteredRecords, safePage]);

  // Consulta individual ao vivo no ISPFY (/api/tool/assinante/ponto/status)
  const handleVerifyLiveClient = async (record: ISPFYClientRegionRecord) => {
    if (!record.clienteId) return;
    setCheckingClientId(record.pontoId);
    try {
      const liveStatuses = await ispfyService.getClientLivePointStatuses(
        record.clienteId
      );
      const match =
        liveStatuses.find((s) => s.idPonto === record.pontoId) ||
        liveStatuses[0];

      if (!match) {
        toast.info(`Ponto #${record.pontoId} não retornou sessão ativa no ISPFY.`);
        return;
      }

      setData((prev) => {
        if (!prev) return prev;
        const updatedRecords = prev.records.map((item) => {
          if (item.pontoId !== record.pontoId) return item;

          const health = classifyPointConnectionHealth({
            contratoAtivo: item.isContractActive ? 's' : 'n',
            pontoAtivo: item.isContractActive ? 's' : 'n',
            statusContrato: match.isBlocked ? 'bloqueado' : 'livre',
            sessaoConexaoStatus: match.conexaoStatus,
            bloqueadoFlag: match.isBlocked,
          });

          return {
            ...item,
            sessaoConexaoStatus: match.conexaoStatus,
            ipAlocado: match.ipWan || item.ipAlocado,
            ipv6Alocado: match.ipv6Wan || item.ipv6Alocado,
            ultimoLogin: match.ultimoLogin || item.ultimoLogin,
            plano: match.planoNome || item.plano,
            uploadMesKbytes: match.uploadMesKbytes,
            downloadMesKbytes: match.downloadMesKbytes,
            ...health,
          };
        });

        const updatedActive = updatedRecords.filter((r) => r.isContractActive);
        const aggregated = aggregateRegionSummaries(updatedActive);
        return {
          ...prev,
          records: updatedRecords,
          bairros: aggregated.bairros,
          ruas: aggregated.ruas,
          totals: {
            ...aggregated.totals,
            totalPontos: updatedRecords.length,
            inativos: updatedRecords.length - updatedActive.length,
          },
        };
      });

      const statusText = match.isBlocked
        ? `Bloqueado (${match.conexaoStatus.toUpperCase()})`
        : match.conexaoStatus === 'online'
        ? 'Internet OK (ONLINE)'
        : `Desconectado (${match.conexaoStatus.toUpperCase()})`;
      toast.success(`${record.nome}: ${statusText}`);
    } catch (error: any) {
      toast.error(
        'Não foi possível verificar o ponto ao vivo: ' +
          (error?.message || 'Erro de API')
      );
    } finally {
      setCheckingClientId(null);
    }
  };

  const openWhatsApp = (phone?: string) => {
    const clean = (phone || '').replace(/\D/g, '');
    if (!clean) return;
    const target = clean.startsWith('55') ? clean : `55${clean}`;
    window.open(`https://wa.me/${target}`, '_blank');
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const handleExportCSV = () => {
    if (filteredRecords.length === 0) return;

    const statusLabelMap: Record<ISPFYConnectionHealthStatus, string> = {
      ok: 'Internet OK (Online)',
      desconectado: 'Desconectado (Offline)',
      bloqueado_online: 'Bloqueado (Pool Bloqueio Online)',
      bloqueado_offline: 'Bloqueado (Offline)',
      inativo: 'Contrato Inativo/Cancelado',
    };

    let csv = '\uFEFF';
    csv += `RELATÓRIO DE CLIENTES POR BAIRRO / RUA E CONEXÃO - AVL TELECOM\n`;
    csv += `Gerado em:;${new Date().toLocaleString('pt-BR')}\n`;
    csv += `Bairro Filtro:;${selectedBairro === 'ALL' ? 'Todos' : (data?.bairros.find(b => b.key === selectedBairro)?.label || selectedBairro)}\n`;
    csv += `Total no Filtro:;${filteredRecords.length}\n`;
    csv += `Internet OK:;${finalSummary.totals.internetOk};Desconectados:;${finalSummary.totals.desconectados};Bloqueados:;${finalSummary.totals.bloqueados}\n\n`;
    csv += `ID Cliente;ID Ponto;Cliente;CPF/CNPJ;Telefone;Bairro;Rua/Logradouro;Número;Complemento;Cidade;Plano;Login PPPoE;Status Internet;Sessão;IP WAN;MAC;Último Login\n`;

    filteredRecords.forEach((r) => {
      csv += `${r.clienteId};${r.pontoId};"${r.nome}";"${formatDocument(r.cpfCnpj)}";"${r.telefone || '-'}";"${r.bairroLabel}";"${r.ruaLabel}";"${r.numero || '-'}";"${r.complemento || '-'}";"${r.cidade || '-'}";"${r.plano || '-'}";"${r.usuarioPppoe || '-'}";"${statusLabelMap[r.connectionHealth]}";"${r.sessaoConexaoStatus}";"${r.ipAlocado || '-'}";"${r.mac || '-'}";"${r.ultimoLogin || '-'}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `clientes_regiao_conexao_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exportados ${filteredRecords.length} registros para CSV!`);
  };

  const activeScopeOnlineRate = useMemo(() => {
    const activeCount = locationSummary.totals.totalAtivos;
    if (activeCount <= 0) return 0;
    return Math.round((locationSummary.totals.internetOk / activeCount) * 1000) / 10;
  }, [locationSummary]);

  const renderConnectionBadge = (rec: ISPFYClientRegionRecord) => {
    switch (rec.connectionHealth) {
      case 'ok':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[11px] gap-1 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Internet OK
          </Badge>
        );
      case 'desconectado':
        return (
          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-[11px] gap-1 font-semibold">
            <WifiOff className="w-3 h-3" />
            Desconectado ({rec.sessaoConexaoStatus === 'none' ? 'Sem sessão' : rec.sessaoConexaoStatus})
          </Badge>
        );
      case 'bloqueado_online':
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[11px] gap-1 font-semibold">
            <Lock className="w-3 h-3" />
            Bloqueado (Online)
          </Badge>
        );
      case 'bloqueado_offline':
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[11px] gap-1 font-semibold">
            <Lock className="w-3 h-3" />
            Bloqueado (Off)
          </Badge>
        );
      case 'inativo':
        return (
          <Badge variant="secondary" className="text-[11px] gap-1">
            Contrato Inativo
          </Badge>
        );
    }
  };

  return (
    <PageTransition>
      <div className="space-y-6 text-foreground pb-12">
        {/* ── Header Hero ────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-6 border border-blue-500/20 shadow-xl"
        >
          <div className="absolute -right-24 -top-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-24 -bottom-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-300 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-400/20">
                  <MapPin className="w-3.5 h-3.5" />
                  Monitoramento Territorial &amp; Conexão
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-400/20">
                  <Activity className="w-3.5 h-3.5" />
                  ISPFY em Tempo Real
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Clientes por Bairro, Rua &amp; Status da Internet
              </h1>
              <p className="text-slate-300 text-sm max-w-2xl">
                Separe os assinantes por bairro, endereço ou rua, acompanhe a quantidade exata em cada recorte e identifique rapidamente quem está com a internet OK ou desconectado.
              </p>
              {data?.fetchedAt && (
                <p className="text-xs text-slate-400 flex items-center gap-1.5 pt-1">
                  <Clock className="w-3.5 h-3.5 text-blue-300" />
                  Última leitura completa: {formatDateTime(data.fetchedAt)} •{' '}
                  {data.totals.totalAtivos} pontos ativos em {data.bairros.length} bairros e{' '}
                  {data.ruas.length} ruas
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadData(true)}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-500 border-blue-400 text-white text-xs h-9"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`}
                />
                Atualizar Conexões
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                disabled={loading || filteredRecords.length === 0}
                className="bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white text-xs h-9"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Exportar Filtro ({filteredRecords.length})
              </Button>
            </div>
          </div>

          {loading && (
            <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-3">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-400 border-t-transparent" />
              <span className="text-xs text-blue-200 font-medium">{progressMsg}</span>
            </div>
          )}
        </motion.div>

        {/* ── 4 KPIs do Recorte Selecionado ───────────────────────── */}
        {data && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-blue-500/20 bg-gradient-to-br from-blue-50/50 via-white to-blue-50/20 dark:from-blue-950/20 dark:via-slate-900 dark:to-blue-950/10 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                  Clientes no Filtro
                </CardTitle>
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400">
                  <Users className="w-5 h-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">
                  {finalSummary.totals.totalPontos}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {finalSummary.totals.totalClientesUnicos} assinantes únicos •{' '}
                  {hasActiveFilters ? 'Recorte aplicado' : 'Base completa'}
                </p>
              </CardContent>
            </Card>

            <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-50/50 via-white to-emerald-50/20 dark:from-emerald-950/20 dark:via-slate-900 dark:to-emerald-950/10 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Internet OK (Online)
                </CardTitle>
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400">
                  <Wifi className="w-5 h-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  {locationSummary.totals.internetOk}
                </div>
                <div className="mt-1.5 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    <strong>{activeScopeOnlineRate}%</strong> dos pontos ativos do recorte conectados
                  </p>
                  <Progress
                    value={activeScopeOnlineRate}
                    className="h-1.5 bg-emerald-500/15 [&>div]:bg-emerald-500"
                  />
                </div>
              </CardContent>
            </Card>

            <Card
              className={`border-rose-500/30 bg-gradient-to-br from-rose-50/60 via-white to-rose-50/20 dark:from-rose-950/25 dark:via-slate-900 dark:to-rose-950/10 shadow-sm ${
                locationSummary.totals.desconectados > 0
                  ? 'ring-1 ring-rose-500/20'
                  : ''
              }`}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                  Desconectados
                </CardTitle>
                <div className="p-2 bg-rose-500/10 rounded-lg text-rose-600 dark:text-rose-400">
                  <WifiOff className="w-5 h-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-rose-600 dark:text-rose-400">
                  {locationSummary.totals.desconectados}
                </div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  {locationSummary.totals.desconectados > 0 ? (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      Contratos ativos offline (sem bloqueio)
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      Nenhuma queda detectada no recorte
                    </>
                  )}
                </p>
              </CardContent>
            </Card>

            <Card className="border-amber-500/20 bg-gradient-to-br from-amber-50/50 via-white to-amber-50/20 dark:from-amber-950/20 dark:via-slate-900 dark:to-amber-950/10 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Bloqueados (Financeiro)
                </CardTitle>
                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
                  <Lock className="w-5 h-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">
                  {locationSummary.totals.bloqueados}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {locationSummary.totals.bloqueadosOnline} online em pool bloqueio •{' '}
                  {locationSummary.totals.bloqueadosOffline} offline
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Barra de Filtros: Bairro, Rua, Busca e Status ───────── */}
        <Card className="p-4 bg-card/70 backdrop-blur-md border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Filtro de Bairro */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">
                Filtrar por Bairro ({baseAggregated.bairros.length})
              </Label>
              <Select value={selectedBairro} onValueChange={handleSelectBairro}>
                <SelectTrigger className="h-10 text-xs">
                  <SelectValue placeholder="Todos os Bairros" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">
                    Todos os Bairros ({baseAggregated.totals.totalPontos} clientes)
                  </SelectItem>
                  {sortRegionItems(baseAggregated.bairros, 'volume').map((b) => (
                    <SelectItem key={b.key} value={b.key}>
                      {b.label} — {b.totalPontos} ({b.internetOk} ok • {b.desconectados} off)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro de Rua / Logradouro */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">
                Filtrar por Rua / Endereço ({streetsInScope.length})
              </Label>
              <Select
                value={selectedStreetComposite}
                onValueChange={(val) => {
                  if (val === 'ALL') {
                    setSelectedStreetComposite('ALL');
                  } else {
                    const match = baseAggregated.ruas.find((r) => r.key === val);
                    if (match) {
                      setSelectedBairro(match.bairroKey);
                      setSelectedStreetComposite(match.key);
                    }
                  }
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-10 text-xs">
                  <SelectValue placeholder="Todas as Ruas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">
                    Todas as Ruas ({streetsInScope.length} logradouros)
                  </SelectItem>
                  {sortRegionItems(streetsInScope, 'volume').map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                      {selectedBairro === 'ALL' ? ` (${s.bairroLabel})` : ''} — {s.totalPontos}{' '}
                      ({s.desconectados} off)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Busca Textual */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">
                Buscar endereço, número, nome, PPPoE ou IP
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Ex: Rua Coelho, casa, joao, 100.64..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 h-10 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Linha 2: Pills de Status + Controles */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant={statusFilter === 'ALL' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setStatusFilter('ALL');
                  setPage(1);
                }}
                className="h-8 text-xs"
              >
                Todos ({locationSummary.totals.totalPontos})
              </Button>
              <Button
                variant={statusFilter === 'OK' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setStatusFilter('OK');
                  setPage(1);
                }}
                className={`h-8 text-xs ${
                  statusFilter === 'OK'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                }`}
              >
                <Wifi className="w-3.5 h-3.5 mr-1.5" />
                Internet OK ({locationSummary.totals.internetOk})
              </Button>
              <Button
                variant={statusFilter === 'DESCONECTADO' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setStatusFilter('DESCONECTADO');
                  setPage(1);
                }}
                className={`h-8 text-xs ${
                  statusFilter === 'DESCONECTADO'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'text-rose-700 dark:text-rose-300 border-rose-500/30'
                }`}
              >
                <WifiOff className="w-3.5 h-3.5 mr-1.5" />
                Desconectados ({locationSummary.totals.desconectados})
              </Button>
              <Button
                variant={statusFilter === 'BLOQUEADO' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setStatusFilter('BLOQUEADO');
                  setPage(1);
                }}
                className={`h-8 text-xs ${
                  statusFilter === 'BLOQUEADO'
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'text-amber-700 dark:text-amber-300 border-amber-500/30'
                }`}
              >
                <Lock className="w-3.5 h-3.5 mr-1.5" />
                Bloqueados ({locationSummary.totals.bloqueados})
              </Button>
              {includeInactive && (
                <Button
                  variant={statusFilter === 'INATIVO' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setStatusFilter('INATIVO');
                    setPage(1);
                  }}
                  className="h-8 text-xs"
                >
                  Inativos ({locationSummary.totals.inativos})
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="include-inactive"
                  checked={includeInactive}
                  onCheckedChange={(checked) => {
                    setIncludeInactive(checked);
                    if (!checked && statusFilter === 'INATIVO') {
                      setStatusFilter('ALL');
                    }
                    setPage(1);
                  }}
                />
                <Label
                  htmlFor="include-inactive"
                  className="text-xs text-muted-foreground cursor-pointer"
                >
                  Incluir inativos ({data?.totals.inativos ?? 0})
                </Label>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Ordenar grupos:</span>
                <Select
                  value={summarySort}
                  onValueChange={(v) => setSummarySort(v as SummarySortMode)}
                >
                  <SelectTrigger className="h-8 w-44 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disconnected">Mais desconectados (quedas)</SelectItem>
                    <SelectItem value="volume">Maior qtd. de clientes</SelectItem>
                    <SelectItem value="alpha">Ordem alfabética (A-Z)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-8 text-xs text-rose-600 hover:text-rose-700"
                >
                  <FilterX className="w-3.5 h-3.5 mr-1" />
                  Limpar filtros
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* ── Painel Duplo Clicável: Bairros & Ruas com Contagens ── */}
        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Bairros */}
            <Card className="border border-slate-200 dark:border-slate-800 overflow-hidden">
              <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 py-3 px-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-500" />
                      Bairros ({bairrosForCards.length})
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Clique em um bairro para filtrar seus clientes e ruas
                    </CardDescription>
                  </div>
                  {selectedBairro !== 'ALL' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSelectBairro('ALL')}
                      className="h-7 text-[11px]"
                    >
                      Ver todos
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-2 max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/70">
                {bairrosForCards.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    Nenhum bairro corresponde à busca atual.
                  </p>
                ) : (
                  bairrosForCards.map((b) => {
                    const isSelected = selectedBairro === b.key;
                    return (
                      <button
                        type="button"
                        key={b.key}
                        onClick={() =>
                          handleSelectBairro(isSelected ? 'ALL' : b.key)
                        }
                        className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-blue-500/15 ring-1 ring-blue-500/40'
                            : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs truncate">
                              {b.label}
                            </span>
                            <Badge variant="secondary" className="text-[10px] font-mono">
                              {b.totalPontos}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Progress
                              value={b.onlineRate}
                              className="h-1 flex-1 max-w-[120px] bg-slate-200 dark:bg-slate-800 [&>div]:bg-emerald-500"
                            />
                            <span className="text-[10px] text-muted-foreground">
                              {b.onlineRate}% OK
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge
                            variant="outline"
                            className="text-[10px] border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-500/5"
                          >
                            {b.internetOk} OK
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              b.desconectados > 0
                                ? 'border-rose-500/50 text-rose-700 dark:text-rose-300 bg-rose-500/10 font-bold'
                                : 'border-slate-300/60 text-muted-foreground'
                            }`}
                          >
                            {b.desconectados} off
                          </Badge>
                          {b.bloqueados > 0 && (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-amber-500/30 text-amber-700 dark:text-amber-300 bg-amber-500/5"
                            >
                              {b.bloqueados} bloq
                            </Badge>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* Ruas / Endereços */}
            <Card className="border border-slate-200 dark:border-slate-800 overflow-hidden">
              <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 py-3 px-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Navigation className="w-4 h-4 text-indigo-500" />
                      Ruas / Logradouros ({streetsInScope.length})
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {selectedBairro === 'ALL'
                        ? 'Mostrando ruas de toda a rede — clique para isolar uma rua'
                        : `Ruas em ${bairrosForCards.find((b) => b.key === selectedBairro)?.label || 'Bairro selecionado'}`}
                    </CardDescription>
                  </div>
                  {selectedStreetComposite !== 'ALL' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedStreetComposite('ALL');
                        setPage(1);
                      }}
                      className="h-7 text-[11px]"
                    >
                      Todas as ruas
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-2 max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/70">
                {streetsInScope.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    Nenhuma rua encontrada para os filtros aplicados.
                  </p>
                ) : (
                  streetsInScope.map((st) => {
                    const isSelected = selectedStreetComposite === st.key;
                    return (
                      <button
                        type="button"
                        key={st.key}
                        onClick={() => handleSelectStreet(st)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-indigo-500/15 ring-1 ring-indigo-500/40'
                            : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs truncate">
                              {st.label}
                            </span>
                            <Badge variant="secondary" className="text-[10px] font-mono">
                              {st.totalPontos}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                            {st.bairroLabel} • {st.onlineRate}% OK
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge
                            variant="outline"
                            className="text-[10px] border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-500/5"
                          >
                            {st.internetOk} OK
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              st.desconectados > 0
                                ? 'border-rose-500/50 text-rose-700 dark:text-rose-300 bg-rose-500/10 font-bold'
                                : 'border-slate-300/60 text-muted-foreground'
                            }`}
                          >
                            {st.desconectados} off
                          </Badge>
                          {st.bloqueados > 0 && (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-amber-500/30 text-amber-700 dark:text-amber-300 bg-amber-500/5"
                            >
                              {st.bloqueados} bloq
                            </Badge>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Tabela Detalhada de Clientes & Conexão ─────────────── */}
        <Card className="border border-slate-200 dark:border-slate-800 overflow-hidden">
          <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 pb-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Wifi className="w-5 h-5 text-blue-500" />
                  Clientes no Filtro &amp; Diagnóstico de Internet
                </CardTitle>
                <CardDescription>
                  Exibindo {paginatedRecords.length} de {filteredRecords.length} pontos encontrados (página {safePage} de {totalPages})
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-xs"
                >
                  {finalSummary.totals.internetOk} OK
                </Badge>
                <Badge
                  variant="outline"
                  className="bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30 text-xs"
                >
                  {finalSummary.totals.desconectados} Desconectados
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Cliente / Contato</TableHead>
                    <TableHead>Endereço (Rua, Nº &amp; Bairro)</TableHead>
                    <TableHead>Plano &amp; Login PPPoE</TableHead>
                    <TableHead>Status da Internet</TableHead>
                    <TableHead>Última Conexão / IP</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && !data ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-40 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                          <span>{progressMsg}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : paginatedRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        Nenhum cliente encontrado para os filtros aplicados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedRecords.map((rec) => (
                      <TableRow
                        key={rec.pontoId}
                        className={`hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition-colors ${
                          rec.connectionHealth === 'desconectado'
                            ? 'bg-rose-500/[0.03]'
                            : ''
                        }`}
                      >
                        <TableCell>
                          <div className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                            {rec.nome}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                            Cliente #{rec.clienteId || '-'} • Ponto #{rec.pontoId} •{' '}
                            {formatDocument(rec.cpfCnpj)}
                          </div>
                          {rec.telefone && (
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5 font-medium">
                              <Phone className="w-3 h-3" />
                              {rec.telefone}
                            </div>
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                            {rec.ruaLabel}
                            {rec.numero ? `, ${rec.numero}` : ''}
                          </div>
                          {rec.complemento && (
                            <div className="text-[10px] text-muted-foreground truncate max-w-[260px]">
                              {rec.complemento}
                            </div>
                          )}
                          <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium mt-0.5">
                            {rec.bairroLabel}
                            {rec.cidade ? ` • ${rec.cidade}` : ''}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                            {rec.plano || 'Não identificado'}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                            PPPoE: {rec.usuarioPppoe || '-'}
                          </div>
                          {rec.mac && (
                            <div className="text-[10px] text-muted-foreground font-mono">
                              MAC: {rec.mac}
                            </div>
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="space-y-1">
                            {renderConnectionBadge(rec)}
                            {(rec.downloadMesKbytes !== undefined ||
                              rec.uploadMesKbytes !== undefined) && (
                              <div className="text-[10px] text-muted-foreground">
                                Mês: ↓ {formatMB(rec.downloadMesKbytes)} / ↑{' '}
                                {formatMB(rec.uploadMesKbytes)}
                              </div>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="text-xs space-y-0.5">
                          <div className="font-mono text-[11px] text-slate-800 dark:text-slate-200">
                            {rec.ipAlocado ? `IP: ${rec.ipAlocado}` : 'Sem IP ativo'}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            Últ. login: {formatDateTime(rec.ultimoLogin)}
                          </div>
                          {rec.ultimoAccounting && (
                            <div className="text-[10px] text-muted-foreground">
                              Accounting: {formatDateTime(rec.ultimoAccounting)}
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                              title="Verificar conexão deste cliente agora (tempo real)"
                              disabled={checkingClientId === rec.pontoId}
                              onClick={() => handleVerifyLiveClient(rec)}
                            >
                              <RefreshCw
                                className={`w-3.5 h-3.5 ${
                                  checkingClientId === rec.pontoId ? 'animate-spin' : ''
                                }`}
                              />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Copiar endereço e dados"
                              onClick={() =>
                                handleCopy(
                                  `${rec.nome} | ${rec.enderecoCompleto} - ${rec.bairroLabel}`,
                                  'Endereço do cliente'
                                )
                              }
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                            {rec.telefone && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                title="Abrir WhatsApp"
                                onClick={() => openWhatsApp(rec.telefone)}
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {rec.clienteId && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                                title="Abrir ficha completa no ISPFY"
                                onClick={() =>
                                  navigate(`/ispfy/cliente/${rec.clienteId}`)
                                }
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Paginação */}
            {filteredRecords.length > PAGE_SIZE && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
                <span className="text-xs text-muted-foreground">
                  Página {safePage} de {totalPages} • {filteredRecords.length} clientes neste recorte
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-8 text-xs"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="h-8 text-xs"
                  >
                    Próxima
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}


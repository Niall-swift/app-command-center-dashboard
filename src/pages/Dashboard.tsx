import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useNetworkMonitor } from '@/contexts/NetworkMonitorContext';
import { NetworkHealthCharts } from '@/components/dashboard/NetworkHealthCharts';
import { OverdueDueDaySection } from '@/components/dashboard/OverdueDueDaySection';
import { RealtimeOfflinePanel } from '@/components/dashboard/RealtimeOfflinePanel';
import {
  Activity,
  ArrowRight,
  Bell,
  Bot,
  Calendar,
  ClipboardList,
  Clock,
  DollarSign,
  Download,
  FileSpreadsheet,
  Film,
  Gift,
  Hourglass,
  Lock,
  Map,
  MapPin,
  MessageSquare,
  Play,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trophy,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { collection, doc, getDoc, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';

interface RecentUser {
  id: string;
  name?: string;
  nome?: string;
  city?: string;
  cidade?: string;
  whatsapp?: string;
  telefone?: string;
  createdAt?: any;
}

interface RecentRedemption {
  id: string;
  rewardTitle?: string;
  pointsCost?: number;
  userName?: string;
  redeemedAt?: any;
  status?: string;
}

interface ActiveWatcher {
  id: string;
  userName: string;
  title: string;
  isPlaying: boolean;
  type: 'movie' | 'episode';
  seriesTitle?: string | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
}

const SECTOR_SHORTCUT_GROUPS = [
  {
    title: 'Rede & Clientes ISPFY',
    accent: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500/20',
    items: [
      { label: 'Clientes Bairro/Rua', url: '/ispfy/regiao', icon: MapPin, color: 'text-blue-500' },
      { label: 'Nova O.S.', url: '/ispfy/nova-os', icon: ClipboardList, color: 'text-emerald-500' },
      { label: 'Consulta Clientes', url: '/ispfy/consulta', icon: Users, color: 'text-indigo-500' },
      { label: 'Auditoria Base', url: '/ispfy/auditoria', icon: ShieldCheck, color: 'text-cyan-500' },
      { label: 'Tickets / O.S.', url: '/ispfy/tickets', icon: Ticket, color: 'text-amber-500' },
      { label: 'Mapa da Rede', url: '/network-map', icon: Map, color: 'text-violet-500' },
    ],
  },
  {
    title: 'Financeiro & Cobrança',
    accent: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/20',
    items: [
      { label: 'Financeiro & Caixa', url: '/ispfy/financeiro', icon: DollarSign, color: 'text-emerald-500' },
      { label: 'Vencimentos Massa', url: '/ispfy/vencimentos', icon: Calendar, color: 'text-amber-500' },
      { label: 'Robô de Carência', url: '/ispfy/carencia', icon: Clock, color: 'text-rose-500' },
      { label: 'Relatório DICI', url: '/ispfy/dici', icon: FileSpreadsheet, color: 'text-purple-500' },
      { label: 'Exportar Ativos', url: '/ispfy/exportar-ativos', icon: Download, color: 'text-sky-500' },
    ],
  },
  {
    title: 'Atendimento & Disparos',
    accent: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/20',
    items: [
      { label: 'Chat WhatsApp', url: '/chat', icon: MessageSquare, color: 'text-emerald-500' },
      { label: 'Envio em Massa', url: '/whatsapp/bulk', icon: Send, color: 'text-teal-500' },
      { label: 'Disparo Push App', url: '/notifications', icon: Bell, color: 'text-indigo-500' },
      { label: 'Automação & Bots', url: '/bots', icon: Bot, color: 'text-blue-500' },
    ],
  },
  {
    title: 'App PreMix & AVL Play',
    accent: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-500/20',
    items: [
      { label: 'Pedidos Resgate', url: '/redemption-orders', icon: Gift, color: 'text-amber-500' },
      { label: 'Sorteios PreMix', url: '/raffle', icon: Trophy, color: 'text-purple-500' },
      { label: 'Sorteios Pagos', url: '/paid-raffles', icon: Sparkles, color: 'text-pink-500' },
      { label: 'Filmes AVL Play', url: '/movies', icon: Film, color: 'text-blue-500' },
      { label: 'Métricas AVL Play', url: '/avlplay-analytics', icon: Play, color: 'text-emerald-500' },
    ],
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, userData } = useAuth();
  const {
    regionData,
    overdueData,
    loadingRegion,
    loadingOverdue,
    isPolling,
    lastUpdatedAt,
    monitorEnabled,
    pollIntervalSec,
    refreshAll,
    refreshOverdue,
  } = useNetworkMonitor();

  const [loadingPreMix, setLoadingPreMix] = useState(true);
  const [totalUsersCount, setTotalUsersCount] = useState(0);
  const [pendingRedemptionsCount, setPendingRedemptionsCount] = useState(0);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [recentRedemptions, setRecentRedemptions] = useState<RecentRedemption[]>([]);
  const [activeWatchers, setActiveWatchers] = useState<ActiveWatcher[]>([]);

  useEffect(() => {
    const unsubscribeWatchers = onSnapshot(collection(db, 'activeWatchers'), (snapshot) => {
      const now = Date.now();
      const watchersList: ActiveWatcher[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const updatedTime = data.updatedAt?.toMillis ? data.updatedAt.toMillis() : 0;
        if (now - updatedTime < 20 * 1000 && data.isPlaying) {
          watchersList.push({
            id: docSnap.id,
            ...data,
          } as ActiveWatcher);
        }
      });
      setActiveWatchers(watchersList);
    });

    const unsubscribeRedemptions = onSnapshot(collection(db, 'redeemedRewards'), async (snapshot) => {
      const allRedemptions = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          redeemedAt: data.redeemedAt?.toDate ? data.redeemedAt.toDate() : data.redeemedAt,
        };
      }) as any[];

      const pending = allRedemptions.filter((r) => r.status === 'pending');
      setPendingRedemptionsCount(pending.length);

      const recentPending = pending
        .sort((a, b) => {
          const dateA = a.redeemedAt ? new Date(a.redeemedAt).getTime() : 0;
          const dateB = b.redeemedAt ? new Date(b.redeemedAt).getTime() : 0;
          return dateB - dateA;
        })
        .slice(0, 4);

      const enriched = await Promise.all(
        recentPending.map(async (r) => {
          try {
            if (!r.userId) return r;
            const userDoc = await getDoc(doc(db, 'users', r.userId));
            if (userDoc.exists()) {
              const uData = userDoc.data();
              return { ...r, userName: uData.name || 'Usuário PreMix' };
            }
          } catch (e) {
            console.error('Erro ao buscar dados do usuário para o resgate:', e);
          }
          return r;
        })
      );

      setRecentRedemptions(enriched);
    });

    const fetchPreMixUsers = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'usuariosDoPreMix'));
        setTotalUsersCount(snapshot.size);

        const sortedUsers = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as RecentUser[];

        sortedUsers.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return timeB - timeA;
        });

        setRecentUsers(sortedUsers.slice(0, 4));
      } catch (error) {
        console.error('Erro ao buscar usuários do PreMix:', error);
      } finally {
        setLoadingPreMix(false);
      }
    };

    fetchPreMixUsers();

    return () => {
      unsubscribeWatchers();
      unsubscribeRedemptions();
    };
  }, []);

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const getAvatarBg = (initials: string) => {
    const colors = [
      'bg-blue-100 text-blue-700',
      'bg-purple-100 text-purple-700',
      'bg-emerald-100 text-emerald-700',
      'bg-indigo-100 text-indigo-700',
      'bg-pink-100 text-pink-700',
      'bg-amber-100 text-amber-700',
    ];
    let sum = 0;
    for (let i = 0; i < initials.length; i++) {
      sum += initials.charCodeAt(i);
    }
    return colors[sum % colors.length];
  };

  const handleNavigateRegion = (status?: string, bairroKey?: string) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (bairroKey) params.set('bairro', bairroKey);
    const qs = params.toString();
    navigate(qs ? `/ispfy/regiao?${qs}` : '/ispfy/regiao');
  };

  const totals = regionData?.totals;
  const activePoints = totals?.totalAtivos ?? 0;
  const okPoints = totals?.internetOk ?? 0;
  const offlinePoints = totals?.desconectados ?? 0;
  const blockedPoints = totals?.bloqueados ?? 0;
  const inactivePoints = totals?.inativos ?? 0;
  const onlinePct =
    activePoints > 0 ? Math.round((okPoints / activePoints) * 1000) / 10 : 0;

  return (
    <div className="space-y-6 text-foreground pb-10">
      {/* ── Cabeçalho Executivo & Monitor ao Vivo ── */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-5 sm:p-6 border border-blue-500/20 shadow-xl text-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-400/25">
                <span
                  className={`w-2 h-2 rounded-full ${
                    monitorEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
                  }`}
                />
                {monitorEnabled
                  ? `Monitor Global Ativo (${pollIntervalSec}s)`
                  : 'Monitor Pausado'}
              </span>
              {lastUpdatedAt && (
                <span className="text-[11px] text-slate-300 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-blue-300" />
                  Atualizado às {lastUpdatedAt.toLocaleTimeString('pt-BR')}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Olá, {userData?.name || user?.displayName || 'Usuário'}! 👋
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl">
              Visão organizada da rede ISPFY, clientes conectados vs. sem internet, inadimplência por vencimento e ferramentas operacionais.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/ispfy/regiao')}
              className="bg-white/10 hover:bg-white/20 border-white/20 text-white text-xs h-9"
            >
              <MapPin className="w-3.5 h-3.5 mr-1.5" />
              Mapa Bairro / Rua
            </Button>
            <Button
              size="sm"
              onClick={refreshAll}
              disabled={loadingRegion || isPolling}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-9"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 mr-1.5 ${
                  loadingRegion || isPolling ? 'animate-spin' : ''
                }`}
              />
              Atualizar Painel
            </Button>
          </div>
        </div>
      </div>

      {/* ── Faixa 1: 4 KPIs Executivos da Rede (Clicáveis) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card
          onClick={() => handleNavigateRegion('ALL')}
          className="cursor-pointer hover:border-blue-500/50 transition-all bg-card border-border shadow-sm relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Clientes Ativos (Pontos)
                </p>
                <h3 className="text-3xl font-black text-foreground mt-1 tabular-nums">
                  {loadingRegion && !totals ? '...' : activePoints.toLocaleString('pt-BR')}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2.5 font-medium">
              {totals?.totalClientesUnicos ?? 0} assinantes únicos • {inactivePoints} inativos
            </p>
          </CardContent>
        </Card>

        <Card
          onClick={() => handleNavigateRegion('OK')}
          className="cursor-pointer hover:border-emerald-500/50 transition-all bg-card border-border shadow-sm relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Com Internet OK
                </p>
                <h3 className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                  {loadingRegion && !totals ? '...' : okPoints.toLocaleString('pt-BR')}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <Wifi className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2.5 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <strong>{onlinePct}%</strong> da base ativa conectada agora
            </p>
          </CardContent>
        </Card>

        <Card
          onClick={() => handleNavigateRegion('DESCONECTADO')}
          className={`cursor-pointer hover:border-rose-500/60 transition-all bg-card border-border shadow-sm relative overflow-hidden ${
            offlinePoints > 0 ? 'ring-1 ring-rose-500/20' : ''
          }`}
        >
          <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Sem Internet (Quedas)
                </p>
                <h3 className="text-3xl font-black text-rose-600 dark:text-rose-400 mt-1 tabular-nums">
                  {loadingRegion && !totals ? '...' : offlinePoints.toLocaleString('pt-BR')}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <WifiOff className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2.5 font-medium">
              Contratos ativos offline sem bloqueio financeiro
            </p>
          </CardContent>
        </Card>

        <Card
          onClick={() => handleNavigateRegion('BLOQUEADO')}
          className="cursor-pointer hover:border-amber-500/50 transition-all bg-card border-border shadow-sm relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Bloqueados / Em Atraso
                </p>
                <h3 className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
                  {loadingRegion && !totals ? '...' : blockedPoints.toLocaleString('pt-BR')}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Lock className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2.5 font-medium">
              {totals?.bloqueadosOnline ?? 0} em aviso / {totals?.bloqueadosOffline ?? 0} offline
              {overdueData
                ? ` • ${overdueData.totalClientesEmAtraso} clientes c/ fatura vencida`
                : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Faixa 2: Gráficos Visuais (Status de Conexão + Saúde por Bairro) ── */}
      <NetworkHealthCharts
        regionData={regionData}
        loading={loadingRegion}
        onNavigateRegion={handleNavigateRegion}
      />

      {/* ── Faixa 3: Inadimplência por Vencimento + Alerta & Quedas em Tempo Real ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7">
          <OverdueDueDaySection
            overdueData={overdueData}
            loading={loadingOverdue}
            onRefresh={() => refreshOverdue(true)}
          />
        </div>
        <div className="xl:col-span-5">
          <RealtimeOfflinePanel />
        </div>
      </div>

      {/* ── Faixa 4: Central Organizada do Sistema & App PreMix / AVL Play ── */}
      <Card className="border-border shadow-sm bg-card">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold">
                Central Organizada do Sistema &amp; PreMix
              </CardTitle>
              <CardDescription className="text-xs">
                Todos os módulos separados por setor e acompanhamento em tempo real do aplicativo PreMix / AVL Play
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <Tabs defaultValue="shortcuts" className="w-full">
            <TabsList className="grid grid-cols-2 w-full sm:w-[440px] mb-5">
              <TabsTrigger value="shortcuts" className="text-xs font-semibold">
                Atalhos por Setor
              </TabsTrigger>
              <TabsTrigger value="premix" className="text-xs font-semibold gap-1.5">
                App PreMix &amp; AVL Play
                {pendingRedemptionsCount > 0 && (
                  <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0">
                    {pendingRedemptionsCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Aba 1: Todos os atalhos bem organizados por departamento */}
            <TabsContent value="shortcuts" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {SECTOR_SHORTCUT_GROUPS.map((group) => (
                  <div
                    key={group.title}
                    className={`rounded-xl border ${group.border} bg-secondary/20 p-3.5 space-y-2.5`}
                  >
                    <h4 className={`text-xs font-extrabold uppercase tracking-wider ${group.accent}`}>
                      {group.title}
                    </h4>
                    <div className="space-y-1.5">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.url}
                            to={item.url}
                            className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-card border border-border/60 hover:border-primary/40 hover:bg-secondary/50 transition-all group"
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <Icon className={`w-4 h-4 shrink-0 ${item.color}`} />
                              <span className="text-xs font-semibold text-foreground truncate">
                                {item.label}
                              </span>
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Aba 2: PreMix App & AVL Play (preserva integralmente os dados em tempo real) */}
            <TabsContent value="premix" className="mt-0 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-border bg-secondary/20 p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase">
                      Cadastros no App
                    </p>
                    <p className="text-2xl font-black text-foreground mt-0.5">
                      {loadingPreMix ? '...' : totalUsersCount.toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-secondary/20 p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase">
                      Resgates Pendentes
                    </p>
                    <p className="text-2xl font-black text-foreground mt-0.5">
                      {loadingPreMix ? '...' : pendingRedemptionsCount}
                    </p>
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <Hourglass className="w-4 h-4" />
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-secondary/20 p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase">
                      Assistindo Agora (AVL Play)
                    </p>
                    <p className="text-2xl font-black text-foreground mt-0.5">
                      {activeWatchers.length}
                    </p>
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <Activity className="w-4 h-4" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Novos Usuários */}
                <Card className="border-border shadow-none">
                  <CardHeader className="pb-2.5 border-b border-border/60 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-bold">Novos Usuários no App</CardTitle>
                    <Link to="/raffle">
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-primary px-2">
                        Ver Todos
                      </Button>
                    </Link>
                  </CardHeader>
                  <CardContent className="p-0 divide-y divide-border/60">
                    {loadingPreMix ? (
                      <div className="p-6 text-center text-xs text-muted-foreground">Carregando...</div>
                    ) : recentUsers.length === 0 ? (
                      <div className="p-6 text-center text-xs text-muted-foreground">Nenhum usuário recente.</div>
                    ) : (
                      recentUsers.map((u) => {
                        const userName = u.name || u.nome || 'Usuário PreMix';
                        const initials = getInitials(userName);
                        return (
                          <div key={u.id} className="p-3 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${getAvatarBg(
                                  initials
                                )}`}
                              >
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold truncate">{userName}</p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {u.cidade || u.city || 'Cidade N/I'}
                                </p>
                              </div>
                            </div>
                            <span className="text-[11px] font-semibold text-foreground shrink-0">
                              {u.whatsapp || u.telefone || '-'}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>

                {/* Resgates Pendentes */}
                <Card className="border-border shadow-none">
                  <CardHeader className="pb-2.5 border-b border-border/60 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-bold">Resgates Pendentes</CardTitle>
                    <Link to="/redemption-orders">
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-primary px-2">
                        Gerenciar
                      </Button>
                    </Link>
                  </CardHeader>
                  <CardContent className="p-0 divide-y divide-border/60">
                    {loadingPreMix ? (
                      <div className="p-6 text-center text-xs text-muted-foreground">Carregando...</div>
                    ) : recentRedemptions.length === 0 ? (
                      <div className="p-6 text-center text-xs text-emerald-600 dark:text-emerald-400">
                        Nenhum resgate pendente de aprovação.
                      </div>
                    ) : (
                      recentRedemptions.map((r) => (
                        <div key={r.id} className="p-3 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">{r.rewardTitle}</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              Por: {r.userName}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0 border-amber-500/30 text-amber-600 dark:text-amber-400">
                            {r.pointsCost} PTS
                          </Badge>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* AVL Play Online */}
                <Card className="border-border shadow-none">
                  <CardHeader className="pb-2.5 border-b border-border/60 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                      <Play className="w-3.5 h-3.5 text-emerald-500 fill-current" />
                      AVL Play Online
                    </CardTitle>
                    <Link to="/avlplay-analytics">
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-primary px-2">
                        Métricas
                      </Button>
                    </Link>
                  </CardHeader>
                  <CardContent className="p-3 space-y-2">
                    {activeWatchers.length === 0 ? (
                      <div className="py-6 text-center text-xs text-muted-foreground">
                        Ninguém assistindo no momento.
                      </div>
                    ) : (
                      activeWatchers.slice(0, 4).map((w) => (
                        <div
                          key={w.id}
                          className="p-2.5 rounded-lg border border-border/60 bg-secondary/30 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold truncate">{w.userName}</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {w.type === 'episode'
                              ? `${w.seriesTitle} (T${w.seasonNumber}E${w.episodeNumber})`
                              : w.title}
                          </p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

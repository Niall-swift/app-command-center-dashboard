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
import { Skeleton } from '@/components/ui/skeleton';
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
  Radar,
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
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/config/firebase';

interface TimestampFirestoreLike {
  toMillis?: () => number;
  toDate?: () => Date;
}

interface UsuarioRecentePreMix {
  id: string;
  name?: string;
  nome?: string;
  city?: string;
  cidade?: string;
  whatsapp?: string;
  telefone?: string;
  createdAt?: TimestampFirestoreLike | Date | string;
}

interface ResgateRecentePreMix {
  id: string;
  userId?: string;
  rewardTitle?: string;
  pointsCost?: number;
  userName?: string;
  redeemedAt?: TimestampFirestoreLike | Date | string;
  status?: string;
}

interface EspectadorAtivoPlay {
  id: string;
  userName: string;
  title: string;
  isPlaying: boolean;
  type: 'movie' | 'episode';
  seriesTitle?: string | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
}

const GRUPOS_ATALHOS_SETOR = [
  {
    titulo: 'Rede & Clientes ISPFY',
    corTitulo: 'text-blue-600 dark:text-blue-400',
    bordaGrupo: 'border-blue-500/20',
    itens: [
      { rotulo: 'Clientes Bairro/Rua', url: '/ispfy/regiao', icone: MapPin, cor: 'text-blue-500' },
      { rotulo: 'Inteligência & CTO', url: '/ispfy/inteligencia', icone: Radar, cor: 'text-violet-500' },
      { rotulo: 'Nova O.S.', url: '/ispfy/nova-os', icone: ClipboardList, cor: 'text-emerald-500' },
      { rotulo: 'Consulta Clientes', url: '/ispfy/consulta', icone: Users, cor: 'text-indigo-500' },
      { rotulo: 'Auditoria Base', url: '/ispfy/auditoria', icone: ShieldCheck, cor: 'text-cyan-500' },
      { rotulo: 'Tickets / O.S.', url: '/ispfy/tickets', icone: Ticket, cor: 'text-amber-500' },
      { rotulo: 'Mapa da Rede', url: '/network-map', icone: Map, cor: 'text-sky-500' },
    ],
  },
  {
    titulo: 'Financeiro & Cobrança',
    corTitulo: 'text-amber-600 dark:text-amber-400',
    bordaGrupo: 'border-amber-500/20',
    itens: [
      { rotulo: 'Financeiro & Caixa', url: '/ispfy/financeiro', icone: DollarSign, cor: 'text-emerald-500' },
      { rotulo: 'Vencimentos Massa', url: '/ispfy/vencimentos', icone: Calendar, cor: 'text-amber-500' },
      { rotulo: 'Robô de Carência', url: '/ispfy/carencia', icone: Clock, cor: 'text-rose-500' },
      { rotulo: 'Relatório DICI', url: '/ispfy/dici', icone: FileSpreadsheet, cor: 'text-purple-500' },
      { rotulo: 'Exportar Ativos', url: '/ispfy/exportar-ativos', icone: Download, cor: 'text-sky-500' },
    ],
  },
  {
    titulo: 'Atendimento & Disparos',
    corTitulo: 'text-emerald-600 dark:text-emerald-400',
    bordaGrupo: 'border-emerald-500/20',
    itens: [
      { rotulo: 'Chat WhatsApp', url: '/chat', icone: MessageSquare, cor: 'text-emerald-500' },
      { rotulo: 'Envio em Massa', url: '/whatsapp/bulk', icone: Send, cor: 'text-teal-500' },
      { rotulo: 'Disparo Push App', url: '/notifications', icone: Bell, cor: 'text-indigo-500' },
      { rotulo: 'Automação & Bots', url: '/bots', icone: Bot, cor: 'text-blue-500' },
    ],
  },
  {
    titulo: 'App PreMix & AVL Play',
    corTitulo: 'text-purple-600 dark:text-purple-400',
    bordaGrupo: 'border-purple-500/20',
    itens: [
      { rotulo: 'Pedidos Resgate', url: '/redemption-orders', icone: Gift, cor: 'text-amber-500' },
      { rotulo: 'Sorteios PreMix', url: '/raffle', icone: Trophy, cor: 'text-purple-500' },
      { rotulo: 'Sorteios Pagos', url: '/paid-raffles', icone: Sparkles, cor: 'text-pink-500' },
      { rotulo: 'Filmes AVL Play', url: '/movies', icone: Film, cor: 'text-blue-500' },
      { rotulo: 'Métricas AVL Play', url: '/avlplay-analytics', icone: Play, cor: 'text-emerald-500' },
    ],
  },
];

const CORES_AVATAR = [
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-emerald-100 text-emerald-700',
  'bg-indigo-100 text-indigo-700',
  'bg-pink-100 text-pink-700',
  'bg-amber-100 text-amber-700',
];

function obterIniciaisNome(nome?: string): string {
  if (!nome) return 'U';
  const partes = nome.trim().split(' ');
  if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
  return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
}

function obterCorAvatarPorIniciais(iniciais: string): string {
  let somaCodigos = 0;
  for (let indice = 0; indice < iniciais.length; indice++) {
    somaCodigos += iniciais.charCodeAt(indice);
  }
  return CORES_AVATAR[somaCodigos % CORES_AVATAR.length];
}

function extrairMilissegundos(
  valor?: TimestampFirestoreLike | Date | string
): number {
  if (!valor) return 0;
  if (typeof valor === 'object' && 'toMillis' in valor && valor.toMillis) {
    return valor.toMillis();
  }
  if (valor instanceof Date) return valor.getTime();
  const convertido = new Date(String(valor)).getTime();
  return Number.isNaN(convertido) ? 0 : convertido;
}

function obterSaudacaoHorario(): string {
  const hora = new Date().getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Painel inicial executivo com saúde da rede em tempo real, inadimplência e atalhos. */
export default function Dashboard() {
  const navegar = useNavigate();
  const { user, userData } = useAuth();
  const {
    dadosRegiao,
    dadosInadimplencia,
    carregandoRegiao,
    carregandoInadimplencia,
    verificandoAgora,
    ultimaAtualizacaoEm,
    monitorAtivo,
    intervaloVerificacaoSeg,
    atualizarTudo,
    atualizarInadimplencia,
  } = useNetworkMonitor();

  const [carregandoPreMix, setCarregandoPreMix] = useState(true);
  const [totalUsuariosPreMix, setTotalUsuariosPreMix] = useState(0);
  const [qtdResgatesPendentes, setQtdResgatesPendentes] = useState(0);
  const [usuariosRecentes, setUsuariosRecentes] = useState<
    UsuarioRecentePreMix[]
  >([]);
  const [resgatesRecentes, setResgatesRecentes] = useState<
    ResgateRecentePreMix[]
  >([]);
  const [espectadoresAtivos, setEspectadoresAtivos] = useState<
    EspectadorAtivoPlay[]
  >([]);

  useEffect(() => {
    const cancelarWatchers = onSnapshot(
      collection(db, 'activeWatchers'),
      (snapshot) => {
        const agora = Date.now();
        const listaAtivos: EspectadorAtivoPlay[] = [];
        snapshot.forEach((docSnap) => {
          const dadosDoc = docSnap.data();
          const atualizadoEmMs = dadosDoc.updatedAt?.toMillis
            ? dadosDoc.updatedAt.toMillis()
            : 0;
          if (agora - atualizadoEmMs < 20 * 1000 && dadosDoc.isPlaying) {
            listaAtivos.push({
              id: docSnap.id,
              ...dadosDoc,
            } as EspectadorAtivoPlay);
          }
        });
        setEspectadoresAtivos(listaAtivos);
      }
    );

    const cancelarResgates = onSnapshot(
      query(
        collection(db, 'redeemedRewards'),
        where('status', '==', 'pending'),
        limit(30)
      ),
      async (snapshot) => {
        const todosResgates: ResgateRecentePreMix[] = snapshot.docs.map(
          (docSnap) => {
            const dadosDoc = docSnap.data();
            return {
              id: docSnap.id,
              ...dadosDoc,
              redeemedAt: dadosDoc.redeemedAt?.toDate
                ? dadosDoc.redeemedAt.toDate()
                : dadosDoc.redeemedAt,
            } as ResgateRecentePreMix;
          }
        );

        const pendentes = todosResgates.filter(
          (resgate) => resgate.status === 'pending'
        );
        setQtdResgatesPendentes(pendentes.length);

        const pendentesRecentes = pendentes
          .sort(
            (a, b) =>
              extrairMilissegundos(b.redeemedAt) -
              extrairMilissegundos(a.redeemedAt)
          )
          .slice(0, 4);

        const resgatesEnriquecidos = await Promise.all(
          pendentesRecentes.map(async (resgate) => {
            try {
              if (!resgate.userId) return resgate;
              const docUsuario = await getDoc(doc(db, 'users', resgate.userId));
              if (docUsuario.exists()) {
                const dadosUsuario = docUsuario.data();
                return {
                  ...resgate,
                  userName: dadosUsuario.name || 'Usuário PreMix',
                };
              }
            } catch (erroBusca) {
              console.error(
                'Erro ao buscar dados do usuário para o resgate:',
                erroBusca
              );
            }
            return resgate;
          })
        );

        setResgatesRecentes(resgatesEnriquecidos);
      }
    );

    const carregarUsuariosPreMix = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'usuariosDoPreMix'));
        setTotalUsuariosPreMix(snapshot.size);

        const usuariosOrdenados = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as UsuarioRecentePreMix[];

        usuariosOrdenados.sort(
          (a, b) =>
            extrairMilissegundos(b.createdAt) -
            extrairMilissegundos(a.createdAt)
        );

        setUsuariosRecentes(usuariosOrdenados.slice(0, 4));
      } catch (erroBusca) {
        console.error('Erro ao buscar usuários do PreMix:', erroBusca);
      } finally {
        setCarregandoPreMix(false);
      }
    };

    carregarUsuariosPreMix();

    return () => {
      cancelarWatchers();
      cancelarResgates();
    };
  }, []);

  const aoNavegarRegiao = (status?: string, chaveBairro?: string) => {
    const parametros = new URLSearchParams();
    if (status) parametros.set('status', status);
    if (chaveBairro) parametros.set('bairro', chaveBairro);
    const queryString = parametros.toString();
    navegar(queryString ? `/ispfy/regiao?${queryString}` : '/ispfy/regiao');
  };

  const totaisRede = dadosRegiao?.totals;
  const pontosAtivos = totaisRede?.totalAtivos ?? 0;
  const pontosOk = totaisRede?.internetOk ?? 0;
  const pontosDesconectados = totaisRede?.desconectados ?? 0;
  const pontosBloqueados = totaisRede?.bloqueados ?? 0;
  const pontosInativos = totaisRede?.inativos ?? 0;
  const percentualOnline =
    pontosAtivos > 0 ? Math.round((pontosOk / pontosAtivos) * 1000) / 10 : 0;
  const percentualBloqueados =
    pontosAtivos > 0 ? Math.round((pontosBloqueados / pontosAtivos) * 1000) / 10 : 0;
  const percentualDesconectados =
    pontosAtivos > 0 ? Math.round((pontosDesconectados / pontosAtivos) * 1000) / 10 : 0;

  const carregandoIndicadoresRede = carregandoRegiao && !totaisRede;
  const saudacaoAtual = obterSaudacaoHorario();

  const cardsIndicadoresRede = [
    {
      statusFiltro: 'ALL',
      titulo: 'Clientes Ativos (Pontos)',
      valor: pontosAtivos.toLocaleString('pt-BR'),
      corBarra: 'bg-blue-500',
      glowBg: 'bg-blue-500',
      bordaHover: 'hover:border-blue-500/50',
      corValor: 'text-foreground',
      caixaIcone: 'bg-blue-500/12 text-blue-600 dark:text-blue-400 border border-blue-500/20',
      Icone: Users,
      rodape: (
        <p className="text-xs text-muted-foreground mt-2.5 font-medium">
          {totaisRede?.totalClientesUnicos ?? 0} assinantes únicos •{' '}
          {pontosInativos} inativos
        </p>
      ),
    },
    {
      statusFiltro: 'OK',
      titulo: 'Com Internet OK',
      valor: pontosOk.toLocaleString('pt-BR'),
      corBarra: 'bg-emerald-500',
      glowBg: 'bg-emerald-500',
      bordaHover: 'hover:border-emerald-500/50',
      corValor: 'text-emerald-600 dark:text-emerald-400',
      caixaIcone: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
      Icone: Wifi,
      rodape: (
        <p className="text-xs text-muted-foreground mt-2.5 font-medium flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <strong>{percentualOnline}%</strong> da base ativa conectada agora
        </p>
      ),
    },
    {
      statusFiltro: 'DESCONECTADO',
      titulo: 'Sem Internet (Quedas)',
      valor: pontosDesconectados.toLocaleString('pt-BR'),
      corBarra: 'bg-rose-500',
      glowBg: 'bg-rose-500',
      bordaHover: `hover:border-rose-500/60 ${
        pontosDesconectados > 0 ? 'ring-1 ring-rose-500/25' : ''
      }`,
      corValor: 'text-rose-600 dark:text-rose-400',
      caixaIcone: 'bg-rose-500/12 text-rose-600 dark:text-rose-400 border border-rose-500/20',
      Icone: WifiOff,
      rodape: (
        <p className="text-xs text-muted-foreground mt-2.5 font-medium">
          Contratos ativos offline sem bloqueio financeiro
        </p>
      ),
    },
    {
      statusFiltro: 'BLOQUEADO',
      titulo: 'Bloqueados / Em Atraso',
      valor: pontosBloqueados.toLocaleString('pt-BR'),
      corBarra: 'bg-amber-500',
      glowBg: 'bg-amber-500',
      bordaHover: 'hover:border-amber-500/50',
      corValor: 'text-amber-600 dark:text-amber-400',
      caixaIcone: 'bg-amber-500/12 text-amber-600 dark:text-amber-400 border border-amber-500/20',
      Icone: Lock,
      rodape: (
        <p className="text-xs text-muted-foreground mt-2.5 font-medium">
          {totaisRede?.bloqueadosOnline ?? 0} em aviso /{' '}
          {totaisRede?.bloqueadosOffline ?? 0} offline
          {dadosInadimplencia
            ? ` • ${dadosInadimplencia.totalClientesEmAtraso} clientes c/ fatura vencida`
            : ''}
        </p>
      ),
    },
  ];

  return (
    <div className="space-y-6 text-foreground pb-10">
      {/* ── Cabeçalho Executivo & Monitor ao Vivo ── */}
      <div className="relative overflow-hidden rounded-2xl avl-hero-mesh p-5 sm:p-6 border border-blue-500/25 shadow-2xl text-white">
        <div className="relative z-10 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-400/25">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      monitorAtivo
                        ? 'bg-emerald-400 animate-pulse'
                        : 'bg-slate-400'
                    }`}
                  />
                  {monitorAtivo
                    ? `Monitor Global Ativo (${intervaloVerificacaoSeg}s)`
                    : 'Monitor Pausado'}
                </span>
                {ultimaAtualizacaoEm && (
                  <span className="text-[11px] text-slate-300 flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3 text-blue-300" />
                    Atualizado às {ultimaAtualizacaoEm.toLocaleTimeString('pt-BR')}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                {saudacaoAtual}, {userData?.name || user?.displayName || 'Operador'}!
              </h1>
              <p className="text-slate-300 text-xs sm:text-sm max-w-2xl">
                Central executiva da rede ISPFY, saúde de conectividade em tempo real, radar de inadimplência e ações rápidas do NOC.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navegar('/ispfy/regiao')}
                className="bg-white/10 hover:bg-white/20 border-white/15 text-white text-xs h-9 rounded-xl backdrop-blur-sm"
              >
                <MapPin className="w-3.5 h-3.5 mr-1.5 text-blue-300" />
                Mapa Bairro/Rua
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navegar('/ispfy/inteligencia')}
                className="bg-white/10 hover:bg-white/20 border-white/15 text-white text-xs h-9 rounded-xl backdrop-blur-sm"
              >
                <Radar className="w-3.5 h-3.5 mr-1.5 text-violet-300" />
                Inteligência &amp; CTO
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navegar('/ispfy/nova-os')}
                className="bg-white/10 hover:bg-white/20 border-white/15 text-white text-xs h-9 rounded-xl backdrop-blur-sm hidden sm:inline-flex"
              >
                <ClipboardList className="w-3.5 h-3.5 mr-1.5 text-emerald-300" />
                Nova O.S.
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navegar('/chat')}
                className="bg-white/10 hover:bg-white/20 border-white/15 text-white text-xs h-9 rounded-xl backdrop-blur-sm hidden sm:inline-flex"
              >
                <MessageSquare className="w-3.5 h-3.5 mr-1.5 text-sky-300" />
                Chat ao Vivo
              </Button>
              <Button
                size="sm"
                onClick={atualizarTudo}
                disabled={carregandoRegiao || verificandoAgora}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-9 rounded-xl shadow-lg shadow-blue-600/30 font-semibold"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 mr-1.5 ${
                    carregandoRegiao || verificandoAgora ? 'animate-spin' : ''
                  }`}
                />
                Atualizar
              </Button>
            </div>
          </div>

          {/* Barra Segmentada de Saúde da Rede ao Vivo */}
          <div className="rounded-xl bg-white/[0.06] border border-white/10 backdrop-blur-md p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Saúde da Rede ao Vivo
                </span>
              </div>
              {carregandoIndicadoresRede ? (
                <Skeleton className="h-4 w-36 bg-white/15" />
              ) : (
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-300">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    Online:{' '}
                    <strong className="text-emerald-300 font-mono">
                      {percentualOnline}%
                    </strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    Bloqueados:{' '}
                    <strong className="text-amber-300 font-mono">
                      {percentualBloqueados}%
                    </strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                    Quedas:{' '}
                    <strong className="text-rose-300 font-mono">
                      {percentualDesconectados}%
                    </strong>
                  </span>
                </div>
              )}
            </div>

            <div className="h-2.5 w-full rounded-full bg-slate-900/70 overflow-hidden flex p-[1px] gap-[2px] border border-white/10">
              {carregandoIndicadoresRede ? (
                <div className="h-full w-full rounded-full animate-shimmer bg-white/10" />
              ) : (
                <>
                  <div
                    className="h-full rounded-l-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700"
                    style={{ width: `${Math.max(percentualOnline, 0)}%` }}
                    title={`Internet OK: ${pontosOk} (${percentualOnline}%)`}
                  />
                  <div
                    className="h-full bg-amber-400 transition-all duration-700"
                    style={{ width: `${Math.max(percentualBloqueados, 0)}%` }}
                    title={`Bloqueados: ${pontosBloqueados} (${percentualBloqueados}%)`}
                  />
                  <div
                    className="h-full rounded-r-full bg-rose-500 transition-all duration-700"
                    style={{ width: `${Math.max(percentualDesconectados, 0)}%` }}
                    title={`Sem Internet: ${pontosDesconectados} (${percentualDesconectados}%)`}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Faixa 1: 4 KPIs Executivos da Rede (Clicáveis) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cardsIndicadoresRede.map((indicador) => {
          const IconeCard = indicador.Icone;
          return (
            <Card
              key={indicador.statusFiltro}
              onClick={() => aoNavegarRegiao(indicador.statusFiltro)}
              className={`kpi-card group cursor-pointer bg-card border-border/80 relative overflow-hidden ${indicador.bordaHover}`}
            >
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl opacity-15 group-hover:opacity-30 transition-opacity ${indicador.glowBg}`}
              />
              <div
                className={`absolute top-0 left-0 w-1.5 h-full ${indicador.corBarra}`}
              />
              <CardContent className="p-5 relative z-10">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      {indicador.titulo}
                    </p>
                    {carregandoIndicadoresRede ? (
                      <Skeleton className="h-9 w-24 mt-1.5 rounded-lg" />
                    ) : (
                      <h3
                        className={`text-3xl font-black mt-1 tabular-nums tracking-tight ${indicador.corValor}`}
                      >
                        {indicador.valor}
                      </h3>
                    )}
                  </div>
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ${indicador.caixaIcone}`}
                  >
                    <IconeCard className="w-5 h-5" />
                  </div>
                </div>
                {indicador.rodape}
                <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between text-[11px] font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                  <span>Ver detalhes na região</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Faixa 2: Gráficos Visuais (Status de Conexão + Saúde por Bairro) ── */}
      <NetworkHealthCharts
        dadosRegiao={dadosRegiao}
        carregando={carregandoRegiao}
        aoNavegarRegiao={aoNavegarRegiao}
      />

      {/* ── Faixa 3: Inadimplência por Vencimento + Alerta & Quedas em Tempo Real ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7">
          <OverdueDueDaySection
            dadosInadimplencia={dadosInadimplencia}
            carregando={carregandoInadimplencia}
            aoAtualizar={() => atualizarInadimplencia(true)}
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
              <TabsTrigger
                value="premix"
                className="text-xs font-semibold gap-1.5"
              >
                App PreMix &amp; AVL Play
                {qtdResgatesPendentes > 0 && (
                  <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0">
                    {qtdResgatesPendentes}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Aba 1: Todos os atalhos bem organizados por departamento */}
            <TabsContent value="shortcuts" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {GRUPOS_ATALHOS_SETOR.map((grupo) => (
                  <div
                    key={grupo.titulo}
                    className={`rounded-xl border ${grupo.bordaGrupo} bg-secondary/20 p-3.5 space-y-2.5`}
                  >
                    <h4
                      className={`text-xs font-extrabold uppercase tracking-wider ${grupo.corTitulo}`}
                    >
                      {grupo.titulo}
                    </h4>
                    <div className="space-y-1.5">
                      {grupo.itens.map((item) => {
                        const IconeItem = item.icone;
                        return (
                          <Link
                            key={item.url}
                            to={item.url}
                            className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-card border border-border/60 hover:border-primary/40 hover:bg-secondary/50 transition-all group"
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <IconeItem
                                className={`w-4 h-4 shrink-0 ${item.cor}`}
                              />
                              <span className="text-xs font-semibold text-foreground truncate">
                                {item.rotulo}
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
                    {carregandoPreMix ? (
                      <Skeleton className="h-7 w-16 mt-1 rounded-md" />
                    ) : (
                      <p className="text-2xl font-black text-foreground mt-0.5 tabular-nums">
                        {totalUsuariosPreMix.toLocaleString('pt-BR')}
                      </p>
                    )}
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
                    {carregandoPreMix ? (
                      <Skeleton className="h-7 w-14 mt-1 rounded-md" />
                    ) : (
                      <p className="text-2xl font-black text-foreground mt-0.5 tabular-nums">
                        {qtdResgatesPendentes}
                      </p>
                    )}
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
                      {espectadoresAtivos.length}
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
                    <CardTitle className="text-sm font-bold">
                      Novos Usuários no App
                    </CardTitle>
                    <Link to="/raffle">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-primary px-2"
                      >
                        Ver Todos
                      </Button>
                    </Link>
                  </CardHeader>
                  <CardContent className="p-0 divide-y divide-border/60">
                    {carregandoPreMix ? (
                      <div className="p-6 text-center text-xs text-muted-foreground">
                        Carregando...
                      </div>
                    ) : usuariosRecentes.length === 0 ? (
                      <div className="p-6 text-center text-xs text-muted-foreground">
                        Nenhum usuário recente.
                      </div>
                    ) : (
                      usuariosRecentes.map((usuarioRecente) => {
                        const nomeExibicao =
                          usuarioRecente.name ||
                          usuarioRecente.nome ||
                          'Usuário PreMix';
                        const iniciais = obterIniciaisNome(nomeExibicao);
                        return (
                          <div
                            key={usuarioRecente.id}
                            className="p-3 flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${obterCorAvatarPorIniciais(
                                  iniciais
                                )}`}
                              >
                                {iniciais}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold truncate">
                                  {nomeExibicao}
                                </p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {usuarioRecente.cidade ||
                                    usuarioRecente.city ||
                                    'Cidade N/I'}
                                </p>
                              </div>
                            </div>
                            <span className="text-[11px] font-semibold text-foreground shrink-0">
                              {usuarioRecente.whatsapp ||
                                usuarioRecente.telefone ||
                                '-'}
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
                    <CardTitle className="text-sm font-bold">
                      Resgates Pendentes
                    </CardTitle>
                    <Link to="/redemption-orders">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-primary px-2"
                      >
                        Gerenciar
                      </Button>
                    </Link>
                  </CardHeader>
                  <CardContent className="p-0 divide-y divide-border/60">
                    {carregandoPreMix ? (
                      <div className="p-6 text-center text-xs text-muted-foreground">
                        Carregando...
                      </div>
                    ) : resgatesRecentes.length === 0 ? (
                      <div className="p-6 text-center text-xs text-emerald-600 dark:text-emerald-400">
                        Nenhum resgate pendente de aprovação.
                      </div>
                    ) : (
                      resgatesRecentes.map((resgate) => (
                        <div
                          key={resgate.id}
                          className="p-3 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">
                              {resgate.rewardTitle}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              Por: {resgate.userName}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className="text-[10px] shrink-0 border-amber-500/30 text-amber-600 dark:text-amber-400"
                          >
                            {resgate.pointsCost} PTS
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-primary px-2"
                      >
                        Métricas
                      </Button>
                    </Link>
                  </CardHeader>
                  <CardContent className="p-3 space-y-2">
                    {espectadoresAtivos.length === 0 ? (
                      <div className="py-6 text-center text-xs text-muted-foreground">
                        Ninguém assistindo no momento.
                      </div>
                    ) : (
                      espectadoresAtivos.slice(0, 4).map((espectador) => (
                        <div
                          key={espectador.id}
                          className="p-2.5 rounded-lg border border-border/60 bg-secondary/30 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold truncate">
                              {espectador.userName}
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {espectador.type === 'episode'
                              ? `${espectador.seriesTitle} (T${espectador.seasonNumber}E${espectador.episodeNumber})`
                              : espectador.title}
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

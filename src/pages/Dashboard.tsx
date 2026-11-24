import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AnimatedTabs,
  HoverEffectGrid,
  SpotlightCard,
  type SpotlightTone,
} from '@/components/ui/aceternity';
import { useAuth } from '@/contexts/AuthContext';
import { useNetworkMonitor } from '@/contexts/NetworkMonitorContext';
import {
  ClientStatusDonutCard,
  NeighborhoodHealthBarCard,
} from '@/components/dashboard/NetworkHealthCharts';
import { SmartOltHealthCharts } from '@/components/dashboard/SmartOltHealthCharts';
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
  LayoutGrid,
  Lock,
  Map,
  MapPin,
  MessageSquare,
  Play,
  Radar,
  Radio,
  RefreshCw,
  Send,
  ShieldAlert,
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
      { rotulo: 'ISPFY Explorer 360°', url: '/ispfy/consulta', icone: Users, cor: 'text-indigo-500' },
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
  const [abaCentral, setAbaCentral] = useState<'shortcuts' | 'premix'>('shortcuts');

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

  const rolarParaSecao = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // KPIs ordenados por relevância operacional (F-pattern: Urgência -> Disponibilidade -> Financeiro -> Escala)
  const cardsIndicadoresRede = [
    {
      statusFiltro: 'DESCONECTADO',
      titulo: 'Sem Internet (Quedas)',
      valor: pontosDesconectados.toLocaleString('pt-BR'),
      corBarra: 'bg-rose-500',
      glowBg: 'bg-rose-500',
      bordaHover: `hover:border-rose-500/60 ${
        pontosDesconectados > 0 ? 'ring-1 ring-rose-500/30 border-rose-500/30' : ''
      }`,
      corValor: 'text-rose-600 dark:text-rose-400',
      caixaIcone: 'bg-rose-500/12 text-rose-600 dark:text-rose-400 border border-rose-500/20',
      Icone: WifiOff,
      ctaLabel: 'Atender quedas agora',
      rodape: (
        <p className="text-xs text-muted-foreground mt-2 font-medium">
          <strong>{percentualDesconectados}%</strong> da base ativa offline sem bloqueio
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
      ctaLabel: 'Ver clientes conectados',
      rodape: (
        <p className="text-xs text-muted-foreground mt-2 font-medium flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span>
            <strong>{percentualOnline}%</strong> da base ativa conectada agora
          </span>
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
      ctaLabel: 'Ver bloqueios financeiros',
      rodape: (
        <p className="text-xs text-muted-foreground mt-2 font-medium truncate">
          {totaisRede?.bloqueadosOnline ?? 0} em aviso • {totaisRede?.bloqueadosOffline ?? 0} off
          {dadosInadimplencia
            ? ` • ${dadosInadimplencia.totalClientesEmAtraso} c/ fatura vencida`
            : ''}
        </p>
      ),
    },
    {
      statusFiltro: 'ALL',
      titulo: 'Base Ativa (Pontos)',
      valor: pontosAtivos.toLocaleString('pt-BR'),
      corBarra: 'bg-blue-500',
      glowBg: 'bg-blue-500',
      bordaHover: 'hover:border-blue-500/50',
      corValor: 'text-foreground',
      caixaIcone: 'bg-blue-500/12 text-blue-600 dark:text-blue-400 border border-blue-500/20',
      Icone: Users,
      ctaLabel: 'Explorar por bairro/rua',
      rodape: (
        <p className="text-xs text-muted-foreground mt-2 font-medium">
          {(totaisRede?.totalClientesUnicos ?? 0).toLocaleString('pt-BR')} assinantes únicos •{' '}
          {pontosInativos} inativos
        </p>
      ),
    },
  ];

  return (
    <div className="space-y-8 text-foreground pb-12">
      {/* ── Cabeçalho Executivo & Barra de Saúde Global ── */}
      <div className="relative overflow-hidden rounded-2xl avl-hero-mesh p-5 sm:p-6 border border-blue-500/25 shadow-2xl text-white">
        <div className="relative z-10 space-y-4">
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
                Painel organizado por prioridade operacional: quedas imediatas, camada óptica SmartOLT, financeiro e módulos.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navegar('/ispfy/consulta')}
                className="bg-blue-500/20 hover:bg-blue-500/30 border-blue-400/35 text-white text-xs h-9 rounded-xl backdrop-blur-sm font-semibold"
              >
                <Users className="w-3.5 h-3.5 mr-1.5 text-blue-300" />
                Explorer 360°
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navegar('/chat')}
                className="bg-white/10 hover:bg-white/20 border-white/15 text-white text-xs h-9 rounded-xl backdrop-blur-sm"
              >
                <MessageSquare className="w-3.5 h-3.5 mr-1.5 text-emerald-300" />
                Chat ao Vivo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navegar('/ispfy/inteligencia?tab=optical')}
                className="bg-white/10 hover:bg-white/20 border-white/15 text-white text-xs h-9 rounded-xl backdrop-blur-sm"
              >
                <Radar className="w-3.5 h-3.5 mr-1.5 text-violet-300" />
                Radar Óptico
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navegar('/ispfy/nova-os')}
                className="bg-white/10 hover:bg-white/20 border-white/15 text-white text-xs h-9 rounded-xl backdrop-blur-sm hidden sm:inline-flex"
              >
                <ClipboardList className="w-3.5 h-3.5 mr-1.5 text-sky-300" />
                Nova O.S.
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navegar('/ispfy/regiao')}
                className="bg-white/10 hover:bg-white/20 border-white/15 text-white text-xs h-9 rounded-xl backdrop-blur-sm hidden md:inline-flex"
              >
                <MapPin className="w-3.5 h-3.5 mr-1.5 text-blue-300" />
                Mapa Bairro/Rua
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

          {/* Barra Segmentada de Saúde da Rede ao Vivo + Índice Rápido de Seções */}
          <div className="rounded-xl bg-white/[0.06] border border-white/10 backdrop-blur-md p-3.5 space-y-3">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Saúde da Rede ao Vivo (ISPFY)
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

            {/* Navegação por relevância (salto instantâneo) */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/10 text-[11px]">
              <span className="text-slate-400 font-semibold mr-1 uppercase tracking-wider text-[10px]">
                Ir direto:
              </span>
              {[
                { id: 'sec-noc', num: '01', label: 'Quedas & Bairros', Icon: ShieldAlert },
                { id: 'sec-smartolt', num: '02', label: 'Fibra & OLTs (SmartOLT)', Icon: Radio },
                { id: 'sec-financeiro', num: '03', label: 'Financeiro & Base', Icon: DollarSign },
                { id: 'sec-central', num: '04', label: 'Módulos & PreMix', Icon: LayoutGrid },
              ].map((nav) => {
                const NavIcon = nav.Icon;
                return (
                  <button
                    key={nav.id}
                    type="button"
                    onClick={() => rolarParaSecao(nav.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.07] hover:bg-white/15 border border-white/10 text-slate-200 hover:text-white transition-colors font-semibold"
                  >
                    <span className="font-mono text-[10px] text-blue-300">{nav.num}</span>
                    <NavIcon className="w-3 h-3 opacity-80" />
                    <span>{nav.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* NÍVEL 01 — PRIORIDADE MÁXIMA: PULSO DA REDE & QUEDAS IMEDIATAS         */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="sec-noc" className="space-y-4 scroll-mt-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-1 border-b border-border/60">
          <div className="flex items-start gap-3">
            <span className="inline-flex items-center justify-center h-7 px-2 rounded-lg bg-rose-500/12 border border-rose-500/25 text-[11px] font-black font-mono text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">
              01
            </span>
            <div>
              <h2 className="text-base font-extrabold tracking-tight text-foreground flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
                Prioridade Máxima — Pulso da Rede &amp; Quedas Agora
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Visão imediata de indisponibilidade, clientes desconectados no momento e bairros mais afetados
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => aoNavegarRegiao('DESCONECTADO')}
            className="h-8 text-xs text-primary font-semibold gap-1 self-start sm:self-auto"
          >
            Abrir Mapa de Quedas
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* 4 KPIs Executivos com Aceternity SpotlightCard (alturas idênticas, Sem Internet em 1º lugar) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
          {cardsIndicadoresRede.map((indicador) => {
            const IconeCard = indicador.Icone;
            const spotlightTone: SpotlightTone =
              indicador.statusFiltro === 'DESCONECTADO'
                ? 'rose'
                : indicador.statusFiltro === 'OK'
                ? 'emerald'
                : indicador.statusFiltro === 'BLOQUEADO'
                ? 'amber'
                : 'blue';
            return (
              <SpotlightCard
                key={indicador.statusFiltro}
                tone={spotlightTone}
                onClick={() => aoNavegarRegiao(indicador.statusFiltro)}
                className={`kpi-card h-full group cursor-pointer flex flex-col ${indicador.bordaHover}`}
              >
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl opacity-15 group-hover:opacity-30 transition-opacity ${indicador.glowBg}`}
                />
                <div
                  className={`absolute top-0 left-0 w-1.5 h-full ${indicador.corBarra}`}
                />
                <div className="p-5 relative z-10 flex-1 flex flex-col justify-between h-full">
                  <div>
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
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between text-[11px] font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                    <span>{indicador.ctaLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                  </div>
                </div>
              </SpotlightCard>
            );
          })}
        </div>

        {/* Ação Imediata: Quem caiu (5 cols) + Em qual bairro está concentrado (7 cols) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
          <div className="xl:col-span-5">
            <RealtimeOfflinePanel />
          </div>
          <div className="xl:col-span-7">
            <NeighborhoodHealthBarCard
              dadosRegiao={dadosRegiao}
              carregando={carregandoRegiao}
              aoNavegarRegiao={aoNavegarRegiao}
            />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* NÍVEL 02 — CAMADA ÓPTICA & INFRAESTRUTURA (SMARTOLT)                   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <SmartOltHealthCharts />

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* NÍVEL 03 — FINANCEIRO, INADIMPLÊNCIA & SAÚDE DA BASE ISPFY             */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="sec-financeiro" className="space-y-4 scroll-mt-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-1 border-b border-border/60">
          <div className="flex items-start gap-3">
            <span className="inline-flex items-center justify-center h-7 px-2 rounded-lg bg-amber-500/12 border border-amber-500/25 text-[11px] font-black font-mono text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
              03
            </span>
            <div>
              <h2 className="text-base font-extrabold tracking-tight text-foreground flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-500 shrink-0" />
                Financeiro, Inadimplência &amp; Saúde da Base
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Acompanhe vencimentos em atraso, clientes bloqueados vs. liberados e proporção geral de assinantes
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navegar('/ispfy/financeiro')}
            className="h-8 text-xs text-primary font-semibold gap-1 self-start sm:self-auto"
          >
            Abrir Financeiro
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
          <div className="xl:col-span-7">
            <OverdueDueDaySection
              dadosInadimplencia={dadosInadimplencia}
              carregando={carregandoInadimplencia}
              aoAtualizar={() => atualizarInadimplencia(true)}
            />
          </div>
          <div className="xl:col-span-5">
            <ClientStatusDonutCard
              dadosRegiao={dadosRegiao}
              carregando={carregandoRegiao}
              aoNavegarRegiao={aoNavegarRegiao}
            />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* NÍVEL 04 — CENTRAL DE MÓDULOS POR SETOR & APP PREMIX / AVL PLAY        */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="sec-central" className="space-y-4 scroll-mt-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-1 border-b border-border/60">
          <div className="flex items-start gap-3">
            <span className="inline-flex items-center justify-center h-7 px-2 rounded-lg bg-emerald-500/12 border border-emerald-500/25 text-[11px] font-black font-mono text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
              04
            </span>
            <div>
              <h2 className="text-base font-extrabold tracking-tight text-foreground flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-emerald-500 shrink-0" />
                Central de Módulos &amp; App PreMix / AVL Play
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Atalhos rápidos organizados por setor e monitoramento em tempo real do ecossistema do cliente
              </p>
            </div>
          </div>
        </div>

        <SpotlightCard tone="emerald" className="p-5">
          <div className="space-y-5">
            <AnimatedTabs
              layoutId="dashboard-central-tabs"
              activeTab={abaCentral}
              onChange={setAbaCentral}
              tabs={[
                { id: 'shortcuts', label: 'Atalhos por Setor', icon: <LayoutGrid className="w-4 h-4" /> },
                {
                  id: 'premix',
                  label: 'App PreMix & AVL Play',
                  icon: <Sparkles className="w-4 h-4" />,
                  badge: qtdResgatesPendentes,
                  badgeTone: 'warning',
                },
              ]}
            />

            {/* Aba 1: Todos os atalhos bem organizados por departamento com Aceternity HoverEffect */}
            {abaCentral === 'shortcuts' && (
              <HoverEffectGrid
                layoutId="dashboard-shortcuts-hover"
                className="grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2"
                items={GRUPOS_ATALHOS_SETOR.map((grupo) => ({
                  id: grupo.titulo,
                  content: (
                    <div
                      className={`h-full rounded-xl border ${grupo.bordaGrupo} bg-card/85 p-3.5 space-y-2.5`}
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
                              className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-background/80 border border-border/60 hover:border-primary/40 hover:bg-secondary/60 transition-all group"
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
                  ),
                }))}
              />
            )}

            {/* Aba 2: PreMix App & AVL Play (preserva integralmente os dados em tempo real) */}
            {abaCentral === 'premix' && (
              <div className="space-y-6">
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
              </div>
            )}
          </div>
        </SpotlightCard>
      </section>
    </div>
  );
}

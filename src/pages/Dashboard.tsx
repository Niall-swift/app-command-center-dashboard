import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from '@/contexts/AuthContext';
import { 
  Gift, 
  Trophy, 
  Users, 
  ArrowRight, 
  Sparkles, 
  Activity, 
  Play, 
  Hourglass, 
  ExternalLink,
  MessageSquare,
  Send,
  Bell,
  Database,
  Map,
  FileSpreadsheet
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, getDocs, doc, getDoc, query, where, orderBy } from 'firebase/firestore';
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

export default function Dashboard() {
  const { user, userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [totalUsersCount, setTotalUsersCount] = useState(0);
  const [pendingRedemptionsCount, setPendingRedemptionsCount] = useState(0);
  
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [recentRedemptions, setRecentRedemptions] = useState<RecentRedemption[]>([]);
  const [activeWatchers, setActiveWatchers] = useState<ActiveWatcher[]>([]);

  useEffect(() => {
    // 1. Listener em tempo real para visualizadores ativos do AVL Play
    const unsubscribeWatchers = onSnapshot(collection(db, 'activeWatchers'), (snapshot) => {
      const now = Date.now();
      const watchersList: ActiveWatcher[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const updatedTime = data.updatedAt?.toMillis ? data.updatedAt.toMillis() : 0;
        
        // Considerar ativo se atualizado nos últimos 20 segundos e reproduzindo
        if (now - updatedTime < 20 * 1000 && data.isPlaying) {
          watchersList.push({
            id: docSnap.id,
            ...data
          } as ActiveWatcher);
        }
      });
      setActiveWatchers(watchersList);
    });

    // 2. Listener em tempo real para pedidos de resgate
    const unsubscribeRedemptions = onSnapshot(collection(db, 'redeemedRewards'), async (snapshot) => {
      const allRedemptions = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          redeemedAt: data.redeemedAt?.toDate ? data.redeemedAt.toDate() : data.redeemedAt,
        };
      }) as any[];

      const pending = allRedemptions.filter(r => r.status === 'pending');
      setPendingRedemptionsCount(pending.length);

      // Pegar os 4 resgates pendentes mais recentes
      const recentPending = pending
        .sort((a, b) => {
          const dateA = a.redeemedAt ? new Date(a.redeemedAt).getTime() : 0;
          const dateB = b.redeemedAt ? new Date(b.redeemedAt).getTime() : 0;
          return dateB - dateA;
        })
        .slice(0, 4);

      // Enriquecer com o nome do usuário cadastrado na coleção 'users'
      const enriched = await Promise.all(
        recentPending.map(async (r) => {
          try {
            if (!r.userId) return r;
            const userDoc = await getDoc(doc(db, 'users', r.userId));
            if (userDoc.exists()) {
              const uData = userDoc.data();
              return {
                ...r,
                userName: uData.name || 'Usuário PreMix'
              };
            }
          } catch (e) {
            console.error('Erro ao buscar dados do usuário para o resgate:', e);
          }
          return r;
        })
      );

      setRecentRedemptions(enriched);
    });

    // 3. Buscar contagem total e cadastros recentes de usuários do aplicativo
    const fetchPreMixUsers = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'usuariosDoPreMix'));
        setTotalUsersCount(snapshot.size);

        const sortedUsers = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        })) as RecentUser[];

        // Ordenar por data de cadastro decrescente
        sortedUsers.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return timeB - timeA;
        });

        setRecentUsers(sortedUsers.slice(0, 4));
      } catch (error) {
        console.error('Erro ao buscar usuários do PreMix:', error);
      } finally {
        setLoading(false);
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

  // Cores de fundo aleatórias e determinísticas para avatares baseadas nas iniciais
  const getAvatarBg = (initials: string) => {
    const colors = [
      'bg-blue-100 text-blue-700',
      'bg-purple-100 text-purple-700',
      'bg-emerald-100 text-emerald-700',
      'bg-indigo-100 text-indigo-700',
      'bg-pink-100 text-pink-700',
      'bg-amber-100 text-amber-700'
    ];
    let sum = 0;
    for (let i = 0; i < initials.length; i++) {
      sum += initials.charCodeAt(i);
    }
    return colors[sum % colors.length];
  };

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">
            Olá, {userData?.name || user?.displayName || 'Usuário'}! 👋
          </h1>
          <p className="text-gray-500 font-medium">Bem-vindo ao centro de comando operacional do PreMix.</p>
        </div>
      </div>

      {/* KPI Cards / Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white border-none shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500" />
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Cadastros no App</p>
                <h3 className="text-3xl font-black text-gray-950 mt-1">
                  {loading ? '...' : totalUsersCount.toLocaleString()}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3 font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              Usuários cadastrados no PreMix
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-none shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Resgates Pendentes</p>
                <h3 className="text-3xl font-black text-gray-950 mt-1">
                  {loading ? '...' : pendingRedemptionsCount}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <Gift className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3 font-semibold flex items-center gap-1.5">
              <Hourglass className="w-3.5 h-3.5 text-amber-500" />
              Aguardando aprovação no painel
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-none shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-green-500" />
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Assistindo Agora</p>
                <h3 className="text-3xl font-black text-gray-950 mt-1">
                  {activeWatchers.length}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
                <Activity className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Clientes online no AVL Play
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Recent Lists (Col Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Recent Registrations */}
          <Card className="bg-white border-none shadow-sm">
            <CardHeader className="pb-3 border-b border-gray-50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-gray-900">Novos Usuários no App</CardTitle>
                <CardDescription className="text-xs">Clientes integrados recentemente ao aplicativo móvel.</CardDescription>
              </div>
              <Link to="/raffle">
                <Button variant="ghost" size="sm" className="text-xs text-blue-600 hover:text-blue-700 font-bold gap-1">
                  Ver Todos <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-gray-400 text-sm">Carregando novos usuários...</div>
              ) : recentUsers.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">Nenhum usuário cadastrado recentemente.</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {recentUsers.map(user => {
                    const userName = user.name || user.nome || 'Usuário PreMix';
                    const initials = getInitials(userName);
                    return (
                      <div key={user.id} className="flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${getAvatarBg(initials)}`}>
                            {initials}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-gray-800">{userName}</h4>
                            <p className="text-xs text-gray-400 font-medium">
                              {user.cidade || user.city || 'Cidade não informada'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-gray-600 font-bold block">{user.whatsapp || user.telefone || '-'}</span>
                          <span className="text-[10px] text-gray-400">Contato Direct</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Resgates */}
          <Card className="bg-white border-none shadow-sm">
            <CardHeader className="pb-3 border-b border-gray-50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-gray-900">Resgates Pendentes Recentes</CardTitle>
                <CardDescription className="text-xs">Prêmios resgatados no app aguardando aprovação administrativa.</CardDescription>
              </div>
              <Link to="/redemption-orders">
                <Button variant="ghost" size="sm" className="text-xs text-blue-600 hover:text-blue-700 font-bold gap-1">
                  Gerenciar Resgates <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-gray-400 text-sm">Carregando pedidos de resgate...</div>
              ) : recentRedemptions.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm text-emerald-600 font-medium bg-emerald-50/20">
                  🎉 Tudo em dia! Nenhum resgate pendente de aprovação.
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {recentRedemptions.map(redemption => (
                    <div key={redemption.id} className="flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors">
                      <div>
                        <h4 className="text-sm font-bold text-gray-800">{redemption.rewardTitle}</h4>
                        <p className="text-xs text-gray-400 font-semibold">
                          Por: <span className="text-gray-600">{redemption.userName}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-1">
                          {redemption.pointsCost} PTS
                        </span>
                        <p className="text-[10px] text-gray-400">
                          {redemption.redeemedAt instanceof Date 
                            ? redemption.redeemedAt.toLocaleDateString('pt-BR') 
                            : 'Pendente'
                          }
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Active Watchers & Quick Links (Col Span 1) */}
        <div className="space-y-6">
          
          {/* Active Watchers Monitor */}
          <Card className="bg-white border-none shadow-sm flex flex-col h-[340px]">
            <CardHeader className="pb-3 border-b border-gray-50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-1.5">
                  <Play className="w-4 h-4 text-green-500 fill-current" />
                  AVL Play Online
                </CardTitle>
                <CardDescription className="text-xs">Sessões ativas reproduzindo agora.</CardDescription>
              </div>
              <Link to="/avlplay-analytics">
                <Button variant="ghost" size="sm" className="text-xs text-blue-600 hover:text-blue-700 font-bold p-1">
                  Ver Métricas
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
              {activeWatchers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Play className="w-10 h-10 stroke-[1.5] mb-2 animate-pulse" />
                  <p className="text-xs">Ninguém assistindo no momento.</p>
                </div>
              ) : (
                activeWatchers.slice(0, 4).map(watcher => (
                  <div key={watcher.id} className="p-3 rounded-xl border border-gray-50 bg-gray-50/50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-800 truncate max-w-[120px]">
                        {watcher.userName}
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
                    </div>
                    <p className="text-[10px] text-gray-500 truncate mt-1">
                      Assistindo: <span className="font-bold text-blue-600">
                        {watcher.type === 'episode' ? `${watcher.seriesTitle} (T${watcher.seasonNumber}E${watcher.episodeNumber})` : watcher.title}
                      </span>
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Quick Actions Shortcuts */}
          <Card className="bg-white border-none shadow-sm">
            <CardHeader className="pb-3 border-b border-gray-50">
              <CardTitle className="text-lg font-bold text-gray-900">Acesso Rápido</CardTitle>
              <CardDescription className="text-xs">Atalhos para tarefas frequentes.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-2 gap-3">
              
              <Link to="/ixc/consulta" className="group">
                <div className="p-3 rounded-xl border border-gray-100 hover:border-blue-100 hover:bg-blue-50/30 transition-all flex flex-col items-center text-center">
                  <Database className="w-5 h-5 text-blue-500 mb-1.5 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-gray-700">Consulta IXC</span>
                </div>
              </Link>

              <Link to="/whatsapp/bulk" className="group">
                <div className="p-3 rounded-xl border border-gray-100 hover:border-emerald-100 hover:bg-emerald-50/30 transition-all flex flex-col items-center text-center">
                  <Send className="w-5 h-5 text-emerald-500 mb-1.5 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-gray-700">Envio Massa</span>
                </div>
              </Link>

              <Link to="/notifications" className="group">
                <div className="p-3 rounded-xl border border-gray-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all flex flex-col items-center text-center">
                  <Bell className="w-5 h-5 text-indigo-500 mb-1.5 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-gray-700">Disparo Push</span>
                </div>
              </Link>

              <Link to="/ixc/dici" className="group">
                <div className="p-3 rounded-xl border border-gray-100 hover:border-purple-100 hover:bg-purple-50/30 transition-all flex flex-col items-center text-center">
                  <FileSpreadsheet className="w-5 h-5 text-purple-500 mb-1.5 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-gray-700">Relatório DICI</span>
                </div>
              </Link>

            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Play, Users, Eye, Film, Tv, Search, Calendar, Star, Activity } from 'lucide-react';

interface ActiveWatcher {
  id: string;
  userId: string;
  userName: string;
  contentId: string;
  title: string;
  type: 'movie' | 'episode';
  posterPath: string;
  backdropPath?: string | null;
  seriesId: string | null;
  seriesTitle: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  isPlaying: boolean;
  updatedAt: any;
}

interface ContentStat {
  id: string;
  contentId: string;
  title: string;
  type: 'movie' | 'series' | 'episode';
  views: number;
  lastWatchedAt: any;
  seriesId?: string;
}

interface Movie {
  id: string;
  title: string;
  poster_path: string;
  category: string;
}

interface Series {
  id: string;
  title: string;
  poster_path: string;
  category: string;
}

export default function AVLPlayAnalytics() {
  const [activeWatchers, setActiveWatchers] = useState<ActiveWatcher[]>([]);
  const [contentStats, setContentStats] = useState<Record<string, ContentStat>>({});
  const [movies, setMovies] = useState<Movie[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // 1. Carregar lista de Filmes e Séries para associar informações
    const loadMediaMetadata = async () => {
      try {
        const [moviesSnap, seriesSnap] = await Promise.all([
          getDocs(collection(db, 'movies')),
          getDocs(collection(db, 'series'))
        ]);

        const moviesList = moviesSnap.docs.map(doc => ({
          id: doc.id,
          title: doc.data().title || '',
          poster_path: doc.data().poster_path || '',
          category: doc.data().category || ''
        }));

        const seriesList = seriesSnap.docs.map(doc => ({
          id: doc.id,
          title: doc.data().title || '',
          poster_path: doc.data().poster_path || '',
          category: doc.data().category || ''
        }));

        setMovies(moviesList);
        setSeries(seriesList);
      } catch (error) {
        console.error('Erro ao carregar metadados de mídia:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMediaMetadata();

    // 2. Listener em tempo real para Visualizadores Ativos
    const unsubscribeWatchers = onSnapshot(collection(db, 'activeWatchers'), (snapshot) => {
      const watchersList: ActiveWatcher[] = [];
      const now = Date.now();
      
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const updatedTime = data.updatedAt?.toMillis ? data.updatedAt.toMillis() : 0;
        
        // Considerar online se atualizado nos últimos 20 segundos
        if (now - updatedTime < 20 * 1000) {
          watchersList.push({
            id: docSnap.id,
            ...data
          } as ActiveWatcher);
        }
      });
      setActiveWatchers(watchersList);
    });

    // 3. Listener em tempo real para Estatísticas de Visualização
    const unsubscribeStats = onSnapshot(collection(db, 'contentStats'), (snapshot) => {
      const statsMap: Record<string, ContentStat> = {};
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        statsMap[docSnap.id] = {
          id: docSnap.id,
          ...data
        } as ContentStat;
      });
      setContentStats(statsMap);
    });

    return () => {
      unsubscribeWatchers();
      unsubscribeStats();
    };
  }, []);

  // Filtrar visualizadores ativos
  const playingWatchers = activeWatchers.filter(w => w.isPlaying);
  const pausedWatchers = activeWatchers.filter(w => !w.isPlaying);

  // Calcular total de visualizações gerais
  const totalViews = Object.values(contentStats).reduce((sum, stat) => sum + (stat.views || 0), 0);

  // Encontrar mídia com mais visualizações
  const topMedia = Object.values(contentStats).sort((a, b) => b.views - a.views)[0];

  // Agrupar visualizações e ativos para lista combinada
  const mediaList = [
    ...movies.map(m => {
      const stat = contentStats[m.id];
      const watchers = activeWatchers.filter(w => w.contentId === m.id && w.isPlaying).length;
      return {
        id: m.id,
        title: m.title,
        poster: m.poster_path,
        category: m.category,
        type: 'movie' as const,
        views: stat?.views || 0,
        activeWatchers: watchers
      };
    }),
    ...series.map(s => {
      const stat = contentStats[s.id];
      const watchers = activeWatchers.filter(w => w.seriesId === s.id && w.isPlaying).length;
      return {
        id: s.id,
        title: s.title,
        poster: s.poster_path,
        category: s.category,
        type: 'series' as const,
        views: stat?.views || 0,
        activeWatchers: watchers
      };
    })
  ].sort((a, b) => b.views - a.views);

  const filteredMedia = mediaList.filter(media =>
    media.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    media.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Activity className="w-8 h-8 text-blue-500 animate-pulse" />
            Métricas e Monitoramento - AVL Play
          </h1>
          <p className="text-gray-600">Acompanhe visualizações e usuários ativos assistindo em tempo real.</p>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wider flex items-center justify-between">
              Assistindo Agora
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-gray-900">{activeWatchers.length}</span>
              <span className="text-sm text-gray-500">usuários online</span>
            </div>
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              {playingWatchers.length} reproduzindo • 
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500 ml-1" />
              {pausedWatchers.length} pausados
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-purple-500" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wider">
              Total de Visualizações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-gray-900">
                {totalViews.toLocaleString()}
              </span>
              <span className="text-sm text-gray-500">reproduções</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Acumulado total de reproduções no AVL Play
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wider">
              Destaque do Canal
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topMedia ? (
              <div>
                <div className="text-xl font-bold text-gray-900 truncate">{topMedia.title}</div>
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                  <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] uppercase font-bold">
                    {topMedia.type === 'series' ? 'Série' : topMedia.type === 'episode' ? 'Episódio' : 'Filme'}
                  </span>
                  <span>{topMedia.views} visualizações</span>
                </p>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Sem dados suficientes</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Painel Central: Monitoramento Assistindo Agora */}
        <Card className="col-span-1 lg:col-span-1 bg-white border border-gray-100 shadow-sm flex flex-col h-[600px]">
          <CardHeader className="border-b border-gray-50 pb-4">
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              Quem está Assistindo Agora
            </CardTitle>
            <CardDescription>Visualizadores ativos em tempo real</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
            {activeWatchers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 py-10">
                <Play className="w-12 h-12 stroke-[1.5] mb-2 animate-pulse" />
                <p className="text-sm">Ninguém assistindo no momento.</p>
              </div>
            ) : (
              activeWatchers.map(watcher => (
                <div key={watcher.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50 hover:shadow-sm transition-all">
                  <div className="flex items-center gap-3 min-w-0">
                    {watcher.posterPath ? (
                      <img
                        src={watcher.posterPath}
                        alt={watcher.title}
                        crossOrigin="anonymous"
                        className="w-10 h-14 object-cover rounded-lg shadow-sm"
                      />
                    ) : (
                      <div className="w-10 h-14 rounded-lg bg-gray-200 flex items-center justify-center text-gray-400">
                        <Film className="w-5 h-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-gray-900 truncate">
                          {watcher.userName}
                        </span>
                        <span className={`w-2 h-2 rounded-full ${watcher.isPlaying ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
                      </div>
                      <p className="text-xs text-gray-400 truncate">CPF: {watcher.userId.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.***.***-$4")}</p>
                      
                      <p className="text-xs text-gray-600 font-medium truncate mt-1">
                        {watcher.type === 'episode' ? (
                          <>
                            <span className="text-blue-600 font-bold">{watcher.seriesTitle}</span> - T{watcher.seasonNumber}E{watcher.episodeNumber}
                          </>
                        ) : (
                          <span className="text-purple-600 font-bold">{watcher.title}</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Painel Direito: Listagem Geral com Views */}
        <Card className="col-span-1 lg:col-span-2 bg-white border border-gray-100 shadow-sm flex flex-col h-[600px]">
          <CardHeader className="border-b border-gray-50 pb-4 flex flex-row items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Film className="w-5 h-5 text-purple-500" />
                Audiência de Filmes e Séries
              </CardTitle>
              <CardDescription>Lista completa ordenada por relevância</CardDescription>
            </div>
            
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar por título..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 overflow-y-auto p-0">
            {loading ? (
              <div className="flex justify-center items-center h-full py-10">
                <span className="text-gray-500 text-sm">Carregando mídias...</span>
              </div>
            ) : filteredMedia.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 py-10">
                <p className="text-sm">Nenhum resultado encontrado.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredMedia.map(media => (
                  <div key={media.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4 min-w-0">
                      {media.poster ? (
                        <img
                          src={media.poster}
                          alt={media.title}
                          crossOrigin="anonymous"
                          className="w-12 h-16 object-cover rounded-lg shadow-sm"
                        />
                      ) : (
                        <div className="w-12 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                          <Film className="w-6 h-6" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="font-semibold text-gray-900 truncate">{media.title}</h4>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                            {media.category || 'Geral'}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${media.type === 'series' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                            {media.type === 'series' ? 'Série' : 'Filme'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-right shrink-0">
                      <div>
                        <div className="text-sm font-bold text-gray-900 flex items-center gap-1.5 justify-end">
                          <Eye className="w-4 h-4 text-gray-400" />
                          {media.views.toLocaleString()}
                        </div>
                        <span className="text-[10px] text-gray-400">visualizações</span>
                      </div>

                      <div className="min-w-[80px]">
                        {media.activeWatchers > 0 ? (
                          <div className="flex flex-col items-end">
                            <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2.5 py-1 rounded-full text-xs font-bold animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                              {media.activeWatchers} assistindo
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

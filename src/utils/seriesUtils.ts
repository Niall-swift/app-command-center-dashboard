import { collection, getDocs, doc, getDoc, query, where, orderBy, limit, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useState, useEffect } from 'react';

// Interface local para evitar problemas de importação
interface Episode {
  id?: string;
  episodeNumber: number;
  title: string;
  overview: string;
  runtime: number;
  airDate: Date;
  thumbnail_path: string;
  video_url: string;
  createdAt: Date;
}

interface Season {
  id?: string;
  seasonNumber: number;
  title: string;
  overview: string;
  poster_path: string;
  airDate: Date;
  episodeCount: number;
  episodes?: Episode[];
  createdAt: Date;
}

interface Series {
  id?: string;
  title: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  releaseDate: Date;
  status: 'ongoing' | 'completed' | 'cancelled';
  genres: string[];
  seasons?: Season[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Utilitários para consumir dados de séries do Firestore
 * Estrutura otimizada para melhor performance
 */

// Buscar todas as séries com informações básicas (sem subcoleções)
export const getAllSeriesBasic = async (): Promise<Series[]> => {
  try {
    const seriesSnapshot = await getDocs(collection(db, 'series'));
    return seriesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Series[];
  } catch (error) {
    console.error('Erro ao buscar séries:', error);
    throw error;
  }
};

// Buscar série completa com todas as temporadas e episódios
export const getSeriesFull = async (seriesId: string): Promise<Series | null> => {
  try {
    // Buscar dados básicos da série
    const seriesDoc = await getDoc(doc(db, 'series', seriesId));
    if (!seriesDoc.exists()) return null;

    const seriesData = { id: seriesDoc.id, ...seriesDoc.data() } as Series;
    
    // Buscar temporadas
    const seasonsSnapshot = await getDocs(collection(db, `series/${seriesId}/seasons`));
    const seasons: Season[] = [];
    
    // Para cada temporada, buscar episódios
    for (const seasonDoc of seasonsSnapshot.docs) {
      const seasonData = { id: seasonDoc.id, ...seasonDoc.data() } as Season;
      
      // Buscar episódios desta temporada
      const episodesSnapshot = await getDocs(
        collection(db, `series/${seriesId}/seasons/${seasonDoc.id}/episodes`)
      );
      
      const episodes = episodesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Episode[];
      
      seasonData.episodes = episodes;
      seasons.push(seasonData);
    }
    
    seriesData.seasons = seasons;
    return seriesData;
  } catch (error) {
    console.error('Erro ao buscar série completa:', error);
    throw error;
  }
};

// Buscar séries por gênero
export const getSeriesByGenre = async (genre: string): Promise<Series[]> => {
  try {
    const q = query(
      collection(db, 'series'),
      where('genres', 'array-contains', genre),
      orderBy('title')
    );
    
    const seriesSnapshot = await getDocs(q);
    return seriesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Series[];
  } catch (error) {
    console.error('Erro ao buscar séries por gênero:', error);
    throw error;
  }
};

// Buscar séries por status
export const getSeriesByStatus = async (status: 'ongoing' | 'completed' | 'cancelled'): Promise<Series[]> => {
  try {
    const q = query(
      collection(db, 'series'),
      where('status', '==', status),
      orderBy('title')
    );
    
    const seriesSnapshot = await getDocs(q);
    return seriesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Series[];
  } catch (error) {
    console.error('Erro ao buscar séries por status:', error);
    throw error;
  }
};

// Buscar episódios recentes (últimos episódios adicionados)
export const getRecentEpisodes = async (limitCount: number = 10): Promise<Array<Episode & { seriesTitle: string; seasonNumber: number }>> => {
  try {
    // Esta consulta é mais complexa pois precisamos buscar em todas as subcoleções
    const seriesSnapshot = await getDocs(collection(db, 'series'));
    const recentEpisodes: Array<Episode & { seriesTitle: string; seasonNumber: number }> = [];
    
    for (const seriesDoc of seriesSnapshot.docs) {
      const seriesData = { id: seriesDoc.id, ...seriesDoc.data() } as Series;
      
      // Buscar temporadas desta série
      const seasonsSnapshot = await getDocs(collection(db, `series/${seriesDoc.id}/seasons`));
      
      for (const seasonDoc of seasonsSnapshot.docs) {
        const seasonData = { id: seasonDoc.id, ...seasonDoc.data() } as Season;
        
        // Buscar episódios desta temporada
        const episodesSnapshot = await getDocs(
          collection(db, `series/${seriesDoc.id}/seasons/${seasonDoc.id}/episodes`)
        );
        
        episodesSnapshot.docs.forEach(episodeDoc => {
          const episodeData = { id: episodeDoc.id, ...episodeDoc.data() } as Episode;
          recentEpisodes.push({
            ...episodeData,
            seriesTitle: seriesData.title,
            seasonNumber: seasonData.seasonNumber
          });
        });
      }
    }
    
    // Ordenar por data de criação e limitar
    return recentEpisodes
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limitCount);
  } catch (error) {
    console.error('Erro ao buscar episódios recentes:', error);
    throw error;
  }
};

// Buscar temporada específica com seus episódios
export const getSeasonWithEpisodes = async (seriesId: string, seasonId: string): Promise<Season | null> => {
  try {
    const seasonDoc = await getDoc(doc(db, `series/${seriesId}/seasons`, seasonId));
    if (!seasonDoc.exists()) return null;
    
    const seasonData = { id: seasonDoc.id, ...seasonDoc.data() } as Season;
    
    // Buscar episódios desta temporada
    const episodesSnapshot = await getDocs(
      collection(db, `series/${seriesId}/seasons/${seasonId}/episodes`)
    );
    
    const episodes = episodesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Episode[];
    
    seasonData.episodes = episodes;
    return seasonData;
  } catch (error) {
    console.error('Erro ao buscar temporada:', error);
    throw error;
  }
};

// Buscar episódio específico
export const getEpisode = async (seriesId: string, seasonId: string, episodeId: string): Promise<Episode | null> => {
  try {
    const episodeDoc = await getDoc(
      doc(db, `series/${seriesId}/seasons/${seasonId}/episodes`, episodeId)
    );
    
    if (!episodeDoc.exists()) return null;
    
    return { id: episodeDoc.id, ...episodeDoc.data() } as Episode;
  } catch (error) {
    console.error('Erro ao buscar episódio:', error);
    throw error;
  }
};

// Função para busca de séries por texto (título ou descrição)
export const searchSeries = async (searchTerm: string): Promise<Series[]> => {
  try {
    // Como Firestore não suporta busca de texto completa nativamente,
    // faremos uma busca por prefixo no título
    const q = query(
      collection(db, 'series'),
      where('title', '>=', searchTerm),
      where('title', '<=', searchTerm + '\uf8ff'),
      limit(20)
    );
    
    const seriesSnapshot = await getDocs(q);
    return seriesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Series[];
  } catch (error) {
    console.error('Erro ao buscar séries:', error);
    throw error;
  }
};

// Função para adicionar episódio a uma temporada existente
export const addEpisodeToSeason = async (
  seriesId: string, 
  seasonId: string, 
  episode: Omit<Episode, 'id'>
) => {
  try {
    const episodeData = {
      ...episode,
      createdAt: new Date()
    };
    
    const docRef = await addDoc(
      collection(db, `series/${seriesId}/seasons/${seasonId}/episodes`),
      episodeData
    );
    
    return docRef.id;
  } catch (error) {
    console.error('Erro ao adicionar episódio:', error);
    throw error;
  }
};

// Função para atualizar contagem de episódios de uma temporada
export const updateSeasonEpisodeCount = async (seriesId: string, seasonId: string) => {
  try {
    const episodesSnapshot = await getDocs(
      collection(db, `series/${seriesId}/seasons/${seasonId}/episodes`)
    );
    
    const episodeCount = episodesSnapshot.size;
    
    await updateDoc(doc(db, `series/${seriesId}/seasons/${seasonId}`), {
      episodeCount
    });
    
    return episodeCount;
  } catch (error) {
    console.error('Erro ao atualizar contagem de episódios:', error);
    throw error;
  }
};

// Hook personalizado para React (exemplo de uso em componentes)
export const useSeriesData = () => {
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSeries = async () => {
    try {
      setLoading(true);
      const data = await getAllSeriesBasic();
      setSeries(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSeries();
  }, []);

  return { series, loading, error, refetch: loadSeries };
};

// Hook para gerenciar episódios de uma temporada específica
export const useSeasonEpisodes = (seriesId: string, seasonId: string) => {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEpisodes = async () => {
    if (!seriesId || !seasonId) return;
    
    try {
      setLoading(true);
      const episodesSnapshot = await getDocs(
        collection(db, `series/${seriesId}/seasons/${seasonId}/episodes`)
      );
      
      const episodesData = episodesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Episode[];
      
      setEpisodes(episodesData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const addEpisode = async (episodeData: Omit<Episode, 'id'>) => {
    try {
      const episodeId = await addEpisodeToSeason(seriesId, seasonId, episodeData);
      await updateSeasonEpisodeCount(seriesId, seasonId);
      
      // Reload episodes
      await loadEpisodes();
      
      return episodeId;
    } catch (error) {
      console.error('Erro ao adicionar episódio:', error);
      throw error;
    }
  };

  useEffect(() => {
    loadEpisodes();
  }, [seriesId, seasonId]);

  return { 
    episodes, 
    loading, 
    error, 
    addEpisode, 
    refetch: loadEpisodes 
  };
};
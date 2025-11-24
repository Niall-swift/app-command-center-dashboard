import React, { useState, useEffect } from 'react';
import { getAllSeriesBasic, getSeriesFull, getSeriesByGenre, getRecentEpisodes, searchSeries } from '../utils/seriesUtils';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Play, Clock, Calendar } from 'lucide-react';

/**
 * EXEMPLOS DE COMO CONSUMIR A ESTRUTURA DE SÉRIES
 */

// Exemplo 1: Componente para exibir lista básica de séries
export const SeriesListComponent = () => {
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSeries = async () => {
      try {
        const data = await getAllSeriesBasic();
        setSeries(data);
      } catch (error) {
        console.error('Erro ao carregar séries:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSeries();
  }, []);

  if (loading) return <div>Carregando séries...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {series.map((serie) => (
        <Card key={serie.id} className="overflow-hidden">
          <img
            src={serie.poster_path}
            alt={serie.title}
            className="w-full h-48 object-cover"
          />
          <CardHeader>
            <CardTitle className="text-lg">{serie.title}</CardTitle>
            <div className="flex gap-2 flex-wrap">
              {serie.genres?.map((genre) => (
                <Badge key={genre} variant="secondary">{genre}</Badge>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 line-clamp-3">{serie.overview}</p>
            <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(serie.releaseDate).getFullYear()}
              </span>
              <Badge variant={serie.status === 'ongoing' ? 'default' : 'secondary'}>
                {serie.status === 'ongoing' ? 'Em andamento' : 
                 serie.status === 'completed' ? 'Concluída' : 'Cancelada'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

// Exemplo 2: Componente para exibir série completa
export const SeriesDetailComponent = ({ seriesId }) => {
  const [series, setSeries] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSeries = async () => {
      try {
        const data = await getSeriesFull(seriesId);
        setSeries(data);
      } catch (error) {
        console.error('Erro ao carregar série:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSeries();
  }, [seriesId]);

  if (loading) return <div>Carregando série...</div>;
  if (!series) return <div>Série não encontrada</div>;

  return (
    <div className="space-y-6">
      <div className="flex gap-6">
        <img
          src={series.poster_path}
          alt={series.title}
          className="w-48 h-72 object-cover rounded-lg"
        />
        <div className="flex-1">
          <h1 className="text-3xl font-bold mb-4">{series.title}</h1>
          <p className="text-gray-600 mb-4">{series.overview}</p>
          <div className="flex gap-2 flex-wrap mb-4">
            {series.genres?.map((genre) => (
              <Badge key={genre} variant="outline">{genre}</Badge>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Temporadas</h2>
        {series.seasons?.map((season) => (
          <Card key={season.id} className="mb-4">
            <CardHeader>
              <CardTitle>
                Temporada {season.seasonNumber}: {season.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">{season.overview}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {season.episodes?.map((episode) => (
                  <div key={episode.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                    <img
                      src={episode.thumbnail_path}
                      alt={episode.title}
                      className="w-20 h-12 object-cover rounded"
                    />
                    <div className="flex-1">
                      <h4 className="font-medium">
                        {episode.episodeNumber}. {episode.title}
                      </h4>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {episode.overview}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {episode.runtime} min
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => window.open(episode.video_url, '_blank')}
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

// Exemplo 3: Componente de busca
export const SeriesSearchComponent = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;

    setLoading(true);
    try {
      const data = await searchSeries(searchTerm);
      setResults(data);
    } catch (error) {
      console.error('Erro na busca:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar séries..."
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? 'Buscando...' : 'Buscar'}
        </Button>
      </div>

      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((serie) => (
            <Card key={serie.id}>
              <img
                src={serie.poster_path}
                alt={serie.title}
                className="w-full h-40 object-cover"
              />
              <CardContent className="p-4">
                <h3 className="font-semibold">{serie.title}</h3>
                <p className="text-sm text-gray-600 line-clamp-2">
                  {serie.overview}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default {
  SeriesListComponent,
  SeriesDetailComponent,
  SeriesSearchComponent
};
# 📺 Guia de Uso da Estrutura de Séries

## 🎯 Visão Geral

A estrutura de séries implementada permite gerenciar séries de TV de forma hierárquica e organizada, com suporte a temporadas e episódios em subcoleções do Firestore para melhor performance.

## 🆕 Nova Funcionalidade: Adicionar Episódios a Séries Existentes

Agora é possível adicionar episódios a temporadas de séries já existentes! A interface está organizada em abas:

1. **Adicionar Nova Série** - Criar séries completas com temporadas e episódios
2. **Adicionar Episódio** - Adicionar episódios a temporadas de séries existentes
3. **Listar Séries** - Visualizar todas as séries cadastradas

### Como Usar a Nova Funcionalidade:

1. Acesse a aba **"Adicionar Episódio"**
2. Selecione a série desejada
3. Escolha a temporada
4. Preencha os dados do novo episódio:
   - Número do episódio (definido automaticamente)
   - Título
   - Descrição
   - Duração
   - Data de exibição
   - Thumbnail
   - Arquivo de vídeo
5. Veja a pré-visualização antes de enviar
6. Clique em "Adicionar Episódio"

O sistema会自动:
- Definir o próximo número do episódio
- Fazer upload dos arquivos
- Atualizar a contagem de episódios da temporada
- Recarregar os dados

## 🗂️ Estrutura do Banco de Dados

```
📁 firestore/
├── 📄 series (coleção principal)
│   ├── 📄 {seriesId}
│   │   ├── title, overview, poster_path, backdrop_path
│   │   ├── releaseDate, status, genres
│   │   └── 📁 seasons (subcoleção)
│   │       ├── 📄 {seasonId}
│   │       │   ├── seasonNumber, title, overview
│   │       │   ├── poster_path, airDate, episodeCount
│   │       │   └── 📁 episodes (subcoleção)
│   │       │       ├── 📄 {episodeId}
│   │       │       │   ├── episodeNumber, title, overview
│   │       │       │   ├── runtime, airDate
│   │       │       │   ├── thumbnail_path, video_url
│   │       │       │   └── createdAt
```

## 🚀 Como Usar

### 1. Importar as Utilitários

```typescript
import { 
  getAllSeriesBasic, 
  getSeriesFull, 
  getSeriesByGenre, 
  getRecentEpisodes, 
  searchSeries 
} from '../utils/seriesUtils';
```

### 2. Buscar Todas as Séries (Informações Básicas)

```typescript
// Carrega apenas dados básicos da série (sem temporadas/episódios)
// Mais rápido para listas gerais
const series = await getAllSeriesBasic();

// Exemplo de uso no componente
const [series, setSeries] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const loadSeries = async () => {
    try {
      const data = await getAllSeriesBasic();
      setSeries(data);
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };
  loadSeries();
}, []);
```

### 3. Buscar Série Completa com Temporadas

```typescript
// Carrega série com todas as temporadas e episódios
// Usar apenas quando necessário (página de detalhes)
const series = await getSeriesFull('series-id');

// Exemplo de estrutura retornada:
{
  id: "series-123",
  title: "Stranger Things",
  overview: "Série sobre...",
  poster_path: "https://...",
  backdrop_path: "https://...",
  releaseDate: new Date("2016-07-15"),
  status: "ongoing",
  genres: ["Drama", "Ficção Científica", "Terror"],
  seasons: [
    {
      id: "season-1",
      seasonNumber: 1,
      title: "Temporada 1",
      overview: "A primeira temporada...",
      poster_path: "https://...",
      airDate: new Date("2016-07-15"),
      episodeCount: 8,
      episodes: [
        {
          id: "episode-1",
          episodeNumber: 1,
          title: "A Sombra na Cidade",
          overview: "Will desaparece...",
          runtime: 47,
          airDate: new Date("2016-07-15"),
          thumbnail_path: "https://...",
          video_url: "https://...",
          createdAt: new Date()
        }
      ]
    }
  ]
}
```

### 4. Buscar por Gênero

```typescript
// Busca séries que contenham um gênero específico
const actionSeries = await getSeriesByGenre('Ação');

// Filtrar por múltiplos gêneros
const filteredSeries = series.filter(serie => 
  serie.genres?.includes('Drama') && 
  serie.genres?.includes('Ação')
);
```

### 5. Buscar por Status

```typescript
// Séries em andamento
const ongoingSeries = series.filter(s => s.status === 'ongoing');

// Séries concluídas
const completedSeries = series.filter(s => s.status === 'completed');
```

### 6. Buscar Episódios Recentes

```typescript
// Lista os episódios mais recentes adicionados
const recentEpisodes = await getRecentEpisodes(5);

// Estrutura retornada:
[
  {
    id: "episode-123",
    episodeNumber: 1,
    title: "Episódio 1",
    overview: "Descrição...",
    runtime: 45,
    airDate: new Date(),
    thumbnail_path: "https://...",
    video_url: "https://...",
    createdAt: new Date(),
    seriesTitle: "Nome da Série",
    seasonNumber: 1
  }
]
```

### 7. Buscar por Texto

```typescript
// Busca séries por título (busca por prefixo)
const searchResults = await searchSeries('stranger');

// Filtrar por descrição também
const filteredSearch = series.filter(serie => 
  serie.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
  serie.overview.toLowerCase().includes(searchTerm.toLowerCase())
);
```

### 8. Adicionar Episódio a Temporada Existente

```typescript
// Adicionar episódio a uma temporada específica
import { addEpisodeToSeason, updateSeasonEpisodeCount } from '../utils/seriesUtils';

const addNewEpisode = async (seriesId: string, seasonId: string) => {
  const episodeData = {
    episodeNumber: 5, // Será calculado automaticamente
    title: "Novo Episódio",
    overview: "Descrição do episódio...",
    runtime: 45,
    airDate: new Date("2024-01-15"),
    thumbnail_path: "https://...",
    video_url: "https://..."
  };
  
  try {
    // Adicionar episódio
    const episodeId = await addEpisodeToSeason(seriesId, seasonId, episodeData);
    
    // Atualizar contagem de episódios da temporada
    await updateSeasonEpisodeCount(seriesId, seasonId);
    
    console.log(`Episódio adicionado com ID: ${episodeId}`);
  } catch (error) {
    console.error('Erro ao adicionar episódio:', error);
  }
};

// Usar hook para gerenciar episódios de uma temporada
import { useSeasonEpisodes } from '../utils/seriesUtils';

const EpisodeManager = ({ seriesId, seasonId }) => {
  const { episodes, addEpisode, loading } = useSeasonEpisodes(seriesId, seasonId);
  
  const handleAddEpisode = async () => {
    const newEpisode = {
      episodeNumber: episodes.length + 1,
      title: "Episódio Novo",
      overview: "Descrição...",
      runtime: 45,
      airDate: new Date(),
      thumbnail_path: "",
      video_url: ""
    };
    
    await addEpisode(newEpisode);
  };
  
  return (
    <div>
      <h3>Episódios ({episodes.length})</h3>
      <Button onClick={handleAddEpisode} disabled={loading}>
        Adicionar Episódio
      </Button>
      {episodes.map(episode => (
        <div key={episode.id}>{episode.title}</div>
      ))}
    </div>
  );
};
```

## 🎨 Exemplos de Componentes React

### Lista Básica de Séries

```tsx
const SeriesList = () => {
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSeries = async () => {
      const data = await getAllSeriesBasic();
      setSeries(data);
      setLoading(false);
    };
    loadSeries();
  }, []);

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="grid grid-cols-3 gap-4">
      {series.map(serie => (
        <Card key={serie.id}>
          <img src={serie.poster_path} alt={serie.title} />
          <h3>{serie.title}</h3>
          <p>{serie.overview}</p>
          <div>
            {serie.genres?.map(genre => (
              <Badge key={genre}>{genre}</Badge>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
};
```

### Detalhes da Série com Temporadas

```tsx
const SeriesDetail = ({ seriesId }) => {
  const [series, setSeries] = useState(null);

  useEffect(() => {
    const loadSeries = async () => {
      const data = await getSeriesFull(seriesId);
      setSeries(data);
    };
    loadSeries();
  }, [seriesId]);

  if (!series) return <div>Carregando...</div>;

  return (
    <div>
      <div className="hero">
        <img src={series.backdrop_path} />
        <div>
          <h1>{series.title}</h1>
          <p>{series.overview}</p>
        </div>
      </div>

      {series.seasons?.map(season => (
        <Accordion key={season.id}>
          <AccordionItem value={season.id}>
            <AccordionTrigger>
              Temporada {season.seasonNumber}: {season.title}
            </AccordionTrigger>
            <AccordionContent>
              <div className="episodes-grid">
                {season.episodes?.map(episode => (
                  <EpisodeCard key={episode.id} episode={episode} />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ))}
    </div>
  );
};
```

### Componente de Episódio

```tsx
const EpisodeCard = ({ episode }) => {
  return (
    <div className="episode-card">
      <img src={episode.thumbnail_path} alt={episode.title} />
      <div className="episode-info">
        <h4>{episode.episodeNumber}. {episode.title}</h4>
        <p>{episode.overview}</p>
        <div className="episode-meta">
          <span>{episode.runtime} min</span>
          <Button onClick={() => window.open(episode.video_url)}>
            Assistir
          </Button>
        </div>
      </div>
    </div>
  );
};
```

### Sistema de Busca

```tsx
const SeriesSearch = () => {
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
    <div className="search-container">
      <div className="search-bar">
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar séries..."
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button onClick={handleSearch}>Buscar</Button>
      </div>

      <div className="results-grid">
        {results.map(serie => (
          <SeriesCard key={serie.id} serie={serie} />
        ))}
      </div>
    </div>
  );
};
```

## 📊 Otimizações de Performance

### 1. Carregamento Incremental

```typescript
// ✅ BOM: Carregar lista básica primeiro
const basicSeries = await getAllSeriesBasic();

// ❌ RUIM: Carregar tudo de uma vez
// const fullSeries = await Promise.all(
//   basicSeries.map(serie => getSeriesFull(serie.id))
// );
```

### 2. Paginação

```typescript
// Implementar paginação para grandes listas
const [currentPage, setCurrentPage] = useState(1);
const itemsPerPage = 20;

const paginatedSeries = series.slice(
  (currentPage - 1) * itemsPerPage,
  currentPage * itemsPerPage
);
```

### 3. Cache Local

```typescript
// Cache das séries para evitar recarregamento desnecessário
const [cachedSeries, setCachedSeries] = useState(null);

useEffect(() => {
  if (!cachedSeries) {
    loadSeries().then(setCachedSeries);
  } else {
    setSeries(cachedSeries);
  }
}, []);
```

## 🔧 Estrutura de Arquivos

```
src/
├── utils/
│   └── seriesUtils.ts          # Funções utilitárias
├── examples/
│   └── SeriesUsageExamples.tsx # Exemplos de componentes
├── pages/
│   └── Series.tsx             # Página de gerenciamento
└── types/
    └── firebase.ts            # Tipos TypeScript
```

## 🎯 Casos de Uso Comuns

### 1. Homepage com Séries em Destaque

```tsx
const HomePage = () => {
  const [featuredSeries, setFeaturedSeries] = useState([]);
  const [recentEpisodes, setRecentEpisodes] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      const series = await getAllSeriesBasic();
      const episodes = await getRecentEpisodes(10);
      
      setFeaturedSeries(series.slice(0, 6)); // Primeiras 6
      setRecentEpisodes(episodes);
    };
    loadData();
  }, []);

  return (
    <div>
      <HeroSection series={featuredSeries[0]} />
      <RecentEpisodes episodes={recentEpisodes} />
      <SeriesGrid series={featuredSeries} />
    </div>
  );
};
```

### 2. Player de Vídeo

```tsx
const VideoPlayer = ({ seriesId, seasonId, episodeId }) => {
  const [episode, setEpisode] = useState(null);

  useEffect(() => {
    const loadEpisode = async () => {
      const episodeData = await getEpisode(seriesId, seasonId, episodeId);
      setEpisode(episodeData);
    };
    loadEpisode();
  }, [seriesId, seasonId, episodeId]);

  if (!episode) return <div>Carregando episódio...</div>;

  return (
    <div className="video-player">
      <video controls>
        <source src={episode.video_url} type="video/mp4" />
      </video>
      <div className="episode-info">
        <h2>{episode.title}</h2>
        <p>{episode.overview}</p>
      </div>
    </div>
  );
};
```

### 3. Sistema de Favoritos

```typescript
// Usar Firestore ou localStorage para favoritos
const toggleFavorite = (seriesId) => {
  const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
  const newFavorites = favorites.includes(seriesId)
    ? favorites.filter(id => id !== seriesId)
    : [...favorites, seriesId];
  
  localStorage.setItem('favorites', JSON.stringify(newFavorites));
};

// Componente de favorito
const FavoriteButton = ({ seriesId, isFavorite }) => {
  return (
    <Button
      onClick={() => toggleFavorite(seriesId)}
      variant={isFavorite ? "default" : "outline"}
    >
      {isFavorite ? '❤️' : '🤍'}
    </Button>
  );
};
```

## 🚨 Considerações Importantes

1. **Performance**: Sempre carregar dados básicos primeiro, dados completos apenas quando necessário
2. **Imagens**: Usar Lazy Loading para posters e thumbnails
3. **Vídeos**: Implementar player com controles customizados
4. **Cache**: Implementar cache local para melhor performance
5. **Paginção**: Para listas grandes, implementar paginação
6. **Busca**: Considerar usar Algolia ou Elasticsearch para busca avançada
7. **Estrutura**: Manter a hierarquia de subcoleções para organização

Esta estrutura permite criar uma experiência rica e performática para consumo de séries no seu aplicativo! 🎬
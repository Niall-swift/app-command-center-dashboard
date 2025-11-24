import React, { useState, useEffect } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { storage, db } from '../config/firebase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Progress } from '../components/ui/progress';
import { useToast } from '../hooks/use-toast';
import { Upload, Play, Trash2, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';

interface Episode {
  id?: string;
  episodeNumber: number;
  title: string;
  overview: string;
  runtime: number;
  airDate: Date;
  thumbnail_path: string;
  video_url: string;
  // Temporary properties for file upload
  thumbnail_file?: File;
  video_file?: File;
}

interface Season {
  id?: string;
  seasonNumber: number;
  title: string;
  overview: string;
  poster_path: string;
  airDate: Date;
  episodeCount: number;
  episodes: Episode[];
  // Temporary property for file upload
  poster_file?: File;
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
  seasons: Season[];
}

export default function Series() {
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentUploadStep, setCurrentUploadStep] = useState('');
  const { toast } = useToast();

  // Form states
  const [title, setTitle] = useState('');
  const [overview, setOverview] = useState('');
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [backdropFile, setBackdropFile] = useState<File | null>(null);
  const [releaseDate, setReleaseDate] = useState('');
  const [status, setStatus] = useState<'ongoing' | 'completed' | 'cancelled'>('ongoing');
  const [genres, setGenres] = useState('');

  // Seasons and episodes states
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [expandedSeasons, setExpandedSeasons] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadSeries();
  }, []);

  const loadSeries = async () => {
    try {
      setLoading(true);
      const seriesSnapshot = await getDocs(collection(db, 'series'));
      
      const seriesPromises = seriesSnapshot.docs.map(async (doc) => {
        const seriesData = { id: doc.id, ...doc.data() } as Series;
        
        // Load seasons subcollection
        const seasonsSnapshot = await getDocs(collection(db, `series/${doc.id}/seasons`));
        const seasonsData: Season[] = [];
        
        for (const seasonDoc of seasonsSnapshot.docs) {
          const seasonData = { id: seasonDoc.id, ...seasonDoc.data() } as Season;
          
          // Load episodes subcollection for this season
          const episodesSnapshot = await getDocs(collection(db, `series/${doc.id}/seasons/${seasonDoc.id}/episodes`));
          const episodesData = episodesSnapshot.docs.map(episodeDoc => ({
            id: episodeDoc.id,
            ...episodeDoc.data()
          })) as Episode[];
          
          seasonData.episodes = episodesData;
          seasonsData.push(seasonData);
        }
        
        seriesData.seasons = seasonsData;
        return seriesData;
      });
      
      const loadedSeries = await Promise.all(seriesPromises);
      setSeries(loadedSeries);
    } catch (error) {
      console.error('Erro ao carregar séries:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar séries. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file: File, path: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error('Erro no upload:', error);
          reject(error);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  };

  const addSeason = () => {
    const newSeason: Season = {
      seasonNumber: seasons.length + 1,
      title: `Temporada ${seasons.length + 1}`,
      overview: '',
      poster_path: '',
      airDate: new Date(),
      episodeCount: 0,
      episodes: []
    };
    setSeasons([...seasons, newSeason]);
    setExpandedSeasons(prev => new Set([...prev, newSeason.seasonNumber]));
  };

  const updateSeason = (index: number, field: keyof Season, value: any) => {
    const updatedSeasons = [...seasons];
    updatedSeasons[index] = { ...updatedSeasons[index], [field]: value };
    setSeasons(updatedSeasons);
  };

  const addEpisode = (seasonIndex: number) => {
    const updatedSeasons = [...seasons];
    const season = updatedSeasons[seasonIndex];
    
    const newEpisode: Episode = {
      episodeNumber: season.episodes.length + 1,
      title: `Episódio ${season.episodes.length + 1}`,
      overview: '',
      runtime: 0,
      airDate: new Date(),
      thumbnail_path: '',
      video_url: ''
    };
    
    season.episodes.push(newEpisode);
    setSeasons(updatedSeasons);
  };

  const updateEpisode = (seasonIndex: number, episodeIndex: number, field: keyof Episode, value: any) => {
    const updatedSeasons = [...seasons];
    updatedSeasons[seasonIndex].episodes[episodeIndex] = { 
      ...updatedSeasons[seasonIndex].episodes[episodeIndex], 
      [field]: value 
    };
    setSeasons(updatedSeasons);
  };

  const removeSeason = (index: number) => {
    const updatedSeasons = seasons.filter((_, i) => i !== index);
    setSeasons(updatedSeasons);
    setExpandedSeasons(prev => {
      const newSet = new Set(prev);
      newSet.delete(seasons[index].seasonNumber);
      return newSet;
    });
  };

  const removeEpisode = (seasonIndex: number, episodeIndex: number) => {
    const updatedSeasons = [...seasons];
    updatedSeasons[seasonIndex].episodes.splice(episodeIndex, 1);
    
    // Renumber episodes
    updatedSeasons[seasonIndex].episodes = updatedSeasons[seasonIndex].episodes.map((episode, idx) => ({
      ...episode,
      episodeNumber: idx + 1
    }));
    
    setSeasons(updatedSeasons);
  };

  const toggleSeason = (seasonNumber: number) => {
    setExpandedSeasons(prev => {
      const newSet = new Set(prev);
      if (newSet.has(seasonNumber)) {
        newSet.delete(seasonNumber);
      } else {
        newSet.add(seasonNumber);
      }
      return newSet;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || seasons.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    setCurrentUploadStep('Iniciando upload...');

    try {
      // Upload poster if provided
      let posterUrl = '';
      if (posterFile) {
        setCurrentUploadStep('Enviando poster...');
        const posterPath = `series/posters/${Date.now()}_${posterFile.name}`;
        posterUrl = await uploadFile(posterFile, posterPath);
      }

      // Upload backdrop if provided
      let backdropUrl = '';
      if (backdropFile) {
        setCurrentUploadStep('Enviando backdrop...');
        const backdropPath = `series/backdrops/${Date.now()}_${backdropFile.name}`;
        backdropUrl = await uploadFile(backdropFile, backdropPath);
      }

      // Create series document
      setCurrentUploadStep('Criando série...');
      const seriesDoc = await addDoc(collection(db, 'series'), {
        title,
        overview,
        poster_path: posterUrl,
        backdrop_path: backdropUrl,
        releaseDate: new Date(releaseDate),
        status,
        genres: genres.split(',').map(g => g.trim()).filter(g => g),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const seriesId = seriesDoc.id;

      // Upload and create seasons and episodes
      for (const [seasonIndex, season] of seasons.entries()) {
        setCurrentUploadStep(`Criando temporada ${seasonIndex + 1}...`);
        
        // Upload season poster if provided
        let seasonPosterUrl = '';
        if (season.poster_path && typeof season.poster_path === 'string' && !season.poster_path.startsWith('http')) {
          const seasonPosterFile = season.poster_file;
          if (seasonPosterFile) {
            const seasonPosterPath = `series/seasons/${Date.now()}_${seasonPosterFile.name}`;
            seasonPosterUrl = await uploadFile(seasonPosterFile, seasonPosterPath);
          }
        } else if (season.poster_path.startsWith('http')) {
          seasonPosterUrl = season.poster_path;
        }

        // Create season document
        const seasonDoc = await addDoc(collection(db, `series/${seriesId}/seasons`), {
          seasonNumber: season.seasonNumber,
          title: season.title,
          overview: season.overview,
          poster_path: seasonPosterUrl,
          airDate: new Date(season.airDate),
          episodeCount: season.episodes.length,
          createdAt: new Date()
        });

        const seasonId = seasonDoc.id;

        // Create episodes
        for (const [episodeIndex, episode] of season.episodes.entries()) {
          setCurrentUploadStep(`Enviando episódio ${seasonIndex + 1}x${episodeIndex + 1}...`);
          
          // Upload episode thumbnail if provided
          let episodeThumbnailUrl = '';
          if (episode.thumbnail_path && typeof episode.thumbnail_path === 'string' && !episode.thumbnail_path.startsWith('http')) {
            const episodeThumbnailFile = episode.thumbnail_file;
            if (episodeThumbnailFile) {
              const episodeThumbnailPath = `series/episodes/${Date.now()}_${episodeThumbnailFile.name}`;
              episodeThumbnailUrl = await uploadFile(episodeThumbnailFile, episodeThumbnailPath);
            }
          } else if (episode.thumbnail_path.startsWith('http')) {
            episodeThumbnailUrl = episode.thumbnail_path;
          }

          // Upload episode video
          let episodeVideoUrl = '';
          if (episode.video_file) {
            const episodeVideoPath = `series/videos/${Date.now()}_${episode.video_file.name}`;
            episodeVideoUrl = await uploadFile(episode.video_file, episodeVideoPath);
          }

          // Create episode document
          await addDoc(collection(db, `series/${seriesId}/seasons/${seasonId}/episodes`), {
            episodeNumber: episode.episodeNumber,
            title: episode.title,
            overview: episode.overview,
            runtime: episode.runtime,
            airDate: new Date(episode.airDate),
            thumbnail_path: episodeThumbnailUrl,
            video_url: episodeVideoUrl,
            createdAt: new Date()
          });
        }
      }

      // Reset form
      setTitle('');
      setOverview('');
      setPosterFile(null);
      setBackdropFile(null);
      setReleaseDate('');
      setStatus('ongoing');
      setGenres('');
      setSeasons([]);
      setUploadProgress(0);
      setCurrentUploadStep('');

      // Reload series
      loadSeries();

      toast({
        title: "Sucesso!",
        description: "Série enviada com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar série. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setCurrentUploadStep('');
    }
  };

  const deleteSeries = async (seriesId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta série?')) return;

    try {
      // Delete all subcollections (seasons and episodes)
      const seasonsSnapshot = await getDocs(collection(db, `series/${seriesId}/seasons`));
      
      for (const seasonDoc of seasonsSnapshot.docs) {
        // Delete episodes subcollection
        const episodesSnapshot = await getDocs(collection(db, `series/${seriesId}/seasons/${seasonDoc.id}/episodes`));
        const deletePromises = episodesSnapshot.docs.map(episodeDoc => 
          deleteDoc(doc(db, `series/${seriesId}/seasons/${seasonDoc.id}/episodes/${episodeDoc.id}`))
        );
        await Promise.all(deletePromises);
        
        // Delete season document
        await deleteDoc(doc(db, `series/${seriesId}/seasons/${seasonDoc.id}`));
      }
      
      // Delete series document
      await deleteDoc(doc(db, 'series', seriesId));
      loadSeries();
      
      toast({
        title: "Sucesso!",
        description: "Série excluída com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao excluir série:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir série. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Gerenciar Séries</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Form */}
        <Card>
          <CardHeader>
            <CardTitle>Adicionar Nova Série</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Título da Série</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="overview">Descrição</Label>
                <Textarea
                  id="overview"
                  value={overview}
                  onChange={(e) => setOverview(e.target.value)}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="poster">Poster (Imagem de Capa)</Label>
                <Input
                  id="poster"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPosterFile(e.target.files?.[0] || null)}
                />
              </div>

              <div>
                <Label htmlFor="backdrop">Backdrop (Imagem de Fundo)</Label>
                <Input
                  id="backdrop"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setBackdropFile(e.target.files?.[0] || null)}
                />
              </div>

              <div>
                <Label htmlFor="releaseDate">Data de Lançamento</Label>
                <Input
                  id="releaseDate"
                  type="date"
                  value={releaseDate}
                  onChange={(e) => setReleaseDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'ongoing' | 'completed' | 'cancelled')}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="ongoing">Em andamento</option>
                  <option value="completed">Concluída</option>
                  <option value="cancelled">Cancelada</option>
                </select>
              </div>

              <div>
                <Label htmlFor="genres">Gêneros (separados por vírgula)</Label>
                <Input
                  id="genres"
                  value={genres}
                  onChange={(e) => setGenres(e.target.value)}
                  placeholder="Ação, Drama, Ficção Científica"
                />
              </div>

              {/* Seasons Management */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Temporadas ({seasons.length})</Label>
                  <Button type="button" onClick={addSeason} variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Temporada
                  </Button>
                </div>

                {seasons.map((season, seasonIndex) => (
                  <Card key={seasonIndex} className="p-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 grid grid-cols-2 gap-4">
                          <div>
                            <Label>Título da Temporada</Label>
                            <Input
                              value={season.title}
                              onChange={(e) => updateSeason(seasonIndex, 'title', e.target.value)}
                              placeholder={`Temporada ${season.seasonNumber}`}
                            />
                          </div>
                          <div>
                            <Label>Data de Exibição</Label>
                            <Input
                              type="date"
                              value={season.airDate.toISOString().split('T')[0]}
                              onChange={(e) => updateSeason(seasonIndex, 'airDate', e.target.value)}
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          onClick={() => removeSeason(seasonIndex)}
                          variant="destructive"
                          size="sm"
                          className="ml-4"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div>
                        <Label>Descrição da Temporada</Label>
                        <Textarea
                          value={season.overview}
                          onChange={(e) => updateSeason(seasonIndex, 'overview', e.target.value)}
                          rows={2}
                        />
                      </div>

                      <div>
                        <Label>Poster da Temporada</Label>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              updateSeason(seasonIndex, 'poster_file', file);
                              updateSeason(seasonIndex, 'poster_path', file.name);
                            }
                          }}
                        />
                      </div>

                      {/* Episodes Management */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Episódios ({season.episodes.length})</Label>
                          <Button
                            type="button"
                            onClick={() => addEpisode(seasonIndex)}
                            variant="outline"
                            size="sm"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Adicionar Episódio
                          </Button>
                        </div>

                        {season.episodes.map((episode, episodeIndex) => (
                          <Card key={episodeIndex} className="p-3">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 grid grid-cols-2 gap-3">
                                  <div>
                                    <Label>Título do Episódio</Label>
                                    <Input
                                      value={episode.title}
                                      onChange={(e) => updateEpisode(seasonIndex, episodeIndex, 'title', e.target.value)}
                                      placeholder={`Episódio ${episode.episodeNumber}`}
                                    />
                                  </div>
                                  <div>
                                    <Label>Duração (min)</Label>
                                    <Input
                                      type="number"
                                      value={episode.runtime}
                                      onChange={(e) => updateEpisode(seasonIndex, episodeIndex, 'runtime', parseInt(e.target.value) || 0)}
                                      placeholder="45"
                                    />
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  onClick={() => removeEpisode(seasonIndex, episodeIndex)}
                                  variant="destructive"
                                  size="sm"
                                  className="ml-3"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>

                              <div>
                                <Label>Descrição do Episódio</Label>
                                <Textarea
                                  value={episode.overview}
                                  onChange={(e) => updateEpisode(seasonIndex, episodeIndex, 'overview', e.target.value)}
                                  rows={2}
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label>Thumbnail</Label>
                                  <Input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        updateEpisode(seasonIndex, episodeIndex, 'thumbnail_file', file);
                                        updateEpisode(seasonIndex, episodeIndex, 'thumbnail_path', file.name);
                                      }
                                    }}
                                  />
                                </div>
                                <div>
                                  <Label>Vídeo do Episódio</Label>
                                  <Input
                                    type="file"
                                    accept="video/*"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        updateEpisode(seasonIndex, episodeIndex, 'video_file', file);
                                        updateEpisode(seasonIndex, episodeIndex, 'video_url', file.name);
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {uploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{currentUploadStep}</span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <Progress value={uploadProgress} className="w-full" />
                </div>
              )}

              <Button type="submit" disabled={uploading || seasons.length === 0} className="w-full">
                {uploading ? 'Enviando...' : 'Enviar Série'}
                <Upload className="w-4 h-4 ml-2" />
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Series List */}
        <Card>
          <CardHeader>
            <CardTitle>Séries Cadastradas ({series.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading ? (
                <p className="text-center text-gray-500">Carregando séries...</p>
              ) : (
                series.map((serie) => (
                  <div key={serie.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{serie.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{serie.overview}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {serie.status === 'ongoing' ? 'Em andamento' : 
                             serie.status === 'completed' ? 'Concluída' : 'Cancelada'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {serie.seasons?.length || 0} temporadas
                          </span>
                          <span className="text-xs text-gray-500">
                            {serie.genres?.join(', ')}
                          </span>
                        </div>
                        {serie.poster_path && (
                          <img
                            src={serie.poster_path}
                            alt={serie.title}
                            className="w-20 h-28 object-cover rounded mt-2"
                          />
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            // Expand/collapse seasons
                            if (serie.seasons && serie.seasons.length > 0) {
                              const firstSeason = serie.seasons[0];
                              if (firstSeason.episodes && firstSeason.episodes.length > 0) {
                                window.open(firstSeason.episodes[0].video_url, '_blank');
                              }
                            }
                          }}
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => serie.id && deleteSeries(serie.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Seasons and Episodes Accordion */}
                    {serie.seasons && serie.seasons.length > 0 && (
                      <div className="mt-4">
                        <Accordion type="multiple" className="w-full">
                          {serie.seasons.map((season) => (
                            <AccordionItem key={season.id} value={`season-${season.seasonNumber}`}>
                              <AccordionTrigger>
                                <div className="flex items-center justify-between w-full mr-4">
                                  <span>Temporada {season.seasonNumber}: {season.title}</span>
                                  <span className="text-sm text-gray-500">
                                    {season.episodes?.length || 0} episódios
                                  </span>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="space-y-2">
                                  {season.episodes?.map((episode) => (
                                    <div key={episode.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                      <div>
                                        <span className="font-medium">
                                          {episode.episodeNumber}. {episode.title}
                                        </span>
                                        <p className="text-sm text-gray-600">{episode.overview}</p>
                                        <span className="text-xs text-gray-500">
                                          {episode.runtime} min
                                        </span>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => window.open(episode.video_url, '_blank')}
                                      >
                                        <Play className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  ))}
                                  {(!season.episodes || season.episodes.length === 0) && (
                                    <p className="text-center text-gray-500 py-4">
                                      Nenhum episódio adicionado ainda.
                                    </p>
                                  )}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </div>
                    )}
                  </div>
                ))
              )}
              {series.length === 0 && !loading && (
                <p className="text-center text-gray-500">Nenhuma série cadastrada ainda.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
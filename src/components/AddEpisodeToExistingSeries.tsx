import React, { useState, useEffect } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { storage, db } from '../config/firebase';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Progress } from './ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useToast } from '../hooks/use-toast';
import { Upload, Play, Calendar, Clock } from 'lucide-react';

interface Episode {
  episodeNumber: number;
  title: string;
  overview: string;
  runtime: number;
  airDate: string;
  thumbnailFile?: File;
  videoFile?: File;
}

interface Season {
  id: string;
  seasonNumber: number;
  title: string;
}

interface Series {
  id: string;
  title: string;
  seasons: Season[];
}

export default function AddEpisodeToExistingSeries() {
  const [series, setSeries] = useState<Series[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('');
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [episode, setEpisode] = useState<Episode>({
    episodeNumber: 1,
    title: '',
    overview: '',
    runtime: 0,
    airDate: '',
  });
  
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentUploadStep, setCurrentUploadStep] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    loadSeries();
  }, []);

  const loadSeries = async () => {
    try {
      const seriesSnapshot = await getDocs(collection(db, 'series'));
      const seriesData: Series[] = [];
      
      for (const docSnap of seriesSnapshot.docs) {
        const seriesInfo = { id: docSnap.id, ...docSnap.data() } as any;
        
        // Load seasons for this series
        const seasonsSnapshot = await getDocs(collection(db, `series/${docSnap.id}/seasons`));
        const seasons: Season[] = seasonsSnapshot.docs.map(seasonDoc => ({
          id: seasonDoc.id,
          ...seasonDoc.data()
        })) as Season[];
        
        seriesData.push({
          id: docSnap.id,
          title: seriesInfo.title,
          seasons: seasons
        });
      }
      
      setSeries(seriesData);
    } catch (error) {
      console.error('Erro ao carregar séries:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar séries. Tente novamente.",
        variant: "destructive",
      });
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

  const handleSeriesChange = (seriesId: string) => {
    setSelectedSeriesId(seriesId);
    setSelectedSeasonId('');
    setEpisode({
      episodeNumber: 1,
      title: '',
      overview: '',
      runtime: 0,
      airDate: '',
    });
    
    // Update episode number based on selected season
    const selectedSeries = series.find(s => s.id === seriesId);
    if (selectedSeries && selectedSeries.seasons.length > 0) {
      // Will be updated when season is selected
    }
  };

  const handleSeasonChange = async (seasonId: string) => {
    setSelectedSeasonId(seasonId);
    
    // Get current episode count to set next episode number
    try {
      const episodesSnapshot = await getDocs(
        collection(db, `series/${selectedSeriesId}/seasons/${seasonId}/episodes`)
      );
      const nextEpisodeNumber = episodesSnapshot.size + 1;
      
      setEpisode(prev => ({
        ...prev,
        episodeNumber: nextEpisodeNumber,
        title: `Episódio ${nextEpisodeNumber}`
      }));
    } catch (error) {
      console.error('Erro ao contar episódios:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeriesId || !selectedSeasonId || !episode.title) return;

    setUploading(true);
    setUploadProgress(0);
    setCurrentUploadStep('Iniciando upload...');

    try {
      let thumbnailUrl = '';
      let videoUrl = '';

      // Upload thumbnail if provided
      if (episode.thumbnailFile) {
        setCurrentUploadStep('Enviando thumbnail...');
        const thumbnailPath = `series/episodes/thumbnails/${Date.now()}_${episode.thumbnailFile.name}`;
        thumbnailUrl = await uploadFile(episode.thumbnailFile, thumbnailPath);
      }

      // Upload video
      if (episode.videoFile) {
        setCurrentUploadStep('Enviando vídeo...');
        const videoPath = `series/episodes/videos/${Date.now()}_${episode.videoFile.name}`;
        videoUrl = await uploadFile(episode.videoFile, videoPath);
      }

      // Create episode document
      setCurrentUploadStep('Salvando episódio...');
      await addDoc(collection(db, `series/${selectedSeriesId}/seasons/${selectedSeasonId}/episodes`), {
        episodeNumber: episode.episodeNumber,
        title: episode.title,
        overview: episode.overview,
        runtime: episode.runtime,
        airDate: new Date(episode.airDate),
        thumbnail_path: thumbnailUrl,
        video_url: videoUrl,
        createdAt: new Date()
      });

      // Update season episode count
      const seasonDoc = await getDoc(doc(db, `series/${selectedSeriesId}/seasons/${selectedSeasonId}`));
      if (seasonDoc.exists()) {
        const currentEpisodeCount = seasonDoc.data().episodeCount || 0;
        await updateDoc(doc(db, `series/${selectedSeriesId}/seasons/${selectedSeasonId}`), {
          episodeCount: currentEpisodeCount + 1
        });
      }

      // Reset form
      setEpisode({
        episodeNumber: 1,
        title: '',
        overview: '',
        runtime: 0,
        airDate: '',
      });
      setSelectedSeasonId('');
      setUploadProgress(0);
      setCurrentUploadStep('');

      // Reload series data
      loadSeries();

      toast({
        title: "Sucesso!",
        description: "Episódio adicionado com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao adicionar episódio:', error);
      toast({
        title: "Erro",
        description: "Erro ao adicionar episódio. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setCurrentUploadStep('');
    }
  };

  const selectedSeries = series.find(s => s.id === selectedSeriesId);
  const selectedSeason = selectedSeries?.seasons.find(s => s.id === selectedSeasonId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Adicionar Episódio a Série Existente</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Series Selection */}
          <div className="space-y-2">
            <Label htmlFor="series">Selecionar Série</Label>
            <Select value={selectedSeriesId} onValueChange={handleSeriesChange}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha uma série..." />
              </SelectTrigger>
              <SelectContent>
                {series.map((serie) => (
                  <SelectItem key={serie.id} value={serie.id}>
                    {serie.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Season Selection */}
          {selectedSeriesId && (
            <div className="space-y-2">
              <Label htmlFor="season">Selecionar Temporada</Label>
              <Select value={selectedSeasonId} onValueChange={handleSeasonChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha uma temporada..." />
                </SelectTrigger>
                <SelectContent>
                  {selectedSeries?.seasons.map((season) => (
                    <SelectItem key={season.id} value={season.id}>
                      Temporada {season.seasonNumber}: {season.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Episode Form */}
          {selectedSeasonId && (
            <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
              <h3 className="font-semibold text-lg">
                Adicionar Episódio à {selectedSeason?.title}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="episodeNumber">Número do Episódio</Label>
                  <Input
                    id="episodeNumber"
                    type="number"
                    value={episode.episodeNumber}
                    onChange={(e) => setEpisode(prev => ({ 
                      ...prev, 
                      episodeNumber: parseInt(e.target.value) || 1 
                    }))}
                    min="1"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="airDate">Data de Exibição</Label>
                  <Input
                    id="airDate"
                    type="date"
                    value={episode.airDate}
                    onChange={(e) => setEpisode(prev => ({ ...prev, airDate: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="episodeTitle">Título do Episódio</Label>
                <Input
                  id="episodeTitle"
                  value={episode.title}
                  onChange={(e) => setEpisode(prev => ({ ...prev, title: e.target.value }))}
                  placeholder={`Episódio ${episode.episodeNumber}`}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="episodeOverview">Descrição do Episódio</Label>
                <Textarea
                  id="episodeOverview"
                  value={episode.overview}
                  onChange={(e) => setEpisode(prev => ({ ...prev, overview: e.target.value }))}
                  rows={3}
                  placeholder="Resumo do episódio..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="runtime">Duração (minutos)</Label>
                <Input
                  id="runtime"
                  type="number"
                  value={episode.runtime}
                  onChange={(e) => setEpisode(prev => ({ 
                    ...prev, 
                    runtime: parseInt(e.target.value) || 0 
                  }))}
                  placeholder="45"
                  min="1"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="thumbnail">Thumbnail (Imagem de Capa)</Label>
                  <Input
                    id="thumbnail"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setEpisode(prev => ({ 
                      ...prev, 
                      thumbnailFile: e.target.files?.[0] || undefined 
                    }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="video">Arquivo do Vídeo</Label>
                  <Input
                    id="video"
                    type="file"
                    accept="video/*"
                    onChange={(e) => setEpisode(prev => ({ 
                      ...prev, 
                      videoFile: e.target.files?.[0] || undefined 
                    }))}
                    required
                  />
                </div>
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

              <Button 
                type="submit" 
                disabled={uploading} 
                className="w-full"
              >
                {uploading ? 'Enviando...' : 'Adicionar Episódio'}
                <Upload className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </form>

        {/* Preview Section */}
        {selectedSeriesId && selectedSeasonId && episode.title && (
          <div className="mt-6 p-4 border rounded-lg">
            <h4 className="font-semibold mb-3">Pré-visualização</h4>
            <div className="flex gap-4">
              <div className="w-32 h-20 bg-gray-200 rounded flex items-center justify-center">
                {episode.thumbnailFile ? (
                  <img 
                    src={URL.createObjectURL(episode.thumbnailFile)} 
                    alt="Thumbnail" 
                    className="w-full h-full object-cover rounded"
                  />
                ) : (
                  <span className="text-gray-500 text-xs">Thumbnail</span>
                )}
              </div>
              <div className="flex-1">
                <h5 className="font-medium">
                  S{selectedSeries?.seasons.find(s => s.id === selectedSeasonId)?.seasonNumber}E{episode.episodeNumber}: {episode.title}
                </h5>
                <p className="text-sm text-gray-600 line-clamp-2">{episode.overview}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {episode.runtime} min
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {episode.airDate}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
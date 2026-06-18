import React, { useState, useEffect, useCallback } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, getDocs, doc, getDoc } from 'firebase/firestore';
import { storage, db } from '../config/firebase';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Progress } from './ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useToast } from '../hooks/use-toast';
import { Upload, Calendar, Layers } from 'lucide-react';
import { compressImage } from '../utils/compressImage';

interface SeriesItem {
  id: string;
  title: string;
  seasonsCount: number;
}

export default function AddSeasonToExistingSeries() {
  const [series, setSeries] = useState<SeriesItem[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('');
  
  const [seasonNumber, setSeasonNumber] = useState<number>(1);
  const [title, setTitle] = useState<string>('');
  const [overview, setOverview] = useState<string>('');
  const [airDate, setAirDate] = useState<string>('');
  const [posterFile, setPosterFile] = useState<File | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentUploadStep, setCurrentUploadStep] = useState('');
  const { toast } = useToast();

  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const loadSeries = useCallback(async () => {
    try {
      const seriesSnapshot = await getDocs(collection(db, 'series'));
      const seriesData: SeriesItem[] = [];

      for (const docSnap of seriesSnapshot.docs) {
        const titleVal = docSnap.data().title || '';
        
        // Count existing seasons for this series
        const seasonsSnapshot = await getDocs(collection(db, `series/${docSnap.id}/seasons`));
        
        seriesData.push({
          id: docSnap.id,
          title: titleVal,
          seasonsCount: seasonsSnapshot.size
        });
      }

      // Sort series alphabetically
      seriesData.sort((a, b) => a.title.localeCompare(b.title));
      setSeries(seriesData);
    } catch (error) {
      console.error('Erro ao carregar séries:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar séries. Tente novamente.",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    loadSeries();
  }, [loadSeries]);

  const handleSeriesChange = (seriesId: string) => {
    setSelectedSeriesId(seriesId);
    
    const selected = series.find(s => s.id === seriesId);
    if (selected) {
      const nextNum = selected.seasonsCount + 1;
      setSeasonNumber(nextNum);
      setTitle(`Temporada ${nextNum}`);
    } else {
      setSeasonNumber(1);
      setTitle('Temporada 1');
    }
    
    setOverview('');
    setAirDate(getTodayString());
    setPosterFile(null);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeriesId || !title) return;

    setUploading(true);
    setUploadProgress(0);
    setCurrentUploadStep('Iniciando upload...');

    try {
      let posterUrl = '';

      // Upload poster if provided
      if (posterFile) {
        setCurrentUploadStep('🖼️ Comprimindo poster da temporada...');
        let posterToUpload = posterFile;
        try {
          const r = await compressImage(posterFile, { maxWidth: 800, maxHeight: 1200 });
          posterToUpload = r.file;
        } catch (err) {
          console.warn('Falha na compressão da imagem:', err);
        }
        
        setCurrentUploadStep('📤 Enviando poster...');
        const posterPath = `series/seasons/${Date.now()}_${posterToUpload.name}`;
        posterUrl = await uploadFile(posterToUpload, posterPath);
      }

      // Create season document in the subcollection
      setCurrentUploadStep('Salvando temporada...');
      await addDoc(collection(db, `series/${selectedSeriesId}/seasons`), {
        seasonNumber: seasonNumber,
        title: title,
        overview: overview,
        poster_path: posterUrl,
        airDate: airDate ? new Date(airDate) : new Date(),
        episodeCount: 0,
        createdAt: new Date()
      });

      // Reset form
      setOverview('');
      setPosterFile(null);
      setUploadProgress(0);
      setCurrentUploadStep('');

      // Reload series data to update counts
      await loadSeries();
      
      // Update fields for next possible season addition
      const updatedSelected = series.find(s => s.id === selectedSeriesId);
      if (updatedSelected) {
        // Increment the local state's understanding since loadSeries finished
        const nextNum = (updatedSelected.seasonsCount || 0) + 2; // +1 existing + 1 new
        setSeasonNumber(nextNum);
        setTitle(`Temporada ${nextNum}`);
      } else {
        setSelectedSeriesId('');
      }

      toast({
        title: "Sucesso!",
        description: "Temporada adicionada com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao adicionar temporada:', error);
      toast({
        title: "Erro",
        description: "Erro ao adicionar temporada. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setCurrentUploadStep('');
    }
  };

  const selectedSeries = series.find(s => s.id === selectedSeriesId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Adicionar Temporada a Série Existente</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Series Selection */}
          <div className="space-y-2">
            <Label htmlFor="series-select">Selecionar Série</Label>
            <Select value={selectedSeriesId} onValueChange={handleSeriesChange}>
              <SelectTrigger id="series-select">
                <SelectValue placeholder="Escolha uma série..." />
              </SelectTrigger>
              <SelectContent>
                {series.map((serie) => (
                  <SelectItem key={serie.id} value={serie.id}>
                    {serie.title} ({serie.seasonsCount} {serie.seasonsCount === 1 ? 'temporada' : 'temporadas'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Season Form */}
          {selectedSeriesId && (
            <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-500" />
                Nova Temporada para "{selectedSeries?.title}"
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="seasonNumber">Número da Temporada</Label>
                  <Input
                    id="seasonNumber"
                    type="number"
                    value={seasonNumber}
                    onChange={(e) => {
                      const num = parseInt(e.target.value) || 1;
                      setSeasonNumber(num);
                      setTitle(`Temporada ${num}`);
                    }}
                    min="1"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="airDate">Data de Estreia</Label>
                  <Input
                    id="airDate"
                    type="date"
                    value={airDate}
                    onChange={(e) => setAirDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seasonTitle">Título da Temporada</Label>
                <Input
                  id="seasonTitle"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`Temporada ${seasonNumber}`}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seasonOverview">Sinopse da Temporada</Label>
                <Textarea
                  id="seasonOverview"
                  value={overview}
                  onChange={(e) => setOverview(e.target.value)}
                  rows={3}
                  placeholder="Resumo ou descrição da temporada..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="poster">Poster da Temporada (Imagem - Opcional)</Label>
                <Input
                  id="poster"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPosterFile(e.target.files?.[0] || null)}
                />
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
                {uploading ? 'Enviando...' : 'Adicionar Temporada'}
                <Upload className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </form>

        {/* Preview Section */}
        {selectedSeriesId && title && (
          <div className="mt-6 p-4 border rounded-lg bg-white">
            <h4 className="font-semibold mb-3">Pré-visualização da Temporada</h4>
            <div className="flex gap-4">
              <div className="w-24 h-36 bg-gray-200 rounded flex items-center justify-center overflow-hidden border">
                {posterFile ? (
                  <img 
                    src={URL.createObjectURL(posterFile)} 
                    alt="Poster Preview" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-gray-400 text-xs text-center p-2">Sem Poster</span>
                )}
              </div>
              <div className="flex-1">
                <h5 className="font-semibold text-base">
                  {selectedSeries?.title} - {title}
                </h5>
                <p className="text-sm text-gray-600 mt-1 line-clamp-3">
                  {overview || 'Nenhuma descrição fornecida.'}
                </p>
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Estreia: {airDate || 'Não definida'}
                  </span>
                  <span>0 episódios</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import React, { useState, useEffect } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { storage, db } from '../config/firebase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Progress } from '../components/ui/progress';
import { useToast } from '../hooks/use-toast';
import { Upload, Play, Trash2 } from 'lucide-react';
import { compressImage, formatBytes } from '../utils/compressImage';
import { compressVideo } from '../utils/compressVideo';

interface Movie {
  id?: string;
  title: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  movie_url: string;
  category: string;
}

const CATEGORIES = [
  "Ação", "Comédia", "Drama", "Suspense", "Terror", 
  "Documentário", "Kids", "Anime", "Ficção Científica"
];

export default function Movies() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentUploadStep, setCurrentUploadStep] = useState('');
  const { toast } = useToast();

  // Form states
  const [title, setTitle] = useState('');
  const [overview, setOverview] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [backdropFile, setBackdropFile] = useState<File | null>(null);
  const [movieFile, setMovieFile] = useState<File | null>(null);

  useEffect(() => {
    loadMovies();
  }, []);

  const loadMovies = async () => {
    try {
      // Load from both collections
      const [moviesSnapshot, aderesSnapshot] = await Promise.all([
        getDocs(collection(db, 'movies')),
        getDocs(collection(db, 'aderes_movie'))
      ]);

      const moviesData = moviesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Movie[];

      const aderesData = aderesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Movie[];

      setMovies([...moviesData, ...aderesData]);
    } catch (error) {
      console.error('Erro ao carregar filmes:', error);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movieFile || !title) return;

    setUploading(true);
    setUploadProgress(0);
    setCurrentUploadStep('Iniciando...');

    // Coleta info de tamanhos para o toast final
    const sizeInfo: string[] = [];

    try {
      // ── COMPRESSÃO + UPLOAD DO FILME ──────────────────────────────────────
      setCurrentUploadStep('🎬 Comprimindo vídeo (pode demorar alguns minutos)...');
      let fileToUpload = movieFile;
      try {
        const videoResult = await compressVideo(movieFile, (pct) => {
          setUploadProgress(pct * 0.5); // Compressão ocupa 0–50% da barra
          setCurrentUploadStep(`🎬 Comprimindo vídeo... ${pct}%`);
        });
        fileToUpload = videoResult.file;
        sizeInfo.push(`Vídeo: ${formatBytes(videoResult.originalSize)} → ${formatBytes(videoResult.compressedSize)} (${videoResult.reduction} menor)`);
      } catch (err) {
        console.warn('Compressão de vídeo falhou, enviando original:', err);
        sizeInfo.push('Vídeo: enviado sem compressão');
      }

      setCurrentUploadStep('📤 Enviando filme...');
      const moviePath = `movies/${Date.now()}_${fileToUpload.name}`;
      // Upload ocupa 50–80% da barra
      const movieUrl = await new Promise<string>((resolve, reject) => {
        const storageRef = ref(storage, moviePath);
        const task = uploadBytesResumable(storageRef, fileToUpload);
        task.on('state_changed',
          (snap) => setUploadProgress(50 + (snap.bytesTransferred / snap.totalBytes) * 30),
          reject,
          async () => resolve(await getDownloadURL(task.snapshot.ref))
        );
      });

      // ── COMPRESSÃO + UPLOAD DO POSTER ────────────────────────────────────
      let posterUrl = '';
      if (posterFile) {
        setCurrentUploadStep('🖼️ Comprimindo poster...');
        let posterToUpload = posterFile;
        try {
          const result = await compressImage(posterFile, { maxWidth: 800, maxHeight: 1200 });
          posterToUpload = result.file;
          sizeInfo.push(`Poster: ${formatBytes(result.originalSize)} → ${formatBytes(result.compressedSize)} (${result.reduction} menor)`);
        } catch {
          sizeInfo.push('Poster: enviado sem compressão');
        }
        setCurrentUploadStep('📤 Enviando poster...');
        const posterPath = `posters/${Date.now()}_${posterToUpload.name}`;
        posterUrl = await new Promise<string>((resolve, reject) => {
          const storageRef = ref(storage, posterPath);
          const task = uploadBytesResumable(storageRef, posterToUpload);
          task.on('state_changed',
            (snap) => setUploadProgress(80 + (snap.bytesTransferred / snap.totalBytes) * 8),
            reject,
            async () => resolve(await getDownloadURL(task.snapshot.ref))
          );
        });
      }

      // ── COMPRESSÃO + UPLOAD DO BACKDROP ─────────────────────────────────
      let backdropUrl = '';
      if (backdropFile) {
        setCurrentUploadStep('🖼️ Comprimindo backdrop...');
        let bdToUpload = backdropFile;
        try {
          const result = await compressImage(backdropFile, { maxWidth: 1280, maxHeight: 720 });
          bdToUpload = result.file;
          sizeInfo.push(`Backdrop: ${formatBytes(result.originalSize)} → ${formatBytes(result.compressedSize)} (${result.reduction} menor)`);
        } catch {
          sizeInfo.push('Backdrop: enviado sem compressão');
        }
        setCurrentUploadStep('📤 Enviando backdrop...');
        const backdropPath = `backdrops/${Date.now()}_${bdToUpload.name}`;
        backdropUrl = await new Promise<string>((resolve, reject) => {
          const storageRef = ref(storage, backdropPath);
          const task = uploadBytesResumable(storageRef, bdToUpload);
          task.on('state_changed',
            (snap) => setUploadProgress(88 + (snap.bytesTransferred / snap.totalBytes) * 8),
            reject,
            async () => resolve(await getDownloadURL(task.snapshot.ref))
          );
        });
      }

      // ── SALVAR NO FIRESTORE ───────────────────────────────────────────────
      setCurrentUploadStep('💾 Salvando informações...');
      setUploadProgress(98);
      await addDoc(collection(db, 'movies'), {
        title,
        overview,
        category,
        poster_path: posterUrl,
        backdrop_path: backdropUrl,
        movie_url: movieUrl,
      });

      setUploadProgress(100);

      // Reset form
      setTitle('');
      setOverview('');
      setPosterFile(null);
      setBackdropFile(null);
      setMovieFile(null);
      setUploadProgress(0);
      setCurrentUploadStep('');

      loadMovies();

      toast({
        title: '✅ Filme enviado com sucesso!',
        description: sizeInfo.join(' | '),
      });
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao enviar filme. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setCurrentUploadStep('');
    }
  };

  const updateCategory = async (movieId: string, currentCategory: string) => {
    const newCategory = prompt('Nova categoria:', currentCategory);
    if (!newCategory || newCategory === currentCategory) return;

    try {
      await updateDoc(doc(db, 'movies', movieId), {
        category: newCategory
      });
      toast({
        title: 'Sucesso',
        description: 'Categoria atualizada com sucesso.',
      });
      loadMovies();
    } catch (error) {
      console.error('Erro ao atualizar categoria:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar categoria.',
        variant: 'destructive',
      });
    }
  };

  const deleteMovie = async (movieId: string) => {
    if (!confirm('Tem certeza que deseja excluir este filme?')) return;

    try {
      await deleteDoc(doc(db, 'movies', movieId));
      loadMovies();
    } catch (error) {
      console.error('Erro ao excluir filme:', error);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Gerenciar Filmes</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Form */}
        <Card>
          <CardHeader>
            <CardTitle>Adicionar Novo Filme</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Título do Filme</Label>
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
                <Label htmlFor="category">Categoria</Label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md bg-transparent"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
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
                <Label htmlFor="movie">Arquivo do Filme</Label>
                <Input
                  id="movie"
                  type="file"
                  accept="video/*"
                  onChange={(e) => setMovieFile(e.target.files?.[0] || null)}
                  required
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

              <Button type="submit" disabled={uploading} className="w-full">
                {uploading ? 'Enviando...' : 'Enviar Filme'}
                <Upload className="w-4 h-4 ml-2" />
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Movies List */}
        <Card>
          <CardHeader>
            <CardTitle>Filmes Cadastrados ({movies.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {movies.map((movie) => (
                <div key={movie.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{movie.title}</h3>
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                          {movie.category || 'Sem categoria'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{movie.overview}</p>
                      {movie.poster_path && (
                        <img
                          src={movie.poster_path}
                          alt={movie.title}
                          crossOrigin="anonymous"
                          className="w-20 h-28 object-cover rounded mt-2"
                        />
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(movie.movie_url, '_blank')}
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        title="Mudar categoria"
                        onClick={() => movie.id && updateCategory(movie.id, movie.category)}
                      >
                        Sub
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => movie.id && deleteMovie(movie.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {movies.length === 0 && (
                <p className="text-center text-gray-500">Nenhum filme cadastrado ainda.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
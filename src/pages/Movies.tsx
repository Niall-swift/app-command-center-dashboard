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
import { Upload, Play, Trash2, Edit } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { compressImage, formatBytes } from '../utils/compressImage';
import { compressVideo } from '../utils/compressVideo';

interface Movie {
  id?: string;
  title: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  movie_url: string;
  trailer_url?: string;
  category: string;
  collectionName?: 'movies' | 'aderes_movie';
  createdAt?: any;
  updatedAt?: any;
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
  const [trailerFile, setTrailerFile] = useState<File | null>(null);

  // Edit states
  const [editingMovie, setEditingMovie] = useState<Movie | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editOverview, setEditOverview] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editMovieUrl, setEditMovieUrl] = useState('');
  const [editTrailerUrl, setEditTrailerUrl] = useState('');
  const [editPosterFile, setEditPosterFile] = useState<File | null>(null);
  const [editBackdropFile, setEditBackdropFile] = useState<File | null>(null);
  const [editMovieFile, setEditMovieFile] = useState<File | null>(null);
  const [editTrailerFile, setEditTrailerFile] = useState<File | null>(null);

  const startEditMovie = (movie: Movie) => {
    setEditingMovie(movie);
    setEditTitle(movie.title || '');
    setEditOverview(movie.overview || '');
    setEditCategory(movie.category || CATEGORIES[0]);
    setEditMovieUrl(movie.movie_url || '');
    setEditTrailerUrl(movie.trailer_url || '');
    setEditPosterFile(null);
    setEditBackdropFile(null);
    setEditMovieFile(null);
    setEditTrailerFile(null);
  };

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
        collectionName: 'movies',
        ...doc.data()
      })) as Movie[];

      const aderesData = aderesSnapshot.docs.map(doc => ({
        id: doc.id,
        collectionName: 'aderes_movie',
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
          setUploadProgress(pct * 0.4); // Compressão do filme ocupa 0–40%
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
      // Upload do filme ocupa 40–70% da barra
      const movieUrl = await new Promise<string>((resolve, reject) => {
        const storageRef = ref(storage, moviePath);
        const task = uploadBytesResumable(storageRef, fileToUpload);
        task.on('state_changed',
          (snap) => setUploadProgress(40 + (snap.bytesTransferred / snap.totalBytes) * 30),
          reject,
          async () => resolve(await getDownloadURL(task.snapshot.ref))
        );
      });

      // ── COMPRESSÃO + UPLOAD DO TRAILER ─────────────────────────────────────
      let trailerUrl = '';
      if (trailerFile) {
        setCurrentUploadStep('🎬 Comprimindo trailer...');
        let trailerToUpload = trailerFile;
        try {
          const videoResult = await compressVideo(trailerFile, (pct) => {
            setUploadProgress(70 + pct * 0.05); // Compressão do trailer ocupa 70-75%
            setCurrentUploadStep(`🎬 Comprimindo trailer... ${pct}%`);
          });
          trailerToUpload = videoResult.file;
          sizeInfo.push(`Trailer: ${formatBytes(videoResult.originalSize)} → ${formatBytes(videoResult.compressedSize)} (${videoResult.reduction} menor)`);
        } catch (err) {
          console.warn('Compressão de trailer falhou, enviando original:', err);
          sizeInfo.push('Trailer: enviado sem compressão');
        }

        setCurrentUploadStep('📤 Enviando trailer...');
        const trailerPath = `movies/trailers/${Date.now()}_${trailerToUpload.name}`;
        // Upload do trailer ocupa 75–85%
        trailerUrl = await new Promise<string>((resolve, reject) => {
          const storageRef = ref(storage, trailerPath);
          const task = uploadBytesResumable(storageRef, trailerToUpload);
          task.on('state_changed',
            (snap) => setUploadProgress(75 + (snap.bytesTransferred / snap.totalBytes) * 10),
            reject,
            async () => resolve(await getDownloadURL(task.snapshot.ref))
          );
        });
      }

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
            (snap) => setUploadProgress(85 + (snap.bytesTransferred / snap.totalBytes) * 5),
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
            (snap) => setUploadProgress(90 + (snap.bytesTransferred / snap.totalBytes) * 6),
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
        trailer_url: trailerUrl,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      setUploadProgress(100);

      // Reset form
      setTitle('');
      setOverview('');
      setPosterFile(null);
      setBackdropFile(null);
      setMovieFile(null);
      setTrailerFile(null);
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
        category: newCategory,
        updatedAt: new Date()
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

  const deleteMovie = async (movieId: string, collectionName: 'movies' | 'aderes_movie' = 'movies') => {
    if (!confirm('Tem certeza que deseja excluir este filme?')) return;

    try {
      await deleteDoc(doc(db, collectionName, movieId));
      loadMovies();
    } catch (error) {
      console.error('Erro ao excluir filme:', error);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMovie || !editTitle) return;

    setUploading(true);
    setUploadProgress(0);
    setCurrentUploadStep('Iniciando atualização...');

    const collectionName = editingMovie.collectionName || 'movies';

    try {
      let movieUrl = editMovieUrl;
      let trailerUrl = editTrailerUrl;
      let posterUrl = editingMovie.poster_path;
      let backdropUrl = editingMovie.backdrop_path;

      // 1. Upload new movie file if selected
      if (editMovieFile) {
        setCurrentUploadStep('🎬 Comprimindo novo vídeo (pode demorar)...');
        let fileToUpload = editMovieFile;
        try {
          const videoResult = await compressVideo(editMovieFile, (pct) => {
            setUploadProgress(pct * 0.4);
            setCurrentUploadStep(`🎬 Comprimindo novo vídeo... ${pct}%`);
          });
          fileToUpload = videoResult.file;
        } catch (err) {
          console.warn('Compressão de vídeo falhou:', err);
        }
        setCurrentUploadStep('📤 Enviando novo filme...');
        const path = `movies/${Date.now()}_${fileToUpload.name}`;
        movieUrl = await new Promise<string>((resolve, reject) => {
          const storageRef = ref(storage, path);
          const task = uploadBytesResumable(storageRef, fileToUpload);
          task.on('state_changed',
            (snap) => setUploadProgress(40 + (snap.bytesTransferred / snap.totalBytes) * 30),
            reject,
            async () => resolve(await getDownloadURL(task.snapshot.ref))
          );
        });
      }

      // 2. Upload new trailer file if selected
      if (editTrailerFile) {
        setCurrentUploadStep('🎬 Comprimindo novo trailer...');
        let fileToUpload = editTrailerFile;
        try {
          const videoResult = await compressVideo(editTrailerFile, (pct) => {
            setUploadProgress(70 + pct * 0.05);
            setCurrentUploadStep(`🎬 Comprimindo novo trailer... ${pct}%`);
          });
          fileToUpload = videoResult.file;
        } catch (err) {
          console.warn('Compressão de trailer falhou:', err);
        }
        setCurrentUploadStep('📤 Enviando novo trailer...');
        const path = `movies/trailers/${Date.now()}_${fileToUpload.name}`;
        trailerUrl = await new Promise<string>((resolve, reject) => {
          const storageRef = ref(storage, path);
          const task = uploadBytesResumable(storageRef, fileToUpload);
          task.on('state_changed',
            (snap) => setUploadProgress(75 + (snap.bytesTransferred / snap.totalBytes) * 10),
            reject,
            async () => resolve(await getDownloadURL(task.snapshot.ref))
          );
        });
      }

      // 3. Upload new poster file if selected
      if (editPosterFile) {
        setCurrentUploadStep('🖼️ Comprimindo novo poster...');
        let fileToUpload = editPosterFile;
        try {
          const result = await compressImage(editPosterFile, { maxWidth: 800, maxHeight: 1200 });
          fileToUpload = result.file;
        } catch {}
        setCurrentUploadStep('📤 Enviando novo poster...');
        const path = `posters/${Date.now()}_${fileToUpload.name}`;
        posterUrl = await new Promise<string>((resolve, reject) => {
          const storageRef = ref(storage, path);
          const task = uploadBytesResumable(storageRef, fileToUpload);
          task.on('state_changed',
            (snap) => setUploadProgress(85 + (snap.bytesTransferred / snap.totalBytes) * 5),
            reject,
            async () => resolve(await getDownloadURL(task.snapshot.ref))
          );
        });
      }

      // 4. Upload new backdrop file if selected
      if (editBackdropFile) {
        setCurrentUploadStep('🖼️ Comprimindo novo backdrop...');
        let fileToUpload = editBackdropFile;
        try {
          const result = await compressImage(editBackdropFile, { maxWidth: 1280, maxHeight: 720 });
          fileToUpload = result.file;
        } catch {}
        setCurrentUploadStep('📤 Enviando novo backdrop...');
        const path = `backdrops/${Date.now()}_${fileToUpload.name}`;
        backdropUrl = await new Promise<string>((resolve, reject) => {
          const storageRef = ref(storage, path);
          const task = uploadBytesResumable(storageRef, fileToUpload);
          task.on('state_changed',
            (snap) => setUploadProgress(90 + (snap.bytesTransferred / snap.totalBytes) * 6),
            reject,
            async () => resolve(await getDownloadURL(task.snapshot.ref))
          );
        });
      }

      // Update Firestore document
      setCurrentUploadStep('💾 Salvando alterações...');
      setUploadProgress(98);
      
      const docRef = doc(db, collectionName, editingMovie.id!);
      await updateDoc(docRef, {
        title: editTitle,
        overview: editOverview,
        category: editCategory,
        movie_url: movieUrl,
        trailer_url: trailerUrl,
        poster_path: posterUrl,
        backdrop_path: backdropUrl,
        updatedAt: new Date()
      });

      setUploadProgress(100);
      setEditingMovie(null);
      loadMovies();

      toast({
        title: '✅ Filme atualizado com sucesso!',
      });
    } catch (error) {
      console.error('Erro ao atualizar filme:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar filme. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setCurrentUploadStep('');
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
                <Label htmlFor="trailer">Arquivo do Trailer (Opcional)</Label>
                <Input
                  id="trailer"
                  type="file"
                  accept="video/*"
                  onChange={(e) => setTrailerFile(e.target.files?.[0] || null)}
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
                        title="Assistir Filme"
                        onClick={() => window.open(movie.movie_url, '_blank')}
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                      {movie.trailer_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          title="Assistir Trailer"
                          onClick={() => window.open(movie.trailer_url, '_blank')}
                        >
                          <Play className="w-4 h-4 text-blue-500" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        title="Editar Filme"
                        onClick={() => startEditMovie(movie)}
                      >
                        <Edit className="w-4 h-4" />
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
                        onClick={() => movie.id && deleteMovie(movie.id, movie.collectionName)}
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

      {/* Edit Movie Dialog */}
      <Dialog open={editingMovie !== null} onOpenChange={(open) => !open && setEditingMovie(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Filme</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 pt-4">
            <div>
              <Label htmlFor="edit-title">Título do Filme</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="edit-overview">Descrição</Label>
              <Textarea
                id="edit-overview"
                value={editOverview}
                onChange={(e) => setEditOverview(e.target.value)}
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="edit-category">Categoria</Label>
              <select
                id="edit-category"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md bg-transparent"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="edit-movie-url">URL do Filme (Link direto)</Label>
              <Input
                id="edit-movie-url"
                value={editMovieUrl}
                onChange={(e) => setEditMovieUrl(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="edit-movie-file">Substituir Arquivo do Filme (Vídeo)</Label>
              <Input
                id="edit-movie-file"
                type="file"
                accept="video/*"
                onChange={(e) => setEditMovieFile(e.target.files?.[0] || null)}
              />
            </div>

            <div>
              <Label htmlFor="edit-trailer-url">URL do Trailer (Link direto)</Label>
              <Input
                id="edit-trailer-url"
                value={editTrailerUrl}
                onChange={(e) => setEditTrailerUrl(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="edit-trailer-file">Substituir Arquivo do Trailer (Vídeo)</Label>
              <Input
                id="edit-trailer-file"
                type="file"
                accept="video/*"
                onChange={(e) => setEditTrailerFile(e.target.files?.[0] || null)}
              />
            </div>

            <div>
              <Label htmlFor="edit-poster">Substituir Poster (Imagem de Capa)</Label>
              <Input
                id="edit-poster"
                type="file"
                accept="image/*"
                onChange={(e) => setEditPosterFile(e.target.files?.[0] || null)}
              />
            </div>

            <div>
              <Label htmlFor="edit-backdrop">Substituir Backdrop (Imagem de Fundo)</Label>
              <Input
                id="edit-backdrop"
                type="file"
                accept="image/*"
                onChange={(e) => setEditBackdropFile(e.target.files?.[0] || null)}
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

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setEditingMovie(null)} disabled={uploading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={uploading}>
                {uploading ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
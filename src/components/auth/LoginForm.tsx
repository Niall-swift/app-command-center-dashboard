import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Mail, Lock, Chrome, Eye, EyeOff, ShieldCheck, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

function translateFirebaseAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'E-mail ou senha incorretos. Verifique suas credenciais.';
    case 'auth/user-disabled':
      return 'Esta conta foi desativada pelo administrador.';
    case 'auth/invalid-email':
      return 'Formato de e-mail inválido.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas de login. Aguarde alguns instantes e tente novamente.';
    case 'auth/popup-closed-by-user':
      return 'Login com Google cancelado.';
    default:
      return error instanceof Error ? error.message : 'Ocorreu um erro. Tente novamente.';
  }
}

export const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { signInWithEmail, signInWithGoogle } = useAuth();
  const { toast } = useToast();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signInWithEmail(email, password);
      toast({
        title: 'Login realizado com sucesso!',
        description: 'Carregando suas permissões de acesso...',
      });
    } catch (error) {
      toast({
        title: 'Erro na autenticação',
        description: translateFirebaseAuthError(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      toast({
        title: 'Login realizado com sucesso!',
        description: 'Carregando suas permissões de acesso...',
      });
    } catch (error) {
      toast({
        title: 'Erro no login com Google',
        description: translateFirebaseAuthError(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4 avl-canvas-bg">
      <Card className="w-full max-w-md bg-card/95 backdrop-blur-xl border-border shadow-2xl text-card-foreground rounded-2xl">
        <CardHeader className="space-y-2 text-center pb-2">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/30 text-primary flex items-center justify-center mx-auto shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            AVL Telecom · Painel NOC
          </CardTitle>
          <CardDescription>
            Entre com seu login de Administrador ou Operador autorizado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail de acesso</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="operador@avltelecom.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Entrando...' : 'Entrar no Painel'}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full"
          >
            <Chrome className="mr-2 h-4 w-4" />
            Entrar com Google
          </Button>

          <p className="text-[11px] text-center text-muted-foreground pt-1">
            Novos logins de operadores são criados pelo Administrador em Configurações.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

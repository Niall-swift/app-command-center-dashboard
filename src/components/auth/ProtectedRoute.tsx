import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Lock, LogOut, ShieldAlert, ArrowRight, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { LoginForm } from './LoginForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getScreenLabelByPath } from '@/config/permissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, panelProfile, loading, profileLoading, logout, refreshPanelProfile } = useAuth();

  if (loading || (user && profileLoading && !panelProfile)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-2.5">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto" />
          <p className="text-xs text-muted-foreground font-medium">
            Verificando credenciais e permissões...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  if (!panelProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4 avl-canvas-bg">
        <Card className="w-full max-w-md border-amber-500/30 bg-card shadow-2xl rounded-2xl">
          <CardHeader className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl font-bold">Acesso não autorizado</CardTitle>
            <CardDescription>
              A conta <span className="font-semibold text-foreground">{user.email}</span> ainda não
              foi cadastrada como Operador ou Administrador do painel.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              Solicite ao Administrador que cadastre seu acesso na tela de{' '}
              <strong>Configurações → Controle de Acesso &amp; Operadores</strong>.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => {
                  void refreshPanelProfile();
                }}
              >
                <RefreshCw className="w-4 h-4" />
                Verificar novamente
              </Button>
              <Button
                variant="destructive"
                className="flex-1 gap-2"
                onClick={() => {
                  void logout();
                }}
              >
                <LogOut className="w-4 h-4" />
                Sair
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!panelProfile.active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4 avl-canvas-bg">
        <Card className="w-full max-w-md border-rose-500/30 bg-card shadow-2xl rounded-2xl">
          <CardHeader className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-500 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl font-bold">Conta desativada</CardTitle>
            <CardDescription>
              O acesso de <span className="font-semibold text-foreground">{panelProfile.name}</span>{' '}
              ({panelProfile.email}) está temporariamente bloqueado pelo Administrador.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              className="w-full gap-2"
              onClick={() => {
                void logout();
              }}
            >
              <LogOut className="w-4 h-4" />
              Sair da conta
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

export const RoutePermissionGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { panelProfile, isAdmin, canAccessRoute, firstAllowedRoute, logout } = useAuth();

  if (!panelProfile || isAdmin) {
    return <>{children}</>;
  }

  const allowedRoutes = Array.isArray(panelProfile.allowedRoutes) ? panelProfile.allowedRoutes : [];

  if (allowedRoutes.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <Card className="w-full max-w-md border-amber-500/30 bg-card shadow-lg rounded-2xl">
          <CardHeader className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <CardTitle className="text-lg font-bold">Nenhuma tela liberada</CardTitle>
            <CardDescription>
              Seu perfil de operador ainda não possui telas autorizadas. Peça ao Administrador para
              liberar o acesso nas Configurações.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => {
                void logout();
              }}
            >
              <LogOut className="w-4 h-4" />
              Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (canAccessRoute(location.pathname)) {
    return <>{children}</>;
  }

  // Se o operador acessou a raiz "/" mas não tem Dashboard liberado, redireciona direto para sua primeira tela liberada
  if (location.pathname === '/' && firstAllowedRoute !== '/') {
    return <Navigate to={firstAllowedRoute} replace />;
  }

  const blockedLabel = getScreenLabelByPath(location.pathname);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <Card className="w-full max-w-md border-rose-500/30 bg-card shadow-xl rounded-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-500 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <CardTitle className="text-lg font-bold">Acesso restrito a esta tela</CardTitle>
          <CardDescription>
            Seu login de operador não tem permissão para abrir{' '}
            <span className="font-semibold text-foreground">{blockedLabel}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            className="w-full gap-2"
            onClick={() => navigate(firstAllowedRoute, { replace: true })}
          >
            Ir para {getScreenLabelByPath(firstAllowedRoute)}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

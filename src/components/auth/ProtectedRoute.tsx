import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Lock, LogOut, ShieldAlert, ArrowRight, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { LoginForm } from './LoginForm';
import { Ps5UserSplashScreen } from './Ps5UserSplashScreen';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getScreenLabelByPath } from '@/config/permissions';
import { panelUsersService } from '@/services/panelUsersService';
import { readCachedSplashUser } from '@/utils/userSplashCache';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const WELCOME_SPLASH_MS = 1800;

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const {
    user,
    panelProfile,
    loading,
    profileLoading,
    pinUnlocked,
    unlockPinSession,
    logout,
    refreshPanelProfile,
  } = useAuth();
  const [cachedSplashUser] = useState(() => readCachedSplashUser());
  const [showWelcomeSplash, setShowWelcomeSplash] = useState(false);
  const welcomedUidRef = useRef<string | null>(null);
  const welcomeTimerRef = useRef<number | null>(null);

  const needsPinEntry = Boolean(
    user && panelProfile && panelProfile.active && panelProfile.hasPin && !pinUnlocked
  );

  // Para usuários sem PIN configurado, exibe brevemente a tela minimalista de boas-vindas
  useEffect(() => {
    if (!user || needsPinEntry) {
      if (!user) welcomedUidRef.current = null;
      setShowWelcomeSplash(false);
      if (welcomeTimerRef.current !== null) {
        window.clearTimeout(welcomeTimerRef.current);
        welcomeTimerRef.current = null;
      }
      return;
    }

    if (
      panelProfile &&
      panelProfile.active &&
      !panelProfile.hasPin &&
      welcomedUidRef.current !== user.uid
    ) {
      welcomedUidRef.current = user.uid;
      setShowWelcomeSplash(true);

      if (welcomeTimerRef.current !== null) {
        window.clearTimeout(welcomeTimerRef.current);
      }
      welcomeTimerRef.current = window.setTimeout(() => {
        setShowWelcomeSplash(false);
        welcomeTimerRef.current = null;
      }, WELCOME_SPLASH_MS);
    }
  }, [user, panelProfile, needsPinEntry]);

  useEffect(() => {
    return () => {
      if (welcomeTimerRef.current !== null) {
        window.clearTimeout(welcomeTimerRef.current);
      }
    };
  }, []);

  const dismissWelcomeSplash = useCallback(() => {
    if (welcomeTimerRef.current !== null) {
      window.clearTimeout(welcomeTimerRef.current);
      welcomeTimerRef.current = null;
    }
    setShowWelcomeSplash(false);
  }, []);

  const handleVerifyPin = useCallback((pin: string) => panelUsersService.verifyPin(pin), []);

  const handlePinVerified = useCallback(() => {
    if (user?.uid) {
      welcomedUidRef.current = user.uid;
    }
    unlockPinSession();
  }, [user?.uid, unlockPinSession]);

  const handleSwitchAccount = useCallback(() => {
    void logout();
  }, [logout]);

  // Aguarda verificação inicial do Firebase Auth e do perfil (incluindo hasPin) antes de expor o painel
  if (loading || (user && profileLoading && !pinUnlocked)) {
    const bootSplashUser = panelProfile
      ? {
          name: panelProfile.name,
          email: panelProfile.email,
          photoUrl: panelProfile.photoUrl || user?.photoURL || '',
          role: panelProfile.role,
          jobTitle: panelProfile.jobTitle,
        }
      : user
      ? {
          name: user.displayName || cachedSplashUser?.name || user.email,
          email: user.email,
          photoUrl: user.photoURL || cachedSplashUser?.photoUrl || '',
          role: cachedSplashUser?.role,
          jobTitle: cachedSplashUser?.jobTitle,
        }
      : cachedSplashUser;

    return (
      <Ps5UserSplashScreen
        user={bootSplashUser}
        statusText="Verificando credenciais..."
      />
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

  // Tela de entrada bloqueada exigindo a senha numérica de 6 dígitos do usuário
  if (needsPinEntry) {
    return (
      <Ps5UserSplashScreen
        user={{
          name: panelProfile.name || user.displayName || user.email,
          email: panelProfile.email || user.email,
          photoUrl: panelProfile.photoUrl || user.photoURL || '',
          role: panelProfile.role,
          jobTitle: panelProfile.jobTitle,
        }}
        requirePin
        onVerifyPin={handleVerifyPin}
        onPinVerified={handlePinVerified}
        onSwitchAccount={handleSwitchAccount}
      />
    );
  }

  return (
    <>
      {children}
      <AnimatePresence>
        {showWelcomeSplash && (
          <Ps5UserSplashScreen
            user={{
              name: panelProfile.name || user.displayName || user.email,
              email: panelProfile.email || user.email,
              photoUrl: panelProfile.photoUrl || user.photoURL || '',
              role: panelProfile.role,
              jobTitle: panelProfile.jobTitle,
            }}
            statusText="Entrando no Command Center..."
            dismissible
            onDismiss={dismissWelcomeSplash}
          />
        )}
      </AnimatePresence>
    </>
  );
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

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useUiPreferences } from '@/contexts/UiPreferencesContext';
import { Lock, LogOut, ShieldCheck, Crown, User } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { getRoleDisplayLabel } from '@/config/permissions';

export const UserMenu = () => {
  const { user, panelProfile, lockScreen, logout } = useAuth();
  const { preferences } = useUiPreferences();
  const { toast } = useToast();
  const [imgError, setImgError] = useState(false);

  const photoUrl = panelProfile?.photoUrl || user?.photoURL || '';

  useEffect(() => {
    setImgError(false);
  }, [photoUrl]);

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: 'Logout realizado',
        description: 'Você foi desconectado com sucesso.',
      });
    } catch {
      toast({
        title: 'Erro no logout',
        description: 'Ocorreu um erro ao sair. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  if (!user) return null;

  const role = panelProfile?.role || 'operador';
  const displayName = panelProfile?.name || user.displayName || user.email || 'Operador';
  const roleLabel = getRoleDisplayLabel(role);

  const badgeClass =
    role === 'creator'
      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30'
      : role === 'admin'
      ? 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30'
      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30';

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <div
        className="hidden md:flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-xl bg-secondary/60 border border-border/70"
        title={`${displayName} (${user.email}) — ${roleLabel}`}
      >
        {photoUrl && !imgError ? (
          <img
            src={photoUrl}
            alt={displayName}
            onError={() => setImgError(true)}
            className="w-6 h-6 rounded-full object-cover ring-1 ring-primary/40 shrink-0"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            {role === 'creator' ? (
              <Crown className="h-3.5 w-3.5 text-amber-500" />
            ) : role === 'admin' ? (
              <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
            ) : (
              <User className="h-3.5 w-3.5 text-emerald-500" />
            )}
          </div>
        )}
        <span className="text-xs font-semibold text-foreground max-w-[140px] truncate">
          {displayName}
        </span>
        <Badge variant="outline" className={`h-4 px-1.5 text-[9px] font-bold ${badgeClass}`}>
          {roleLabel}
        </Badge>
      </div>
      {panelProfile?.hasPin && (
        <Button
          variant="outline"
          size="icon"
          onClick={lockScreen}
          className="h-9 w-9 rounded-xl border-border/70 bg-background/70 hover:bg-secondary/80"
          title={
            preferences.autoLockMinutes > 0
              ? `Bloquear tela agora (bloqueio automático em ${preferences.autoLockMinutes} min)`
              : 'Bloquear tela agora'
          }
        >
          <Lock className="h-4 w-4" />
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handleLogout}
        className="flex items-center gap-1.5 h-9 rounded-xl border-border/70 bg-background/70 hover:bg-secondary/80"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">Sair</span>
      </Button>
    </div>
  );
};

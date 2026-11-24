import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, ShieldCheck, Crown, User } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { getRoleDisplayLabel } from '@/config/permissions';

export const UserMenu = () => {
  const { user, panelProfile, logout } = useAuth();
  const { toast } = useToast();

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
        className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-secondary/60 border border-border/70"
        title={`${displayName} (${user.email}) — ${roleLabel}`}
      >
        {role === 'creator' ? (
          <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        ) : role === 'admin' ? (
          <ShieldCheck className="h-3.5 w-3.5 text-blue-500 shrink-0" />
        ) : (
          <User className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
        )}
        <span className="text-xs font-semibold text-foreground max-w-[140px] truncate">
          {displayName}
        </span>
        <Badge variant="outline" className={`h-4 px-1.5 text-[9px] font-bold ${badgeClass}`}>
          {roleLabel}
        </Badge>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleLogout}
        className="flex items-center gap-1.5 h-9 rounded-xl"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">Sair</span>
      </Button>
    </div>
  );
};

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'framer-motion';
import {
  Camera,
  CheckSquare,
  Copy,
  Crown,
  Edit3,
  Eye,
  EyeOff,
  ImagePlus,
  KeyRound,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  Upload,
  UserCheck,
  UserCog,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SpotlightCard } from '@/components/ui/aceternity/spotlight-card';
import {
  Ps5UserSplashScreen,
  type Ps5SplashUserInfo,
} from '@/components/auth/Ps5UserSplashScreen';
import { useAuth } from '@/contexts/AuthContext';
import { panelUsersService } from '@/services/panelUsersService';
import {
  ALL_ROUTE_PATHS,
  PERMISSION_PRESETS,
  SCREEN_PERMISSIONS,
  SCREEN_PERMISSION_GROUPS,
  getRoleDisplayLabel,
  getScreenLabelByPath,
  isCreatorEmail,
  type PanelUserProfile,
} from '@/config/permissions';

type EditableRole = 'admin' | 'operador';

interface FormState {
  name: string;
  email: string;
  password: string;
  pin: string;
  clearPin: boolean;
  photoUrl: string;
  jobTitle: string;
  role: EditableRole;
  active: boolean;
  allowedRoutes: string[];
  syncToAttendants: boolean;
}

const DEFAULT_OPERATOR_ROUTES = PERMISSION_PRESETS[0].routes;

function createEmptyForm(): FormState {
  return {
    name: '',
    email: '',
    password: '',
    pin: '',
    clearPin: false,
    photoUrl: '',
    jobTitle: '',
    role: 'operador',
    active: true,
    allowedRoutes: [...DEFAULT_OPERATOR_ROUTES],
    syncToAttendants: true,
  };
}

function generateSixDigitPin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateStrongPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#';
  let result = 'Avl';
  for (let i = 0; i < 7; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function formatDateTimeBr(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function extractCallableErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const raw = String((err as { message?: unknown }).message || '').trim();
    if (raw) return raw.replace(/^FirebaseError:\s*/i, '');
  }
  return fallback;
}

export const OperatorAccessManager: React.FC = () => {
  const { user: currentUser, panelProfile: currentProfile, isAdmin, isCreator } = useAuth();

  const [users, setUsers] = useState<PanelUserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admins' | 'operadores'>('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<PanelUserProfile | null>(null);
  const [form, setForm] = useState<FormState>(createEmptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [splashPreviewUser, setSplashPreviewUser] = useState<Ps5SplashUserInfo | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const loadUsers = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await panelUsersService.listUsers();
      setUsers(list);
    } catch (err) {
      toast.error(extractCallableErrorMessage(err, 'Erro ao carregar operadores e admins.'));
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => u.role === 'creator' || u.role === 'admin').length;
    const activeOperators = users.filter((u) => u.role === 'operador' && u.active).length;
    const inactive = users.filter((u) => !u.active).length;
    return { total, admins, activeOperators, inactive };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter === 'admins' && u.role === 'operador') return false;
      if (roleFilter === 'operadores' && u.role !== 'operador') return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.jobTitle || '').toLowerCase().includes(q)
      );
    });
  }, [users, searchTerm, roleFilter]);

  const openCreateDialog = () => {
    setEditingUser(null);
    setForm(createEmptyForm());
    setShowPassword(true);
    setShowPin(true);
    setDialogOpen(true);
  };

  const openEditDialog = (target: PanelUserProfile) => {
    setEditingUser(target);
    setForm({
      name: target.name || '',
      email: target.email || '',
      password: '',
      pin: '',
      clearPin: false,
      photoUrl: target.photoUrl || '',
      jobTitle: target.jobTitle || '',
      role: target.role === 'operador' ? 'operador' : 'admin',
      active: target.active !== false,
      allowedRoutes:
        target.role === 'operador'
          ? [...(target.allowedRoutes || [])]
          : [...ALL_ROUTE_PATHS],
      syncToAttendants: false,
    });
    setShowPassword(false);
    setShowPin(false);
    setDialogOpen(true);
  };

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.warning('Selecione um arquivo de imagem (JPG, PNG ou WebP).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.warning('A imagem deve ter no máximo 10 MB.');
      return;
    }

    setUploadingPhoto(true);
    try {
      const key = editingUser?.uid || form.email || form.name || 'operador';
      const downloadUrl = await panelUsersService.uploadAvatarPhoto(file, key);
      setForm((prev) => ({ ...prev, photoUrl: downloadUrl }));
      toast.success('Foto enviada! Clique em salvar para aplicar ao login.');
    } catch (err) {
      toast.error(
        extractCallableErrorMessage(
          err,
          'Erro ao enviar foto para o Storage. Você também pode colar uma URL direta.'
        )
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const toggleRoute = (path: string) => {
    setForm((prev) => {
      const exists = prev.allowedRoutes.includes(path);
      return {
        ...prev,
        allowedRoutes: exists
          ? prev.allowedRoutes.filter((r) => r !== path)
          : [...prev.allowedRoutes, path],
      };
    });
  };

  const toggleGroupRoutes = (groupId: string) => {
    const groupPaths = SCREEN_PERMISSIONS.filter((s) => s.groupId === groupId).map((s) => s.path);
    setForm((prev) => {
      const allSelected = groupPaths.every((p) => prev.allowedRoutes.includes(p));
      if (allSelected) {
        return {
          ...prev,
          allowedRoutes: prev.allowedRoutes.filter((p) => !groupPaths.includes(p)),
        };
      }
      const merged = Array.from(new Set([...prev.allowedRoutes, ...groupPaths]));
      return { ...prev, allowedRoutes: merged };
    });
  };

  const applyPreset = (routes: string[]) => {
    setForm((prev) => ({ ...prev, role: 'operador', allowedRoutes: [...routes] }));
  };

  const handleCopyCredentials = () => {
    if (!form.email.trim()) {
      toast.warning('Informe o e-mail primeiro.');
      return;
    }
    const lines = [
      'Acesso ao Painel AVL Telecom',
      `Link: ${window.location.origin}`,
      `Login: ${form.email.trim()}`,
      ...(form.password ? [`Senha: ${form.password}`] : []),
      ...(form.pin.length === 6 ? [`PIN de entrada (6 dígitos): ${form.pin}`] : []),
    ].join('\n');
    navigator.clipboard
      .writeText(lines)
      .then(() => toast.success('Credenciais copiadas para enviar ao operador!'))
      .catch(() => toast.error('Não foi possível copiar.'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2) {
      toast.warning('Informe o nome completo.');
      return;
    }
    if (!editingUser && !form.email.trim()) {
      toast.warning('Informe o e-mail de login.');
      return;
    }
    if (!editingUser && form.password.length < 6) {
      toast.warning('Defina uma senha inicial com pelo menos 6 caracteres.');
      return;
    }
    if (editingUser && form.password.length > 0 && form.password.length < 6) {
      toast.warning('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (form.pin.length > 0 && !/^\d{6}$/.test(form.pin)) {
      toast.warning('A senha numérica de entrada (PIN) deve ter exatamente 6 dígitos.');
      return;
    }
    if (form.role === 'operador' && form.allowedRoutes.length === 0) {
      toast.warning('Selecione pelo menos uma tela liberada para o operador.');
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        await panelUsersService.updateUser({
          uid: editingUser.uid,
          name: form.name.trim(),
          photoUrl: form.photoUrl.trim(),
          jobTitle: form.jobTitle.trim(),
          role: form.role,
          active: form.active,
          allowedRoutes: form.role === 'admin' ? ALL_ROUTE_PATHS : form.allowedRoutes,
          ...(form.password.length >= 6 ? { password: form.password } : {}),
          ...(form.clearPin ? { clearPin: true } : form.pin.length === 6 ? { pin: form.pin } : {}),
        });
        toast.success(`Perfil, PIN e permissões de ${form.name.trim()} atualizados!`);
      } else {
        await panelUsersService.createUser({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          photoUrl: form.photoUrl.trim(),
          jobTitle: form.jobTitle.trim(),
          role: form.role,
          active: form.active,
          allowedRoutes: form.role === 'admin' ? ALL_ROUTE_PATHS : form.allowedRoutes,
          ...(form.pin.length === 6 ? { pin: form.pin } : {}),
          syncToAttendants: form.syncToAttendants,
        });
        toast.success(
          `${form.role === 'admin' ? 'Administrador' : 'Operador'} ${form.name.trim()} criado com sucesso!`
        );
      }
      setDialogOpen(false);
      await loadUsers();
    } catch (err) {
      toast.error(extractCallableErrorMessage(err, 'Erro ao salvar usuário.'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (target: PanelUserProfile) => {
    const nextActive = !target.active;
    setBusyUid(target.uid);
    try {
      await panelUsersService.updateUser({
        uid: target.uid,
        active: nextActive,
      });
      toast.success(
        nextActive
          ? `Acesso de ${target.name} reativado.`
          : `Acesso de ${target.name} desativado imediatamente.`
      );
      await loadUsers();
    } catch (err) {
      toast.error(extractCallableErrorMessage(err, 'Erro ao alterar status.'));
    } finally {
      setBusyUid(null);
    }
  };

  const handleDelete = async (target: PanelUserProfile) => {
    const confirmed = window.confirm(
      `Excluir definitivamente o login de "${target.name}" (${target.email})?\n\nEsta ação remove a conta do Firebase Auth e revoga imediatamente o acesso ao painel.`
    );
    if (!confirmed) return;

    setBusyUid(target.uid);
    try {
      await panelUsersService.deleteUser(target.uid);
      toast.success(`Login de ${target.name} removido com sucesso.`);
      await loadUsers();
    } catch (err) {
      toast.error(extractCallableErrorMessage(err, 'Erro ao remover usuário.'));
    } finally {
      setBusyUid(null);
    }
  };

  if (!isAdmin) {
    return (
      <SpotlightCard tone="amber" className="p-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Controle de Logins &amp; Permissões
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              A criação e edição de logins de administradores e operadores é restrita a contas com
              perfil Administrador.
            </p>
          </div>
        </div>
      </SpotlightCard>
    );
  }

  const editingTargetIsCreator = Boolean(
    editingUser && (editingUser.role === 'creator' || isCreatorEmail(editingUser.email))
  );
  const editingTargetIsSelf = Boolean(editingUser && editingUser.uid === currentUser?.uid);

  return (
    <SpotlightCard tone="blue" className="p-5 sm:p-6 space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/25 shrink-0">
            <UserCog className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
                Logins de Administradores &amp; Operadores
              </h2>
              <Badge
                variant="outline"
                className="bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/30 text-[10px] font-bold uppercase tracking-wider"
              >
                Foto + PIN 6 Dígitos + Controle por Tela
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Crie contas de <strong>Admin</strong> ou <strong>Operador</strong>, adicione a foto,
              defina a <strong>senha numérica de 6 dígitos</strong> da tela de entrada e limite quais
              telas cada usuário pode abrir.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setSplashPreviewUser({
                name: currentProfile?.name || currentUser?.displayName || currentUser?.email,
                email: currentProfile?.email || currentUser?.email,
                photoUrl: currentProfile?.photoUrl || currentUser?.photoURL || '',
                role: currentProfile?.role || 'admin',
                jobTitle: currentProfile?.jobTitle,
              })
            }
            className="h-9 rounded-xl gap-1.5 border-indigo-500/35 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/10"
            title="Ver prévia da tela de entrada minimalista com PIN de 6 dígitos"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Testar Tela de Entrada
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadUsers()}
            disabled={loading}
            className="h-9 rounded-xl gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={openCreateDialog}
            className="h-9 rounded-xl gap-1.5 bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-700 hover:to-green-600 text-white shadow-md shadow-emerald-600/20 border-0"
          >
            <Plus className="w-4 h-4" />
            Novo Operador / Admin
          </Button>
        </div>
      </div>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-secondary/40 border border-border/70">
          <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-blue-500" /> Total de Logins
          </p>
          <p className="text-xl font-extrabold text-foreground mt-1">{stats.total}</p>
        </div>
        <div className="p-3 rounded-xl bg-secondary/40 border border-border/70">
          <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" /> Administradores
          </p>
          <p className="text-xl font-extrabold text-foreground mt-1">{stats.admins}</p>
        </div>
        <div className="p-3 rounded-xl bg-secondary/40 border border-border/70">
          <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-emerald-500" /> Operadores Ativos
          </p>
          <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            {stats.activeOperators}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-secondary/40 border border-border/70">
          <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
            <UserX className="w-3.5 h-3.5 text-rose-500" /> Desativados
          </p>
          <p className="text-xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">
            {stats.inactive}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar operador por nome, e-mail ou setor..."
            className="pl-9 h-9 rounded-xl bg-background"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {(
            [
              { id: 'all', label: 'Todos' },
              { id: 'admins', label: 'Admins' },
              { id: 'operadores', label: 'Operadores' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setRoleFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                roleFilter === f.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-secondary/50 text-muted-foreground border-border hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de usuários */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          Carregando logins do painel...
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-10 rounded-2xl border border-dashed border-border bg-secondary/20">
          <Users className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm font-semibold text-foreground">Nenhum login encontrado</p>
          <p className="text-xs text-muted-foreground mt-1">
            Clique em &quot;Novo Operador / Admin&quot; para cadastrar o primeiro acesso.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredUsers.map((item) => {
            const itemIsCreator = item.role === 'creator' || isCreatorEmail(item.email);
            const itemIsSelf = item.uid === currentUser?.uid;
            const isItemAdmin = item.role === 'creator' || item.role === 'admin';
            const routes = Array.isArray(item.allowedRoutes) ? item.allowedRoutes : [];
            const canEditItem = !itemIsCreator || isCreator;
            const isBusy = busyUid === item.uid;

            const roleBadgeClass =
              item.role === 'creator'
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                : item.role === 'admin'
                ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
                : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';

            const avatarRingClass =
              item.role === 'creator'
                ? 'ring-2 ring-amber-500/60'
                : item.role === 'admin'
                ? 'ring-2 ring-blue-500/60'
                : 'ring-2 ring-emerald-500/60';

            return (
              <div
                key={item.uid}
                className={`p-4 rounded-2xl border transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                  item.active
                    ? 'bg-card/80 border-border/80 hover:border-primary/35'
                    : 'bg-secondary/30 border-border/60 opacity-75'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  {item.photoUrl ? (
                    <img
                      src={item.photoUrl}
                      alt={item.name}
                      className={`w-12 h-12 rounded-full object-cover shrink-0 shadow-sm ${avatarRingClass}`}
                    />
                  ) : (
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0 shadow-sm ${
                        item.role === 'creator'
                          ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                          : item.role === 'admin'
                          ? 'bg-gradient-to-br from-blue-600 to-indigo-600'
                          : 'bg-gradient-to-br from-emerald-600 to-teal-600'
                      }`}
                    >
                      {(item.name || item.email || 'U').substring(0, 2).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-foreground truncate">
                        {item.name}
                      </span>
                      <Badge variant="outline" className={`text-[10px] font-bold gap-1 ${roleBadgeClass}`}>
                        {item.role === 'creator' ? (
                          <Crown className="w-2.5 h-2.5" />
                        ) : item.role === 'admin' ? (
                          <ShieldCheck className="w-2.5 h-2.5" />
                        ) : (
                          <Shield className="w-2.5 h-2.5" />
                        )}
                        {getRoleDisplayLabel(item.role)}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold ${
                          item.active
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {item.active ? 'Ativo' : 'Desativado'}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold gap-1 ${
                          item.hasPin
                            ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/30'
                            : 'bg-secondary/60 text-muted-foreground border-border/80'
                        }`}
                      >
                        <Lock className="w-2.5 h-2.5" />
                        {item.hasPin ? 'PIN 6 dígitos' : 'Sem PIN'}
                      </Badge>
                      {itemIsSelf && (
                        <Badge variant="secondary" className="text-[10px]">
                          Você
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-muted-foreground">
                      <span className="font-mono text-foreground/85">{item.email}</span>
                      {item.jobTitle && <span>• {item.jobTitle}</span>}
                      {item.lastLoginAt && (
                        <span>• Último acesso: {formatDateTimeBr(item.lastLoginAt)}</span>
                      )}
                    </div>

                    {/* Telas liberadas */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      {isItemAdmin ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/25"
                        >
                          Acesso total a todas as {ALL_ROUTE_PATHS.length} telas
                        </Badge>
                      ) : (
                        <>
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-bold text-foreground"
                          >
                            {routes.length}/{ALL_ROUTE_PATHS.length} telas
                          </Badge>
                          {routes.slice(0, 5).map((path) => (
                            <Badge
                              key={path}
                              variant="outline"
                              className="text-[10px] font-medium bg-secondary/60 border-border/80"
                            >
                              {getScreenLabelByPath(path)}
                            </Badge>
                          ))}
                          {routes.length > 5 && (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-muted-foreground border-border/80"
                            >
                              +{routes.length - 5} telas
                            </Badge>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setSplashPreviewUser({
                        name: item.name,
                        email: item.email,
                        photoUrl: item.photoUrl || '',
                        role: item.role,
                        jobTitle: item.jobTitle,
                      })
                    }
                    className="h-8 w-8 rounded-xl text-indigo-500 hover:text-indigo-600 hover:bg-indigo-500/10"
                    title="Visualizar Tela de Entrada minimalista deste usuário"
                  >
                    <Sparkles className="w-4 h-4" />
                  </Button>

                  {canEditItem && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => openEditDialog(item)}
                      className="h-8 rounded-xl text-xs gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      {itemIsCreator ? 'Foto, PIN & Perfil' : 'Foto, PIN & Telas'}
                    </Button>
                  )}

                  {!itemIsCreator && !itemIsSelf && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => void handleToggleActive(item)}
                        className={`h-8 rounded-xl text-xs ${
                          item.active
                            ? 'text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10'
                            : 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10'
                        }`}
                      >
                        {isBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : item.active ? (
                          'Desativar'
                        ) : (
                          'Ativar'
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={isBusy}
                        onClick={() => void handleDelete(item)}
                        className="h-8 w-8 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                        title="Excluir login permanentemente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Criar / Editar Operador ou Admin */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto bg-card border-border text-card-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <UserCog className="w-5 h-5 text-primary" />
              {editingUser
                ? `Editar Acesso — ${editingUser.name}`
                : 'Criar Novo Login (Operador ou Admin)'}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? 'Atualize a foto, o PIN numérico de 6 dígitos da tela de entrada, a senha ou as telas liberadas.'
                : 'Crie um login real no Firebase Auth com foto personalizada, PIN numérico de 6 dígitos para a tela de entrada e permissões por tela.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5 pt-2">
            {/* Upload de Foto do Usuário */}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => void handlePhotoFileChange(e)}
              className="hidden"
            />
            <div className="p-4 rounded-2xl border border-border bg-secondary/30 flex flex-col sm:flex-row items-center gap-4">
              <div className="relative group shrink-0">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="relative w-20 h-20 rounded-full overflow-hidden ring-2 ring-primary/40 shadow-lg bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-900 flex items-center justify-center focus:outline-none"
                  title="Clique para enviar uma foto"
                >
                  {form.photoUrl ? (
                    <img
                      src={form.photoUrl}
                      alt={form.name || 'Avatar'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImagePlus className="w-7 h-7 text-white/80" />
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    {uploadingPhoto ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : (
                      <Camera className="w-5 h-5 text-white" />
                    )}
                  </div>
                </button>
                {form.photoUrl && (
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, photoUrl: '' }))}
                    title="Remover foto"
                    className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-md hover:bg-rose-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex-1 w-full space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-sm font-bold text-foreground">Foto do Perfil (Tela de Entrada)</p>
                    <p className="text-[11px] text-muted-foreground">
                      Aparece em círculo no centro da tela de entrada com PIN de 6 dígitos e no menu.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingPhoto}
                    onClick={() => photoInputRef.current?.click()}
                    className="h-8 rounded-xl text-xs gap-1.5"
                  >
                    {uploadingPhoto ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    {uploadingPhoto ? 'Enviando...' : 'Enviar Foto'}
                  </Button>
                </div>

                <Input
                  value={form.photoUrl}
                  onChange={(e) => setForm((p) => ({ ...p, photoUrl: e.target.value }))}
                  placeholder="Ou cole a URL da imagem (https://...)"
                  className="h-8 text-xs bg-background"
                />
              </div>
            </div>

            {/* Dados de identificação */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="op-name">Nome completo *</Label>
                <Input
                  id="op-name"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Maria Oliveira"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="op-job">Cargo / Setor</Label>
                <Input
                  id="op-job"
                  value={form.jobTitle}
                  onChange={(e) => setForm((p) => ({ ...p, jobTitle: e.target.value }))}
                  placeholder="Ex: Atendimento, NOC, Financeiro"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="op-email">E-mail de login *</Label>
                <Input
                  id="op-email"
                  type="email"
                  value={form.email}
                  disabled={Boolean(editingUser)}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="operador@avltelecom.com"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="op-password">
                    {editingUser ? 'Nova senha (opcional)' : 'Senha inicial *'}
                  </Label>
                  <button
                    type="button"
                    onClick={() => {
                      const generated = generateStrongPassword();
                      setForm((p) => ({ ...p, password: generated }));
                      setShowPassword(true);
                    }}
                    className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <KeyRound className="w-3 h-3" />
                    Gerar senha
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="op-password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder={
                      editingUser
                        ? 'Deixe vazio para manter a senha atual'
                        : 'Mínimo 6 caracteres'
                    }
                    className="pr-10 font-mono"
                    required={!editingUser}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Senha numérica de 6 dígitos (PIN da Tela de Entrada / Splash Screen) */}
            <div className="p-4 rounded-2xl border border-indigo-500/25 bg-indigo-500/[0.05] space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-500 shrink-0">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Label htmlFor="op-pin" className="text-sm font-bold text-foreground">
                        Senha Numérica da Tela de Entrada (6 dígitos)
                      </Label>
                      {editingUser?.hasPin && !form.clearPin && (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        >
                          PIN ativo
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Exigida na splash screen minimalista sempre que este usuário abrir ou desbloquear o painel.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setForm((p) => ({
                      ...p,
                      pin: generateSixDigitPin(),
                      clearPin: false,
                    }));
                    setShowPin(true);
                  }}
                  className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 shrink-0"
                >
                  <KeyRound className="w-3 h-3" />
                  Gerar 6 dígitos
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                  <Input
                    id="op-pin"
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    disabled={form.clearPin}
                    value={form.pin}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setForm((p) => ({ ...p, pin: digits, clearPin: false }));
                    }}
                    placeholder={
                      editingUser?.hasPin
                        ? '•••••• (digite 6 números p/ trocar)'
                        : 'Ex: 123456'
                    }
                    className="pr-10 font-mono tracking-[0.28em] bg-background"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {editingUser?.hasPin && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                    <Checkbox
                      checked={form.clearPin}
                      onCheckedChange={(checked) =>
                        setForm((p) => ({
                          ...p,
                          clearPin: Boolean(checked),
                          ...(checked ? { pin: '' } : {}),
                        }))
                      }
                    />
                    <span>Remover exigência de PIN para este usuário</span>
                  </label>
                )}
              </div>
            </div>

            {/* Tipo de conta (não editável para Criador ou para si mesmo) */}
            {!editingTargetIsCreator && (
              <div className="space-y-2">
                <Label>Tipo de Login</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={editingTargetIsSelf}
                    onClick={() => setForm((p) => ({ ...p, role: 'operador' }))}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      form.role === 'operador'
                        ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/30'
                        : 'border-border bg-secondary/30 hover:bg-secondary/60'
                    } ${editingTargetIsSelf ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                      <Shield className="w-4 h-4 text-emerald-500" />
                      Operador (Telas limitadas)
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Visualiza e acessa apenas as telas marcadas abaixo.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        role: 'admin',
                        allowedRoutes: [...ALL_ROUTE_PATHS],
                      }))
                    }
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      form.role === 'admin'
                        ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30'
                        : 'border-border bg-secondary/30 hover:bg-secondary/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                      <ShieldCheck className="w-4 h-4 text-blue-500" />
                      Administrador (Acesso total)
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Acessa todas as telas e pode criar/editar operadores.
                    </p>
                  </button>
                </div>
              </div>
            )}

            {/* Status ativo + sincronização opcional com assinaturas do Chat */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-secondary/40 border border-border">
              {!editingTargetIsCreator && !editingTargetIsSelf ? (
                <div className="flex items-center gap-3">
                  <Switch
                    id="op-active"
                    checked={form.active}
                    onCheckedChange={(checked) => setForm((p) => ({ ...p, active: checked }))}
                  />
                  <Label htmlFor="op-active" className="cursor-pointer">
                    <span className="font-semibold text-xs block">
                      {form.active ? 'Login Ativo' : 'Login Desativado (Bloqueado)'}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Desativar bloqueia o acesso imediatamente sem apagar o histórico.
                    </span>
                  </Label>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  {editingTargetIsCreator
                    ? 'A conta do Criador permanece sempre ativa com acesso total.'
                    : 'Você não pode desativar sua própria conta.'}
                </div>
              )}

              {!editingUser && (
                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
                  <Checkbox
                    checked={form.syncToAttendants}
                    onCheckedChange={(checked) =>
                      setForm((p) => ({ ...p, syncToAttendants: Boolean(checked) }))
                    }
                  />
                  <span>Adicionar também às assinaturas do Chat</span>
                </label>
              )}
            </div>

            {/* Matriz de seleção de telas (apenas para Operador) */}
            {!editingTargetIsCreator && form.role === 'operador' && (
              <div className="space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <Label className="text-sm font-bold text-foreground">
                      Telas Liberadas para este Operador
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {form.allowedRoutes.length} de {ALL_ROUTE_PATHS.length} telas selecionadas
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setForm((p) => ({ ...p, allowedRoutes: [...ALL_ROUTE_PATHS] }))
                      }
                      className="h-7 px-2.5 text-[11px] gap-1"
                    >
                      <CheckSquare className="w-3 h-3" /> Marcar todas
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setForm((p) => ({ ...p, allowedRoutes: [] }))}
                      className="h-7 px-2.5 text-[11px] gap-1"
                    >
                      <Square className="w-3 h-3" /> Limpar
                    </Button>
                  </div>
                </div>

                {/* Perfis rápidos (1 clique) */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-primary" /> Modelos prontos (1 clique)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {PERMISSION_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyPreset(preset.routes)}
                        className="p-2.5 rounded-xl border border-border bg-secondary/30 hover:bg-primary/10 hover:border-primary/40 text-left transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-foreground">{preset.label}</span>
                          <Badge variant="secondary" className="text-[10px]">
                            {preset.routes.length} telas
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                          {preset.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grupos de telas */}
                <div className="space-y-3">
                  {SCREEN_PERMISSION_GROUPS.map((group) => {
                    const groupScreens = SCREEN_PERMISSIONS.filter((s) => s.groupId === group.id);
                    const selectedInGroup = groupScreens.filter((s) =>
                      form.allowedRoutes.includes(s.path)
                    ).length;
                    const allGroupSelected = selectedInGroup === groupScreens.length;

                    return (
                      <div
                        key={group.id}
                        className="rounded-xl border border-border bg-background/60 overflow-hidden"
                      >
                        <div className="px-3.5 py-2.5 bg-secondary/40 border-b border-border/70 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                              {group.label}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              {selectedInGroup}/{groupScreens.length}
                            </Badge>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleGroupRoutes(group.id)}
                            className="text-[11px] font-semibold text-primary hover:underline"
                          >
                            {allGroupSelected ? 'Desmarcar grupo' : 'Marcar grupo'}
                          </button>
                        </div>

                        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {groupScreens.map((screen) => {
                            const checked = form.allowedRoutes.includes(screen.path);
                            return (
                              <label
                                key={screen.path}
                                className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                                  checked
                                    ? 'bg-emerald-500/10 border-emerald-500/35'
                                    : 'bg-card/60 border-border/70 hover:bg-secondary/40'
                                }`}
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => toggleRoute(screen.path)}
                                  className="mt-0.5"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-semibold text-foreground leading-tight">
                                    {screen.label}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                                    {screen.description}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={handleCopyCredentials}
                className="gap-1.5 text-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                Copiar Login &amp; Senha
              </Button>

              <div className="flex items-center gap-2 justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDialogOpen(false)}
                  disabled={saving || uploadingPhoto}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saving || uploadingPhoto}
                  className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingUser ? 'Salvar Alterações' : 'Criar Login'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Pré-visualização ao vivo da Tela de Entrada Minimalista com PIN de 6 dígitos */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {splashPreviewUser && (
              <Ps5UserSplashScreen
                user={splashPreviewUser}
                requirePin
                previewMode
                onVerifyPin={async () => ({ success: true, valid: true, hasPin: true })}
                onPinVerified={() => {
                  toast.success('Prévia da tela de entrada desbloqueada!');
                  setSplashPreviewUser(null);
                }}
                onDismiss={() => setSplashPreviewUser(null)}
              />
            )}
          </AnimatePresence>,
          document.body
        )}
    </SpotlightCard>
  );
};

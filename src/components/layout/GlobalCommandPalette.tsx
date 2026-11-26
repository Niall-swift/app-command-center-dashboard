import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  Calendar,
  ClipboardList,
  Clock,
  DollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  Film,
  Gift,
  Home,
  Lock,
  Map,
  MapPin,
  MessageSquare,
  Package,
  Radar,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Ticket,
  Tv,
  Users,
  Wifi,
  WifiOff,
  Wrench,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { useNetworkMonitor } from '@/contexts/NetworkMonitorContext';
import { useAuth } from '@/contexts/AuthContext';
import { ispfyService } from '@/services/ispfy/ispfyService';
import type { ISPFYClienteData } from '@/types/ispfy';

interface NavShortcut {
  title: string;
  url: string;
  category: string;
  keywords: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ALL_PAGES: NavShortcut[] = [
  { title: 'Dashboard de Controle', url: '/', category: 'NOC & Geral', keywords: 'inicio home graficos resumo', icon: Home },
  { title: 'Clientes por Bairro e Rua', url: '/ispfy/regiao', category: 'NOC & Rede', keywords: 'rompimento offline rua bairro fibra', icon: MapPin },
  { title: 'Central de Inteligência & CTO', url: '/ispfy/inteligencia', category: 'NOC & Comercial', keywords: 'viabilidade cto upgrade turbo consumo sinal csat', icon: Radar },
  { title: 'Mapa da Rede', url: '/network-map', category: 'NOC & Rede', keywords: 'mapa cto olt onu smartolt', icon: Map },
  { title: 'Nova Ordem de Serviço (O.S.)', url: '/ispfy/nova-os', category: 'NOC & Rede', keywords: 'abrir chamado os tecnico instalacao', icon: ClipboardList },
  { title: 'Tickets & Chamados ISPFY', url: '/ispfy/tickets', category: 'NOC & Rede', keywords: 'chamados os abertas encerrar', icon: Ticket },
  { title: 'Suporte Técnico', url: '/technical-support', category: 'NOC & Rede', keywords: 'suporte diagnostico', icon: Wrench },
  { title: 'Chat de Atendimento', url: '/chat', category: 'Atendimento', keywords: 'whatsapp mensagens conversa josue ia', icon: MessageSquare },
  { title: 'Envio em Massa WhatsApp', url: '/whatsapp/bulk', category: 'Atendimento', keywords: 'disparo cobranca lote campanha zapi', icon: Send },
  { title: 'Automações & Bot (Josué IA)', url: '/bots', category: 'Atendimento', keywords: 'bot ia regua rompimento mikrotik', icon: Bot },
  { title: 'Notificações Push', url: '/notifications', category: 'Atendimento', keywords: 'push app celular', icon: Bell },
  { title: 'Solicitações de Usuários', url: '/requests', category: 'Atendimento', keywords: 'pedidos solicitacoes', icon: FileText },
  { title: 'Consulta de Clientes ISPFY', url: '/ispfy/consulta', category: 'ISPFY', keywords: 'buscar cpf cliente cadastro', icon: Users },
  { title: 'Financeiro & Caixa', url: '/ispfy/financeiro', category: 'ISPFY', keywords: 'receita caixa inadimplencia contas', icon: DollarSign },
  { title: 'Auditoria de Clientes', url: '/ispfy/auditoria', category: 'ISPFY', keywords: 'novos cancelados excluidos base', icon: ShieldCheck },
  { title: 'Vencimentos em Massa', url: '/ispfy/vencimentos', category: 'ISPFY', keywords: 'vencimento alterar data', icon: Calendar },
  { title: 'Robô de Carência', url: '/ispfy/carencia', category: 'ISPFY', keywords: 'desbloqueio confianca liberacao temporaria', icon: Clock },
  { title: 'Relatório DICI Anatel', url: '/ispfy/dici', category: 'ISPFY', keywords: 'anatel regulatorio', icon: FileSpreadsheet },
  { title: 'Exportar Clientes Ativos', url: '/ispfy/exportar-ativos', category: 'ISPFY', keywords: 'csv planilha exportar', icon: Download },
  { title: 'Sorteios PreMix', url: '/raffle', category: 'Engajamento', keywords: 'sorteio premix', icon: Gift },
  { title: 'Sorteios Pagos', url: '/paid-raffles', category: 'Engajamento', keywords: 'bilhetes asaas pix', icon: Ticket },
  { title: 'Filmes (AVL Play)', url: '/movies', category: 'AVL Play', keywords: 'cinema vod', icon: Film },
  { title: 'Séries (AVL Play)', url: '/series', category: 'AVL Play', keywords: 'episodios temporadas', icon: Tv },
  { title: 'Métricas AVL Play', url: '/avlplay-analytics', category: 'AVL Play', keywords: 'audiencia assistindo', icon: Activity },
  { title: 'Gestão de Prêmios', url: '/rewards-management', category: 'Fidelidade', keywords: 'pontos recompensas', icon: Package },
  { title: 'Pedidos de Resgate', url: '/redemption-orders', category: 'Fidelidade', keywords: 'entrega comprovante', icon: Package },
  { title: 'Gráficos & BI', url: '/analytics', category: 'Sistema', keywords: 'bi metricas relatorios', icon: BarChart3 },
  { title: 'Configurações', url: '/settings', category: 'Sistema', keywords: 'parametros chaves api', icon: Settings },
];

interface GlobalCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disableShortcut?: boolean;
}

export function GlobalCommandPalette({
  open,
  onOpenChange,
  disableShortcut = false,
}: GlobalCommandPaletteProps) {
  const navigate = useNavigate();
  const { dadosRegiao, tocarSireneRompimento } = useNetworkMonitor();
  const { canAccessRoute } = useAuth();
  const [query, setQuery] = useState('');
  const [remoteClients, setRemoteClients] = useState<ISPFYClienteData[]>([]);
  const [searchingRemote, setSearchingRemote] = useState(false);

  const canViewClientProfile = canAccessRoute('/ispfy/consulta');
  const allowedPages = useMemo(
    () => ALL_PAGES.filter((page) => canAccessRoute(page.url)),
    [canAccessRoute]
  );

  useEffect(() => {
    if (disableShortcut) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange, disableShortcut]);

  // Busca instantânea (0ms) no snapshot em memória do NetworkMonitor
  const localMatches = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (clean.length < 2 || !dadosRegiao?.records) return [];
    const digits = clean.replace(/\D/g, '');

    const seen = new Set<string>();
    const found = [];
    for (const r of dadosRegiao.records) {
      if (seen.has(r.clienteId)) continue;
      const matchText =
        r.nome.toLowerCase().includes(clean) ||
        r.bairroLabel.toLowerCase().includes(clean) ||
        r.ruaLabel.toLowerCase().includes(clean) ||
        r.usuarioPppoe.toLowerCase().includes(clean) ||
        (digits.length >= 3 &&
          (r.cpfCnpj.replace(/\D/g, '').includes(digits) ||
            r.telefone.replace(/\D/g, '').includes(digits) ||
            r.clienteId === digits));
      if (matchText) {
        seen.add(r.clienteId);
        found.push(r);
        if (found.length >= 8) break;
      }
    }
    return found;
  }, [query, dadosRegiao]);

  // Fallback remoto na API ISPFY caso o termo não esteja no snapshot local
  useEffect(() => {
    const trimmed = query.trim();
    if (!open || trimmed.length < 3 || localMatches.length >= 3) {
      setRemoteClients([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingRemote(true);
      try {
        const digits = trimmed.replace(/\D/g, '');
        if (digits.length >= 11) {
          const byDoc = await ispfyService.getClienteByCnpjCpf(digits);
          setRemoteClients(byDoc ? [byDoc] : []);
        } else {
          const res = await ispfyService.getClienteByNome(trimmed);
          setRemoteClients(Array.isArray(res) ? res.slice(0, 6) : []);
        }
      } catch {
        setRemoteClients([]);
      } finally {
        setSearchingRemote(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query, open, localMatches.length]);

  const goTo = (url: string) => {
    onOpenChange(false);
    setQuery('');
    navigate(url);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Buscar cliente (Nome, CPF, Rua, Telefone) ou navegar..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[420px]">
        <CommandEmpty>
          {searchingRemote ? (
            <span className="text-xs text-muted-foreground">Consultando ISPFY...</span>
          ) : (
            'Nenhum cliente ou módulo encontrado.'
          )}
        </CommandEmpty>

        {canViewClientProfile && localMatches.length > 0 && (
          <CommandGroup heading="Clientes ISPFY (Busca Instantânea)">
            {localMatches.map((cli) => (
              <CommandItem
                key={`local-${cli.clienteId}-${cli.pontoId}`}
                value={`${cli.nome} ${cli.cpfCnpj} ${cli.ruaLabel} ${cli.bairroLabel} ${cli.telefone} ${cli.usuarioPppoe}`}
                onSelect={() => goTo(`/ispfy/cliente/${cli.clienteId}`)}
                className="flex items-center justify-between gap-2 py-2.5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {cli.connectionHealth === 'ok' ? (
                    <Wifi className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : cli.connectionHealth === 'desconectado' ? (
                    <WifiOff className="w-4 h-4 text-rose-500 shrink-0" />
                  ) : (
                    <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{cli.nome}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {cli.ruaLabel} • {cli.bairroLabel} {cli.telefone ? `• ${cli.telefone}` : ''}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={
                    cli.connectionHealth === 'ok'
                      ? 'secondary'
                      : cli.connectionHealth === 'desconectado'
                      ? 'destructive'
                      : 'outline'
                  }
                  className="text-[10px] shrink-0"
                >
                  {cli.connectionHealth === 'ok'
                    ? 'Online'
                    : cli.connectionHealth === 'desconectado'
                    ? 'Offline'
                    : 'Bloq/Inat'}
                </Badge>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {canViewClientProfile && remoteClients.length > 0 && (
          <CommandGroup heading="Resultados Diretos ISPFY">
            {remoteClients.map((cli) => (
              <CommandItem
                key={`remote-${cli.id}`}
                value={`remote ${cli.nome_razao || cli.nome || cli.razao} ${cli.cpf_cnpj || ''}`}
                onSelect={() => goTo(`/ispfy/cliente/${cli.id}`)}
                className="flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {cli.nome_razao || cli.razao || cli.nome}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    ID #{cli.id} • {cli.cpf_cnpj || cli.cnpj_cpf || 'Sem CPF'} • {cli.bairro || ''}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  Abrir Ficha
                </Badge>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Ações Rápidas">
          {canAccessRoute('/ispfy/nova-os') && (
            <CommandItem onSelect={() => goTo('/ispfy/nova-os')}>
              <ClipboardList className="mr-2 h-4 w-4 text-emerald-500" />
              <span>Abrir Nova Ordem de Serviço (O.S.)</span>
            </CommandItem>
          )}
          {canAccessRoute('/ispfy/inteligencia') && (
            <CommandItem onSelect={() => goTo('/ispfy/inteligencia')}>
              <Sparkles className="mr-2 h-4 w-4 text-violet-500" />
              <span>Consultar Viabilidade por CTO / Cadastrar Novo Cliente</span>
            </CommandItem>
          )}
          {canAccessRoute('/ispfy/regiao') && (
            <CommandItem
              onSelect={() => {
                onOpenChange(false);
                tocarSireneRompimento(2);
              }}
            >
              <Bell className="mr-2 h-4 w-4 text-amber-500" />
              <span>Testar Sirene Sonora de Rompimento NOC</span>
            </CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Módulos do Sistema">
          {allowedPages.map((page) => {
            const Icon = page.icon;
            return (
              <CommandItem
                key={page.url}
                value={`${page.title} ${page.category} ${page.keywords}`}
                onSelect={() => goTo(page.url)}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span>{page.title}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{page.category}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export function GlobalSearchTriggerButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-xl border border-border/80 bg-secondary/40 hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-all text-xs min-w-[190px] lg:min-w-[240px] justify-between"
      title="Busca Global de Clientes e Módulos (Ctrl+K)"
    >
      <span className="flex items-center gap-2 truncate">
        <Search className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">Buscar cliente ou tela...</span>
      </span>
      <kbd className="pointer-events-none hidden md:inline-flex h-5 select-none items-center gap-0.5 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
        Ctrl K
      </kbd>
    </button>
  );
}

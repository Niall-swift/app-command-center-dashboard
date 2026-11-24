import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  Database,
  ExternalLink,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Sparkles,
  User,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import PageTransition from '@/components/PageTransition';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AceternityEmptyState,
  AceternityPageHeader,
  MovingBorderButton,
  ShimmerBadge,
  SpotlightCard,
} from '@/components/ui/aceternity';
import { ISPFYClientDashboard } from '@/components/ispfy/ISPFYClientDashboard';
import { NewClientISPFYDialog } from '@/components/ispfy/explorer/NewClientISPFYDialog';
import { ispfyService } from '@/services/ispfy/ispfyService';
import type { ISPFYClienteData } from '@/types/ispfy';
import {
  formatarDocumentoCpfCnpj,
  obterNomeClienteISPFY,
} from '@/utils/ispfyFormatters';

type QuickFilterMode = 'recentes' | 'busca' | 'leads';

const ISPFYConsulta: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<QuickFilterMode>('recentes');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ISPFYClienteData[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    'testing' | 'connected' | 'disconnected'
  >('testing');
  const [newClientOpen, setNewClientOpen] = useState(false);

  const loadRecentClients = async () => {
    setLoading(true);
    setMode('recentes');
    try {
      const resp = await ispfyService.getAllClientes(1, 30, 'id', 'desc');
      const rows = (resp.data ?? resp.rows ?? resp.registros ?? []) as ISPFYClienteData[];
      setResults(rows);
      setConnectionStatus('connected');
      if (rows.length > 0 && !selectedClientId && rows[0].id) {
        setSelectedClientId(String(rows[0].id));
      }
    } catch (err) {
      console.error(err);
      setConnectionStatus('disconnected');
      toast.error('Não foi possível conectar ao ISPFY.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecentClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSmartSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      loadRecentClients();
      return;
    }

    setLoading(true);
    setMode('busca');
    try {
      const found = await ispfyService.smartSearchClientes(trimmed);
      setResults(found);
      setConnectionStatus('connected');
      if (found.length > 0 && found[0].id) {
        setSelectedClientId(String(found[0].id));
      } else {
        setSelectedClientId(null);
        toast.info('Nenhum cliente encontrado para esta busca.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao pesquisar clientes no ISPFY.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadLeads = async () => {
    setLoading(true);
    setMode('leads');
    setQuery('');
    try {
      const leads = await ispfyService.getLeads();
      setResults(leads);
      if (leads.length > 0 && leads[0].id) {
        setSelectedClientId(String(leads[0].id));
      } else {
        setSelectedClientId(null);
      }
    } catch {
      toast.error('Erro ao buscar leads no ISPFY.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="space-y-5 text-foreground">
        {/* Header Unificado Aceternity */}
        <AceternityPageHeader
          eyebrow={
            <span className="inline-flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-primary" />
              <span>Sistema ISPFY</span>
            </span>
          }
          badge={
            <ShimmerBadge
              pulse={connectionStatus === 'connected'}
              tone={
                connectionStatus === 'connected'
                  ? 'emerald'
                  : connectionStatus === 'testing'
                  ? 'amber'
                  : 'rose'
              }
            >
              {connectionStatus === 'connected'
                ? 'API ISPFY Conectada'
                : connectionStatus === 'testing'
                ? 'Conectando...'
                : 'Offline'}
            </ShimmerBadge>
          }
          icon={<Users className="w-6 h-6" />}
          title="ISPFY Explorer 360°"
          subtitle="Pesquise por nome, CPF/CNPJ, telefone/WhatsApp, e-mail ou ID e acesse cadastro completo, contratos, faturas, PIX, PPPoE, RADIUS, SmartOLT e O.S. em uma única tela."
          actions={
            <>
              <MovingBorderButton
                tone="primary"
                size="sm"
                onClick={() => setNewClientOpen(true)}
              >
                <UserPlus className="w-4 h-4" />
                Novo Cliente
              </MovingBorderButton>
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-xl gap-1.5 text-xs"
                onClick={() =>
                  window.open(ispfyService.getIspfyWebPanelUrl(), '_blank', 'noopener,noreferrer')
                }
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Painel ISPFY
              </Button>
            </>
          }
        />

        {/* Barra de Busca Inteligente Auto-Detect */}
        <SpotlightCard tone="blue" className="p-4">
          <form onSubmit={handleSmartSearch} className="flex flex-col md:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Digite nome, CPF/CNPJ, telefone/WhatsApp, ID ou e-mail do cliente..."
                className="pl-10 pr-9 h-11 rounded-xl text-sm"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    loadRecentClients();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button type="submit" disabled={loading} className="h-11 px-5 rounded-xl gap-2 font-semibold">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Buscar 360°
              </Button>
              <Button
                type="button"
                variant={mode === 'recentes' ? 'secondary' : 'outline'}
                onClick={loadRecentClients}
                disabled={loading}
                className="h-11 rounded-xl text-xs gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading && mode === 'recentes' ? 'animate-spin' : ''}`} />
                Recentes
              </Button>
              <Button
                type="button"
                variant={mode === 'leads' ? 'secondary' : 'outline'}
                onClick={handleLoadLeads}
                disabled={loading}
                className="h-11 rounded-xl text-xs"
              >
                Leads
              </Button>
            </div>
          </form>
        </SpotlightCard>

        {/* Master-Detail Explorer 360° */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          {/* Coluna Esquerda: Diretório de Clientes */}
          <SpotlightCard tone="violet" className="xl:col-span-4 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {mode === 'busca'
                    ? 'Resultados da Busca'
                    : mode === 'leads'
                    ? 'Leads ISPFY'
                    : 'Clientes Recentes'}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {results.length} cliente(s) listado(s)
                </p>
              </div>
              {selectedClientId && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px] gap-1 text-primary hover:text-primary"
                  onClick={() => navigate(`/ispfy/cliente/${selectedClientId}`)}
                >
                  Tela cheia
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : results.length === 0 ? (
              <AceternityEmptyState
                className="py-8"
                icon={<Search className="w-5 h-5" />}
                title="Nenhum cliente listado"
                description="Digite nome, CPF/CNPJ, WhatsApp ou ID acima para localizar qualquer assinante."
              />
            ) : (
              <ScrollArea className="h-[580px] pr-2">
                <div className="space-y-2">
                  {results.map((cli) => {
                    const idStr = String(cli.id || '');
                    const isSelected = selectedClientId === idStr;
                    const displayName = obterNomeClienteISPFY(cli, 'Cliente sem nome');
                    const docFmt = formatarDocumentoCpfCnpj(cli.cpf_cnpj || cli.cnpj_cpf || '');
                    const locationText = [
                      cli.endereco_cobranca_bairro || cli.bairro,
                      cli.cidade,
                    ]
                      .filter(Boolean)
                      .join(' • ');

                    return (
                      <button
                        key={idStr || displayName}
                        type="button"
                        onClick={() => setSelectedClientId(idStr)}
                        className={`w-full text-left rounded-xl border p-3 transition-all ${
                          isSelected
                            ? 'border-primary/50 bg-primary/10 shadow-[0_2px_12px_rgba(37,99,235,0.12)]'
                            : 'border-border/70 bg-background/60 dark:bg-white/[0.02] hover:border-primary/30 hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">
                              {displayName}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-muted-foreground font-mono">
                              <span>#{idStr}</span>
                              {docFmt && <span>• {docFmt}</span>}
                            </div>
                            {locationText && (
                              <p className="mt-1 text-[11px] text-muted-foreground truncate flex items-center gap-1">
                                <MapPin className="w-3 h-3 shrink-0 opacity-70" />
                                {locationText}
                              </p>
                            )}
                          </div>
                          {cli.lead === 'S' && (
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              Lead
                            </Badge>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </SpotlightCard>

          {/* Coluna Direita: Ficha Explorer 360° ao Vivo */}
          <div className="xl:col-span-8 min-w-0">
            {selectedClientId ? (
              <ISPFYClientDashboard
                key={selectedClientId}
                clientId={selectedClientId}
                compactHeader
              />
            ) : (
              <AceternityEmptyState
                icon={<User className="w-6 h-6" />}
                title="Selecione um cliente à esquerda"
                description="Ao clicar em qualquer cliente você verá cadastro completo, contratos, todas as faturas com PIX e Pré-Baixa, PPPoE, RADIUS, SmartOLT e chamados."
              />
            )}
          </div>
        </div>

        <NewClientISPFYDialog
          open={newClientOpen}
          onOpenChange={setNewClientOpen}
          onCreated={(newId) => {
            if (newId) {
              setSelectedClientId(newId);
            }
            loadRecentClients();
          }}
        />
      </div>
    </PageTransition>
  );
};

export default ISPFYConsulta;

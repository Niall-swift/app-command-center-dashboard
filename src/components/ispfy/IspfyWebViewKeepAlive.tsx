import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  AppWindow,
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  Copy,
  DollarSign,
  ExternalLink,
  Eye,
  Globe,
  Home,
  Loader2,
  MapPin,
  Monitor,
  Power,
  RefreshCw,
  Search,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useNetworkMonitor } from '@/contexts/NetworkMonitorContext';
import { useQuickClientDrawer } from '@/contexts/QuickClientDrawerContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/components/ui/sidebar';
import type {
  AvlDesktopBounds,
  AvlDesktopIspfyError,
  AvlDesktopIspfyState,
} from '@/types/avlDesktop';

export const ISPFY_OFFICIAL_WEB_URL = 'https://avltelecom.ispfycloud.com.br:8443/';

export type IspfyDockPlacement = 'right' | 'center';

let dockedWindowRef: Window | null = null;

export function isAvlDesktopRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean(window.avlDesktop?.isDesktop);
}

/**
 * Fallback para navegador comum (fora do AVL Control Desktop):
 * abre/reutiliza janela lateral para evitar o erro de cross-origin do Vue do ISPFY.
 */
export function openIspfyDockedWindow(
  placement: IspfyDockPlacement = 'right',
  url = ISPFY_OFFICIAL_WEB_URL
): boolean {
  try {
    if (dockedWindowRef && !dockedWindowRef.closed) {
      dockedWindowRef.focus();
      return true;
    }

    const availW = window.screen?.availWidth || 1366;
    const availH = window.screen?.availHeight || 768;
    const width =
      placement === 'center'
        ? Math.max(920, Math.round(availW * 0.82))
        : Math.max(760, Math.round(availW * 0.56));
    const height = Math.max(620, Math.round(availH * 0.92));
    const left =
      placement === 'center'
        ? Math.max(0, Math.round((availW - width) / 2))
        : Math.max(0, availW - width);
    const top = Math.max(0, Math.round((availH - height) / 2));

    const win = window.open(
      url,
      'avl_ispfy_dock',
      `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    if (win) {
      dockedWindowRef = win;
      win.focus();
      return true;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    return false;
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
    return false;
  }
}

function hasOpenOverlayInDom(): boolean {
  if (typeof document === 'undefined') return false;
  const overlays = document.querySelectorAll(
    '[role="dialog"], [role="alertdialog"], [data-radix-popper-content-wrapper], [aria-modal="true"]'
  );
  for (const el of overlays) {
    const htmlEl = el as HTMLElement;
    const style = window.getComputedStyle(htmlEl);
    if (style.display !== 'none' && style.visibility !== 'hidden' && htmlEl.offsetWidth > 0) {
      return true;
    }
  }
  return false;
}

/**
 * Página ISPFY Web (/ispfy/web):
 * - No AVL Control Desktop (Electron): renderiza o ISPFY 100% EMBUTIDO DENTRO DO APP
 *   em um WebContentsView nativo (zero erro do Vue, sessão persistente, Keep-Alive real e
 *   auto-ocultação inteligente quando qualquer modal/Ctrl+K/gaveta abre por cima!).
 * - No navegador comum (Chrome/Edge): informa claramente sobre o AVL Control Desktop
 *   e oferece ponte rápida de cliente + atalhos nativos.
 */
export const IspfyDockedHubPage: React.FC = () => {
  const isDesktop = isAvlDesktopRuntime();
  return isDesktop ? <NativeDesktopIspfyHost /> : <BrowserIspfyFallbackPage />;
};

const NativeDesktopIspfyHost: React.FC = () => {
  const { open: sidebarOpen, openMobile: sidebarOpenMobile } = useSidebar();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const lastBoundsKeyRef = useRef<string>('');
  const wasVisibleRef = useRef<boolean>(false);

  const [viewState, setViewState] = useState<AvlDesktopIspfyState>({
    mounted: false,
    visible: false,
    loading: true,
    url: ISPFY_OFFICIAL_WEB_URL,
    canGoBack: false,
    canGoForward: false,
  });
  const [loadError, setLoadError] = useState<AvlDesktopIspfyError | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [sessionUnloaded, setSessionUnloaded] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const computeClampedBounds = useCallback((): AvlDesktopBounds | null => {
    const el = hostRef.current;
    if (!el) return null;

    const rect = el.getBoundingClientRect();
    const headerEl = document.querySelector('[data-avl-header="true"]') as HTMLElement | null;
    const minTop = headerEl ? Math.ceil(headerEl.getBoundingClientRect().bottom) : 0;

    // Respeita a borda direita real da sidebar visível (inclusive durante a animação de 200ms)
    let minLeft = 0;
    const sidebarEl = document.querySelector(
      '[data-sidebar="sidebar"]:not([data-mobile="true"])'
    ) as HTMLElement | null;
    if (sidebarEl) {
      const sRect = sidebarEl.getBoundingClientRect();
      if (sRect.width > 0 && sRect.right > 0) {
        minLeft = Math.ceil(sRect.right);
      }
    }

    const left = Math.max(minLeft, Math.ceil(rect.left) + 1);
    const top = Math.max(minTop, Math.ceil(rect.top) + 1);
    const right = Math.min(window.innerWidth, Math.floor(rect.right) - 1);
    const bottom = Math.min(window.innerHeight, Math.floor(rect.bottom) - 1);

    const width = Math.max(0, right - left);
    const height = Math.max(0, bottom - top);

    if (width < 20 || height < 20) return null;
    return { x: left, y: top, width, height };
  }, []);

  const syncBounds = useCallback(
    (forceShow = false) => {
      const bridge = window.avlDesktop?.ispfy;
      if (!bridge || sessionUnloaded) return;

      if (hasOpenOverlayInDom()) {
        setOverlayOpen(true);
        if (wasVisibleRef.current) {
          wasVisibleRef.current = false;
          lastBoundsKeyRef.current = '';
          void bridge.hide();
        }
        return;
      }

      setOverlayOpen(false);
      const bounds = computeClampedBounds();
      if (!bounds) {
        if (wasVisibleRef.current) {
          wasVisibleRef.current = false;
          lastBoundsKeyRef.current = '';
          void bridge.hide();
        }
        return;
      }

      const key = `${bounds.x},${bounds.y},${bounds.width},${bounds.height}`;
      if (!forceShow && wasVisibleRef.current && lastBoundsKeyRef.current === key) {
        return;
      }

      lastBoundsKeyRef.current = key;
      if (forceShow || !wasVisibleRef.current) {
        wasVisibleRef.current = true;
        void bridge.show(bounds);
      } else {
        void bridge.setBounds(bounds);
      }
    },
    [sessionUnloaded, computeClampedBounds]
  );

  // Rastreia continuamente frame-a-frame durante transições da Sidebar / redimensionamentos (~300ms)
  const trackTransitionFrames = useCallback(
    (durationMs = 320) => {
      const start = performance.now();
      let rafId = 0;
      const tick = () => {
        syncBounds(false);
        if (performance.now() - start < durationMs) {
          rafId = window.requestAnimationFrame(tick);
        }
      };
      rafId = window.requestAnimationFrame(tick);
      return () => window.cancelAnimationFrame(rafId);
    },
    [syncBounds]
  );

  // Escuta estado, erros e pedidos de ressincronização do processo principal Electron
  useEffect(() => {
    const bridge = window.avlDesktop?.ispfy;
    if (!bridge) return;

    const unsubState = bridge.onState((next) => {
      setViewState(next);
      if (!next.loading) {
        setLoadError(null);
      }
    });
    const unsubError = bridge.onError((err) => {
      setLoadError(err);
    });
    const unsubRequestSync = bridge.onRequestSync
      ? bridge.onRequestSync(() => {
          syncBounds(true);
          trackTransitionFrames(240);
        })
      : () => undefined;

    return () => {
      unsubState();
      unsubError();
      unsubRequestSync();
    };
  }, [syncBounds, trackTransitionFrames]);

  // Acompanha abertura/fechamento da Sidebar frame-a-frame (transição CSS de 200ms)
  useEffect(() => {
    if (sessionUnloaded) return;
    return trackTransitionFrames(320);
  }, [sidebarOpen, sidebarOpenMobile, sessionUnloaded, trackTransitionFrames]);

  // Mostra o WebContentsView ao entrar em /ispfy/web e oculta (Keep-Alive!) ao sair
  useEffect(() => {
    const bridge = window.avlDesktop?.ispfy;
    if (!bridge) return;

    if (sessionUnloaded) {
      wasVisibleRef.current = false;
      lastBoundsKeyRef.current = '';
      void bridge.hide();
      return;
    }

    const frame = window.requestAnimationFrame(() => syncBounds(true));

    const el = hostRef.current;
    const resizeObserver = new ResizeObserver(() => {
      syncBounds(false);
    });
    if (el) {
      resizeObserver.observe(el);
    }

    // Detecta abertura de modais, Ctrl+K, Gaveta 360°, Personalizar e Tela PIN para nunca sobrepor
    const mutationObserver = new MutationObserver(() => {
      syncBounds(false);
    });
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state', 'aria-modal', 'style', 'class'],
    });

    const onWindowResize = () => syncBounds(false);
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('scroll', onWindowResize, true);

    // Guarda leve contra qualquer deslocamento de layout sem resize (ex.: troca de fonte ou subtítulo)
    const driftGuard = window.setInterval(() => {
      syncBounds(false);
    }, 300);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(driftGuard);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', onWindowResize);
      window.removeEventListener('scroll', onWindowResize, true);
      wasVisibleRef.current = false;
      lastBoundsKeyRef.current = '';
      void bridge.hide();
    };
  }, [sessionUnloaded, syncBounds]);

  const handleDestroy = async () => {
    await window.avlDesktop?.ispfy.destroy();
    wasVisibleRef.current = false;
    lastBoundsKeyRef.current = '';
    setSessionUnloaded(true);
    toast.info('Sessão embutida do ISPFY encerrada.');
  };

  const handleReopen = () => {
    setLoadError(null);
    setSessionUnloaded(false);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col rounded-2xl border border-border/75 bg-card overflow-hidden shadow-sm">
      {/* Barra superior integrada do WebView nativo */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-muted/40 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="flex items-center gap-0.5 mr-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={!viewState.canGoBack || sessionUnloaded}
              onClick={() => void window.avlDesktop?.ispfy.goBack()}
              className="h-7 w-7 rounded-lg"
              title="Voltar"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={!viewState.canGoForward || sessionUnloaded}
              onClick={() => void window.avlDesktop?.ispfy.goForward()}
              className="h-7 w-7 rounded-lg"
              title="Avançar"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={sessionUnloaded}
              onClick={() => {
                setLoadError(null);
                void window.avlDesktop?.ispfy.reload();
              }}
              className="h-7 w-7 rounded-lg"
              title="Recarregar página"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${viewState.loading && !sessionUnloaded ? 'animate-spin text-primary' : ''}`}
              />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={sessionUnloaded}
              onClick={() => {
                setLoadError(null);
                void window.avlDesktop?.ispfy.goHome();
              }}
              className="h-7 w-7 rounded-lg"
              title="Ir para início do ISPFY"
            >
              <Home className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <Badge
              variant="outline"
              className="text-[10px] h-5 px-2 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 shrink-0"
            >
              WebView Nativo
            </Badge>
            <button
              type="button"
              onClick={() => {
                const targetUrl = viewState.url || ISPFY_OFFICIAL_WEB_URL;
                navigator.clipboard?.writeText(targetUrl).catch(() => undefined);
                setCopiedUrl(true);
                toast.success('URL atual do ISPFY copiada!');
                window.setTimeout(() => setCopiedUrl(false), 1500);
              }}
              className="text-[11px] font-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1 truncate max-w-[260px] sm:max-w-[440px]"
              title="Copiar URL atual"
            >
              <span className="truncate">{viewState.url || ISPFY_OFFICIAL_WEB_URL}</span>
              {copiedUrl ? (
                <Check className="w-3 h-3 text-emerald-500 shrink-0" />
              ) : (
                <Copy className="w-3 h-3 opacity-60 shrink-0" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() =>
              window.open(viewState.url || ISPFY_OFFICIAL_WEB_URL, '_blank', 'noopener,noreferrer')
            }
            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
            title="Abrir no navegador externo"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
          {!sessionUnloaded && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => void handleDestroy()}
              className="h-7 w-7 rounded-lg text-muted-foreground hover:text-rose-500"
              title="Encerrar WebView para liberar memória"
            >
              <Power className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Área hospedeira exata onde o Electron encaixa o WebContentsView nativo */}
      <div ref={hostRef} className="relative flex-1 min-h-0 bg-background">
        {sessionUnloaded ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Globe className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-foreground">ISPFY em repouso</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Clique abaixo para reabrir o ISPFY nativo integrado aqui dentro do aplicativo.
              </p>
            </div>
            <Button type="button" size="sm" onClick={handleReopen} className="rounded-xl gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              Reabrir ISPFY aqui dentro
            </Button>
          </div>
        ) : loadError ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-foreground">
                Não foi possível carregar o ISPFY ({loadError.code})
              </p>
              <p className="text-xs text-muted-foreground max-w-md">{loadError.description}</p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setLoadError(null);
                void window.avlDesktop?.ispfy.reload();
              }}
              className="rounded-xl gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Tentar novamente
            </Button>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground select-none">
            {overlayOpen ? (
              <p className="text-xs">ISPFY pausado visualmente enquanto o painel acima está aberto...</p>
            ) : (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <p className="text-xs font-medium">Conectando ao ISPFY Cloud nativo...</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const BrowserIspfyFallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const { dadosRegiao } = useNetworkMonitor();
  const { openClientDrawer } = useQuickClientDrawer();
  const { canAccessRoute } = useAuth();
  const [query, setQuery] = useState('');

  const quickMatches = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (clean.length < 2 || !dadosRegiao?.records) return [];
    const digits = clean.replace(/\D/g, '');
    const seen = new Set<string>();
    const out = [];
    for (const r of dadosRegiao.records) {
      if (seen.has(r.clienteId)) continue;
      const hit =
        r.nome.toLowerCase().includes(clean) ||
        r.bairroLabel.toLowerCase().includes(clean) ||
        r.ruaLabel.toLowerCase().includes(clean) ||
        r.usuarioPppoe.toLowerCase().includes(clean) ||
        (digits.length >= 3 &&
          (r.cpfCnpj.replace(/\D/g, '').includes(digits) ||
            r.telefone.replace(/\D/g, '').includes(digits) ||
            r.clienteId === digits));
      if (hit) {
        seen.add(r.clienteId);
        out.push(r);
        if (out.length >= 8) break;
      }
    }
    return out;
  }, [query, dadosRegiao]);

  const nativeShortcuts = [
    {
      title: 'ISPFY Explorer 360°',
      desc: 'Ficha completa, PPPoE, SmartOLT e faturas',
      url: '/ispfy/consulta',
      icon: Users,
    },
    {
      title: 'Nova O.S.',
      desc: 'Abrir ordem de serviço com disparo WhatsApp',
      url: '/ispfy/nova-os',
      icon: ClipboardList,
    },
    {
      title: 'Clientes Bairro/Rua',
      desc: 'Monitoramento de quedas e rompimentos',
      url: '/ispfy/regiao',
      icon: MapPin,
    },
    {
      title: 'Financeiro & Caixa',
      desc: 'Inadimplência, cobrança e fluxo de caixa',
      url: '/ispfy/financeiro',
      icon: DollarSign,
    },
  ].filter((item) => canAccessRoute(item.url));

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <section className="rounded-2xl border border-primary/25 bg-card p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-primary/12 text-primary flex items-center justify-center shrink-0">
            <Monitor className="w-5 h-5" />
          </div>
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                ISPFY 100% Embutido no AVL Control Desktop
              </h2>
              <Badge
                variant="outline"
                className="text-[10px] bg-primary/10 text-primary border-primary/30"
              >
                App Windows
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Você está acessando pelo navegador comum. Como o Vue do ISPFY bloqueia execução em
              iframe de outro domínio, para usar o ISPFY <strong>100% dentro da mesma janela</strong>{' '}
              (sem abrir outra janela, sem erro de certificado SSL e com login salvo), abra o{' '}
              <strong>AVL Control Desktop (.exe)</strong> no seu PC Windows.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openIspfyDockedWindow('right')}
            className="h-9 rounded-xl text-xs gap-1.5"
          >
            <AppWindow className="w-3.5 h-3.5 text-primary" />
            Abrir ISPFY lado a lado (navegador)
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => window.open(ISPFY_OFFICIAL_WEB_URL, '_blank', 'noopener,noreferrer')}
            className="h-9 rounded-xl text-xs gap-1.5 text-muted-foreground"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Abrir em nova aba
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border/75 bg-card p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Search className="w-4 h-4 text-primary" />
          Busca Rápida de Cliente
        </h3>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Digite nome, CPF, telefone, bairro ou login PPPoE..."
          className="h-10 rounded-xl bg-secondary/40 border-border/70 text-sm"
        />
        {quickMatches.length > 0 && (
          <div className="divide-y divide-border/60 rounded-xl border border-border/70 overflow-hidden bg-background/60">
            {quickMatches.map((cli) => (
              <div
                key={`${cli.clienteId}-${cli.pontoId}`}
                className="p-2.5 px-3 flex items-center justify-between gap-3 hover:bg-secondary/40"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {cli.connectionHealth === 'ok' ? (
                    <Wifi className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-rose-500 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{cli.nome}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {cli.cpfCnpj || `ID #${cli.clienteId}`} • {cli.ruaLabel} — {cli.bairroLabel}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    openClientDrawer({
                      clienteId: cli.clienteId,
                      nome: cli.nome,
                      telefone: cli.telefone,
                      bairro: cli.bairroLabel,
                      rua: cli.ruaLabel,
                      enderecoCompleto: cli.enderecoCompleto,
                      usuarioPppoe: cli.usuarioPppoe,
                      plano: cli.plano,
                      connectionHealth:
                        cli.connectionHealth === 'ok'
                          ? 'ok'
                          : cli.connectionHealth === 'desconectado'
                          ? 'desconectado'
                          : cli.connectionHealth === 'inativo'
                          ? 'inativo'
                          : 'bloqueado',
                    })
                  }
                  className="h-7 px-2.5 rounded-lg text-[11px] gap-1 shrink-0"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Gaveta 360°
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {nativeShortcuts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {nativeShortcuts.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.url}
                type="button"
                onClick={() => navigate(item.url)}
                className="flex items-center gap-3 p-3.5 rounded-2xl border border-border/70 bg-card hover:bg-secondary/50 hover:border-primary/35 transition-all text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">{item.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{item.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default IspfyDockedHubPage;

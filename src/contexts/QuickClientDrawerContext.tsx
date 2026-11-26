import React, {
  Suspense,
  createContext,
  lazy,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

export interface QuickClientPreviewSeed {
  clienteId: string;
  nome?: string;
  telefone?: string;
  bairro?: string;
  rua?: string;
  enderecoCompleto?: string;
  usuarioPppoe?: string;
  plano?: string;
  connectionHealth?: 'ok' | 'desconectado' | 'bloqueado' | 'inativo';
}

const loadQuickClientDrawerSheet = () =>
  import('@/components/ispfy/QuickClientDrawerSheet').then((module) => ({
    default: module.QuickClientDrawerSheet,
  }));

const LazyQuickClientDrawerSheet = lazy(loadQuickClientDrawerSheet);

interface QuickClientDrawerContextValue {
  activeClient: QuickClientPreviewSeed | null;
  open: boolean;
  openClientDrawer: (seed: QuickClientPreviewSeed) => void;
  closeClientDrawer: () => void;
  preloadClientDrawer: () => void;
}

const QuickClientDrawerContext = createContext<QuickClientDrawerContextValue | undefined>(
  undefined
);

// eslint-disable-next-line react-refresh/only-export-components
export function useQuickClientDrawer(): QuickClientDrawerContextValue {
  const ctx = useContext(QuickClientDrawerContext);
  if (!ctx) {
    throw new Error('useQuickClientDrawer deve ser usado dentro de QuickClientDrawerProvider');
  }
  return ctx;
}

export const QuickClientDrawerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeClient, setActiveClient] = useState<QuickClientPreviewSeed | null>(null);

  const openClientDrawer = useCallback((seed: QuickClientPreviewSeed) => {
    const cleanId = String(seed.clienteId || '').trim();
    if (!cleanId) return;
    setMounted(true);
    setActiveClient({ ...seed, clienteId: cleanId });
    setOpen(true);
  }, []);

  const closeClientDrawer = useCallback(() => {
    setOpen(false);
  }, []);

  const preloadClientDrawer = useCallback(() => {
    void loadQuickClientDrawerSheet();
  }, []);

  const value = useMemo<QuickClientDrawerContextValue>(
    () => ({
      activeClient,
      open,
      openClientDrawer,
      closeClientDrawer,
      preloadClientDrawer,
    }),
    [activeClient, open, openClientDrawer, closeClientDrawer, preloadClientDrawer]
  );

  return (
    <QuickClientDrawerContext.Provider value={value}>
      {children}
      {mounted && (
        <Suspense fallback={null}>
          <LazyQuickClientDrawerSheet
            open={open}
            onOpenChange={setOpen}
            seed={activeClient}
          />
        </Suspense>
      )}
    </QuickClientDrawerContext.Provider>
  );
};

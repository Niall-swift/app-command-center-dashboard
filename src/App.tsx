import { Suspense, lazy, useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";

import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { UiPreferencesProvider, useUiPreferences } from "./contexts/UiPreferencesContext";
import { ActiveChatClientProvider } from "./contexts/ActiveChatClientContext";
import { ChatNotificationProvider } from "./contexts/ChatNotificationContext";
import { NetworkMonitorProvider } from "./contexts/NetworkMonitorContext";
import { QuickClientDrawerProvider } from "./contexts/QuickClientDrawerContext";
import { ProtectedRoute, RoutePermissionGuard } from "./components/auth/ProtectedRoute";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import QuickOSFab from "./components/ispfy/QuickOSFab";
import { PwaAppBridge } from "./components/layout/PwaAppBridge";

// Code-splitting por rota para reduzir o bundle inicial e acelerar o carregamento do PWA
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Chat = lazy(() => import("./pages/Chat"));
const Requests = lazy(() => import("./pages/Requests"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Bots = lazy(() => import("./pages/Bots"));
const Settings = lazy(() => import("./pages/Settings"));
const Raffle = lazy(() => import("./pages/Raffle"));
const PaidRaffles = lazy(() => import("./pages/PaidRaffles"));
const PublicPaidRaffle = lazy(() => import("./pages/PublicPaidRaffle"));
const TechnicalSupport = lazy(() => import("./pages/TechnicalSupport"));
const NetworkMap = lazy(() => import("./pages/NetworkMap"));
const Movies = lazy(() => import("./pages/Movies"));
const Series = lazy(() => import("./pages/Series"));
const ISPFYConsulta = lazy(() => import("./pages/ISPFYConsulta"));
const ISPFYWebHub = lazy(() => import("./components/ispfy/IspfyWebViewKeepAlive"));
const ISPFYFinanceiro = lazy(() => import("./pages/ISPFYFinanceiro"));
const ISPFYTickets = lazy(() => import("./pages/ISPFYTickets"));
const WhatsAppBulkSender = lazy(() => import("./pages/WhatsAppBulkSender"));
const RewardsManagement = lazy(() => import("./pages/RewardsManagement"));
const RedemptionOrders = lazy(() => import("./pages/RedemptionOrders"));
const ISPFYClientDetails = lazy(() => import("./pages/ISPFYClientDetails"));
const ISPFYDici = lazy(() => import("./pages/ISPFYDici"));
const ISPFYActiveClientsExport = lazy(() => import("./pages/ISPFYActiveClientsExport"));
const ISPFYVencimentos = lazy(() => import("./pages/ISPFYVencimentos"));
const ISPFYNovaOS = lazy(() => import("./pages/ISPFYNovaOS"));
const ISPFYAuditoria = lazy(() => import("./pages/ISPFYAuditoria"));
const ISPFYClientesRegiao = lazy(() => import("./pages/ISPFYClientesRegiao"));
const ISPFYCarencia = lazy(() => import("./pages/ISPFYCarencia"));
const ISPFYInteligencia = lazy(() => import("./pages/ISPFYInteligencia"));
const Notifications = lazy(() => import("./pages/Notifications"));
const AVLPlayAnalytics = lazy(() => import("./pages/AVLPlayAnalytics"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function PageLoader() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="text-center space-y-2">
        <div className="animate-spin rounded-full h-7 w-7 border-2 border-primary border-t-transparent mx-auto" />
        <p className="text-xs text-muted-foreground font-medium">Carregando módulo...</p>
      </div>
    </div>
  );
}

function AnimatedRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/chat" element={<Chat />} />
      <Route path="/requests" element={<Requests />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/bots" element={<Bots />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/raffle" element={<Raffle />} />
      <Route path="/paid-raffles" element={<PaidRaffles />} />
      <Route path="/movies" element={<Movies />} />
      <Route path="/series" element={<Series />} />
      <Route path="/avlplay-analytics" element={<AVLPlayAnalytics />} />
      <Route path="/technical-support" element={<TechnicalSupport />} />
      <Route path="/network-map" element={<NetworkMap />} />
      <Route path="/ispfy/consulta" element={<ISPFYConsulta />} />
      <Route path="/ispfy/explorer" element={<ISPFYConsulta />} />
      <Route path="/ispfy/web" element={<ISPFYWebHub />} />
      <Route path="/ispfy/auditoria" element={<ISPFYAuditoria />} />
      <Route path="/ispfy/regiao" element={<ISPFYClientesRegiao />} />
      <Route path="/ispfy/inteligencia" element={<ISPFYInteligencia />} />
      <Route path="/ispfy/cliente/:id" element={<ISPFYClientDetails />} />
      <Route path="/ispfy/financeiro" element={<ISPFYFinanceiro />} />
      <Route path="/ispfy/tickets" element={<ISPFYTickets />} />
      <Route path="/ispfy/dici" element={<ISPFYDici />} />
      <Route path="/ispfy/exportar-ativos" element={<ISPFYActiveClientsExport />} />
      <Route path="/ispfy/vencimentos" element={<ISPFYVencimentos />} />
      <Route path="/ispfy/nova-os" element={<ISPFYNovaOS />} />
      <Route path="/ispfy/carencia" element={<ISPFYCarencia />} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="/whatsapp/bulk" element={<WhatsAppBulkSender />} />
      <Route path="/rewards-management" element={<RewardsManagement />} />
      <Route path="/redemption-orders" element={<RedemptionOrders />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function AppContent() {
  const location = useLocation();
  const isPublicRoute = location.pathname.startsWith("/sorteio-compra/");

  if (isPublicRoute) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/sorteio-compra/:id" element={<PublicPaidRaffle />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <ProtectedRoute>
      <NetworkMonitorProvider>
        <ActiveChatClientProvider>
          <QuickClientDrawerProvider>
            <DashboardLayout>
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <RoutePermissionGuard>
                    <AppContentWithRouterFix />
                  </RoutePermissionGuard>
                </Suspense>
              </ErrorBoundary>
            </DashboardLayout>
            <QuickOSFab />
            <PwaAppBridge />
          </QuickClientDrawerProvider>
        </ActiveChatClientProvider>
      </NetworkMonitorProvider>
    </ProtectedRoute>
  );
}

// Helper to keep location context working properly and honor user's preferred landing screen once per session
function AppContentWithRouterFix() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, canAccessRoute } = useAuth();
  const { preferences } = useUiPreferences();
  const redirectedUidRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      redirectedUidRef.current = null;
      return;
    }
    if (redirectedUidRef.current === user.uid) return;
    redirectedUidRef.current = user.uid;

    const targetHome = preferences.defaultHomeRoute;
    if (
      location.pathname === "/" &&
      targetHome &&
      targetHome !== "/" &&
      canAccessRoute(targetHome)
    ) {
      navigate(targetHome, { replace: true });
    }
  }, [user?.uid, location.pathname, preferences.defaultHomeRoute, canAccessRoute, navigate]);

  return <AnimatedRoutes />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-right" richColors closeButton />
        <AuthProvider>
          <UiPreferencesProvider>
            <ChatNotificationProvider>
              <BrowserRouter>
                <AppContent />
              </BrowserRouter>
            </ChatNotificationProvider>
          </UiPreferencesProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

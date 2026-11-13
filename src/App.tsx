import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";

import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AuthProvider } from "./contexts/AuthContext";
import { ChatNotificationProvider } from "./contexts/ChatNotificationContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import QuickOSFab from "./components/ispfy/QuickOSFab";

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
const Notifications = lazy(() => import("./pages/Notifications"));
const AVLPlayAnalytics = lazy(() => import("./pages/AVLPlayAnalytics"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        <p className="mt-2 text-sm text-muted-foreground">Carregando módulo...</p>
      </div>
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
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
        <Route path="/ispfy/auditoria" element={<ISPFYAuditoria />} />
        <Route path="/ispfy/regiao" element={<ISPFYClientesRegiao />} />
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
    </AnimatePresence>
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
      <DashboardLayout>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <AppContentWithRouterFix />
          </Suspense>
        </ErrorBoundary>
      </DashboardLayout>
      <QuickOSFab />
    </ProtectedRoute>
  );
}

// Helper to keep location context working properly within the dashboard layout
function AppContentWithRouterFix() {
  return <AnimatedRoutes />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <ChatNotificationProvider>
            <BrowserRouter>
              <AppContent />
            </BrowserRouter>
          </ChatNotificationProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

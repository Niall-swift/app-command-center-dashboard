
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
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import Requests from "./pages/Requests";
import Analytics from "./pages/Analytics";
import Bots from "./pages/Bots";
import Settings from "./pages/Settings";
import Raffle from "./pages/Raffle";
import PaidRaffles from "./pages/PaidRaffles";
import PublicPaidRaffle from "./pages/PublicPaidRaffle";
import TechnicalSupport from "./pages/TechnicalSupport";
import NetworkMap from "./pages/NetworkMap";
import Movies from "./pages/Movies";
import Series from "./pages/Series";
import ISPFYConsulta from "./pages/ISPFYConsulta";
import ISPFYFinanceiro from "./pages/ISPFYFinanceiro";
import ISPFYTickets from "./pages/ISPFYTickets";
import WhatsAppBulkSender from "./pages/WhatsAppBulkSender";
import RewardsManagement from "./pages/RewardsManagement";
import RedemptionOrders from "./pages/RedemptionOrders";
import Rewards from "./pages/Rewards";
import Leaderboard from "./pages/Leaderboard";
import MyReferrals from "./pages/MyReferrals";
import ISPFYClientDetails from "./pages/ISPFYClientDetails";
import ISPFYDici from "./pages/ISPFYDici";
import ISPFYActiveClientsExport from "./pages/ISPFYActiveClientsExport";
import ISPFYVencimentos from "./pages/ISPFYVencimentos";
import Notifications from "./pages/Notifications";
import AVLPlayAnalytics from "./pages/AVLPlayAnalytics";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
        <Route path="/ispfy/cliente/:id" element={<ISPFYClientDetails />} />
        <Route path="/ispfy/financeiro" element={<ISPFYFinanceiro />} />
        <Route path="/ispfy/tickets" element={<ISPFYTickets />} />
        <Route path="/ispfy/dici" element={<ISPFYDici />} />
        <Route path="/ispfy/exportar-ativos" element={<ISPFYActiveClientsExport />} />
        <Route path="/ispfy/vencimentos" element={<ISPFYVencimentos />} />
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
        <Routes>
          <Route path="/sorteio-compra/:id" element={<PublicPaidRaffle />} />
        </Routes>
      </ErrorBoundary>
    );
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <ErrorBoundary>
          <AppContentWithRouterFix />
        </ErrorBoundary>
      </DashboardLayout>
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

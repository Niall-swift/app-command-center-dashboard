
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import TechnicalSupport from "./pages/TechnicalSupport";
import NetworkMap from "./pages/NetworkMap";
import Movies from "./pages/Movies";
import Series from "./pages/Series";
import IXCConsulta from "./pages/IXCConsulta";
import IXCFinanceiro from "./pages/IXCFinanceiro";
import IXCTickets from "./pages/IXCTickets";
import WhatsAppBulkSender from "./pages/WhatsAppBulkSender";
import RewardsManagement from "./pages/RewardsManagement";
import RedemptionOrders from "./pages/RedemptionOrders";
import Rewards from "./pages/Rewards";
import Leaderboard from "./pages/Leaderboard";
import MyReferrals from "./pages/MyReferrals";
import IXCClientDetails from "./pages/IXCClientDetails";
import IXCDici from "./pages/IXCDici";
import Notifications from "./pages/Notifications";
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
        <Route path="/movies" element={<Movies />} />
        <Route path="/series" element={<Series />} />
        <Route path="/technical-support" element={<TechnicalSupport />} />
        <Route path="/network-map" element={<NetworkMap />} />
        <Route path="/ixc/consulta" element={<IXCConsulta />} />
        <Route path="/ixc/cliente/:id" element={<IXCClientDetails />} />
        <Route path="/ixc/financeiro" element={<IXCFinanceiro />} />
        <Route path="/ixc/tickets" element={<IXCTickets />} />
        <Route path="/ixc/dici" element={<IXCDici />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/whatsapp/bulk" element={<WhatsAppBulkSender />} />
        <Route path="/rewards-management" element={<RewardsManagement />} />
        <Route path="/redemption-orders" element={<RedemptionOrders />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <ChatNotificationProvider>
          <BrowserRouter>
            <ProtectedRoute>
              <DashboardLayout>
                <ErrorBoundary>
                  <AnimatedRoutes />
                </ErrorBoundary>
              </DashboardLayout>
            </ProtectedRoute>
          </BrowserRouter>
        </ChatNotificationProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

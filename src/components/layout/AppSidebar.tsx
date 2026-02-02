
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  MessageSquare,
  Send,
  FileText,
  BarChart3,
  Bot,
  Home,
  Settings,
  Gift,
  Wrench,
  Map,
  Film,
  Tv,
  Users,
  DollarSign,
  Ticket,
  Database
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

const menuItems = [
  // {
  //   title: "Dashboard",
  //   url: "/",
  //   icon: Home,
  // },
  {
    title: "Chat",
    url: "/chat",
    icon: MessageSquare,
  },
  {
    title: "Envio em Massa",
    url: "/whatsapp/bulk",
    icon: Send,
  },
  // {
  //   title: "Solicitações",
  //   url: "/requests",
  //   icon: FileText,
  // },
  // {
  //   title: "Suporte Técnico",
  //   url: "/technical-support",
  //   icon: Wrench,
  // },
  // {
  //   title: "Mapa da Rede",
  //   url: "/network-map",
  //   icon: Map,
  // },
  // {
  //   title: "Gráficos",
  //   url: "/analytics",
  //   icon: BarChart3,
  // },
  // {
  //   title: "Criar Bots",
  //   url: "/bots",
  //   icon: Bot,
  // },
  {
    title: "Sorteio",
    url: "/raffle",
    icon: Gift,
  },
  {
    title: "Filmes",
    url: "/movies",
    icon: Film,
  },
  {
    title: "Séries",
    url: "/series",
    icon: Tv,
  },
  // {
  //   title: "Configurações",
  //   url: "/settings",
  //   icon: Settings,
  // },
];

const ixcMenuItems = [
  {
    title: "Consulta de Clientes",
    url: "/ixc/consulta",
    icon: Users,
  },
  {
    title: "Financeiro",
    url: "/ixc/financeiro",
    icon: DollarSign,
  },
  {
    title: "Tickets de Suporte",
    url: "/ixc/tickets",
    icon: Ticket,
  },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <Sidebar className="border-r bg-white">
      <SidebarHeader className="p-6 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">App Control</h2>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-gray-500 text-sm font-medium mb-2">
            Navegação Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {menuItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      className={`w-full justify-start px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <Link to={item.url} className="flex items-center gap-3">
                        <item.icon className="w-5 h-5" />
                        <span className="font-medium">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="text-gray-500 text-sm font-medium mb-2 flex items-center gap-2">
            <Database className="w-4 h-4" />
            Sistema IXC
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {ixcMenuItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      className={`w-full justify-start px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-green-50 text-green-600 border-r-2 border-green-600'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <Link to={item.url} className="flex items-center gap-3">
                        <item.icon className="w-5 h-5" />
                        <span className="font-medium">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t">
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-medium">A</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">Admin</p>
            <p className="text-xs text-gray-500 truncate">admin@appcontrol.com</p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
